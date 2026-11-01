// 人口 —— 1,719 市町村を、等面積の「数」と人口加重の「重さ」で切り替える。
// データは 2025 年国勢調査（2026-09-29 公表）と社人研 2023 年推計。
// 地図は使わない。格子とツリーマップの二態、年齢金字塔は静的 SVG が担当する。

const CSS_HREF = "/app/population/app.css";
const DATA_URL = "/app/population/data/population.json";
const COLS = 54, ROWS = 32;

const I18N = {
  ja: {
    metrics: { rate: "増減", pop: "人口", age65: "65+", proj: "2050" },
    views: { grid: "同じ大きさ", tree: "人口の大きさ" },
    searchPh: "市町村を検索…",
    headline: {
      rateGrid: "の市町村が減少", rateTree: "は減少市町村に住む",
      popGrid: "市町村", popTree: "は上位10市町村",
      ageGrid: "が65歳以上", ageTree: "が65歳以上",
      projGrid: "2050年 / 2020年=100", projTree: "2050年の人口",
    },
    headlineSub: {
      rateGrid: "1,568 / 1,719 市町村。減った市町村に 73.4% が住む。",
      rateTree: "減った市町村に住む人の割合。",
      popGrid: "1,719 市町村の合計。",
      popTree: "人口上位 10 市町村に住む人の割合。",
      ageGrid: "全国の 65 歳以上人口の割合。",
      ageTree: "全国の 65 歳以上人口の割合。",
      projGrid: "2050 年の推計人口（2020 年=100）。",
      projTree: "2050 年の推計人口。",
    },
    card: {
      national: "日本", pref: "都道府県", munis: "市町村",
      pop: "人口", change: "2020→2025", age65: "65歳以上",
      hh: "一般世帯", avgHH: "1世帯当たり", foreign: "外国人",
      proj: "2050年", index: "2050年指数", density: "人口密度",
      rank: "人口順", of: "位 / 1,719", noProj: "浜通り地域として一括推計",
      age0: "0–14", age15: "15–64", age65s: "65+",
      source: "総務省統計局 · 2025 / 社人研 · 2050",
      close: "閉じる",
    },
    legend: {
      rate: "減少 ← 0 → 増加", pop: "少 ← 人口 → 多",
      age65: "低 ← 65歳以上 → 高", proj: "縮小 ← 2020=100 → 拡大",
      unitRate: "2020→2025 増減率", unitPop: "2025年人口", unitAge: "65歳以上比率", unitProj: "2050年指数",
    },
    hint: "点で選ぶ · 検索で飛ぶ",
    munisUnit: "市町村",
    stations: { tokyo: "東京", akita: "秋田" },
    tooltip: { pop: "人", rate: "2020→2025" },
    noData: "—",
  },
  zh: {
    metrics: { rate: "增减", pop: "人口", age65: "65+", proj: "2050" },
    views: { grid: "等大", tree: "按人口" },
    searchPh: "搜索市町村…",
    headline: {
      rateGrid: "的市町村在减少", rateTree: "住在减少的市町村",
      popGrid: "市町村", popTree: "集中在前10市町村",
      ageGrid: "为65岁以上", ageTree: "为65岁以上",
      projGrid: "2050年 / 2020年=100", projTree: "2050年人口",
    },
    headlineSub: {
      rateGrid: "1,568 / 1,719 个市町村。减少的市町村住着 73.4% 的人。",
      rateTree: "减少的市町村所住人口的比例。",
      popGrid: "1,719 个市町村的合计。",
      popTree: "人口前 10 市町村所住人口的比例。",
      ageGrid: "全国 65 岁以上人口的比例。",
      ageTree: "全国 65 岁以上人口的比例。",
      projGrid: "2050 年推算人口（2020 年=100）。",
      projTree: "2050 年推算人口。",
    },
    card: {
      national: "日本", pref: "都道府县", munis: "市町村",
      pop: "人口", change: "2020→2025", age65: "65岁以上",
      hh: "一般世带", avgHH: "每户", foreign: "外国人",
      proj: "2050年", index: "2050年指数", density: "人口密度",
      rank: "人口排名", of: "位 / 1,719", noProj: "滨通地区统一推算",
      age0: "0–14", age15: "15–64", age65s: "65+",
      source: "总务省统计局 · 2025 / 社人研 · 2050",
      close: "关闭",
    },
    legend: {
      rate: "减少 ← 0 → 增加", pop: "少 ← 人口 → 多",
      age65: "低 ← 65岁以上 → 高", proj: "缩小 ← 2020=100 → 扩大",
      unitRate: "2020→2025 增减率", unitPop: "2025年人口", unitAge: "65岁以上比例", unitProj: "2050年指数",
    },
    hint: "点选 · 搜索跳转",
    munisUnit: "个市町村",
    stations: { tokyo: "东京", akita: "秋田" },
    tooltip: { pop: "人", rate: "2020→2025" },
    noData: "—",
  },
  en: {
    metrics: { rate: "Change", pop: "Population", age65: "65+", proj: "2050" },
    views: { grid: "Equal cells", tree: "By people" },
    searchPh: "Search a municipality…",
    headline: {
      rateGrid: "of municipalities are shrinking", rateTree: "of people live in shrinking municipalities",
      popGrid: "municipalities", popTree: "live in the top 10 municipalities",
      ageGrid: "are 65 or older", ageTree: "are 65 or older",
      projGrid: "2050 / 2020 = 100", projTree: "people in 2050",
    },
    headlineSub: {
      rateGrid: "1,568 of 1,719 municipalities. 73.4% of people live in the shrinking ones.",
      rateTree: "Share of people living in shrinking municipalities.",
      popGrid: "The 1,719 municipalities combined.",
      popTree: "Share of people in the top 10 municipalities.",
      ageGrid: "Share of the national population aged 65+.",
      ageTree: "Share of the national population aged 65+.",
      projGrid: "Projected population in 2050 (2020 = 100).",
      projTree: "Projected population in 2050.",
    },
    card: {
      national: "Japan", pref: "Prefecture", munis: "Municipalities",
      pop: "Population", change: "2020→2025", age65: "65+",
      hh: "Households", avgHH: "Per household", foreign: "Foreign residents",
      proj: "2050", index: "2050 index", density: "Density",
      rank: "Population rank", of: "of 1,719", noProj: "Grouped as Hamadori in the projection",
      age0: "0–14", age15: "15–64", age65s: "65+",
      source: "Statistics Bureau · 2025 / IPSS · 2050",
      close: "Close",
    },
    legend: {
      rate: "Shrink ← 0 → Grow", pop: "Low ← Population → High",
      age65: "Low ← 65+ share → High", proj: "Shrink ← 2020=100 → Grow",
      unitRate: "2020→2025 change", unitPop: "2025 population", unitAge: "65+ share", unitProj: "2050 index",
    },
    hint: "Click a cell · Search to jump",
    munisUnit: "municipalities",
    stations: { tokyo: "Tokyo", akita: "Akita" },
    tooltip: { pop: "people", rate: "2020→2025" },
    noData: "—",
  },
};

