#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, sys
from playwright.sync_api import sync_playwright

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "qa", "out")
os.makedirs(OUT_DIR, exist_ok=True)

URL = "http://127.0.0.1:8799/index.html"


def run_probes():
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
        page.on("console", lambda msg: errors.append(f"console error: {msg.text}") if msg.type == "error" else None)

        print(f"Navigating to {URL}...")
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2200)

        ready = page.evaluate("() => window.POLY != null && window.map != null")
        print("Data loaded & map ready:", ready)
        assert ready, "Map or data failed to load"
        # ---- 0. P0 生产面子硬资产（Favicon / OG Meta / Loader 退出） ----
        has_favicon = page.evaluate("() => !!document.querySelector('link[rel*=\"icon\"]')")
        has_og = page.evaluate("() => !!document.querySelector('meta[property=\"og:image\"]')")
        has_twitter = page.evaluate("() => !!document.querySelector('meta[name=\"twitter:card\"]')")
        loader_dismissed = page.evaluate("() => !document.getElementById('app-loader') || document.getElementById('app-loader').classList.contains('fade-out')")
        print(f"P0 Assets: Favicon={has_favicon} OG={has_og} TwitterCard={has_twitter} LoaderDismissed={loader_dismissed}")
        assert has_favicon, "Favicon link missing in head"
        assert has_og and has_twitter, "OG or Twitter Card meta missing"
        assert loader_dismissed, "app-loader not dismissed after data load"

        # ---- 0b. i18n 字典完备性：三语所有 UI 键必须齐备且非空 ----
        dict_chk = page.evaluate("""() => {
          const keys = ['siteTitleEditorial','siteTitleTactical','edition','searchPh','hudWholeTokyo','hudReset',
            'levelChome','levelWard','popLabel','popMissing','unitRate','reportedCases','totalCases',
            'wardTotalCases','wardRate','wardBenchmark','breakdownTitle','backTo','top5ChomeTitle','noChomeData',
            'top5WardTitle','byRateDesc','metaTitle','metaL1','metaL2','rankExtreme','rankHigh','rankNormal',
            'instTitle','instMedian','instMax','calloutSelected','noGeoNotice','loadingTitle','loadingStatus',
            'tooltipMetric','tooltipLangGroup','tooltipPalette','tooltipThemeLight','tooltipThemeDark',
            'tooltipReset','tooltipZoomIn','tooltipZoomOut','loaderAria'];
          const missing = [];
          for (const lg of Object.keys(I18N)) {
            for (const k of keys) {
              const v = I18N[lg][k];
              if (v == null || String(v).trim() === '') missing.push(lg + '.' + k);
            }
            for (const mk of ['total','nb','bi','r','v','o']) {
              if (!I18N[lg].metrics || !I18N[lg].metrics[mk]) missing.push(lg + '.metrics.' + mk);
            }
            for (const tk of ['R7','R8']) if (!I18N[lg].times || !I18N[lg].times[tk]) missing.push(lg + '.times.' + tk);
            for (const dk of ['muni','chome']) if (!I18N[lg].modes || !I18N[lg].modes[dk]) missing.push(lg + '.modes.' + dk);
            for (const ak of ['amber','crimson','steel']) if (!I18N[lg].accentNames || !I18N[lg].accentNames[ak]) missing.push(lg + '.accentNames.' + ak);
          }
          return { langs: Object.keys(I18N), missing };
        }""")
        print("i18n dictionary:", dict_chk)
        assert not dict_chk["missing"], f"i18n dictionary incomplete: {dict_chk['missing']}"

        # ---- 0c. 抓取线：robots / sitemap / llms.txt / manifest 可达且合规 ----
        BASE = URL.rsplit("/", 1)[0]
        def _get(path):
            r = page.request.get(BASE + path)
            return r.status, r.text()

        st_robots, txt_robots = _get("/robots.txt")
        st_sitemap, txt_sitemap = _get("/sitemap.xml")
        st_llms, txt_llms = _get("/llms.txt")
        st_manifest, txt_manifest = _get("/manifest.json")
        print(f"Crawl files: robots={st_robots} sitemap={st_sitemap} llms={st_llms} manifest={st_manifest}")
        assert st_robots == 200 and "Sitemap:" in txt_robots, "robots.txt missing or no Sitemap line"
        assert not any(l.strip() == "Disallow: /" for l in txt_robots.splitlines()), "robots.txt blocks whole site"
        assert st_sitemap == 200 and "<loc>https://crime.saaaai.com/</loc>" in txt_sitemap, "sitemap.xml bad"
        assert 'hreflang="x-default"' in txt_sitemap, "sitemap missing x-default hreflang"
        assert st_llms == 200 and "crime.saaaai.com" in txt_llms, "llms.txt bad"
        assert st_manifest == 200 and '"start_url"' in txt_manifest, "manifest.json bad"
        import json as _json
        mf = _json.loads(txt_manifest)
        mf_sizes = {i.get("sizes") for i in mf.get("icons", [])}
        assert "192x192" in mf_sizes and "512x512" in mf_sizes, f"manifest icons need 192+512: {mf_sizes}"
        assert mf.get("display") == "standalone", "manifest display must be standalone"

        # ---- 0d. GEO 线：hreflang 闭环 + JSON-LD 可解析且类型齐 ----
        seo = page.evaluate("""() => {
          const q = s => document.querySelector(s);
          const hl = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
            .map(l => l.getAttribute('hreflang'));
          const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map(b => {
            try { return JSON.parse(b.textContent); } catch (e) { return { __parseError: String(e) }; }
          });
          const types = [];
          const walk = n => {
            if (!n || typeof n !== 'object') return;
            if (Array.isArray(n)) { n.forEach(walk); return; }
            if (n['@type']) types.push(n['@type']);
            for (const k of Object.keys(n)) if (k !== '@type') walk(n[k]);
          };
          blocks.forEach(walk);
          return {
            hreflang: hl,
            canonical: q('link[rel="canonical"]') ? q('link[rel="canonical"]').getAttribute('href') : null,
            jsonldBlocks: blocks.length,
            parseErrors: blocks.filter(b => b.__parseError).length,
            types,
            manifest: !!q('link[rel="manifest"]'),
            faqVisible: document.querySelectorAll('#card .faq-item').length
          };
        }""")
        print("SEO/GEO:", {k: v for k, v in seo.items() if k != "types"}, "types=", seo["types"])
        for need in ("ja", "zh-Hans", "en", "x-default"):
            assert need in seo["hreflang"], f"hreflang missing {need}: {seo['hreflang']}"
        _ok_canon = {"https://crime.saaaai.com/", "https://crime.saaaai.com/?lang=ja",
                     "https://crime.saaaai.com/?lang=en"}
        assert seo["canonical"] in _ok_canon, f"canonical not a valid language self-reference: {seo['canonical']}"
        assert seo["parseErrors"] == 0, f"JSON-LD parse error in {seo['parseErrors']} block(s)"
        for tp in ("WebSite", "Dataset", "FAQPage", "Question", "Answer"):
            assert tp in seo["types"], f"JSON-LD missing @type {tp}: {seo['types']}"
        assert seo["manifest"], "manifest link missing in head"
        assert seo["faqVisible"] >= 4, f"FAQ visible block missing (need >=4): {seo['faqVisible']}"

        # ---- 0e. SEO 元数据随语言切换（title/description/og/canonical）----
        seo_lang = page.evaluate("""() => {
          const get = s => { const e = document.querySelector(s); return e ? (e.content || e.getAttribute('href')) : null; };
          const out = {};
          for (const lg of ['zh', 'ja', 'en']) {
            setLanguage(lg);
            out[lg] = {
              title: document.title,
              desc: get('meta[name="description"]'),
              ogLocale: get('meta[property="og:locale"]'),
              canon: get('link[rel="canonical"]')
            };
          }
          setLanguage('zh');
          return out;
        }""")
        print("SEO per-lang canon:", {k: v["canon"] for k, v in seo_lang.items()})
        titles = {k: v["title"] for k, v in seo_lang.items()}
        assert len(set(titles.values())) == 3, f"titles not unique per language: {titles}"
        assert seo_lang["zh"]["canon"] == "https://crime.saaaai.com/", f"zh canonical: {seo_lang['zh']['canon']}"
        assert seo_lang["ja"]["canon"] == "https://crime.saaaai.com/?lang=ja", f"ja canonical: {seo_lang['ja']['canon']}"
        assert seo_lang["en"]["canon"] == "https://crime.saaaai.com/?lang=en", f"en canonical: {seo_lang['en']['canon']}"
        assert seo_lang["ja"]["ogLocale"] == "ja_JP" and seo_lang["en"]["ogLocale"] == "en_US", "og:locale per-lang wrong"
        for lg in ("zh", "ja", "en"):
            assert seo_lang[lg]["desc"] and len(seo_lang[lg]["desc"]) >= 40, f"{lg} description too short"


        # ---- 1b. 初始选中点必须落在视口正中央（±30px）
        center = page.evaluate("""() => {
          const pt = PTS.find(p => p.n === '新宿区歌舞伎町2丁目');
          const q = map.latLngToContainerPoint([pt.lat, pt.lng]);
          const r = document.getElementById('map').getBoundingClientRect();
          return { dx: Math.round(q.x - (r.left + r.width / 2)), dy: Math.round(q.y - (r.top + r.height / 2)) };
        }""")
        print("Initial center offset:", center)
        assert abs(center["dx"]) <= 30 and abs(center["dy"]) <= 30, f"initial chome not centered: {center}"
        # ---- 1. 注记覆盖全部区市 ----
        nlabels = page.evaluate("() => document.querySelectorAll('.map-ward-label').length")
        label_text = page.evaluate("() => [...document.querySelectorAll('.map-ward-label span')].map(s=>s.textContent)")
        cities = [t for t in label_text if t.endswith("市")]
        wards = [t for t in label_text if t.endswith("区")]
        print(f"Labels total={nlabels}  wards={len(wards)}  cities={len(cities)}")
        assert nlabels >= 55, f"expected all municipalities labeled, got {nlabels}"
        assert len(cities) >= 20, f"expected 20+ cities labeled, got {len(cities)}"

        # ---- 2. 初始聚焦 23 区 (宏观) ----
        z = page.evaluate("() => map.getZoom()")
        print("Initial zoom:", z)
        assert 9 <= z <= 12, f"initial zoom should be macro overview, got {z}"

        # ---- 3. 选中町丁 → 父级边界高亮 + 两张独立卡 ----
        page.evaluate("() => selectChomeByName('八王子市中町', true)")
        page.wait_for_timeout(1200)
        has_boundary = page.evaluate("() => !!parentBoundaryLayer")
        print("Parent boundary highlighted:", has_boundary)
        assert has_boundary, "parent boundary layer not drawn"

        ncards = page.evaluate("() => document.querySelectorAll('#card .panel-card').length")
        levels = page.evaluate("() => [...document.querySelectorAll('#card .card-level')].map(e=>e.textContent)")
        has_hud = page.evaluate("() => !!document.getElementById('hud-capsule')")
        has_tile = page.evaluate("() => document.querySelectorAll('.leaflet-tile-pane img').length > 0")
        has_scale = page.evaluate("() => !!document.querySelector('.leaflet-control-scale')")
        has_2col = page.evaluate("() => document.querySelectorAll('.metric-grid-2col').length >= 2")
        print(f"Panel cards={ncards} levels={levels} HUD={has_hud} Tiles={has_tile} Scale={has_scale} 2Col={has_2col}")
        assert ncards == 4, f"expected 4 stacked cards (chome + ward + top5 + meta), got {ncards}"
        assert "町丁" in levels and "区市" in levels, f"card levels wrong: {levels}"
        assert has_hud, "HUD capsule missing"
        assert has_tile, "basemap tile layer missing"
        assert has_scale, "scale control missing"
        assert has_2col, "2-column KPI grid missing"

        # ---- 3b. 选中标注（方案一）：锚点圆 + 三环脉冲 + 上浮地名胶囊 ----
        page.wait_for_timeout(700)
        co = page.evaluate("""() => {
          const svg = document.getElementById('lx-svg');
          const cap = document.getElementById('lx-capsule');
          const cs = getComputedStyle(cap);
          const pt = map.latLngToContainerPoint(lastAnchor);
          const r = cap.getBoundingClientRect();
          return {
            dot: svg.querySelectorAll('.lx-dot').length,
            rings: svg.querySelectorAll('.lx-ring').length,
            text: cap.textContent,
            on: cap.classList.contains('on'),
            role: cap.getAttribute('role'),
            aria: cap.getAttribute('aria-label'),
            valFs: parseFloat(getComputedStyle(cap.querySelector('.lx-val')).fontSize),
            nameFs: parseFloat(getComputedStyle(cap.querySelector('.lx-name')).fontSize),
            gap: Math.round(pt.y - r.bottom)
          };
        }""")
        print("Callout:", co)
        assert co["dot"] == 1, f"anchor dot missing: {co}"
        assert co["rings"] == 3, f"expected 3 pulse rings, got {co['rings']}"
        assert "八王子市中町" in co["text"], f"callout missing place name: {co['text']}"
        assert co["on"] and co["role"] == "status", "callout capsule not announced"
        assert "件 / 千人" in co["text"] or "cases / 1k" in co["text"], f"rate missing in capsule: {co['text']}"
        assert co["valFs"] >= 26, f"capsule value too small: {co['valFs']}"
        assert co["nameFs"] >= 20, f"capsule name too small: {co['nameFs']}"
        assert co["gap"] >= 64, f"capsule too close to anchor (blocks cursor): gap={co['gap']}"

        # ---- 3b0. 脉冲进行中：WAAPI 三环必须真在跑，且半径确实在扩散
        mid = page.evaluate("""async () => {
          selectChomeByName('立川市曙町2丁目', true);
          await new Promise(r => setTimeout(r, 120));
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            const rings = [...document.querySelectorAll('.lx-ring')];
            const running = rings.filter(c => c.getAnimations().some(a => a.playState === 'running'));
            if (running.length) {
              const cs = getComputedStyle(running[0]);
              return { n: running.length, r: parseFloat(cs.r), t: Math.round(running[0].getAnimations()[0].currentTime) };
            }
          }
          return { n: 0, r: 0, t: -1 };
        }""")
        print("Callout mid-pulse:", mid)
        assert mid["n"] >= 1, f"no running pulse observed: {mid}"
        assert mid["r"] > 6, f"pulse radius not expanding: {mid}"
        shot = os.path.join(OUT_DIR, "preview_v4_callout.png")
        page.screenshot(path=shot)
        print("Saved callout shot:", shot)
        # 拖到轨道靠上位置 → 放大
        z_before = page.evaluate("() => map.getZoom()")
        box = page.evaluate("""() => { const r=document.getElementById('zsTrack').getBoundingClientRect();
            return {x:r.left+r.width/2, top:r.top, bottom:r.bottom, h:r.height}; }""")
        page.mouse.move(box["x"], box["bottom"] - 4)
        page.mouse.down()
        page.mouse.move(box["x"], box["top"] + 6, steps=8)
        page.mouse.up()
        page.wait_for_timeout(500)
        z_after = page.evaluate("() => map.getZoom()")
        print(f"Slider drag zoom: {z_before} -> {z_after}")
        assert z_after > z_before, "dragging slider up should zoom in"

        fill_h = page.evaluate("() => document.getElementById('zsFill').style.height")
        print("Slider fill height:", fill_h)
        assert fill_h and fill_h != "0%", "slider fill should reflect zoom"

        acc = page.evaluate("() => getComputedStyle(document.getElementById('zsFill')).backgroundColor")
        print("Slider fill color:", acc)
        assert acc and "rgba(0, 0, 0, 0)" not in acc, f"slider fill color missing: {acc}"

        page.screenshot(path=os.path.join(OUT_DIR, "preview_v5_slider.png"))
        # 复位到 23 区宏观
        page.evaluate("() => { map.setZoom(11.5); }")
        page.wait_for_timeout(400)

        # ---- 4b. 排版：极细无衬线 + 字号 + 隐形滚动条 ----
        await_font = page.evaluate("""async () => {
          await document.fonts.ready;
          return {
            misans: document.fonts.check('300 14px "MiSans VF"'),
            family: getComputedStyle(document.querySelector('.nav-brand h1')).fontFamily,
            h1w: getComputedStyle(document.querySelector('.nav-brand h1')).fontWeight,
            bigval: (() => { const e=document.querySelector('.metric-hero .big-val'); return e ? getComputedStyle(e).fontSize+'/'+getComputedStyle(e).fontWeight : 'n/a'; })(),
            scrollbar: getComputedStyle(document.getElementById('card')).scrollbarWidth,
            minSize: (() => { let m=99; document.querySelectorAll('header *, #card *, #legend-instrument *, #lx-capsule *, #zoom-slider *').forEach(e=>{ if(e.textContent && e.textContent.trim() && e.children.length===0){ const s=parseFloat(getComputedStyle(e).fontSize); if(s<m) m=s; } }); return m; })()
          };
        }""")
        print("Typography:", await_font)
        assert await_font["misans"], "MiSans VF webfont not loaded"
        assert "MiSans VF" in await_font["family"], f"UI font is not MiSans: {await_font['family']}"
        assert float(await_font["h1w"]) <= 300, f"title should be thin, got {await_font['h1w']}"
        assert await_font["scrollbar"] == "none", f"card scrollbar not hidden: {await_font['scrollbar']}"
        assert await_font["minSize"] >= 11, f"min UI font-size too small: {await_font['minSize']}"

        # ---- 4c. i18n 完整性守卫：UI 控件文本必须严格等于当前语言字典（专有名词除外）----
        i18n_probe = """(lang) => {
          setLanguage(lang);
          const g = id => document.getElementById(id);
          const t = I18N[lang];
          const themeTip = currentVariant === 'tactical' ? t.tooltipThemeLight : t.tooltipThemeDark;
          const accentName = (t.accentNames && t.accentNames[currentAccent]) || currentAccent;
          return {
            dom: {
              metric: g('metric').title,
              langGroup: document.querySelector('.lang-switch-group').getAttribute('aria-label'),
              palette: g('palette-btn').title,
              theme: g('theme-btn').title,
              themeAria: g('theme-btn').getAttribute('aria-label'),
              hudReset: g('hud-reset').title,
              zoomIn: g('zsPlus').title,
              zoomOut: g('zsMinus').title,
              search: g('q').placeholder,
              sectionTitle: document.querySelector('#card .section-title')?.textContent,
              cardLevel: document.querySelector('#card .card-level')?.textContent
            },
            exp: {
              metric: t.tooltipMetric,
              langGroup: t.tooltipLangGroup,
              palette: t.tooltipPalette + ' · ' + accentName,
              theme: themeTip,
              themeAria: themeTip,
              hudReset: t.tooltipReset,
              zoomIn: t.tooltipZoomIn,
              zoomOut: t.tooltipZoomOut,
              search: t.searchPh,
              sectionTitle: t.breakdownTitle,
              cardLevel: t.levelChome
            }
          };
        }"""
        for lg in ("zh", "ja", "en"):
            res = page.evaluate(i18n_probe, lg)
            page.wait_for_timeout(250)
            bad = {k: (res["dom"][k], res["exp"][k]) for k in res["exp"]
                   if res["dom"][k] != res["exp"][k]}
            print(f"i18n[{lg}] mismatches:", bad)
            assert not bad, f"UI text not localized for {lg}: {bad}"

        # ---- 4d. 胶囊必须跟随主题 token（浅色模式适配硬闸）----
        cap_theme = page.evaluate("""() => {
          const parse = s => (s.match(/[0-9.]+/g) || []).map(Number);
          const pick = () => {
            selectChomeByName('新宿区歌舞伎町1丁目', true);
            const c = document.getElementById('lx-capsule');
            const cs = getComputedStyle(c);
            return { bg: cs.backgroundColor, fg: cs.color, bgRaw: parse(cs.backgroundColor), fgRaw: parse(cs.color) };
          };
          applyThemeVariant('tactical');
          const dark = pick();
          applyThemeVariant('editorial');
          const light = pick();
          applyThemeVariant('tactical');
          return { dark, light };
        }""")
        print("Capsule theme:", {k: (v["bg"], v["fg"]) for k, v in cap_theme.items()})
        d, l = cap_theme["dark"], cap_theme["light"]
        assert d["bg"] != l["bg"], f"capsule bg not tokenized (same in both themes): {d['bg']}"
        d_lum = sum(d["bgRaw"][:3]) / 3
        l_lum = sum(l["bgRaw"][:3]) / 3
        assert d_lum < 90, f"tactical capsule bg not dark: {d['bg']}"
        assert l_lum > 170, f"editorial capsule bg not light (dark-on-light bug): {l['bg']}"
        page.evaluate("() => setLanguage('zh')")
        page.wait_for_timeout(300)

        # ---- 5. 浅色 / 深色 全貌 ----
        page.evaluate("() => applyThemeVariant('editorial')")
        page.wait_for_timeout(700)
        shot_a = os.path.join(OUT_DIR, "preview_v3_editorial.png")
        page.screenshot(path=shot_a)
        print("Saved:", shot_a)

        page.evaluate("() => applyThemeVariant('tactical')")
        page.wait_for_timeout(700)
        shot_b = os.path.join(OUT_DIR, "preview_v3_tactical.png")
        page.screenshot(path=shot_b)
        print("Saved:", shot_b)

        # ---- 5. 移动端 ----
        m_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        m_page = m_ctx.new_page()
        m_page.goto(URL, wait_until="networkidle", timeout=60000)
        m_page.wait_for_timeout(1600)
        m_page.evaluate("() => applyThemeVariant('tactical')")
        m_page.wait_for_timeout(600)
        shot_m = os.path.join(OUT_DIR, "preview_v3_mobile_tactical.png")
        m_page.screenshot(path=shot_m)
        print("Saved mobile:", shot_m)
        overflow = m_page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        print(f"Mobile overflow: {overflow}px")
        assert overflow <= 0, f"mobile horizontal overflow: {overflow}"

        # 顶栏子控件不得被裁切（右缘超出视口即视为裁切）
        clip = m_page.evaluate("""() => {
          const vw = innerWidth;
          return [...document.querySelectorAll('header .nav-center > *, header .nav-right > *')]
            .map(e => ({ t: (e.className||e.tagName), r: Math.round(e.getBoundingClientRect().right) }))
            .filter(o => o.r > vw + 1);
        }""")
        print("Mobile header clipped controls:", clip)
        assert not clip, f"mobile header controls clipped: {clip}"

        browser.close()

    print("\n--- PROBE SUMMARY ---")
    print(f"Errors count: {len(errors)}")
    if errors:
        for e in errors:
            print("ERR:", e)
        sys.exit(1)
    print("All probe gates PASS! 0 errors.")
    sys.exit(0)


if __name__ == "__main__":
    run_probes()
