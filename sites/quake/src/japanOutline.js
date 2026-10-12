/**
 * 全球镂空岸线 / 国界
 *
 * - CPU：按顶点拆 20° 瓦片（禁整环 mid）
 * - GPU：只建「地平线以上」的格（limb）；**不做焦点锥硬裁**（远眺截断闪的根因）
 * - 段几何一次建满，**不按相机方位切 frontRuns**（截断口会随飞镜乱跳）
 * - 背面穿帮靠球壳 depth 遮挡；进屏 build、离屏 dispose
 * - **禁止**每次相机微动整表重建（自转卡顿元凶）
 */
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { project, EARTH_RADIUS_KM } from './coords.js'
import {
  viewConeRad,
  isTileInView,
  camRadial,
  cameraAltitudeKm,
} from './viewCull.js'

const EDGE = 0xf5f0e8
const LINE_WIDTH_JAPAN_PX = 1.75
const LINE_WIDTH_CONTEXT_PX = 0.95
const SURFACE_ALT_KM = 4
const TILE_DEG = 20
const EDGE_FRONT_DOT_MIN = 0.18

const JAPAN_COAST = {
  minLon: 128.0,
  maxLon: 146.2,
  minLat: 24.0,
  maxLat: 45.8,
}

/** @type {LineMaterial[]} */
const outlineMats = []

export function setOutlineResolution(w, h) {
  const ww = Math.max(1, w)
  const hh = Math.max(1, h)
  for (const m of outlineMats) m.resolution.set(ww, hh)
}

export function setOutlineColor(hex) {
  for (const m of outlineMats) m.color.setHex(hex)
}

export class OutlineLayer {
  constructor() {
    this.group = new THREE.Group()
    this.group.name = 'outline-layer'
    /** @type {Map<string, TileRec>} */
    this.tiles = new Map()
    this.matJapan = null
    this.matContext = null
    this._resW = 1
    this._resH = 1
    this._lastCamKey = ''
    this._builtCount = 0
    this._vx = 0
    this._vy = 0
    this._vz = 1
  }

  /**
   * @param {object} geojson
   * @param {{ width?: number, height?: number }} [screen]
   */
  load(geojson, screen = {}) {
    this.disposeAllMeshes()
    this.tiles.clear()
    outlineMats.length = 0

    this._resW = Math.max(1, screen.width || window.innerWidth || 1)
    this._resH = Math.max(1, screen.height || window.innerHeight || 1)

    this.matJapan = makeLineMat(LINE_WIDTH_JAPAN_PX, this._resW, this._resH)
    this.matContext = makeLineMat(LINE_WIDTH_CONTEXT_PX, this._resW, this._resH)
    this.matContext.opacity = 0.78
    this.matJapan.opacity = 0.95
    outlineMats.push(this.matJapan, this.matContext)

    for (const feature of geojson.features || []) {
      const kind = feature.properties?.kind || 'coastline'
      for (const ring of ringsFromGeometry(feature.geometry)) {
        if (!ring || ring.length < 2) continue
        const isJapanCoast = kind === 'coastline' && ringLooksLikeJapan(ring)
        splitRingIntoTiles(ring, this.tiles, { isJapanCoast, kind })
      }
    }

    for (const tile of this.tiles.values()) {
      const p = project(tile.lonC, tile.latC, 0, 1)
      const len = Math.hypot(p.x, p.y, p.z) || 1
      tile.nx = p.x / len
      tile.ny = p.y / len
      tile.nz = p.z / len
    }

    this._lastCamKey = ''
    this._builtCount = 0
  }

  /**
   * @param {THREE.Camera} camera
   * @param {{ force?: boolean, focus?: {x:number,y:number,z:number}, hemisphere?: boolean }} [opts]
   *   hemisphere=true：只按地平线（远眺/开场用），不收焦点锥
   */
  update(camera, opts = {}) {
    if (!this.tiles.size) return
    const cam = camRadial(camera)
    this._vx = cam.x
    this._vy = cam.y
    this._vz = cam.z

    const focus =
      opts.focus ||
      {
        x: cam.x * EARTH_RADIUS_KM,
        y: cam.y * EARTH_RADIUS_KM,
        z: cam.z * EARTH_RADIUS_KM,
      }
    const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
    const fx = focus.x / fl
    const fy = focus.y / fl
    const fz = focus.z / fl
    // 远眺/开场：整前半球；近地仍可 cone 省一点，但锥放宽到接近半球避免列岛被切
    const hemisphere = opts.hemisphere === true || cameraAltitudeKm(camera) > 3500
    const cone = hemisphere ? Math.PI * 0.55 : Math.max(viewConeRad(camera, focus), (40 * Math.PI) / 180)
    // 签名跟高度档 + 焦点粗粒度；自转（同高度绕焦点）不重建
    const altBin = (cam.len / 800) | 0
    const key = `${(fx * 18) | 0},${(fy * 18) | 0},${(fz * 18) | 0},${altBin},${hemisphere ? 1 : 0}`
    if (!opts.force && key === this._lastCamKey) return
    this._lastCamKey = key

    const half = TILE_DEG * 0.5
    let built = 0
    for (const tile of this.tiles.values()) {
      const want = isTileInView(
        camera,
        focus,
        tile.lonC - half,
        tile.latC - half,
        tile.lonC + half,
        tile.latC + half,
        cone,
      )
      if (want) {
        if (!tile.mesh) this._buildTile(tile)
        if (tile.mesh) built++
      } else if (tile.mesh) {
        this._disposeTileMesh(tile)
      }
    }
    this._builtCount = built
  }

