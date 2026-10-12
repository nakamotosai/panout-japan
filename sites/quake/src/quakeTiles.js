/**
 * 全球震源地理瓦片 · Cesium 风格精简可见性
 *
 * 1. 地平线以上 + look-at 焦点锥（角半径随高度，硬顶 ~26°）
 * 2. 太空/开场：只 bootstrap 日本，禁止整球灌入
 * 3. 单次 wanted 硬顶瓦片数；内存/IDB 常驻，GPU sticky 可缩
 * 4. 上屏 = 视锥内点 + maxDisplay（近焦点优先）
 */
import { project } from './coords.js'
import { cacheFetchJson, cacheMemStats } from './tileCache.js'
import {
  SPACE_ALT_KM,
  cameraAltitudeKm,
  filterQuakesInView,
  isTileInView,
  viewConeRad,
} from './viewCull.js'

export const MANIFEST_URL = '/data/quakes/manifest.json'
export const TILE_URL_PREFIX = '/data/quakes/tiles/'

export const POINT_DOT_MIN = 0.22

/**
 * 上屏点数（InstancedMesh）
 * 2026-07-16 验收后丝滑，默认/上限上调；卡顿仍由 adaptDisplayCap 自动降
 * 桌面常量保持；手机用 MOBILE_*（main 经 isCompactScreen 选型）
 */
export const DEFAULT_MAX_DISPLAY = 70000
export const MIN_MAX_DISPLAY = 20000
export const MAX_MAX_DISPLAY = 100000

/**
 * 手机上屏 cap — 桌面路径勿用。
 * 日本 bootstrap 四格 recent≥2000 在 26° 锥内约 5.4 万点；
 * 默认/上限须盖住「整屏日本相关点一次出全」，否则 pickNearest 只留近焦点 2 万，
 * 拖图换焦点才换批（用户感知：一点点显示）。
 * 卡顿仍由 adaptDisplayCap 自动降到 MIN。
 */
export const MOBILE_DEFAULT_MAX_DISPLAY = 55000
export const MOBILE_MIN_MAX_DISPLAY = 12000
export const MOBILE_MAX_MAX_DISPLAY = 55000
/** 手机 intro 与默认同档（main 手机分支直接用 displayCap） */
export const MOBILE_INTRO_DISPLAY_CAP = 55000

/** 单次视野最多拉/上屏的瓦片数（20° 格；日本+邻海约 9，略留扩边） */
const MAX_TILES_PER_VIEW = 16
/** sticky 可并集膨胀的硬顶（键数）；超出才按 wanted 优先裁 */
const MAX_STICKY_KEYS = MAX_TILES_PER_VIEW * 2

/**
 * @typedef {{ lon:number, lat:number, depthKm:number, mag:number, time?:string, id?:string, place?:string }} Quake
 */

/**
 * @param {Quake[]} quakes
 * @param {import('three').Camera} camera
 * @param {number} [pointDotMin]
 */
export function filterQuakesFacing(quakes, camera, pointDotMin = POINT_DOT_MIN) {
  const cx = camera.position.x
  const cy = camera.position.y
  const cz = camera.position.z
  const clen = Math.hypot(cx, cy, cz) || 1
  const vx = cx / clen
  const vy = cy / clen
  const vz = cz / clen
  const out = []
  for (const q of quakes || []) {
    if (q.lon == null || q.lat == null) continue
    const p = project(q.lon, q.lat, 0, 1)
    const len = Math.hypot(p.x, p.y, p.z) || 1
    const dot = (p.x / len) * vx + (p.y / len) * vy + (p.z / len) * vz
    if (dot >= pointDotMin) out.push(q)
  }
  return out
}

/**
 * @param {Quake[]} quakes
 * @param {{ x:number, y:number, z:number }} focusUnit
 * @param {number} maxCount
 */
