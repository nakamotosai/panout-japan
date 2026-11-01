/* 内阁支持率 · 折线图方案实验室 —— 共用:数据、色板、字体、工具 */
window.LAB = (function () {
  var PALETTE = [
    '#e0863f', '#63b46f', '#4f8fd6', '#d2698f', '#d9b13b', '#8b7cd8', '#48b0a6',
    '#c9704f', '#a3bf4d', '#6f8ce0', '#d0507a', '#4fb98a', '#c9a03f', '#b47ad8'
  ];
  var SUR = {
    obuchi: '小渕', mori: '森', koizumi: '小泉', abe1: '安倍', fukuda: '福田',
    aso: '麻生', hatoyama: '鳩山', kan: '菅', noda: '野田', abe2: '安倍',
    suga: '菅', kishida: '岸田', ishiba: '石破', takaichi: '高市'
  };
  var FONT_JA = "'Yu Gothic UI','Hiragino Kaku Gothic ProN','Noto Sans JP',system-ui,sans-serif";
  var FONT_MINCHO = "'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP',serif";
  var T = {
    ink: '#eae7df', ink2: '#b9b6ad', muted: '#82867f', faint: '#5c605b',
    rule: 'rgba(255,255,255,.075)', grid: 'rgba(255,255,255,.055)',
    band: 'rgba(255,255,255,.030)', bandEdge: 'rgba(255,255,255,.10)'
  };
  var DAY = 86400000;
  var measure = (function () {
    var c = document.createElement('canvas').getContext('2d');
    return function (text, font) { c.font = font; return c.measureText(text).width; };
  })();

  function build(data) {
    var cabs = data.cabinets.map(function (c, i) {
      return {
        id: c.id, pm: c.pm, start: c.start, end: c.end,
        startT: Date.parse(c.start + 'T00:00:00Z'), endT: Date.parse(c.end + 'T00:00:00Z'),
        sur: SUR[c.id] || c.pm.slice(0, 2), color: PALETTE[i % PALETTE.length],
        idx: i, first: null, last: null, points: []
      };
    });
    var months = new Map();
    var tMin = Infinity, tMax = -Infinity;
    data.polls.forEach(function (p) {
      var t = Date.parse(p.date + 'T00:00:00Z');
      var cab = null;
      for (var i = 0; i < cabs.length; i++) { if (t >= cabs[i].startT && t < cabs[i].endT) { cab = cabs[i]; break; } }
      if (!cab) cab = cabs[cabs.length - 1];
      if (!cab.first || p.date < cab.first) cab.first = p.date;
      if (!cab.last || p.date > cab.last) cab.last = p.date;
      var ym = p.date.slice(0, 7);
      var key = cab.id + '|' + ym;
      var rec = months.get(key);
      if (!rec) { rec = { cab: cab, ym: ym, sum: 0, n: 0, src: 0 }; months.set(key, rec); }
      rec.sum += p.value; rec.n++; rec.src++;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    });
    months.forEach(function (r) {
      r.v = Math.round((r.sum / r.n) * 10) / 10;
      r.t = Date.parse(r.ym + '-15T00:00:00Z');
      r.cab.points.push([r.t, r.v, r.n]);
      if (!r.cab.span) r.cab.span = { first: r.ym + '-15', last: r.ym + '-15' };
    });
    cabs.forEach(function (c) {
      c.points.sort(function (a, b) { return a[0] - b[0]; });
      if (!c.span) c.span = { first: c.first || c.start, last: c.last || c.start };
      c.t0 = c.points.length ? c.points[0][0] : c.startT;
      c.t1 = c.points.length ? c.points[c.points.length - 1][0] : c.endT;
      c.edges = { d0: c.first || c.start, d1: c.last || c.last };
    });
    var all = [];
    cabs.forEach(function (c) { c.points.forEach(function (p) { all.push(p); }); });
    all.sort(function (a, b) { return a[0] - b[0]; });
    var latest = all[all.length - 1] || [tMax, 0, 0];
    return {
      cabs: cabs, all: all, tMin: tMin, tMax: tMax,
      years: new Set(all.map(function (p) { return new Date(p[0]).getUTCFullYear(); })),
      latest: latest,
      t0: Date.parse(cabs[0].edges.d0 + 'T00:00:00Z'),
      t1: new Date(latest[0]).getTime() + 18 * DAY
    };
  }

  function load() {
    if (window.LAB && window.LAB.model) return Promise.resolve(window.LAB.model);
    return fetch('/app/cabinet/data.json?lab=1').then(function (r) { return r.json(); }).then(function (d) {
      window.LAB.model = build(d);
      return window.LAB.model;
    });
  }

  function fmt(t) { var d = new Date(t); return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  return { PALETTE: PALETTE, SUR: SUR, FONT_JA: FONT_JA, FONT_MINCHO: FONT_MINCHO, T: T, DAY: DAY, measure: measure, load: load, build: build, fmt: fmt, clamp: clamp, el: el };
})();
