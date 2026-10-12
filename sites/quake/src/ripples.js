/**
 * 近 30 天 / 名震：平面 CSS 涟漪（默认唯一风格）
 * 干净圆点 + 实心环外放；颜色=深度；半径=震源球×2（直径×2）
 *
 * 出现：root scale 0→1 + core 淡入，再开环脉冲
 * 环：timeline 正 delay + repeat:-1（禁止负 delay 中途起跳）
 * 筛选：opts.minMag（30 天默认 M≥5）+ maxRipples 大震优先
 */
import * as THREE from 'three'
import gsap from 'gsap'
import { project } from './coords.js'
import { colorByDepth } from './depthColor.js'
import { radiusForQuake, SIZE_MODE_MAG } from './quakes.js'

/** 名震默认只给主震等少数；30 天要「有球就有光」，别只亮最近 10 个 */
const MAX_RIPPLES_DEFAULT = 12
/** 30 天全量上限（USGS limit 500；东亚 M≥4 通常远少于此） */
const MAX_RIPPLES_LIVE = 200

/**
 * @param {number} mag
 * @param {string} [sizeMode]
 */
export function rippleRadiusKm(mag, sizeMode = SIZE_MODE_MAG) {
  return radiusForQuake(mag, sizeMode, 'live') * 2.2
}

/**
 * @param {number} mag
 */
export function ripplePeriodSec(mag) {
  const m = Math.max(4, mag ?? 4.5)
  return 2.8 + Math.min(2.6, (m - 4) * 0.55)
}

/** CSS border-radius:100% 实心圆贴图（窄抗锯齿） */
let _softDiscTex = null
function softDiscTexture() {
  if (_softDiscTex) return _softDiscTex
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.88, 'rgba(255,255,255,1)')
  g.addColorStop(0.96, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  _softDiscTex = new THREE.CanvasTexture(c)
  _softDiscTex.colorSpace = THREE.SRGBColorSpace
  _softDiscTex.needsUpdate = true
  return _softDiscTex
}

function makeFlatSpriteMat(color, map, opacity) {
  return new THREE.MeshBasicMaterial({
    color: color.clone(),
    map,
    transparent: true,
    opacity: opacity ?? 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    alphaTest: 0.01,
  })
}

