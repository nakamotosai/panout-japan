/* japan.ouuut.com · Quake view (single-page mount)
 * Source: sites/quake/dist/assets/index-*.js + dist/data/*.json (read-only rollback anchor).
 * Vendor (app/quake/vendor/quake-core.js) is the dist bundle with deterministic
 * string patches ONLY (no logic edits):
 *   - mount root `#app` -> `#v-quake-viewport` (1x)
 *   - eq-topbar block stripped (shell owns header + i18n + theme dots)
 *   - data paths `./data/...` -> `${window.__QK_DATA__||'./app/quake/data'}/...` (4x)
 *   - documentElement theme/eq-var writes -> #v-quake-viewport first (6 sites)
 *   - SW register gated behind window.__QK_ENABLE_SW__ (single page: no SW)
 * Frozen verbatim: depth 7-stop palette (484984/4556168/8627608/14129441/
 *   16678937/16468276/10289158 + legend gradient), 632 pts n/a (quake),
 *   tile thresholds/manifest+legacy-quakes.json fallback chain.
 * Theme map (ouuut shell -> viewport-scoped vars in quake-core.css):
 *   mono/sage/dark -> viewport tokens; depth gradient + globe palette frozen.
 * Data: ./app/quake/data/*.json on mount only (fallback ../ for preview/ dev).
 * API: mountQuake(root, {lang, theme}) / unmountQuake() /
 *      setQuakeLang(l) / setQuakeTheme(t) / getQuakeSummary()
 */
'use strict';

const DATA_CANDIDATES = ['./app/quake/data', '../app/quake/data'];
let forcedBase = null; // shell opts.base wins (./ at site root, ../ under preview/)
const VENDOR_CANDIDATES = [
  './app/quake/vendor/quake-core.js',
  '../app/quake/vendor/quake-core.js',
];
const CSS_CANDIDATES = [
  './app/quake/vendor/quake-core.css',
  '../app/quake/vendor/quake-core.css',
];
const THEME_MAP = { sage: 'sage', dark: 'dark', mono: 'sage', tactical: 'dark' };

let mounted = false;
let bootToken = 0;
let vendorState = 'idle'; // idle | loading | ready | failed
let vendorPromise = null;
let vendorError = null;
let hostEl = null;
let viewportEl = null;
let ro = null;
let mo = null;
let rafKickTimer = 0;
let currentLang = 'ja';
let currentTheme = 'sage';
let summary = null;

function detectLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q) {
      const s = q.toLowerCase();
      if (s.startsWith('ja')) return 'ja';
      if (s.startsWith('en')) return 'en';
      if (s.startsWith('zh')) return /(hant|[-_](tw|hk|mo))/i.test(s) ? 'zh-Hant' : 'zh';
    }
    const saved =
      localStorage.getItem('pp-lang') || localStorage.getItem('eq-lang');
    if (saved) {
      const s = saved.toLowerCase();
      if (s.startsWith('ja')) return 'ja';
      if (s.startsWith('en')) return 'en';
      if (s.startsWith('zh')) return /(hant|[-_](tw|hk|mo))/i.test(s) ? 'zh-Hant' : 'zh';
    }
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('en')) return 'en';
  } catch (e) {}
  return 'ja';
}

function detectTheme() {
  const de = (typeof document !== 'undefined') ? document.documentElement.getAttribute('data-theme') : null;
  if (de === 'sage' || de === 'dark') return de;
  try {
    const t = localStorage.getItem('pj-theme') || localStorage.getItem('eq-theme');
    if (t === 'sage' || t === 'dark') return t;
  } catch (e) {}
  return 'sage';
}