const SKELETON = `
<div id="pop-app" class="pop-app">
  <div class="pop-toolbar">
    <div class="pop-metrics" role="group" aria-label="Metric">
      <button type="button" data-metric="rate" aria-pressed="true"></button>
      <button type="button" data-metric="pop" aria-pressed="false"></button>
      <button type="button" data-metric="age65" aria-pressed="false"></button>
      <button type="button" data-metric="proj" aria-pressed="false"></button>
    </div>
    <div class="pop-views" role="group" aria-label="View">
      <button type="button" data-view="grid" aria-pressed="true"></button>
      <button type="button" data-view="tree" aria-pressed="false"></button>
    </div>
    <div class="pop-searchwrap">
      <input id="pop-search" type="search" autocomplete="off" aria-label="Search">
      <ul id="pop-results" class="pop-results" hidden></ul>
    </div>
  </div>
  <div class="pop-headline" aria-live="polite">
    <div class="pop-headline-main"><b id="pop-headline"></b><span id="pop-headline-label"></span></div>
    <p class="pop-headline-sub" id="pop-headline-sub"></p>
  </div>
  <div class="pop-canvas-wrap">
    <canvas id="pop-canvas"></canvas>
    <div id="pop-tooltip" class="pop-tooltip" hidden></div>
  </div>
  <aside id="pop-card" class="pop-card" aria-live="polite">
    <button type="button" class="pop-card-close" id="pop-card-close" aria-label="Close">×</button>
    <div id="pop-card-body"></div>
  </aside>
  <div class="pop-legend" id="pop-legend"></div>
  <div class="pop-hint" id="pop-hint"></div>
</div>`;

