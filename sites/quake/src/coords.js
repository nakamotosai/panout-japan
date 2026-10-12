/**
 * 真地球球坐标（km）。
 * Y 轴向上；lon=0 / lat=0 → +Z；深度沿半径往球心缩。
 */

export const EARTH_RADIUS_KM = 6371

/** @deprecated 平面时代原点；保留别名以免外部误引用炸 */
export const ORIGIN_LON = 137.5
export const ORIGIN_LAT = 37.0

const DEG = Math.PI / 180

/**
 * 经纬 + 深度 → 场景 xyz（km）
 * depthKm≥0 在壳下；depthKm&lt;0 在壳外（相机高度用）
 * @param {number} lon
 * @param {number} lat
 * @param {number} [depthKm=0]
 * @param {number} [exaggeration=2]
 * @returns {{ x: number, y: number, z: number }}
 */
export function project(lon, lat, depthKm = 0, exaggeration = 2) {
  const r = Math.max(80, EARTH_RADIUS_KM - depthKm * exaggeration)
  const latR = lat * DEG
  const lonR = lon * DEG
  const cosLat = Math.cos(latR)
  const x = r * cosLat * Math.sin(lonR)
  const y = r * Math.sin(latR)
  const z = r * cosLat * Math.cos(lonR)
  return { x, y, z }
}

/**
 * 地表外法线（单位向量，指向太空）
 * @param {number} lon
 * @param {number} lat
 * @returns {{ x: number, y: number, z: number }}
 */
export function surfaceNormal(lon, lat) {
  const p = project(lon, lat, 0, 1)
  const len = Math.hypot(p.x, p.y, p.z) || 1
  return { x: p.x / len, y: p.y / len, z: p.z / len }
}

/**
 * 地表点局部坐标系：east / up(径向) / north
 * @param {number} lon
 * @param {number} lat
 * @returns {{ east: {x:number,y:number,z:number}, up: {x:number,y:number,z:number}, north: {x:number,y:number,z:number}, origin: {x:number,y:number,z:number} }}
 */
export function localFrame(lon, lat) {
  const origin = project(lon, lat, 0, 1)
  const upLen = Math.hypot(origin.x, origin.y, origin.z) || 1
  const up = {
    x: origin.x / upLen,
    y: origin.y / upLen,
    z: origin.z / upLen,
  }
  // east = worldUp × radial
  let ex = 0 * up.z - 1 * up.y
  let ey = 1 * up.x - 0 * up.z
  let ez = 0 * up.y - 0 * up.x
  let eLen = Math.hypot(ex, ey, ez)
  if (eLen < 1e-8) {
    // 极点：用 +X 作参考
    ex = 0 * up.z - 0 * up.y
    ey = 0 * up.x - 1 * up.z
    ez = 1 * up.y - 0 * up.x
    eLen = Math.hypot(ex, ey, ez) || 1
  }
  const east = { x: ex / eLen, y: ey / eLen, z: ez / eLen }
  // north = radial × east
  const north = {
    x: up.y * east.z - up.z * east.y,
    y: up.z * east.x - up.x * east.z,
    z: up.x * east.y - up.y * east.x,
  }
  return { east, up, north, origin }
}

/**
 * 斜俯视构图：target=地表，dir 在当地 east/up/north 中解释（与旧平面 dir 语义对齐）
 * @param {number} lon
 * @param {number} lat
 * @param {number} distanceKm
 * @param {{ x: number, y: number, z: number }} dirLocal  x=东 y=外法向 z=南(旧平面 +Z)
 * @returns {{ target: {x:number,y:number,z:number}, position: {x:number,y:number,z:number} }}
 */
export function cameraPose(lon, lat, distanceKm, dirLocal) {
  const { east, up, north, origin } = localFrame(lon, lat)
  const dx = dirLocal?.x ?? 0.42
  const dy = dirLocal?.y ?? 0.5
  const dz = dirLocal?.z ?? 0.72
  // 旧 z 为南 → 用 -north
  let dirx = east.x * dx + up.x * dy + north.x * -dz
  let diry = east.y * dx + up.y * dy + north.y * -dz
  let dirz = east.z * dx + up.z * dy + north.z * -dz
  const dLen = Math.hypot(dirx, diry, dirz) || 1
  dirx /= dLen
  diry /= dLen
  dirz /= dLen
  return {
    target: { ...origin },
    position: {
      x: origin.x + dirx * distanceKm,
      y: origin.y + diry * distanceKm,
      z: origin.z + dirz * distanceKm,
    },
  }
}

/**
 * 日本居中 + 正北朝上的机位（复位 / 默认构图用）
 * headingDeg=0 → 屏幕上方是正北；tiltDeg=相对天顶的倾角（0=正俯视）
 * 相机在目标南侧抬高，俯视北方——和看挂墙地图一样。
 * @param {number} lon
 * @param {number} lat
 * @param {number} distanceKm
 * @param {{ tiltDeg?: number, headingDeg?: number }} [opts]
 */
export function cameraPoseNorthUp(lon, lat, distanceKm, opts = {}) {
  const tiltDeg = opts.tiltDeg ?? 28
  const headingDeg = opts.headingDeg ?? 0
  const { east, up, north, origin } = localFrame(lon, lat)
  const tilt = tiltDeg * DEG
  const heading = headingDeg * DEG
  const sinT = Math.sin(tilt)
  const cosT = Math.cos(tilt)
  const sinH = Math.sin(heading)
  const cosH = Math.cos(heading)
  // 当地：x=东 y=天顶 z=北
  // heading=0,tilt>0 → (0, cosT, -sinT)：在南侧抬高，朝北俯视，屏幕上=北
  const lx = sinT * sinH
  const ly = cosT
  const lz = -sinT * cosH
  return {
    target: { ...origin },
    position: {
      x: origin.x + (east.x * lx + up.x * ly + north.x * lz) * distanceKm,
      y: origin.y + (east.y * lx + up.y * ly + north.y * lz) * distanceKm,
      z: origin.z + (east.z * lx + up.z * ly + north.z * lz) * distanceKm,
    },
    /** 正北（用于 camera.up，避免 up∥视线时 lookAt 翻车） */
    up: { ...north },
  }
}