export function pickNearestQuakes(quakes, focusUnit, maxCount) {
  if (!quakes?.length) return []
  if (quakes.length <= maxCount) return quakes.slice()

  const fx = focusUnit.x
  const fy = focusUnit.y
  const fz = focusUnit.z
  const n = quakes.length
  const dots = new Float64Array(n)
  const idx = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const q = quakes[i]
    const p = project(q.lon, q.lat, 0, 1)
    const len = Math.hypot(p.x, p.y, p.z) || 1
    dots[i] = (p.x / len) * fx + (p.y / len) * fy + (p.z / len) * fz
    idx[i] = i
  }
  const k = maxCount
  let left = 0
  let right = n - 1
  while (left < right) {
    const pivot = dots[idx[(left + right) >> 1]]
    let i = left
    let j = right
    while (i <= j) {
      while (dots[idx[i]] > pivot) i++
      while (dots[idx[j]] < pivot) j--
      if (i <= j) {
        const t = idx[i]
        idx[i] = idx[j]
        idx[j] = t
        i++
        j--
      }
    }
    if (k - 1 <= j) right = j
    else if (k - 1 >= i) left = i
    else break
  }
  const out = new Array(k)
  for (let i = 0; i < k; i++) out[i] = quakes[idx[i]]
  return out
}

/** @deprecated 用 viewConeRad */
export function viewRadiusRad(camera, focus) {
  return viewConeRad(camera, focus)
}

export class QuakeTileStore {
  constructor() {
    /** @type {object | null} */
    this.manifest = null
    /** @type {Map<string, { nx:number, ny:number, nz:number, hasRecent:boolean, hasArchive:boolean, meta: object }>} */
    this.index = new Map()
    /** @type {Set<string>} */
    this.stickyDisplay = new Set()
    /** @type {Map<string, Quake[]>} */
    this.cache = new Map()
    /** @type {Map<string, Promise<boolean>>} 进行中加载；同 key 复用 Promise */
    this.loading = new Map()
    /** @type {Set<string>} */
    this.wanted = new Set()
    this._lastSyncKey = ''
    this.maxDisplay = DEFAULT_MAX_DISPLAY
  }

  async loadManifest() {
    // 发版后必须拿到新 manifest；瓦片仍可按 TTL 命中
    const man = await cacheFetchJson(MANIFEST_URL, {
      forceNetwork: true,
      maxAgeMs: 0,
    })
    this.manifest = man
    this.index.clear()
    const deg = man.tileDeg || 20
    for (const t of man.tiles || []) {
      const lonC = (t.lon0 ?? -180 + t.ix * deg) + deg / 2
      const latC = (t.lat0 ?? -90 + t.iy * deg) + deg / 2
      const p = project(lonC, latC, 0, 1)
      const len = Math.hypot(p.x, p.y, p.z) || 1
      this.index.set(t.key, {
        nx: p.x / len,
        ny: p.y / len,
        nz: p.z / len,
        hasRecent: !!t.hasRecent,
        hasArchive: !!t.hasArchive,
        meta: t,
      })
    }
    return man
  }

  get recentYear() {
    return this.manifest?.recentYear ?? 2000
  }

  get coverageEnd() {
    return this.manifest?.coverageEnd ?? ''
  }

  /**
   * @param {number} n
   * @param {{ min?: number, max?: number }} [limits]
   *   可选钳位；省略则桌面 MIN/MAX。手机：
   *   setMaxDisplay(cap, { min: MOBILE_MIN_MAX_DISPLAY, max: MOBILE_MAX_MAX_DISPLAY })
   */
  setMaxDisplay(n, limits) {
    const lo = limits?.min ?? MIN_MAX_DISPLAY
    const hi = limits?.max ?? MAX_MAX_DISPLAY
    this.maxDisplay = Math.min(hi, Math.max(lo, Math.round(n)))
  }

