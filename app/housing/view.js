// 住宅 —— 与犯罪率地图同一套模板（工具栏 / 右侧卡片 / 左下分布仪 / 缩放条）。
// 数据粒度 = 官方最小定位单位「町名（地区名）」；数值 = 该町成約価格の平均。
// 不做面积筛选、不算中位数、不做 70㎡ 换算。

const HSG_LEAFLET_JS = ["/app/housing/vendor/leaflet.js", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
const HSG_LEAFLET_CSS = ["/app/housing/vendor/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"];
const HSG_CSS_HREF = "/app/housing/app.css";

const SKELETON = `
<div id="hsg-app-loader" role="progressbar" aria-label="loading"><div class="loader-inner"><div class="loader-radar"><div class="radar-sweep"></div><div class="radar-dot"></div></div><div class="loader-title" id="hsg-loader-title"></div><div class="loader-status" id="hsg-loader-status"></div></div></div>
<div id="hsg-map"></div>
<div id="hsg-drop"></div>
<div id="hsg-zoom-slider"><span class="zs-cap" id="hsg-zsPlus" role="button" tabindex="0" title="+" aria-label="+">+</span><div class="zs-track" id="hsg-zsTrack"><div class="zs-fill" id="hsg-zsFill"></div><div class="zs-thumb" id="hsg-zsThumb"></div></div><span class="zs-cap" id="hsg-zsMinus" role="button" tabindex="0" title="-" aria-label="-">-</span></div>
<aside id="hsg-legend-instrument"><div class="inst-header"><span class="inst-title" id="hsg-inst-title"></span><span class="inst-readout" id="hsg-inst-readout"></span></div><div class="inst-period" id="hsg-inst-period"></div><div class="inst-hist-wrap"><svg id="hsg-hist-svg" viewBox="0 0 332 22" preserveAspectRatio="none"></svg><div id="hsg-hist-cursor"></div></div><div class="inst-bar" id="hsg-legendBarDiv"></div><div class="inst-ticks" id="hsg-legendTicks"></div></aside>
<aside id="hsg-card"></aside>
<svg id="hsg-lx-svg"></svg><div id="hsg-lx-capsule"></div>`;

import { toHant } from "../hant.js";
const I18N = {
  ja: {
    loadingTitle: "住宅価格を読み込み中", loadingStatus: "国土交通省 不動産情報ライブラリ", loaderAria: "読み込み中",
    metrics: { unit: "平均㎡単価", total: "平均成約価格" },
    modes: { muni: "区市町村", chome: "町名" },
    searchPh: "町名で検索…", tooltipMetric: "指標を切り替え",
    levelChome: "町名", levelWard: "区市町村",
    unitRate: "万円/㎡", unitTotal: "万円",
    deals: "成約件数", meanTotal: "平均成約価格", meanUnit: "平均㎡単価",
    breakdown: "内訳", backTo: "← 戻る", top5TownTitle: "区内で高い町", top5WardTitle: "東京で高い区市町村",
    byValueDesc: (m) => `${m}の高い順`, noTownData: "データなし",
    instTitle: "町名の分布", instTitleMuni: "区市町村の分布", instMedian: "東京中央値", instMax: "以上",
    zoomIn: "拡大", zoomOut: "縮小", noResults: "該当なし", loadFailed: "データを読み込めませんでした。再読み込みしてください。",
    rankExtreme: "最高水準", rankHigh: "高水準", rankNormal: "標準",
    period: "2025Q2–2026Q1 成約", periodTip: "直近4四半期（2025年4月–2026年3月）の成約価格。それより新しい四半期はまだ公表されていません。",
    metaPeriod: "対象期間 2025Q2–2026Q1（直近4四半期）",
    metaTitle: "データ", metaL1: "国土交通省 不動産情報ライブラリ「不動産取引価格情報／成約価格情報」（PDL 1.0）。", metaL2: "町名（地区名）単位で平均。本ページは当サイトが加工して作成したものであり、国が作成・公表したものではありません。",
    faqTitle: "読み方", faqSub: "FAQ",
    faq: [
      { q: "いつのデータですか？", a: "直近4四半期（2025年第2四半期〜2026年第1四半期＝2025年4月〜2026年3月）の成約価格です。国交省の公表は約1四半期遅れるため、それより新しい四半期はまだ出ていません。" },
      { q: "なぜ町名までしか分かれないのですか？", a: "公式データの位置情報は「市区町村＋地区名（町名）」までで、丁目や座標は含まれません。" },
      { q: "平均はどう計算していますか？", a: "その町の成約1件ごとの㎡単価（総額÷面積）を平均しています。面積の絞り込みはしていません。" },
    ],
    siteBy: "japan.ouuut.com", navQuake: "地震", navCabinet: "内閣", navCrime: "犯罪",
  },
  zh: {
    loadingTitle: "正在加载房价", loadingStatus: "国土交通省 不动产情报图书馆", loaderAria: "加载中",
    metrics: { unit: "平均㎡单价", total: "平均成交价" },
    modes: { muni: "区市町村", chome: "町名" },
    searchPh: "搜索町名…", tooltipMetric: "切换指标",
    levelChome: "町名", levelWard: "区市町村",
    unitRate: "万日元/㎡", unitTotal: "万日元",
    deals: "成交笔数", meanTotal: "平均成交价", meanUnit: "平均㎡单价",
    breakdown: "明细", backTo: "← 返回", top5TownTitle: "区内最贵的町", top5WardTitle: "东京最贵的区市町村",
    byValueDesc: (m) => `按${m}排序`, noTownData: "无数据",
    instTitle: "町名分布", instTitleMuni: "区市町村分布", instMedian: "东京中位数", instMax: "以上",
    zoomIn: "放大", zoomOut: "缩小", noResults: "没有匹配的町名", loadFailed: "数据加载失败，请刷新重试。",
    rankExtreme: "最高档", rankHigh: "高档", rankNormal: "标准",
    period: "2025Q2–2026Q1 成交", periodTip: "最近四个季度（2025年4月–2026年3月）的成交价；更新的季度尚未公布。",
    metaPeriod: "时间范围 2025Q2–2026Q1（最近四个季度）",
    metaTitle: "数据", metaL1: "国土交通省 不动产情报图书馆（PDL 1.0）。", metaL2: "按町名（地区名）平均。本页由本站加工制作，并非日本政府发布。",
    faqTitle: "怎么读", faqSub: "FAQ",
    faq: [
      { q: "数据是什么时间范围？", a: "最近四个季度（2025 年第 2 季度至 2026 年第 1 季度，即 2025 年 4 月至 2026 年 3 月）的成交价。国交省发布约滞后一个季度，更新的季度尚未公布。" },
      { q: "为什么只到町名？", a: "官方数据的位置只到「市区町村 + 地区名（町名）」，不含丁目和坐标。" },
      { q: "平均怎么算？", a: "对该町每笔成交的㎡单价（总价÷面积）取平均，不筛面积。" },
    ],
    siteBy: "japan.ouuut.com", navQuake: "地震", navCabinet: "内阁", navCrime: "犯罪",
  },
  en: {
    loadingTitle: "Loading housing prices", loadingStatus: "MLIT Real Estate Information Library", loaderAria: "Loading",
    metrics: { unit: "Mean price/m²", total: "Mean sale price" },
    modes: { muni: "City", chome: "Town" },
    searchPh: "Search a town…", tooltipMetric: "Switch metric",
    levelChome: "Town", levelWard: "Municipality",
    unitRate: "¥10k/m²", unitTotal: "¥10k",
    deals: "Deals", meanTotal: "Mean sale price", meanUnit: "Mean price/m²",
    breakdown: "Breakdown", backTo: "← Back", top5TownTitle: "Priciest towns in ward", top5WardTitle: "Priciest municipalities",
    byValueDesc: (m) => `by ${m}`, noTownData: "No data",
    instTitle: "Town distribution", instTitleMuni: "Municipality distribution", instMedian: "Tokyo median", instMax: "+",
    zoomIn: "Zoom in", zoomOut: "Zoom out", noResults: "No match", loadFailed: "Could not load the data. Please reload.",
    rankExtreme: "top tier", rankHigh: "high", rankNormal: "typical",
    period: "2025Q2–2026Q1 closed", periodTip: "Latest four quarters (Apr 2025 – Mar 2026) of closed prices; newer quarters are not published yet.",
    metaPeriod: "Period: 2025Q2–2026Q1 (latest four quarters)",
    metaTitle: "Data", metaL1: "MLIT Real Estate Information Library (PDL 1.0).", metaL2: "Averaged by town (district). Compiled by this site; not a government publication.",
    faqTitle: "How to read", faqSub: "FAQ",
    faq: [
      { q: "What period does this cover?", a: "The latest four quarters: Q2 2025 – Q1 2026 (April 2025 – March 2026), closed prices. MLIT publishes with roughly a one-quarter lag, so newer quarters are not out yet." },
      { q: "Why only to town level?", a: "The official records locate a deal to municipality + town (district) only; no chome, no coordinates." },
      { q: "How is the mean computed?", a: "Mean of each deal's price per m² (price ÷ area) inside the town; no area filter." },
    ],
    siteBy: "japan.ouuut.com", navQuake: "Quakes", navCabinet: "Cabinet", navCrime: "Crime",
  },
};

/* zh-Hant:四语真页面把 <html data-view-lang> 写成 zh-Hant,章节视图挑自己的词条,不落回
   zh(简体)。简体词条是唯一来源,繁体由站内 s2tw 规则转出(app/hant.js;规则与
   src/hant.py 同一份,生成与闸见 tools/gen_view_hant.py / src/view_i18n.py)。 */
const isZh = (l) => l === "zh" || l === "zh-Hant";
const zhx = (l, s) => (l === "zh-Hant" ? toHant(String(s)) : s);
function deepHant(v) {
  if (typeof v === "string") return toHant(v);
  if (typeof v === "function") return (...a) => toHant(v(...a));
  if (Array.isArray(v)) return v.map(deepHant);
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = deepHant(v[k]); return o; }
  return v;
}
I18N["zh-Hant"] = deepHant(I18N.zh);

