/**
 * 球体可见性（对齐 Cesium 思路的精简版）
 *
 * 1. **地平线 / 背面**：地表法线·相机径向 < limb → 被地球本体挡住，永不加载
 * 2. **焦点视锥**：只认 look-at 周围一圈（角半径随相机高度变，**上限约 26°**）
 *    — 远眺时也不能变成「整颗地球前半球」（那是上次卡死根因）
 * 3. 浏览器 NDC 仅作辅助软边，不作主判据
 *
 * 参考：Cesium horizon culling + 高度相关 LOD；three.js 球面点 n·v 背面剔除
 */
import { project, EARTH_RADIUS_KM } from './coords.js'

/** 焦点视锥：再近也至少盖住列岛主体 */
export const CONE_MIN_RAD = (12 * Math.PI) / 180
/** 焦点视锥硬顶：禁止远眺时吸半个亚洲 */
export const CONE_MAX_RAD = (26 * Math.PI) / 180
/**
 * 手机焦点视锥硬顶：与桌面同 26°。
 * 曾用 18°（M7）省点数，但日本 HOME 整列岛入画时屏内西侧/南侧被裁，
 * 拖图才换焦点 → 用户看到「一点点冒点」。全列岛一次入锥优先。
 */
export const MOBILE_CONE_MAX_RAD = (26 * Math.PI) / 180
/** 桌面 half 系数（地面半宽 → 角半径） */
export const CONE_HALF_FACTOR = 1.05
/** 手机 half 与桌面一致，避免屏边点被半宽系数再砍一刀 */
export const MOBILE_CONE_HALF_FACTOR = 1.05
/** 相机离地表超过此高度 → 太空模式，只保 bootstrap / 极窄锥 */
export const SPACE_ALT_KM = 9000

/**
 * @param {import('three').Camera} camera
 */
export function camRadial(camera) {
  const x = camera.position.x
  const y = camera.position.y
  const z = camera.position.z
  const len = Math.hypot(x, y, z) || 1
  return { x: x / len, y: y / len, z: z / len, len }
}

/**
 * 相机离地表高度（km）
 * @param {import('three').Camera} camera
 */
export function cameraAltitudeKm(camera) {
  const len = Math.hypot(
    camera.position.x,
    camera.position.y,
    camera.position.z,
  )
  return Math.max(50, len - EARTH_RADIUS_KM)
}

/**
 * 地平线阈值：球体上 n·camDir 小于此 ≈ 在肢缘/背面，被地球挡住
 * 近地时 ~0.85+（只见一小帽）；远地时降低但仍 ≥0.2
 * @param {import('three').Camera} camera
 */
export function limbDotMin(camera) {
  const d = Math.hypot(
    camera.position.x,
    camera.position.y,
    camera.position.z,
  )
  // 几何肢缘：R/|cam|；再抬一点安全余量
  const limb = EARTH_RADIUS_KM / Math.max(d, EARTH_RADIUS_KM + 1)
  return Math.min(0.92, Math.max(0.22, limb * 0.97))
}

/**
 * look-at 周围加载角半径（随高度，有硬顶）
 * @param {import('three').PerspectiveCamera} camera
 * @param {{ x:number, y:number, z:number }} focus 地表点
 * @param {{ mobile?: boolean, coneMaxRad?: number, halfFactor?: number }} [opts]
 *   mobile=true → 与桌面同 26°/1.05（日本全屏一次入锥）；可 coneMaxRad/halfFactor 覆盖
 */
export function viewConeRad(camera, focus, opts = {}) {
  const alt = cameraAltitudeKm(camera)
  // 太空：只允许极窄（实际 sync 会直接走 bootstrap）
  if (alt >= SPACE_ALT_KM) return CONE_MIN_RAD

  const fx = focus.x
  const fy = focus.y
  const fz = focus.z
  const dist = Math.hypot(
    camera.position.x - fx,
    camera.position.y - fy,
    camera.position.z - fz,
  )
  const fov = ((camera.fov ?? 50) * Math.PI) / 180
  const mobile = !!opts.mobile
  const halfFactor =
    opts.halfFactor ?? (mobile ? MOBILE_CONE_HALF_FACTOR : CONE_HALF_FACTOR)
  const coneMax =
    opts.coneMaxRad ?? (mobile ? MOBILE_CONE_MAX_RAD : CONE_MAX_RAD)
  // 地面半宽 → 角半径；halfFactor 默认 1.05 略留边（手机/桌面同）
  const half = dist * Math.tan(fov * 0.5) * halfFactor
  let rad = half / EARTH_RADIUS_KM
  // 瓦片 20°，补半格余量
  rad += (8 * Math.PI) / 180
  return Math.min(coneMax, Math.max(CONE_MIN_RAD, rad))
}

/**
 * @param {number} lon
 * @param {number} lat
 * @param {{ x:number, y:number, z:number }} cam unit
 */