let rootEl = null, appEl = null, canvas = null, ctx = null, wrapEl = null;
let cardEl = null, cardBody = null, tooltipEl = null, headlineEl = null, headlineLabelEl = null;
let legendEl = null, searchEl = null, resultsEl = null;
let DOC = null, MUNIS = [], PREFS = [], BY_CODE = {}, BY_PREF = {}, PREF_BY = {};
let POP_MIN = 1, POP_MAX = 1;
let W = 0, H = 0, DPR = 1;
let lang = "ja", theme = "sage", metric = "rate", view = "grid";
let sel = null, hover = null;           // {type:"muni"|"pref", code}
let anim = 0, animRaf = 0, animFrom = 0, animTo = 0, animStart = 0;
let rects = [];                          // [{m, g, t}]
let ribbon = [];                         // [{p, x, w}]
let pad = { l: 24, r: 340, t: 104, b: 24 };
let scale = { rate: 10, age65: [20, 55], proj: [50, 140] };
let dirty = false, raf = 0;
let mounted = false;

const $ = (id) => (rootEl ? rootEl.querySelector("#" + id) : document.getElementById(id));
const t = () => I18N[lang] || I18N.ja;
const fmt = (x, d = 0) => (x == null || isNaN(x) ? "—" : Number(x).toLocaleString("en-US", {
  maximumFractionDigits: d, minimumFractionDigits: d,
}));
const pct = (x, d = 1) => (x == null || isNaN(x) ? "—" : Number(x).toFixed(d) + "%");
const signed = (x, d = 1) => (x == null || isNaN(x) ? "—" : (x > 0 ? "+" : "") + Number(x).toFixed(d) + "%");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;

function loadCss() {
  if (document.getElementById("pop-style")) return;
  let v = "";
  try { v = new URL(import.meta.url).searchParams.get("v") || ""; } catch (e) {}
  const lk = document.createElement("link");
  lk.id = "pop-style"; lk.rel = "stylesheet";
  lk.href = CSS_HREF + (v ? "?v=" + v : "");
  document.head.appendChild(lk);
}

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = (k, fallback) => (cs.getPropertyValue(k) || fallback).trim();
  return {
    ink: g("--ink", "#1A1A16"),
    muted: g("--muted", "#5B5A53"),
    accent: g("--accent", "#A165AE"),
    bg: g("--bg", "#F5F3ED"),
    surface: g("--surface", "rgba(23,33,26,.045)"),
  };
}
let C = {};

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
}

function computeScales() {
  const rates = MUNIS.map((m) => m.rate).filter((x) => x != null).map(Math.abs).sort((a, b) => a - b);
  const ages = MUNIS.map((m) => m.age65Share).filter((x) => x != null).sort((a, b) => a - b);
  const projs = MUNIS.map((m) => m.index2050).filter((x) => x != null).sort((a, b) => a - b);
  scale.rate = clamp(quantile(rates, 0.98), 2, 12);
  scale.age65 = [quantile(ages, 0.02), quantile(ages, 0.98)];
  scale.proj = [quantile(projs, 0.02), quantile(projs, 0.98)];
}

function layout() {
  const cw = wrapEl.clientWidth || 1;
  const ch = wrapEl.clientHeight || 1;
  W = cw; H = ch;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const mobile = W < 720;
  pad = mobile ? { l: 12, r: 12, t: 228, b: 18 } : { l: 24, r: 340, t: 158, b: 48 };
  const innerW = Math.max(40, W - pad.l - pad.r);
  const innerH = Math.max(40, H - pad.t - pad.b);

  // grid: 54 x 32, ribbon above
  const ribbonH = 10, ribbonGap = 8;
  const cell = Math.max(2, Math.min(innerW / COLS, (innerH - ribbonH - ribbonGap) / ROWS));
  const gx0 = pad.l + (innerW - COLS * cell) / 2;
  const gy0 = pad.t + ribbonH + ribbonGap + Math.max(0, (innerH - ribbonH - ribbonGap - ROWS * cell) / 2);

  // treemap: 1000 x 620, fit inside
  const ts = Math.min(innerW / 1000, innerH / 620);
  const tx0 = pad.l + (innerW - 1000 * ts) / 2;
  const ty0 = pad.t + (innerH - 620 * ts) / 2;

  rects = MUNIS.map((m) => {
    const g = {
      x: gx0 + m.gx * cell + 0.5,
      y: gy0 + m.gy * cell + 0.5,
      w: Math.max(1, cell - 1.2),
      h: Math.max(1, cell - 1.2),
    };
    const tr = {
      x: tx0 + m.tx * ts,
      y: ty0 + m.ty * ts,
      w: Math.max(0.6, m.tw * ts - 0.8),
      h: Math.max(0.6, m.th * ts - 0.8),
    };
    return { m, g, t: tr };
  });

  // ribbon: 47 segments, width = number of municipalities
  const total = PREFS.reduce((s, p) => s + p.n, 0) || 1;
  let x = pad.l;
  ribbon = PREFS.map((p) => {
    const w = innerW * p.n / total;
    const seg = { p, x, w: Math.max(1, w - 1), y: pad.t, h: ribbonH };
    x += w;
    return seg;
  });

  draw();
}

