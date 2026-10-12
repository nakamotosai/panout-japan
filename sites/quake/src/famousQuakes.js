/**
 * 名震模式：东亚范围内十几个著名历史地震（精选）
 * 坐标/震级综合 USGS·JMA·维基常见值；摘要为中文导读，非预报。
 * wikiUrl 指向中文维基（无则英文）。
 */

/**
 * @typedef {{
 *   id: string,
 *   shortName: string,
 *   name: string,
 *   date: string,
 *   time?: string,
 *   mag: number,
 *   magNote?: string,
 *   lon: number,
 *   lat: number,
 *   depthKm: number,
 *   place: string,
 *   summary: string,
 *   wikiUrl: string,
 *   deaths?: string,
 * }} FamousQuake
 */

/** @type {FamousQuake[]} */
export const FAMOUS_QUAKES = [
  {
    id: 'tohoku-2011',
    shortName: '3·11 东北',
    name: '东北地方太平洋冲地震（东日本大震灾）',
    date: '2011-03-11',
    time: '2011-03-11T05:46:24.000Z',
    mag: 9.1,
    magNote: 'Mw 9.0–9.1',
    lon: 142.369,
    lat: 38.322,
    depthKm: 29,
    place: '三陆冲（宫城县东方海域）',
    summary:
      '日本有仪器记录以来最大地震。震中在东北外海俯冲带，引发巨大海啸，并导致福岛第一核电站事故。死亡与失踪合计约两万余人，沿岸城市与基础设施遭受毁灭性破坏。它也是全球观测网记录中震级最高的事件之一，深刻改变了日本防灾与核能政策。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/東日本大震災',
    deaths: '约 1.97 万死亡、2.5 千余失踪',
  },
  {
    id: 'hanshin-1995',
    shortName: '阪神·淡路',
    name: '阪神·淡路大地震',
    date: '1995-01-17',
    time: '1995-01-16T20:46:52.000Z',
    mag: 6.9,
    magNote: 'Mw 6.9 / Mj 7.3',
    lon: 135.07,
    lat: 34.59,
    depthKm: 17.6,
    place: '淡路岛北部（神户一带）',
    summary:
      '清晨发生在人口密集都市带的直下型地震，神户、淡路岛建筑与高架交通损毁严重。最大震度 7，约 6400 人遇难，是战后日本都市防灾的分水岭：耐震规范、应急体制与志愿者体系此后大幅强化。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/阪神淡路大地震',
    deaths: '约 6434 人',
  },
  {
    id: 'noto-2024',
    shortName: '能登 2024',
    name: '令和6年能登半岛地震',
    date: '2024-01-01',
    time: '2024-01-01T07:10:09.000Z',
    mag: 7.5,
    magNote: 'Mw 7.5 / Mj 7.6',
    lon: 137.27,
    lat: 37.49,
    depthKm: 10,
    place: '石川县能登半岛',
    summary:
      '元旦发生的强震，最大震度 7，伴随沿岸地壳抬升与局部海啸。能登半岛道路、聚落与高龄社区受灾严重，救援与重建难度大。它也提醒人们：半岛型、次生灾害与冬季极端天气会叠加放大影响。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/令和6年能登半島地震',
    deaths: '数百人（含灾害相关死，统计持续更新）',
  },
  {
    id: 'kumamoto-2016',
    shortName: '熊本 2016',
    name: '熊本地震（2016）',
    date: '2016-04-16',
    time: '2016-04-15T16:25:06.000Z',
    mag: 7.0,
    magNote: '主震 Mw 7.0 / Mj 7.3',
    lon: 130.726,
    lat: 32.782,
    depthKm: 10,
    place: '熊本县（布田川—日奈久断层带）',
    summary:
      '先有强烈前震，再于 4 月 16 日发生主震，最大震度 7。熊本城石垣、阿苏周边道路与大量住宅受损，余震频繁。内陆活断层型序列地震的典型案例，推动了建筑物耐震与文化财保护讨论。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/熊本地震_(2016年)',
    deaths: '约 270 余人（含相关死）',
  },
  {
    id: 'kanto-1923',
    shortName: '关东 1923',
    name: '关东大地震',
    date: '1923-09-01',
    time: '1923-09-01T02:58:32.000Z',
    mag: 7.9,
    magNote: '约 Mw 7.9–8.2',
    lon: 139.14,
    lat: 35.33,
    depthKm: 23,
    place: '相模湾附近',
    summary:
      '关东大地震摧毁东京、横滨大片市区，火灾造成的伤亡尤为惨重，死亡约十余万人。它深刻影响近代日本城市规划、耐震与消防体系，也是每年「防灾日」纪念的原点之一。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/關東大地震',
    deaths: '约 10.5 万人',
  },
  {
    id: 'hokkaido-2018',
    shortName: '胆振东部',
    name: '北海道胆振东部地震',
    date: '2018-09-06',
    time: '2018-09-05T18:07:59.000Z',
    mag: 6.6,
    magNote: 'Mw 6.6 / Mj 6.7',
    lon: 142.01,
    lat: 42.69,
    depthKm: 35,
    place: '北海道胆振地方中东部',
    summary:
      '强震引发厚层火山灰质斜坡大规模滑坡，厚真町等地受灾；全道一度大停电，凸显能源与生命线韧性问题。现代日本少见的「全岛级」电力连锁冲击事件。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/北海道膽振東部地震',
    deaths: '40 余人',
  },
  {
    id: 'chuetsu-2004',
    shortName: '新潟中越',
    name: '新潟县中越地震',
    date: '2004-10-23',
    time: '2004-10-23T08:56:00.000Z',
    mag: 6.6,
    magNote: 'Mw 6.6 / Mj 6.8',
    lon: 138.87,
    lat: 37.29,
    depthKm: 13,
    place: '新潟县中越',
    summary:
      '山区直下型地震，山古志村等中山间地区道路中断、土砂灾害严重，新干线首次因地震脱轨。此后日本加强了中山间防灾与震后重建社区模式的讨论。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/新潟縣中越地震',
    deaths: '60 余人',
  },
  {
    id: 'noto-2007',
    shortName: '能登 2007',
    name: '能登半岛地震（2007）',
    date: '2007-03-25',
    time: '2007-03-25T00:41:57.000Z',
    mag: 6.7,
    magNote: 'Mw 6.7 / Mj 6.9',
    lon: 136.69,
    lat: 37.22,
    depthKm: 11,
    place: '能登半岛近海',
    summary:
      '能登半岛近海强震，轮岛等地房屋与基础设施受损，并有小规模海啸。与 2024 年能登地震同属半岛构造活跃区，常被对照讨论区域地震史。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/能登半島地震_(2007年)',
    deaths: '1 人',
  },
  {
    id: 'hokkaido-1993',
    shortName: '南西冲 1993',
    name: '北海道南西冲地震',
    date: '1993-07-12',
    time: '1993-07-12T13:17:11.000Z',
    mag: 7.7,
    magNote: 'Mw 7.7',
    lon: 139.2,
    lat: 42.85,
    depthKm: 17,
    place: '北海道奥尻岛近海',
    summary:
      '强震后数分钟内海啸袭击奥尻岛，局部浪高极大，居民疏散时间极短。成为日本海啸预警与沿海高地避难规划的重要教训。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/北海道南西沖地震',
    deaths: '约 230 人',
  },
  {
    id: 'miyagi-1978',
    shortName: '宫城 1978',
    name: '宫城县冲地震（1978）',
    date: '1978-06-12',
    time: '1978-06-12T08:14:26.000Z',
    mag: 7.7,
    magNote: 'Mw 7.7 / Mj 7.4',
    lon: 142.03,
    lat: 38.19,
    depthKm: 44,
    place: '宫城县冲',
    summary:
      '东北外海强震，仙台等地建筑与基础设施受损，推动了耐震设计与东北地区防灾研究。俯冲带重复性强震序列中的代表事件之一。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/宮城縣沖地震',
    deaths: '20 余人',
  },
  {
    id: 'fukui-1948',
    shortName: '福井 1948',
    name: '福井地震',
    date: '1948-06-28',
    time: '1948-06-28T07:13:31.000Z',
    mag: 7.1,
    magNote: '约 M 7.1',
    lon: 136.23,
    lat: 36.17,
    depthKm: 10,
    place: '福井平原',
    summary:
      '战后不久的直下型大震，福井市几乎全毁，伤亡惨重。直接影响了日本建筑基准法与现代耐震规范的形成。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/福井地震',
    deaths: '约 3700 余人',
  },
  {
    id: 'nobbi-1891',
    shortName: '浓尾 1891',
    name: '浓尾地震',
    date: '1891-10-28',
    time: '1891-10-28T21:38:00.000Z',
    mag: 8.0,
    magNote: '约 M 8.0',
    lon: 136.6,
    lat: 35.6,
    depthKm: 10,
    place: '岐阜—爱知（浓尾断层带）',
    summary:
      '日本近代史上著名的内陆大地震，地表断层错动明显，中部地区破坏极重。对地震学、断层研究与近代防灾具有里程碑意义。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/濃尾地震',
    deaths: '约 7200 余人',
  },
  {
    id: 'jiji-1999',
    shortName: '集集 921',
    name: '集集大地震（台湾 921）',
    date: '1999-09-21',
    time: '1999-09-20T17:47:15.000Z',
    mag: 7.6,
    magNote: 'Mw 7.6–7.7',
    lon: 120.98,
    lat: 23.77,
    depthKm: 8,
    place: '台湾南投县集集镇附近',
    summary:
      '车笼埔断层错动引发的内陆大地震，中部山城与盆地建筑、桥梁损毁严重。台湾现代防灾、耐震与社区重建的关键节点，也是东亚地震教育中常被引用的案例。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/集集大地震',
    deaths: '约 2400 余人',
  },
  {
    id: 'tangshan-1976',
    shortName: '唐山 1976',
    name: '唐山大地震',
    date: '1976-07-28',
    time: '1976-07-27T19:42:53.000Z',
    mag: 7.6,
    magNote: '约 Ms 7.8 / Mw ~7.6',
    lon: 118.18,
    lat: 39.63,
    depthKm: 15,
    place: '河北唐山',
    summary:
      '发生在人口稠密工业城市的毁灭性地震，建筑物大量倒塌，是 20 世纪伤亡最惨重的地震之一。对随后中国抗震设防、应急与城市规划影响深远。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/唐山大地震',
    deaths: '官方约 24 万余人',
  },
  {
    id: 'fukushima-2022',
    shortName: '福岛冲 2022',
    name: '福岛县冲地震（2022）',
    date: '2022-03-16',
    time: '2022-03-16T14:36:33.000Z',
    mag: 7.3,
    magNote: 'Mw 7.3 / Mj 7.4',
    lon: 141.62,
    lat: 37.70,
    depthKm: 57,
    place: '福岛县东方海域',
    summary:
      '东北外海强震，东北新干线列车脱轨、多地停电与基础设施受损。发生在 3·11 之后的同一俯冲带区域，常被用来讨论余震/后续大震与基础设施韧性。',
    wikiUrl: 'https://zh.wikipedia.org/wiki/福島縣沖地震_(2022年)',
    deaths: '数人至十余人量级（含相关死，口径不一）',
  },
]