function injectCss() {
  const _alignSt = document.createElement('style'); _alignSt.textContent = "\n/* 严格保证左上角工具按钮水平居中对齐 */\n#eq-menu-row, #eq-menu-items {\n  display: flex !important;\n  align-items: center !important;\n}\n.eq-tool {\n  display: flex !important;\n  align-items: center !important;\n}\n.eq-tool > .eq-sq, .eq-sq-row > .eq-sq, .eq-menu-items > .eq-sq {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  margin: 0 !important;\n  vertical-align: middle !important;\n}\n"; document.head.appendChild(_alignSt);
  if (document.getElementById('qk-style')) return Promise.resolve();
  const libs = forcedBase ? [forcedBase + 'app/quake/vendor/quake-core.css'] : CSS_CANDIDATES.slice();
  return new Promise((resolve) => {
    const next = () => {
      const u = libs.shift();
      if (!u) return resolve(); // CSS is progressive enhancement; never block
      const l = document.createElement('link');
      l.id = 'qk-style';
      l.rel = 'stylesheet';
      const ver = (typeof window !== 'undefined' && window.__PP_BUILD__) ? String(window.__PP_BUILD__) : '';
      l.href = ver ? (u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + ver) : u;
      l.onload = () => resolve();
      l.onerror = () => {
        try { l.remove(); } catch (e) {}
        next();
      };
      document.head.appendChild(l);
    };
    next();
  });
}

function loadVendorOnce() {
  if (vendorState === 'ready') return Promise.resolve();
  if (vendorState === 'failed') return Promise.reject(vendorError);
  if (vendorPromise) return vendorPromise;
  vendorState = 'loading';
  // Remount needs a FRESH vendor run (bundle self-executes on import only; cached
  // module won't rebuild the scene). Bust with a query stamp; disk-cache hit, zero network.
  const stamp = (typeof bootToken !== 'undefined' ? bootToken : 0) + '-' + Date.now();
  const vendorList = forcedBase ? [forcedBase + 'app/quake/vendor/quake-core.js?t=' + stamp] : VENDOR_CANDIDATES.slice();
  vendorPromise = (async () => {
    let lastErr = null;
    for (const u of vendorList) {
      try {
        await import(/* @vite-ignore */ new URL(u, document.baseURI).href);
        vendorState = 'ready';
        return;
      } catch (e) { lastErr = e; }
    }
    vendorState = 'failed';
    vendorError = lastErr;
    throw lastErr;
  })();
  return vendorPromise;
}

function readSummaryFromDom() {
  try {
    const vp = viewportEl;
    if (!vp) return null;
    const canvas = vp.querySelector('#eq-canvas');
    const foot = vp.querySelector('#eq-footer');
    return {
      canvas: !!canvas,
      w: canvas ? canvas.clientWidth || canvas.width : 0,
      h: canvas ? canvas.clientHeight || canvas.height : 0,
      footer: foot ? (foot.textContent || '').slice(0, 80) : '',
    };
  } catch (e) { return null; }
}

async function boot(token) {
  if (token !== bootToken || !mounted) return null;
  try {
    await loadVendorOnce();
  } catch (e) {
    console.error('[quake] vendor load failed', e);
    if (viewportEl && token === bootToken) {
      try { const v = hostEl && hostEl.querySelector('.qk-veil'); if (v && v.parentNode) v.parentNode.removeChild(v); } catch (e2) {}
      viewportEl.innerHTML =
        '<div class="qk-fail">3D 地球仪加载失败 / failed to load globe vendor. ' +
        String((e && e.message) || e) + '</div>';
    }
    return null;
  }
  if (token !== bootToken || !mounted) return null;
  // Vendor runs synchronously on import against #v-quake-viewport (already in DOM).
  setQuakeTheme(currentTheme);
  summary = readSummaryFromDom();
  localizeDock();
  localizeChrome();
  watchHantDom();
  [600, 1800].forEach(function (ms) {
    setTimeout(function () { if (token === bootToken && mounted) { localizeDock(); localizeChrome(); } }, ms);
  });
  // 名震列表/详情是点击后才渲染的，渲染完再补一次震名
  try {
    const vp = viewportEl;
    if (vp && !vp.__qkFamousBound) {
      vp.__qkFamousBound = true;
      vp.addEventListener('click', function (e) {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('#eq-mode-famous') || t.closest('#eq-famous-list')) setTimeout(patchFamousNames, 0);
        if (t.closest('#eq-mode-review')) setTimeout(localizeChrome, 0);
      }, true);
    }
  } catch (e) {}
  if (!summary || !summary.canvas) {
    console.error('[quake] vendor ran but #eq-canvas missing');
    try { const v = hostEl && hostEl.querySelector('.qk-veil'); if (v && v.parentNode) v.parentNode.removeChild(v); } catch (e) {}
    return null;
  }
  // 遮罩撤除：等画布真正画出震点（亮点占比超阈值）且至少 2.6s；暗色画布阈值可能偏低，4.4s 兜底
  try {
    const v = hostEl && hostEl.querySelector('.qk-veil');
    if (v) {
      const t0 = Number(v.dataset.t0 || Date.now());
      const cv = viewportEl && viewportEl.querySelector('#eq-canvas');
      let tries = 0;
      const done = () => {
        try {
          if (v) {
            v.style.transition = 'opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
            v.style.opacity = '0';
            setTimeout(() => {
              try { if (v.parentNode) v.parentNode.removeChild(v); } catch (e) {}
            }, 650);
          }
        } catch (e) {}
      };
      const tick = () => {
        tries++;
        let dotsOk = false;
        try {
          if (cv && cv.width) {
            const c2 = document.createElement('canvas');
            c2.width = 320; c2.height = Math.max(1, Math.round(320 * cv.height / cv.width));
            const cx = c2.getContext('2d'); cx.drawImage(cv, 0, 0, c2.width, c2.height);
            const d = cx.getImageData(0, 0, c2.width, c2.height).data;
            let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 60 || d[i+1] > 60 || d[i+2] > 60) n++; }
            dotsOk = n / (c2.width * c2.height) > 0.035;
          }
        } catch (e) {}
        if ((dotsOk && Date.now() - t0 >= 2600) || tries > 8) return done();
        setTimeout(tick, 500);
      };
      setTimeout(tick, 400);
    }
  } catch (e) {}
  // Nudge resize so renderer picks up the real box (shell .stage may settle late).
  try {
    window.dispatchEvent(new Event('resize'));
  } catch (e) {}
  if (rafKickTimer) { try { clearTimeout(rafKickTimer); } catch (e) {} rafKickTimer = 0; }
  rafKickTimer = setTimeout(() => {
    summary = readSummaryFromDom();
  }, 1200);
  return summary;
}

