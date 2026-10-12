/**
 * 完整地球壳 + 经纬网（仪器台风格，无卫星贴图）
 *
 * 遮挡：用 **不透明、只写深度** 的 BackSide 球（colorWrite:false），
 * 在透明岸线/网格之前写入远半球深度，挡住地球背面的线与点。
 * 经纬网只画当前画面正面段（updateEarthGrid），避免整圈纬线像「直线」穿暗半球。
 */
import * as THREE from 'three'
import { EARTH_RADIUS_KM } from './coords.js'

const GRID_FRONT_DOT = 0.2
const _gridCamKey = { last: '' }

/**
 * @param {{ bg: number, gridA: number, gridB: number }} theme
 * @returns {THREE.Group}
 */
export function buildEarthGlobe(theme) {
  const group = new THREE.Group()
  group.name = 'earth-globe'

  // 深度遮挡墙：只写深度、不画颜色；BackSide = 从球外看到的是远半球内侧
  // 略贴近壳（0.9995）：给 Line2 加宽后的背面像素更少「穿帮」机会
  const occluderGeo = new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.9995, 64, 48)
  const occluderMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.BackSide,
    // 必须走不透明队列，早于 transparent 岸线
    transparent: false,
    opacity: 1,
  })
  const occluder = new THREE.Mesh(occluderGeo, occluderMat)
  occluder.name = 'earth-depth-occluder'
  occluder.renderOrder = -10
  occluder.frustumCulled = false
  group.add(occluder)

  // 极淡正面壳：只暗示球体弧度，不写深度（以免挡住壳下震源）
  const frontGeo = new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.999, 64, 48)
  const frontMat = new THREE.MeshBasicMaterial({
    color: theme.bg,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
  })
  const front = new THREE.Mesh(frontGeo, frontMat)
  front.name = 'earth-shell-front'
  front.renderOrder = 0
  group.add(front)

  // 极淡背面染色（可选氛围），不写深度
  const backTintGeo = new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.9975, 48, 32)
  const backTintMat = new THREE.MeshBasicMaterial({
    color: theme.bg,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
  })
  const backTint = new THREE.Mesh(backTintGeo, backTintMat)
  backTint.name = 'earth-shell-back-tint'
  backTint.renderOrder = -9
  group.add(backTint)

  const grid = buildLatLonGrid(theme.gridA, theme.gridB)
  group.add(grid)
  // 进站立刻画满经纬网（不空等相机；背面靠 depth 遮挡）
  fillFullEarthGrid(group)

  group.userData.occluderMat = occluderMat
  group.userData.frontMat = frontMat
  group.userData.backTintMat = backTintMat
  group.userData.grid = grid
  return group
}

/**
 * @param {THREE.Group | null | undefined} group
 * @param {{ bg: number, gridA: number, gridB: number }} theme
 */
export function setEarthTheme(group, theme) {
  if (!group) return
  const frontMat = group.userData?.frontMat
  if (frontMat?.color) frontMat.color.setHex(theme.bg)
  const backTintMat = group.userData?.backTintMat
  if (backTintMat?.color) backTintMat.color.setHex(theme.bg)

  const grid = group.userData?.grid
  if (!grid) return
  grid.traverse((obj) => {
    if (!obj.isLineSegments && !obj.isLine) return
    const mat = obj.material
    if (!mat) return
    if (obj.userData?.kind === 'meridian') mat.color.setHex(theme.gridA)
    else if (obj.userData?.kind === 'parallel') mat.color.setHex(theme.gridB)
    else mat.color.setHex(theme.gridA)
  })
}

/**
 * @param {number} colorMer hex
 * @param {number} colorPar hex
 */
function buildLatLonGrid(colorMer, colorPar) {
  const group = new THREE.Group()
  group.name = 'earth-latlon-grid'
  const R = EARTH_RADIUS_KM * 1.0005

  const merMat = new THREE.LineBasicMaterial({
    color: colorMer,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: true,
  })
  const meridians = new THREE.LineSegments(new THREE.BufferGeometry(), merMat)
  meridians.userData.kind = 'meridian'
  meridians.frustumCulled = false
  meridians.renderOrder = 1
  group.add(meridians)

  const parMat = new THREE.LineBasicMaterial({
    color: colorPar,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    depthTest: true,
  })
  const parallels = new THREE.LineSegments(new THREE.BufferGeometry(), parMat)
  parallels.userData.kind = 'parallel'
  parallels.frustumCulled = false
  parallels.renderOrder = 1
  group.add(parallels)

  group.userData.meridians = meridians
  group.userData.parallels = parallels
  group.userData.gridR = R
  group.userData.gridFull = false
  return group
}

/**
 * 一次画满经纬网（整球）；背面由 depth 遮挡。
 * 开场第一帧就要完整球网，禁止空网格。
 * @param {THREE.Group | null | undefined} earthGroup
 */
