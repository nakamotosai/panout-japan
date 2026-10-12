/**
 * 震源瓦片持久缓存（PWA 按需加载预留）
 *
 * 优先级：内存 Map → IndexedDB → 网络
 * 一旦进过内存/IDB，同 URL 不再打网（除非 forceNetwork）
 */
const DB_NAME = 'japan-3d-eq-tiles'
const DB_VER = 1
const STORE = 'tiles'

/** @type {Map<string, any>} */
const mem = new Map()
/** @type {Map<string, { savedAt: number }>} */
const memMeta = new Map()

/** 默认瓦片/数据缓存最长寿命；manifest 另用更短/强制刷新 */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.reject(new Error('no idb'))
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onerror = () => reject(req.error || new Error('idb open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

/**
 * @param {string} url
 * @returns {Promise<{ data: any, savedAt: number } | null>}
 */
async function cacheGetMeta(url) {
  if (mem.has(url)) {
    const m = memMeta.get(url)
    return {
      data: mem.get(url),
      savedAt: m?.savedAt ?? Date.now(),
    }
  }
  try {
    const db = await openDb()
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(url)
      r.onsuccess = () => resolve(r.result || null)
      r.onerror = () => reject(r.error)
    })
    if (row?.data != null) {
      mem.set(url, row.data)
      memMeta.set(url, { savedAt: row.savedAt || 0 })
      return { data: row.data, savedAt: row.savedAt || 0 }
    }
  } catch {
    /* idb 不可用则只走内存 */
  }
  return null
}

/**
 * @param {string} url
 * @returns {Promise<any | null>}
 */
export async function cacheGet(url) {
  const hit = await cacheGetMeta(url)
  return hit ? hit.data : null
}

/**
 * @param {string} url
 * @param {any} data
 */
export async function cacheSet(url, data) {
  const savedAt = Date.now()
  mem.set(url, data)
  memMeta.set(url, { savedAt })
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        url,
        data,
        savedAt,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* 内存已有即可 */
  }
}

/**
 * 内存是否已有（不读盘）
 * @param {string} url
 */
export function cacheHasMem(url) {
  return mem.has(url)
}

/**
 * AbortSignal.timeout 兼容垫片（Safari <16.4 无原生 API，裸调会直接 TypeError 整站挂）
 * @param {number} ms
 * @returns {AbortSignal}
 */
export function abortTimeout(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const ac = new AbortController()
  const t = setTimeout(() => {
    try {
      ac.abort(new DOMException('TimeoutError', 'TimeoutError'))
    } catch {
      ac.abort()
    }
  }, ms)
  // 若已 aborted 清定时器（部分环境 signal 无 addEventListener 则忽略）
  try {
    ac.signal.addEventListener?.(
      'abort',
      () => clearTimeout(t),
      { once: true },
    )
  } catch {
    /* ignore */
  }
  return ac.signal
}

/**
 * @param {string} url
 * @param {{ forceNetwork?: boolean, signal?: AbortSignal, maxAgeMs?: number }} [opts]
 * @returns {Promise<any>}
 */
export async function cacheFetchJson(url, opts = {}) {
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  if (!opts.forceNetwork) {
    const hit = await cacheGetMeta(url)
    if (hit != null && hit.data != null) {
      const age = Date.now() - (hit.savedAt || 0)
      if (age >= 0 && age < maxAge) return hit.data
      // 过期：继续打网；失败时仍回落旧缓存
    }
  }
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: opts.signal ?? abortTimeout(120_000),
      cache: opts.forceNetwork ? 'no-cache' : 'default',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    const data = await res.json()
    // 不缓存明显坏载荷，避免一次 HTML/空对象毒死 IDB
    if (data == null || (typeof data !== 'object' && !Array.isArray(data))) {
      throw new Error(`invalid JSON payload ${url}`)
    }
    await cacheSet(url, data)
    return data
  } catch (e) {
    if (!opts.forceNetwork) {
      const stale = await cacheGetMeta(url)
      if (stale?.data != null) return stale.data
    }
    throw e
  }
}

/** 调试 */
export function cacheMemStats() {
  return { entries: mem.size }
}
