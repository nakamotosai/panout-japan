#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""site/index.html 端到端 QA（无头 Chromium）。
用法: python scripts/qa_site.py [--port 8766] [--headed] [--retries 4]
失败打印 FAIL 明细并以退出码 1 结束；全过退出码 0。

本机注意：重复启动 Chromium 时驱动进程偶发被杀（表现为
"Connection closed while reading from the driver"），非页面问题；
故整轮失败自动重试（--retries，默认 4）。备用：用 omp 的 browser 命名空间
开一个托管 tab 跑同样检查（见 README「验收」）。
"""
import argparse, json, sys, traceback
from playwright.sync_api import sync_playwright

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"   :: {detail}" if detail else ""), flush=True)
    return ok


def section(name):
    import contextlib
    @contextlib.contextmanager
    def _cm():
        try:
            yield
        except Exception as e:
            check(name + " 区块执行", False, f"{type(e).__name__}: {e}")
    return _cm()


def attempt(a, URL):
    """跑一轮；返回 True 表示完整跑完（结果进 RESULTS）。"""
    del RESULTS[:]
    with sync_playwright() as p:
        b = p.chromium.launch(headless=not a.headed)
        ctx = b.new_context(viewport={"width": 1568, "height": 1000})
        pg = ctx.new_page()
        errs, cons = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: cons.append((m.type, m.text)) if m.type in ("error", "warning") else None)
        pg.goto(URL, wait_until="networkidle", timeout=120000)
        pg.wait_for_timeout(9000)

        # ---- A. 载入基线 ----
        check("A1 默认町丁面", pg.evaluate("() => mode") == "chome", str(pg.evaluate("() => mode")))
        check("A2 町丁层 5194", pg.evaluate("() => chomeLayer.getLayers().length") == 5194,
              str(pg.evaluate("() => chomeLayer.getLayers().length")))
        check("A3 默认卡片=歌舞伎町2丁目", "歌舞伎町2丁目" in (pg.text_content("#card h2") or ""),
              (pg.text_content("#card h2") or "").strip())
        check("A4 图例含町丁档", "町丁档" in (pg.text_content("#legendTitle") or ""),
              (pg.text_content("#legendTitle") or "").strip())
        check("A5 图例刻度8格(9色断点)", pg.evaluate("() => document.querySelectorAll('#legendTicks span').length") == 8,
              str(pg.evaluate("() => document.querySelectorAll('#legendTicks span').length")))
        check("A6 载入零 pageerror", not errs, str(errs[:3]))
        check("A7 Canvas 渲染器", pg.evaluate("() => map.options.preferCanvas === true"))
        rm = pg.evaluate("() => window.__readyMs")
        check("A8 就绪耗时 <20s", rm is not None and rm < 20000, f"{rm} ms")
        # 初始视野：整都可见且不被顶栏/卡片压住
        mt = pg.evaluate("() => document.getElementById('map').getBoundingClientRect().top")
        hb = pg.evaluate("() => document.querySelector('header').getBoundingClientRect().bottom")
        check("A9 地图不压顶栏", mt >= hb - 1, f"map_top={mt:.0f} header_bottom={hb:.0f}")
        corners = pg.evaluate("""() => {
          const pts=[[35.53,139.0],[35.53,139.95],[35.95,139.0],[35.95,139.95]];
          const r=document.getElementById('map').getBoundingClientRect();
          return pts.map(p=>{const q=map.latLngToContainerPoint(p);return [q.x,q.y,r.width,r.height];});
        }""")
        inside = all(0 <= x <= w and 0 <= y <= h for x, y, w, h in corners)
        check("A10 整都四角都在图内", inside, json.dumps([[round(x), round(y)] for x, y, _, _ in corners]))
        cwd = pg.evaluate("() => document.getElementById('card').getBoundingClientRect().width")
        ex = pg.evaluate("() => map.latLngToContainerPoint([35.6,139.95]).x")
        win = pg.evaluate("() => innerWidth")
        check("A11 东缘在卡片之左", ex <= win - cwd, f"card={cwd:.0f} east_x={ex:.0f} win={win}")
        check("A12 分数级缩放生效", pg.evaluate("() => map.getZoom()") % 1 != 0, str(pg.evaluate("() => map.getZoom()")))
        # 缩放控件必须真能被点到（不被顶栏/卡片盖住）
        hit = pg.evaluate("""() => {
          const b=document.querySelector('.leaflet-control-zoom-in');
          if(!b)return 'missing';
          const r=b.getBoundingClientRect();
          const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return el===b||b.contains(el)?'ok':(el&&el.className||'other');
        }""")
        check("A13 缩放控件可点(未被遮挡)", hit == "ok", str(hit))
        z0 = pg.evaluate("() => map.getZoom()")
        pg.click(".leaflet-control-zoom-in"); pg.wait_for_timeout(700)
        check("A14 点+真的放大", pg.evaluate("() => map.getZoom()") > z0, f"{z0} -> {pg.evaluate('() => map.getZoom()')}")
        pg.click(".leaflet-control-zoom-out"); pg.wait_for_timeout(700)

        # ---- B. 档位切换 ----
        pg.click('button[data-mode="muni"]'); pg.wait_for_timeout(900)
        check("B1 区市面 mode", pg.evaluate("() => mode") == "muni")
        check("B2 区市面层在图上", pg.evaluate("() => map.hasLayer(wardLayer) && !map.hasLayer(chomeLayer)"))
        check("B3 区市面卡片=新宿区", (pg.text_content("#card h2") or "").strip() == "新宿区",
              (pg.text_content("#card h2") or "").strip())
        check("B4 区市面图例无町丁档", "町丁档" not in (pg.text_content("#legendTitle") or ""),
              (pg.text_content("#legendTitle") or "").strip())
        pg.click('button[data-mode="chome"]'); pg.wait_for_timeout(900)
        check("B5 回町丁面卡片复位", "歌舞伎町2丁目" in (pg.text_content("#card h2") or ""),
              (pg.text_content("#card h2") or "").strip())

        # ---- C. 缩放不切档 ----
        pg.evaluate("() => { map.setZoom(17); }"); pg.wait_for_timeout(700)
        check("C1 放大到17档不变", pg.evaluate("() => mode") == "chome")
        pg.evaluate("() => { map.setZoom(9); }"); pg.wait_for_timeout(700)
        check("C2 缩小到9档不变", pg.evaluate("() => mode") == "chome")

        # ---- D. 指标 × 时间 全扫 ----
        metrics = ["total", "nb", "bi", "r", "v", "o"]
        labels = {"total": "全部刑法犯", "nb": "非入室盗窃", "bi": "入室盗窃",
                  "r": "粗暴犯", "v": "凶恶犯", "o": "其他"}
        bad = []
        for t in ("R7", "R8"):
            pg.click(f'button[data-t="{t}"]'); pg.wait_for_timeout(500)
            for m in metrics:
                pg.select_option("#metric", m); pg.wait_for_timeout(450)
                title = pg.text_content("#legendTitle") or ""
                ticks = pg.evaluate("() => [...document.querySelectorAll('#legendTicks span')].map(s=>parseFloat(s.textContent))")
                card = pg.text_content("#card") or ""
                ok_title = labels[m] in title and ("R7年计" in title if t == "R7" else "R8当年累计" in title) and "封顶" in title
                ok_ticks = len(ticks) == 8 and all(ticks[i] <= ticks[i + 1] for i in range(7))
                ok_card = labels[m] in card and "—" != card.strip()
                if not (ok_title and ok_ticks and ok_card):
                    bad.append((t, m, title, ticks, ok_card))
        check("D1 12 组指标×时间 图例/刻度/卡片", not bad, json.dumps(bad, ensure_ascii=False)[:400])
        same = pg.evaluate("() => colorForChome(8.2) !== colorForChome(1331.5)")
        check("D3 危险/安全不同色(8.2 vs 1331)", same,
              pg.evaluate("() => colorForChome(8.2) + ' vs ' + colorForChome(1331.5)"))
        check("D2 扫完零 pageerror", not errs, str(errs[:3]))
        # 复位
        pg.select_option("#metric", "total"); pg.click('button[data-t="R7"]'); pg.wait_for_timeout(700)

        # ---- E. 绝对标尺断点单调（6 指标 × 8 断点严格递增） ----
        sc = pg.evaluate("() => Object.fromEntries(Object.entries(SCALES).map(([m, s]) => [m, s.breaks]))")
        bad_sc = {m: b for m, b in sc.items()
                  if not (len(b) == 8 and all(b[i] < b[i + 1] for i in range(7)))}
        check("E1 六指标标尺断点严格递增", not bad_sc, json.dumps(bad_sc)[:300])
        pg.click('button[data-t="R8"]'); pg.wait_for_timeout(500)
        sc2 = pg.evaluate("() => SCALES.total.breaks")
        check("E2 换时间不断点(绝对可比)", sc2 == sc["total"],
              (pg.text_content("#legendTitle") or "").strip())
        pg.click('button[data-t="R7"]'); pg.wait_for_timeout(500)

        # ---- F. 搜索 ----
        q = "#q"
        pg.fill(q, "zzzz"); pg.wait_for_timeout(400)
        check("F1 无匹配提示", "无匹配" in (pg.text_content("#drop") or ""), (pg.text_content("#drop") or "")[:40])
        pg.fill(q, "町田"); pg.wait_for_timeout(400)
        n = pg.evaluate("() => document.querySelectorAll('#drop div[data-n]').length")
        check("F2 町田命中町丁", n >= 5, str(n))
        pg.fill(q, "八王子市"); pg.wait_for_timeout(400)
        check("F3 区市命中", pg.evaluate("() => document.querySelectorAll('#drop div[data-w]').length") >= 1)
        pg.evaluate("() => document.querySelector('#drop div[data-w]').click()"); pg.wait_for_timeout(1800)
        check("F4 搜索区市→区市卡", (pg.text_content("#card h2") or "").strip() == "八王子市",
              (pg.text_content("#card h2") or "").strip())
        pg.fill(q, ""); pg.wait_for_timeout(300)
        check("F5 清空关下拉", pg.evaluate("() => getComputedStyle(document.getElementById('drop')).display") == "none")
        # Enter 触发
        pg.fill(q, "歌舞伎町"); pg.keyboard.press("Enter"); pg.wait_for_timeout(600)
        check("F6 Enter 出结果", pg.evaluate("() => document.querySelectorAll('#drop div').length") >= 1)
        # 点外部关
        pg.mouse.click(700, 700); pg.wait_for_timeout(300)
        check("F7 点外部关下拉", pg.evaluate("() => getComputedStyle(document.getElementById('drop')).display") == "none")
        pg.click(q); pg.wait_for_timeout(400)
        check("F8 重新聚焦重开下拉", pg.evaluate("() => getComputedStyle(document.getElementById('drop')).display") == "block")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        check("F9 Esc 关下拉", pg.evaluate("() => getComputedStyle(document.getElementById('drop')).display") == "none")

        # ---- G. 无面町丁 ----
        pg.fill(q, "三栄町"); pg.wait_for_timeout(400)
        pg.evaluate("() => document.querySelector('#drop div[data-n]').click()"); pg.wait_for_timeout(1200)
        card = pg.text_content("#card") or ""
        check("G1 无面卡片出件数+无面注", "暂无町丁界" in card and "件" in card, card[:80].replace("\n", " "))
        check("G2 无面不崩", not errs, str(errs[:3]))
        hi0 = pg.evaluate("() => chomeLayer.getLayers().filter(l=>l.options.fillColor===shade(colorForChome(chomeRateF(l.feature.properties)))).length")
        check("G3 无面点击后无残留加深", hi0 == 0, str(hi0))

        # ---- H. 岛屿 ----
        pg.fill(q, "大島町"); pg.wait_for_timeout(400)
        has = pg.evaluate("() => document.querySelectorAll('#drop div').length")
        check("H1 大島町可搜", has >= 1, str(has))
        pg.evaluate("() => document.querySelector('#drop div[data-n]').click()"); pg.wait_for_timeout(1500)
        card = pg.text_content("#card h2") or ""
        check("H2 岛屿町丁卡", "大島町" in card, card.strip())

        # ---- I. 区市卡 Top 跳转（23区 + 多摩） ----
        for ward, label in (("新宿区", "23区"), ("八王子市", "多摩")):
            pg.evaluate(f"() => selectWard('{ward}')"); pg.wait_for_timeout(700)
            cnt = pg.evaluate("() => document.querySelectorAll('#card .tops div[data-n]').length")
            check(f"I-{label} {ward} Top 数>0", cnt > 0, str(cnt))
            if cnt:
                pg.evaluate("() => document.querySelectorAll('#card .tops div[data-n]')[0].click()")
                pg.wait_for_timeout(2200)
                check(f"I-{label} 点 Top 进町丁", pg.evaluate("() => mode") == "chome",
                      pg.evaluate("() => mode") + "|" + (pg.text_content("#card h2") or "").strip())

        # ---- J. 悬停读数 ----
        pg.evaluate("""() => {
          const l = chomeLayer.getLayers().find(x => x.feature.properties.name === '新宿区歌舞伎町2丁目');
          l.fire('mouseover');
        }""")
        pg.wait_for_timeout(300)
        hn = pg.text_content("#hovername") or ""
        check("J1 悬停读数含名字与千人率", "歌舞伎町2丁目" in hn and "/千人" in hn, hn)
        styled = pg.evaluate("""() => {
          const l = chomeLayer.getLayers().find(x => x.feature.properties.name !== '新宿区歌舞伎町2丁目');
          l.fire('mouseover');
          const c = l.options.color, w = l.options.weight;
          l.fire('mouseout');
          return c + '/' + w;
        }""")
        check("J2 悬停不动样式(无黑边)", styled == "#ffffff/0.6", styled)

        # ---- K. 选中加深互斥 ----
        pg.evaluate("() => selectChome('新宿区歌舞伎町2丁目')"); pg.wait_for_timeout(600)
        hi = pg.evaluate("""() => chomeLayer.getLayers().filter(l=>l.options.fillColor===shade(colorForChome(chomeRateF(l.feature.properties)))).map(l=>l.feature.properties.name)""")
        check("K1 町丁选中加深唯一", len(hi) == 1, str(hi))
        pg.evaluate("() => selectWard('新宿区')"); pg.wait_for_timeout(700)
        hiw = pg.evaluate("""() => wardLayer.getLayers().filter(l=>{const w=WARDS.find(x=>x.ward===l.feature.properties.ward_ja);const base=(!w||w.nodata)?'#eeeeee':colorFor(rateOf(w));return l.options.fillColor===shade(base);}).map(l=>l.feature.properties.ward_ja)""")
        check("K2 区市选中加深唯一", len(hiw) == 1, str(hiw))

        # ---- L. 回区市按钮 ----
        pg.evaluate("() => selectChome('新宿区歌舞伎町2丁目')"); pg.wait_for_timeout(700)
        pg.evaluate("() => document.querySelector('#card .tops div[data-w]').click()"); pg.wait_for_timeout(900)
        check("L1 回区市按钮", (pg.text_content("#card h2") or "").strip() == "新宿区" and pg.evaluate("() => mode") == "muni",
              (pg.text_content("#card h2") or "").strip())

        # ---- M. 绝对标尺分档质量（9 色用满，危险/安全可辨） ----
        pg.evaluate("() => setMode('chome')"); pg.wait_for_timeout(500)
        dist = {}
        for m in metrics:
            pg.select_option("#metric", m); pg.wait_for_timeout(600)
            d = pg.evaluate("""() => {
              const c={};
              chomeLayer.getLayers().forEach(l=>{const k=l.options.fillColor||'-';c[k]=(c[k]||0)+1;});
              return c;
            }""")
            dist[m] = d
        thin = {m: len([k for k in d if k not in ("#e8e6e0", "#ffffff")]) for m, d in dist.items()
                if len([k for k in d if k not in ("#e8e6e0", "#ffffff")]) < 9}
        check("M1 各指标9色用满", not thin,
              json.dumps({m: len([k for k in d if k not in ("#e8e6e0", "#ffffff")]) for m, d in dist.items()}))
        check("M2 指标间分档不同", dist["total"] != dist["v"], f"total {len(dist['total'])}色 vs v {len(dist['v'])}色")
        pg.select_option("#metric", "v"); pg.wait_for_timeout(600)
        cbr2 = pg.evaluate("() => SCALES.v.breaks")
        check("M3 凶恶犯断点严格递增", len(cbr2) == 8 and all(cbr2[i] < cbr2[i + 1] for i in range(7)), str(cbr2))
        check("M4 零膨胀指标图例注明", "零案件单独一档" in (pg.text_content("#legendTitle") or ""),
              (pg.text_content("#legendTitle") or "").strip())
        pg.select_option("#metric", "total"); pg.wait_for_timeout(600)
        check("M5 非零膨胀指标不注明", "零案件单独一档" not in (pg.text_content("#legendTitle") or ""),
              (pg.text_content("#legendTitle") or "").strip())
        mt2 = pg.evaluate("() => document.getElementById('map').getBoundingClientRect().top")
        hb2 = pg.evaluate("() => document.querySelector('header').getBoundingClientRect().bottom")
        check("M6 图例变长后地图仍不压顶栏", mt2 >= hb2 - 1, f"map_top={mt2:.0f} header_bottom={hb2:.0f}")

        check("Z1 全程零 pageerror", not errs, str(errs[:3]))
        check("Z2 全程零 console error", not [c for c in cons if c[0] == "error"], str([c for c in cons if c[0] == "error"][:3]))

        # ---- T. 深色模式 ----
        pg.evaluate("() => window.__setTheme('dark')"); pg.wait_for_timeout(800)
        dark_bar = pg.evaluate("() => [...document.querySelectorAll('#legendBar div')].map(d=>d.style.background)")
        light_bar = pg.evaluate("() => ramp().map((c,i)=>c)")
        check("T1 深色9色图例", len(dark_bar) == 9 and dark_bar[0] != "#ffffcc", str(dark_bar[:2]))
        check("T2 深色浅黄提亮", dark_bar[0].lower() != "#ffffcc", dark_bar[0])
        sep = pg.evaluate("() => { let c=null; chomeLayer.getLayers().forEach(l=>{ if(l.feature.properties.name==='あきる野市三内') c=l.options.color; }); return c; }")
        check("T3 深色分隔线", sep == "#3a3128", str(sep))
        check("T4 深色按钮文案切浅色", (pg.text_content("#themeBtn") or "").strip() == "浅色",
              (pg.text_content("#themeBtn") or "").strip())
        check("T5 深色记忆localStorage", pg.evaluate("() => localStorage.getItem('tokyo-crime-theme')") == "dark",
              pg.evaluate("() => localStorage.getItem('tokyo-crime-theme')"))
        check("T6 深色零pageerror", not errs, str(errs[:3]))
        pg.evaluate("() => window.__setTheme('light')"); pg.wait_for_timeout(800)
        check("T7 切回浅色分隔线", pg.evaluate("() => { let c=null; chomeLayer.getLayers().forEach(l=>{ if(l.feature.properties.name==='あきる野市三内') c=l.options.color; }); return c; }") == "#ffffff",
              pg.evaluate("() => document.documentElement.dataset.theme || 'light'"))
        check("T8 切回浅色图例", pg.evaluate("() => document.querySelector('#legendBar div').style.background") in ("#ffffcc", "rgb(255, 255, 204)"),
              pg.evaluate("() => document.querySelector('#legendBar div').style.background"))

        # ---- N. 手机版 ----
        mctx = b.new_context(viewport={"width": 390, "height": 844})
        mp = mctx.new_page()
        merrs = []
        mp.on("pageerror", lambda e: merrs.append(str(e)))
        mp.goto(URL, wait_until="networkidle", timeout=120000)
        mp.wait_for_timeout(9000)
        box = mp.evaluate("() => {const r=document.getElementById('card').getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight};}")
        check("N1 手机卡片在屏内", box["l"] >= 0 and box["r"] <= box["w"] + 1 and box["b"] <= box["h"] + 1, json.dumps(box))
        ovf = mp.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1")
        check("N2 手机无横向溢出", ovf, str(mp.evaluate("() => [document.documentElement.scrollWidth, innerWidth]")))
        check("N3 手机零 pageerror", not merrs, str(merrs[:3]))
        check("N4 手机卡片有内容", "歌舞伎町2丁目" in (mp.text_content("#card") or ""),
              (mp.text_content("#card") or "")[:30].replace("\n", " "))
        check("N5 手机卡片可滚到底",
              mp.evaluate("() => {const c=document.getElementById('card');c.scrollTop=c.scrollHeight;return c.scrollTop>0||c.scrollHeight<=c.clientHeight;}"))
        mh = mp.evaluate("() => document.querySelector('header').getBoundingClientRect().height")
        check("N6 手机顶栏不超 1/3 屏高", mh <= 844 / 3, f"{mh:.0f}px")
        mhit = mp.evaluate("""() => {
          const b=document.querySelector('.leaflet-control-zoom-in');
          if(!b)return 'missing';
          const r=b.getBoundingClientRect();
          const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return el===b||b.contains(el)?'ok':(el&&el.className||'other');
        }""")
        check("N7 手机缩放控件可点", mhit == "ok", str(mhit))
        mp.screenshot(path="qa/out/mobile.png")
        mctx.close()

        pg.screenshot(path="qa/out/desktop_final.png")
        b.close()
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--retries", type=int, default=4)
    a = ap.parse_args()
    URL = f"http://127.0.0.1:{a.port}/index.html"
    for i in range(1, a.retries + 1):
        try:
            attempt(a, URL)
            break
        except Exception as e:
            print(f"[attempt {i}/{a.retries}] 驱动中断: {type(e).__name__}: {str(e)[:120]}", flush=True)
            if i == a.retries:
                traceback.print_exc()
                sys.exit(2)
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n=== {len(RESULTS) - len(fails)}/{len(RESULTS)} PASS ===")
    for n, _, d in fails:
        print("FAIL:", n, "::", d)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    import os
    os.makedirs("qa/out", exist_ok=True)
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(2)