const THEME_MAP = { mono: "editorial", sage: "editorial", dark: "tactical", editorial: "editorial", tactical: "tactical" };
const RAMP = {
  tactical: ["#0E0E0C", "#181B10", "#222914", "#2D3717", "#384619", "#43551A", "#4F651B", "#5B751A", "#678618"],
  editorial: ["#F5F3ED", "#E2E5D4", "#D0D7BB", "#BDCAA2", "#ABBC8A", "#9AAF71", "#88A158", "#78933C", "#678618"],
};
const BOUNDS23 = [[35.52, 138.94], [35.90, 139.94]];

let L = null;
let map = null;
let rootEl = null, controlsRoot = null;
let townsDoc = null, TOWNS = [], MUNI_POLY = null, BY_WARD = {}, BY_NAME = {};
let townLayer = null, wardLayer = null, labelLayer = null;
let lastAnchor = null;
let userNavigated = false; // 用户已主动点选：延迟的首次 fit 不要再把视角拽回全局
let curLang = "ja", curVariant = "editorial";
let metric = "unit", mode = "chome";
let selTown = null, selWard = null;
// 程序化飞入期间隐藏选中描边：canvas 在缩放动画里被整体缩放，3px 描边会跟着放大成粗块
let flying = false;
let SCALE = null;
let mounted = false, bootSeq = 0, aborter = null;
let zsDragging = false;

const $el = (id) => { try { return (rootEl && rootEl.querySelector("#" + id)) || document.getElementById(id); } catch (e) { return null; } };
const $qa = (sel) => { const out = []; try { (rootEl || document).querySelectorAll(sel).forEach((e) => out.push(e)); } catch (e) {} return out; };
const t = () => I18N[curLang] || I18N.ja;
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function loadCss() {
  if (document.getElementById("hsg-style")) return;
  const lk = document.createElement("link");
  lk.id = "hsg-style"; lk.rel = "stylesheet"; lk.href = HSG_CSS_HREF;
  document.head.appendChild(lk);
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("script " + src));
    document.head.appendChild(s);
  });
}
async function loadLeaflet() {
  if (globalThis.L && globalThis.L.map) return globalThis.L;
  if (!document.getElementById("hsg-leaflet-css")) {
    const lk = document.createElement("link");
    lk.id = "hsg-leaflet-css"; lk.rel = "stylesheet"; lk.href = HSG_LEAFLET_CSS[0];
    document.head.appendChild(lk);
  }
  let err = null;
  for (const u of HSG_LEAFLET_JS) {
    try { await loadScript(u); if (globalThis.L && globalThis.L.map) return globalThis.L; } catch (e) { err = e; }
  }
  throw err || new Error("leaflet load failed");
}

