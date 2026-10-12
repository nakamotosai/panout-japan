/**
 * 右上角迷你地球导航
 *
 * 正解模型：
 * - 圆窗里完整一颗球（正交相机，不局部放大）
 * - 地轴竖直：北在上，只允许绕 Y 水平转
 * - 当前视角 = 球面上的真实经纬点（marker 是 globe 子物体，跟陆地绑死）
 * - 球水平转到「当前经度正对你」→ 标记落在竖直中线上，纬度上下走
 * - 橙色三角箭头：尖端指向主相机航向（0=正北=朝 N）
 * - 点击小地球：当前位置转正北（不飞点）
 * - 简化全球岸线（从 Natural Earth 岸线抽稀），日本在东亚可见
 */
import * as THREE from 'three'
import { EARTH_RADIUS_KM, project } from './coords.js'

const SIZE_CSS = 128
/** 正交半高：刚好装下整球 + 一点边 */
const ORTHO_HALF = EARTH_RADIUS_KM * 1.12
const CAM_Z = EARTH_RADIUS_KM * 4
const GRID_STEP_LON = 30
const GRID_STEP_LAT = 30
const DEG = Math.PI / 180
/** 岸线抽稀：每条线最多约这么多顶点 */
const COAST_MAX_VERTS_PER_LINE = 48
const COAST_MIN_STEP = 4

/**
 * @param {{ x:number, y:number, z:number }} p
 * @returns {{ lon:number, lat:number }}
 */
export function cartesianToLonLat(p) {
  const len = Math.hypot(p.x, p.y, p.z) || 1
  const lat =
    (Math.asin(THREE.MathUtils.clamp(p.y / len, -1, 1)) * 180) / Math.PI
  const lon = (Math.atan2(p.x, p.z) * 180) / Math.PI
  return { lon, lat }
}

/**
 * 焦点 → 地表经纬（强制径向单位化，避免地下/高空 target 算出怪纬度）
 * @param {{ x:number, y:number, z:number }} focus
 */
export function focusToLonLat(focus) {
  if (!focus || !Number.isFinite(focus.x + focus.y + focus.z)) {
    return { lon: 138, lat: 37 }
  }
  const len = Math.hypot(focus.x, focus.y, focus.z)
  if (len < 1) return { lon: 138, lat: 37 }
  return cartesianToLonLat({
    x: focus.x / len,
    y: focus.y / len,
    z: focus.z / len,
  })
}

/**
 * @param {HTMLElement} mountParent
 * @param {{
 *   theme?: { bg:number, coast:number, gridA:number, gridB:number },
 *   onReNorth?: () => void,
 * }} [opts]
 */