function colorFor(m) {
  let fill = C.muted, alpha = 0.18;
  if (metric === "rate") {
    if (m.rate == null) return [C.muted, 0.16];
    if (m.rate === 0) return [C.muted, 0.14];
    const t = clamp(Math.abs(m.rate) / scale.rate, 0, 1);
    const k = Math.min(3, Math.floor(t * 4));
    if (m.rate > 0) return [C.accent, [0.55, 0.70, 0.85, 0.98][k]];
    return [C.ink, [0.08, 0.14, 0.20, 0.28][k]];
  }
  if (metric === "pop") {
    const v = Math.max(1, m.pop || 1);
    const p = (Math.log(v) - Math.log(POP_MIN)) / (Math.log(POP_MAX) - Math.log(POP_MIN));
    return [C.accent, 0.10 + 0.86 * clamp(p, 0, 1)];
  }
  if (metric === "age65") {
    const [lo, hi] = scale.age65;
    const p = (m.age65Share - lo) / Math.max(1, hi - lo);
    const k = Math.min(3, Math.floor(clamp(p, 0, 1) * 4));
    return [C.accent, [0.12, 0.32, 0.55, 0.85][k]];
  }
  if (metric === "proj") {
    if (m.index2050 == null) return [C.muted, 0.16];
    const p = m.index2050 - 100;
    const k = Math.min(3, Math.floor(clamp(Math.abs(p) / 40, 0, 1) * 4));
    if (p >= 0) return [C.accent, [0.35, 0.55, 0.75, 0.95][k]];
    return [C.ink, [0.10, 0.18, 0.28, 0.40][k]];
  }
  return [fill, alpha];
}

function currentRect(r) {
  const p = anim;
  return {
    x: lerp(r.g.x, r.t.x, p),
    y: lerp(r.g.y, r.t.y, p),
    w: lerp(r.g.w, r.t.w, p),
    h: lerp(r.g.h, r.t.h, p),
  };
}