/** 名震主震后余震时间窗（天） */
export const FAMOUS_AFTERSHOCK_DAYS = 7

/**
 * @param {FamousQuake} fq
 * @returns {{lon:number,lat:number,depthKm:number,mag:number,time:string,place:string,id:string}}
 */
export function famousToQuakeRecord(fq) {
  return {
    id: fq.id,
    lon: fq.lon,
    lat: fq.lat,
    depthKm: fq.depthKm,
    mag: fq.mag,
    time: fq.time || `${fq.date}T00:00:00.000Z`,
    place: fq.place,
  }
}

/**
 * @param {string} id
 */
export function getFamousById(id) {
  return FAMOUS_QUAKES.find((q) => q.id === id) || null
}

/** 默认进名震时选中的一场（3·11） */
export function defaultFamousId() {
  return FAMOUS_QUAKES[0]?.id || null
}

/**
 * 余震空间半径（km）：随主震震级放大，封顶
 * @param {number} mag
 */
export function aftershockRadiusKm(mag) {
  const m = Number(mag)
  if (!Number.isFinite(m)) return 180
  // M6≈120 · M7≈250 · M8≈450 · M9≈650
  const r = 40 * Math.pow(10, 0.45 * Math.max(0, m - 5))
  return Math.min(700, Math.max(100, r))
}