  stats() {
    return {
      tilesTotal: this.tiles.size,
      tilesBuilt: this._builtCount,
      tileDeg: TILE_DEG,
    }
  }

  setResolution(w, h) {
    this._resW = Math.max(1, w)
    this._resH = Math.max(1, h)
    setOutlineResolution(w, h)
  }

  disposeAllMeshes() {
    for (const tile of this.tiles.values()) this._disposeTileMesh(tile)
    this._builtCount = 0
  }

  /**
   * 整段建线（不按当前相机切碎）。背面由球壳 depth 挡。
   * 每条 Line2 记中点法向，开场径向显现按线段角距（非整瓦片）往外爬。
   * @param {TileRec} tile
   */
  _buildTile(tile) {
    if (tile.mesh || !tile.segments.length) return
    const g = new THREE.Group()
    g.name = `outline-tile-${tile.key}`

    for (const seg of tile.segments) {
      const mat = seg.isJapanCoast ? this.matJapan : this.matContext
      if (!mat) continue
      if (!seg.ring || seg.ring.length < 2) continue
      const positions = projectRunToPositions(seg.ring)
      if (!positions || positions.length < 6) continue
      const edgeGeo = new LineGeometry()
      edgeGeo.setPositions(positions)
      const line = new Line2(edgeGeo, mat)
      line.computeLineDistances()
      line.renderOrder = seg.isJapanCoast ? 3 : seg.kind === 'border' ? 1 : 2
      line.frustumCulled = true
      // 段中点单位法向：径向 reveal 按线段粒度（瓦片 20° 整块弹出会「弹」）
      const mid = ringMidNormal(seg.ring)
      line.userData.nx = mid.nx
      line.userData.ny = mid.ny
      line.userData.nz = mid.nz
      g.add(line)
    }
    if (!g.children.length) return
    tile.mesh = g
    this.group.add(g)
  }

  _disposeTileMesh(tile) {
    if (!tile.mesh) return
    this.group.remove(tile.mesh)
    tile.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.()
    })
    tile.mesh = null
  }

  /**
   * 径向显现：按线段中点离焦点角距，从中心往外爬（开场动画）
   * 粒度=线段，不是 20° 瓦片，避免日本岸线整块「弹」出。
   * @param {{ x:number, y:number, z:number }} focus
   * @param {number} revealRad 0..π 已显现角半径
   */
  applyRadialReveal(focus, revealRad) {
    const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
    const fx = focus.x / fl
    const fy = focus.y / fl
    const fz = focus.z / fl
    const cosMin = Math.cos(Math.min(Math.PI, Math.max(0, revealRad)))
    for (const tile of this.tiles.values()) {
      if (!tile.mesh) continue
      let any = false
      for (const child of tile.mesh.children) {
        const nx = child.userData?.nx ?? tile.nx
        const ny = child.userData?.ny ?? tile.ny
        const nz = child.userData?.nz ?? tile.nz
        const vis = nx * fx + ny * fy + nz * fz >= cosMin - 1e-4
        child.visible = vis
        if (vis) any = true
      }
      tile.mesh.visible = any
    }
  }

  /** 全部已建瓦片与线段可见 */
  showAllBuilt() {
    for (const tile of this.tiles.values()) {
      if (!tile.mesh) continue
      tile.mesh.visible = true
      for (const child of tile.mesh.children) child.visible = true
    }
  }
}

export function buildJapanOutline(geojson, screen = {}) {
  const layer = new OutlineLayer()
  layer.load(geojson, screen)
  return { group: layer.group, layer }
}

export function isFrontHemisphereLonLat(lon, lat, camPos, minDot = EDGE_FRONT_DOT_MIN) {
  const p = project(lon, lat, 0, 1)
  const plen = Math.hypot(p.x, p.y, p.z) || 1
  const clen = Math.hypot(camPos.x, camPos.y, camPos.z) || 1
  return (
    (p.x / plen) * (camPos.x / clen) +
      (p.y / plen) * (camPos.y / clen) +
      (p.z / plen) * (camPos.z / clen) >=
    minDot
  )
}

