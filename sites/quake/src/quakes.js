import * as THREE from 'three'
import { project } from './coords.js'
import { colorByDepth } from './depthColor.js'

const DEFAULT_EXAGGERATION = 2
/** 历史点多：低分段；高分段只适合名震/少量 live */
const SPHERE_SEGMENTS_HISTORY = 6
const SPHERE_SEGMENTS_LIVE = 8
/** InstancedMesh 默认透明度（模式切换动画以此为满值） */
export const QUAKE_MESH_OPACITY = 0.92

/** 共享球几何：避免每次 rebuild 新建/销毁 Geometry（主线程尖刺） */
let sharedGeoHistory = null
let sharedGeoLive = null

function sharedSphereGeo(profile) {
  if (profile === 'live') {
    if (!sharedGeoLive) {
      sharedGeoLive = new THREE.SphereGeometry(1, SPHERE_SEGMENTS_LIVE, SPHERE_SEGMENTS_LIVE)
      sharedGeoLive.userData.shared = true
    }
    return sharedGeoLive
  }
  if (!sharedGeoHistory) {
    sharedGeoHistory = new THREE.SphereGeometry(
      1,
      SPHERE_SEGMENTS_HISTORY,
      SPHERE_SEGMENTS_HISTORY,
    )
    sharedGeoHistory.userData.shared = true
  }
  return sharedGeoHistory
}

/** 是否可 dispose geometry（共享球禁止 dispose） */
export function canDisposeQuakeGeometry(geo) {
  return !!(geo && !geo.userData?.shared)
}

/** 点大小模式：按震级 / 全部等大 */
export const SIZE_MODE_MAG = 'mag'
export const SIZE_MODE_UNIFORM = 'uniform'

/**
 * 等大模式统一半径（约等于旧曲线里 M5.5 量级，略放大好认断层带）
 */
export const UNIFORM_RADIUS = 2.6

/**
 * 历史模式按震级半径
 * 约：M4≈1.0 · M5≈3.2 · M6≈7.5 · M7≈14 · M8≈22 · M9≈30
 * @param {number} mag
 */
export function magScale(mag) {
  const m = Math.max(3.5, Math.min(9.5, mag ?? 4.5))
  const t = Math.max(0, Math.min(1, (m - 4) / 5))
  return 1.0 + Math.pow(t, 1.45) * 29
}

/**
 * 近30天 / 名震：点径整体放大，且 4→7 级差距拉得很开
 * 约：M4≈6 · M5≈22 · M6≈55 · M7≈120 · M8≈200
 * @param {number} mag
 */
export function magScaleLive(mag) {
  const m = Math.max(3.5, Math.min(9.5, mag ?? 4.5))
  const t = Math.max(0, Math.min(1, (m - 4) / 5))
  // 更高幂次：小震仍可见，大震碾压
  return 6 + Math.pow(t, 1.9) * 210
}

/** 近30天 / 名震等大模式统一半径（比历史大很多） */
export const UNIFORM_RADIUS_LIVE = 14

/**
 * @param {number} mag
 * @param {string} [sizeMode]
 * @param {'history'|'live'} [profile='history']
 */
export function radiusForQuake(mag, sizeMode = SIZE_MODE_MAG, profile = 'history') {
  if (sizeMode === SIZE_MODE_UNIFORM) {
    return profile === 'live' ? UNIFORM_RADIUS_LIVE : UNIFORM_RADIUS
  }
  return profile === 'live' ? magScaleLive(mag) : magScale(mag)
}

/**
 * Instanced spheres: color by depth, scale by magnitude (or uniform).
 * @param {Array<{ lon: number, lat: number, depthKm: number, mag: number }>} quakes
 * @param {number} [exaggeration=2]
 * @param {number} [minMag=4.5]
 * @param {number} [paletteLo=0] 色条窗左 0..1
 * @param {number} [paletteHi=1] 色条窗右 0..1
 * @param {string} [sizeMode='mag']
 * @param {'history'|'live'} [profile='history']
 * @returns {THREE.InstancedMesh}
 */
export function buildQuakeInstances(
  quakes,
  exaggeration = DEFAULT_EXAGGERATION,
  minMag = 4.5,
  paletteLo = 0,
  paletteHi = 1,
  sizeMode = SIZE_MODE_MAG,
  profile = 'history',
) {
  const count = quakes.length
  const isLive = profile === 'live'
  const geo = sharedSphereGeo(isLive ? 'live' : 'history')
  // 历史大量点：不透明 + depthTest，才能被球壳深度墙挡住背面
  const mat = new THREE.MeshBasicMaterial({
    transparent: isLive,
    opacity: isLive ? QUAKE_MESH_OPACITY : 1,
    depthWrite: true,
    depthTest: true,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count))
  mesh.name = 'hypocenters'
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.userData.quakes = quakes
  mesh.userData.exaggeration = exaggeration
  mesh.userData.minMag = minMag
  mesh.userData.paletteLo = paletteLo
  mesh.userData.paletteHi = paletteHi
  mesh.userData.sizeMode = sizeMode
  mesh.userData.profile = profile === 'live' ? 'live' : 'history'

  applyInstances(
    mesh,
    quakes,
    exaggeration,
    minMag,
    paletteLo,
    paletteHi,
    sizeMode,
    mesh.userData.profile,
  )
  mesh.frustumCulled = true
  return mesh
}

