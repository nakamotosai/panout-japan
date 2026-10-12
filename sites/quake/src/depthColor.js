import * as THREE from 'three'

/**
 * Depth → color（tactical 唯一色板：蓝 → 黄 → 橙 → 红，越深越红）
 * 口径铁律：色值逐字冻结，禁改映射与端点。
 */
/** @type {{ t: number, c: THREE.Color }[]} */
let STOPS = []
const PALETTES = {
  tactical: [
    { t: 0, hex: 0x076678 },
    { t: 0.2, hex: 0x458588 },
    { t: 0.4, hex: 0x83a598 },
    { t: 0.58, hex: 0xd79921 },
    { t: 0.75, hex: 0xfe8019 },
    { t: 0.9, hex: 0xfb4934 },
    { t: 1, hex: 0x9d0006 },
  ],
  // 旧主题别名：值与 tactical 逐字一致，仅兼容旧 localStorage
  gruvbox: [
    { t: 0, hex: 0x076678 },
    { t: 0.2, hex: 0x458588 },
    { t: 0.4, hex: 0x83a598 },
    { t: 0.58, hex: 0xd79921 },
    { t: 0.75, hex: 0xfe8019 },
    { t: 0.9, hex: 0xfb4934 },
    { t: 1, hex: 0x9d0006 },
  ],
}
/** CSS 彩条用（与 STOPS 同步） */
const LEGEND_CSS = {
  tactical:
    'linear-gradient(90deg,#076678 0%,#458588 22%,#83a598 40%,#d79921 58%,#fe8019 76%,#fb4934 90%,#9d0006 100%)',
  gruvbox:
    'linear-gradient(90deg,#076678 0%,#458588 22%,#83a598 40%,#d79921 58%,#fe8019 76%,#fb4934 90%,#9d0006 100%)',
}
let activePalette = 'tactical'
function buildStops(key) {
  const src = PALETTES[key] || PALETTES.tactical
  return src.map(({ t, hex }) => ({ t, c: new THREE.Color(hex) }))
}
STOPS = buildStops('tactical')
/**
 * 切换深度色板（现仅 tactical，保留 API）
 * @param {string} [_name]
 */
export function setDepthPalette(_name) {
  activePalette = 'tactical'
  STOPS = buildStops(activePalette)
  try {
    document.documentElement.style.setProperty(
      '--eq-legend-grad',
      LEGEND_CSS.tactical,
    )
  } catch {
    /* ignore SSR */
  }
}

export function getDepthPalette() {
  return activePalette
}

/** Depth (km) that maps to full red; deeper clamps to max */
const MAX_DEPTH_KM = 400

/**
 * 深度 → 色条位置 0..1
 * @param {number} depthKm
 */
export function depthToT(depthKm) {
  const d = Math.max(0, depthKm || 0)
  return Math.min(1, Math.pow(d / MAX_DEPTH_KM, 0.65))
}

/**
 * 色条位置 0..1 → 深度 km
 * @param {number} t
 */
export function tToDepth(t) {
  const u = Math.min(1, Math.max(0, t))
  return MAX_DEPTH_KM * Math.pow(u, 1 / 0.65)
}

/**
 * @param {number} t
 * @param {THREE.Color} out
 */
function samplePalette(t, out) {
  const u = Math.min(1, Math.max(0, t))
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (u <= b.t) {
      const k = (u - a.t) / (b.t - a.t || 1)
      return out.copy(a.c).lerp(b.c, k)
    }
  }
  return out.copy(STOPS[STOPS.length - 1].c)
}

/**
 * 深度上色。可选把色条裁成 [paletteLo, paletteHi] 再铺满整段深度。
 * @param {number} depthKm
 * @param {THREE.Color} [out]
 * @param {number} [paletteLo=0]
 * @param {number} [paletteHi=1]
 * @returns {THREE.Color}
 */
export function colorByDepth(
  depthKm,
  out = new THREE.Color(),
  paletteLo = 0,
  paletteHi = 1,
) {
  const tFull = depthToT(depthKm)
  const lo = Math.min(paletteLo, paletteHi)
  const hi = Math.max(paletteLo, paletteHi)
  const span = Math.max(1e-6, hi - lo)
  const t = lo + tFull * span
  return samplePalette(t, out)
}

// 默认写一次 CSS 变量
setDepthPalette('tactical')

export { MAX_DEPTH_KM, LEGEND_CSS }