// ---- values -------------------------------------------------------------
function townVal(x) { return metric === "unit" ? (x.unit || 0) / 1e4 : (x.total || 0); }
function wardVal(name) {
  const list = BY_WARD[name] || [];
  let n = 0, s = 0;
  for (const x of list) { if (!x.n) continue; n += x.n; s += townVal(x) * x.n; }
  return n ? s / n : null;
}
function townName(x) { return x.ward + x.town; }

// ---- scale --------------------------------------------------------------
function buildScale() {
  const vals = (mode === "muni" ? Object.keys(BY_WARD).map((k) => wardVal(k)) : TOWNS.filter((x) => x.n).map(townVal))
    .filter((v) => v != null && v > 0).sort((a, b) => a - b);
  if (!vals.length) return;
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const hi = q(0.99);
  const L0 = Math.log1p(vals[0]), L1 = Math.log1p(hi);
  const breaks = [];
  for (let k = 1; k < 8; k++) breaks.push(Math.expm1(L0 + (L1 - L0) * (k / 8)));
  breaks.push(hi);
  for (let i = 1; i < breaks.length; i++) if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1e-6;
  SCALE = { vals, breaks, hi, ramp: RAMP[curVariant] || RAMP.editorial };
}

function colorFor(v) {
  if (v == null) return "rgba(127,127,127,0.18)";
  const b = SCALE.breaks;
  for (let i = 0; i < b.length; i++) if (v <= b[i]) return SCALE.ramp[i];
  return SCALE.ramp[8];
}

// ---- map ----------------------------------------------------------------
function polyLabelPos(geom) {
  if (!geom) return null;
  let rings = [];
  if (geom.type === "Polygon") rings = geom.coordinates;
  else if (geom.type === "MultiPolygon") rings = geom.coordinates.map((p) => p[0]);
  let best = null, bestArea = 0;
  for (const ring of rings) {
    if (!ring || ring.length < 4) continue;
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a = Math.abs(a / 2);
    if (a > bestArea) { bestArea = a; best = ring; }
  }
  if (!best) return null;
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < best.length - 1; i++) {
    const x0 = best[i][0], y0 = best[i][1], x1 = best[i + 1][0], y1 = best[i + 1][1];
    const a = x0 * y1 - x1 * y0;
    area += a; cx += (x0 + x1) * a; cy += (y0 + y1) * a;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) return null;
  return [cy / (6 * area), cx / (6 * area)];
}

function accentColor() {
  try {
    const v = getComputedStyle(rootEl || document.documentElement).getPropertyValue("--accent").trim();
    if (v) return v;
  } catch (e) {}
  return "#678618";
}
function styleTown(f) {
  const p = f && f.properties;
  if (!p) return {};
  const x = TOWNS[p.i];
  const v = x && x.n ? townVal(x) : null;
  const sel = selTown === p.i;
  const hasSel = selTown != null;
  return {
    color: sel ? accentColor() : (curVariant === "tactical" ? "rgba(255,244,232,0.10)" : "rgba(24,22,20,0.10)"),
    weight: sel ? (flying ? 0 : 3) : 0.55,
    fillColor: colorFor(v),
    fillOpacity: sel ? 1 : (hasSel ? 0.52 : 0.9),
  };
}
function styleWard(f) {
  const p = f && f.properties;
  if (!p) return {};
  const v = wardVal(p.ward_ja);
  const sel = selWard === p.ward_ja;
  const hasSel = !!selWard;
  return {
    color: sel ? accentColor() : (curVariant === "tactical" ? "rgba(255,244,232,0.14)" : "rgba(24,22,20,0.14)"),
    weight: sel ? (flying ? 0 : 2.6) : 0.8,
    fillColor: colorFor(v),
    fillOpacity: sel ? 0.98 : (hasSel ? 0.6 : 0.88),
  };
}

function initMap() {
  map = L.map("hsg-map", { zoomControl: false, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([35.685, 139.75], 11);
  L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png", { maxZoom: 18, maxNativeZoom: 14, attribution: "© 国土地理院" }).addTo(map);
  // 比例尺挪到左上工具条下方：左下角被图例面板整块盖住，右下角被卡片盖住
  L.control.scale({ imperial: false, position: "topleft" }).addTo(map);

  const feats = townsDoc.geo.features.filter((f) => (TOWNS[f.properties.i] || {}).n > 0);
  townLayer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
    style: styleTown,
    onEachFeature: (f, layer) => {
      layer.on("mouseover", () => { const x = TOWNS[f.properties.i]; if (x && x.n) moveHistCursor(townVal(x), townName(x)); });
      layer.on("mouseout", () => resetReadout());
      layer.on("click", (e) => { selectTown(f.properties.i, true, e.latlng); L.DomEvent.stopPropagation(e); });
    },
  });

  wardLayer = L.geoJSON({ type: "FeatureCollection", features: MUNI_POLY.features }, {
    style: styleWard,
    onEachFeature: (f, layer) => {
      layer.on("mouseover", () => { const v = wardVal(f.properties.ward_ja); if (v != null) moveHistCursor(v, f.properties.ward_ja); });
      layer.on("mouseout", () => resetReadout());
      layer.on("click", (e) => { selectWardByName(f.properties.ward_ja, e.latlng); L.DomEvent.stopPropagation(e); });
    },
  });

  labelLayer = L.layerGroup();
  for (const f of MUNI_POLY.features) {
    const nm = f.properties.ward_ja;
    const pos = polyLabelPos(f.geometry);
    if (!nm || !pos) continue;
    const icon = L.divIcon({ className: "map-ward-label", html: `<span>${nm}</span>`, iconSize: [80, 20], iconAnchor: [40, 10] });
    L.marker(pos, { icon, interactive: false }).addTo(labelLayer);
  }
  labelLayer.addTo(map);
  // 底图（GSI 白地図）在 z13 以上会自己印区名，再叠我们的标签就会重影
  const gate = () => { try { const z = map.getZoom(); const want = z >= 10.5 && z < 13;
      if (want && !map.hasLayer(labelLayer)) labelLayer.addTo(map);
      else if (!want && map.hasLayer(labelLayer)) map.removeLayer(labelLayer); } catch (e) {} };
  map.on("zoomend", gate); gate();
  map.on("move zoom", refreshCallout);

  applyMode();
  fitTokyo23();
  setTimeout(() => { try { map.invalidateSize(); if (!userNavigated) fitTokyo23(); } catch (e) {} }, 180);
}

