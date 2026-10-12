/**
 * 全球 USGS 震源 → 地理瓦片（历史全量在服务器，浏览器按可见区懒加载）
 *
 * 规格：
 *   M ≥ 4.0 · 1970-01-01 → 今 · **全球**（无 bbox）
 *   字段与旧东亚包一致
 *
 * 输出：
 *   public/data/quakes/manifest.json
 *   public/data/quakes/tiles/r_{ix}_{iy}.json  — 年 ≥ 2000（默认进站只拉这类）
 *   public/data/quakes/tiles/a_{ix}_{iy}.json  — 1970–1999（年份滑条拖回才拉）
 *
 * 单次 USGS 上限 ~20k → 按年；忙年按月；仍顶满则半月切。
 *
 * 用法：
 *   node scripts/fetch-data.mjs              # 全量重建瓦片
 *   node scripts/fetch-data.mjs --full       # 同上
 *   node scripts/fetch-data.mjs --since=2026-07-01   # 增量合并（周更预留）
 *
 * GitHub Actions 周更：见 .github/workflows/quakes-weekly.yml
 */
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'data', 'quakes')
const TILE_DIR = join(OUT_DIR, 'tiles')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')
/** 兼容旧路径：写一份「日本框 + 默认年」小索引，方便回落/体检 */
const LEGACY_JAPAN_PATH = join(ROOT, 'public', 'data', 'quakes.json')

const MIN_MAG = 4.0
const START_YEAR = 1970
const END_YEAR = new Date().getUTCFullYear()
/** 默认进站只显示/优先加载此年及以后；更早进 archive 瓦片 */
const RECENT_YEAR = 2000
const TILE_DEG = 20
const LIMIT = 20000
/** 单窗超过此数改更细切分 */
const SAFE_CAP = 18000
const ORDERBY = 'time-asc'
const PAUSE_MS = 250

/** 日本默认可见区（进站必载瓦片覆盖） */
const JAPAN_BOOT = {
  minLon: 128,
  maxLon: 146,
  minLat: 24,
  maxLat: 46,
}

const SAMPLE = [
  {
    lon: 142.37,
    lat: 38.3,
    depthKm: 24,
    mag: 9.1,
    time: '2011-03-11T05:46:24.000Z',
    place: '2011 Great Tohoku Earthquake',
  },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs(argv) {
  let since = null
  let full = true
  for (const a of argv) {
    if (a === '--full') full = true
    if (a.startsWith('--since=')) {
      since = a.slice('--since='.length)
      full = false
    }
  }
  return { since, full }
}

function tileIndex(lon, lat) {
  let L = lon
  if (L >= 180) L = 179.999
  if (L < -180) L = -180
  let B = lat
  if (B > 90) B = 90
  if (B < -90) B = -90
  const ix = Math.floor((L + 180) / TILE_DEG)
  const iy = Math.floor((B + 90) / TILE_DEG)
  return { ix, iy, key: `${ix}_${iy}` }
}

function yearOfIso(iso) {
  if (!iso) return null
  const y = Number(String(iso).slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function simplifyFeature(f) {
  const [lon, lat, depth] = f.geometry?.coordinates ?? [0, 0, 0]
  const p = f.properties ?? {}
  return {
    id: f.id ?? p.code ?? null,
    lon,
    lat,
    depthKm: typeof depth === 'number' ? depth : Number(depth) || 0,
    mag: p.mag ?? null,
    time: p.time ? new Date(p.time).toISOString() : null,
    place: p.place ?? '',
  }
}

function buildQuery(params) {
  const q = new URLSearchParams({
    format: 'geojson',
    minmagnitude: String(MIN_MAG),
    limit: String(LIMIT),
    orderby: ORDERBY,
    ...params,
  })
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`
}

function buildCount(params) {
  const q = new URLSearchParams({
    format: 'geojson',
    minmagnitude: String(MIN_MAG),
    ...params,
  })
  return `https://earthquake.usgs.gov/fdsnws/event/1/count?${q}`
}

async function usgsCount(params) {
  const url = buildCount(params)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`USGS count HTTP ${res.status}`)
  const j = await res.json()
  return typeof j?.count === 'number' ? j.count : Number(j) || 0
}

async function usgsQuery(params) {
  const url = buildQuery(params)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok) throw new Error(`USGS query HTTP ${res.status}`)
  const geo = await res.json()
  const feats = Array.isArray(geo?.features) ? geo.features : []
  if (feats.length >= LIMIT) {
    console.warn(
      `  ⚠ hit limit ${LIMIT} for ${params.starttime}..${params.endtime}`,
    )
  }
  return feats.map(simplifyFeature)
}

/**
 * 递归按时间窗拉取，保证不超过 SAFE_CAP
 * @param {string} start ISO date YYYY-MM-DD
 * @param {string} end exclusive YYYY-MM-DD
 */
async function fetchWindow(start, end, depth = 0) {
  const params = { starttime: start, endtime: end }
  let count
  try {
    count = await usgsCount(params)
  } catch (e) {
    console.warn(`  count fail ${start}..${end}: ${e.message}, try query`)
    count = SAFE_CAP + 1
  }
  await sleep(PAUSE_MS)

  if (count === 0) return []
  if (count <= SAFE_CAP || depth >= 6) {
    const batch = await usgsQuery(params)
    await sleep(PAUSE_MS)
    return batch
  }

  // 对半切时间
  const t0 = Date.parse(`${start}T00:00:00Z`)
  const t1 = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 - t0 < 2 * 86400000) {
    // 已细到天仍过多：用 offset 分页
    return fetchPaged(params)
  }
  const mid = new Date((t0 + t1) / 2)
  const midStr = mid.toISOString().slice(0, 10)
  if (midStr <= start || midStr >= end) {
    return fetchPaged(params)
  }
  const a = await fetchWindow(start, midStr, depth + 1)
  const b = await fetchWindow(midStr, end, depth + 1)
  return a.concat(b)
}