function draw() {
  raf = 0;
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const a = anim;

  // ribbon fades out as the treemap takes over
  if (a < 0.999) {
    ctx.save();
    ctx.globalAlpha = 1 - a;
    for (const s of ribbon) {
      const r = s.p.rate || 0;
      const fill = r > 0 ? C.accent : C.ink;
      const alpha = r === 0 ? 0.18 : 0.22 + 0.62 * clamp(Math.abs(r) / scale.rate, 0, 1);
      ctx.globalAlpha = (1 - a) * alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.globalAlpha = 1 - a;
    ctx.fillStyle = C.muted;
    ctx.font = '10px "Geist","Noto Sans JP",system-ui,sans-serif';
    ctx.textBaseline = "bottom";
    for (const code of ["01", "13", "27", "40", "47"]) {
      const s = ribbon.find((x) => x.p.code === code);
      if (!s) continue;
      const label = { "01": "北海道", "13": "東京", "27": "大阪", "40": "福岡", "47": "沖縄" }[code];
      const x = clamp(s.x + s.w / 2, pad.l + 12, W - pad.r - 12);
      ctx.textAlign = "center";
      ctx.fillText(label, x, s.y - 3);
    }
    ctx.restore();
  }

  // cells
  for (const r of rects) {
    const q = currentRect(r);
    const [fill, alpha] = colorFor(r.m);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(q.x, q.y, q.w, q.h);
  }
  ctx.globalAlpha = 1;

  // selected / hovered outlines
  const marks = [];
  if (sel && sel.type === "muni") {
    const r = rects.find((x) => x.m.code === sel.code);
    if (r) marks.push([currentRect(r), 2.2, C.ink]);
  }
  if (hover && hover.type === "muni" && (!sel || sel.code !== hover.code || sel.type !== "muni")) {
    const r = rects.find((x) => x.m.code === hover.code);
    if (r) marks.push([currentRect(r), 1.4, C.muted]);
  }
  for (const [q, lw, color] of marks) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(q.x + 0.5, q.y + 0.5, Math.max(0, q.w - 1), Math.max(0, q.h - 1));
  }

  // two reading stations in the equal-cell rate view
  if (metric === "rate" && a < 0.55 && W >= 720) {
    ctx.save();
    ctx.font = '600 10px "Geist","Noto Sans JP",system-ui,sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const [code, label] of [["13100", t().stations.tokyo], ["05201", t().stations.akita]]) {
      const r = rects.find((x) => x.m.code === code);
      if (!r) continue;
      const q = r.g;
      const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
      const rad = Math.max(4, q.w * 0.85);
      ctx.globalAlpha = (1 - a) * 0.75;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      const tx = Math.min(W - pad.r - 30, cx + 16);
      ctx.globalAlpha = (1 - a) * 0.95;
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.bg;
      ctx.strokeText(label, tx, cy);
      ctx.fillStyle = C.ink;
      ctx.fillText(label, tx, cy);
    }
    ctx.restore();
  }

  // treemap labels for the five largest
  if (a > 0.65) {
    ctx.save();
    ctx.globalAlpha = (a - 0.65) / 0.35;
    ctx.fillStyle = C.ink;
    ctx.font = '11px "Geist","Noto Sans JP",system-ui,sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const code of ["13100", "1279", "2397", "2063", "0003"]) {
      const r = rects.find((x) => x.m.code === code);
      if (!r) continue;
      const q = r.t;
      if (q.w < 34 || q.h < 16) continue;
      ctx.fillText(r.m.name, q.x + q.w / 2, q.y + q.h / 2);
    }
    ctx.restore();
  }
}

function scheduleDraw() {
  if (raf) return;
  raf = requestAnimationFrame(draw);
}

function setView(next, immediate) {
  if (next !== "grid" && next !== "tree") return;
  if (next === view && !immediate) return;
  const to = next === "tree" ? 1 : 0;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (immediate || reduce) {
    view = next;
    anim = to;
    updateHeadline();
    updateLegend();
    updateButtons();
    draw();
    return;
  }
  animFrom = anim;
  animTo = to;
  animStart = performance.now();
  const dur = 430;
  const step = (now) => {
    const p = Math.min(1, (now - animStart) / dur);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    anim = animFrom + (animTo - animFrom) * e;
    draw();
    if (p < 1) {
      animRaf = requestAnimationFrame(step);
    } else {
      anim = animTo;
      view = next;
      animRaf = 0;
      updateHeadline();
      updateLegend();
      updateButtons();
      draw();
    }
  };
  animRaf = requestAnimationFrame(step);
}

function headlineData() {
  const n = DOC.meta.national;
  const S = t().headlineSub;
  if (metric === "rate") {
    return view === "tree"
      ? [pct(n.decliningShare), t().headline.rateTree, S.rateTree]
      : [pct(100 * n.declining / DOC.meta.n), t().headline.rateGrid, S.rateGrid];
  }
  if (metric === "pop") {
    return view === "tree"
      ? [pct(n.top10Share), t().headline.popTree, S.popTree]
      : [fmt(DOC.meta.n), t().headline.popGrid, S.popGrid];
  }
  if (metric === "age65") {
    return [pct(n.age65Share), view === "tree" ? t().headline.ageTree : t().headline.ageGrid, S.ageGrid];
  }
  return view === "tree"
    ? [fmt(n.pop2050), t().headline.projTree, S.projTree]
    : [fmt(n.index2050, 1), t().headline.projGrid, S.projGrid];
}

function updateHeadline() {
  const [num, label, sub] = headlineData();
  headlineEl.textContent = num;
  headlineLabelEl.textContent = label;
  const subEl = $("pop-headline-sub");
  if (subEl) subEl.textContent = sub;
}

function updateButtons() {
  rootEl.querySelectorAll("[data-metric]").forEach((b) => {
    b.textContent = t().metrics[b.dataset.metric];
    b.setAttribute("aria-pressed", String(b.dataset.metric === metric));
  });
  rootEl.querySelectorAll("[data-view]").forEach((b) => {
    b.textContent = t().views[b.dataset.view];
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  });
  searchEl.placeholder = t().searchPh;
  searchEl.setAttribute("aria-label", t().searchPh);
  $("pop-hint").textContent = t().hint + " · " + fmt(DOC.meta.n) + " " + t().munisUnit;
}