function fitTokyo23() {
  const vw = window.innerWidth;
  const pad = vw > 900
    ? { paddingTopLeft: [64, 16], paddingBottomRight: [($el("hsg-card").offsetWidth || 310) + 28, 24] }
    : { paddingTopLeft: [8, 8], paddingBottomRight: [8, Math.round(window.innerHeight * 0.42)] };
  const b = L.latLngBounds(BOUNDS23);
  map.fitBounds(b, { ...pad, animate: false });
}

function applyMode() {
  if (!map) return;
  if (mode === "muni") {
    if (map.hasLayer(townLayer)) map.removeLayer(townLayer);
    if (!map.hasLayer(wardLayer)) wardLayer.addTo(map);
  } else {
    if (map.hasLayer(wardLayer)) map.removeLayer(wardLayer);
    if (!map.hasLayer(townLayer)) townLayer.addTo(map);
  }
}


// ---- zoom slider --------------------------------------------------------
const ZMIN = 9, ZMAX = 18;
function initZoomSlider() {
  const track = $el("hsg-zsTrack"), fill = $el("hsg-zsFill"), thumb = $el("hsg-zsThumb");
  if (!track || !fill || !thumb) return;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const frac = () => clamp((map.getZoom() - ZMIN) / (ZMAX - ZMIN));
  const render = () => { const f = frac(); fill.style.height = f * 100 + "%"; thumb.style.bottom = f * 100 + "%"; };
  const fromY = (y) => { const r = track.getBoundingClientRect(); return clamp(1 - (y - r.top) / r.height); };
  const apply = (f) => map.setZoom(ZMIN + f * (ZMAX - ZMIN), { animate: false });
  track.addEventListener("pointerdown", (e) => { e.preventDefault(); track.setPointerCapture(e.pointerId); zsDragging = true; apply(fromY(e.clientY)); render(); });
  track.addEventListener("pointermove", (e) => { if (!zsDragging) return; apply(fromY(e.clientY)); render(); });
  const stop = (e) => { zsDragging = false; try { track.releasePointerCapture(e.pointerId); } catch (_) {} };
  track.addEventListener("pointerup", stop);
  track.addEventListener("pointercancel", stop);
  const plus = $el("hsg-zsPlus"), minus = $el("hsg-zsMinus");
  if (plus) {
    plus.setAttribute("aria-label", t().zoomIn);
    plus.addEventListener("click", () => map.zoomIn());
    plus.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); map.zoomIn(); } });
  }
  if (minus) {
    minus.setAttribute("aria-label", t().zoomOut);
    minus.addEventListener("click", () => map.zoomOut());
    minus.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); map.zoomOut(); } });
  }
  map.on("zoom zoomend", render);
  render();
}

// ---- legend + histogram -------------------------------------------------
function updateLegendBar() {
  if (!SCALE) return;
  const bar = $el("hsg-legendBarDiv");
  if (bar) bar.innerHTML = SCALE.ramp.map((c) => `<div style="background:${c}"></div>`).join("");
  const ticks = $el("hsg-legendTicks");
  if (ticks) {
    const b = SCALE.breaks;
    const u = metric === "unit" ? 1 : 1;
    const f = (v) => fmt(v * u, 0);
    ticks.innerHTML = `<span>${f(b[0])}</span><span>${f(b[1])}</span><span>${f(b[3])}</span><span>${f(b[5])}</span><span>${f(SCALE.hi)}+</span>`;
  }
}

function updateHistogram() {
  if (!SCALE) return;
  const vals = SCALE.vals, nBins = 28, maxV = SCALE.hi * 1.05;
  const counts = new Array(nBins).fill(0);
  for (const v of vals) {
    if (v >= maxV) counts[nBins - 1]++;
    else counts[Math.max(0, Math.min(nBins - 1, Math.floor((v / maxV) * nBins)))]++;
  }
  const maxC = Math.max(...counts, 1), W = 332, H = 22, bw = W / nBins;
  let bars = "";
  for (let i = 0; i < nBins; i++) {
    const h = (counts[i] / maxC) * (H - 2);
    bars += `<rect class="hist-bar" x="${i * bw + 0.5}" y="${H - h}" width="${bw - 1}" height="${h}" rx="1"/>`;
  }
  const svg = $el("hsg-hist-svg");
  if (svg) svg.innerHTML = bars;
  const title = $el("hsg-inst-title");
  if (title) title.textContent = `${t().metrics[metric]} · ${mode === "muni" ? (t().instTitleMuni || t().instTitle) : t().instTitle}`;
  resetReadout();
}

function medianOf(vals) {
  const n = vals.length;
  if (!n) return null;
  return n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2;
}

// 读数默认显示「中位数」；有选中对象时显示选中值。悬停移出必须回到这里（旧版 if(!selTown) 守卫让它永远不复位）
function resetReadout() {
  if (!SCALE) return;
  const el = $el("hsg-inst-readout");
  if (!el) return;
  const unit = metric === "unit" ? t().unitRate : t().unitTotal;
  let label = null, val = null;
  if (mode === "muni") {
    if (selWard) { label = selWard; val = wardVal(selWard); }
  } else if (selTown != null) {
    const x = TOWNS[selTown];
    if (x) { label = townName(x); val = x.n ? townVal(x) : null; }
  }
  if (val != null) el.textContent = `${label} · ${fmt(val, 1)} ${unit}`;
  else el.textContent = `${t().instMedian}: ${fmt(medianOf(SCALE.vals), 1)} ${unit}`;
}