export function createMinimap(mountParent, opts = {}) {
  const root = document.createElement('div')
  root.className = 'eq-minimap'
  root.id = 'eq-minimap'
  root.setAttribute('role', 'button')
  root.setAttribute('tabindex', '0')
  root.setAttribute(
    'aria-label',
    '迷你地球：三角箭头标位置与航向，点击当前位置转正北',
  )
  root.title = '点击 → 当前位置转正北'
  root.innerHTML = `
    <div class="eq-minimap-frame">
      <canvas class="eq-minimap-canvas" id="eq-minimap-canvas" width="256" height="256"></canvas>
      <span class="eq-minimap-n" aria-hidden="true">N</span>
      <div class="eq-minimap-rail" aria-hidden="true"></div>
    </div>
  `
  mountParent.appendChild(root)

  const canvas = /** @type {HTMLCanvasElement} */ (
    root.querySelector('#eq-minimap-canvas')
  )
  const theme = opts.theme || {
    bg: 0x141210,
    coast: 0xf5f0e8,
    gridA: 0x3a332c,
    gridB: 0x2a251f,
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(SIZE_CSS, SIZE_CSS, false)
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()

  // 正交：整球完整圆盘，无透视「放大局部」
  const camera = new THREE.OrthographicCamera(
    -ORTHO_HALF,
    ORTHO_HALF,
    ORTHO_HALF,
    -ORTHO_HALF,
    100,
    EARTH_RADIUS_KM * 20,
  )
  camera.position.set(0, 0, CAM_Z)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)

  const globe = new THREE.Group()
  globe.name = 'minimap-globe'
  scene.add(globe)

  // —— 球壳 ——
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.999, 48, 32),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      side: THREE.BackSide,
    }),
  )
  occluder.renderOrder = -10
  globe.add(occluder)

  const shellMat = new THREE.MeshBasicMaterial({
    color: theme.bg,
    transparent: true,
    opacity: 0.92,
    depthWrite: true,
  })
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.998, 48, 32),
    shellMat,
  )
  globe.add(shell)

  const backMat = new THREE.MeshBasicMaterial({
    color: theme.bg,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.BackSide,
  })
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_KM * 0.996, 32, 24),
      backMat,
    ),
  )

  // —— 经纬网（淡）——
  const gridMerMat = new THREE.LineBasicMaterial({
    color: theme.gridA,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
  const gridParMat = new THREE.LineBasicMaterial({
    color: theme.gridB,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })
  globe.add(
    new THREE.LineSegments(
      buildMeridianGeo(EARTH_RADIUS_KM * 1.001),
      gridMerMat,
    ),
  )
  globe.add(
    new THREE.LineSegments(
      buildParallelGeo(EARTH_RADIUS_KM * 1.001),
      gridParMat,
    ),
  )

  // —— 岸线（后由 setCoasts 填）——
  const coastMat = new THREE.LineBasicMaterial({
    color: theme.coast,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  })
  const coastLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    coastMat,
  )
  coastLines.frustumCulled = false
  coastLines.renderOrder = 2
  globe.add(coastLines)

  // —— 当前位置：屏幕平面三角箭头（尖=航向），钉在真实经纬 ——
  // 约 0.14 R → 128px 圆盘上 ~16px，够认方向；贴地表会因纬度侧倾显「偏」
  const markerR = EARTH_RADIUS_KM * 0.14
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xd0801a,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const marker = new THREE.Mesh(buildArrowGeometry(markerR), markerMat)
  marker.renderOrder = 12
  marker.matrixAutoUpdate = false
  globe.add(marker)

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xd0801a,
    transparent: true,
    opacity: 0.22,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  // 光晕盘衬底（同样屏幕朝向，不跟地表倾）
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(markerR * 0.95, 24),
    haloMat,
  )
  halo.renderOrder = 11
  halo.matrixAutoUpdate = false
  globe.add(halo)

  /** @type {{ lon:number, lat:number, heading:number }} */
  let last = { lon: 138, lat: 37, heading: 0 }
  let disposed = false
  let yawSmoothed = -138 * DEG
  let coastsReady = false
  const _m4 = new THREE.Matrix4()
  const _mYaw = new THREE.Matrix4()
  const _mHead = new THREE.Matrix4()

  /**
   * @param {{ bg:number, coast:number, gridA:number, gridB:number }} t
   */
  function setTheme(t) {
    shellMat.color.setHex(t.bg)
    backMat.color.setHex(t.bg)
    gridMerMat.color.setHex(t.gridA)
    gridParMat.color.setHex(t.gridB)
    coastMat.color.setHex(t.coast)
    // 标记用全家统一琥珀 accent
    markerMat.color.setHex(0xd0801a)
    haloMat.color.setHex(0xd0801a)
  }

  /**
   * 抽稀全球岸线画在小地球上（只要 coastline 层）
   * @param {object} geojson
   */
  function setCoasts(geojson) {
    if (disposed || !geojson?.features?.length) return
    const pos = buildDecimatedCoastPositions(geojson)
    if (pos.length < 6) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    coastLines.geometry.dispose()
    coastLines.geometry = geo
    coastsReady = true
  }

  /**
   * 屏幕平面广告牌箭头：
   * - 位置仍钉真实经纬（globe 子物体）
   * - 朝向抵消 globe 的 yaw，再按航向绕视轴转
   *   → 世界系始终正对镜头；0° 尖朝上(N)，90° 尖朝右(东)
   * 旧「贴地表 tangent」在中高纬会侧倾，正北时看起来像偏左上。
   * @param {number} lon
   * @param {number} lat
   * @param {number} headingDeg
   */
  function placeMarker(lon, lat, headingDeg) {
    // 略抬出壳面，避免被岸线/网格抢深度（虽已 depthTest:false）
    const p = project(lon, lat, -55, 1)
    let h = Number(headingDeg)
    if (!Number.isFinite(h)) h = 0
    h = ((h % 360) + 360) % 360
    const headRad = h * DEG

    // local = Ry(-yaw) · Rz(-heading)；world = Ry(yaw)·local = Rz(-heading)
    // 网格：+Y=尖、面朝 +Z（镜头）
    _mYaw.makeRotationY(-yawSmoothed)
    _mHead.makeRotationZ(-headRad)
    _m4.multiplyMatrices(_mYaw, _mHead)
    _m4.setPosition(p.x, p.y, p.z)
    marker.matrix.copy(_m4)

    // 光晕不转航向，只保持屏幕朝向
    _m4.makeRotationY(-yawSmoothed)
    _m4.setPosition(p.x, p.y, p.z)
    halo.matrix.copy(_m4)
  }

  /**
   * @param {number} lon
   * @param {number} lat
   * @param {number} [headingDeg=0]
   * @param {number} [dt=1/60]
   */
  function applyFocus(lon, lat, headingDeg = 0, dt = 1 / 60) {
    // 夹紧，杜绝异常纬度飞到极点外
    const latC = THREE.MathUtils.clamp(lat, -89.5, 89.5)
    let lonC = lon
    if (!Number.isFinite(lonC)) lonC = 138
    while (lonC > 180) lonC -= 360
    while (lonC < -180) lonC += 360
    let head = Number(headingDeg)
    if (!Number.isFinite(head)) head = 0
    head = ((head % 360) + 360) % 360
    last = { lon: lonC, lat: latC, heading: head }

    // 先更新球水平转，placeMarker 要用最新 yawSmoothed 抵消
    const targetYaw = -lonC * DEG
    let d = targetYaw - yawSmoothed
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    const k = 1 - Math.exp(-12 * Math.max(0.001, dt))
    yawSmoothed += d * k
    globe.rotation.set(0, yawSmoothed, 0)

    // 三角箭头：位置绑经纬，朝向屏幕平面 + 航向
    placeMarker(lonC, latC, head)
  }

  /**
   * @param {import('three').Camera} _mainCam
   * @param {{ x:number, y:number, z:number }} focus
   * @param {number} [dt]
   * @param {number} [headingDeg=0] 主相机航向：0=正北
   */
  function sync(_mainCam, focus, dt, headingDeg = 0) {
    if (disposed) return
    const { lon, lat } = focusToLonLat(focus)
    applyFocus(lon, lat, headingDeg, dt)
    renderer.render(scene, camera)
  }

  /**
   * 按 root 实际 CSS 尺寸同步 WebGL 缓冲（手机折叠 48 / 展开 88；桌面 128）
   * 优先 clientWidth，fallback SIZE_CSS，避免固定 128 糊在小圆上
   */
  function resize() {
    if (disposed) return
    const css =
      (root.clientWidth > 0 ? root.clientWidth : 0) ||
      (root.clientHeight > 0 ? root.clientHeight : 0) ||
      SIZE_CSS
    const size = Math.max(1, Math.round(css))
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(size, size, false)
  }

  /**
   * 折叠/展开：main 切换 is-expanded（桌面+手机同逻辑）
   * @param {boolean} open
   */
  function setExpanded(open) {
    if (disposed) return
    root.classList.toggle('is-expanded', !!open)
    // 尺寸可能已变（transition 中途 main 再调 resize 亦可）
    resize()
  }

  function fireReNorth() {
    if (typeof opts.onReNorth === 'function') opts.onReNorth()
  }

  // 点一下小地球 → 当前位置转正北（不跳点）；折叠/展开都 re-north
  // 展开由 main 管 pointer/idle，本模块不拦 click
  function onPointerDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    // 不 stopPropagation：手机 main 靠 root 冒泡展开小地球
    fireReNorth()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fireReNorth()
    }
  })

  function dispose() {
    disposed = true
    canvas.removeEventListener('pointerdown', onPointerDown)
    renderer.dispose()
    shell.geometry.dispose()
    occluder.geometry.dispose()
    marker.geometry.dispose()
    halo.geometry.dispose()
    coastLines.geometry.dispose()
    shellMat.dispose()
    backMat.dispose()
    gridMerMat.dispose()
    gridParMat.dispose()
    coastMat.dispose()
    markerMat.dispose()
    haloMat.dispose()
    root.remove()
  }

  applyFocus(last.lon, last.lat, last.heading, 1)

  return {
    root,
    sync,
    setTheme,
    setCoasts,
    resize,
    setExpanded,
    dispose,
    getFocusLonLat: () => ({ ...last }),
    get coastsReady() {
      return coastsReady
    },
  }
}