/* Mount: host = section#v-quake (or any ancestor). Viewport contract:
 * host.querySelector('#v-quake-viewport') || host.querySelector('.stage') || host.
 * Lazy: CSS + vendor JS + data all fetch only here (never on first paint).
 */
function mountQuake(root, opts) {
  opts = opts || {};
  if (opts.base) forcedBase = opts.base;
  if (mounted) unmountQuake();
  vendorState = 'idle'; vendorPromise = null; vendorError = null;
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  if (!host) throw new Error('qk: mount root missing');
  hostEl = host;

  let viewport =
    host.querySelector('#v-quake-viewport') ||
    host.querySelector('.stage') ||
    host;
  // If the shell placeholder .stage holds placeholder <b>/<span>, clear it so the
  // globe owns the box. Otherwise (already a viewport) keep content and let the
  // vendor append; duplicate-mount guard clears leftovers below.
  if (viewport !== host && viewport.id !== 'v-quake-viewport') {
    viewport.id = 'v-quake-viewport';
  }
  if (!viewport.querySelector('#eq-canvas')) viewport.innerHTML = '';
  viewportEl = viewport;
  // 加载遮罩：vendor 画布出现前挡住空舞台（防慢网/冷缓存下"地图全空"）
  try {
    if (!host.querySelector('.qk-veil')) {
      const veil = document.createElement('div');
      veil.className = 'qk-veil';
      veil.textContent = '読み込み中 · Loading…';
      veil.style.cssText = 'position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--muted);font:350 11.5px/1.6 var(--mono,ui-monospace,monospace);letter-spacing:.1em;pointer-events:none';
      veil.dataset.t0 = String(Date.now());
      host.appendChild(veil);
      setTimeout(() => { try { if (veil.parentNode) veil.parentNode.removeChild(veil); } catch (e) {} }, 30000);
    }
  } catch (e) {}

  currentLang = opts.lang || detectLang();
  currentTheme = (opts.theme && THEME_MAP[opts.theme]) ? opts.theme : detectTheme();
  try { viewportEl.setAttribute('data-quake-theme', THEME_MAP[currentTheme] || 'mono'); } catch (e) {}
  try {
    localStorage.setItem('eq-lang', currentLang);
  } catch (e) {}

  // Data base for this mount: shell opts.base wins, else probe.
  let base = forcedBase ? forcedBase + 'app/quake/data' : DATA_CANDIDATES[0];
  try {
    const u = new URL(VENDOR_CANDIDATES[0], document.baseURI).href;
    void u;
  } catch (e) {}
  // Probe (only when shell did not give base): prefer the candidate whose outline fetches.
  const probe = forcedBase ? (async () => { try { window.__QK_DATA__ = base; } catch (e) {} })() : (async () => {
    for (const c of DATA_CANDIDATES) {
      try {
        const r = await fetch(c + '/japan-outline.json', { method: 'HEAD' });
        if (r.ok) { base = c; break; }
      } catch (e) {}
    }
    try { window.__QK_DATA__ = base; } catch (e) {}
  })();

  injectCss();
  try { window.__QK_ENABLE_SW__ = false; } catch (e) {}

  mounted = true;
  const token = ++bootToken;

  if (typeof ResizeObserver !== 'undefined') {
    try {
      ro = new ResizeObserver(() => {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      });
      ro.observe(viewportEl);
    } catch (e) { ro = null; }
  }
  // Keep viewport theme attr in sync if the shell flips data-theme while mounted.
  try {
    mo = new MutationObserver(() => {
      try {
        const t = document.documentElement.getAttribute('data-theme');
        if (t) setQuakeTheme(t);
      } catch (e) {}
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { mo = null; }

  return probe.then(() => boot(token));
}

function teardownDom() {
  if (hantObs) { try { hantObs.disconnect(); } catch (e) {} hantObs = null; }
  if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
  if (mo) { try { mo.disconnect(); } catch (e) {} mo = null; }
  if (rafKickTimer) { try { clearTimeout(rafKickTimer); } catch (e) {} rafKickTimer = 0; }
  if (viewportEl) {
    try {
      // Vendor owns: canvas + eq-* UI + WebGL context + rAF loop (self-perpetuating
      // inside module scope; no exported dispose). Remove every node it created,
      // force-context-loss to free the GPU, then empty the box so a remount
      // starts clean. The module stays cached (zero re-download on remount).
      const nodes = viewportEl.querySelectorAll('canvas');
      nodes.forEach((c) => {
        try {
          const gl = c.getContext('webgl2') || c.getContext('webgl');
          const ext = gl && gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        } catch (e) {}
      });
      viewportEl.innerHTML = '';
      viewportEl.removeAttribute('data-quake-theme');
    } catch (e) {}
  }
  summary = null;
  hostEl = null;
  viewportEl = null;
}

function unmountQuake() {
  bootToken++;
  mounted = false;
  teardownDom();
}

const DOCK_LABELS = {
  'eq-menu': { ja: 'メニュー', zh: '菜单', en: 'Menu' },
  'eq-size-mode': { ja: '規模', zh: '震级', en: 'Size' },
  'eq-btn-mag': { ja: '最小M', zh: '震级筛', en: 'Min mag' },
  'eq-btn-year': { ja: '年', zh: '年份', en: 'Year' },
  'eq-btn-depth': { ja: '深さ', zh: '深度', en: 'Depth' },
};
const DOCK_TITLES = {
  'eq-menu': { ja: 'ツールを開閉', zh: '展开/收起工具', en: 'Toggle tools' },
  'eq-size-mode': { ja: '点の大きさ：規模', zh: '点大小：按震级', en: 'Point size: magnitude' },
  'eq-btn-mag': { ja: '最小規模', zh: '最小震级', en: 'Minimum magnitude' },
  'eq-btn-year': { ja: '年範囲', zh: '年份区间', en: 'Year range' },
  'eq-btn-depth': { ja: '深さの強調', zh: '深度夸张', en: 'Depth exaggeration' },
};
// zh-Hant 页面用 zh 列(简体)经站内 s2tw 转出(表见 app/hant.js);ja/en 各用自己的列。
const dockPick = (tab) => zhx(currentLang, tab[isZh(currentLang) ? 'zh' : currentLang] || tab.en);

function localizeDock() {
  if (!viewportEl) return;
  for (const id of Object.keys(DOCK_LABELS)) {
    const el = viewportEl.querySelector('#' + id);
    if (!el) continue;
    const l = dockPick(DOCK_LABELS[id]);
    const t = dockPick(DOCK_TITLES[id]);
    if (el.textContent.trim() !== l) el.textContent = l;
    if (el.title !== t) el.title = t;
  }
  const pwa = viewportEl.querySelector('#eq-pwa-install');
  if (pwa) pwa.style.display = 'none';
}

// 名震：vendor 里震名/简介是简体中文，ja/en 页面上会直接露出来。
// 这里只做「外壳 + 震名」的本地化，中文长简介在 ja/en 下隐藏（内容不可翻译时不硬造）。
const FAMOUS_NAMES = {
  '3·11 东北': { ja: '東北地方太平洋沖地震（東日本大震災）', en: 'Tōhoku 2011 (Great East Japan Earthquake)' },
  '关东 1923': { ja: '関東大震災', en: 'Great Kantō earthquake, 1923' },
  '浓尾 1891': { ja: '濃尾地震', en: 'Nōbi earthquake, 1891' },
  '宫城 1978': { ja: '宮城県沖地震', en: 'Miyagi-oki earthquake, 1978' },
  '新潟中越': { ja: '新潟県中越地震', en: 'Niigata Chūetsu earthquake, 2004' },
  '熊本 2016': { ja: '熊本地震', en: 'Kumamoto earthquakes, 2016' },
  '福井 1948': { ja: '福井地震', en: 'Fukui earthquake, 1948' },
  '福岛冲 2022': { ja: '福島県沖地震', en: 'Fukushima-oki earthquake, 2022' },
  '胆振东部': { ja: '胆振東部地震', en: 'Iburi East earthquake, 2018' },
  '能登 2007': { ja: '能登半島地震', en: 'Noto Peninsula earthquake, 2007' },
  '能登 2024': { ja: '能登半島地震', en: 'Noto Peninsula earthquake, 2024' },
  '阪神·淡路': { ja: '阪神・淡路大震災', en: 'Great Hanshin-Awaji earthquake, 1995' },
  '集集 921': { ja: '集集地震', en: 'Chi-Chi earthquake, 1999' },
  '唐山 1976': { ja: '唐山地震', en: 'Tangshan earthquake, 1976' },
  '南西冲 1993': { ja: '北海道南西沖地震', en: 'Hokkaido southwest earthquake, 1993' },
};

const FAMOUS_FULL = {
  '东北地方太平洋冲地震（东日本大震灾）': { ja: '東北地方太平洋沖地震（東日本大震災）', en: '2011 Tōhoku earthquake and tsunami' },
  '阪神·淡路大地震': { ja: '阪神・淡路大震災', en: 'Great Hanshin-Awaji earthquake, 1995' },
  '令和6年能登半岛地震': { ja: '令和6年能登半島地震', en: '2024 Noto Peninsula earthquake' },
  '熊本地震（2016）': { ja: '熊本地震（2016）', en: '2016 Kumamoto earthquakes' },
  '关东大地震': { ja: '関東大震災', en: 'Great Kantō earthquake, 1923' },
  '北海道胆振东部地震': { ja: '北海道胆振東部地震', en: '2018 Hokkaido Eastern Iburi earthquake' },
  '新潟县中越地震': { ja: '新潟県中越地震', en: '2004 Chūetsu earthquake' },
  '能登半岛地震（2007）': { ja: '能登半島地震（2007）', en: '2007 Noto Peninsula earthquake' },
  '北海道南西冲地震': { ja: '北海道南西沖地震', en: '1993 Hokkaido southwest earthquake' },
  '宫城县冲地震（1978）': { ja: '宮城県沖地震（1978）', en: '1978 Miyagi-oki earthquake' },
  '福井地震': { ja: '福井地震', en: '1948 Fukui earthquake' },
  '浓尾地震': { ja: '濃尾地震', en: '1891 Nōbi earthquake' },
  '集集大地震（台湾 921）': { ja: '集集地震（台湾 921）', en: '1999 Chi-Chi earthquake, Taiwan' },
  '唐山大地震': { ja: '唐山地震', en: '1976 Tangshan earthquake' },
  '福岛县冲地震（2022）': { ja: '福島県沖地震（2022）', en: '2022 Fukushima-oki earthquake' },
};

import { toHant } from "../hant.js";
const CHROME = {
  'eq-mode-history': { ja: ['履歴', '世界の履歴カタログ（2000年→現在、1970年まで遡及）'], en: ['History', 'Global catalogue (2000→now, back to 1970)'] },
  'eq-mode-live': { ja: ['直近30日', '直近30日の USGS 公開カタログ'], en: ['Live', 'USGS last-30-days catalogue'] },
  'eq-mode-famous': { ja: ['著名', '過去の著名地震'], en: ['Famous', 'Historic major earthquakes'] },
  'eq-mode-review': { ja: ['年次', '1970年から年ごとに震源を積み上げる'], en: ['Review', 'Stack hypocentres year by year since 1970'] },
  'eq-shot': { ja: ['画像を保存', '画像を保存'], en: ['Save image', 'Save image'] },
  'eq-reset': { ja: [null, '初期の視点に戻す'], en: [null, 'Back to the initial view'] },
  'eq-minimap': { ja: [null, 'ミニ地球：位置と方位。クリックで真北へ'], en: [null, 'Mini globe: position and heading. Click to face north'] },
  'eq-domain-reload': { ja: [null, 'ページを再読み込み'], en: [null, 'Reload the page'] },
  'eq-review-player': { ja: [null, '年次レビューの再生'], en: [null, 'Play the yearly review'] },
  'eq-review-scrub': { ja: [null, '年をスクラブ'], en: [null, 'Scrub the year'] },
  'eq-review-close': { ja: [null, '年次レビューを閉じる'], en: [null, 'Close the yearly review'] },
  'eq-famous-reopen': { ja: ['著名地震リスト', '著名地震リストを開く'], en: ['Notable list', 'Open the notable earthquake list'] },
  'eq-btn-year': { ja: [null, '著名地震モードでは固定の選定イベントを使用'], en: [null, 'Famous mode uses a fixed set of events'] },
};

/* zh-Hant:四语真页面把 <html data-view-lang> 写成 zh-Hant,章节视图挑自己的词条,不落回
   zh(简体)。简体词条是唯一来源,繁体由站内 s2tw 规则转出(app/hant.js;规则与
   src/hant.py 同一份,生成与闸见 tools/gen_view_hant.py / src/view_i18n.py)。 */
const isZh = (l) => l === "zh" || l === "zh-Hant";
const zhx = (l, s) => (l === "zh-Hant" ? toHant(String(s)) : s);

// vendor 的工具条/图例/提示/抽屉是简体词条(它只做了 zh 一份),zh-Hant 页面在这里
// 把可见文本与 title/aria-label 按站内 s2tw 表现场转出,不另抄一份繁体表。
// 只在值真的变了时才写回:自己的写入不会再触发下一轮写入(表是幂等的)。
function hantDom(root) {
  if (!root) return;
  try {
    root.querySelectorAll('.eq-famous-item-name, #eq-famous-panel-name').forEach((el) => {
      if (!el.getAttribute('data-zh')) el.setAttribute('data-zh', el.textContent.trim());
    });
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const v = toHant(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
    root.querySelectorAll('[title],[aria-label]').forEach((el) => {
      for (const a of ['title', 'aria-label']) {
        const cur = el.getAttribute(a);
        if (!cur) continue;
        const v = toHant(cur);
        if (v !== cur) el.setAttribute(a, v);
      }
    });
  } catch (e) {}
}

let hantObs = null;
function watchHantDom() {
  try { if (hantObs) hantObs.disconnect(); } catch (e) {}
  hantObs = null;
  if (!viewportEl || currentLang !== 'zh-Hant' || typeof MutationObserver === 'undefined') return;
  hantDom(viewportEl);
  try {
    hantObs = new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === 'characterData') {
          const n = r.target;
          const v = toHant(n.nodeValue);
          if (v !== n.nodeValue) n.nodeValue = v;
        } else {
          for (const n of r.addedNodes) if (n && n.nodeType === 1) hantDom(n);
        }
      }
    });
    hantObs.observe(viewportEl, { subtree: true, childList: true, characterData: true });
  } catch (e) {}
}

