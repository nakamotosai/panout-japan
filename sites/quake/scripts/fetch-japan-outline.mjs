/**
 * Natural Earth 岸线 + 陆地国界 → 完整地球（球场景）
 *
 * 源：
 * - 岸线 ne_10m_coastline（全球细节；50m 日本外太糙）
 * - 国界 ne_50m_admin_0_boundary_lines_land（国境不必 10m，省体积）
 *
 * 输出：public/data/japan-outline.json（文件名历史保留；features kind=coastline|border）
 *
 * Usage: node scripts/fetch-japan-outline.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data', 'japan-outline.json')

const SOURCES = [
  {
    name: 'coastline',
    kind: 'coastline',
    // 10m：大陆/半岛轮廓明显更顺，日本外不再「折尺」
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson',
    /** RDP 容差（度）≈ 1–2 km；岸线要细 */
    simplifyDeg: 0.012,
    maxPoints: 12000,
  },
  {
    name: 'land_borders',
    kind: 'border',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_boundary_lines_land.geojson',
    simplifyDeg: 0.03,
    maxPoints: 4000,
  },
]

/** 完整地球：单框全球 */
const OUTLINE_BOXES = [{ minLon: -180, maxLon: 180, minLat: -90, maxLat: 90 }]

const OUTLINE_BBOX = {
  minLon: -180,
  maxLon: 180,
  minLat: -90,
  maxLat: 90,
}

const MIN_LINE_POINTS = 2
/** 过短线段丢掉（度）——小岛别滤光 */
const MIN_LINE_SPAN_DEG = 0.008

function lineSpan(coords) {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return Math.hypot(maxLon - minLon, maxLat - minLat)
}

function linesFromGeometry(geom) {
  if (!geom) return []
  if (geom.type === 'LineString') return geom.coordinates ? [geom.coordinates] : []
  if (geom.type === 'MultiLineString') return geom.coordinates || []
  if (geom.type === 'Polygon') {
    return geom.coordinates?.[0] ? [geom.coordinates[0]] : []
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates || []).map((poly) => poly[0]).filter(Boolean)
  }
  return []
}