function splitRingIntoTiles(ring, tiles, meta) {
  if (!ring || ring.length < 2) return
  let curKey = null
  let curPts = []
  const flush = () => {
    if (curPts.length >= 2 && curKey) {
      let tile = tiles.get(curKey)
      if (!tile) {
        tile = makeEmptyTile(curKey)
        tiles.set(curKey, tile)
      }
      tile.segments.push({
        ring: curPts,
        isJapanCoast: meta.isJapanCoast,
        kind: meta.kind,
      })
    }
    curPts = []
  }
  for (let i = 0; i < ring.length; i++) {
    const lon = ring[i][0]
    const lat = ring[i][1]
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (i > 0) {
      const prevLon = ring[i - 1][0]
      if (Number.isFinite(prevLon) && Math.abs(lon - prevLon) > 180) {
        flush()
        curKey = null
      }
    }
    const key = tileKey(lon, lat)
    if (curKey === null) {
      curKey = key
      curPts = [[lon, lat]]
      continue
    }
    if (key === curKey) {
      curPts.push([lon, lat])
      continue
    }
    curPts.push([lon, lat])
    flush()
    curKey = key
    curPts = [[lon, lat]]
  }
  flush()
}

function frontRunsOfRing(ring, vx, vy, vz, minDot) {
  const runs = []
  let run = []
  for (let i = 0; i < ring.length; i++) {
    const lon = ring[i][0]
    const lat = ring[i][1]
    const p = project(lon, lat, 0, 1)
    const len = Math.hypot(p.x, p.y, p.z) || 1
    const dot = (p.x / len) * vx + (p.y / len) * vy + (p.z / len) * vz
    if (dot >= minDot) run.push([lon, lat])
    else {
      if (run.length >= 2) runs.push(run)
      run = []
    }
  }
  if (run.length >= 2) runs.push(run)
  return runs
}

function projectRunToPositions(run) {
  if (!run || run.length < 2) return null
  const pts = []
  for (const [lon, lat] of run) {
    const p = project(lon, lat, -SURFACE_ALT_KM, 1)
    pts.push(p.x, p.y, p.z)
  }
  return new Float32Array(pts)
}

/**
 * 线段中点单位法向（径向 reveal 用）。经度在日界线附近取平均前会归一。
 * @param {Array<[number, number]>} ring
 * @returns {{ nx:number, ny:number, nz:number }}
 */
function ringMidNormal(ring) {
  if (!ring || !ring.length) return { nx: 0, ny: 0, nz: 1 }
  let lonSum = 0
  let latSum = 0
  const n = ring.length
  // 以首点为基准折叠经度，避免 ±180 平均跑飞
  const lon0 = ring[0][0]
  for (const [lon, lat] of ring) {
    let dLon = lon - lon0
    while (dLon > 180) dLon -= 360
    while (dLon < -180) dLon += 360
    lonSum += lon0 + dLon
    latSum += lat
  }
  const p = project(lonSum / n, latSum / n, 0, 1)
  const len = Math.hypot(p.x, p.y, p.z) || 1
  return { nx: p.x / len, ny: p.y / len, nz: p.z / len }
}

function makeLineMat(linewidth, resW, resH) {
  const mat = new LineMaterial({
    color: EDGE,
    linewidth,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
    worldUnits: false,
  })
  mat.resolution.set(resW, resH)
  return mat
}

function ringLooksLikeJapan(ring) {
  let inside = 0
  for (const [lon, lat] of ring) {
    if (
      lon >= JAPAN_COAST.minLon &&
      lon <= JAPAN_COAST.maxLon &&
      lat >= JAPAN_COAST.minLat &&
      lat <= JAPAN_COAST.maxLat
    ) {
      inside++
    }
  }
  return inside * 2 >= ring.length
}

function tileKey(lon, lat) {
  let L = lon
  if (L >= 180) L = ((L + 180) % 360) - 180
  if (L < -180) L = ((L - 180) % 360) + 180
  const latC = Math.max(-90, Math.min(90, lat))
  const ix = Math.floor((L + 180) / TILE_DEG)
  const iy = Math.floor((latC + 90) / TILE_DEG)
  return `${ix}_${iy}`
}

function makeEmptyTile(key) {
  const parts = key.split('_')
  const ix = Number(parts[0]) || 0
  const iy = Number(parts[1]) || 0
  return {
    key,
    lonC: -180 + (ix + 0.5) * TILE_DEG,
    latC: -90 + (iy + 0.5) * TILE_DEG,
    nx: 0,
    ny: 0,
    nz: 1,
    segments: [],
    mesh: null,
  }
}

function ringsFromGeometry(geom) {
  if (!geom) return []
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'MultiLineString') return geom.coordinates || []
  if (geom.type === 'Polygon') {
    return geom.coordinates?.[0] ? [geom.coordinates[0]] : []
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates || []).map((poly) => poly[0]).filter(Boolean)
  }
  return []
}

/**
 * @typedef {{
 *   key: string,
 *   lonC: number,
 *   latC: number,
 *   nx: number,
 *   ny: number,
 *   nz: number,
 *   segments: Array<{ ring: number[][], isJapanCoast: boolean, kind: string }>,
 *   mesh: THREE.Group | null,
 * }} TileRec
 */