export function lonLatFrontDot(lon, lat, cam) {
  const p = project(lon, lat, 0, 1)
  const len = Math.hypot(p.x, p.y, p.z) || 1
  return (p.x / len) * cam.x + (p.y / len) * cam.y + (p.z / len) * cam.z
}

/**
 * 点是否在「地平线以上 + 焦点视锥内」
 * @param {import('three').Camera} camera
 * @param {{ x:number, y:number, z:number }} focus
 * @param {number} lon
 * @param {number} lat
 * @param {number} [coneRad]
 * @param {number} [limb]
 */
export function isLonLatInView(
  camera,
  focus,
  lon,
  lat,
  coneRad,
  limb,
) {
  const cam = camRadial(camera)
  const p = project(lon, lat, 0, 1)
  const len = Math.hypot(p.x, p.y, p.z) || 1
  const nx = p.x / len
  const ny = p.y / len
  const nz = p.z / len
  const front = nx * cam.x + ny * cam.y + nz * cam.z
  const limbMin = limb ?? limbDotMin(camera)
  if (front < limbMin) return false

  const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
  const fx = focus.x / fl
  const fy = focus.y / fl
  const fz = focus.z / fl
  const focusDot = nx * fx + ny * fy + nz * fz
  const rad = coneRad ?? viewConeRad(camera, focus)
  // focusDot >= cos(cone) → 在锥内
  return focusDot >= Math.cos(rad)
}

/**
 * 瓦片：中心或任一角在视锥+地平线内
 * @param {import('three').Camera} camera
 * @param {{ x:number, y:number, z:number }} focus
 * @param {number} lon0
 * @param {number} lat0
 * @param {number} lon1
 * @param {number} lat1
 * @param {number} [coneRad]
 */
export function isTileInView(camera, focus, lon0, lat0, lon1, lat1, coneRad) {
  const rad = coneRad ?? viewConeRad(camera, focus)
  const limb = limbDotMin(camera)
  const midLon = (lon0 + lon1) * 0.5
  const midLat = (lat0 + lat1) * 0.5
  const samples = [
    [midLon, midLat],
    [lon0, lat0],
    [lon1, lat0],
    [lon0, lat1],
    [lon1, lat1],
  ]
  for (const [lon, lat] of samples) {
    if (isLonLatInView(camera, focus, lon, lat, rad, limb)) return true
  }
  return false
}

/**
 * @param {Array<{ lon:number, lat:number }>} quakes
 * @param {import('three').Camera} camera
 * @param {{ x:number, y:number, z:number }} focus
 * @param {{ skipLimb?: boolean, mobile?: boolean, coneMaxRad?: number, halfFactor?: number, coneRad?: number }} [opts]
 *   skipLimb=true：只做焦点锥（点表稳定，自转不抖）；背面靠 depth 遮挡
 *   mobile / coneMaxRad / halfFactor → 传给 viewConeRad；coneRad 可直接指定
 */
export function filterQuakesInView(quakes, camera, focus, opts = {}) {
  if (!quakes?.length) return []
  const rad =
    opts.coneRad != null ? opts.coneRad : viewConeRad(camera, focus, opts)
  const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
  const fx = focus.x / fl
  const fy = focus.y / fl
  const fz = focus.z / fl
  const cosR = Math.cos(rad)
  const limb = opts.skipLimb ? -1 : limbDotMin(camera)
  const cam = opts.skipLimb ? null : camRadial(camera)
  const out = []
  for (const q of quakes) {
    if (q.lon == null || q.lat == null) continue
    const p = project(q.lon, q.lat, 0, 1)
    const len = Math.hypot(p.x, p.y, p.z) || 1
    const nx = p.x / len
    const ny = p.y / len
    const nz = p.z / len
    if (cam && nx * cam.x + ny * cam.y + nz * cam.z < limb) continue
    if (nx * fx + ny * fy + nz * fz < cosR) continue
    out.push(q)
  }
  return out
}

// —— 兼容旧名（避免外部残留引用炸）——
export const DEFAULT_FRONT_DOT = 0.22
export const filterQuakesOnScreen = filterQuakesInView
export function isLonLatOnScreen(camera, lon, lat) {
  const focus = {
    x: (camera.position.x / (Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1)) * EARTH_RADIUS_KM,
    y: (camera.position.y / (Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1)) * EARTH_RADIUS_KM,
    z: (camera.position.z / (Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1)) * EARTH_RADIUS_KM,
  }
  return isLonLatInView(camera, focus, lon, lat)
}
export function isTileOnScreen(camera, lon0, lat0, lon1, lat1) {
  const len =
    Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1
  const focus = {
    x: (camera.position.x / len) * EARTH_RADIUS_KM,
    y: (camera.position.y / len) * EARTH_RADIUS_KM,
    z: (camera.position.z / len) * EARTH_RADIUS_KM,
  }
  return isTileInView(camera, focus, lon0, lat0, lon1, lat1)
}