export class RippleLayer {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} [renderer] 保留参数兼容调用方
   * @param {THREE.Camera} [camera]
   */
  constructor(scene, renderer, camera) {
    this.scene = scene
    this.renderer = renderer || null
    this.camera = camera || null
    this.group = new THREE.Group()
    this.group.name = 'quake-ripples'
    this.scene.add(this.group)
    /** @type {Array<object>} */
    this.items = []
    this.enabled = false
    this.exaggeration = 2
    this.paletteLo = 0
    this.paletteHi = 1
    this.sizeMode = SIZE_MODE_MAG
    /** @type {'history'|'live'} 与震源球点径档案对齐 */
    this.sizeProfile = 'live'
  }

  /**
   * @param {THREE.Camera} camera
   */
  setCamera(camera) {
    this.camera = camera
  }

  /**
   * @param {number} ex
   */
  setExaggeration(ex) {
    this.exaggeration = ex
    for (const it of this.items) {
      const q = it.quake
      if (!q || !it.root) continue
      const p = project(q.lon, q.lat, q.depthKm, this.exaggeration)
      it.root.position.set(p.x, p.y, p.z)
    }
  }

  /**
   * @param {number} lo
   * @param {number} hi
   */
  setPaletteWindow(lo, hi) {
    this.paletteLo = Math.min(lo, hi)
    this.paletteHi = Math.max(lo, hi)
    const c = new THREE.Color()
    for (const it of this.items) {
      const q = it.quake
      if (!q) continue
      colorByDepth(q.depthKm ?? 0, c, this.paletteLo, this.paletteHi)
      this._applyColor(it, c)
    }
  }

  /**
   * @param {object} it
   * @param {THREE.Color} c
   */
  _applyColor(it, c) {
    for (const m of it.meshes || []) {
      if (m.material?.color) m.material.color.copy(c)
    }
  }

  _killTweens() {
    for (const it of this.items) {
      if (it.tweens) {
        for (const t of it.tweens) t.kill?.()
      }
      for (const m of it.meshes || []) {
        gsap.killTweensOf(m.scale)
        if (m.material) gsap.killTweensOf(m.material)
      }
    }
  }

  clear() {
    this._killTweens()
    for (const it of this.items) {
      if (it.root) {
        this.group.remove(it.root)
        it.root.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose?.()
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
            else obj.material.dispose?.()
          }
        })
      }
    }
    this.items = []
  }

    /**
   * @param {Array<object>} quakes
   * @param {number} [exaggeration]
   * @param {{
   *   paletteLo?: number,
   *   paletteHi?: number,
   *   sizeMode?: string,
   *   sizeProfile?: 'history'|'live',
   *   maxRipples?: number,
   *   minMag?: number,
   *   fadeIn?: number | false,
   * }} [opts]
   */
  setEvents(quakes, exaggeration, opts = {}) {
    if (exaggeration != null) this.exaggeration = exaggeration
    if (opts.paletteLo != null) this.paletteLo = opts.paletteLo
    if (opts.paletteHi != null) this.paletteHi = opts.paletteHi
    if (opts.sizeMode != null) this.sizeMode = opts.sizeMode
    if (opts.sizeProfile === 'history' || opts.sizeProfile === 'live') {
      this.sizeProfile = opts.sizeProfile
    }

    this.clear()
    if (!this.enabled || !quakes?.length) return

    // 太小的点不给涟漪：看不清还占 draw call
    const minMag = Number.isFinite(opts.minMag) ? opts.minMag : 0
    let list = quakes
    if (minMag > 0) {
      list = quakes.filter((q) => (q.mag ?? 0) >= minMag)
    }
    if (!list.length) return

    // 大震优先（不是只按时间），再截 cap
    const sorted = [...list].sort((a, b) => {
      const dm = (b.mag ?? 0) - (a.mag ?? 0)
      if (Math.abs(dm) > 0.05) return dm
      const ta = a.time ? Date.parse(a.time) : 0
      const tb = b.time ? Date.parse(b.time) : 0
      return tb - ta
    })
    const cap = Math.max(
      1,
      Math.floor(opts.maxRipples ?? MAX_RIPPLES_DEFAULT),
    )
    const pick = sorted.slice(0, Math.min(cap, MAX_RIPPLES_LIVE, sorted.length))
    const tmp = new THREE.Color()
    const profile = this.sizeProfile === 'history' ? 'history' : 'live'
    // 默认较长淡入；false/0 = 立刻
    const fadeIn =
      opts.fadeIn === false ? 0 : Math.max(0, Number(opts.fadeIn ?? 1.4))

    pick.forEach((q, i) => {
      colorByDepth(q.depthKm ?? 0, tmp, this.paletteLo, this.paletteHi)
      const color = tmp.clone()
      const ballR = radiusForQuake(q.mag, this.sizeMode, profile)
      const p = project(q.lon, q.lat, q.depthKm, this.exaggeration)
      const root = new THREE.Group()
      root.position.set(p.x, p.y, p.z)
      // 整体从 0 放大，肉眼能感到「长出来」
      root.scale.setScalar(fadeIn > 0 ? 0.001 : 1)
      this.group.add(root)

      /** @type {object} */
      const item = {
        quake: q,
        root,
        meshes: [],
        ballR,
        tweens: [],
        faceCam: true,
      }
      this._buildPulse(item, color, ballR, i, fadeIn)
      this.items.push(item)
    })
  }

  /**
   * 平面脉冲：先整体淡入+放大，再开始环扩散（禁止负 delay 中途起跳）
   * @param {object} item
   * @param {THREE.Color} color
   * @param {number} ballR
   * @param {number} idx
   * @param {number} [fadeInSec=0]
   */
  _buildPulse(item, color, ballR, idx, fadeInSec = 0) {
    const discMap = softDiscTexture()
    const coreR = Math.max(3, ballR * 1.06 * 2)
    const ringScaleEnd = 1.75
    const ringDur = 2.2
    // 仅正 delay；禁止负数（负数 = 立刻跳到脉冲中段 =「砰」）
    const ringStagger = [0, 0.55, 1.1]
    const fade = Math.max(0, fadeInSec)
    const pulseStart = fade > 0 ? fade + 0.15 : 0
    const staggerItem = (idx % 7) * 0.08

    const coreGeo = new THREE.PlaneGeometry(2, 2)
    const coreMat = makeFlatSpriteMat(color, discMap, 0)
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.scale.set(coreR, coreR, 1)
    core.position.z = 0.2
    item.root.add(core)
    item.meshes.push(core)

    /** @type {Array<{ s:number, o:number, mesh: THREE.Mesh, mat: THREE.MeshBasicMaterial }>} */
    const rings = []
    for (let k = 0; k < 3; k++) {
      const ringGeo = new THREE.PlaneGeometry(2, 2)
      const ringMat = makeFlatSpriteMat(color, discMap, 0)
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.scale.set(coreR, coreR, 1)
      ring.position.z = -k * 0.05
      item.root.add(ring)
      item.meshes.push(ring)
      rings.push({ s: coreR, o: 0, mesh: ring, mat: ringMat })
    }

    // —— 阶段 1：整体「长出来」（scale 0→1 + 核透明度）——
    if (fade > 0) {
      const appear = { t: 0 }
      item.tweens.push(
        gsap.to(appear, {
          t: 1,
          duration: fade,
          delay: staggerItem,
          ease: 'power2.out',
          onUpdate: () => {
            const t = appear.t
            item.root.scale.setScalar(Math.max(0.001, t))
            coreMat.opacity = t
          },
          onComplete: () => {
            item.root.scale.setScalar(1)
            coreMat.opacity = 1
          },
        }),
      )
    } else {
      item.root.scale.setScalar(1)
      coreMat.opacity = 1
    }

    // —— 阶段 2：环脉冲 timeline（可 kill；无负 delay）——
    for (let k = 0; k < rings.length; k++) {
      const st = rings[k]
      const apply = () => {
        st.mesh.scale.set(st.s, st.s, 1)
        st.mat.opacity = Math.max(0, st.o)
      }
      apply()
      const tl = gsap.timeline({
        delay: pulseStart + staggerItem + ringStagger[k],
        repeat: -1,
      })
      tl.fromTo(
        st,
        { s: coreR, o: 0 },
        {
          s: coreR * ringScaleEnd,
          o: 0.7,
          duration: ringDur * 0.45,
          ease: 'power1.out',
          onUpdate: apply,
        },
      )
      tl.to(st, {
        o: 0,
        duration: ringDur * 0.55,
        ease: 'power2.in',
        onUpdate: apply,
      })
      item.tweens.push(tl)
    }
  }

  /**
   * @param {boolean} on
   */
  setEnabled(on) {
    this.enabled = !!on
    this.group.visible = this.enabled
    if (!this.enabled) this.clear()
  }

  /**
   * @param {number} _tSec
   */
  tick(_tSec) {
    if (!this.enabled || !this.camera) return
    for (const it of this.items) {
      if (it.faceCam && it.root) {
        it.root.quaternion.copy(this.camera.quaternion)
      }
    }
  }

  dispose() {
    this.clear()
    this.scene.remove(this.group)
  }
}