function updateLegend() {
  const L = t().legend;
  const label = metric === "rate" ? L.unitRate : metric === "pop" ? L.unitPop : metric === "age65" ? L.unitAge : L.unitProj;
  const scaleText = metric === "rate" ? L.rate : metric === "pop" ? L.pop : metric === "age65" ? L.age65 : L.proj;
  const parts = scaleText.split(/[←→]/).map((s) => s.trim());
  const left = parts[0] || "", mid = parts[1] || "", right = parts[2] || "";
  legendEl.innerHTML = `<span class="pop-legend-label">${label}</span>
    <span class="pop-legend-key">
      <span class="pop-legend-scale"><i class="lo"></i><i class="mid"></i><i class="hi"></i></span>
      <span class="pop-legend-ends"><span>${left}</span><span>${mid}</span><span>${right}</span></span>
    </span>`;
}

function rankOf(m) {
  return MUNIS.slice().sort((a, b) => b.pop - a.pop).findIndex((x) => x.code === m.code) + 1;
}
let RANK = {};

function ageBar(m) {
  const known = (m.age0 || 0) + (m.age15 || 0) + (m.age65 || 0);
  if (!known) return "";
  const p0 = 100 * m.age0 / known, p15 = 100 * m.age15 / known, p65 = 100 * m.age65 / known;
  return `<div class="pop-agebar" aria-hidden="true">
    <span style="flex:${p0}"></span><span style="flex:${p15}"></span><span style="flex:${p65}"></span>
  </div>
  <div class="pop-agekeys"><span>${t().card.age0} ${pct(p0)}</span><span>${t().card.age15} ${pct(p15)}</span><span>${t().card.age65s} ${pct(p65)}</span></div>`;
}

function cardHtml() {
  const T = t().card;
  const n = DOC.meta.national;
  if (sel && sel.type === "muni") {
    const m = BY_CODE[sel.code];
    if (m) {
      const p = PREF_BY[m.pref];
      const known = (m.age0 || 0) + (m.age15 || 0) + (m.age65 || 0);
      const proj = m.pop2050 == null
        ? `<span class="pop-null">${T.noProj}</span>`
        : `${fmt(m.pop2050)}<small>${T.pop}</small> <em>${fmt(m.index2050, 1)}</em><small class="pop-idx">2020=100</small>`;
      return `<p class="pop-card-kicker">${esc(p ? p.name : "")} · ${T.rank} ${RANK[m.code] || "—"} ${T.of}</p>
        <h3 class="pop-card-name">${esc(m.name)}</h3>
        <p class="pop-card-big">${fmt(m.pop)}<small>${T.pop}</small></p>
        <p class="pop-card-delta ${m.rate > 0 ? "up" : m.rate < 0 ? "down" : ""}">${signed(m.rate)} <span>${T.change}</span></p>
        <div class="pop-card-rows">
          <div><span>${T.age65}</span><b>${pct(m.age65Share)}</b></div>
          <div><span>${T.foreign}</span><b>${pct(m.foreignShare, 2)}</b></div>
          <div><span>${T.hh}</span><b>${fmt(m.households)}</b></div>
          <div><span>${T.density}</span><b>${fmt(m.density, 1)}<small>/km²</small></b></div>
        </div>
        ${ageBar(m)}
        <div class="pop-card-proj"><span>${T.proj}</span><b>${proj}</b></div>
        <p class="pop-card-foot">${T.source}</p>`;
    }
  }
  if (sel && sel.type === "pref") {
    const p = PREF_BY[sel.code];
    if (p) {
      return `<p class="pop-card-kicker">${T.pref} · ${T.munis} ${fmt(p.n)}</p>
        <h3 class="pop-card-name">${esc(p.name)}</h3>
        <p class="pop-card-big">${fmt(p.pop)}<small>${T.pop}</small></p>
        <p class="pop-card-delta ${p.rate > 0 ? "up" : "down"}">${signed(p.rate)} <span>${T.change}</span></p>
        <div class="pop-card-rows">
          <div><span>${T.age65}</span><b>${pct(p.age65Share)}</b></div>
          <div><span>${T.hh}</span><b>${fmt(p.households)}</b></div>
          <div><span>${T.density}</span><b>${fmt(p.density, 1)}<small>/km²</small></b></div>
          <div><span>${T.munis}</span><b>${fmt(p.n)}</b></div>
        </div>
        <div class="pop-card-proj"><span>${T.proj}</span><b>${fmt(p.pop2050)}<small>${T.pop}</small> <em>${fmt(p.index2050, 1)}</em><small class="pop-idx">2020=100</small></b></div>
        <p class="pop-card-foot">${T.source}</p>`;
    }
  }
  return `<p class="pop-card-kicker">2025-10-01 · ${fmt(DOC.meta.n)} ${T.munis}</p>
    <h3 class="pop-card-name">日本</h3>
    <p class="pop-card-big">${fmt(n.pop)}<small>${T.pop}</small></p>
    <p class="pop-card-delta ${n.rate > 0 ? "up" : "down"}">${signed(n.rate)} <span>${T.change}</span></p>
    <div class="pop-card-rows">
      <div><span>${T.age65}</span><b>${pct(n.age65Share)}</b></div>
      <div><span>${T.hh}</span><b>${fmt(n.households)}</b></div>
      <div><span>${T.foreign}</span><b>${fmt(n.foreign)}</b></div>
      <div><span>${T.density}</span><b>${fmt(n.density, 1)}<small>/km²</small></b></div>
    </div>
    <div class="pop-card-proj"><span>${T.proj}</span><b>${fmt(n.pop2050)}<small>${T.pop}</small> <em>${fmt(n.index2050, 1)}</em><small class="pop-idx">2020=100</small></b></div>
    <p class="pop-card-foot">${T.source}</p>`;
}