async function fetchPaged(params) {
  const all = []
  let offset = 1
  for (;;) {
    const batch = await usgsQuery({
      ...params,
      limit: String(LIMIT),
      offset: String(offset),
    })
    all.push(...batch)
    await sleep(PAUSE_MS)
    if (batch.length < LIMIT) break
    offset += LIMIT
    if (offset > 200000) {
      console.warn('  ⚠ offset safety stop')
      break
    }
  }
  return all
}

async function fetchRangeByYears(startYear, endYear) {
  const byId = new Map()
  let totalRaw = 0
  for (let y = startYear; y <= endYear; y++) {
    const start = `${y}-01-01`
    const end = y === endYear
      ? new Date().toISOString().slice(0, 10)
      : `${y + 1}-01-01`
    // end exclusive for windows; if today, use tomorrow for exclusivity
    let endEx = end
    if (y === endYear) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + 1)
      endEx = d.toISOString().slice(0, 10)
    }
    process.stdout.write(`  ${y}… `)
    const batch = await fetchWindow(start, endEx)
    totalRaw += batch.length
    for (const q of batch) {
      const key = q.id || `${q.time}|${q.lon}|${q.lat}|${q.depthKm}|${q.mag}`
      byId.set(key, q)
    }
    console.log(`${batch.length}`)
  }
  return { byId, totalRaw }
}

function loadExistingTiles() {
  const byId = new Map()
  if (!existsSync(MANIFEST_PATH)) return byId
  let man
  try {
    man = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  } catch {
    return byId
  }
  for (const t of man.tiles || []) {
    for (const kind of ['r', 'a']) {
      const path = join(TILE_DIR, `${kind}_${t.key}.json`)
      if (!existsSync(path)) continue
      try {
        const arr = JSON.parse(readFileSync(path, 'utf8'))
        for (const q of arr) {
          const key =
            q.id || `${q.time}|${q.lon}|${q.lat}|${q.depthKm}|${q.mag}`
          byId.set(key, q)
        }
      } catch {
        /* skip broken tile */
      }
    }
  }
  console.log(`  loaded existing unique=${byId.size}`)
  return byId
}

function bucketTiles(quakes) {
  /** @type {Map<string, { recent: object[], archive: object[] }>} */
  const tiles = new Map()
  for (const q of quakes) {
    if (q.lon == null || q.lat == null) continue
    const { key } = tileIndex(q.lon, q.lat)
    let b = tiles.get(key)
    if (!b) {
      b = { recent: [], archive: [] }
      tiles.set(key, b)
    }
    const y = yearOfIso(q.time)
    if (y != null && y < RECENT_YEAR) b.archive.push(q)
    else b.recent.push(q)
  }
  return tiles
}

function japanBootstrapKeys() {
  const keys = new Set()
  for (let lon = JAPAN_BOOT.minLon; lon <= JAPAN_BOOT.maxLon; lon += TILE_DEG / 2) {
    for (let lat = JAPAN_BOOT.minLat; lat <= JAPAN_BOOT.maxLat; lat += TILE_DEG / 2) {
      keys.add(tileIndex(lon, lat).key)
    }
  }
  // corners
  for (const [lon, lat] of [
    [JAPAN_BOOT.minLon, JAPAN_BOOT.minLat],
    [JAPAN_BOOT.minLon, JAPAN_BOOT.maxLat],
    [JAPAN_BOOT.maxLon, JAPAN_BOOT.minLat],
    [JAPAN_BOOT.maxLon, JAPAN_BOOT.maxLat],
  ]) {
    keys.add(tileIndex(lon, lat).key)
  }
  return [...keys]
}

