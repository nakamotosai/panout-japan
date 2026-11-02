/* japan.ouuut.com · shell.js — theme, language, header, reveal, inline chapter mount.
   No framework, no build step. Everything degrades without JS. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var THEMES = ['sage', 'dark'];
  var LANGS = ['ja', 'zh', 'en'];
  var LANG_LABEL = { ja: '日本語', zh: '中文', en: 'EN' };
  var dic = null;
  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var VER = '';
  var I18N_VER = '__I18N_VER__';
  try { VER = new URL(scriptSrc).searchParams.get('v') || ''; } catch (e) {}

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function lang() {
    // ?lang= 优先级最高：分享链接的语言参数必须压过本机记忆，
    // 否则老访客点 zh/en 链接会永远停在旧语言。
    var q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.indexOf(q) >= 0) return q;
    var l = get('pj-lang');
    if (LANGS.indexOf(l) >= 0) return l;
    return 'ja';
  }

  function tr(key) {
    if (dic && dic[key] && dic[key][lang()]) return dic[key][lang()];
    return '';
  }

  function updateTextEls(l) {
    if (!dic) return;
    var els = document.querySelectorAll('[data-t]');
    for (var j = 0; j < els.length; j++) {
      var v = dic[els[j].dataset.t];
      if (v && typeof v[l] === 'string') els[j].innerHTML = v[l];
    }
    var labelled = document.querySelectorAll('[data-t-aria]');
    for (var k = 0; k < labelled.length; k++) {
      var label = dic[labelled[k].dataset.tAria];
      if (label && typeof label[l] === 'string') labelled[k].setAttribute('aria-label', label[l]);
    }
  }

  function setLang(l, animate) {
    if (LANGS.indexOf(l) < 0) return;
    put('pj-lang', l);
    doc.lang = l;
    var btns = document.querySelectorAll('[data-lang-switch] [data-lang]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-current', String(btns[i].dataset.lang === l));
    }
    var cur = document.querySelectorAll('[data-lang-current]');
    for (var c = 0; c < cur.length; c++) {
      cur[c].textContent = LANG_LABEL[l] || l;
      cur[c].setAttribute('lang', l);
    }
    if (animate && dic) {
      doc.classList.add('lang-switching');
      setTimeout(function () {
        updateTextEls(l);
        setTimeout(function () {
          doc.classList.remove('lang-switching');
        }, 30);
      }, 190);
    } else {
      updateTextEls(l);
    }
    applyMeta(l);
    labelTheme(doc.dataset.theme || 'sage');
    syncUrlLang(l);
    try { window.dispatchEvent(new CustomEvent('pj:lang', { detail: l })); } catch (e) {}
    var live = document.querySelector('.stage[data-live="1"] .stage-live');
    if (live && live._setVendorLang) live._setVendorLang(l);
  }

  // 静态 HTML 只有 ja 的 head；三语版本在切换时同步 title/description/OG/canonical。
  // canonical 必须自指到 ?lang=，否则 zh/en 会被合并回 ja、hreflang 白写。
  function pageKey() {
    var p = location.pathname.replace(/index\.html$/, '');
    var m = p.match(/^\/(housing|crime|cabinet|quake|weather|population)\//);
    if (m) return m[1];
    return document.querySelector('meta[name="robots"][content="noindex"]') ? '404' : 'home';
  }

  function applyMeta(l) {
    if (!dic) return;
    var k = pageKey();
    var tv = (dic['meta.' + k + '.title'] || {})[l];
    var dv = (dic['meta.' + k + '.desc'] || {})[l];
    if (tv) document.title = tv;
    if (dv) {
      var md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute('content', dv);
      var od = document.querySelector('meta[property="og:description"]');
      if (od) od.setAttribute('content', dv);
    }
    if (tv) {
      var ot = document.querySelector('meta[property="og:title"]');
      if (ot) ot.setAttribute('content', tv);
    }
    var ol = document.querySelector('meta[property="og:locale"]');
    if (ol) ol.setAttribute('content', l === 'zh' ? 'zh_CN' : l === 'en' ? 'en_US' : 'ja_JP');
    var can = document.querySelector('link[rel="canonical"]');
    if (can) {
      try {
        var u = new URL(can.getAttribute('href'), location.origin);
        if (l === 'ja') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
        can.setAttribute('href', u.toString());
        var ou = document.querySelector('meta[property="og:url"]');
        if (ou) ou.setAttribute('content', u.toString());
      } catch (e) {}
    }
  }

  // 手动切语言后改写 URL 里的 lang，否则刷新会被 ?lang= 拉回去
  function syncUrlLang(l) {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('lang')) return;
      if (u.searchParams.get('lang') === l) return;
      if (l === 'ja') u.searchParams.delete('lang'); else u.searchParams.set('lang', l);
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) {}
  }

  function loadDic() {
    if (dic) return Promise.resolve(dic);
    return fetch('/assets/i18n.json' + (I18N_VER ? '?v=' + I18N_VER : ''))
      .then(function (r) { return r.json(); })
      .then(function (d) { dic = d; return d; })
      .catch(function () { return null; });
  }

  function autoTheme() {
    var h = new Date().getHours();
    return (h >= 6 && h < 18) ? 'sage' : 'dark';
  }

  function syncVendorTheme(t) {
    var live = document.querySelector('.stage[data-live="1"] .stage-live');
    if (live && live._setVendorTheme) live._setVendorTheme(t);
  }

  function applyTheme(t) {
    if (THEMES.indexOf(t) < 0) t = 'sage';
    doc.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0E0E0C' : '#F5F3ED');
    labelTheme(t);
    try { window.dispatchEvent(new CustomEvent('pj:theme', { detail: t })); } catch (e) {}
    syncVendorTheme(t);
  }

  // The single toggle's label names the next action (switch to dark / to light).
  function labelTheme(t) {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    if (!toggles.length) return;
    var label = (t === 'dark' ? tr('ui.theme.toLight') : tr('ui.theme.toDark')) || tr('ui.theme.toggle') || 'Theme';
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-label', label);
      toggles[i].setAttribute('title', label);
      toggles[i].setAttribute('aria-pressed', String(t === 'dark'));
    }
  }

  function setTheme(t, save) {
    if (save) put('pj-theme', t);
    applyTheme(t);
  }

  function bootTheme() {
    var saved = get('pj-theme');
    applyTheme(THEMES.indexOf(saved) >= 0 ? saved : autoTheme());
  }

  function bootLang() {
    setLang(lang());
    loadDic().then(function () { setLang(lang()); });
  }

  // 数据层失败（fetch 挂了）也要能降级：恢复静态 poster + 一句可读的错误 + 重试。
  // 旧实现只有 import() 失败才加 .stage-failed，数据失败等于整块舞台空白。
  window.pjStageFailed = function (el, msg, retryLabel) {
    var stage = el && el.closest ? el.closest('.stage') : null;
    if (!stage) return;
    stage.dataset.live = '0';
    delete stage.dataset.busy;
    stage.classList.add('stage-failed');
    var box = stage.querySelector('.pj-fail');
    if (!box) {
      box = document.createElement('div');
      box.className = 'pj-fail';
      box.setAttribute('role', 'alert');
      stage.appendChild(box);
    }
    box.textContent = '';
    var p = document.createElement('p');
    p.textContent = msg || 'Data failed to load.';
    box.appendChild(p);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pj-fail-retry';
    b.textContent = retryLabel || 'Reload';
    b.addEventListener('click', function () { location.reload(); });
    box.appendChild(b);
  };

  function mountStage(stage, ch) {
    if (!stage || stage.dataset.busy || stage.dataset.live === '1') return;
    var live = stage.querySelector('.stage-live');
    if (!live) return;
    stage.dataset.busy = '1';

    var url = '/app/' + ch + '/view.js' + (VER ? '?v=' + VER : '');
    import(url).then(function (mod) {
      var opts = { base: '/', lang: lang(), theme: doc.dataset.theme || 'sage' };
      // 挂载是 async：必须等它 resolve 才算 live，否则数据层失败会留下「live=1 + 空舞台」
      var mountP;
      if (ch === 'quake') mountP = mod.mountQuake(live, opts);
      else if (ch === 'crime') mountP = mod.mountCrime(live, opts);
      else if (ch === 'cabinet') mountP = mod.mountCabinet(live, opts);
      else if (ch === 'housing') mountP = mod.mountHousing(live, opts);
      else if (ch === 'population') mountP = mod.mountPopulation(live, opts);
      return Promise.resolve(mountP).then(function (ok) {
        if (ok === false) throw new Error('mount ' + ch + ' returned false');
        // 模块自己已经降级（数据层失败）时，别再把 data-live 抬回 1 把 poster 藏掉
        if (stage.classList.contains('stage-failed')) return;

      live._setVendorLang = function (l) {
        try {
          if (ch === 'quake' && mod.setQuakeLang) mod.setQuakeLang(l);
          else if (ch === 'crime' && mod.setCrimeLang) mod.setCrimeLang(l);
          else if (ch === 'cabinet' && mod.setCabinetLang) mod.setCabinetLang(l);
          else if (ch === 'housing' && mod.setHousingLang) mod.setHousingLang(l);
          else if (ch === 'population' && mod.setPopulationLang) mod.setPopulationLang(l);
        } catch (e) {}
      };
      live._setVendorTheme = function (t) {
        try {
          if (ch === 'quake' && mod.setQuakeTheme) mod.setQuakeTheme(t);
          else if (ch === 'crime' && mod.setCrimeTheme) mod.setCrimeTheme(t);
          else if (ch === 'cabinet' && mod.setCabinetTheme) mod.setCabinetTheme(t);
          else if (ch === 'housing' && mod.setHousingTheme) mod.setHousingTheme(t);
          else if (ch === 'population' && mod.setPopulationTheme) mod.setPopulationTheme(t);
        } catch (e) {}
      };
      live._setVendorLang(opts.lang);
      live._setVendorTheme(opts.theme);

      stage.dataset.live = '1';
      stage.classList.remove('stage-failed');
      var failBox = stage.querySelector('.pj-fail');
      if (failBox) failBox.remove();
      delete stage.dataset.busy;
      if (!document.body.classList.contains('chapter-app')) {
        [60, 350, 900, 2400].forEach(function (ms) {
          setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, ms);
        });
      }
      try { window.dispatchEvent(new CustomEvent('pj:stage-mounted', { detail: { ch: ch } })); } catch (e) {}
      });
    }).catch(function (err) {
      console.error(err);
      delete stage.dataset.busy;
      var msg = { ja: 'データを読み込めませんでした。再読み込みしてください。', zh: '数据加载失败，请刷新重试。', en: 'Could not load the data. Please reload.' };
      var lbl = { ja: '再読み込み', zh: '刷新', en: 'Reload' };
      var lg = doc.lang || 'ja';
      window.pjStageFailed(stage, msg[lg] || msg.ja, lbl[lg] || lbl.ja);
      try { window.dispatchEvent(new CustomEvent('pj:stage-error', { detail: { ch: ch } })); } catch (e) {}
    });
  }

  function setupStages() {
    var stages = document.querySelectorAll('.stage[data-stage-auto]');
    if (!stages.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < stages.length; i++) {
        mountStage(stages[i], stages[i].dataset.stageAuto);
      }
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (!entries[j].isIntersecting) continue;
        var stage = entries[j].target;
        io.unobserve(stage);
        mountStage(stage, stage.dataset.stageAuto);
      }
    }, { rootMargin: '320px 0px' });
    for (var k = 0; k < stages.length; k++) io.observe(stages[k]);
  }

  function legacyHash() {
    var h = location.hash || '';
    var m = /^#\/?(quake|crime|cabinet|housing|population)\/?$/.exec(h);
    if (m) location.replace('/' + m[1] + '/');
    else if (/^#\/(quake|crime|cabinet|housing|population)\/(.+)$/.test(h)) {
      location.replace('/' + h.slice(1).replace(/\/?$/, '/'));
    }
  }

  function setupHeader() {
    var header = document.querySelector('.masthead');
    var bar = document.querySelector('.scroll-progress');
    function onScroll() {
      var y = window.scrollY || window.pageYOffset || 0;
      if (header) header.classList.toggle('scrolled', y > 8);
      if (bar) {
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        bar.style.width = Math.min(100, Math.max(0, y / max * 100)) + '%';
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function setupMenu() {
    var btn = document.querySelector('[data-burger]');
    var menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;
    function close() {
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
      var open = document.querySelectorAll('.lang-menu.open');
      for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
      var exp = document.querySelectorAll('.lang-btn[aria-expanded="true"]');
      for (var j = 0; j < exp.length; j++) exp[j].setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      var open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', toggle);
    var links = menu.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) links[i].addEventListener('click', close);
    menu.querySelectorAll('[data-lang], [data-theme-toggle]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) close();
    });
  }

  // Language disclosure: the button names the current language, the menu lists
  // all three. Escape, outside click and Tab close it; arrows move inside it.
  function setupLangSwitch() {
    var boxes = document.querySelectorAll('[data-lang-switch]');
    for (var b = 0; b < boxes.length; b++) (function (box) {
      var btn = box.querySelector('.lang-btn');
      var menu = box.querySelector('.lang-menu');
      if (!btn || !menu) return;
      function items() { return menu.querySelectorAll('[data-lang]'); }
      function close() {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
      function open() {
        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('[data-lang][aria-current="true"]') || items()[0];
        if (first) first.focus();
      }
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (menu.classList.contains('open')) close(); else open();
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-lang]')) close();
      });
      menu.addEventListener('keydown', function (e) {
        var list = items();
        var idx = Array.prototype.indexOf.call(list, document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); list[(idx + 1) % list.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); list[(idx - 1 + list.length) % list.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
        else if (e.key === 'Tab') close();
      });
      box.addEventListener('focusout', function (e) {
        if (!box.contains(e.relatedTarget)) close();
      });
      document.addEventListener('click', function (e) {
        if (!box.contains(e.target)) close();
      });
    })(boxes[b]);
  }

  function setupReveal() {
    var els = document.querySelectorAll('.rv');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add('in');
          io.unobserve(entries[j].target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (var k = 0; k < els.length; k++) io.observe(els[k]);
  }

  // Home plates: each card's plate is revealed once, when it first enters view.
  function setupPlates() {
    var plates = document.querySelectorAll('.hp-entry');
    if (!plates.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < plates.length; i++) plates[i].classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add('is-in');
          io.unobserve(entries[j].target);
        }
      }
    }, { threshold: 0.25 });
    for (var k = 0; k < plates.length; k++) io.observe(plates[k]);
  }

  function init() {
    doc.classList.add('js');
    bootTheme();
    bootLang();
    legacyHash();
    setupHeader();
    setupMenu();
    setupLangSwitch();
    setupReveal();
    setupStages();
    setupPlates();

    var langs = document.querySelectorAll('[data-lang]');
    for (var i = 0; i < langs.length; i++) {
      langs[i].addEventListener('click', function () {
        var l = this.dataset.lang;
        loadDic().then(function () { setLang(l, true); });
      });
    }

    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].addEventListener('click', function () {
        setTheme(doc.dataset.theme === 'dark' ? 'sage' : 'dark', true);
      });
      toggles[j].hidden = false;
    }
    labelTheme(doc.dataset.theme || 'sage');

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