/**
 * Perlin 风格噪声溶解（对齐 three 官方 RenderTransitionPass + Perlin 贴图思路，
 * 但做在点场材质上，不必整屏双场景 Composer）。
 * progress 0→1：out 被噪声「咬掉」；in 从噪声里渗出。
 * @param {THREE.InstancedMesh} mesh
 * @param {'in' | 'out'} mode
 */
export function enableQuakeDissolve(mesh, mode = 'out') {
  const mat = mesh.material
  if (!mat || Array.isArray(mat)) return
  mesh.userData.dissolveMode = mode
  mesh.userData.dissolveProgress =
    mesh.userData.dissolveProgress ?? (mode === 'in' ? 0 : 0)

  if (mat.userData?.dissolveReady) {
    setQuakeDissolve(mesh, mesh.userData.dissolveProgress, mode)
    return
  }

  // 硬 discard 溶解：历史保持不透明 + 写深度（禁 transparent 翻转 → 结束瞬间闪亮）
  // live 本来半透明，只保持其透明标志，depthWrite 始终开，避免结束时再切
  const isLive = mesh.userData?.profile === 'live'
  mat.transparent = isLive
  mat.depthWrite = true
  mat.opacity = isLive ? QUAKE_MESH_OPACITY : 1
  mat.userData.dissolveReady = true
  mat.userData.dissolveMode = mode
  mat.customProgramCacheKey = () => 'eq-quake-perlin-dissolve-v3'

  mat.onBeforeCompile = (shader) => {
    const modeNow = mesh.userData.dissolveMode === 'in' ? 1 : 0
    const prog = mesh.userData.dissolveProgress ?? 0
    shader.uniforms.uDissolveProgress = { value: prog }
    shader.uniforms.uDissolveInvert = { value: modeNow }
    shader.uniforms.uDissolveEdge = { value: 0.14 }
    shader.uniforms.uDissolveActive = { value: 1 }
    // 球坐标世界尺度 ~数千 km，噪声频率相应放小
    shader.uniforms.uDissolveScale = { value: 0.00085 }
    mat.userData.dissolveUniforms = shader.uniforms

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
#include <common>
varying vec3 vDissolveWorld;
`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
  vDissolveWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vDissolveWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
#include <common>
varying vec3 vDissolveWorld;
uniform float uDissolveProgress;
uniform float uDissolveInvert;
uniform float uDissolveEdge;
uniform float uDissolveActive;
uniform float uDissolveScale;

// 值噪声 + fbm，观感接近官方 transition Perlin 遮罩
float eqHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float eqNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(eqHash(i), eqHash(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(eqHash(i + vec3(0.0, 1.0, 0.0)), eqHash(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(eqHash(i + vec3(0.0, 0.0, 1.0)), eqHash(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(eqHash(i + vec3(0.0, 1.0, 1.0)), eqHash(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}
float eqFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * eqNoise(p);
    p = p * 2.02 + vec3(17.1, 9.3, 3.7);
    a *= 0.5;
  }
  return v;
}
`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
#include <opaque_fragment>
if (uDissolveActive > 0.5) {
  float n = eqFbm(vDissolveWorld * uDissolveScale);
  n = clamp(n, 0.0, 1.0);
  float p = uDissolveProgress;
  float e = max(0.02, uDissolveEdge);
  // out: p↑ 被噪声咬掉；in: p↑ 从噪声里渗出
  float aMask = (uDissolveInvert > 0.5)
    ? smoothstep(n - e, n + e, p)
    : (1.0 - smoothstep(n - e, n + e, p));
  // 硬 discard 为主，避免半透明叠层整体发亮
  if (aMask < 0.5) discard;
  gl_FragColor.a = max(gl_FragColor.a, 0.99);
}
`,
      )
  }

  mat.needsUpdate = true
  mesh.userData.dissolveProgress = mode === 'in' ? 0 : 0
  mesh.userData.dissolveMode = mode
  setQuakeDissolve(mesh, mesh.userData.dissolveProgress, mode)
}

/**
 * @param {THREE.InstancedMesh | null | undefined} mesh
 * @param {number} progress 0..1
 * @param {'in' | 'out'} [mode]
 */
export function setQuakeDissolve(mesh, progress, mode) {
  if (!mesh?.material || Array.isArray(mesh.material)) return
  const mat = mesh.material
  const p = Math.min(1, Math.max(0, progress))
  mesh.userData.dissolveProgress = p
  if (mode === 'in' || mode === 'out') {
    mesh.userData.dissolveMode = mode
    mat.userData.dissolveMode = mode
  }
  const u = mat.userData?.dissolveUniforms
  if (!u) return
  u.uDissolveProgress.value = p
  if (mode === 'in' || mode === 'out') {
    u.uDissolveInvert.value = mode === 'in' ? 1 : 0
  }
  u.uDissolveActive.value = 1
}

/**
 * 转场结束：只关溶解 uniform，不改 transparent / depthWrite / needsUpdate。
 * 改材质标志会触发重编译或透明/不透明通道切换 → 动画结束「闪一下亮」。
 * 硬 discard 在 uDissolveActive=0 时与常显一致。
 */
export function disableQuakeDissolve(mesh) {
  if (!mesh?.material || Array.isArray(mesh.material)) return
  const mat = mesh.material
  const u = mat.userData?.dissolveUniforms
  if (u) {
    u.uDissolveActive.value = 0
    u.uDissolveProgress.value = 1
    // 保证 in 结束时遮罩全开（防边缘 residual）
    if (mesh.userData?.dissolveMode === 'in') {
      u.uDissolveInvert.value = 1
    }
  }
  mesh.userData.dissolveProgress = 1
  // 故意不碰 mat.transparent / depthWrite / needsUpdate
}

/**
 * 单实例缩放（悬停放大 / 恢复）。base scale 由 mag 重算。
 * @param {THREE.InstancedMesh} mesh
 * @param {number} index
 * @param {number} mul 相对默认半径的倍数
 */
export function setQuakeInstanceScaleMul(mesh, index, mul) {
  if (!mesh || index == null || index < 0) return
  const quakes = mesh.userData?.quakes
  if (!Array.isArray(quakes) || !quakes[index]) return
  const q = quakes[index]
  const exag = mesh.userData.exaggeration ?? DEFAULT_EXAGGERATION
  const sizeMode = mesh.userData.sizeMode ?? SIZE_MODE_MAG
  const profile = mesh.userData.profile ?? 'history'
  const minMag = mesh.userData.minMag ?? 0
  const mag = q.mag ?? 4.5
  if (mag < minMag) return
  const base = radiusForQuake(mag, sizeMode, profile)
  const s = base * Math.max(0.01, mul)
  const { x, y, z } = project(q.lon, q.lat, q.depthKm ?? 0, exag)
  const dummy = new THREE.Object3D()
  dummy.position.set(x, y, z)
  dummy.scale.setScalar(s)
  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
  mesh.instanceMatrix.needsUpdate = true
}

/**
 * Rebuild instance matrices after exaggeration / min-mag / palette / sizeMode change.
 * @param {THREE.InstancedMesh} mesh
 * @param {number} [exaggeration]
 * @param {number} [minMag]
 * @param {number} [paletteLo]
 * @param {number} [paletteHi]
 * @param {string} [sizeMode]
 * @param {'history'|'live'} [profile]
 */
export function updateQuakeInstances(
  mesh,
  exaggeration,
  minMag,
  paletteLo,
  paletteHi,
  sizeMode,
  profile,
) {
  const quakes = mesh.userData.quakes
  if (!Array.isArray(quakes)) return

  if (exaggeration != null) mesh.userData.exaggeration = exaggeration
  if (minMag != null) mesh.userData.minMag = minMag
  if (paletteLo != null) mesh.userData.paletteLo = paletteLo
  if (paletteHi != null) mesh.userData.paletteHi = paletteHi
  if (sizeMode != null) mesh.userData.sizeMode = sizeMode
  if (profile != null) mesh.userData.profile = profile

  applyInstances(
    mesh,
    quakes,
    mesh.userData.exaggeration,
    mesh.userData.minMag,
    mesh.userData.paletteLo ?? 0,
    mesh.userData.paletteHi ?? 1,
    mesh.userData.sizeMode ?? SIZE_MODE_MAG,
    mesh.userData.profile ?? 'history',
  )
}

function applyInstances(
  mesh,
  quakes,
  exaggeration,
  minMag,
  paletteLo = 0,
  paletteHi = 1,
  sizeMode = SIZE_MODE_MAG,
  profile = 'history',
) {
  const count = quakes.length
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const q = quakes[i]
    const mag = q.mag ?? 4.5
    const visible = mag >= minMag
    const { x, y, z } = project(q.lon, q.lat, q.depthKm ?? 0, exaggeration)
    const s = visible ? radiusForQuake(mag, sizeMode, profile) : 0
    dummy.position.set(x, y, z)
    dummy.scale.setScalar(s)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    colorByDepth(q.depthKm ?? 0, color, paletteLo, paletteHi)
    mesh.setColorAt(i, color)
  }

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

export { DEFAULT_EXAGGERATION }
