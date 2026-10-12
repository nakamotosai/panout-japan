/**
 * 近 30 天 USGS 公开目录（浏览器直连 FDSN）
 * 字段与历史瓦片对齐；**全球** M≥minMag；非预警 / 非推送。
 */

export const LIVE_WINDOW_DAYS = 30
export const LIVE_POLL_MS = 5 * 60 * 1000
export const LIVE_MIN_MAG_DEFAULT = 4.0

/**
 * @param {number} [minMag=4]
 * @param {number} [days=30]
 */
export function buildLiveQueryUrl(minMag = LIVE_MIN_MAG_DEFAULT, days = LIVE_WINDOW_DAYS) {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const starttime = start.toISOString().slice(0, 19)
  const q = new URLSearchParams({
    format: 'geojson',
    starttime,
    minmagnitude: String(minMag),
    orderby: 'time',
    // 全球近 30 天 M≥4 通常数千级；留足上限
    limit: '20000',
  })
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`
}

/**
 * USGS GeoJSON feature → 本地震源记录
 * @param {object} f
 */
export function simplifyUsgsFeature(f) {
  const [lon, lat, depth] = f.geometry?.coordinates ?? [0, 0, 0]
  const p = f.properties ?? {}
  const timeMs = typeof p.time === 'number' ? p.time : null
  return {
    id: f.id ?? p.code ?? null,
    lon,
    lat,
    depthKm: typeof depth === 'number' ? depth : Number(depth) || 0,
    mag: p.mag ?? null,
    time: timeMs != null ? new Date(timeMs).toISOString() : null,
    place: p.place ?? '',
  }
}

/**
 * @param {object} geo
 * @returns {Array<object>}
 */
export function featuresFromGeojson(geo) {
  const feats = Array.isArray(geo?.features) ? geo.features : []
  return feats.map(simplifyUsgsFeature)
}

/**
 * @param {{ minMag?: number, days?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ quakes: object[], fetchedAt: number, url: string }>}
 */
export async function fetchLiveQuakes(opts = {}) {
  const minMag = opts.minMag ?? LIVE_MIN_MAG_DEFAULT
  const days = opts.days ?? LIVE_WINDOW_DAYS
  const url = buildLiveQueryUrl(minMag, days)
  // AbortSignal.timeout 在旧 Safari 不存在；有外部 signal 时优先用它
  let signal = opts.signal
  if (!signal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      signal = AbortSignal.timeout(60_000)
    } else {
      const ac = new AbortController()
      setTimeout(() => {
        try {
          ac.abort()
        } catch {
          /* ignore */
        }
      }, 60_000)
      signal = ac.signal
    }
  }
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`)
  const geo = await res.json()
  return {
    quakes: featuresFromGeojson(geo),
    fetchedAt: Date.now(),
    url,
  }
}

/**
 * 从已加载历史包中滤近 N 天（离线兜底）
 * @param {Array<{ time?: string }>} quakes
 * @param {number} [days=30]
 */
export function filterQuakesByLastDays(quakes, days = LIVE_WINDOW_DAYS) {
  const cut = Date.now() - days * 24 * 60 * 60 * 1000
  return (quakes || []).filter((q) => {
    if (!q?.time) return false
    const t = Date.parse(q.time)
    return Number.isFinite(t) && t >= cut
  })
}

/**
 * 轮询：可见页才跑；返回 stop()
 * @param {{
 *   minMag?: number,
 *   intervalMs?: number,
 *   onData: (r: { quakes: object[], fetchedAt: number, source: 'live' }) => void,
 *   onError: (err: Error) => void,
 * }} opts
 */
export function startLivePoll(opts) {
  const intervalMs = opts.intervalMs ?? LIVE_POLL_MS
  let stopped = false
  /** 每次 tick 递增；被后继 tick 取代时旧代不再 schedule（防双轮询） */
  let gen = 0
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  /** @type {AbortController | null} */
  let ac = null

  const clearTimer = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (ms) => {
    clearTimer()
    if (stopped) return
    timer = setTimeout(() => {
      void tick()
    }, ms)
  }

  const tick = async () => {
    if (stopped) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      schedule(intervalMs)
      return
    }
    const myGen = ++gen
    if (ac) ac.abort()
    ac = new AbortController()
    const myAc = ac
    // 硬超时：挂死请求也要续轮询（AbortError 过去直接 return 会停表）
    const timeoutId = setTimeout(() => {
      try {
        myAc.abort()
      } catch {
        /* ignore */
      }
    }, 60_000)
    try {
      const r = await fetchLiveQuakes({
        minMag: opts.minMag,
        signal: myAc.signal,
      })
      if (stopped || myGen !== gen) return
      opts.onData({
        quakes: r.quakes,
        fetchedAt: r.fetchedAt,
        source: 'live',
      })
    } catch (e) {
      if (stopped || myGen !== gen) return
      if (e?.name !== 'AbortError') {
        opts.onError(e instanceof Error ? e : new Error(String(e)))
      }
      // 超时 AbortError：仍续轮询（myGen===gen）
    } finally {
      clearTimeout(timeoutId)
    }
    if (!stopped && myGen === gen) schedule(intervalMs)
  }

  const onVis = () => {
    if (stopped) return
    if (document.visibilityState === 'visible') {
      // 回到前台立刻刷一次
      void tick()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVis)
  }

  // 立即第一枪
  void tick()

  return () => {
    stopped = true
    gen += 1
    clearTimer()
    if (ac) ac.abort()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVis)
    }
  }
}
