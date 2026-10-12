/**
 * 谷歌地球式球导航（地球固定在原点，相机绕球动）
 *
 * 手感对齐：
 * - 左键拖 = 抓住地表拖（射线命中点跟光标走）→ 像平面地图左右平移
 * - 右键拖 / Ctrl·Alt·Meta·Shift+左键 = 绕焦点转方位+俯仰
 * - 滚轮 = 拉近/拉远（到 target 距离）
 * - 自动旋转 = 绕「焦点当地天顶」慢慢转（不是世界 Y）
 *
 * 暴露的 API 故意贴近 OrbitControls 常用子集，方便 main.js 少改。
 */
import * as THREE from 'three'
import { EARTH_RADIUS_KM } from './coords.js'

const EPS = 1e-8
const TWO_PI = Math.PI * 2

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} domElement
 */
export function createGlobeNav(camera, domElement) {
  const target = new THREE.Vector3(0, 0, EARTH_RADIUS_KM)
  const spherical = new THREE.Spherical()

  let minDistance = 80
  let maxDistance = EARTH_RADIUS_KM * 6
  /** 相对当地天顶的极角：0=正俯视，π/2=地平 */
  let minPolar = 0.06
  let maxPolar = Math.PI * 0.48

  let enableDamping = true
  let dampingFactor = 0.08
  let autoRotate = false
  let autoRotateSpeed = 0.12 // 同 OrbitControls 量级：~30s/圈 @ 1.0
  let rotateSpeed = 0.85
  let panSpeed = 1.0
  let zoomSpeed = 1.0

  /** @type {'none' | 'pan' | 'rotate' | 'dolly'} */
  let state = 'none'
  let pointerId = -1

  // 抓地表：固定世界点
  const grabPoint = new THREE.Vector3()
  let hasGrab = false
  /** 抓地平移上一帧光标（掠射/丢命中时改走屏幕增量） */
  let lastPanClientX = 0
  let lastPanClientY = 0
  /** 单帧最大抓地转角；超过则重抓，避免地平线掠射「整球乱飞」 */
  const PAN_GRAB_MAX_ANG = (7 * Math.PI) / 180
  /** cam→hit 与 -径向 夹角余弦下限；更小=更掠射，改屏幕平移 */
  const PAN_GRAB_MIN_HEADON = 0.14

  // 旋转：屏幕起点 + 开始时的球坐标（相对 target 的 local 球）
  const rotateStart = new THREE.Vector2()
  let rotTheta0 = 0
  let rotPhi0 = 0
  let rotRadius0 = 0

  // 阻尼：目标球坐标
  let dampTheta = 0
  let dampPhi = 0
  let dampRadius = 0
  let dampActive = false

  let _lastUpdateMs = 0

  const _raycaster = new THREE.Raycaster()
  const _ndc = new THREE.Vector2()
  const _v = new THREE.Vector3()
  const _v2 = new THREE.Vector3()
  const _v3 = new THREE.Vector3()
  const _q = new THREE.Quaternion()
  const _localUp = new THREE.Vector3()
  const _localEast = new THREE.Vector3()
  const _localNorth = new THREE.Vector3()
  const _offset = new THREE.Vector3()
  const _m = new THREE.Matrix4()
  const _e = new THREE.Euler()

  /** @type {Set<(type: string) => void>} */
  const listeners = {
    start: new Set(),
    end: new Set(),
    change: new Set(),
  }

  function addEventListener(type, fn) {
    listeners[type]?.add(fn)
  }
  function removeEventListener(type, fn) {
    listeners[type]?.delete(fn)
  }
  function emit(type) {
    for (const fn of listeners[type] || []) fn()
  }

  function getNdc(clientX, clientY) {
    const rect = domElement.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    _ndc.x = ((clientX - rect.left) / w) * 2 - 1
    _ndc.y = -((clientY - rect.top) / h) * 2 + 1
    return _ndc
  }

  /**
   * 射线 ∩ 球（原点、半径 R）。取近交点；失败返回 null。
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} [radius=EARTH_RADIUS_KM]
   * @returns {THREE.Vector3 | null}
   */
  function raySphereHit(clientX, clientY, radius = EARTH_RADIUS_KM) {
    getNdc(clientX, clientY)
    _raycaster.setFromCamera(_ndc, camera)
    const o = _raycaster.ray.origin
    const d = _raycaster.ray.direction
    // |o + t d|^2 = R^2
    const a = d.dot(d)
    const b = 2 * o.dot(d)
    const c = o.dot(o) - radius * radius
    const disc = b * b - 4 * a * c
    if (disc < 0) return null
    const s = Math.sqrt(disc)
    let t = (-b - s) / (2 * a)
    if (t < 0) t = (-b + s) / (2 * a)
    if (t < 0) return null
    return o.clone().addScaledVector(d, t)
  }

  /**
   * 射线与「过 target、法线=径向」的切平面交点，再压回球面（远景/掠射兜底）
   */
  function rayTangentFallback(clientX, clientY) {
    getNdc(clientX, clientY)
    _raycaster.setFromCamera(_ndc, camera)
    const o = _raycaster.ray.origin
    const d = _raycaster.ray.direction
    const n = target.clone().normalize()
    const denom = d.dot(n)
    if (Math.abs(denom) < EPS) return null
    const t = n.dot(_v.copy(target).sub(o)) / denom
    if (t < 0) return null
    const hit = o.clone().addScaledVector(d, t)
    // 压回球面
    const len = hit.length()
    if (len < EPS) return null
    hit.multiplyScalar(EARTH_RADIUS_KM / len)
    return hit
  }

  function hitSurface(clientX, clientY) {
    return raySphereHit(clientX, clientY) || rayTangentFallback(clientX, clientY)
  }

  /** 当地 east / up / north（up = 径向） */
  function localFrameAt(point, outEast, outUp, outNorth) {
    outUp.copy(point).normalize()
    // east = worldY × up
    outEast.set(0, 1, 0).cross(outUp)
    if (outEast.lengthSq() < 1e-10) {
      // 极点
      outEast.set(1, 0, 0).cross(outUp)
    }
    outEast.normalize()
    outNorth.copy(outUp).cross(outEast).normalize()
  }

  /**
   * 把 offset = cam - target 解到「当地 up 为极轴」的球坐标
   * theta: 绕 up 的方位；phi: 相对 up 的极角（0=正上方）
   */
  function offsetToLocalSpherical(offset, focus, out) {
    localFrameAt(focus, _localEast, _localUp, _localNorth)
    // 把 offset 变到 local 基：x=east, y=up, z=-north（与 THREE.Spherical 的 y-up 一致）
    const x = offset.dot(_localEast)
    const y = offset.dot(_localUp)
    const z = offset.dot(_localNorth) // THREE Spherical: z 前；我们用 north 当 -z 还是 z？
    // 用标准 setFromVector3：Y-up，theta 绕 Y，phi 从 +Y
    // local 向量 (east, up, north) → 当作 (x, y, z)
    _v.set(x, y, z)
    out.setFromVector3(_v)
    return out
  }

  function localSphericalToOffset(sph, focus, out) {
    localFrameAt(focus, _localEast, _localUp, _localNorth)
    _v.setFromSpherical(sph) // x,y,z in local
    out
      .set(0, 0, 0)
      .addScaledVector(_localEast, _v.x)
      .addScaledVector(_localUp, _v.y)
      .addScaledVector(_localNorth, _v.z)
    return out
  }

  /**
   * 焦点保持在地表附近：平移时钉在 R 上；飞到震源时允许略沉到壳下（看地下球）
   * 只在半径离谱时硬纠正，避免每帧把地下 target 拽回壳上跳变。
   */
  function snapTargetToSurface() {
    const len = target.length()
    if (len < EARTH_RADIUS_KM * 0.05) {
      target.set(0, 0, EARTH_RADIUS_KM)
      return
    }
    const minR = EARTH_RADIUS_KM * 0.88
    const maxR = EARTH_RADIUS_KM * 1.04
    if (len < minR || len > maxR) {
      target.multiplyScalar(EARTH_RADIUS_KM / len)
    }
  }

  /** 平移抓地时：强制焦点贴在球壳（地图感） */
  function pinTargetOnShell() {
    const len = target.length()
    if (len < EPS) {
      target.set(0, 0, EARTH_RADIUS_KM)
      return
    }
    target.multiplyScalar(EARTH_RADIUS_KM / len)
  }

  /**
   * 稳定 camera.up + lookAt（地平线水平，不锁正北）。
   *
   * 禁止按「是否朝北」把 up 取反——转过半圈时会整球突然翻转（用户已踩坑）。
   * 正俯视时 up∥视线会退化：用航向 theta 推一个与视线垂直的 up。
   */
  function orientCamera() {
    localFrameAt(target, _localEast, _localUp, _localNorth)
    // 视线：相机 → 目标
    _v.subVectors(target, camera.position)
    const vLen = _v.length()
    if (vLen < EPS) {
      headingUp(_localEast, _localNorth, camera.up)
      return
    }
    _v.multiplyScalar(1 / vLen)

    // 天顶去掉视线分量 → 地平线水平（谷歌地球同款）
    camera.up.copy(_localUp).addScaledVector(_v, -_localUp.dot(_v))
    if (camera.up.lengthSq() < 1e-8) {
      // 几乎正俯视：按当前航向定屏幕上方（连续，不跳变）
      headingUp(_localEast, _localNorth, camera.up)
    } else {
      camera.up.normalize()
    }
    camera.lookAt(target)
  }

  /**
   * 正俯视时的 up：由 spherical.theta 决定，与 setAzimuthDeg 的「0=正北」一致。
   * theta=π → 正北在上；转航向时 up 跟着连续转，不会 180° 硬翻。
   */
  function headingUp(east, north, out) {
    // heading = theta - π；up = cos(h)·north + sin(h)·east
    const h = spherical.theta - Math.PI
    const c = Math.cos(h)
    const s = Math.sin(h)
    out.copy(north).multiplyScalar(c).addScaledVector(east, s)
    if (out.lengthSq() < 1e-10) out.copy(north)
    else out.normalize()
  }

  function applyCameraFromSpherical() {
    snapTargetToSurface()
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, minDistance, maxDistance)
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPolar, maxPolar)
    spherical.makeSafe()
    localSphericalToOffset(spherical, target, _offset)
    camera.position.copy(target).add(_offset)
    orientCamera()
    emit('change')
  }

  function readSphericalFromCamera() {
    _offset.subVectors(camera.position, target)
    offsetToLocalSpherical(_offset, target, spherical)
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, minDistance, maxDistance)
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPolar, maxPolar)
  }

  /**
   * 屏幕增量平移（掠射/未命中球时用）：绕当地 up/east 小转，不抓地皮
   */
  function panScreenDelta(clientX, clientY) {
    const dx = clientX - lastPanClientX
    const dy = clientY - lastPanClientY
    lastPanClientX = clientX
    lastPanClientY = clientY
    if (dx === 0 && dy === 0) return
    const h = Math.max(1, domElement.clientHeight)
    const k = ((Math.PI * panSpeed) / h) * 0.9
    readSphericalFromCamera()
    localFrameAt(target, _localEast, _localUp, _localNorth)
    _q.setFromAxisAngle(_localUp, -dx * k)
    camera.position.applyQuaternion(_q)
    target.applyQuaternion(_q)
    _q.setFromAxisAngle(_localEast, -dy * k)
    camera.position.applyQuaternion(_q)
    target.applyQuaternion(_q)
    snapTargetToSurface()
    readSphericalFromCamera()
    // 斜视时仍钳 phi，禁止甩到球背
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPolar, maxPolar)
    applyCameraFromSpherical()
  }

  /**
   * 抓住地表拖：把 hit 旋到 grab，相机/target 同旋。
   * 地平线掠射时射线不稳/切面 fallback 会给出跨半球 hit → 大角四元数整球乱飞；
   * 故：只用真球命中、掠射改屏幕平移、超大角重抓。
   */
  function panGrab(clientX, clientY) {
    if (!hasGrab) return
    // 抓地只用球交，不用切面 fallback（fallback 在掠射时会飞到对面）
    const hit = raySphereHit(clientX, clientY)
    if (!hit) {
      panScreenDelta(clientX, clientY)
      return
    }
    const radial = _v2.copy(hit).normalize()
    _v.subVectors(hit, camera.position).normalize()
    // headOn≈1 正对地表；≈0 贴地平线掠射
    const headOn = -_v.dot(radial)
    if (headOn < PAN_GRAB_MIN_HEADON) {
      panScreenDelta(clientX, clientY)
      return
    }
    const from = radial
    const to = _v3.copy(grabPoint).normalize()
    const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1)
    const ang = Math.acos(dot)
    if (ang < 1e-7) {
      lastPanClientX = clientX
      lastPanClientY = clientY
      return
    }
    // 帧间跳变过大：不旋，改重抓当前 hit（掐断乱飞）
    if (ang > PAN_GRAB_MAX_ANG) {
      grabPoint.copy(hit)
      lastPanClientX = clientX
      lastPanClientY = clientY
      return
    }
    // axis = from × to；把 from 旋到 to
    _v.crossVectors(from, to)
    if (_v.lengthSq() < 1e-14) {
      lastPanClientX = clientX
      lastPanClientY = clientY
      return
    }
    _v.normalize()
    _q.setFromAxisAngle(_v, ang)
    camera.position.applyQuaternion(_q)
    target.applyQuaternion(_q)
    // 飞到深源后 target 可在壳下；硬 pin 会单独拽焦点导致震中离屏
    snapTargetToSurface()
    readSphericalFromCamera()
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPolar, maxPolar)
    orientCamera()
    lastPanClientX = clientX
    lastPanClientY = clientY
    emit('change')
  }

  function rotateByDelta(dx, dy) {
    // dx → 航向（绕当地天顶）；dy → 俯仰（0=正俯视，加大=更斜）
    // 注意：phi 只在 [minPolar, maxPolar] 内，禁止翻到地球背面
    const el = domElement
    const h = Math.max(1, el.clientHeight)
    const rot = ((TWO_PI * rotateSpeed) / h) * 0.55
    spherical.theta = rotTheta0 - dx * rot
    // 往上拖 = 更俯视（减小 phi）；往下拖 = 更斜视（增大 phi）
    spherical.phi = THREE.MathUtils.clamp(
      rotPhi0 + dy * rot * 0.75,
      minPolar,
      maxPolar,
    )
    spherical.radius = rotRadius0
    applyCameraFromSpherical()
  }

  function dollyByWheel(deltaY, clientX, clientY) {
    // 向光标下真球命中 zoom；掠射/天空禁止切面兜底（与 pan 同根因：会把焦点甩飞）
    const hit = raySphereHit(clientX, clientY)
    let goodHit = null
    if (hit) {
      const radial = _v2.copy(hit).normalize()
      _v.subVectors(hit, camera.position).normalize()
      const headOn = -_v.dot(radial)
      if (headOn >= PAN_GRAB_MIN_HEADON) goodHit = hit
    }
    const factor = Math.exp(deltaY * 0.0011 * zoomSpeed)
    const oldR = camera.position.distanceTo(target)
    const newR = THREE.MathUtils.clamp(oldR * factor, minDistance, maxDistance)

    if (goodHit && Math.abs(factor - 1) > 1e-6) {
      // 相机沿 相机→hit 移动，使距离 target 变为 newR（近似：先按比例靠 hit）
      const tZoom = 1 - newR / oldR
      camera.position.lerp(goodHit, THREE.MathUtils.clamp(tZoom, -2, 0.95))
      // 焦点也略向 hit 靠，地图在光标下「钉住」
      target.lerp(goodHit, THREE.MathUtils.clamp(tZoom * 0.55, -1, 0.85))
      snapTargetToSurface()
      // 再精确钉距离
      _offset.subVectors(camera.position, target)
      const len = _offset.length() || 1
      _offset.multiplyScalar(newR / len)
      camera.position.copy(target).add(_offset)
      readSphericalFromCamera()
      // 旋转进行中滚轮：同步 rotRadius0，避免下一帧 rotateByDelta 把距离拽回
      if (state === 'rotate' || state === 'dolly') rotRadius0 = spherical.radius
      applyCameraFromSpherical()
    } else {
      spherical.radius = newR
      if (state === 'rotate' || state === 'dolly') rotRadius0 = spherical.radius
      applyCameraFromSpherical()
    }
  }

  function wantsRotate(event) {
    if (event.button === 2) return true
    if (event.button === 1) return true
    if (event.button === 0) {
      return !!(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    }
    return false
  }

  function wantsPan(event) {
    return event.button === 0 && !wantsRotate(event)
  }

  function onPointerDown(event) {
    // 触屏由 touch* 独占：现代浏览器会同时派 pointer+touch，双通道会 pan 双速/互抢
    if (event.pointerType === 'touch') return
    if (pointerId >= 0) return
    // 只接管主指针
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1 && event.button !== 2) {
      return
    }

    if (wantsPan(event)) {
      state = 'pan'
      lastPanClientX = event.clientX
      lastPanClientY = event.clientY
      // 抓地仅真球命中；掠射/未中 → 屏幕增量平移
      const hit = raySphereHit(event.clientX, event.clientY)
      if (hit) {
        const radial = _v2.copy(hit).normalize()
        _v.subVectors(hit, camera.position).normalize()
        const headOn = -_v.dot(radial)
        if (headOn >= PAN_GRAB_MIN_HEADON) {
          grabPoint.copy(hit)
          hasGrab = true
        } else {
          hasGrab = false
        }
      } else {
        hasGrab = false
      }
    } else if (wantsRotate(event)) {
      state = 'rotate'
      hasGrab = false
      rotateStart.set(event.clientX, event.clientY)
      readSphericalFromCamera()
      rotTheta0 = spherical.theta
      rotPhi0 = spherical.phi
      rotRadius0 = spherical.radius
    } else {
      return
    }

    pointerId = event.pointerId
    try {
      domElement.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    dampActive = false
    emit('start')
    event.preventDefault()
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') return
    if (event.pointerId !== pointerId) return
    if (state === 'pan') {
      if (hasGrab) {
        panGrab(event.clientX, event.clientY)
      } else {
        panScreenDelta(event.clientX, event.clientY)
      }
      event.preventDefault()
    } else if (state === 'rotate') {
      const dx = event.clientX - rotateStart.x
      const dy = event.clientY - rotateStart.y
      rotateByDelta(dx, dy)
      event.preventDefault()
    }
  }

  function endPointerDrag(event) {
    const was = state
    const pid = pointerId
    state = 'none'
    pointerId = -1
    hasGrab = false
    if (pid >= 0) {
      try {
        domElement.releasePointerCapture(pid)
      } catch {
        /* ignore */
      }
    }
    if (was !== 'none') emit('end')
    // silence unused when called without event
    void event
  }

  function onPointerUp(event) {
    if (event.pointerType === 'touch') return
    if (event.pointerId !== pointerId) return
    endPointerDrag(event)
  }

  function onLostPointerCapture(event) {
    if (event.pointerType === 'touch') return
    if (event.pointerId !== pointerId) return
    endPointerDrag(event)
  }

  function onWheel(event) {
    event.preventDefault()
    dollyByWheel(event.deltaY, event.clientX, event.clientY)
    emit('start')
    emit('end')
  }

  function onContextMenu(event) {
    event.preventDefault()
  }

  // —— 触摸：单指 pan，双指 pinch zoom + 中心拖旋转（桌面右键等价）——
  /** @type {Map<number, {x:number,y:number}>} */
  const touches = new Map()
  let pinchStartDist = 0
  let pinchStartRadius = 0

  function onTouchStart(event) {
    for (const t of event.changedTouches) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY })
    }
    if (touches.size === 1) {
      const t = [...touches.values()][0]
      state = 'pan'
      lastPanClientX = t.x
      lastPanClientY = t.y
      const hit = raySphereHit(t.x, t.y)
      if (hit) {
        const radial = _v2.copy(hit).normalize()
        _v.subVectors(hit, camera.position).normalize()
        const headOn = -_v.dot(radial)
        if (headOn >= PAN_GRAB_MIN_HEADON) {
          grabPoint.copy(hit)
          hasGrab = true
        } else {
          hasGrab = false
        }
      } else {
        hasGrab = false
      }
      emit('start')
    } else if (touches.size === 2) {
      state = 'dolly'
      hasGrab = false
      const pts = [...touches.values()]
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      rotateStart.set(midX, midY)
      readSphericalFromCamera()
      pinchStartRadius = spherical.radius
      rotTheta0 = spherical.theta
      rotPhi0 = spherical.phi
      rotRadius0 = spherical.radius
      emit('start')
    }
  }

  function onTouchMove(event) {
    for (const t of event.changedTouches) {
      if (touches.has(t.identifier)) {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY })
      }
    }
    if (state === 'pan' && touches.size === 1) {
      const t = [...touches.values()][0]
      if (hasGrab) panGrab(t.x, t.y)
      else panScreenDelta(t.x, t.y)
      event.preventDefault()
    } else if (touches.size === 2) {
      const pts = [...touches.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      const midX = (pts[0].x + pts[1].x) / 2
      const midY = (pts[0].y + pts[1].y) / 2
      // 1) pinch → radius
      const scale = pinchStartDist / dist
      const newRadius = THREE.MathUtils.clamp(
        pinchStartRadius * scale,
        minDistance,
        maxDistance,
      )
      // 2) midpoint delta → rotate（与右键同路径 rotateByDelta / rotateSpeed）
      // rotateByDelta 会写 radius=rotRadius0，故先把 pinch 结果塞进 rotRadius0
      const dx = midX - rotateStart.x
      const dy = midY - rotateStart.y
      rotRadius0 = newRadius
      rotateByDelta(dx, dy)
      // 3) 增量：本帧末 mid / 球坐标作下一帧基准
      rotTheta0 = spherical.theta
      rotPhi0 = spherical.phi
      rotateStart.set(midX, midY)
      event.preventDefault()
    }
  }

  function onTouchEnd(event) {
    for (const t of event.changedTouches) touches.delete(t.identifier)
    if (touches.size === 0) {
      if (state !== 'none') emit('end')
      state = 'none'
      hasGrab = false
    } else if (touches.size === 1) {
      // 双指→单指：接成 pan，否则 state 仍是 dolly，单指拖无响应直到松手
      const t = [...touches.values()][0]
      state = 'pan'
      lastPanClientX = t.x
      lastPanClientY = t.y
      const hit = raySphereHit(t.x, t.y)
      if (hit) {
        const radial = _v2.copy(hit).normalize()
        _v.subVectors(hit, camera.position).normalize()
        const headOn = -_v.dot(radial)
        if (headOn >= PAN_GRAB_MIN_HEADON) {
          grabPoint.copy(hit)
          hasGrab = true
        } else {
          hasGrab = false
        }
      } else {
        hasGrab = false
      }
    }
  }

  domElement.addEventListener('pointerdown', onPointerDown)
  domElement.addEventListener('pointermove', onPointerMove)
  domElement.addEventListener('pointerup', onPointerUp)
  domElement.addEventListener('pointercancel', onPointerUp)
  domElement.addEventListener('lostpointercapture', onLostPointerCapture)
  domElement.addEventListener('wheel', onWheel, { passive: false })
  domElement.addEventListener('contextmenu', onContextMenu)
  domElement.addEventListener('touchstart', onTouchStart, { passive: true })
  domElement.addEventListener('touchmove', onTouchMove, { passive: false })
  domElement.addEventListener('touchend', onTouchEnd)
  domElement.addEventListener('touchcancel', onTouchEnd)

  /**
   * 每帧调用。autoRotate + 可选阻尼。
   * 与 three OrbitControls 同量级：autoRotateSpeed 1.0 ≈ 60s/圈
   * @returns {boolean} 是否有姿态变化
   */
  function update() {
    const now = performance.now()
    const dt =
      _lastUpdateMs > 0
        ? Math.min(0.05, (now - _lastUpdateMs) / 1000)
        : 1 / 60
    _lastUpdateMs = now

    if (state !== 'none') {
      // 拖动中 spherical 已实时写
      return true
    }

    let changed = false

    if (autoRotate) {
      // getAutoRotationAngle = (2π / 60 * speed) * dt
      spherical.theta -= ((TWO_PI / 60) * autoRotateSpeed) * dt
      changed = true
    }

    if (enableDamping && dampActive) {
      spherical.theta += (dampTheta - spherical.theta) * dampingFactor
      spherical.phi += (dampPhi - spherical.phi) * dampingFactor
      spherical.radius += (dampRadius - spherical.radius) * dampingFactor
      if (
        Math.abs(dampTheta - spherical.theta) < 1e-5 &&
        Math.abs(dampPhi - spherical.phi) < 1e-5 &&
        Math.abs(dampRadius - spherical.radius) < 1e-3
      ) {
        spherical.theta = dampTheta
        spherical.phi = dampPhi
        spherical.radius = dampRadius
        dampActive = false
      }
      changed = true
    }

    if (changed) {
      applyCameraFromSpherical()
    }
    // 空闲帧不再每帧 lookAt：避免和指针状态抢姿态；拖/转时已实时 orient
    return changed
  }

  /** 外部改完 position/target 后：读球坐标并写回（可能轻微修正） */
  function syncFromCamera() {
    snapTargetToSurface()
    readSphericalFromCamera()
    applyCameraFromSpherical()
  }

  /** 只读入球坐标，不重写 camera（飞镜头落点用，避免二次跳变） */
  function adoptFromCamera() {
    readSphericalFromCamera()
  }

  /**
   * 当前机位状态（供平滑插值）
   * @returns {{ tx:number, ty:number, tz:number, radius:number, phi:number, theta:number }}
   */
  function getViewState() {
    readSphericalFromCamera()
    return {
      tx: target.x,
      ty: target.y,
      tz: target.z,
      radius: spherical.radius,
      phi: spherical.phi,
      theta: spherical.theta,
    }
  }

  /**
   * 从目标点+相机位置推状态（不永久改当前姿态）
   * @param {THREE.Vector3} targetVec
   * @param {THREE.Vector3} posVec
   */
  function viewStateFromPose(targetVec, posVec) {
    const savedT = target.clone()
    const savedP = camera.position.clone()
    const saved = {
      radius: spherical.radius,
      phi: spherical.phi,
      theta: spherical.theta,
    }
    target.copy(targetVec)
    camera.position.copy(posVec)
    readSphericalFromCamera()
    const state = {
      tx: target.x,
      ty: target.y,
      tz: target.z,
      radius: spherical.radius,
      phi: spherical.phi,
      theta: spherical.theta,
    }
    target.copy(savedT)
    camera.position.copy(savedP)
    spherical.radius = saved.radius
    spherical.phi = saved.phi
    spherical.theta = saved.theta
    return state
  }

  /**
   * 套用机位状态（复位/飞镜头插值的每一帧）
   * @param {{ tx:number, ty:number, tz:number, radius:number, phi:number, theta:number }} s
   */
  function setViewState(s) {
    target.set(s.tx, s.ty, s.tz)
    const len = target.length()
    if (len > EPS) {
      // 插值中点保持在球壳附近
      const r = THREE.MathUtils.clamp(len, EARTH_RADIUS_KM * 0.88, EARTH_RADIUS_KM * 1.04)
      if (Math.abs(len - r) > 1e-3) target.multiplyScalar(r / len)
    } else {
      target.set(0, 0, EARTH_RADIUS_KM)
    }
    spherical.radius = THREE.MathUtils.clamp(s.radius, minDistance, maxDistance)
    spherical.phi = THREE.MathUtils.clamp(s.phi, minPolar, maxPolar)
    spherical.theta = s.theta
    spherical.makeSafe()
    applyCameraFromSpherical()
  }

  function setDistance(dist) {
    spherical.radius = THREE.MathUtils.clamp(dist, minDistance, maxDistance)
    if (state === 'rotate' || state === 'dolly') rotRadius0 = spherical.radius
    applyCameraFromSpherical()
  }

  function getDistance() {
    return camera.position.distanceTo(target)
  }

  /**
   * 航向 0–360°：0 = 正北朝上（相机在目标南侧俯视）
   * 内部 theta=π 对应 heading=0
   */
  function getAzimuthDeg() {
    readSphericalFromCamera()
    let deg = THREE.MathUtils.radToDeg(spherical.theta - Math.PI)
    deg = ((deg % 360) + 360) % 360
    return deg
  }

  function setAzimuthDeg(deg) {
    readSphericalFromCamera()
    const d = ((Number(deg) % 360) + 360) % 360
    spherical.theta = THREE.MathUtils.degToRad(d) + Math.PI
    applyCameraFromSpherical()
  }

  function dispose() {
    endPointerDrag()
    touches.clear()
    domElement.removeEventListener('pointerdown', onPointerDown)
    domElement.removeEventListener('pointermove', onPointerMove)
    domElement.removeEventListener('pointerup', onPointerUp)
    domElement.removeEventListener('pointercancel', onPointerUp)
    domElement.removeEventListener('lostpointercapture', onLostPointerCapture)
    domElement.removeEventListener('wheel', onWheel)
    domElement.removeEventListener('contextmenu', onContextMenu)
    domElement.removeEventListener('touchstart', onTouchStart)
    domElement.removeEventListener('touchmove', onTouchMove)
    domElement.removeEventListener('touchend', onTouchEnd)
    domElement.removeEventListener('touchcancel', onTouchEnd)
  }

  // 初始同步
  snapTargetToSurface()
  readSphericalFromCamera()
  applyCameraFromSpherical()

  return {
    target,
    get enabled() {
      return true
    },
    set enabled(_v) {
      /* 保留兼容 */
    },
    get minDistance() {
      return minDistance
    },
    set minDistance(v) {
      minDistance = v
    },
    get maxDistance() {
      return maxDistance
    },
    set maxDistance(v) {
      maxDistance = v
    },
    get minPolarAngle() {
      return minPolar
    },
    set minPolarAngle(v) {
      minPolar = v
    },
    get maxPolarAngle() {
      return maxPolar
    },
    set maxPolarAngle(v) {
      maxPolar = v
    },
    get enableDamping() {
      return enableDamping
    },
    set enableDamping(v) {
      enableDamping = !!v
    },
    get dampingFactor() {
      return dampingFactor
    },
    set dampingFactor(v) {
      dampingFactor = v
    },
    get autoRotate() {
      return autoRotate
    },
    set autoRotate(v) {
      autoRotate = !!v
    },
    get autoRotateSpeed() {
      return autoRotateSpeed
    },
    set autoRotateSpeed(v) {
      autoRotateSpeed = v
    },
    get rotateSpeed() {
      return rotateSpeed
    },
    set rotateSpeed(v) {
      rotateSpeed = v
    },
    get panSpeed() {
      return panSpeed
    },
    set panSpeed(v) {
      panSpeed = v
    },
    get zoomSpeed() {
      return zoomSpeed
    },
    set zoomSpeed(v) {
      zoomSpeed = v
    },
    // 兼容旧代码字段（无实际 Orbit 鼠标映射）
    mouseButtons: {},
    touches: {},
    screenSpacePanning: true,
    enablePan: true,
    enableZoom: true,
    enableRotate: true,

    update,
    addEventListener,
    removeEventListener,
    dispose,
    setDistance,
    getDistance,
    getAzimuthDeg,
    setAzimuthDeg,
    getViewState,
    setViewState,
    viewStateFromPose,
    adoptFromCamera,
    syncFromCamera,
    applyCameraFromSpherical,
    readSphericalFromCamera,
    orientCamera,
  }
}