function moveHistCursor(val, label) {
  const cur = $el("hsg-hist-cursor");
  if (!cur || !SCALE) return;
  cur.style.left = Math.max(0, Math.min(100, (val / (SCALE.hi * 1.05)) * 100)) + "%";
  cur.style.opacity = "1";
  const ro = $el("hsg-inst-readout");
  if (ro) ro.textContent = `${label} · ${fmt(val, 1)} ${metric === "unit" ? t().unitRate : t().unitTotal}`;
}
function hideHistCursor() {
  const cur = $el("hsg-hist-cursor");
  if (cur) cur.style.opacity = "0";
  resetReadout();
}

// ---- cards --------------------------------------------------------------
function rankBadge(v, vals) {
  if (v == null || !vals.length) return "";
  let i = 0;
  while (i < vals.length && vals[i] <= v) i++;
  const top = +(100 - (i / vals.length) * 100).toFixed(1);
  if (top <= 5) return `<span class="rank-badge danger">Top ${top}% ${t().rankExtreme}</span>`;
  if (top <= 20) return `<span class="rank-badge danger">Top ${top}% ${t().rankHigh}</span>`;
  return `<span class="rank-badge neutral">${t().rankNormal}</span>`;
}

function rowsHtml(rows) {
  const maxV = Math.max(...rows.map((r) => r.v || 0), 1);
  return rows.map((r) => {
    const pct = Math.round(((r.v || 0) / maxV) * 100);
    return `<div class="crime-row">
      <span class="crime-label">${esc(r.n)}</span>
      <div class="crime-bar-wrap"><div class="crime-bar-fill" style="width:${pct}%"></div></div>
      <span class="crime-count">${esc(r.s)}</span>
    </div>`;
  }).join("");
}

function townCardHtml(i) {
  const x = TOWNS[i];
  const isUnit = metric === "unit";
  const v = x.n ? townVal(x) : null;
  const wv = wardVal(x.ward);
  return `
    <span class="card-level lv-chome">${t().levelChome}</span>
    <div class="card-head">
      <div>
        <h2>${esc(x.town)}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${esc(x.ward)} · ${t().deals} ${fmt(x.n)}</div>
      </div>
      ${rankBadge(v, SCALE ? SCALE.vals : [])}
    </div>
    <div class="metric-grid-2col">
      <div class="mg-col">
        <div class="mg-val big-val">${v != null ? fmt(v, 1) : "—"}</div>
        <div class="mg-lbl">${isUnit ? t().meanUnit : t().meanTotal} (${isUnit ? t().unitRate : t().unitTotal})</div>
      </div>
      <div class="mg-col">
        <div class="mg-val">${isUnit ? fmt(x.total) : (x.n ? fmt(x.unit / 1e4, 1) : "—")}</div>
        <div class="mg-lbl">${isUnit ? t().meanTotal + " (" + t().unitTotal + ")" : t().meanUnit + " (" + t().unitRate + ")"}</div>
      </div>
    </div>
    <div class="breakdown-section">
      <div class="section-title">${t().breakdown}</div>
      ${rowsHtml([
        { n: isUnit ? t().meanUnit : t().meanTotal, v: isUnit ? v : x.total, s: isUnit ? `${fmt(v, 1)} ${t().unitRate}` : `${fmt(x.total)} ${t().unitTotal}` },
        { n: isUnit ? t().meanTotal : t().meanUnit, v: isUnit ? x.total : (x.n ? x.unit / 1e4 : null), s: isUnit ? `${fmt(x.total)} ${t().unitTotal}` : `${fmt(x.n ? x.unit / 1e4 : null, 1)} ${t().unitRate}` },
        { n: t().deals, v: x.n, s: `${fmt(x.n)}` },
      ])}
    </div>
    <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
      <button data-hsg-ward="${esc(x.ward)}" style="background:var(--bg-card-sub);border:1px solid var(--line-main);color:var(--text-main);padding:4px 8px;border-radius:var(--radius-inner);font-size:12px;cursor:pointer;font-weight:350">
        ${t().backTo} ${esc(x.ward)}
      </button>
      <span style="font-size:11px;color:var(--text-faint);font-family:var(--font-num)">MLIT</span>
    </div>`;
}

function wardCardHtml(name) {
  const v = wardVal(name);
  const list = (BY_WARD[name] || []).filter((x) => x.n).sort((a, b) => townVal(b) - townVal(a)).slice(0, 5);
  const totalDeals = (BY_WARD[name] || []).reduce((s, x) => s + x.n, 0);
  const tops = list.map((x) => `<div class="top-item" data-hsg-town="${x.i}"><span class="tname">${esc(x.town)}</span><span class="trate">${fmt(townVal(x), 0)} ${metric === "unit" ? t().unitRate : t().unitTotal}</span></div>`).join("");
  return `
    <span class="card-level lv-ward">${t().levelWard}</span>
    <div class="card-head">
      <div>
        <h2>${esc(name)}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${t().deals} ${fmt(totalDeals)}</div>
      </div>
      <span class="rank-badge neutral">${t().levelWard}</span>
    </div>
    <div class="metric-grid-2col">
      <div class="mg-col">
        <div class="mg-val big-val">${v != null ? fmt(v, 0) : "—"}</div>
        <div class="mg-lbl">${t().meanUnit}</div>
      </div>
      <div class="mg-col">
        <div class="mg-val">${fmt(totalDeals)}</div>
        <div class="mg-lbl">${t().deals}</div>
      </div>
    </div>
    <div class="tops-box">
      <div class="section-title">${t().top5TownTitle}</div>
      ${tops || `<div style="font-size:12px;color:var(--text-muted)">${t().noTownData}</div>`}
    </div>`;
}