function updateCard() {
  cardBody.innerHTML = cardHtml();
  cardEl.classList.toggle("has-sel", !!sel);
  cardEl.classList.toggle("is-mobile-open", !!sel);
}

function setSel(next) {
  sel = next;
  updateCard();
  scheduleDraw();
  if (next) cardEl.classList.add("is-mobile-open");
  else cardEl.classList.remove("is-mobile-open");
}

function hitTest(x, y) {
  // ribbon
  if (anim < 0.5) {
    for (const s of ribbon) {
      if (y >= s.y - 4 && y <= s.y + s.h + 4 && x >= s.x && x <= s.x + s.w) {
        return { type: "pref", code: s.p.code };
      }
    }
  }
  let best = null;
  // larger treemap rects first for reliable hits
  const list = view === "tree" || anim > 0.5 ? rects.slice().sort((a, b) => b.t.w * b.t.h - a.t.w * a.t.h) : rects;
  for (const r of list) {
    const q = currentRect(r);
    if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) {
      if (view === "tree" || anim > 0.5) return { type: "muni", code: r.m.code };
      best = { type: "muni", code: r.m.code };
      break;
    }
  }
  return best;
}

function tooltipShow(ev, hit) {
  if (!hit) { tooltipEl.hidden = true; return; }
  const rect = wrapEl.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  let html = "";
  if (hit.type === "pref") {
    const p = PREF_BY[hit.code];
    if (!p) return;
    html = `<b>${esc(p.name)}</b><span>${fmt(p.pop)} ${t().tooltip.pop} · ${signed(p.rate)}</span>`;
  } else {
    const m = BY_CODE[hit.code];
    if (!m) return;
    html = `<b>${esc(m.name)}</b><span>${fmt(m.pop)} ${t().tooltip.pop} · ${signed(m.rate)}</span>`;
  }
  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;
  const tw = tooltipEl.offsetWidth || 160, th = tooltipEl.offsetHeight || 40;
  tooltipEl.style.left = clamp(x + 14, 8, W - tw - 8) + "px";
  tooltipEl.style.top = clamp(y - th - 10, 8, H - th - 8) + "px";
}

function onMove(ev) {
  if (!mounted) return;
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  const hit = hitTest(x, y);
  const same = (hit && hover && hit.type === hover.type && hit.code === hover.code) || (!hit && !hover);
  if (same) { tooltipShow(ev, hit); return; }
  hover = hit;
  tooltipShow(ev, hit);
  scheduleDraw();
}

function onLeave() {
  hover = null;
  tooltipEl.hidden = true;
  scheduleDraw();
}

function selectHit(hit) {
  if (!hit) { setSel(null); return; }
  setSel(hit);
}

