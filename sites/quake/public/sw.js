/* japan-3d-earthquake PWA · on-demand cache
 * 壳层预缓存；瓦片/数据按需进 cache（不预拉全库）
 */
const SW_VER = 'eq-pwa-v1-20260716'
const SHELL = 'eq-shell-' + SW_VER
const RUNTIME = 'eq-runtime-' + SW_VER

const SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/**
 * @param {Request} request
 * @param {string} cacheName
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {})
    }
    return res
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

/**
 * @param {Request} request
 * @param {string} cacheName
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) {
    cache.put(request, res.clone()).catch(() => {})
  }
  return res
}

/**
 * 按需：网络优先，成功后写入 runtime；失败回落缓存
 * @param {Request} request
 */
async function onDemand(request) {
  return networkFirst(request, RUNTIME)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 导航：网络优先，离线回 index
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(async () => {
          const cache = await caches.open(SHELL)
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response('离线不可用', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
          )
        }),
    )
    return
  }

  const path = url.pathname

  // 壳层静态
  if (
    path === '/favicon.svg' ||
    path === '/manifest.webmanifest' ||
    path.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(req, SHELL))
    return
  }

  // Vite 产物（带 hash）→ cache-first
  if (path.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, RUNTIME))
    return
  }

  // 地震瓦片 / 岸线 / 清单 → 按需缓存（不预拉）
  if (path.startsWith('/data/')) {
    event.respondWith(onDemand(req))
    return
  }

  // 其余同源 GET：网络优先
  event.respondWith(onDemand(req))
})