function rankingHtml() {
  const list = Object.keys(BY_WARD).map((k) => ({ ward: k, v: wardVal(k) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v).slice(0, 5);
  const max = list[0] ? list[0].v : 1;
  return `
    <div class="panel-card">
      <div class="card-head" style="margin-bottom:4px">
        <div style="font-size:13px;font-weight:var(--fw-mid);color:var(--text-main)">${t().top5WardTitle}</div>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-num)">${t().byValueDesc(t().metrics[metric])}</span>
      </div>
      <div class="rank-card-list">
        ${list.map((x, i) => `
          <div class="rank-card-item" role="button" tabindex="0" data-hsg-ward="${esc(x.ward)}">
            <span class="rci-idx">0${i + 1}</span>
            <span class="rci-name">${esc(x.ward)}</span>
            <div class="rci-bar-wrap"><div class="rci-bar-fill" style="width:${Math.round((x.v / max) * 100)}%"></div></div>
            <span class="rci-val">${fmt(x.v, 0)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

function metaHtml() {
  const faq = (t().faq || []).map((x) => `<details class="faq-item"><summary>${esc(x.q)}</summary><div class="faq-a">${esc(x.a)}</div></details>`).join("");
  return `
    <div class="panel-card" style="padding:12px 14px;background:var(--surface);border:0;box-shadow:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:var(--fw-mid);color:var(--text-main);letter-spacing:0.5px">${t().metaTitle}</span>
        <span style="font-size:11px;color:var(--text-faint);font-family:var(--font-num)">MLIT / PDL 1.0</span>
      </div>
      <div style="font-size:11px;color:var(--text-main);line-height:1.4;margin-bottom:3px;font-weight:var(--fw-mid)">${esc(t().metaPeriod)}</div>
      <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${t().metaL1}<br>${t().metaL2}</div>
      <div class="faq-block"><div class="faq-head"><span class="faq-title">${t().faqTitle}</span><span class="faq-sub">${t().faqSub}</span></div>${faq}</div>
      <div class="faq-source">${t().siteBy} · <a href="../" style="color:var(--accent)">japan.ouuut.com</a> · <a href="../quake/" style="color:var(--accent)">${t().navQuake}</a> · <a href="../crime/" style="color:var(--accent)">${t().navCrime}</a></div>
    </div>`;
}

function renderCard() {
  const card = $el("hsg-card");
  if (!card) return;
  if (mode === "muni" && selWard) {
    card.innerHTML = `<div class="panel-card">${wardCardHtml(selWard)}</div>` + rankingHtml() + metaHtml();
  } else if (selTown != null) {
    const x = TOWNS[selTown];
    card.innerHTML = `<div class="panel-card">${townCardHtml(selTown)}</div>` + `<div class="panel-card">${wardCardHtml(x.ward)}</div>` + rankingHtml() + metaHtml();
  } else {
    card.innerHTML = rankingHtml() + metaHtml();
  }
}

// 点击区域后平滑飞到该区域：留出右侧卡片/底部抽屉的余量，缩放到刚好装下
function restyleSel() {
  if (townLayer) townLayer.setStyle(styleTown);
  if (wardLayer) wardLayer.setStyle(styleWard);
}
function endFly() { if (!flying) return; flying = false; restyleSel(); }
function flyToBounds(b, maxZoom) {
  if (!map || !b || (b.isValid && !b.isValid())) return;
  userNavigated = true;
  // 飞入期间先撤掉选中描边（缩放动画会把 3px 放大成十几像素的粗框），落定再补回
  flying = true;
  restyleSel();
  map.once("moveend", endFly);
  setTimeout(endFly, 1400);
  const size = map.getSize();
  const desktop = size.x >= 900;
  const opts = {
    paddingTopLeft: desktop ? [56, 84] : [20, 84],
    paddingBottomRight: desktop ? [404, 56] : [20, Math.round(size.y * 0.46)],
    maxZoom: desktop ? maxZoom : Math.max(9, maxZoom - 1),
    animate: true,
    duration: 0.65,
    easeLinearity: 0.45,
  };
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  // 让本次点击的样式/卡片先落一帧，再开始动画，避免「先卡一下再走」
  const go = () => { if (reduce) map.fitBounds(b, opts); else map.flyToBounds(b, opts); };
  requestAnimationFrame(() => requestAnimationFrame(go));
}

function townBounds(i) {
  const f = townsDoc && townsDoc.geo && townsDoc.geo.features.find((y) => y.properties.i === i);
  return f ? L.geoJSON(f).getBounds() : null;
}
function wardBounds(name) {
  const f = MUNI_POLY && MUNI_POLY.features.find((y) => y.properties.ward_ja === name);
  return f ? L.geoJSON(f).getBounds() : null;
}

const CAPSULE_LIFT = 84;
const RM_MOTION = (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);

// 选中气泡：锚点圆 + 三环长脉冲 + 上浮胶囊（与犯罪率章同款）
function showCallout(name, tag, value, anchor) {
  const svg = $el("hsg-lx-svg"), cap = $el("hsg-lx-capsule");
  if (!svg || !cap || !name || !map) return;
  if (anchor) lastAnchor = anchor;
  if (!lastAnchor) return;
  const pt = map.latLngToContainerPoint(lastAnchor);
  const vw = window.innerWidth, vh = window.innerHeight;
  svg.setAttribute("width", vw); svg.setAttribute("height", vh);
  svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  const RING = RM_MOTION ? "" :
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>` +
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>` +
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>`;
  svg.innerHTML = `<circle class="lx-dot" cx="${pt.x}" cy="${pt.y}" r="4"/>` + RING;
  const t0 = t();
  const lvl = tag === "ward" ? t0.levelWard : t0.levelChome;
  const num = value != null ? fmt(value, 1) : "—";
  cap.dataset.lvlKey = tag;
  cap.dataset.placeName = name;
  cap.innerHTML = `<span class="lx-lvl">${esc(lvl)}</span>` +
    `<span class="lx-name">${esc(name)}</span>` +
    `<span class="lx-num"><span class="lx-val">${num}</span><span class="lx-unit">${esc(metric === "unit" ? t0.unitRate : t0.unitTotal)}</span></span>`;
  cap.setAttribute("role", "status");
  placeCapsule(pt);
  cap.classList.remove("on");
  if (RM_MOTION) { cap.classList.add("on"); return; }
  void cap.offsetWidth;
  svg.querySelectorAll(".lx-ring").forEach((c, i) => {
    c.animate([{ opacity: 0.85, r: 6 }, { opacity: 0, r: 108 }],
      { duration: 2000, delay: i * 620, iterations: 3, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
  });
  requestAnimationFrame(() => cap.classList.add("on"));
}
// 地图视野变化时标注跟随
function refreshCallout() {
  const svg = $el("hsg-lx-svg"), cap = $el("hsg-lx-capsule");
  if (!svg || !cap || !lastAnchor || !map) return;
  if (!cap.classList.contains("on")) return;
  const pt = map.latLngToContainerPoint(lastAnchor);
  svg.querySelectorAll("circle").forEach((c) => { c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y); });
  placeCapsule(pt);
}

// 气泡按锚点居中，但必须夹在视口内——窄屏贴边时旧实现会整块出屏（390 宽实测左右各裁 93px）
function placeCapsule(pt) {
  const cap = $el("hsg-lx-capsule");
  if (!cap) return;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const half = (cap.offsetWidth || 200) / 2;
  const x = Math.max(half + 8, Math.min(vw - half - 8, pt.x));
  cap.style.left = x + "px";
  cap.style.top = (pt.y - CAPSULE_LIFT) + "px";
  cap.dataset.anchorX = String(Math.round(pt.x - x));
}

function selectTown(i, fly, anchor) {
  selTown = i; selWard = null; mode = "chome";
  syncDropdown("mode", t().modes.chome);
  applyMode();
  townLayer.setStyle(styleTown);
  renderCard();
  const x = TOWNS[i];
  if (x.n) moveHistCursor(townVal(x), townName(x));
  if (fly) flyToBounds(townBounds(i), 13);
  if (anchor || fly) {
    const b = townBounds(i);
    showCallout(townName(x), "chome", x.n ? townVal(x) : null, anchor || (b && b.getCenter()));
  }
}

function selectWardByName(name, anchor) {
  selWard = name; selTown = null; mode = "muni";
  syncDropdown("mode", t().modes.muni);
  applyMode();
  wardLayer.setStyle(styleWard);
  renderCard();
  const v = wardVal(name);
  if (v != null) moveHistCursor(v, name);
  flyToBounds(wardBounds(name), 11.75);
  const wb = wardBounds(name);
  showCallout(name, "ward", v, anchor || (wb && wb.getCenter()));
}

// ---- controls -----------------------------------------------------------
const DD_CARET = '<svg class="dd-caret" viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>';

function ddHtml(key, current, items) {
  const opts = items.map(([k, n]) =>
    `<button type="button" class="dd-opt${k === current ? " on" : ""}" data-dd-key="${k}" role="option" aria-selected="${k === current}">${esc(n)}</button>`).join("");
  return `<div class="hsg-dd" data-dd="${key}">`
    + `<button type="button" class="hsg-dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="dd-label">${esc(items.find((x) => x[0] === current)?.[1] || "")}</span>${DD_CARET}</button>`
    + `<div class="hsg-dd-menu" role="listbox">${opts}</div></div>`;
}

function controlsHtml() {
  const t0 = t();
  return ddHtml("metric", metric, Object.entries(t0.metrics))
    + ddHtml("mode", mode, [["muni", t0.modes.muni], ["chome", t0.modes.chome]])
    + `<input id="hsg-q" class="hsg-q" type="search" placeholder="${esc(t0.searchPh)}" autocomplete="off">`;
}

function mountControls(box) {
  const label = isZh(curLang) ? zhx(curLang, "筛选") : curLang === "en" ? "Filter" : "絞り込み";
  box.innerHTML = `<button type="button" class="hsg-ctl-toggle" aria-expanded="false" aria-label="${label}"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 4h12M4 8h8M6.5 12h3"/></svg><span>${label}</span></button>`
    + `<div class="hsg-ctl">${controlsHtml()}</div>`;
  const tg = box.querySelector(".hsg-ctl-toggle");
  if (tg) tg.addEventListener("click", () => { const open = box.classList.toggle("is-open"); tg.setAttribute("aria-expanded", String(open)); });
  bindControls();
}

function syncDropdown(key, label) {
  const dd = document.querySelector('.hsg-dd[data-dd="' + key + '"]');
  if (!dd) return;
  const lab = dd.querySelector(".dd-label");
  if (lab && label != null) lab.textContent = label;
  dd.querySelectorAll(".dd-opt").forEach((o) => {
    const on = key === "metric" ? o.getAttribute("data-dd-key") === metric : o.getAttribute("data-dd-key") === mode;
    o.classList.toggle("on", on);
    o.setAttribute("aria-selected", String(on));
  });
}

function closeDropdowns(except) {
  $qa(".hsg-dd.open").forEach((dd) => { if (dd !== except) { dd.classList.remove("open"); const b = dd.querySelector(".hsg-dd-btn"); if (b) b.setAttribute("aria-expanded", "false"); } });
}

function bindControls() {
  $qa(".hsg-dd").forEach((dd) => {
    const key = dd.getAttribute("data-dd");
    const btn = dd.querySelector(".hsg-dd-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains("open");
      closeDropdowns(dd);
      dd.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    dd.querySelectorAll(".dd-opt").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = opt.getAttribute("data-dd-key");
        dd.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        if (key === "metric") {
          if (v === metric) return;
          metric = v;
          syncDropdown("metric", t().metrics[v]);
          buildScale(); updateLegendBar(); updateHistogram();
          if (mode === "muni") wardLayer.setStyle(styleWard); else townLayer.setStyle(styleTown);
          renderCard();
        } else if (key === "mode") {
          if (v === mode) return;
          mode = v;
          syncDropdown("mode", v === "muni" ? t().modes.muni : t().modes.chome);
          if (mode === "muni") { selTown = null; applyMode(); wardLayer.setStyle(styleWard); renderCard(); }
          else { selWard = null; applyMode(); townLayer.setStyle(styleTown); renderCard(); }
          buildScale(); updateLegendBar(); updateHistogram();
        }
      });
    });
  });
  if (!window.__hsgDdBound) {
    window.__hsgDdBound = true;
    document.addEventListener("click", () => closeDropdowns(null));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdowns(null); });
  }
  const q = $el("hsg-q");
  if (q && !q.__hsgBound) {
    q.__hsgBound = true;
    q.addEventListener("input", onSearch);
    q.addEventListener("blur", () => setTimeout(() => { const d = $el("hsg-drop"); if (d) d.style.display = "none"; }, 150));
  }
}