/**
 * 扁平三角箭头（屏幕平面）：+Y 尖端、面朝 +Z
 * 比例偏修长，128px 小窗上更好认方向
 * @param {number} size
 */
function buildArrowGeometry(size) {
  const h = size * 2.15
  const halfW = size * 0.92
  const z = 0
  const positions = new Float32Array([
    0,
    h * 0.62,
    z, // 尖
    halfW,
    -h * 0.38,
    z, // 右下
    -halfW,
    -h * 0.38,
    z, // 左下
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * 从 Natural Earth 岸线 geojson 抽稀成线段顶点（LineSegments 成对）
 * @param {object} geojson
 * @returns {number[]}
 */
function buildDecimatedCoastPositions(geojson) {
  const R = EARTH_RADIUS_KM * 1.003
  /** @type {number[]} */
  const pos = []
  const features = geojson.features || []
  for (let fi = 0; fi < features.length; fi++) {
    const f = features[fi]
    const kind = f.properties?.kind || f.properties?.layer || ''
    // 只要海岸线；国界太密在 128px 上糊成一团
    if (kind && kind !== 'coastline' && kind !== 'coast') continue
    const g = f.geometry
    if (!g) continue
    /** @type {number[][][]} */
    let lines = []
    if (g.type === 'LineString') lines = [g.coordinates]
    else if (g.type === 'MultiLineString') lines = g.coordinates
    else continue

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]
      if (!line || line.length < 2) continue
      const step = Math.max(
        COAST_MIN_STEP,
        Math.ceil(line.length / COAST_MAX_VERTS_PER_LINE),
      )
      /** @type {number[][]} */
      const pts = []
      for (let i = 0; i < line.length; i += step) pts.push(line[i])
      const last = line[line.length - 1]
      const prev = pts[pts.length - 1]
      if (!prev || prev[0] !== last[0] || prev[1] !== last[1]) pts.push(last)

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        if (!a || !b) continue
        // 跳过跨日界线长弦
        if (Math.abs(a[0] - b[0]) > 180) continue
        pushLonLat(pos, a[0], a[1], R)
        pushLonLat(pos, b[0], b[1], R)
      }
    }
  }
  return pos
}