function localizeChrome() {
  if (!viewportEl) return;
  if (isZh(currentLang)) {
    // 简体:vendor 的简体就是最终文案;繁体:交给 hantDom(含后续 DOM 变化)。
    if (currentLang === 'zh-Hant') hantDom(viewportEl);
    return;
  }
  const L = currentLang;
  for (const id of Object.keys(CHROME)) {
    const el = viewportEl.querySelector('#' + id);
    if (!el) continue;
    const [text, tip] = CHROME[id][L] || [null, null];
    if (text) el.textContent = text;
    if (tip) { el.title = tip; el.setAttribute('aria-label', tip); }
  }
  const drawerTitle = viewportEl.querySelector('.eq-famous-drawer-title');
  if (drawerTitle) drawerTitle.textContent = L === 'ja' ? '著名地震' : 'Notable earthquakes';
  const hint = viewportEl.querySelector('.eq-famous-drawer-hint');
  if (hint) hint.textContent = L === 'ja' ? '一つ選ぶと本震＋翌7日の余震だけを表示' : 'Pick one: mainshock plus the next 7 days of aftershocks';
  const list = viewportEl.querySelector('#eq-famous-list');
  if (list) list.setAttribute('aria-label', L === 'ja' ? '著名地震の一覧' : 'Notable earthquake list');
  const closeIds = ['eq-famous-drawer-close', 'eq-famous-panel-close'];
  for (const id of closeIds) {
    const el = viewportEl.querySelector('#' + id);
    if (el) { const s = L === 'ja' ? '閉じる' : 'Close'; el.title = s; el.setAttribute('aria-label', s); }
  }
  const note = viewportEl.querySelector('.eq-famous-panel-note');
  if (note) note.textContent = L === 'ja' ? '読み物としての解説 · 予報ではありません' : 'Background reading only · not a forecast';
  const wiki = viewportEl.querySelector('#eq-famous-wiki');
  if (wiki) wiki.textContent = L === 'ja' ? 'Wikipedia →' : 'Wikipedia →';
  patchFamousNames();
}