function onSearch(e) {
  const drop = $el("hsg-drop");
  const q = (e.target.value || "").trim();
  if (!drop) return;
  if (!q) { drop.style.display = "none"; return; }
  const hits = TOWNS.filter((x) => x.n && (townName(x).includes(q) || x.town.includes(q))).slice(0, 10);
  const host = rootEl.getBoundingClientRect(), ri = e.target.getBoundingClientRect();
  if (!hits.length) {
    drop.style.left = ri.left - host.left + "px";
    drop.style.top = ri.bottom - host.top + 4 + "px";
    drop.style.width = ri.width + "px";
    drop.style.display = "block";
    drop.innerHTML = `<div class="drop-empty">${esc(t().noResults)}</div>`;
    return;
  }
  drop.style.left = ri.left - host.left + "px";
  drop.style.top = ri.bottom - host.top + 4 + "px";
  drop.style.width = ri.width + "px";
  drop.style.display = "block";
  drop.innerHTML = hits.map((h) => `<div data-i="${h.i}">${esc(h.ward + h.town)}</div>`).join("");
  drop.querySelectorAll("div").forEach((d) => d.addEventListener("click", () => {
    const i = +d.getAttribute("data-i");
    selectTown(i, true);
    drop.style.display = "none";
    try { e.target.value = townName(TOWNS[i]); } catch (err) {}
  }));
}