function writeTiles(tiles) {
  if (existsSync(TILE_DIR)) {
    rmSync(TILE_DIR, { recursive: true, force: true })
  }
  mkdirSync(TILE_DIR, { recursive: true })

  const tileMeta = []
  let recentTotal = 0
  let archiveTotal = 0

  for (const [key, b] of [...tiles.entries()].sort((a, c) =>
    a[0].localeCompare(c[0]),
  )) {
    const [ixS, iyS] = key.split('_')
    const ix = Number(ixS)
    const iy = Number(iyS)
    const sortFn = (a, c) => String(a.time).localeCompare(String(c.time))
    b.recent.sort(sortFn)
    b.archive.sort(sortFn)

    if (b.recent.length) {
      writeFileSync(
        join(TILE_DIR, `r_${key}.json`),
        JSON.stringify(b.recent),
        'utf8',
      )
      recentTotal += b.recent.length
    }
    if (b.archive.length) {
      writeFileSync(
        join(TILE_DIR, `a_${key}.json`),
        JSON.stringify(b.archive),
        'utf8',
      )
      archiveTotal += b.archive.length
    }
    if (!b.recent.length && !b.archive.length) continue

    tileMeta.push({
      key,
      ix,
      iy,
      lon0: -180 + ix * TILE_DEG,
      lat0: -90 + iy * TILE_DEG,
      recentCount: b.recent.length,
      archiveCount: b.archive.length,
      hasRecent: b.recent.length > 0,
      hasArchive: b.archive.length > 0,
    })
  }

  const coverageEnd = new Date().toISOString()
  const manifest = {
    version: 2,
    schema: 'geo-tiles-recent-archive',
    fetchedAt: coverageEnd,
    coverageStart: `${START_YEAR}-01-01`,
    coverageEnd: coverageEnd.slice(0, 10),
    minMag: MIN_MAG,
    tileDeg: TILE_DEG,
    recentYear: RECENT_YEAR,
    defaultYearMin: RECENT_YEAR,
    yearMin: START_YEAR,
    yearMax: END_YEAR,
    totals: {
      recent: recentTotal,
      archive: archiveTotal,
      all: recentTotal + archiveTotal,
      tiles: tileMeta.length,
    },
    japanBootstrapKeys: japanBootstrapKeys(),
    tiles: tileMeta,
    update: {
      full: 'npm run fetch-data',
      weeklyIncremental: 'npm run fetch-data -- --since=YYYY-MM-DD',
      githubActions: '.github/workflows/quakes-weekly.yml',
    },
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')

  // 兼容：日本框 + 2000+ 小包（旧单文件路径，便于体检/回落）
  const jBoot = japanBootstrapKeys()
  const legacy = []
  for (const key of jBoot) {
    const b = tiles.get(key)
    if (!b) continue
    for (const q of b.recent) {
      if (
        q.lon >= 105 &&
        q.lon <= 150 &&
        q.lat >= 20 &&
        q.lat <= 50
      ) {
        legacy.push(q)
      }
    }
  }
  legacy.sort((a, c) => String(a.time).localeCompare(String(c.time)))
  writeFileSync(LEGACY_JAPAN_PATH, JSON.stringify(legacy), 'utf8')

  return { manifest, legacyCount: legacy.length }
}

async function main() {
  const { since, full } = parseArgs(process.argv.slice(2))
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(
    `USGS global M≥${MIN_MAG} · tiles ${TILE_DEG}° · recent≥${RECENT_YEAR} · mode=${full ? 'full' : `since ${since}`}`,
  )

  let byId
  let totalRaw = 0
  let source = 'usgs'

  try {
    if (full) {
      const r = await fetchRangeByYears(START_YEAR, END_YEAR)
      byId = r.byId
      totalRaw = r.totalRaw
    } else {
      byId = loadExistingTiles()
      if (!since) throw new Error('--since=YYYY-MM-DD required for incremental')
      const endEx = new Date()
      endEx.setUTCDate(endEx.getUTCDate() + 1)
      const endStr = endEx.toISOString().slice(0, 10)
      console.log(`  incremental ${since} → ${endStr}`)
      const batch = await fetchWindow(since, endStr)
      totalRaw = batch.length
      for (const q of batch) {
        const key = q.id || `${q.time}|${q.lon}|${q.lat}|${q.depthKm}|${q.mag}`
        byId.set(key, q)
      }
      console.log(`  incremental rows=${batch.length} unique now=${byId.size}`)
    }
  } catch (err) {
    console.warn('USGS fetch failed:', err.message)
    if (byId && byId.size) {
      source = 'partial-existing'
    } else {
      console.warn('Writing sample fallback tiles')
      byId = new Map(SAMPLE.map((q) => [q.id || q.time, q]))
      source = 'sample-fallback'
    }
  }

  const quakes = [...byId.values()]
  console.log(`Bucketing ${quakes.length} quakes into ${TILE_DEG}° tiles…`)
  const tiles = bucketTiles(quakes)
  const { manifest, legacyCount } = writeTiles(tiles)

  const mb = (n) => (n / 1024 / 1024).toFixed(2)
  let tileBytes = 0
  for (const t of manifest.tiles) {
    for (const kind of ['r', 'a']) {
      const p = join(TILE_DIR, `${kind}_${t.key}.json`)
      if (existsSync(p)) tileBytes += readFileSync(p).byteLength
    }
  }

  console.log(
    JSON.stringify(
      {
        source,
        rawFetched: totalRaw,
        unique: quakes.length,
        tiles: manifest.totals.tiles,
        recent: manifest.totals.recent,
        archive: manifest.totals.archive,
        tileBytesMB: mb(tileBytes),
        legacyJapanRecent: legacyCount,
        manifest: MANIFEST_PATH,
        coverageEnd: manifest.coverageEnd,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