/** 点到线段距离²（平面 lon/lat，全球抽稀够用） */
function dist2PointSeg(p, a, b) {
  const x = p[0]
  const y = p[1]
  const x1 = a[0]
  const y1 = a[1]
  const x2 = b[0]
  const y2 = b[1]
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-24) {
    const ex = x - x1
    const ey = y - y1
    return ex * ex + ey * ey
  }
  let t = ((x - x1) * dx + (y - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = x1 + t * dx - x
  const py = y1 + t * dy - y
  return px * px + py * py
}

/**
 * Ramer–Douglas–Peucker：按形状抽稀，比均匀抽点更保弯角
 * @param {number[][]} coords
 * @param {number} epsilonDeg
 */
function simplifyRDP(coords, epsilonDeg) {
  if (!coords || coords.length <= 2) return coords || []
  const eps2 = epsilonDeg * epsilonDeg
  const keep = new Uint8Array(coords.length)
  keep[0] = 1
  keep[coords.length - 1] = 1

  const stack = [[0, coords.length - 1]]
  while (stack.length) {
    const [i0, i1] = stack.pop()
    let maxD = 0
    let maxI = -1
    const a = coords[i0]
    const b = coords[i1]
    for (let i = i0 + 1; i < i1; i++) {
      const d = dist2PointSeg(coords[i], a, b)
      if (d > maxD) {
        maxD = d
        maxI = i
      }
    }
    if (maxI >= 0 && maxD > eps2) {
      keep[maxI] = 1
      stack.push([i0, maxI], [maxI, i1])
    }
  }

  const out = []
  for (let i = 0; i < coords.length; i++) {
    if (keep[i]) out.push(coords[i])
  }
  return out
}

/** 仍超 maxPoints 时再均匀抽（保首尾） */
function capPoints(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords
  const step = Math.ceil(coords.length / maxPoints)
  const out = []
  for (let i = 0; i < coords.length; i += step) out.push(coords[i])
  const last = coords[coords.length - 1]
  const prev = out[out.length - 1]
  if (!prev || last[0] !== prev[0] || last[1] !== prev[1]) out.push(last)
  return out
}

function simplifyLine(coords, simplifyDeg, maxPoints) {
  const slim = simplifyRDP(coords, simplifyDeg)
  return capPoints(slim, maxPoints)
}

function outCode(lon, lat, bb) {
  let c = 0
  if (lon < bb.minLon) c |= 1
  else if (lon > bb.maxLon) c |= 2
  if (lat < bb.minLat) c |= 4
  else if (lat > bb.maxLat) c |= 8
  return c
}

function clipSegment(a, b, bb = OUTLINE_BBOX) {
  let [x0, y0] = a
  let [x1, y1] = b
  let c0 = outCode(x0, y0, bb)
  let c1 = outCode(x1, y1, bb)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!(c0 | c1)) return [[x0, y0], [x1, y1]]
    if (c0 & c1) return []
    const c = c0 || c1
    let x
    let y
    if (c & 8) {
      x = x0 + ((x1 - x0) * (bb.maxLat - y0)) / (y1 - y0 || 1e-12)
      y = bb.maxLat
    } else if (c & 4) {
      x = x0 + ((x1 - x0) * (bb.minLat - y0)) / (y1 - y0 || 1e-12)
      y = bb.minLat
    } else if (c & 2) {
      y = y0 + ((y1 - y0) * (bb.maxLon - x0)) / (x1 - x0 || 1e-12)
      x = bb.maxLon
    } else {
      y = y0 + ((y1 - y0) * (bb.minLon - x0)) / (x1 - x0 || 1e-12)
      x = bb.minLon
    }
    if (c === c0) {
      x0 = x
      y0 = y
      c0 = outCode(x0, y0, bb)
    } else {
      x1 = x
      y1 = y
      c1 = outCode(x1, y1, bb)
    }
  }
}

function clipPolyline(ring, bb = OUTLINE_BBOX) {
  if (!ring || ring.length < 2) return []
  const lines = []
  let cur = []
  for (let i = 0; i < ring.length - 1; i++) {
    const seg = clipSegment(ring[i], ring[i + 1], bb)
    if (seg.length < 2) {
      if (cur.length >= 2) lines.push(cur)
      cur = []
      continue
    }
    const [p0, p1] = seg
    if (!cur.length) {
      cur.push(p0, p1)
    } else {
      const last = cur[cur.length - 1]
      if (Math.hypot(last[0] - p0[0], last[1] - p0[1]) > 1e-9) {
        lines.push(cur)
        cur = [p0, p1]
      } else {
        cur.push(p1)
      }
    }
  }
  if (cur.length >= 2) lines.push(cur)
  return lines
}

function anyInBox(coords, bb) {
  return coords.some(
    ([lon, lat]) =>
      lon >= bb.minLon &&
      lon <= bb.maxLon &&
      lat >= bb.minLat &&
      lat <= bb.maxLat,
  )
}

function lineMayHit(coords, bb) {
  if (!coords?.length) return false
  if (anyInBox(coords, bb)) return true
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  if (maxLon < bb.minLon || minLon > bb.maxLon) return false
  if (maxLat < bb.minLat || minLat > bb.maxLat) return false
  return true
}

function lineMayHitAny(coords) {
  return OUTLINE_BOXES.some((bb) => lineMayHit(coords, bb))
}

/** 对每个可见框各裁一次，合并 */
function clipPolylineAny(coords) {
  const out = []
  for (const bb of OUTLINE_BOXES) {
    if (!lineMayHit(coords, bb)) continue
    for (const part of clipPolyline(coords, bb)) out.push(part)
  }
  return out
}

function hasPointIn(lines, lon0, lon1, lat0, lat1) {
  return lines.some((f) =>
    f.geometry.coordinates.some(
      ([lon, lat]) => lon >= lon0 && lon <= lon1 && lat >= lat0 && lat <= lat1,
    ),
  )
}