function onCardClick(e) {
  if (!e.target || !e.target.closest) return;
  const w = e.target.closest("[data-hsg-ward]");
  if (w) { selectWardByName(w.getAttribute("data-hsg-ward")); return; }
  const tn = e.target.closest("[data-hsg-town]");
  if (tn) selectTown(+tn.getAttribute("data-hsg-town"), true);
}

// ---- theme/lang ---------------------------------------------------------
function applyVariant(v) {
  curVariant = v;
  if (rootEl) rootEl.setAttribute("data-hsg-variant", v);
  if (map) {
    buildScale(); updateLegendBar(); updateHistogram();
    if (townLayer) townLayer.setStyle(styleTown);
    if (wardLayer) wardLayer.setStyle(styleWard);
  }
}

// ---- boot ---------------------------------------------------------------
export async function mountHousing(el, opts) {
  opts = opts || {};
  if (mounted) unmountHousing();
  const my = ++bootSeq;
  rootEl = el;
  el.innerHTML = '<div id="hsg-root"></div>';
  rootEl = el.querySelector("#hsg-root");
  try { rootEl.style.cssText = "position:absolute;inset:0"; } catch (e) {}
  rootEl.innerHTML = SKELETON;
  curLang = I18N[opts.lang] ? opts.lang : "ja";
  curVariant = THEME_MAP[opts.theme] || "editorial";
  rootEl.setAttribute("data-hsg-variant", curVariant);
  loadCss();

  const ldr = $el("hsg-app-loader");
  if (ldr) { $el("hsg-loader-title").textContent = t().loadingTitle; $el("hsg-loader-status").textContent = t().loadingStatus; }

  if (!controlsRoot || !controlsRoot.isConnected) {
    const host = document.createElement("div");
    host.id = "hsg-ctl-host";
    rootEl.appendChild(host);
    controlsRoot = host;
  }
  mountControls(controlsRoot);

  aborter = new AbortController();
  try {
    L = await loadLeaflet();
    const base = (opts.base || "/") + "app/housing/data/";
    const [townsRes, muniRes] = await Promise.all([
      fetch(base + "towns.json", { signal: aborter.signal, cache: "no-cache" }),
      fetch((opts.base || "/") + "app/crime/data/muni_poly.json", { signal: aborter.signal, cache: "no-cache" }),
    ]);
    if (!townsRes.ok) throw new Error("towns.json " + townsRes.status);
    townsDoc = await townsRes.json();
    TOWNS = townsDoc.towns;
    const muni = muniRes.ok ? await muniRes.json() : { features: [] };
    MUNI_POLY = { type: "FeatureCollection", features: muni.features.filter((f) => f.properties && f.properties.ward_ja) };
    BY_WARD = {};
    BY_NAME = {};
    for (const x of TOWNS) { (BY_WARD[x.ward] = BY_WARD[x.ward] || []).push(x); BY_NAME[x.ward + x.town] = x; }
    if (my !== bootSeq) return false;

    buildScale(); updateLegendBar(); updateHistogram();
    initMap();
    initZoomSlider();
    $el("hsg-card").addEventListener("click", onCardClick);
    setLanguage(curLang);
    try {
      const top = TOWNS.filter((x) => x.n).sort((a, b) => townVal(b) - townVal(a))[0];
      if (top) selectTown(top.i, false);
    } catch (e) {}
    renderCard();

    if (ldr) { ldr.classList.add("fade-out"); setTimeout(() => { if (ldr.parentNode) ldr.remove(); }, 700); }
    mounted = true;
    return true;
  } catch (e) {
    if (ldr) { ldr.classList.add("fade-out"); setTimeout(() => { if (ldr.parentNode) ldr.remove(); }, 500); }
    try { if (window.pjStageFailed) window.pjStageFailed(rootEl, t().loadFailed); } catch (_) {}
    throw e;
  }
}

export function unmountHousing() {
  bootSeq++;
  if (aborter) { try { aborter.abort(); } catch (e) {} aborter = null; }
  try { if (map) { map.remove(); } } catch (e) {}
  map = null; townLayer = null; wardLayer = null; labelLayer = null; lastAnchor = null; userNavigated = false;
  if (rootEl) { try { rootEl.innerHTML = ""; } catch (e) {} }
  const st = document.getElementById("hsg-style"); if (st) st.remove();
  const lk = document.getElementById("hsg-leaflet-css"); if (lk) lk.remove();
  rootEl = null; controlsRoot = null; mounted = false;
}

export function setHousingLang(lang) { if (!I18N[lang]) return false; curLang = lang; if (rootEl) setLanguage(lang); return true; }
export function setHousingTheme(th) { applyVariant(THEME_MAP[th] || "editorial"); return curVariant; }
export function isHousingMounted() { return mounted; }
export function resetHousingView() { if (map) fitTokyo23(); }
export function getHousingLegend() { return SCALE ? { breaks: SCALE.breaks.slice(), hi: SCALE.hi } : null; }
export function selectHousingTown(name) { const x = BY_NAME[name]; if (x) { selectTown(x.i, true); return true; } return false; }

function setLanguage(lang) {
  if (!I18N[lang]) return;
  curLang = lang;
  if (rootEl) rootEl.lang = lang;
  if (controlsRoot) mountControls(controlsRoot);
  const per = $el("hsg-inst-period");
  if (per) { per.textContent = t().period; per.title = t().periodTip; }
  if (SCALE) { updateLegendBar(); updateHistogram(); renderCard(); }
}