function patchFamousNames() {
  if (!viewportEl) return;
  if (isZh(currentLang)) {
    if (currentLang === 'zh-Hant') hantDom(viewportEl);
    return;
  }
  const L = currentLang;
  viewportEl.querySelectorAll('.eq-famous-item-name').forEach((el) => {
    const zh = el.getAttribute('data-zh') || el.textContent.trim();
    el.setAttribute('data-zh', zh);
    const hit = FAMOUS_NAMES[zh];
    if (hit && el.textContent !== hit[L]) el.textContent = hit[L];
  });
  const nameEl = viewportEl.querySelector('#eq-famous-panel-name');
  if (nameEl) {
    const zh = nameEl.getAttribute('data-zh') || nameEl.textContent.trim();
    nameEl.setAttribute('data-zh', zh);
    const full = FAMOUS_FULL[zh];
    if (full) { if (nameEl.textContent !== full[L]) nameEl.textContent = full[L]; }
    else {
      const key = Object.keys(FAMOUS_NAMES).find((k) => zh.indexOf(k.replace(/\s.*$/, '')) >= 0);
      if (key && nameEl.textContent !== FAMOUS_NAMES[key][L]) nameEl.textContent = FAMOUS_NAMES[key][L];
    }
  }
  // 中文长简介/伤亡口径在 ja/en 下不硬翻，直接收起
  ['#eq-famous-panel-summary', '#eq-famous-panel-deaths'].forEach((sel) => {
    const el = viewportEl.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  const wiki = viewportEl.querySelector('#eq-famous-wiki');
  if (wiki) {
    const nameEl2 = viewportEl.querySelector('#eq-famous-panel-name');
    const nm = nameEl2 ? nameEl2.textContent.trim() : '';
    if (nm) {
      const host = L === 'ja' ? 'ja.wikipedia.org' : 'en.wikipedia.org';
      wiki.href = 'https://' + host + '/wiki/' + encodeURIComponent(nm.replace(/ /g, '_'));
    }
  }
}

function setQuakeLang(l) {
  if (l !== 'ja' && l !== 'zh' && l !== 'zh-Hant' && l !== 'en') return false;
  currentLang = l;
  try { localStorage.setItem('eq-lang', l); } catch (e) {}
  // Vendor UI is zh-first and frozen; localize the visible labels here.
  localizeDock();
  localizeChrome();
  watchHantDom();
  return true;
}

function setQuakeTheme(t) {
  const id = THEME_MAP[t] || 'sage';
  currentTheme = t;
  try {
    if (viewportEl) viewportEl.setAttribute('data-quake-theme', id);
  } catch (e) {}
  try {
    if (typeof window !== 'undefined' && typeof window.__setQuakeTheme === 'function') {
      window.__setQuakeTheme(id);
    }
  } catch (e) {}
  return id;
}

function getQuakeSummary() { return summary; }

export { mountQuake, unmountQuake, setQuakeLang, setQuakeTheme, getQuakeSummary };