/** @param {number} R */
function buildMeridianGeo(R) {
  const pos = []
  for (let lon = -180; lon < 180; lon += GRID_STEP_LON) {
    const segs = 36
    for (let i = 0; i < segs; i++) {
      const lat0 = -90 + (180 * i) / segs
      const lat1 = -90 + (180 * (i + 1)) / segs
      pushLonLat(pos, lon, lat0, R)
      pushLonLat(pos, lon, lat1, R)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** @param {number} R */
function buildParallelGeo(R) {
  const pos = []
  for (let lat = -60; lat <= 60; lat += GRID_STEP_LAT) {
    const segs = 48
    for (let i = 0; i < segs; i++) {
      const lon0 = -180 + (360 * i) / segs
      const lon1 = -180 + (360 * (i + 1)) / segs
      if (Math.abs(lon1 - lon0) > 180) continue
      pushLonLat(pos, lon0, lat, R)
      pushLonLat(pos, lon1, lat, R)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/**
 * @param {number[]} pos
 * @param {number} lon
 * @param {number} lat
 * @param {number} R
 */
function pushLonLat(pos, lon, lat, R) {
  const latR = lat * DEG
  const lonR = lon * DEG
  const cosLat = Math.cos(latR)
  pos.push(
    R * cosLat * Math.sin(lonR),
    R * Math.sin(latR),
    R * cosLat * Math.cos(lonR),
  )
}