function setupSearch() {
  const list = resultsEl;
  const close = () => { list.hidden = true; list.innerHTML = ""; };
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { close(); return; }
    const hits = MUNIS.filter((m) => (m.name + (PREF_BY[m.pref] ? PREF_BY[m.pref].name : "")).toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) { close(); return; }
    list.innerHTML = hits.map((m) => `<li><button type="button" data-code="${m.code}"><b>${esc(m.name)}</b><span>${esc(PREF_BY[m.pref] ? PREF_BY[m.pref].name : "")}</span></button></li>`).join("");
    list.hidden = false;
  });
  list.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-code]");
    if (!b) return;
    const m = BY_CODE[b.dataset.code];
    if (!m) return;
    setSel({ type: "muni", code: m.code });
    selectInView(m.code);
    searchEl.value = m.name;
    close();
  });
  searchEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { close(); searchEl.blur(); }
    if (ev.key === "Enter") {
      const b = list.querySelector("[data-code]");
      if (b) { ev.preventDefault(); b.click(); }
    }
  });
  document.addEventListener("click", (ev) => {
    if (!rootEl.contains(ev.target)) return;
    if (!ev.target.closest(".pop-searchwrap")) close();
  });
}

function selectInView(code) {
  const r = rects.find((x) => x.m.code === code);
  if (!r) return;
  // no pan/zoom in v1: the grid is always fully visible; flash the selection
  setSel({ type: "muni", code });
}

function setup() {
  MUNIS = DOC.munis;
  PREFS = DOC.prefs;
  POP_MIN = MUNIS.reduce((a, m) => Math.min(a, m.pop || Infinity), Infinity);
  POP_MAX = MUNIS.reduce((a, m) => Math.max(a, m.pop || 0), 0);
  BY_CODE = {};
  BY_PREF = {};
  PREF_BY = {};
  for (const m of MUNIS) BY_CODE[m.code] = m;
  for (const p of PREFS) {
    BY_PREF[p.code] = [];
    PREF_BY[p.code] = p;
    p.pop2050 = p.pop2050 || 0;
  }
  for (const m of MUNIS) { if (BY_PREF[m.pref]) BY_PREF[m.pref].push(m); }
  RANK = {};
  MUNIS.slice().sort((a, b) => b.pop - a.pop).forEach((m, i) => { RANK[m.code] = i + 1; });
  computeScales();

  appEl = $("pop-app");
  canvas = $("pop-canvas");
  ctx = canvas.getContext("2d");
  wrapEl = canvas.parentElement;
  cardEl = $("pop-card");
  cardBody = $("pop-card-body");
  tooltipEl = $("pop-tooltip");
  headlineEl = $("pop-headline");
  headlineLabelEl = $("pop-headline-label");
  legendEl = $("pop-legend");
  searchEl = $("pop-search");
  resultsEl = $("pop-results");
  C = readColors();

  rootEl.querySelectorAll("[data-metric]").forEach((b) => {
    b.addEventListener("click", () => {
      metric = b.dataset.metric;
      updateButtons();
      updateHeadline();
      updateLegend();
      scheduleDraw();
    });
  });
  rootEl.querySelectorAll("[data-view]").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.view));
  });
  $("pop-card-close").addEventListener("click", () => setSel(null));
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("click", (ev) => {
    const rect = canvas.getBoundingClientRect();
    selectHit(hitTest(ev.clientX - rect.left, ev.clientY - rect.top));
  });
  canvas.addEventListener("pointerdown", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(ev.clientX - rect.left, ev.clientY - rect.top);
    if (hit) setSel(hit);
  });

  setupSearch();
  updateButtons();
  updateHeadline();
  updateLegend();
  updateCard();

  const ro = new ResizeObserver(() => {
    layout();
    scheduleDraw();
  });
  ro.observe(wrapEl);
  window.addEventListener("resize", () => { layout(); scheduleDraw(); });

  mounted = true;
  layout();
}

export async function mountPopulation(el, opts) {
  rootEl = el;
  lang = (opts && opts.lang) || "ja";
  theme = (opts && opts.theme) || "sage";
  loadCss();
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("population data " + res.status);
  DOC = await res.json();
  rootEl.innerHTML = SKELETON;
  setup();
  return true;
}

export function setPopulationLang(l) {
  lang = l;
  if (!mounted) return;
  updateButtons();
  updateHeadline();
  updateLegend();
  updateCard();
  draw();
}

export function setPopulationTheme(t) {
  theme = t;
  if (!mounted) return;
  C = readColors();
  draw();
}