  /**
   * @param {number} lon
   * @param {number} lat
   * @param {{ yearMin: number }} filters
   */
  async ensureAround(lon, lat, filters) {
    if (!this.manifest) await this.loadManifest()
    const deg = this.manifest.tileDeg || 20
    const ix0 = Math.floor((lon + 180) / deg)
    const iy0 = Math.floor((lat + 90) / deg)
    const needArchive = filters.yearMin < this.recentYear
    const needRecent =
      filters.yearMax == null || filters.yearMax >= this.recentYear
    const jobs = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${ix0 + dx}_${iy0 + dy}`
        const rec = this.index.get(key)
        if (!rec) continue
        if (needRecent && rec.hasRecent) jobs.push(this._load('r', key))
        if (needArchive && rec.hasArchive) jobs.push(this._load('a', key))
      }
    }
    await Promise.all(jobs)
  }

  /**
   * @param {{ yearMin: number, focusLon?: number, focusLat?: number }} filters
   */
  async ensureBootstrap(filters) {
    if (!this.manifest) await this.loadManifest()
    const fromMan = this.manifest?.japanBootstrapKeys || []
    let keys = fromMan.length ? [...fromMan] : []
    if (!keys.length) {
      const lon = filters.focusLon ?? 138
      const lat = filters.focusLat ?? 37
      const deg = this.manifest.tileDeg || 20
      const ix0 = Math.floor((lon + 180) / deg)
      const iy0 = Math.floor((lat + 90) / deg)
      keys = []
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          keys.push(`${ix0 + dx}_${iy0 + dy}`)
        }
      }
    }
    const needArchive = filters.yearMin < this.recentYear
    const needRecent =
      filters.yearMax == null || filters.yearMax >= this.recentYear
    const jobs = []
    for (const key of keys) {
      const rec = this.index.get(key)
      if (!rec) continue
      if (needRecent && rec.hasRecent) jobs.push(this._load('r', key))
      if (needArchive && rec.hasArchive) jobs.push(this._load('a', key))
    }
    await Promise.all(jobs)
    for (const key of keys) {
      if (needRecent && this.cache.has(`r:${key}`)) this.wanted.add(`r:${key}`)
      if (needArchive && this.cache.has(`a:${key}`)) this.wanted.add(`a:${key}`)
    }
  }

  /**
   * @param {import('three').PerspectiveCamera} camera
   * @param {{ x:number, y:number, z:number }} focus
   * @param {{ yearMin: number, yearMax: number, force?: boolean, spaceLock?: boolean, mobile?: boolean }} filters
   *   mobile=true → 手机视锥参数（现与桌面同 26°）；省略/false 桌面
   */
  async sync(camera, focus, filters) {
    if (!this.manifest) return false
    const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
    const fx = focus.x / fl
    const fy = focus.y / fl
    const fz = focus.z / fl
    const alt = cameraAltitudeKm(camera)
    const cone = viewConeRad(camera, focus, { mobile: !!filters.mobile })
    const needArchive = filters.yearMin < this.recentYear
    // yearMax 完全早于 recent 时不要再拉 r: 瓦片（否则 pick 前 cap 被 2000+ 占满）
    const needRecent =
      filters.yearMax == null || filters.yearMax >= this.recentYear
    // 签名只跟焦点+高度+年份 — 自转绕焦点不改签名，避免狂刷
    const qKey = `${(fx * 36) | 0},${(fy * 36) | 0},${(fz * 36) | 0},${(alt / 400) | 0},${(cone * 200) | 0},${filters.yearMin},${filters.yearMax ?? ''},${needArchive ? 1 : 0},${needRecent ? 1 : 0},${filters.spaceLock ? 1 : 0},${filters.mobile ? 1 : 0}`
    if (!filters.force && qKey === this._lastSyncKey) return false
    this._lastSyncKey = qKey

    const deg = this.manifest.tileDeg || 20
    /** @type {Set<string>} */
    const want = new Set()

    // 太空 / 开场：只保日本 bootstrap，绝不灌全球
    if (filters.spaceLock || alt >= SPACE_ALT_KM) {
      for (const key of this.manifest.japanBootstrapKeys || []) {
        const rec = this.index.get(key)
        if (!rec) continue
        if (needRecent && rec.hasRecent) want.add(`r:${key}`)
        if (needArchive && rec.hasArchive) want.add(`a:${key}`)
      }
      this.wanted = want
      return this._fetchWanted(want)
    }

    // 候选：视锥+地平线，按离焦点近排序，硬顶 MAX_TILES
    /** @type {Array<{ key:string, dot:number }>} */
    const scored = []
    for (const [key, rec] of this.index) {
      const lon0 =
        rec.meta?.lon0 ?? -180 + (Number(key.split('_')[0]) || 0) * deg
      const lat0 =
        rec.meta?.lat0 ?? -90 + (Number(key.split('_')[1]) || 0) * deg
      if (!isTileInView(camera, focus, lon0, lat0, lon0 + deg, lat0 + deg, cone)) {
        continue
      }
      const focusDot = rec.nx * fx + rec.ny * fy + rec.nz * fz
      scored.push({ key, dot: focusDot })
    }
    scored.sort((a, b) => b.dot - a.dot)
    const top = scored.slice(0, MAX_TILES_PER_VIEW)
    for (const { key } of top) {
      const rec = this.index.get(key)
      if (!rec) continue
      if (needRecent && rec.hasRecent) want.add(`r:${key}`)
      if (needArchive && rec.hasArchive) want.add(`a:${key}`)
    }

    // 日本 bootstrap 始终并入 wanted（仅 4 格）：HOME/近日本时不会因锥边评分被挤掉
    // 导致首屏缺瓦片；看别处时 getDisplayQuakes 仍按焦点锥裁点，不会整球灌 GPU
    for (const key of this.manifest.japanBootstrapKeys || []) {
      const rec = this.index.get(key)
      if (!rec) continue
      if (needRecent && rec.hasRecent) want.add(`r:${key}`)
      if (needArchive && rec.hasArchive) want.add(`a:${key}`)
    }

    this.wanted = want
    return this._fetchWanted(want)
  }

  /**
   * @param {Set<string>} want
   */
  async _fetchWanted(want) {
    let fetched = false
    const jobs = []
    for (const ck of want) {
      if (this.cache.has(ck)) continue
      // 已在飞：并入 wait，避免「跳过」后 expand 丢点
      if (this.loading.has(ck)) {
        jobs.push(
          this.loading.get(ck).then((ok) => {
            if (ok) fetched = true
          }),
        )
        continue
      }
      const [kind, key] = ck.split(':')
      jobs.push(
        this._load(kind, key).then((ok) => {
          if (ok) fetched = true
        }),
      )
    }
    if (jobs.length) await Promise.all(jobs)
    return fetched
  }

  /**
   * sticky 并集膨胀：wanted∩cache 并入，保留已上屏瓦片。
   * 旧「= wanted∩cache 可缩」会在拖图换 wanted 时甩掉日本格 → 点消失再一点点回来。
   * 超 MAX_STICKY_KEYS 时优先保 wanted + 日本 bootstrap，再裁其余。
   * @returns {number} 变化则 1
   */
  expandStickyFromWanted() {
    /** @type {Set<string>} */
    const next = new Set()
    // 先保留仍在 cache 的旧 sticky（不主动扔已画过的日本格）
    for (const ck of this.stickyDisplay) {
      if (this.cache.has(ck)) next.add(ck)
    }
    for (const ck of this.wanted) {
      if (this.cache.has(ck)) next.add(ck)
    }
    if (next.size === 0 && this.cache.size > 0 && this.wanted.size === 0) {
      for (const ck of this.cache.keys()) next.add(ck)
    }

    // 日本 bootstrap 已缓存的永远留在 sticky
    for (const key of this.manifest?.japanBootstrapKeys || []) {
      if (this.cache.has(`r:${key}`)) next.add(`r:${key}`)
      if (this.cache.has(`a:${key}`)) next.add(`a:${key}`)
    }

    if (next.size > MAX_STICKY_KEYS) {
      const pruned = new Set()
      for (const ck of this.wanted) {
        if (next.has(ck)) pruned.add(ck)
      }
      for (const key of this.manifest?.japanBootstrapKeys || []) {
        if (next.has(`r:${key}`)) pruned.add(`r:${key}`)
        if (next.has(`a:${key}`)) pruned.add(`a:${key}`)
      }
      for (const ck of next) {
        if (pruned.size >= MAX_STICKY_KEYS) break
        pruned.add(ck)
      }
      next.clear()
      for (const ck of pruned) next.add(ck)
    }

    let changed = next.size !== this.stickyDisplay.size
    if (!changed) {
      for (const k of next) {
        if (!this.stickyDisplay.has(k)) {
          changed = true
          break
        }
      }
    }
    if (!changed) {
      for (const k of this.stickyDisplay) {
        if (!next.has(k)) {
          changed = true
          break
        }
      }
    }
    this.stickyDisplay = next
    return changed ? 1 : 0
  }

  clearSticky() {
    this.stickyDisplay.clear()
  }

  stickySig() {
    if (!this.stickyDisplay.size) return ''
    return [...this.stickyDisplay].sort().join(',')
  }

  /**
   * @param {import('three').Camera} camera
   * @param {{ x:number, y:number, z:number }} focus
   * @param {number} [maxDisplay]
   * @param {{ mobile?: boolean, yearMin?: number, yearMax?: number }} [opts]
   *   mobile=true → 手机视锥；yearMin/yearMax 在 pick 前过滤，避免 cap 被窗外年点占满
   */
  getDisplayQuakes(camera, focus, maxDisplay = this.maxDisplay, opts = {}) {
    const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
    const focusUnit = { x: focus.x / fl, y: focus.y / fl, z: focus.z / fl }

    let keys = this.stickyDisplay
    if (!keys.size) keys = this.wanted
    if (!keys.size) keys = new Set(this.cache.keys())

    const yMin = opts.yearMin
    const yMax = opts.yearMax
    const filterYear =
      yMin != null && yMax != null && Number.isFinite(yMin) && Number.isFinite(yMax)

    /** @type {Quake[]} */
    const raw = []
    for (const ck of keys) {
      const arr = this.cache.get(ck)
      if (!arr) continue
      for (const q of arr) {
        if (filterYear) {
          const t = typeof q.time === 'string' ? q.time : ''
          if (t.length >= 4) {
            const y = Number(t.slice(0, 4))
            if (Number.isFinite(y) && (y < yMin || y > yMax)) continue
          }
        }
        raw.push(q)
      }
    }

    // 上屏集合只跟「焦点锥 + sticky」，不跟相机方位（自转不改点表）
    // 背面遮挡交给球壳 depth；再按 limb 滤会让同一 sticky 在自转时子集抖 → rebuild 全场闪
    const inView = filterQuakesInView(raw, camera, focus, {
      skipLimb: true,
      mobile: !!opts.mobile,
    })
    // 远眺再砍 cap，避免一次 InstancedMesh 炸主线程（近地用满 maxDisplay）
    // 手机 cap 已按日本全锥标定到 ~55k；远眺地板同步抬高，避免 HOME 刚落稳又被砍回 35k
    const alt = cameraAltitudeKm(camera)
    let cap = maxDisplay
    if (alt >= SPACE_ALT_KM) cap = Math.min(cap, 12000)
    else if (alt > 5000) {
      const highAltFloor = opts.mobile ? MOBILE_MAX_MAX_DISPLAY : 35000
      cap = Math.min(cap, highAltFloor)
    }
    return pickNearestQuakes(inView, focusUnit, cap)
  }

  getQuakes() {
    const out = []
    for (const arr of this.cache.values()) {
      for (const q of arr) out.push(q)
    }
    return out
  }

  getQuakesFacing(camera) {
    return filterQuakesFacing(this.getQuakes(), camera)
  }

  stats(camera, focus) {
    let n = 0
    for (const arr of this.cache.values()) n += arr.length
    const display =
      camera && focus ? this.getDisplayQuakes(camera, focus).length : 0
    return {
      tilesInMem: this.cache.size,
      quakesInMem: n,
      tilesWanted: this.wanted.size,
      display,
      maxDisplay: this.maxDisplay,
      coverageEnd: this.coverageEnd,
      cacheMem: cacheMemStats(),
    }
  }

  /**
   * @param {'r'|'a'} kind
   * @param {string} tileKey
   */
  async _load(kind, tileKey) {
    const ck = `${kind}:${tileKey}`
    if (this.cache.has(ck)) return false
    // 进行中：等同一 Promise，禁止「已 loading 立刻 false」导致 ensureAround 空等
    if (this.loading.has(ck)) {
      try {
        await this.loading.get(ck)
      } catch {
        /* 首发已 warn */
      }
      return this.cache.has(ck)
    }
    const rec = this.index.get(tileKey)
    if (!rec) return false
    if (kind === 'r' && !rec.hasRecent) return false
    if (kind === 'a' && !rec.hasArchive) return false

    const job = (async () => {
      try {
        const url = `${TILE_URL_PREFIX}${kind}_${tileKey}.json`
        const arr = await cacheFetchJson(url)
        if (!Array.isArray(arr)) return false
        this.cache.set(ck, arr)
        return true
      } catch (e) {
        console.warn('quake tile load failed', ck, e)
        return false
      } finally {
        this.loading.delete(ck)
      }
    })()
    this.loading.set(ck, job)
    return job
  }
}