export function fillFullEarthGrid(earthGroup) {
  const grid = earthGroup?.userData?.grid
  if (!grid) return
  const R = grid.userData.gridR || EARTH_RADIUS_KM * 1.0005
  const DEG = Math.PI / 180
  const merPos = []
  for (let lon = -180; lon < 180; lon += 15) {
    const segs = lon % 30 === 0 ? 96 : 64
    for (let i = 0; i < segs; i++) {
      const lat0 = -90 + (180 * i) / segs
      const lat1 = -90 + (180 * (i + 1)) / segs
      pushSpherical(merPos, lon, lat0, R, DEG)
      pushSpherical(merPos, lon, lat1, R, DEG)
    }
  }
  const parPos = []
  for (let lat = -75; lat <= 75; lat += 15) {
    const segs = 128
    for (let i = 0; i < segs; i++) {
      const lon0 = -180 + (360 * i) / segs
      const lon1 = -180 + (360 * (i + 1)) / segs
      // 日界线断开，避免整圈弦线
      if (Math.abs(lon1 - lon0) > 180) continue
      pushSpherical(parPos, lon0, lat, R, DEG)
      pushSpherical(parPos, lon1, lat, R, DEG)
    }
  }
  for (let i = 0; i < 160; i++) {
    const lon0 = -180 + (360 * i) / 160
    const lon1 = -180 + (360 * (i + 1)) / 160
    if (Math.abs(lon1 - lon0) > 180) continue
    pushSpherical(parPos, lon0, 0, R, DEG)
    pushSpherical(parPos, lon1, 0, R, DEG)
  }
  setLinePositions(grid.userData.meridians, merPos)
  setLinePositions(grid.userData.parallels, parPos)
  grid.userData.gridFull = true
  _gridCamKey.last = 'full'
}

/**
 * 近地可改回「只画正面段」省一点；开场/远眺保持 full。
 * @param {THREE.Group | null | undefined} earthGroup
 * @param {THREE.Camera} camera
 * @param {{ force?: boolean, full?: boolean }} [opts]
 */
export function updateEarthGrid(earthGroup, camera, opts = {}) {
  const grid = earthGroup?.userData?.grid
  if (!grid || !camera) return
  // 已满网且未强制切正面：保持完整（开场不会半截）
  if (grid.userData.gridFull && !opts.force && opts.full !== false) {
    return
  }
  if (opts.full !== false && (opts.full === true || grid.userData.gridFull)) {
    fillFullEarthGrid(earthGroup)
    return
  }

  const cx = camera.position.x
  const cy = camera.position.y
  const cz = camera.position.z
  const clen = Math.hypot(cx, cy, cz) || 1
  const vx = cx / clen
  const vy = cy / clen
  const vz = cz / clen
  const key = `${(vx * 20) | 0},${(vy * 20) | 0},${(vz * 20) | 0}`
  if (!opts.force && key === _gridCamKey.last) return
  _gridCamKey.last = key
  grid.userData.gridFull = false

  const R = grid.userData.gridR || EARTH_RADIUS_KM * 1.0005
  const DEG = Math.PI / 180
  const merPos = []
  for (let lon = -180; lon < 180; lon += 15) {
    const segs = lon % 30 === 0 ? 96 : 64
    for (let i = 0; i < segs; i++) {
      const lat0 = -90 + (180 * i) / segs
      const lat1 = -90 + (180 * (i + 1)) / segs
      if (
        frontDot(lon, lat0, vx, vy, vz, DEG) >= GRID_FRONT_DOT &&
        frontDot(lon, lat1, vx, vy, vz, DEG) >= GRID_FRONT_DOT
      ) {
        pushSpherical(merPos, lon, lat0, R, DEG)
        pushSpherical(merPos, lon, lat1, R, DEG)
      }
    }
  }
  const parPos = []
  for (let lat = -75; lat <= 75; lat += 15) {
    const segs = 128
    for (let i = 0; i < segs; i++) {
      const lon0 = -180 + (360 * i) / segs
      const lon1 = -180 + (360 * (i + 1)) / segs
      if (
        frontDot(lon0, lat, vx, vy, vz, DEG) >= GRID_FRONT_DOT &&
        frontDot(lon1, lat, vx, vy, vz, DEG) >= GRID_FRONT_DOT
      ) {
        pushSpherical(parPos, lon0, lat, R, DEG)
        pushSpherical(parPos, lon1, lat, R, DEG)
      }
    }
  }
  for (let i = 0; i < 160; i++) {
    const lon0 = -180 + (360 * i) / 160
    const lon1 = -180 + (360 * (i + 1)) / 160
    if (
      frontDot(lon0, 0, vx, vy, vz, DEG) >= GRID_FRONT_DOT &&
      frontDot(lon1, 0, vx, vy, vz, DEG) >= GRID_FRONT_DOT
    ) {
      pushSpherical(parPos, lon0, 0, R, DEG)
      pushSpherical(parPos, lon1, 0, R, DEG)
    }
  }

  setLinePositions(grid.userData.meridians, merPos)
  setLinePositions(grid.userData.parallels, parPos)
}

/**
 * @param {THREE.LineSegments | undefined} line
 * @param {number[]} positions
 */
function setLinePositions(line, positions) {
  if (!line) return
  const old = line.geometry
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(positions), 3),
  )
  line.geometry = geo
  old?.dispose?.()
}

function frontDot(lon, lat, vx, vy, vz, DEG) {
  const latR = lat * DEG
  const lonR = lon * DEG
  const cosLat = Math.cos(latR)
  const nx = cosLat * Math.sin(lonR)
  const ny = Math.sin(latR)
  const nz = cosLat * Math.cos(lonR)
  return nx * vx + ny * vy + nz * vz
}

function pushSpherical(arr, lon, lat, r, DEG) {
  const latR = lat * DEG
  const lonR = lon * DEG
  const cosLat = Math.cos(latR)
  arr.push(
    r * cosLat * Math.sin(lonR),
    r * Math.sin(latR),
    r * cosLat * Math.cos(lonR),
  )
}