/**
 * 球面近似距离（km）
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * 主震 + 其后 N 天、空间邻域内的目录事件（余震窗）
 * 主震本身始终来自精选表（1970 前事件历史包可能没有）
 *
 * @param {FamousQuake} fq
 * @param {Array<{lon:number,lat:number,depthKm?:number,mag?:number,time?:string,id?:string,place?:string}>} catalog
 * @param {{ days?: number, minMag?: number }} [opts]
 * @returns {Array<object>}
 */
export function buildFamousSequence(fq, catalog, opts = {}) {
  const main = famousToQuakeRecord(fq)
  const days = opts.days ?? FAMOUS_AFTERSHOCK_DAYS
  const minMag =
    opts.minMag != null && Number.isFinite(opts.minMag) ? opts.minMag : 4.0
  const t0 = Date.parse(main.time)
  const out = [{ ...main, _famousMain: true }]
  if (!Number.isFinite(t0)) return out

  const t1 = t0 + days * 24 * 60 * 60 * 1000
  const maxKm = aftershockRadiusKm(main.mag)
  const seen = new Set([String(main.id)])

  for (const q of catalog || []) {
    if (!q?.time) continue
    const t = Date.parse(q.time)
    if (!Number.isFinite(t) || t < t0 || t > t1) continue
    if ((q.mag ?? 0) < minMag) continue
    const dist = haversineKm(main.lat, main.lon, q.lat, q.lon)
    if (dist > maxKm) continue

    // 与主震几乎重合的目录条：跳过，避免双球叠在主震上
    if (dist < 25 && Math.abs(t - t0) < 3 * 60 * 60 * 1000) continue

    const key = q.id != null ? String(q.id) : `${q.time}|${q.lon}|${q.lat}|${q.mag}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }

  // 主震优先、再按时间
  out.sort((a, b) => {
    if (a._famousMain) return -1
    if (b._famousMain) return 1
    return Date.parse(a.time || 0) - Date.parse(b.time || 0)
  })
  return out
}