async function fetchGeo(url) {
  console.log('fetch', url)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

async function main() {
  console.log('outline: coastline=10m + borders=50m (RDP simplify)')
  for (const bb of OUTLINE_BOXES) {
    console.log(`  box ${bb.minLat}–${bb.maxLat}N ${bb.minLon}–${bb.maxLon}E`)
  }

  const lines = []
  const sourceHits = {}
  let totalPts = 0

  for (const src of SOURCES) {
    const geo = await fetchGeo(src.url)
    const features = geo.features || []
    let kept = 0
    for (const feat of features) {
      for (const raw of linesFromGeometry(feat.geometry)) {
        if (!raw || raw.length < MIN_LINE_POINTS) continue
        if (!lineMayHitAny(raw)) continue
        // 先裁再抽稀，避免抽掉关键弯角再裁
        const clipped = clipPolylineAny(raw.map(([lon, lat]) => [lon, lat]))
        for (const part of clipped) {
          if (part.length < MIN_LINE_POINTS) continue
          if (lineSpan(part) < MIN_LINE_SPAN_DEG && part.length < 4) continue
          const coords = simplifyLine(part, src.simplifyDeg, src.maxPoints)
          if (coords.length < MIN_LINE_POINTS) continue
          kept++
          totalPts += coords.length
          lines.push({
            type: 'Feature',
            properties: {
              kind: src.kind,
              layer: src.name,
              source:
                src.kind === 'coastline'
                  ? 'Natural Earth 10m coastline'
                  : 'Natural Earth 50m land borders',
            },
            geometry: { type: 'LineString', coordinates: coords },
          })
        }
      }
    }
    sourceHits[src.name] = kept
    console.log(`${src.name}: kept ${kept} segments`)
  }

  if (!lines.length) throw new Error('No outline segments extracted')

  const borders = lines.filter((f) => f.properties.kind === 'border')
  if (!borders.length) {
    throw new Error('No land border segments extracted')
  }

  // 质量闸：岸线关键区 + 内陆国界
  const gates = [
    ['Hokkaido-NE/Kurils', 144, 156, 42, 48],
    ['China east coast', 110, 125, 20, 40],
    ['Russia Arctic', 60, 160, 68, 82],
    ['Russia Far East', 140, 180, 50, 70],
    ['Europe west', -10, 10, 36, 60],
    ['Australia', 110, 155, -45, -10],
    ['Americas west', -130, -100, 30, 50],
  ]
  for (const [name, a, b, c, d] of gates) {
    if (!hasPointIn(lines, a, b, c, d)) {
      throw new Error(`Quality gate failed: no outline in ${name}`)
    }
    console.log(`gate OK: ${name}`)
  }
  if (!hasPointIn(borders, 90, 125, 40, 55)) {
    throw new Error('Quality gate failed: no land borders near China north')
  }
  console.log('gate OK: China north land borders')
  if (!hasPointIn(borders, 124, 131, 37, 43)) {
    throw new Error('Quality gate failed: no land borders near Korea')
  }
  console.log('gate OK: Korea land borders')

  const out = {
    type: 'FeatureCollection',
    name: 'world-coast-10m-borders-50m-natural-earth',
    bbox: [
      OUTLINE_BBOX.minLon,
      OUTLINE_BBOX.minLat,
      OUTLINE_BBOX.maxLon,
      OUTLINE_BBOX.maxLat,
    ],
    boxes: OUTLINE_BOXES,
    dataRegionNote:
      'Coastline Natural Earth 10m + land borders 50m; quake fetch/live still East Asia (src/region.js)',
    attribution:
      'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.',
    layers: sourceHits,
    totalPoints: totalPts,
    features: lines,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  const json = JSON.stringify(out)
  writeFileSync(OUT, json)
  console.log(`wrote ${OUT}`)
  console.log(
    `lines=${lines.length} points≈${totalPts} bytes=${Buffer.byteLength(json)}`,
  )
  console.log('layers', sourceHits)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
