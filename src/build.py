#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build.py — render the japan.ouuut.com site into site/.

Single source of truth:
  app/quake/data/*      USGS hypocentres + coastline
  app/crime/data/*      Tokyo chome counts + polygons + population
  app/cabinet/data.json polls + cabinets
  app/housing/data/*   Tokyo 23-ward used-flat median prices (MLIT) + ward polygons
  src/*.css, src/shell.js

Output: pre-rendered pages + assets + CSV + sitemap + headers.
"""
import csv
import hashlib
import html
import json
import math
import os
import re
import shutil
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import svgkit as S
import home_plates as HP
import hant
import view_i18n

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SRC = ROOT / "src"
PACKS = SRC / "packs"   # sai-assets 包的只读拷贝(见 design-lock.json assets[])
WEATHER_SRC = SRC / "weather"
SITE_URL = "https://japan.ouuut.com"
BRAND = "japan.ouuut.com"
# 六色字标：只有 ouuut 五个字母和第二个点吃六色，japan / com 保持墨色，
# 这样字标还是一句话，而不是一道彩虹。顺序与站点六章一致（青磁→紫）。
SIX = ("--c-weather", "--c-quake", "--c-crime", "--c-cabinet", "--c-housing", "--c-population")
WM_COLOUR = {6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5}

# 2026-11-04 换标:字标开头那枚手绘 O。它替换 index 6 的 `o`(japan.|o|uuut.com),
# 颜色仍由 WM_COLOUR 给到 --c-weather,所以 A/B/C/D 四套配色跟着变量走。
# 几何的唯一真相源是 ouuut-brand 仓的资产,构建期读,不在本站抄第二份 path;
# 尺寸公式(Outfit 800:标记 ink 高 = o ink 高 × 1.10)见 src/app.css 的 .wm-mark。
# 别的机器(VPS 日更)用 OUUUT_MARK_JSON 指向同一份资产 —— 与 src/fonts.py 的 PANOUT_* 同法。
MARK_JSON = Path(os.environ.get("OUUUT_MARK_JSON",
                               "F:/projects/ouuut-brand/logo/ouuut-mark.json"))
MARK_INDEX = 6


def wm_mark():
    """Inline SVG for the hand-drawn O, or "" when the brand asset is not on this machine.

    A missing asset must not stop a build: the mark is decorative, and the daily VPS
    pipeline has to keep publishing. We fall back to the plain letter o the wordmark
    used before the 2026-11-04 rebrand, loudly.
    """
    if not MARK_JSON.is_file():
        print(f"[warn] 缺 O 标记 {MARK_JSON}(唯一真相源是 ouuut-brand 的 logo/ouuut-mark.json;"
              f"别的机器用 OUUUT_MARK_JSON 指到它的路径)—— 已退回字母 o")
        return ""
    mark = json.loads(MARK_JSON.read_text(encoding="utf-8"))
    x0, y0, x1, y1 = mark["bounds"]
    viewbox = f"{x0} {y0} {round(x1 - x0, 2)} {round(y1 - y0, 2)}"
    return (f'<svg class="wm-mark" viewBox="{viewbox}" aria-hidden="true" focusable="false">'
            f'<path fill="currentColor" d="{mark["d"]}"/></svg>')


MARK = wm_mark()


def paint_chars(text):
    """Wrap each glyph in its chapter colour; the cycle restarts at every space."""
    out, k = [], 0
    for ch in text:
        if ch == " ":
            out.append(" ")
            k = 0
            continue
        out.append(f'<span style="color:var({SIX[k % 6]})">{ch}</span>')
        k += 1
    return "".join(out)


def wm_glyphs(anim=False, aria=False):
    out = []
    for i, ch in enumerate(BRAND):
        css = []
        if anim:
            css.append(f"--i:{i}")
        if i in WM_COLOUR:
            css.append(f"color:var({SIX[WM_COLOUR[i]]})")
        else:
            css.append("color:var(--ink)")
        style = f' style="{";".join(css)}"' if css else ""
        hide = ' aria-hidden="true"' if aria else ""
        body = MARK if (i == MARK_INDEX and MARK) else ch
        out.append(f"<span{hide}{style}>{body}</span>")
    return "".join(out)


WM = wm_glyphs()


def animated_wordmark():
    """The plain domain is the static/no-JS and accessible name; layers are visual."""
    layers = []
    phrases = (("ja", "六つの尺度で日本を見る"), ("zh", "六种尺度看日本"), ("en", "Six scales of Japan"))
    for group, text in (("domain", BRAND),) + tuple(
            (f"phrase-{lang}", phrase) for lang, phrase in phrases):
        if group == "domain":
            glyphs = wm_glyphs(anim=True, aria=True)
        else:
            glyphs = "".join(f'<span aria-hidden="true" style="--i:{i}">{"&nbsp;" if c == " " else c}</span>'
                             for i, c in enumerate(text))
        phrase_class = " wm-phrase" if group.startswith("phrase-") else ""
        layers.append(f'<span class="wm-cycle wm-{group}{phrase_class}" aria-hidden="true">{glyphs}</span>')
    return ('<span class="wm-static">' + WM + '</span>'
            '<span class="wm-stage" aria-hidden="true">' + "".join(layers) + '</span>')


BUILD_DATE = datetime.now().strftime("%Y-%m-%d")
BUILD_STAMP = datetime.now().strftime("%Y-%m-%d %H:%M")

# GA4:测量 ID 由项目侧取回(勿在构建脚本里另建属性)。在 head() 里统一注入,
# 四条语言路由 × 7 页面 = 28 张静态页各一段,除 gtag.js 外不引其它分析脚本。
GA_ID = "G-5Z2XZ044F6"
GA_SNIPPET = (
    f'<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>\n'
    f'<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}'
    f'gtag("js",new Date());gtag("config","{GA_ID}");</script>\n')

# ---------------------------------------------------------------- data
Q = json.loads((ROOT / "app/quake/data/quakes.json").read_text(encoding="utf-8"))
OUTLINE = json.loads((ROOT / "app/quake/data/japan-outline.json").read_text(encoding="utf-8"))

# 站点上所有地震数字都从同一份目录算出来（此前 40,079 是旧快照的硬编码，与地图实际数据不符）
Q_N = len(Q)
Q_END = max(e["time"] for e in Q)
Q_END_MONTH = Q_END[:7]
Q_END_JA = f"{Q_END[0:4]}年{int(Q_END[5:7])}月"
Q_END_DOT = Q_END_MONTH.replace("-", ".")
Q_END_DAY_JA = f"{Q_END[0:4]}年{int(Q_END[5:7])}月{int(Q_END[8:10])}日"
_Q_E = sum(10 ** (1.5 * e["mag"]) for e in Q)
PCT_2011_N = round(100 * sum(1 for e in Q if e["time"][:4] == "2011") / Q_N, 1)
PCT_2011_E = round(100 * sum(10 ** (1.5 * e["mag"]) for e in Q if e["time"][:4] == "2011") / _Q_E, 1)
# 正文里出现的两个数字也从同一份目录算,和统计枠一样不直写:
# M6 以上の点数と、カタログ全体の最大マグニチュード。
Q_M6_N = sum(1 for e in Q if e["mag"] >= 6)
Q_MAX = max(e["mag"] for e in Q)
Q_MAX_DAY = max(Q, key=lambda e: e["mag"])["time"][:10]
_MONTHS_EN = ("January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December")


def _day_ja(d):
    return f"{d[0:4]}年{int(d[5:7])}月{int(d[8:10])}日"


def _day_zh(d):
    return f"{d[0:4]} 年 {int(d[5:7])} 月 {int(d[8:10])} 日"


def _day_en(d):
    return f"{int(d[8:10])} {_MONTHS_EN[int(d[5:7]) - 1]} {d[0:4]}"


def _ym_ja(ym):
    return f"{ym[0:4]}年{int(ym[5:7])}月"


def _ym_zh(ym):
    return f"{ym[0:4]} 年 {int(ym[5:7])} 月"


def _ym_en(ym):
    return f"{_MONTHS_EN[int(ym[5:7]) - 1]} {ym[0:4]}"

# 每页三语 title/description：静态 HTML 里只有 ja，shell 在切语言时替换 head
PAGE_META = {
    "home": {
        "ja": (f"{BRAND} — 日本を、六つの尺度で見る",
               f"{f"{Q_N:,}"}の震源、5,234の町丁、331か月の内閣支持率、23区の住宅価格、47都道府県の天気、1,719市町村の人口。六つの尺度、六つの入口から直接起動する。"),
        "zh-Hans": (f"{BRAND} — 用六个尺度看日本",
               f"{f"{Q_N:,}"} 个震源、5,234 个町丁、331 个月的內閣支持率、23 区住宅价格、47 个都道府县的天气、1,719 个市町村的人口。六个尺度，六个入口直接启动。"),
        "en": (f"{BRAND} — Japan in six scales",
               f"{f"{Q_N:,}"} hypocentres, 5,234 neighbourhoods, 331 months of cabinet approval, 23-ward housing prices, 47-prefecture weather and 1,719 municipalities of population. Six scales; six entry points."),
    },
    "quake": {
        "ja": (f"地震 — {f"{Q_N:,}"}の震源 | {BRAND}",
               f"2000年から{Q_END_JA}までのM4以上震源{f"{Q_N:,}"}点。年別・月別・深さ・エネルギーで見る。"),
        "zh-Hans": (f"地震 — {f"{Q_N:,}"} 个震源 | {BRAND}",
               f"2000 年至 {Q_END_JA}，M4 以上震源 {f"{Q_N:,}"} 点。按年份、月份、深度与能量查看。"),
        "en": (f"Earthquakes — {f"{Q_N:,}"} hypocentres | {BRAND}",
               f"{f"{Q_N:,}"} M4+ hypocentres from 2000 to {Q_END_JA}. By year, month, depth and energy."),
    },
    "crime": {
        "ja": (f"犯罪 — 5,234の町丁 | {BRAND}",
               "2025年の東京都内5,234町丁の認知件数。人口あたりの率で62区市町村を並べる。"),
        "zh-Hans": (f"犯罪 — 5,234 个町丁 | {BRAND}",
               "2025 年东京都内 5,234 个町丁的立案数，按人均发案率排列 62 个区市町村。"),
        "en": (f"Crime — 5,234 neighbourhoods | {BRAND}",
               "Recorded offences for 5,234 neighbourhoods across Tokyo in 2025, ranked per capita across 62 municipalities."),
    },
    "cabinet": {
        "ja": (f"内閣 — 331か月の支持率 | {BRAND}",
               "1998年から2026年までの内閣支持率646調査。月次平均331か月、14内閣。"),
        "zh-Hans": (f"内阁 — 331 个月的支持率 | {BRAND}",
               "1998 年至 2026 年的 646 次内阁支持率调查，月度均值 331 个月、14 届内阁。"),
        "en": (f"Cabinet — 331 months of approval | {BRAND}",
               "646 approval polls from 1998 to 2026: 331 monthly means across 14 cabinets."),
    },
    "housing": {
        "ja": (f"住宅 — 町名の価格 | {BRAND}",
               "東京の中古マンション成約価格。直近4四半期（2025Q2–2026Q1）を町名（地区名）ごとの平均㎡単価で塗った地図。国交省データを加工。"),
        "zh-Hans": (f"住宅 — 町名房价 | {BRAND}",
               "东京二手房成交价：把最近四个季度（2025Q2–2026Q1）按町名的平均㎡单价涂成地图，数据来自国土交通省。"),
        "en": (f"Housing — town-level prices | {BRAND}",
               "Closed condo prices in Tokyo for the latest four quarters (2025Q2–2026Q1), mapped as mean price per m² by town. Derived from MLIT data."),
    },
    "weather": {
        "ja": (f"天気 — 日本の47都道府県 | {BRAND}",
               "気象庁の予報から、47都道府県の今日・明日と7日間の天気、気温、降水確率を見る。"),
        "zh-Hans": (f"天气 — 日本47都道府县 | {BRAND}",
               "来自日本气象厅的预报：47 个都道府县的今天、明天与未来七天天气、气温和降水概率。"),
        "en": (f"Weather — Japan’s 47 prefectures | {BRAND}",
               "JMA forecasts for all 47 prefectures: today, tomorrow and the next seven days, with temperatures and precipitation probability."),
    },
    "404": {
        "ja": (f"404 — この頁は、ない | {BRAND}", "このURLには頁がありません。表紙または五つの章から辿り直せます。"),
        "zh-Hans": (f"404 — 这一页不存在 | {BRAND}", "这个网址没有对应页面。可以回到首页或五个章节。"),
        "en": (f"404 — Page not found | {BRAND}", "No page exists at this URL. Return to the cover or choose a chapter."),
    },
}
CAB = json.loads((ROOT / "app/cabinet/data.json").read_text(encoding="utf-8"))
MUNI = json.loads((ROOT / "app/crime/data/muni.json").read_text(encoding="utf-8"))
POINTS = json.loads((ROOT / "app/crime/data/points.json").read_text(encoding="utf-8"))
CHOME = json.loads((ROOT / "app/crime/data/chome_poly.json").read_text(encoding="utf-8"))
MUNI_POLY = json.loads((ROOT / "app/crime/data/muni_poly.json").read_text(encoding="utf-8"))
HOUSE = json.loads((ROOT / "app/housing/data/wards.json").read_text(encoding="utf-8"))
HOUSE_WARDS = HOUSE["wards"]
HOUSE_TOWNS_DOC = json.loads((ROOT / "app" / "housing" / "data" / "towns.json").read_text(encoding="utf-8"))
HOUSE_N = HOUSE_TOWNS_DOC["n"]
HOUSE_TOWNS = sum(1 for x in HOUSE_TOWNS_DOC["towns"] if x["n"])
HOUSE_TOWNS_ALL = len(HOUSE_TOWNS_DOC["towns"])
HOUSE_TOWNS_ZERO = HOUSE_TOWNS_ALL - HOUSE_TOWNS
POP = json.loads((ROOT / "app/population/data/population.json").read_text(encoding="utf-8"))
POP_N = POP["meta"]["national"]
_POP50_M = POP["age"]["y2050"]["male"]
_POP50_F = POP["age"]["y2050"]["female"]
_POP50_T = sum(_POP50_M) + sum(_POP50_F)
POP_2050_65 = round(100 * (sum(_POP50_M[13:]) + sum(_POP50_F[13:])) / _POP50_T, 1)
POP_2050_0 = round(100 * (sum(_POP50_M[:3]) + sum(_POP50_F[:3])) / _POP50_T, 1)
PAGE_META["population"] = {
    "ja": (f"人口 — {POP['meta']['n']:,}市町村のいま | {BRAND}",
           f"2025年国勢調査。{POP_N['pop']:,}人、{POP['meta']['n']:,}市町村。"
           f"{100 * POP_N['declining'] / POP['meta']['n']:.1f}%の市町村が減少し、"
           f"{POP_N['decliningShare']}%が減少市町村に住む。2050年は{POP_N['pop2050']:,}人。"),
    "zh-Hans": (f"人口 — {POP['meta']['n']:,} 个市町村的现在 | {BRAND}",
           f"2025 年国势调查。{POP_N['pop']:,} 人、{POP['meta']['n']:,} 个市町村。"
           f"{100 * POP_N['declining'] / POP['meta']['n']:.1f}% 的市町村在减少，"
           f"{POP_N['decliningShare']}% 的人住在减少的市町村。2050 年为 {POP_N['pop2050']:,} 人。"),
    "en": (f"Population — {POP['meta']['n']:,} municipalities | {BRAND}",
           f"2025 census: {POP_N['pop']:,} people across {POP['meta']['n']:,} municipalities. "
           f"{100 * POP_N['declining'] / POP['meta']['n']:.1f}% of municipalities are shrinking; "
           f"{POP_N['decliningShare']}% of people live in them. {POP_N['pop2050']:,} by 2050."),
}
# 繁体的 title/description 同样由简体列转出,不另维护一份(见 src/hant.py)。
for _page in PAGE_META:
    PAGE_META[_page]["zh-Hant"] = (hant.convert(PAGE_META[_page]["zh-Hans"][0]),
                                   hant.convert(PAGE_META[_page]["zh-Hans"][1]))

_weather_raw = (WEATHER_SRC / "data.js").read_text(encoding="utf-8")
WEATHER_DOC = json.loads(_weather_raw.split("=", 1)[1].rstrip().rstrip(";"))
WEATHER_REGIONS = WEATHER_DOC["regions"]

# 天気スナップショットの日付。页面は「今日/明日」を日付から導くので、古いスナップショットを
# 新しいサイトに載せたときだけ嘘になる —— ここで見張るのはその一点。
JST = timezone(timedelta(hours=9))


def _jst_day(stamp):
    """UTC/オフセット付き ISO タイムスタンプ → JST の YYYY-MM-DD。"""
    return datetime.fromisoformat(str(stamp).replace("Z", "+00:00")).astimezone(JST).date().isoformat()


# JMA の発表日(= 页面の「今日」が指す日)と、このビルドを走らせた日。
WEATHER_REPORT_DATE = _jst_day(WEATHER_REGIONS[0]["reportDatetime"])
WEATHER_SNAPSHOT_DATE = _jst_day(WEATHER_DOC["generatedAt"])
WEATHER_TODAY = datetime.now(JST).date().isoformat()
WEATHER_STALE = WEATHER_REPORT_DATE != WEATHER_TODAY

MUNI_BY = {m["ward"]: m for m in MUNI}
CAB_BY = {c["pm"]: c for c in CAB["cabinets"]}
POLLS = CAB["polls"]


def energy(mag):
    return 10 ** (1.5 * float(mag) + 4.8)


TOTAL_E = sum(energy(x["mag"]) for x in Q)

QY = defaultdict(list)
QM = defaultdict(list)
for x in Q:
    QY[x["time"][:4]].append(x)
    QM[x["time"][:7]].append(x)
YEARS = sorted(QY)
YEAR_E = {y: sum(energy(x["mag"]) for x in v) for y, v in QY.items()}
MAX_ENERGY = max(YEAR_E.values())

# crime ward aggregates
WARD_RATE = {}
for m in MUNI:
    pop = m.get("pop") or 0
    tot = (m.get("R7") or {}).get("total", 0)
    WARD_RATE[m["ward"]] = (tot / pop * 1000) if pop else None
WARD_RANK = {w: i + 1 for i, (w, r) in enumerate(
    sorted(((w, r) for w, r in WARD_RATE.items() if r is not None), key=lambda t: -t[1]))}

TOTAL_CRIME = sum((m.get("R7") or {}).get("total", 0) for m in MUNI)
CHOME_RATES = sorted(
    (p.get("t") or 0) / p["pop"] * 1000
    for p in POINTS if (p.get("pop") or 0) >= 200)
CHOME_MEDIAN = CHOME_RATES[len(CHOME_RATES) // 2]
CHOME_MAX = CHOME_RATES[-1]
TOTAL_POP = sum((m.get("pop") or 0) for m in MUNI)
CHOME_COUNT = len(POINTS)
# 地図の枠は本土だけ(島嶼部は枠外)。率を出さない町丁の数もデータから数える。
CHOME_MAINLAND = sum(1 for p in POINTS
                     if p.get("lng") and 138.9 <= p["lng"] <= 139.96 and 35.46 <= p["lat"] <= 35.92)
CHOME_NO_RATE = sum(1 for p in POINTS if (p.get("pop") or 0) < 200)
CHOME_POP_MISSING = sum(1 for p in POINTS if p.get("g") == "*")
# 率の分母は町丁人口なので、本文に出す合計もその合計に揃える
# (区市町村別人口の合計とは約 6.7 万人ずれる)。
CHOME_POP = sum((p.get("pop") or 0) for p in POINTS)
C_META = json.loads((ROOT / "app/crime/data/meta.json").read_text(encoding="utf-8"))

# cabinet series
CAB_MONTHS = {}
for c in CAB["cabinets"]:
    buckets = defaultdict(lambda: [0.0, 0])
    for p in POLLS:
        if p["pm"] != c["pm"]:
            continue
        b = buckets[p["date"][:7]]
        b[0] += p["value"]
        b[1] += 1
    CAB_MONTHS[c["pm"]] = [(ym, v / n) for ym, (v, n) in sorted(buckets.items())]

ALL_MONTHS = sorted({p["date"][:7] for p in POLLS})
MONTH_MEAN = {}
for ym in ALL_MONTHS:
    vs = [p["value"] for p in POLLS if p["date"][:7] == ym]
    MONTH_MEAN[ym] = sum(vs) / len(vs)

# 最大の単月変動 = 連続する**実測月**どうしの月次平均の差の最大(補間しない)。
# 旧稿は +20.5 を手書きしていたが、それは「一つの内閣の内部で連続する月の最大の上げ幅」
# (2010年8月→9月・菅内閣)であって、この系列の最大単月変動ではなかった。数字は必ずこの
# 2 行から出す(カード・章の事実欄・本文が同じ値を見る)。
_SWING_I = max(range(1, len(ALL_MONTHS)),
               key=lambda i: MONTH_MEAN[ALL_MONTHS[i]] - MONTH_MEAN[ALL_MONTHS[i - 1]])
SWING_FROM, SWING_TO = ALL_MONTHS[_SWING_I - 1], ALL_MONTHS[_SWING_I]
SWING = MONTH_MEAN[SWING_TO] - MONTH_MEAN[SWING_FROM]

CAB_BUCKETS = defaultdict(int)
for p in POLLS:
    CAB_BUCKETS[(p["pm"], p["date"][:7])] += 1
N_BUCKETS = len(CAB_BUCKETS)
N_SINGLE = sum(1 for v in CAB_BUCKETS.values() if v == 1)
# 系列の両端は polls から導出(本文の「先頭/末尾」はここを見る)。
CAB_FIRST = min(POLLS, key=lambda p: p["date"])
CAB_LAST = max(POLLS, key=lambda p: p["date"])
POLL_SRC = defaultdict(int)
for _p in POLLS:
    POLL_SRC[_p["source"]] += 1

# ---------------------------------------------------------------- helpers


def esc(s):
    return html.escape(str(s), quote=True)


def n(x):
    return f"{int(round(x)):,}"


def f1(x):
    return f"{x:.1f}"


def pct(x, d=1):
    return f"{x * 100:.{d}f}"


def jp_compact(x):
    """122972528 -> 1億2297万; 104686386 -> 1億468万."""
    x = int(round(x))
    if x >= 100000000:
        oku, rem = divmod(x, 100000000)
        man = rem // 10000
        return f"{oku}億{man}万" if man else f"{oku}億"
    if x >= 10000:
        return f"{x // 10000}万"
    return f"{x:,}"


def sgn_pct(x, d=1):
    if x is None:
        return "—"
    return f"{x:+.{d}f}%"


def zh_compact(x):
    """Same as jp_compact with the simplified 亿."""
    return jp_compact(x).replace("億", "亿")


def jfmt(j):
    if j >= 1e18:
        return f"{j / 1e18:.2f}×10¹⁸"
    if j >= 1e15:
        return f"{j / 1e15:.2f}×10¹⁵"
    return f"{j / 1e12:.1f}×10¹²"


def slug_ward(w):
    for f in MUNI_POLY["features"]:
        if f["properties"]["ward_ja"] == w:
            return f["properties"]["ward_en"].lower().replace(" ", "-").replace(".", "")
    return re.sub(r"\W+", "-", w)


def ward_by_slug(s):
    for w in MUNI_BY:
        if slug_ward(w) == s:
            return w
    return None


def bar_svg(vals, labels=None, w=1000, h=250, accent_class="bar", highlight=None):
    pad_l, pad_b, pad_t, pad_r = 46, 26, 14, 6
    n_ = len(vals)
    maxv = max(vals) or 1
    bw = (w - pad_l - pad_r) / n_
    out = [f'<svg class="chart" viewBox="0 0 {w} {h}" role="img" preserveAspectRatio="xMidYMid meet">']
    for i, v in enumerate(vals):
        bh = (h - pad_b - pad_t) * (v / maxv)
        x = pad_l + i * bw + bw * 0.14
        cls = accent_class + (" hot" if highlight is not None and i == highlight else "")
        out.append(f'<rect class="{cls}" x="{x:.1f}" y="{h - pad_b - bh:.1f}" '
                   f'width="{bw * 0.72:.1f}" height="{bh:.1f}" rx="1"/>')
    out.append(f'<line x1="{pad_l}" y1="{h - pad_b}" x2="{w - pad_r}" y2="{h - pad_b}" '
               f'class="axis"/>')
    out.append(f'<text x="{pad_l - 8}" y="{pad_t + 6}" text-anchor="end">{n(maxv)}</text>')
    out.append(f'<text x="{pad_l - 8}" y="{h - pad_b}" text-anchor="end">0</text>')
    if labels:
        step = 1 if n_ <= 14 else 2
        for i, lab in enumerate(labels):
            if i % step:
                continue
            out.append(f'<text x="{pad_l + i * bw + bw / 2:.1f}" y="{h - 8}" '
                       f'text-anchor="middle">{lab}</text>')
    out.append("</svg>")
    return "".join(out)


def line_svg(series, w=1000, h=320, ymin=0, ymax=100, labels=True, auto=False):
    """series: [(label, value)]"""
    if not series:
        return ""
    if auto:
        vals = [v for _, v in series]
        ymin = max(0, int(math.floor(min(vals) / 10) * 10) - 10)
        ymax = min(100, int(math.ceil(max(vals) / 10) * 10) + 10)
        if ymax - ymin < 20:
            ymax = min(100, ymin + 20)
    pad_l, pad_b, pad_t, pad_r = 42, 26, 14, 10
    n_ = len(series)
    xs = [pad_l + (w - pad_l - pad_r) * (i / max(1, n_ - 1)) for i in range(n_)]
    ys = [pad_t + (h - pad_t - pad_b) * (1 - (v - ymin) / (ymax - ymin)) for _, v in series]
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
    area = f"{xs[0]:.1f},{h - pad_b:.1f} " + pts + f" {xs[-1]:.1f},{h - pad_b:.1f}"
    out = [f'<svg class="chart" viewBox="0 0 {w} {h}" role="img" preserveAspectRatio="xMidYMid meet">']
    out.append(f'<polygon class="area" points="{area}"/>')
    out.append(f'<polyline class="line" points="{pts}"/>')
    for gy in (ymin, (ymin + ymax) / 2, ymax):
        yy = pad_t + (h - pad_t - pad_b) * (1 - (gy - ymin) / (ymax - ymin))
        out.append(f'<line x1="{pad_l}" y1="{yy:.1f}" x2="{w - pad_r}" y2="{yy:.1f}" class="grid"/>')
        out.append(f'<text x="{pad_l - 8}" y="{yy + 3:.1f}" text-anchor="end">{gy:.0f}</text>')
    if labels:
        step = max(1, n_ // 6)
        for i in range(0, n_, step):
            lab = series[i][0]
            out.append(f'<text x="{xs[i]:.1f}" y="{h - 8}" text-anchor="middle">{lab}</text>')
    out.append("</svg>")
    return "".join(out)


def quake_poster(w=1000, h=900):
    bbox = (120.5, 22.0, 151.5, 47.5)
    proj = S.Proj(bbox, w, h, 12)
    segs = S.clip_lines(OUTLINE["features"], bbox, 0.03)
    coast = "".join(S.path(s, proj) for s in segs)

    cell = 0.5
    bins = defaultdict(int)
    for x in Q:
        lon, lat = x["lon"], x["lat"]
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        bins[(int((lon - bbox[0]) / cell), int((lat - bbox[1]) / cell))] += 1
    maxc = max(bins.values()) or 1
    levels = 6
    buckets = defaultdict(list)
    for (ix, iy), c in bins.items():
        if c < 3:
            continue
        lv = min(levels - 1, int((c / maxc) ** 0.45 * levels))
        x0, y0 = proj.xy(bbox[0] + ix * cell, bbox[1] + iy * cell)
        x1, y1 = proj.xy(bbox[0] + (ix + 1) * cell, bbox[1] + (iy + 1) * cell)
        ww, hh = abs(x1 - x0), abs(y1 - y0)
        buckets[lv].append((x0, y1, ww, hh))
    out = [f'<svg class="poster poster-quake" viewBox="0 0 {w} {h}" role="img" '
           f'aria-label="日本周辺の震源密度">']
    for lv in sorted(buckets):
        op = 0.07 + 0.155 * lv
        d = "".join(f"M{x:.1f} {y:.1f}h{ww:.1f}v{hh:.1f}h{-ww:.1f}z"
                    for x, y, ww, hh in buckets[lv])
        out.append(f'<path d="{d}" fill="var(--accent)" opacity="{op:.2f}"/>')
    out.append(f'<path d="{coast}" fill="none" stroke="var(--ink)" stroke-width="1.1" '
               f'opacity="0.85" stroke-linejoin="round"/>')
    mx, my = proj.xy(142.37, 38.30)
    out.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="7" fill="none" '
               f'stroke="var(--accent)" stroke-width="1.6"/>')
    out.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="2.2" fill="var(--accent)"/>')
    out.append(f'<text x="{mx + 13:.1f}" y="{my + 4:.1f}" class="poster-lab" '
               f'paint-order="stroke" stroke="var(--stage)" stroke-width="4" '
               f'stroke-linejoin="round">2011-03-11 · M9.1</text>')
    out.append("</svg>")
    return "".join(out)


def crime_poster(w=1000, h=513):
    bbox = (138.96, 35.48, 139.97, 35.90)
    proj = S.Proj(bbox, w, h, 14)
    buckets = defaultdict(list)
    for p in POINTS:
        lon, lat = p.get("lng"), p.get("lat")
        if lon is None or lat is None:
            continue
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        t = p.get("t") or 0
        lv = 0 if t <= 2 else (1 if t <= 6 else (2 if t <= 15 else 3))
        x, y = proj.xy(lon, lat)
        buckets[lv].append((x, y))
    widths = [1.5, 2.3, 3.1, 4.0]
    ops = [0.30, 0.42, 0.55, 0.68]
    out = [f'<svg class="poster poster-crime" viewBox="0 0 {w} {h}" role="img" '
           f'aria-label="東京都の町丁別認知件数">']
    for lv in sorted(buckets):
        d = "".join(f"M{x:.0f} {y:.0f}h0" for x, y in buckets[lv])
        out.append(f'<path d="{d}" stroke="var(--accent)" stroke-width="{widths[lv]}" '
                   f'stroke-linecap="round" opacity="{ops[lv]}"/>')
    out.append("</svg>")
    return "".join(out)


def ward_map(ward, w=900, h=640):
    feats = [f for f in CHOME["features"]
             if f["properties"].get("ward") == ward and f.get("geometry")]
    if not feats:
        return ""
    minx = miny = 1e9
    maxx = maxy = -1e9
    from shapely.geometry import shape
    gs = []
    for f in feats:
        try:
            g = shape(f["geometry"])
        except Exception:
            continue
        gs.append((g, f["properties"]))
        x0, y0, x1, y1 = g.bounds
        minx, miny = min(minx, x0), min(miny, y0)
        maxx, maxy = max(maxx, x1), max(maxy, y1)
    if not gs:
        return ""
    pad = (maxx - minx) * 0.03 + 0.002
    bb = (minx - pad, miny - pad, maxx + pad, maxy + pad)
    # match the viewBox to the ward's Mercator aspect so the map fills the frame
    span_x = math.radians(bb[2] - bb[0])
    span_y = S.merc(bb[3]) - S.merc(bb[1])
    aspect = span_x / span_y if span_y else 1.0
    h = max(380, min(820, round(w / aspect)))
    proj = S.Proj(bb, w, h, 10)
    out = [f'<svg class="wardmap" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(ward)}の町丁別犯罪率">']
    for g, pr in gs:
        pop = pr.get("pop") or 0
        t = pr.get("t") or 0
        if pop >= 200:
            rate = t / pop * 1000
            lv = 0 if rate < 2 else (1 if rate < 4 else (2 if rate < 6 else (3 if rate < 10 else 4)))
            op = [0.16, 0.3, 0.45, 0.62, 0.8][lv]
            fill = f'fill="var(--accent)" fill-opacity="{op}"'
        else:
            fill = 'fill="var(--faint)" fill-opacity="0.14"'
        d = S.rings_path(g, proj, 0.0004)
        if d:
            out.append(f'<path d="{d}" {fill} stroke="var(--bg)" stroke-width="0.5"/>')
    out.append("</svg>")
    return "".join(out)


def quake_thumb(w=300, h=140):
    bbox = (128.0, 30.0, 146.0, 43.0)
    proj = S.Proj(bbox, w, h, 4)
    segs = S.clip_lines(OUTLINE["features"], bbox, 0.08)
    d = "".join(S.path(s, proj) for s in segs)
    cell = 0.8
    bins = defaultdict(int)
    for x in Q:
        if x["time"][:4] != "2011":
            continue
        lon, lat = x["lon"], x["lat"]
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        bins[(int((lon - bbox[0]) / cell), int((lat - bbox[1]) / cell))] += 1
    heat = []
    if bins:
        mx = max(bins.values())
        for (ix, iy), c in bins.items():
            x0, y0 = proj.xy(bbox[0] + ix * cell, bbox[1] + iy * cell)
            x1, y1 = proj.xy(bbox[0] + (ix + 1) * cell, bbox[1] + (iy + 1) * cell)
            ww, hh = abs(x1 - x0), abs(y1 - y0)
            op = 0.12 + 0.6 * (c / mx) ** 0.6
            heat.append(f'<rect x="{x0:.1f}" y="{y1:.1f}" width="{ww:.1f}" '
                        f'height="{hh:.1f}" fill="var(--accent)" opacity="{op:.2f}"/>')
    return (f'<svg class="thumb-svg" viewBox="0 0 {w} {h}" role="img" aria-hidden="true">'
            + "".join(heat)
            + f'<path d="{d}" fill="none" stroke="var(--faint)" stroke-width="0.7"/></svg>')


def crime_thumb(w=300, h=140):
    from shapely.geometry import shape
    from shapely.ops import unary_union
    from shapely.validation import make_valid
    gs = [make_valid(shape(f["geometry"])) for f in MUNI_POLY["features"]
          if f.get("geometry") and f["properties"]["area_ja"] == "都区部"]
    if not gs:
        return ""
    u = unary_union(gs)
    proj = S.Proj((139.56, 35.52, 139.94, 35.82), w, h, 4)
    d = S.rings_path(u, proj, 0.002)
    return (f'<svg class="thumb-svg" viewBox="0 0 {w} {h}" role="img" aria-hidden="true">'
            f'<path d="{d}" fill="var(--accent)" fill-opacity="0.16" stroke="var(--accent)" '
            f'stroke-width="1" stroke-opacity="0.5"/></svg>')


def cabinet_thumb(w=300, h=140):
    s = [(ym, MONTH_MEAN[ym]) for ym in ALL_MONTHS]
    pad = 6
    xs = [pad + (w - 2 * pad) * i / (len(s) - 1) for i in range(len(s))]
    ys = [pad + (h - 2 * pad) * (1 - v / 100) for _, v in s]
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
    area = f"{xs[0]:.1f},{h - pad:.1f} " + pts + f" {xs[-1]:.1f},{h - pad:.1f}"
    return (f'<svg class="thumb-svg" viewBox="0 0 {w} {h}" role="img" aria-hidden="true">'
            f'<polygon points="{area}" fill="var(--accent)" opacity="0.12"/>'
            f'<polyline points="{pts}" fill="none" stroke="var(--accent)" stroke-width="1.4"/></svg>')


# ---------------------------------------------------------------- copy
COPY = {
    "nav.weather": ("天気", "天气", "Weather"),
    "nav.quake": ("地震", "地震", "Quakes"),
    "nav.crime": ("犯罪", "犯罪", "Crime"),
    "nav.cabinet": ("内閣", "内阁", "Cabinet"),
    "nav.housing": ("住宅", "住宅", "Housing"),
    "nav.population": ("人口", "人口", "Population"),
    "nav.method": ("方法", "方法", "Method"),
    "ui.theme": ("配色を変える", "切换配色", "Change palette"),
    "ui.lang": ("言語", "语言", "Language"),
    "ui.launch": ("起動する", "启动", "Launch"),
    "ui.launching": ("読み込み中…", "加载中…", "Loading…"),
    "ui.failed": ("読み込み失敗", "加载失败", "Failed to load"),
    "ui.close": ("閉じる", "关闭", "Close"),
    "skip": ("本文へ", "跳到正文", "Skip to content"),
    "crumb.home": ("表紙", "封面", "Cover"),

    "cover.title": (f"日本を、<em>{paint_chars('六つの尺度')}</em>で見る。",
                    f"<em>{paint_chars('六种尺度')}</em>看日本。",
                    f"Japan through <em>{paint_chars('six scales')}</em>."),
    "author.role": ("文・制作", "写作与制作", "Written & built by"),
    "author.bio": (
        "上海出身、東京を拠点にする中国語ライター・AIクリエイター。日本での暮らしや社会を観察し、資料を読めるかたちに編集している。",
        "在东京的上海人，自由 AI 创作者。写日本生活与社会观察，也把资料做成可读的页面。",
        "A Shanghai-born, Chinese-language writer and independent AI creator based in Tokyo, writing about Japanese life and society and turning source material into readable pages.",
    ),
    "author.projects": ("公開プロジェクト", "独立项目", "Independent projects"),
    "author.personal": ("メインサイト", "主站", "Main site"),
    "author.contact": ("連絡先", "联系作者", "Contact"),
    "author.links": ("作者・関連リンク", "作者与联系链接", "Author and contact links"),
    "ui.theme.toDark": ("ダークに切り替え", "切换到深色", "Switch to dark"),
    "ui.theme.toLight": ("ライトに切り替え", "切换到浅色", "Switch to light"),
    "home.c.lede": (
        "数字の意味は、数え方で変わる。出典と集計の前提を、各章と合わせて示す。",
        "数字的意义取决于怎么数。这里说明出处与统计前提，细则见各章。",
        "Numbers change meaning with the counting rule. Sources and assumptions are summarised here; each chapter documents the details.",
    ),
    "home.details": ("出典と計算方法", "出处与计算方法", "Sources and counting rules"),
    "home.definitions": ("計算方法", "计算方法", "Counting rules"),
    "home.definitions.copy": (
        f"地震はM4以上・{len(YEARS)}年分、犯罪率は人口1,000人当たり、支持率は月内全調査の算術平均。住宅は町名ごとの平均㎡単価。人口は2025年国勢調査（原数値）、年齢は不詳を除く。2050年は社人研の中位推計。天気は気象庁の予報値で、観測値ではない。補間や面積での絞り込みはしない。",
        f"地震取 M4 以上、{len(YEARS)} 年；犯罪率按每千人；支持率取月内全部调查的算术平均；住宅按町名计算平均㎡单价；人口为 2025 年国势调查原数值，年龄不含不详；2050 年为社人研中位推算；天气为气象厅预报值，不是观测值。不插值，也不按面积筛选。",
        f"Earthquakes are M4+ over {len(YEARS)} years. Crime is per 1,000 residents; cabinet approval is the arithmetic mean of all polls in a month. Housing is mean price per square metre by town. Population is the 2025 census raw count, age excludes unknown; 2050 is the IPSS medium variant. Weather figures are JMA forecasts, not observations. No interpolation or area filter.",
    ),
    "home.weather.title": ("天気", "天气", "Weather"),
    "home.weather.source": ("気象庁", "气象厅", "JMA"),
    "home.weather.copy": ("47都道府県の今日・明日と7日間の予報。", "47 个都道府县的今天、明天与未来七天预报。", "Today, tomorrow and seven days ahead for all 47 prefectures."),
    "home.quake.title": ("地震", "地震", "Earthquakes"),
    "home.quake.source": ("USGS ComCat", "USGS ComCat", "USGS ComCat"),
    "home.quake.copy": (f"2000年からM4以上、{n(Q_N)}の震源。", f"2000 年至今 M4 以上，共 {n(Q_N)} 个震源。", f"{n(Q_N)} M4+ hypocentres since 2000."),
    "home.crime.title": ("犯罪", "犯罪", "Crime"),
    "home.crime.source": ("警視庁", "警视厅", "Tokyo Metropolitan Police"),
    "home.crime.copy": (f"2025年、東京{len(MUNI)}区市町村・{n(CHOME_COUNT)}町丁。", f"2025 年，东京 {len(MUNI)} 区市町村、{n(CHOME_COUNT)} 町丁。", f"2025; {len(MUNI)} municipalities, {n(CHOME_COUNT)} Tokyo neighbourhoods."),
    "home.cabinet.title": ("内閣", "内阁", "Cabinet"),
    "home.cabinet.source": ("NHK・各社世論調査", "NHK・各社民调", "NHK and media polls"),
    "home.cabinet.copy": (f"{len(CAB['cabinets'])}内閣、{n(len(MONTH_MEAN))}か月、{n(len(POLLS))}の調査。", f"{len(CAB['cabinets'])} 届内阁、{n(len(MONTH_MEAN))} 个月、{n(len(POLLS))} 次调查。", f"{len(CAB['cabinets'])} cabinets, {n(len(MONTH_MEAN))} months, {n(len(POLLS))} polls."),
    "home.housing.title": ("住宅", "住宅", "Housing"),
    "home.housing.source": ("国土交通省 PDL 1.0", "国土交通省 PDL 1.0", "MLIT / PDL 1.0"),
    "home.housing.copy": (f"{HOUSE['basis']}、東京全域の中古マンション等の成約{n(HOUSE_N)}件。23区の{n(HOUSE['totals']['trades'])}件は区・町名の価格を表示。", f"{HOUSE['basis']}，东京全域二手公寓等共 {n(HOUSE_N)} 笔成交；其中 23 区 {n(HOUSE['totals']['trades'])} 笔展示区与町名价格。", f"{n(HOUSE_N)} used-flat transactions across Tokyo, {HOUSE['basis']}; {n(HOUSE['totals']['trades'])} in the 23 wards carry ward and town prices."),
    "home.population.title": ("人口", "人口", "Population"),
    "home.population.source": ("総務省統計局・社人研", "总务省统计局・社人研", "Statistics Bureau / IPSS"),
    "home.population.copy": (f"2025年国勢調査、{POP['meta']['n']:,}市町村。2050年は社人研の推計。", f"2025 年国势调查、{POP['meta']['n']:,} 个市町村；2050 年为社人研推算。", f"2025 census across {POP['meta']['n']:,} municipalities; 2050 is the IPSS projection."),
    "home.compiled": ("出典は各章に記載。本站が一次資料から加工・静的生成。", "各章列出出处。本站根据一次资料加工并静态生成。", "Sources are named in each chapter. Compiled from primary sources and statically generated."),
    "prod.open": ("開く", "打开", "Open"),
    "cover.scale.quake": ("列島 · 27年", "列岛 · 27年", "Archipelago · 27 yrs"),
    "cover.scale.crime": ("東京 · 62区市町村", "东京 · 62区市町村", "Tokyo · 62 wards"),
    "cover.scale.cabinet": ("内閣 · 14", "内阁 · 14", "Cabinets · 14"),
    "cover.scale.housing": ("住宅 · 23区", "住宅 · 23区", "Housing · 23 wards"),
    "card.quake.unit": ("M4+ 震源", "M4+ 震源", "M4+ events"),
    "card.quake.title": ("引いて見る", "拉远看", "Pull back"),
    "card.quake.claim": (f"2011年に{PCT_2011_E}%のエネルギー。",
                         f"2011 年占了 {PCT_2011_E}% 的能量。",
                         f"2011: {PCT_2011_E}% of the energy."),
    "card.crime.unit": ("町丁", "町丁", "Neighbourhoods"),
    "card.crime.title": ("寄って見る", "凑近看", "Zoom in"),
    "card.crime.claim": ("中央値4.4‰。",
                         "中位数 4.4‰。",
                         "Median 4.4‰."),
    "card.cabinet.unit": ("ヶ月", "个月", "Months"),
    "card.cabinet.title": ("通して見る", "拉长看", "Stretch out"),
    "card.cabinet.claim": (f"最大の月変動は{SWING:+.1f}({_ym_ja(SWING_TO)})。",
                           f"最大单月变动 {SWING:+.1f}({_ym_zh(SWING_TO)})。",
                           f"Largest monthly swing {SWING:+.1f} ({_ym_en(SWING_TO)})."),
    "card.housing.unit": ("中古マンション", "二手公寓", "Used flats"),
    "card.housing.title": ("並べて見る", "比着看", "Compare"),
    "card.housing.claim": ("町名ごとのm2単価。",
                           "按町算每平米均价。",
                           "Mean price per m² by town."),
    "card.weather.title": ("仰いで見る", "抬头看", "Look up"),
    "card.weather.topic": ("天気", "天气", "Weather"),
    "card.weather.unit": ("都道府県", "都道府县", "Prefectures"),
    "card.weather.claim": ("七日間を、一枚に。",
                           "七天，一张地图。",
                           "Seven days, one map."),
    "card.population.title": ("数えて見る", "数着看", "Count"),
    "card.population.topic": ("人口", "人口", "Population"),
    "card.population.unit": ("人", "人", "People"),
    "card.population.claim": (
        "増えたのは8.8%だけ。",
        "只有 8.8% 在增长。",
        "Only 8.8% are growing.",
    ),
    "card.population.count": ("1億2297万", "1亿2297万", f"{POP_N['pop'] / 1e6:.1f} million"),
    "card.weather.source": ("気象庁 · 予報", "气象厅 · 预报", "JMA · forecast"),
    "card.quake.source": (f"USGS ComCat · 2000—{Q_END_DOT}", f"USGS ComCat · 2000—{Q_END_DOT}",
                          f"USGS ComCat · 2000—{Q_END_DOT}"),
    "card.crime.source": ("警視庁 · 2025", "警视厅 · 2025", "Tokyo police · 2025"),
    "card.cabinet.source": ("NHK / Nikkei / Kyodo · 1998—2026", "NHK / 日经 / 共同 · 1998—2026",
                            "NHK / Nikkei / Kyodo · 1998—2026"),
    "card.housing.source": ("国土交通省 · 2025Q2—2026Q1", "国土交通省 · 2025Q2—2026Q1",
                            "MLIT · 2025Q2—2026Q1"),
    "card.population.source": ("総務省統計局 · 2025 / 社人研 · 2050", "总务省统计局 · 2025 / 社人研 · 2050",
                               "Statistics Bureau · 2025 / IPSS · 2050"),

    "q.eyebrow": ("02 / 引いて見る", "02 / 拉远看", "02 / Pull back"),
    "q.h1": (f"地震 — <em>{n(Q_N)}</em>の震源", f"地震 — <em>{n(Q_N)}</em>个震源", f"Earthquakes — <em>{n(Q_N)}</em> hypocentres"),
    "q.lede": (f"2000年から{Q_END_JA}まで、M4以上の震源を一点ずつ。年を切ると、同じ海が別の顔になる。",
               f"2000年至{Q_END_JA}，M4以上震源逐点记录。按年切开，同一片海换了面孔。",
               f"Every M4+ hypocentre from 2000 to {Q_END_JA.replace('年', '/').replace('月', '')}, one point at a time. Cut by year, the same sea changes face."),
    "q.stat.count": ("震源数", "震源数", "Hypocentres"),
    "q.stat.strong": ("M6以上", "M6以上", "M6+"),
    "q.stat.max": ("最大", "最大", "Largest"),
    "q.stat.energy": ("2011年のエネルギー", "2011年能量占比", "2011 energy share"),
    "q.beat1.t": ("回数より、エネルギー", "比起次数，更看能量", "Energy, not counts"),
"q.beat1.p": (f"2011年は件数で{PCT_2011_N}%、エネルギーでは{PCT_2011_E}%。同じ年でも、数える尺度を変えると景色が変わる。",
                  f"2011年按件数占{PCT_2011_N}%,按能量占{PCT_2011_E}%。同一年,换一种计量,风景就变了。",
                  f"2011 holds {PCT_2011_N}% of events and {PCT_2011_E}% of energy. Change the measure and the picture changes."),
    "q.beat2.t": ("深さは、色", "深度即颜色", "Depth is colour"),
    "q.beat2.p": ("七段の深さ階調。赤い点ほど浅く、海溝の形が浮かぶ。",
                  "七级深度色阶。越红越浅，海沟的形状浮出来。",
                  "A seven-stop depth ramp. Redder is shallower; the trench surfaces as a shape."),
    "q.beat3.t": ("起動すると、地球儀", "启动后，是地球仪", "Launch the globe"),
    "q.beat3.p": ("静止画の上で「起動」を押すと、WebGLの地球が読み込まれる。回して、拡大して、年を切る。",
                  "在静态图上点「启动」，加载 WebGL 地球。旋转、放大、按年切片。",
                  "Press launch on the still image to load the WebGL globe. Rotate, zoom, slice by year."),
    "q.index.title": ("27年を、一年ずつ", "27年，一年一页", "Twenty-seven years, one by one"),
    "q.index.sub": ("各年の震源数・最大マグニチュード・月別分布・主な地震。",
                    "每年的震源数、最大震级、月度分布与主要地震。",
                    "Counts, largest magnitude, monthly distribution and notable events."),

    "c.eyebrow": ("03 / 寄って見る", "03 / 凑近看", "03 / Zoom in"),
    "c.h1": ("犯罪 — <em>5,234</em>の町丁", "犯罪 — <em>5,234</em>个町丁", "Crime — <em>5,234</em> neighbourhoods"),
    "c.lede": ("2025年の警視庁認知件数。東京都内の町丁を、人口あたりの率で並べる。",
               "2025年警视厅认知件数。把东京都内的町丁按人均率排列。",
               "Tokyo Metropolitan Police recorded incidents for 2025, ranked per capita across neighbourhoods."),
    "c.stat.total": ("認知件数", "认知件数", "Incidents"),
    "c.stat.wards": ("区市町村", "区市町村", "Wards"),
    "c.stat.median": ("中央値", "中位数", "Median"),
    "c.stat.max": ("最大", "最高", "Maximum"),
    "c.beat1.t": ("率で見る", "按率来看", "Read the rate"),
    "c.beat1.p": ("件数は人口に比例する。人口1,000人あたりに直すと、町丁の性格が見える。",
                  "件数随人口走。换算成每千人，町丁的性格才显出来。",
                  "Counts follow population. Per thousand people, neighbourhood character appears."),
    "c.beat2.t": ("小さい分母", "小分母", "Small denominators"),
    "c.beat2.p": ("人口200人未満の町丁は率が暴れる。地図では薄く扱い、表では件数も併記する。",
                  "人口不足200人的町丁，率会失控。地图上淡化处理，表里同时列件数。",
                  "Below 200 residents the rate explodes. Those are dimmed on the map; the table keeps counts alongside."),
    "c.beat3.t": ("起動すると、街区", "启动后，是街区", "Launch the blocks"),
    "c.beat3.p": ("Leafletの地図で、町丁の境界と件数を重ねる。検索も効く。",
                  "用 Leaflet 地图叠加町丁边界与件数，可搜索。",
                  "A Leaflet map with neighbourhood boundaries and counts, searchable."),
    "c.index.title": ("62の区市町村", "62个区市町村", "Sixty-two wards"),
    "c.index.sub": ("人口・件数・率・町丁別の上位。", "人口、件数、率与町丁排行。",
                    "Population, counts, rate and top neighbourhoods."),

    "b.eyebrow": ("04 / 通して見る", "04 / 拉长看", "04 / Stretch out"),
    "b.h1": ("内閣 — <em>331</em>か月", "内阁 — <em>331</em>个月", "Cabinet — <em>331</em> months"),
    "b.lede": ("1998年から2026年まで、月ごとの支持率。内閣をまたいで、一本の線にする。",
               "1998年至2026年，逐月支持率。跨过内阁，连成一条线。",
               "Monthly approval from 1998 to 2026, joined across cabinets into one line."),
    "h.eyebrow": ("05 / 並べて見る", "05 / 比着看", "05 / Compare"),
    "h.h1": ("住宅 — <em>町</em>名の価格", "住宅 — <em>町</em>名价格", "Housing — price by <em>town</em>"),
    "h.lede": ("中古マンションの成約価格、直近4四半期（2025年4月–2026年3月）。町名（地区名）ごとの平均㎡単価で塗る。",
               "二手公寓成交价，最近四个季度（2025年4月–2026年3月）。按町名（地区名）的平均㎡单价上色。",
               "Used-flat closed prices for the latest four quarters (Apr 2025 – Mar 2026), shaded by each town's mean price per m²."),

    "pop.eyebrow": ("06 / 数えて見る", "06 / 数着看", "06 / Count"),
    "pop.h1": (f"人口 — <em>{jp_compact(POP_N['pop'])}</em>人",
               f"人口 — <em>{zh_compact(POP_N['pop'])}</em>人",
               f"Population — <em>{POP_N['pop'] / 1e6:.1f} million</em>"),
    "pop.lede": ("2025年国勢調査。1,719市町村を、等面積の格子と人口加重のツリーで見る。91.2%の市町村が減り、73.4%の人がそこに住む。",
                 "2025年国势调查。把 1,719 个市町村放进等面积方格，再按人口加权成树图。91.2% 的市町村在减少，73.4% 的人住在那里。",
                 "The 2025 census across 1,719 municipalities: equal-area cells first, then a population-weighted treemap. 91.2% of places are shrinking; 73.4% of people live in them."),
    "pop.read.eyebrow": ("読み方", "怎么看", "How to read"),
    "pop.read.title": ("地図ではなく、1,719 の「数」で見る。",
                       "不是地图，是 1,719 个「数」。",
                       "Not a map: 1,719 numbers."),
    "pop.read.lede": ("位置は地理ではなく、都道府県の順。同じ大きさのマスだから、「いくつの市町村が減ったか」が見える。面積で見たいときは「人口の大きさ」に切り替える。",
                      "位置不按地理，而按都道府县顺序。每格同样大，所以能看出「有多少市町村在减少」。想按人口看，就切到「人口的大小」。",
                      "Position follows prefecture order, not geography. Equal-sized cells show how many municipalities shrank; switch to “By population” to see where people live."),
    "pop.read.s1h": ("1マス = 1市町村", "1 格 = 1 个市町村", "One cell = one municipality"),
    "pop.read.s1p": ("1,719 の市町村が、同じ大きさで並ぶ。並びは都道府県順、県内は人口の多い順。上端の細い帯が都道府県の区切り。",
                     "1,719 个市町村按同样大小排列。顺序是都道府县，县内按人口从多到少。顶端的细带是都道府县的分界。",
                     "All 1,719 municipalities are the same size, grouped by prefecture and ordered by population within each. The thin ribbon above marks the prefectures."),
    "pop.read.s2h": ("色 = 2020→2025 の増減", "颜色 = 2020→2025 增减", "Colour = 2020→2025 change"),
    "pop.read.s2p": ("濃いほど大きく減り、明るいほど大きく増える。灰色は横ばい。0% を境に、減っている市町村が 91.2%。",
                     "越深减得越多，越亮增得越多。灰色是持平。以 0% 为界，减少的市町村占 91.2%。",
                     "Darker means a larger fall; brighter means a larger rise. Grey is flat. On the 0% line, 91.2% of municipalities are shrinking."),
    "pop.read.s3h": ("押す = 名前と数字", "点击 = 名称和数字", "Click = name and numbers"),
    "pop.read.s3p": ("マスを押すと市町村名・人口・2050年推計。上の帯を押すと都道府県。検索でも飛べる。例：左上の1格目は札幌市。",
                     "点格子看市町村名、人口、2050 年推算。点顶端的带看都道府县。也可以搜索。例：左上第 1 格是札幌市。",
                     "Click a cell for the name, population and 2050 projection. Click the ribbon for a prefecture, or search. Example: the first cell, top left, is Sapporo."),
    "pop.read.note": ("地図ではない理由：面積の大きい北海道が目立つと、人の多い東京が見えなくなる。ここでは「1市町村 = 1マス」に固定している。",
                      "为什么不是地图：地图上面积大的北海道很显眼，人口多的东京反而看不见。这里固定为「1 市町村 = 1 格」。",
                      "Why not a map: area makes Hokkaido dominate and Tokyo disappear. Here every municipality gets one equal cell."),
    "pop.strip.pop": ("人口", "人口", "Population"),
    "pop.strip.rate": ("2020→2025", "2020→2025", "2020→2025"),
    "pop.strip.munis": ("市町村", "市町村", "Municipalities"),
    "pop.strip.age65": ("65歳以上", "65岁以上", "Age 65+"),
    "pop.strip.hh": ("一般世帯", "一般世带", "Households"),
    "pop.strip.foreign": ("外国人", "外国人", "Foreign residents"),
    "pop.strip.proj": ("2050年", "2050年", "2050"),
    "pop.strip.density": ("人口密度", "人口密度", "Density"),
    "pop.unit.people": ("人", "人", "people"),
    "pop.unit.hh": ("世帯", "世带", "households"),
    "pop.unit.km2": ("人/km²", "人/km²", "people/km²"),

    "pop.pyramid.title": ("年齢構成 — 2025 / 2050", "年龄构成 — 2025 / 2050", "Age structure — 2025 / 2050"),
    "pop.pyramid.lede": ("2025年の実績と、2050年の推計。65歳以上の割合は29.5%から37.1%へ上がり、0–14歳は11.1%から9.9%へ下がる。",
                         "2025 年实测与 2050 年推算。65 岁以上占比从 29.5% 升至 37.1%，0–14 岁从 11.1% 降至 9.9%。",
                         "2025 actual and 2050 projected. The 65+ share rises from 29.5% to 37.1%; the 0–14 share falls from 11.1% to 9.9%."),
    "pop.pyramid.stat65": ("65歳以上", "65岁以上", "Age 65+"),
    "pop.pyramid.stat0": ("0–14歳", "0–14岁", "Age 0–14"),
    "pop.pyramid.statpop": ("総人口", "总人口", "Total population"),
    "pop.pyramid.pop2025": (jp_compact(POP_N['pop']), zh_compact(POP_N['pop']), f"{POP_N['pop'] / 1e6:.1f} million"),
    "pop.pyramid.pop2050": (jp_compact(POP_N['pop2050']), zh_compact(POP_N['pop2050']), f"{POP_N['pop2050'] / 1e6:.1f} million"),
    "pop.pyramid.note": ("2050年は社人研「令和5年推計」の出生中位・死亡中位。年齢不詳を除く構成比。",
                         "2050 年为社人研「令和 5 年推算」出生中位、死亡中位。构成比不含年龄不详。",
                         "2050 uses the IPSS 2023 medium variant. Shares exclude age unknown."),
    "pop.pyramid.legend2025": ("2025", "2025", "2025"),
    "pop.pyramid.legend2050": ("2050", "2050", "2050"),
    "pop.pyramid.male": ("男", "男", "Men"),
    "pop.pyramid.female": ("女", "女", "Women"),

    "pop.table.title": ("47都道府県", "47 个都道府县", "Forty-seven prefectures"),
    "pop.table.lede": ("2025年人口、2020→2025の増減、65歳以上、2050年の推計。人口の多い順。",
                       "2025 年人口、2020→2025 增减、65 岁以上、2050 年推算。按人口降序。",
                       "2025 population, 2020→2025 change, 65+ share and the 2050 projection, ordered by population."),
    "pop.table.th.pref": ("都道府県", "都道府县", "Prefecture"),
    "pop.table.th.pop": ("2025年人口", "2025年人口", "2025 population"),
    "pop.table.th.change": ("2020→2025", "2020→2025", "2020→2025"),
    "pop.table.th.age65": ("65歳以上", "65岁以上", "Age 65+"),
    "pop.table.th.pop2050": ("2050年", "2050年", "2050"),
    "pop.table.th.index": ("2050年指数", "2050年指数", "2050 index"),
    "pop.table.note": ("2050年は社人研の出生中位・死亡中位推計。浜通り地域の13市町村（いわき市・相馬市・南相馬市・広野町・楢葉町・富岡町・川内村・大熊町・双葉町・浪江町・葛尾村・新地町・飯舘村）は個別推計がないため「—」。県の2050年は県全体の推計。",
                       "2050 年为社人研出生中位、死亡中位推算。滨通地区 13 个市町村（いわき市、相馬市、南相馬市、広野町、楢葉町、富岡町、川内村、大熊町、双葉町、浪江町、葛尾村、新地町、飯舘村）没有个别推算，显示「—」。县的 2050 年为全县推算。",
                       "2050 is the IPSS medium variant. The 13 Hamadori municipalities in Fukushima have no individual projection and show “—”; prefecture totals use the prefecture projection."),

    "pop.method.title": ("方法と出典", "方法与出处", "Method and sources"),
    "pop.method.lede": ("数字の意味は、数え方で変わる。人口・年齢・推計の口径をここにまとめる。",
                        "数字的意义取决于怎么数。这里汇总人口、年龄与推算的口径。",
                        "Numbers change meaning with the counting rule. Population, age and projection definitions are collected here."),
    "pop.method.census.h": ("国勢調査", "国势调查", "Census"),
    "pop.method.census.p": ("2025年10月1日現在、総務省統計局「令和7年国勢調査 人口等基本集計」（2026年9月29日公表）の原数値。2020年人口は2025年の市町村境域に組み替えた値。年齢不詳は3,289,734人で、年齢構成比は不詳を除いて算出。",
                            "2025 年 10 月 1 日，总务省统计局《令和 7 年国势调查 人口等基本集计》（2026 年 9 月 29 日公布）原数值。2020 年人口按 2025 年市町村境域重组。年龄不详 3,289,734 人，年龄构成比不含不详。",
                            "1 October 2025, raw counts from the Statistics Bureau’s 2025 Census basic tabulation (published 29 September 2026). The 2020 population is boundary-adjusted to 2025 municipalities. Age unknown is 3,289,734; age shares exclude it."),
    "pop.method.proj.h": ("2050年推計", "2050 年推算", "2050 projection"),
    "pop.method.proj.p": ("国立社会保障・人口問題研究所「日本の地域別将来推計人口（令和5年推計）」（2023年12月22日公表）の出生中位・死亡中位推計。基準は2020年10月1日、2050年まで5年ごと。福島県浜通り地域の13市町村は個別推計がなく「浜通り地域」として一括。特別区部は23区の合計。2023年12月基準と2025年10月の市町村境の差異は、コードが一致する範囲で結合。",
                            "国立社会保障・人口问题研究所《日本地域别将来推算人口（令和 5 年推算）》（2023 年 12 月 22 日公布）出生中位、死亡中位推算。基准为 2020 年 10 月 1 日，每 5 年至 2050 年。福岛县滨通地区 13 个市町村没有个别推算，合并为「滨通地区」。特别区部为 23 区合计。2023 年 12 月基准与 2025 年 10 月市町村境的差异，按代码一致范围合并。",
                            "IPSS Regional Population Projections 2023 (published 22 December 2023), medium fertility and mortality, base 1 October 2020, five-year steps to 2050. The 13 Hamadori municipalities are grouped; the special wards are summed from the 23 wards. Boundaries are joined where codes match."),
    "pop.method.def.h": ("口径", "口径", "Definitions"),
    "pop.method.def.p": ("1,719市町村は、20政令市＋特別区部＋772市＋926町村（国勢調査の集計単位）。「増加」は2020→2025の増減率が0%以上、「減少」は負。人口加重ビューは2025年人口を面積に比例させたツリーマップ。2050年指数は2020年=100。",
                         "1,719 个市町村 = 20 个政令市 + 特别区部 + 772 市 + 926 町村（国势调查汇总单位）。「增加」为 2020→2025 增减率 0% 以上，「减少」为负。人口加权视图是把 2025 年人口作为面积的树图。2050 年指数以 2020 年=100。",
                         "The 1,719 units are 20 designated cities, the special-ward area, 772 cities and 926 towns/villages (census tabulation units). “Growing” means a 2020→2025 rate of 0% or more; “shrinking” means negative. The weighted view is a treemap with area proportional to 2025 population. The 2050 index uses 2020 = 100."),
    "pop.method.src.h": ("出典", "来源", "Sources"),
    "pop.method.src.p": ("総務省統計局「令和7年国勢調査」（e-Stat 第1-1表・第2-7表・第49-1表）、国立社会保障・人口問題研究所「日本の地域別将来推計人口（令和5年推計）」。",
                         "总务省统计局《令和 7 年国势调查》（e-Stat 第 1-1 表、第 2-7 表、第 49-1 表）、国立社会保障・人口问题研究所《日本地域别将来推算人口（令和 5 年推算）》。",
                         "Statistics Bureau, 2025 Census (e-Stat tables 1-1, 2-7 and 49-1); IPSS Regional Population Projections 2023."),
    "pop.method.lic.h": ("ライセンス", "许可", "Licence"),
    "pop.method.lic.p": ("e-Stat は政府標準利用規約（商用可・出典明記）。社人研は出典明記。本站の文と図は CC BY 4.0。",
                         "e-Stat 按政府标准利用规约（可商用、需署名）。社人研需署名。本站文字与图表为 CC BY 4.0。",
                         "e-Stat under the Government Standard Terms (commercial use with attribution). IPSS requires attribution. Text and figures here are CC BY 4.0."),

    "b.beat1.t": ("月に一度の点", "每月一点", "One point a month"),
    "b.beat1.p": ("同じ月に複数の調査があれば、平均する。線は途切れない。",
                  "同月有多项调查就取平均。线不断。",
                  "Several polls in a month are averaged. The line never breaks."),
    "b.beat2.t": ("内閣の切れ目", "内阁的接缝", "Cabinet seams"),
    "b.beat2.p": ("一本の線に、14の内閣が連なる。切れ目は、支持率の跳び。",
                  "一条线串起14届内阁。接缝处，是支持率的跳变。",
                  "One line, fourteen cabinets. The seams are the jumps."),
    "b.beat3.t": ("起動すると、年表", "启动后，是年表", "Launch the timeline"),
    "b.beat3.p": ("内閣を選ぶと、その月だけを拡大する。",
                  "选一届内阁，就放大那一段。",
                  "Pick a cabinet and the chart expands to its months."),
    "b.index.title": ("14の内閣", "14届内阁", "Fourteen cabinets"),
    "b.index.sub": ("在任期間・平均・最高・最低。", "任期、平均、最高、最低。",
                    "Term, mean, high and low."),

    "cab.loading": ("331か月の世論調査データを展開中…", "331个月民调数据载入中…", "Loading 331 months of poll data…"),
    "d.year.months": ("月別の震源数", "月度震源数", "Events by month"),
    "d.year.top": ("主な地震", "主要地震", "Notable events"),
    "d.year.energy": ("エネルギー", "能量", "Energy"),
    "d.year.share": ("年間シェア", "年度占比", "Share of all"),
"d.year.note": (f"USGS ComCat、M4以上、日本周辺。{_day_ja(Q_END)}まで。",
                    f"USGS ComCat,M4 以上,日本周边。{_day_zh(Q_END)}止。",
                    f"USGS ComCat, M4+, Japan region. Through {_day_en(Q_END)}."),
    "d.col.date": ("日付", "日期", "Date"),
    "d.col.place": ("場所", "地点", "Place"),
    "d.col.mag": ("M", "M", "M"),
    "d.col.depth": ("深さ", "深度", "Depth"),

    "d.ward.map": ("町丁別の犯罪率", "町丁犯罪率", "Rate by neighbourhood"),
    "d.ward.top": ("件数の多い町丁", "件数最多的町丁", "Neighbourhoods by count"),
    "d.ward.rank": ("62区市町村中", "62区市町村中", "of 62 wards"),
    "d.ward.r8": ("2026年累計", "2026年累计", "2026 cumulative"),
    "d.ward.note": ("人口200人未満は率を出さず、地図では灰色。件数は令和7年（2025）年計。",
                    "人口不足200人不计率，地图上为灰色。件数为令和7年（2025）全年。",
                    "Rates omitted below 200 residents (grey on map). Counts are full-year 2025."),
    "d.col.name": ("町丁", "町丁", "Neighbourhood"),
    "d.col.count": ("件数", "件数", "Count"),
    "d.col.pop": ("人口", "人口", "Population"),
    "d.col.rate": ("率 ‰", "率 ‰", "Rate ‰"),

    "d.pm.series": ("月次支持率", "月度支持率", "Monthly approval"),
    "d.pm.high": ("高かった月", "最高月份", "Highest months"),
    "d.pm.low": ("低かった月", "最低月份", "Lowest months"),
    "d.pm.term": ("在任", "任期", "Term"),
    "d.pm.mean": ("平均", "平均", "Mean"),
    "d.pm.max": ("最高", "最高", "High"),
    "d.pm.min": ("最低", "最低", "Low"),
    "d.pm.months": ("月数", "月数", "Months"),
    "d.pm.note": ("月内の全調査の算術平均。実測月のみを結ぶ。",
                  "月内全部调查的算术平均，只连实测月。",
                  "Arithmetic mean of all polls in the month; only measured months are joined."),

    "m.h1": ("方法と出典", "方法与出处", "Method and sources"),
    "m.lede": ("数字は、どう数えたかで意味が変わる。ここに口径を全部書く。",
               "数字的意义取决于怎么数。这里把口径全部写下。",
               "Numbers change meaning with the counting rule. Every rule is written here."),
    "m.data.h": ("データ", "数据", "Data"),
    "m.q.h": ("地震", "地震", "Earthquakes"),
    "m.q.p": (f"USGS ANSS Comprehensive Catalog（ComCat）から、2000年1月1日—{Q_END_DAY_JA}、日本周辺（東経120–150度、北緯20–50度）、M4.0以上の震源{n(Q_N)}点。",
              f"取自 USGS ANSS Comprehensive Catalog（ComCat），2000年1月1日—{Q_END_DAY_JA}，日本周边（东经120–150度、北纬20–50度），M4.0以上震源{n(Q_N)}点。",
              f"USGS ANSS Comprehensive Catalog (ComCat), 1 Jan 2000 – {Q_END_DAY_JA}, Japan region (120–150°E, 20–50°N), M4.0+, {n(Q_N)} hypocentres."),
    "m.c.h": ("犯罪", "犯罪", "Crime"),
    "m.c.p": ("警視庁「区市町村の町丁別、罪種別及び手口別認知件数」令和7年（2025）年計、および令和8年月次累計。人口は住民基本台帳（令和8年1月1日）。東京都内5,234町丁、62区市町村。",
              "警视厅《区市町村町丁别、罪种别及手口别认知件数》令和7年（2025）全年及令和8年月度累计。人口取自住民基本台帐（令和8年1月1日）。东京都内5,234个町丁、62个区市町村。",
              "Tokyo Metropolitan Police, incidents by neighbourhood and offence type, full-year 2025 plus 2026 monthly cumulative. Population from the Basic Resident Register (1 Jan 2026). 5,234 neighbourhoods, 62 wards."),
    "m.b.h": ("内閣", "内阁", "Cabinet"),
    "m.b.p": ("NHK放送文化研究所の月例政治意識調査（2000–2017）、NHK選挙WEB（2018–2026）、日経・朝日・時事・読売・JNN・共同の各社世論調査。646点、331か月、14内閣。",
              "NHK放送文化研究所月度政治意识调查（2000–2017）、NHK选举WEB（2018–2026），以及日经、朝日、时事、读卖、JNN、共同各社舆论调查。646点、331个月、14届内阁。",
              "NHK Broadcasting Culture Research Institute monthly surveys (2000–2017), NHK election web (2018–2026), plus Nikkei, Asahi, Jiji, Yomiuri, JNN and Kyodo polls. 646 polls, 331 months, 14 cabinets."),
    "m.cal.h": ("口径", "口径", "Definitions"),
    "m.cal.q": ("エネルギーは log₁₀E = 1.5M + 4.8（ジュール）。年の合計は単純和。",
                "能量按 log₁₀E = 1.5M + 4.8（焦耳）。年度合计为简单相加。",
                "Energy from log₁₀E = 1.5M + 4.8 (joules). Year totals are simple sums."),
    "m.cal.c": ("犯罪率は 件数 ÷ 人口 × 1,000。人口200人未満の町丁は率を出さず、地図では薄く表示する。",
                "犯罪率 = 件数 ÷ 人口 × 1,000。人口不足200人的町丁不计率，地图上淡化显示。",
                "Rate = incidents ÷ population × 1,000. Neighbourhoods under 200 residents get no rate and are dimmed on the map."),
    "m.cal.b": ("支持率は月内の全調査の算術平均。同じ月に複数の調査があれば全部入れる。線は実測月だけを結び、補間しない。",
                "支持率为月内全部调查的算术平均。同月多项调查全部计入。线只连实测月，不做插值。",
                "Approval is the arithmetic mean of every poll in the month. All polls count. The line joins measured months only; no interpolation."),
    "m.err.h": ("既知の誤差", "已知误差", "Known error"),
    "m.err.1": ("NHKの2008年・2009年は、年度表の「9月」と「9月(緊)」を取り違え、10–12月が一つ右へずれていた。8行を削除し、10行を補って修正した（v8.3）。",
                "NHK 2008、2009年度的「9月」与「9月(緊)」两列被错取，10–12月整体右移一格。已删8行、补10行修正（v8.3）。",
                "For NHK 2008 and 2009 the annual table's September and September (emergency) columns were swapped, shifting October–December one column right. Fixed by dropping 8 rows and adding 10 (v8.3)."),
    "m.err.2": ("日経の同月二値は重複ではなく、「定例」と「緊急」の別調査。両方を残した。",
                "日经同月两个数值不是重复，而是「定例」与「紧急」两场不同调查。两条都保留。",
                "The two Nikkei values in one month are separate regular and emergency surveys, not duplicates. Both are kept."),
    "m.err.3": ("2011年3月のNHKは原表が「-」。時事の18.9のみ。",
                "2011年3月NHK原表为「-」，仅有时事18.9。",
                "NHK has no value for March 2011 in the source table; only Jiji (18.9)."),
    "m.err.4": ("単一ソースの月が{{B}}月中{{S}}。", "{{B}}个月中有{{S}}个只有单一来源。",
                "{{S}} of {{B}} cabinet-months rest on a single source."),
    "m.err.5": ("地震カタログの検知能力は時代で変わる。2000年代初頭は小さい地震の取りこぼしがある。",
                "地震目录的检测能力随年代变化。2000年代初期会漏掉小震。",
                "Catalogue completeness varies by era; small events are under-recorded in the early 2000s."),
    "m.err.6": ("犯罪の「g」列は表示に使っていない。K=2000の縮小（経験ベイズ）は行っていない。",
                "犯罪的「g」列未用于显示，也未做 K=2000 的经验贝叶斯收缩。",
                "The crime `g` field is unused, and no empirical-Bayes shrinkage (K=2000) is applied."),
    "m.upd.h": ("更新", "更新", "Updates"),
    "m.upd.p": ("HTMLはビルド時に事前生成。データを更新したら再ビルドする。",
                "HTML 在构建时预生成。数据更新后重新构建。",
                "HTML is pre-rendered at build time. Update the data, then rebuild."),
    "m.dl.h": ("ダウンロード", "下载", "Download"),
    "m.dl.p": ("同じ数値をCSVで。", "同样的数值，CSV 格式。", "The same numbers as CSV."),
    "m.lic.h": ("ライセンス", "许可", "Licence"),
    "m.lic.p": ("データは各出典のライセンスに従う。本站の文と図は CC BY 4.0。",
                "数据遵循各来源的许可。本站文字与图表为 CC BY 4.0。",
                "Data follows each source's licence. Text and figures here are CC BY 4.0."),
    "m.src.h": ("出典", "来源", "Sources"),

    "nf.code": ("404", "404", "404"),
    "nf.h1": ("この頁は、ない。", "这一页不存在。", "This page is not here."),
    "nf.p": ("URLが変わったか、まだ作っていない頁。六つの章から辿り直せる。",
             "网址变了，或这一页还没做。可以从六个章节重新找。",
             "The URL changed, or the page was never built. Start again from the six chapters."),
    "nf.home": ("表紙へ戻る", "回到封面", "Back to the cover"),

    # 章节舞台图注、天气页的 noscript 兜底表、页面结构标签。{n} 之类由调用点 format 填。
    "nav.label": ("章", "章节", "Chapters"),
    "crumb.nav": ("パンくず", "面包屑", "Breadcrumb"),
    "q.caption": ("M4+ · {n}の震源 · 2000–{end} · USGS ComCat",
                  "M4+ · {n} 个震源 · 2000–{end} · USGS ComCat",
                  "M4+ · {n} hypocentres · 2000–{end} · USGS ComCat"),
    "c.caption": ("1点=1町丁 · 本土{n}町丁(島嶼部は枠外)· 2025 · 警視庁",
                  "1 点 = 1 个町丁 · 本土 {n} 个町丁(岛屿部分不在框内)· 2025 · 警视厅",
                  "1 dot = 1 neighbourhood · {n} on the mainland (islands fall outside the frame) · 2025 · Tokyo police"),
    "h.caption": ("中古マンション · 成約{n}件 · {basis}(直近4四半期)· 国土交通省",
                  "二手公寓 · 成交 {n} 笔 · {basis}(最近四个季度)· 国土交通省",
                  "Used flats · {n} transactions · {basis} (latest four quarters) · MLIT"),
    "pop.caption": ("{n}市町村 · 2025年国勢調査 · 総務省統計局",
                    "{n} 个市町村 · 2025 年国势调查 · 总务省统计局",
                    "{n} municipalities · 2025 Census · Statistics Bureau"),
    "w.noscript.h1": ("日本の天気", "日本的天气", "Japan’s weather"),
    "w.noscript.p": ("気象庁の予報を47都道府県ごとに整列しました。インタラクティブな地図はJavaScriptで動作します。",
                     "把气象厅的预报按 47 个都道府县排列。交互式地图需要 JavaScript。",
                     "JMA forecasts arranged across all 47 prefectures. The interactive map needs JavaScript."),
    "w.th.pref": ("都道府県", "都道府県", "Prefecture"),
    "w.th.summary": ("天気", "天气", "Forecast"),
    "w.th.temp": ("最高 / 最低", "最高 / 最低", "High / Low"),
    "w.th.pop": ("降水確率", "降水概率", "Precip. probability"),

    # 天気章の静的正文(2026-11-04:他四章と同じ四段式にする。それまで章で唯一 h2 が 0 だった)
    "w.doc.eyebrow": ("この章の読み方", "本章怎么看", "How to read this chapter"),
    "w.doc.what.h": ("この章で見るもの", "这一章看的是什么", "What this chapter shows"),
    "w.doc.what.p1": (
        f"気象庁の予報を、{len(WEATHER_REGIONS)}都道府県それぞれの代表予報区について一枚の地図にまとめた章。"
        f"予報の対象は今日・明日と、{len(WEATHER_REGIONS[0]['week'])}日分の週間予報。"
        f"地図の色は天気、週間の並びは日付ごとの天気・最高/最低気温・降水確率・信頼度である。",
        f"把气象厅的预报按 {len(WEATHER_REGIONS)} 个都道府县各自的代表预报区收进一张地图。"
        f"预报对象是今天、明天,以及 {len(WEATHER_REGIONS[0]['week'])} 天的周预报。"
        f"地图的颜色是天气,周预报一行是每天的天气、最高/最低气温、降水概率与信度。",
        f"A chapter that lays the JMA forecast out on one map, one representative forecast area per "
        f"prefecture: {len(WEATHER_REGIONS)} of them. It covers today, tomorrow and a "
        f"{len(WEATHER_REGIONS[0]['week'])}-day outlook. Colour is the weather; the week strip carries each "
        f"day’s weather, high and low, chance of precipitation and reliability."),
    "w.doc.what.p2": (
        "値はビルド時に静的に取り込まれている。ページを開いたときに気象庁へ問い合わせることはないので、"
        "表示されているのは「その時点で取得した予報」であり、いま現在の予報ではない。",
        "数值在构建时就静态取入。打开页面时不会去问气象厅,所以看到的是「当时取到的那份预报」,不是此刻的最新预报。",
        "The numbers are baked in at build time. Opening the page never calls the JMA, so what you see is the "
        "forecast as fetched then — not the forecast as of right now."),
    "w.doc.cal.h": ("データの口径", "数据口径", "Data and definitions"),
    "w.doc.cal.p1": (
        "出典は気象庁の予報データ(府県予報区の短期予報・週間予報と、地方の概況)。観測値ではなく予報値である。"
        "気温は最高と最低、降水確率は%、週間予報の信頼度は気象庁の区分(A/B/C)をそのまま持ってきている。",
        "来源是气象厅的预报数据(府县预报区的短期预报、周预报,以及地方概况)。是预报值,不是观测值。"
        "气温取最高与最低,降水概率用 %,周预报的信度直接沿用气象厅的 A/B/C 分级。",
        "Source: JMA forecast products — short-range and weekly forecasts for the prefectural forecast areas, "
        "plus the regional overview. These are forecasts, not observations. Temperature is the daily high and low, "
        "precipitation chance is in per cent, and the weekly reliability figure is the JMA’s own A/B/C grade."),
    "w.doc.cal.p2": (
        "気象庁は地域ごとに発表時刻が異なるため、同じページに載る発表時刻も地域ごとに違う。"
        "また取得元のプロダクト(05:00–06:00 JST)には今朝の最低気温が含まれないことが多く、"
        "その場合は「—」になる。これは公式データの欠落であって、取得の失敗ではない。",
        "气象厅各地的发布时间不同,所以同一页面上各地的发布时间也各不相同。另外,取数用的那批产品(05:00–06:00 JST)"
        "往往不含当天早晨的最低气温,那时会显示「—」。这是官方数据的缺口,不是抓取失败。",
        "The JMA issues each area at its own time, so the issue time shown for each prefecture differs. And the "
        "product this site fetches (05:00–06:00 JST) usually carries no morning minimum, which is why that cell "
        "reads “—”. That is a gap in the official product, not a failed fetch."),
    "w.doc.cal.p3": (
        "取り込みは vps-jp の日次ジョブ(06:10 JST)が行い、47都道府県分の予報と概況を取得して静的ファイルに固め、"
        "そのままビルド・配信する。取得に失敗した日は前日の内容が残る(取得時刻の欄が動いていないことで分かる)。",
        "取数由 vps-jp 的日更任务(06:10 JST)完成:抓取 47 个都道府县的预报与概况,固化成静态文件,再构建与发布。"
        "抓取失败的日子会留着前一天的内容(看「抓取」时刻没动就能发现)。",
        "A daily job on the VPS (06:10 JST) fetches all 47 prefectures plus the regional overviews, freezes them "
        "into a static file, and the site is built and published from that. If a run fails, the previous day’s "
        "contents stay in place — visible as a retrieval timestamp that has not moved."),
    "w.doc.fact.src": ("出典", "来源", "Source"),
    "w.doc.fact.period": ("週間予報の期間", "周预报期间", "Outlook window"),
    "w.doc.fact.regions": ("都道府県", "都道府县", "Prefectures"),
    "w.doc.fact.issued": ("気象庁の発表", "气象厅发布", "Issued by JMA"),
    "w.doc.fact.gen": ("取得", "抓取", "Retrieved"),
    "w.doc.fact.report": ("予報の基準日", "预报基准日", "Forecast day"),
    # 快照过期时才出现的这句。日付はビルド時に差し込む({d}=発表日、{t}=今日)。
    "w.stale": (
        "このお知らせは {d} の発表分です。本日({t})の分はまだ取得できていないため、「今日」はこの日を指します。",
        "本站的气象厅预报是 {d} 发布的那一份;今天({t})的预报尚未取到,所以页面里的「今天」指的是 {d}。",
        "This page carries JMA’s {d} issue. Today’s ({t}) forecast has not been retrieved yet, so “Today” "
        "here means {d}."),
    "w.doc.read.h": ("どう読むか", "怎么读", "How to read it"),
    "w.doc.read.p1": (
        "第一に、予報と観測を混ぜない。この章の数字はすべて予報で、実際に観測された気温や降水量ではない。"
        "第二に、地点は1都道府県に1つ。同じ県でも日本海側と太平洋側で予報が分かれる場合は、"
        "代表予報区の値だけが地図に載る。",
        "第一,别把预报和观测混在一起。本章的数字全是预报,不是实测的气温或降水量。第二,每个都道府县只有一个点;"
        "同一个县里日本海侧与太平洋侧的预报不同时,地图上只放代表预报区的值。",
        "First, keep forecast and observation apart: every number here is a forecast, not a measured temperature "
        "or rainfall. Second, there is one point per prefecture — when a prefecture is split between Sea of Japan "
        "and Pacific sides, only the representative area’s numbers reach the map."),
    "w.doc.read.p2": (
        "第三に、週間予報の信頼度を読む。A が最も高く、B、C の順に下がり、欄が空の日は信頼度が付いていない。"
        "第四に、地図の色は天気の種類であって、良し悪しではない。晴れが良い日という意味はない。",
        "第三,读周预报的信度:A 最高,B、C 依次下降,空白的日子表示气象厅没有给出信度。"
        "第四,地图的颜色只是天气的种类,不是好坏——晴天并不意味着好日子。",
        "Third, read the weekly reliability: A is the strongest, then B, then C, and a blank cell means the JMA "
        "issued no grade. Fourth, colour is a kind of weather, not a verdict — a sunny day is not a good day."),
    "w.doc.faq.h": ("よくある質問", "常见问题", "Frequently asked questions"),
    "w.doc.faq.q1": ("観測値ですか。", "这是观测值吗?", "Are these observations?"),
    "w.doc.faq.a1": (
        "予報値です。気象庁の短期予報と週間予報をそのまま取り込んでいます。実際の気温や降水量は、"
        "気象庁の観測データを見てください。",
        "是预报值。直接取用气象厅的短期预报与周预报。想知道实测的气温与降水量,请去看气象厅的观测数据。",
        "They are forecasts: the JMA’s short-range and weekly products, taken as published. For measured "
        "temperatures and rainfall, read the JMA’s observation data instead."),
    "w.doc.faq.q2": ("いつ更新されますか。", "多久更新一次?", "How often is it updated?"),
    "w.doc.faq.a2": (
        f"毎日 06:10 JST に vps-jp のジョブが気象庁のデータを取り直し、ビルドして配信します。"
        f"このページの取得時刻は {WEATHER_DOC['generatedAt']} です。",
        f"每天 06:10 JST,vps-jp 上的任务重新抓取气象厅数据,再构建与发布。本页的抓取时刻是 {WEATHER_DOC['generatedAt']}。",
        f"A job on the VPS refetches the JMA data at 06:10 JST every day, then builds and publishes. This page "
        f"was retrieved at {WEATHER_DOC['generatedAt']}."),
    "w.doc.faq.q3": ("なぜ都道府県に1地点なのですか。", "为什么每个都道府县只有一个点?", "Why one point per prefecture?"),
    "w.doc.faq.a3": (
        "気象庁の予報は府県予報区ごとに発表されるためです。ここでは各都道府県の代表予報区を1つ選んで載せ、"
        "同じ都道府県の中で分かれる予報は地図には出していません。",
        "因为气象厅的预报是按府县预报区发布的。这里给每个都道府县挑一个代表预报区放上地图,"
        "同一个都道府县内部有分歧的预报不在图上展开。",
        "Because the JMA publishes per prefectural forecast area. This page picks one representative area per "
        "prefecture; where a prefecture splits into several forecast areas, the map does not show them separately."),


    # ---- 四章の静的正文(ja が原文、zh-Hans と en はそれぞれの言葉で書き起こす)----
    # 見出しは各章 4 本(h2): 是什么 / 数据口径 / 怎么读 / 常见问题。
    # 数値はすべて build.py が読み込んだデータから f-string で差し込む(直書きしない)。
    "q.doc.eyebrow": ("この章の読み方", "本章怎么看", "How to read this chapter"),
    "q.doc.what.h": ("この章で見るもの", "这一章看的是什么", "What this chapter shows"),
    "q.doc.what.p1": (
        f"ページを開くと、まず静止ポスターが出る。日本列島の周りに置かれた点のひとつひとつが、"
        f"2000年1月1日から{_day_ja(Q_END)}までに記録されたM4.0以上の震源で、総数は{n(Q_N)}点。"
        f"ポスターは{_day_ja(Q_MAX_DAY)}のM{Q_MAX}を一点だけ強調している。代表の一点であって、"
        f"平均でも予測でもない。「起動する」を押すとWebGLの地球儀が読み込まれ、回す・拡大する・年を切る、"
        f"という操作ができるようになる。",
        f"打开页面,先看到的是一张静态海报。日本列岛周围的每一个点,都是 2000 年 1 月 1 日至 {_day_zh(Q_END)} "
        f"记录的 M4.0 以上震源,共 {n(Q_N)} 个。海报只强调一个点:{_day_zh(Q_MAX_DAY)} 的 M{Q_MAX}。"
        f"它是代表性的一点,不是平均值,也不是预测。点「启动」会加载 WebGL 地球仪,可以旋转、放大、按年切片。",
        f"Open the page and the first thing you see is a still poster. Every dot around the archipelago is one "
        f"hypocentre recorded between 1 January 2000 and {_day_en(Q_END)}, magnitude 4.0 or above: {n(Q_N)} of them. "
        f"The poster singles out one point, the M{Q_MAX} of {_day_en(Q_MAX_DAY)}. That is one representative event, "
        f"not an average and not a forecast. Press launch and a WebGL globe loads: rotate it, zoom in, cut it by year."),
    "q.doc.what.p2": (
        "この章が見せるのは、地震の回数ではなく、どこで・どの深さで・どれだけのエネルギーが解放されたか。"
        "点の位置は震源の水平位置、色は深さを表す。太平洋側の帯状の密集は「よく揺れる場所」であって、"
        "危険度の順位表ではない。同じデータを年ごとに切り出すと、同じ海が毎年違う顔を見せる。",
        "这一章呈现的不是地震的次数,而是能量在哪里、在什么深度、释放了多少。点的位置是震源的水平位置,"
        "颜色代表深度。太平洋一侧的带状密集处表示「记录到的地震多」,不是危险度排行榜。"
        "把同一份数据按年切开,同一片海每年换个表情。",
        "What the chapter measures is not how many earthquakes happened but where, at what depth, and how much "
        "energy was released. Position is the horizontal location of the hypocentre; colour is depth. A dense band "
        "off the Pacific coast means a place that is recorded often, not a ranking of danger. Cut the same data by "
        "year and the same sea changes face."),
    "q.doc.cal.h": ("データの口径", "数据口径", "Data and definitions"),
    "q.doc.cal.p1": (
        f"出典はUSGSのANSS Comprehensive Catalog(ComCat)。期間は2000年1月1日から{_day_ja(Q_END)}(UTC)、"
        f"範囲は東経120–150度・北緯20–50度、規模はM4.0以上。残した項目は位置・深さ・マグニチュード・時刻・"
        f"地名だけで、件数は{n(Q_N)}点。カタログ全体の最大は{_day_ja(Q_MAX_DAY)}のM{Q_MAX}、"
        f"M6以上は{n(Q_M6_N)}点。",
        f"来源是 USGS 的 ANSS Comprehensive Catalog(ComCat)。期间为 2000 年 1 月 1 日至 {_day_zh(Q_END)}(UTC),"
        f"范围为东经 120–150 度、北纬 20–50 度,规模为 M4.0 以上。只保留位置、深度、震级、时刻、地名五项,"
        f"共 {n(Q_N)} 个。全目录最大为 {_day_zh(Q_MAX_DAY)} 的 M{Q_MAX},M6 以上 {n(Q_M6_N)} 个。",
        f"The source is the USGS ANSS Comprehensive Catalog (ComCat). The window is 1 January 2000 to "
        f"{_day_en(Q_END)} (UTC), the region is 120–150°E and 20–50°N, and the threshold is magnitude 4.0. Only "
        f"position, depth, magnitude, time and place name are kept: {n(Q_N)} events. The largest event in the "
        f"catalogue is M{Q_MAX} on {_day_en(Q_MAX_DAY)}, and {n(Q_M6_N)} hypocentres reach M6 or above."),
    "q.doc.cal.p2": (
        f"エネルギーは log10E = 1.5M + 4.8(ジュール)で換算し、年の合計は単純和とした。2011年は件数で"
        f"{n(len(QY['2011']))}点・全体の{PCT_2011_N}%だが、エネルギーでは{PCT_2011_E}%を占める。",
        f"能量按 log10E = 1.5M + 4.8(焦耳)换算,年度合计为简单相加。2011 年按件数是 {n(len(QY['2011']))} 个、"
        f"占全体的 {PCT_2011_N}%,但按能量占到 {PCT_2011_E}%。",
        f"Energy follows log10E = 1.5M + 4.8 (joules), and yearly totals are simple sums. In 2011 the count is "
        f"{n(len(QY['2011']))} events, {PCT_2011_N}% of the whole, but the energy share is {PCT_2011_E}%."),
    "q.doc.cal.p3": (
        "偏りが二つある。ひとつは、カタログの検知能力が時代で変わること。2000年代初頭は"
        "小さな地震の取りこぼしがある。もうひとつは、年次モードが1970年まで遡れること。"
        "本文と統計枠の値はすべて2000年以降のカタログに揃えてあり、1970年代と2000年代を同じ密度で"
        "比べることはできない。",
        "有两处偏差需要知道。一是目录的检测能力随年代变化,2000 年代初会漏掉小震。二是年次模式可回溯到 1970 年"
        "(20 度为一块,共 9 块瓦片)。正文与统计框的数值统一以 2000 年以后的目录为准,1970 年代与 2000 年代"
        "不能按同样的密度比较。",
        "Two biases are worth knowing. Catalogue completeness changes with the era: small events are "
        "under-recorded in the early 2000s. And the yearly mode reaches back to 1970 (nine 20-degree tiles). "
        "Every figure in this text and in the stat rail comes from the 2000-onward catalogue, so the 1970s and "
        "the 2000s cannot be compared at the same density."),
    "q.doc.fact.src": ("出典", "来源", "Source"),
    "q.doc.fact.period": ("期間", "期间", "Period"),
    "q.doc.fact.n": ("件数", "件数", "Events"),
    "q.doc.fact.max": ("最大", "最大", "Largest"),
    "q.doc.fact.m6": ("M6以上", "M6 以上", "M6+"),
    "q.doc.fact.share": ("2011年のエネルギー", "2011 年能量占比", "2011 energy share"),
    "q.doc.read.h": ("どう読むか", "怎么读", "How to read it"),
    "q.doc.read.p1": (
        "第一に、回数とエネルギーを混ぜない。震源数の多い年が、放出エネルギーの大きい年とは限らない。"
        "章の主題は後者である。第二に、色は深さ。七段の階調で、赤い点ほど浅い。多さでも、深刻さでもない。",
        "第一,不要把次数和能量混在一起。震源数多的年份,未必是释放能量大的年份。本章的主题是后者。"
        "第二,颜色是深度。七级色阶,越红的点越浅。既不表示多,也不表示严重。",
        "First, do not mix counts with energy. A year with many hypocentres is not necessarily a year with much "
        "released energy, and energy is the subject here. Second, colour is depth: a seven-stop ramp, redder "
        "means shallower. It is not volume and not severity."),
    "q.doc.read.p2": (
        "第三に、点は1970年ではなく2000年から始まる。年次モードの収録範囲と、本文の統計の範囲は違う。"
        "第四に「著名」モードは予報ではない。既知の地震を読み物として再演するモードで、外部リンクは"
        "百科事典の解説である。",
        "第三,点从 2000 年开始,不是 1970 年。年次模式的收录范围与正文统计的范围不同。"
        "第四,「著名」模式不是预报,而是把已知地震当作读物重演,外部链接是百科全书的解说。",
        "Third, the dots start in 2000, not 1970: the yearly mode covers a wider window than the statistics here. "
        "Fourth, the notable-events mode is not a forecast. It replays known earthquakes as reading, and its "
        "outbound links go to encyclopaedia articles."),
    "q.doc.read.p3": (
        f"数字の出所はひとつ。{n(Q_N)}、{n(len(QY['2011']))}、{PCT_2011_N}%、{PCT_2011_E}%、{n(Q_M6_N)}、"
        f"M{Q_MAX}は、いずれも同じカタログ(quakes.json)から数え直せる。タイルから作り直す手順は "
        f"tools/rebuild_quake_catalog.py にある。",
        f"数字只有一个出处。{n(Q_N)}、{n(len(QY['2011']))}、{PCT_2011_N}%、{PCT_2011_E}%、{n(Q_M6_N)}、"
        f"M{Q_MAX},都可以从同一份目录(quakes.json)重算。从瓦片重建的步骤写在 tools/rebuild_quake_catalog.py。",
        f"There is one source for every number. {n(Q_N)}, {n(len(QY['2011']))}, {PCT_2011_N}%, {PCT_2011_E}%, "
        f"{n(Q_M6_N)} and M{Q_MAX} can all be recounted from the same catalogue (quakes.json); the rebuild from "
        f"tiles is documented in tools/rebuild_quake_catalog.py."),
    "q.doc.faq.h": ("よくある質問", "常见问题", "Frequently asked questions"),
    "q.doc.faq.q1": ("気象庁の地震情報と同じものか。", "和气象厅的地震信息是同一回事吗?", "Is this the same as the JMA earthquake reports?"),
    "q.doc.faq.a1": (
        "別系統である。気象庁は国内で検知した地震の実況と情報発表、この章はUSGS ComCatを日本周辺の矩形から"
        "切り出したもの。検知網も規模の決め方も発表の時点も違い、震源数の一致は期待できない。",
        "不是同一系统。气象厅发布的是国内检测到的地震实况与信息,本章是把 USGS ComCat 从日本周边的矩形中切出来。"
        "检测网、震级判定与发布时间都不同,震源数不会一致。",
        "No. The JMA reports earthquakes detected in Japan; this chapter cuts the USGS ComCat to a rectangle around "
        "Japan. Detection networks, magnitude scales and publication times differ, so the counts need not agree."),
    "q.doc.faq.q2": ("M4未満の地震はなぜ載らないのか。", "为什么看不到 M4 以下的地震?", "Why are earthquakes below M4 missing?"),
    "q.doc.faq.a2": (
        "抽出条件がM4.0以上のため。図は「記録されたM4以上の分布」であり、「地震の全体分布」ではない。",
        "因为抽取条件是 M4.0 以上。图上是「记录到的 M4 以上分布」,不是「地震的全部分布」。",
        "Because the extraction threshold is magnitude 4.0. The map shows the recorded M4+ distribution, not the "
        "whole distribution of earthquakes."),
    "q.doc.faq.q3": ("2011年が目立つのは件数が多いからか。", "2011 年显眼是因为件数多吗?", "Does 2011 stand out because of its event count?"),
    "q.doc.faq.a3": (
        f"件数は全体の{PCT_2011_N}%でしかない。エネルギーでは{PCT_2011_E}%を占める。件数とエネルギーは別の尺度で、"
        f"この章が強調するのは後者である。",
        f"按件数只占全体的 {PCT_2011_N}%,按能量占到 {PCT_2011_E}%。件数与能量是两把不同的尺子,本章强调后者。",
        f"The count is only {PCT_2011_N}% of the total; the energy share is {PCT_2011_E}%. Counts and energy are "
        f"different rulers, and this chapter leans on the second."),

    "c.doc.eyebrow": ("この章の読み方", "本章怎么看", "How to read this chapter"),
    "c.doc.what.h": ("この章で見るもの", "这一章看的是什么", "What this chapter shows"),
    "c.doc.what.p1": (
        f"2025年の刑法犯認知件数を、東京都内{n(CHOME_COUNT)}の町丁と{len(MUNI)}の区市町村について、"
        f"人口あたりの率で並べた地図。1点が1町丁にあたる。開いた直後のポスターは東京本土の矩形"
        f"(東経138.9–139.96度、北緯35.46–35.92度)だけを写しており、この枠に入るのは{n(CHOME_MAINLAND)}町丁。"
        f"島嶼部は枠の外にある。",
        f"把 2025 年刑法犯认知件数,按东京都内 {n(CHOME_COUNT)} 个町丁与 {len(MUNI)} 个区市町村,换算成人均率排列的地图。"
        f"1 个点 = 1 个町丁。打开时的海报只画东京本土的矩形(东经 138.9–139.96 度、北纬 35.46–35.92 度),"
        f"落在这个框里的是 {n(CHOME_MAINLAND)} 个町丁,岛屿部分在框外。",
        f"A map of recorded criminal incidents for 2025, ranked per capita across {n(CHOME_COUNT)} Tokyo "
        f"neighbourhoods and {len(MUNI)} wards. One dot is one neighbourhood. The opening poster covers only the "
        f"mainland rectangle (138.9–139.96°E, 35.46–35.92°N): {n(CHOME_MAINLAND)} neighbourhoods fall inside it, and "
        f"the islands lie outside the frame."),
    "c.doc.what.p2": (
        "「起動する」を押すとLeafletの地図が読み込まれ、町丁の境界と件数を重ね、罪種別に切り替え、"
        "区市町村別の表も引ける。この章が見せるのは「どこで何件起きたか」という分布であり、"
        "地域の安全性の評価ではない。",
        "点「启动」会加载 Leaflet 地图,叠加町丁边界与件数,可切换罪种,也能拉出区市町村表。"
        "本章呈现的是「哪里发生了多少件」的分布,不是对地区安全性的评价。",
        "Press launch and a Leaflet map loads with neighbourhood boundaries and counts, a switch between offence "
        "types, and a ward table. What it shows is a distribution of where incidents were recorded; it is not an "
        "assessment of how safe a neighbourhood is."),
    "c.doc.cal.h": ("データの口径", "数据口径", "Data and definitions"),
    "c.doc.cal.p1": (
        "出典は警視庁「区市町村の町丁別、罪種別及び手口別認知件数」の令和7年(2025)年計と令和8年の月次累計。"
        "人口は東京都の住民基本台帳(令和8年1月1日)による。率は件数÷人口×1,000で、単位は人口1,000人あたり。",
        "来源是警视厅《区市町村町丁别、罪种别及手口别认知件数》令和 7 年(2025)全年与令和 8 年月度累计。"
        "人口取自东京都住民基本台帐(令和 8 年 1 月 1 日)。率 = 件数 ÷ 人口 × 1,000,单位是每千人。",
        "Sources: Tokyo Metropolitan Police, incidents by neighbourhood and offence type, full-year 2025 plus the "
        "2026 monthly cumulative; population from the Basic Resident Register (1 January 2026). The rate is "
        "incidents ÷ population × 1,000, per 1,000 residents."),
    "c.doc.cal.p2": (
        f"令和7年は年計、令和8年は年初からの累計で、期間が違う。二つを直接比べることはできない。"
        f"データの総数は{n(CHOME_COUNT)}町丁・{len(MUNI)}区市町村、町丁人口の合計は{n(CHOME_POP)}人である。",
        f"令和 7 年是全年,令和 8 年是年初以来的累计,期间不同,不能直接比较。数据总量为 {n(CHOME_COUNT)} 个町丁、"
        f"{len(MUNI)} 个区市町村,町丁人口合计 {n(CHOME_POP)} 人。",
        f"Full-year 2025 and the 2026 year-to-date cumulative cover different periods and cannot be compared "
        f"directly. The dataset holds {n(CHOME_COUNT)} neighbourhoods in {len(MUNI)} wards, whose resident "
        f"populations sum to {n(CHOME_POP)}."),
    "c.doc.cal.p3": (
        f"率を出さない町丁がある。人口200人未満では1件で率が大きく振れるため、率を定義せず、地図では薄く扱い、"
        f"表では件数のみを併記する({n(CHOME_NO_RATE)}町丁)。人口が欠損している{n(CHOME_POP_MISSING)}町丁"
        f"(「以下不詳」「中央防波堤」など)は分档の対象外である。",
        f"有些町丁不给出率。人口不足 200 人时,1 件就能让率大幅跳动,因此不定义率,地图上淡化处理,"
        f"表里只列件数({n(CHOME_NO_RATE)} 个町丁)。人口缺失的 {n(CHOME_POP_MISSING)} 个町丁"
        f"(「以下不详」「中央防波堤」等)不参与分档。",
        f"Some neighbourhoods get no rate. Below 200 residents a single incident swings the figure wildly, so no "
        f"rate is defined, the dot is dimmed on the map and the table keeps the count alongside "
        f"({n(CHOME_NO_RATE)} neighbourhoods). The {n(CHOME_POP_MISSING)} neighbourhoods with missing population "
        f"(“below unknown”, the Central Breakwater) are excluded from the ranking bands."),
    "c.doc.cal.p4": (
        "この図に含まれないものも口径のうち。声かけ・前兆事案は町丁別の集計がないため含まず、交通事故も"
        "含まない。認知件数は届出を経た件数で、発案件数とは一致しない。",
        "图上没有的东西也属于口径。声かけ・前兆事案没有町丁别汇总,因此不含;交通事故也不含。"
        "认知件数是经过报案的件数,与发案件数并不一致。",
        "What the map leaves out is part of the definition too. Street-approach and precursor incidents have no "
        "neighbourhood tabulation and are excluded; traffic accidents are excluded. Recorded incidents are "
        "reported incidents and do not equal offences committed."),
    "c.doc.fact.src": ("出典", "来源", "Source"),
    "c.doc.fact.period": ("期間", "期间", "Period"),
    "c.doc.fact.chome": ("町丁", "町丁", "Neighbourhoods"),
    "c.doc.fact.munis": ("区市町村", "区市町村", "Wards"),
    "c.doc.fact.pop": ("町丁人口の合計", "町丁人口合计", "Neighbourhood population"),
    "c.doc.fact.rate": ("率の定義", "率定义", "Rate"),
    "c.doc.fact.norate": ("率を出さない町丁", "不计率的町丁", "No rate"),
    "c.doc.read.h": ("どう読むか", "怎么读", "How to read it"),
    "c.doc.read.p1": (
        "第一に、件数と率を分ける。件数は人口に比例する。人口1,000人あたりに直すと、町丁の性格が見える。"
        "第二に、小さい分母を信じない。人口200人未満の町丁には率がない。灰色は「率なし」であって、"
        "「安全」でも「危険」でもない。",
        "第一,把件数和率分开。件数随人口走,换算成每千人,町丁的性格才显出来。第二,不要相信小分母。"
        "人口不足 200 人的町丁没有率。灰色是「无率」,既不是「安全」,也不是「危险」。",
        "First, separate counts from rates. Counts follow population; per 1,000 residents, the character of a "
        "neighbourhood appears. Second, do not trust a small denominator. Neighbourhoods under 200 residents have "
        "no rate at all, and grey means “no rate”, not safe and not dangerous."),
    "c.doc.read.p2": (
        "第三に、昼間人口の歪みを念頭に置く。駅前や繁華街は分母が常住人口なので率が押し上げられる。"
        "居住の安全性を示す数字ではない。第四に、総数は窃盗も粗暴犯も混ぜた数である。罪種別に分けてから読む。",
        "第三,要记住白天人口的偏移。车站前与繁华街的分母是常住人口,率因此被抬高,这不是居住安全性的数字。"
        "第四,总数把盗窃与粗暴犯混在一起,先按罪种拆开再读。",
        "Third, keep daytime population in mind. Around stations and entertainment districts the denominator is "
        "the resident population, so the rate is pushed up; it is not a measure of residential safety. Fourth, the "
        "total mixes theft with violent offences — split it by offence type before reading."),
    "c.doc.read.p3": (
        "地図に無いことは、ゼロではない。本土の枠に入らない島嶼部と、人口が欠損した町丁は、地図に現れない"
        "だけで統計には存在する。表と地図を突き合わせて読む。",
        "地图上没有,不等于零。不落进本土框的岛屿部分,以及人口缺失的町丁,只是不出现在地图上,统计里是存在的。"
        "把表和地图对着读。",
        "Absent from the map is not zero. The islands outside the mainland frame and the neighbourhoods with "
        "missing population exist in the statistics; they simply do not appear on the map. Read the table against "
        "the map."),
    "c.doc.faq.h": ("よくある質問", "常见问题", "Frequently asked questions"),
    "c.doc.faq.q1": ("認知件数と発案件数は同じか。", "认知件数和发案件数是同一回事吗?", "Are recorded incidents the same as offences committed?"),
    "c.doc.faq.a1": (
        "違う。認知件数は届出を経た件数であり、届出率の影響を受ける。実際の被害規模とは一致しない。",
        "不是。认知件数是经过报案的件数,受报案率影响,与实际被害规模并不一致。",
        "No. Recorded incidents have gone through a report, so they carry the reporting rate with them. They do "
        "not equal the real volume of harm."),
    "c.doc.faq.q2": ("人口200人未満の町丁はなぜ灰色なのか。", "为什么人口不足 200 人的町丁是灰色?", "Why are neighbourhoods under 200 residents grey?"),
    "c.doc.faq.a2": (
        "小さい分母では1件で率が跳ね、順位が安定しない。率を出さず、件数のみ併記する。",
        "分母太小,1 件就能让率跳起来,排名不稳定。因此不计率,只列件数。",
        "With so small a denominator one incident makes the rate jump and the ranking becomes unstable. No rate "
        "is given and only the count is listed."),
    "c.doc.faq.q3": ("2025年と2026年の数字は比べられるか。", "2025 年和 2026 年的数字能比吗?", "Can the 2025 and 2026 figures be compared?"),
    "c.doc.faq.a3": (
        "2025年は年計、2026年は月次累計で期間が違う。直接比較せず、年初来の推移として読む。",
        "2025 年是全年,2026 年是月度累计,期间不同。不要直接比较,按年初以来的推移来读。",
        "2025 is a full year; 2026 is a monthly cumulative. The periods differ, so read it as a year-to-date "
        "trend rather than a comparison."),
    "c.doc.faq.q4": ("この地図は「安全な町丁」を示すのか。", "这张地图能说明哪个町丁安全吗?", "Does this map show which neighbourhoods are safe?"),
    "c.doc.faq.a4": (
        "示さない。分档は都内の相対で、安全性の評価・保証ではない。単独の判断材料にしないでほしい。",
        "不能。分档是都内的相对位置,既不是安全性评价,也不是保证。请勿作为单一判断依据。",
        "It does not. The bands are relative to the rest of Tokyo; they are neither an assessment nor a guarantee "
        "of safety. Do not use them on their own to decide anything."),
    "b.doc.eyebrow": ("この章の読み方", "本章怎么看", "How to read this chapter"),
    "b.doc.what.h": ("この章で見るもの", "这一章看的是什么", "What this chapter shows"),
    "b.doc.what.p1": (
        f"{_ym_ja(CAB_FIRST['date'][:7])}から{_ym_ja(CAB_LAST['date'][:7])}までの内閣支持率を、月ごとに"
        f"一点へまとめた線。点の総数は{n(len(POLLS))}、月の数は{n(len(MONTH_MEAN))}、内閣は{len(CAB['cabinets'])}。"
        f"同じ月に複数の調査があれば算術平均して一つの点にする。",
        f"把 {_ym_zh(CAB_FIRST['date'][:7])} 到 {_ym_zh(CAB_LAST['date'][:7])} 的内阁支持率按月归成一点,连成一条线。"
        f"点共 {n(len(POLLS))} 个,月 {n(len(MONTH_MEAN))} 个,内阁 {len(CAB['cabinets'])} 届。同月有多项调查就取算术平均,合成一点。",
        f"A single line of cabinet approval from {_ym_en(CAB_FIRST['date'][:7])} to {_ym_en(CAB_LAST['date'][:7])}, "
        f"collapsed to one point per month: {n(len(POLLS))} polls, {n(len(MONTH_MEAN))} months, "
        f"{len(CAB['cabinets'])} cabinets. Several polls in a month become their arithmetic mean, one point."),
    "b.doc.what.p2": (
        "起動すると、線ではなく年表になる。内閣を選ぶとその月だけを拡大し、六段のズーム(3か月から全期間まで)で"
        "見られる。この章が見せるのは世論の水準であり、内閣の評価そのものではない。",
        "启动后不是线,而是年表。选中一届内阁就放大那一段,可在六档缩放(3 个月到全期间)之间切换。"
        "本章呈现的是舆论的水平,不是对内阁的评价本身。",
        "Press launch and the line becomes a timeline. Pick a cabinet and the chart expands to its months, with six "
        "zoom steps from three months to the whole span. What it shows is the level of public opinion, not a "
        "verdict on a cabinet."),
    "b.doc.cal.h": ("データの口径", "数据口径", "Data and definitions"),
    "b.doc.cal.p1": (
        f"出典はNHK放送文化研究所の月例政治意識調査(2000–2017)、NHK選挙WEB(2018–2026)、および日経・朝日・時事・"
        f"読売・JNN・共同の各社世論調査。{n(len(POLLS))}点の内訳はNHK{n(POLL_SRC['NHK世論調査'])}、"
        f"日経{n(POLL_SRC['日経世論調査'])}、朝日{n(POLL_SRC['朝日新聞世論調査'])}、時事{n(POLL_SRC['時事世論調査'])}、"
        f"読売{n(POLL_SRC['読売新聞世論調査'])}、JNN{n(POLL_SRC['JNN世論調査'])}、共同{n(POLL_SRC['共同通信世論調査'])}。",
        f"来源是 NHK 放送文化研究所的月度政治意识调查(2000–2017)、NHK 选举 WEB(2018–2026),以及日经、朝日、时事、"
        f"读卖、JNN、共同各社舆论调查。{n(len(POLLS))} 个点的构成:NHK {n(POLL_SRC['NHK世論調査'])}、"
        f"日经 {n(POLL_SRC['日経世論調査'])}、朝日 {n(POLL_SRC['朝日新聞世論調査'])}、时事 {n(POLL_SRC['時事世論調査'])}、"
        f"读卖 {n(POLL_SRC['読売新聞世論調査'])}、JNN {n(POLL_SRC['JNN世論調査'])}、共同 {n(POLL_SRC['共同通信世論調査'])}。",
        f"Sources: NHK Broadcasting Culture Research Institute monthly surveys (2000–2017), NHK election web "
        f"(2018–2026), plus polls by Nikkei, Asahi, Jiji, Yomiuri, JNN and Kyodo. The {n(len(POLLS))} points break "
        f"down as NHK {n(POLL_SRC['NHK世論調査'])}, Nikkei {n(POLL_SRC['日経世論調査'])}, "
        f"Asahi {n(POLL_SRC['朝日新聞世論調査'])}, Jiji {n(POLL_SRC['時事世論調査'])}, "
        f"Yomiuri {n(POLL_SRC['読売新聞世論調査'])}, JNN {n(POLL_SRC['JNN世論調査'])} and "
        f"Kyodo {n(POLL_SRC['共同通信世論調査'])}."),
    "b.doc.cal.p2": (
        f"月次値は月内の全調査の算術平均。実測のある月だけを結び、補間しない。したがって「調査{n(len(POLLS))}」と"
        f"「月{n(len(MONTH_MEAN))}」は別の数を数えている。系列の先頭は{_ym_ja(CAB_FIRST['date'][:7])}の"
        f"{CAB_FIRST['source'].replace('世論調査', '')}調査({CAB_FIRST['pm']}・{CAB_FIRST['value']})、"
        f"末尾は{_ym_ja(CAB_LAST['date'][:7])}の{CAB_LAST['source'].replace('世論調査', '')}調査"
        f"({CAB_LAST['pm']}・{CAB_LAST['value']})。最大の単月変動は{SWING:+.1f}で、"
        f"{_ym_ja(SWING_FROM)}から{_ym_ja(SWING_TO)}への上げ幅(内閣交代の月も、そのまま1か月の変動として数える)。",
        f"月度值取月内全部调查的算术平均。只连有实测的月份,不做插值。所以「{n(len(POLLS))} 次调查」和"
        f"「{n(len(MONTH_MEAN))} 个月」数的是两个东西。系列开头是 {_ym_zh(CAB_FIRST['date'][:7])} 的"
        f"{CAB_FIRST['source'].replace('世論調査', '')}调查({CAB_FIRST['pm']}、{CAB_FIRST['value']}),"
        f"末尾是 {_ym_zh(CAB_LAST['date'][:7])} 的{CAB_LAST['source'].replace('世論調査', '')}调查"
        f"({CAB_LAST['pm']}、{CAB_LAST['value']})。最大单月变动是 {SWING:+.1f},"
        f"从 {_ym_zh(SWING_FROM)} 到 {_ym_zh(SWING_TO)} 的涨幅(内阁交替的那个月,也照样算作一个月的变动)。",
        f"Each monthly value is the arithmetic mean of every poll that month. Only measured months are joined; "
        f"nothing is interpolated. That is why “{n(len(POLLS))} polls” and “{n(len(MONTH_MEAN))} months” count "
        f"different things. The series starts with a {CAB_FIRST['source']} in {_ym_en(CAB_FIRST['date'][:7])} "
        f"({CAB_FIRST['pm']}, {CAB_FIRST['value']}) and ends with a {CAB_LAST['source']} in "
        f"{_ym_en(CAB_LAST['date'][:7])} ({CAB_LAST['pm']}, {CAB_LAST['value']}). The largest single-month swing is "
        f"{SWING:+.1f}, the rise from {_ym_en(SWING_FROM)} to {_ym_en(SWING_TO)} (a month in which the cabinet "
        f"changed still counts as one month's move)."),
    "b.doc.cal.p3": (
        f"欠けている月もある。高市内閣は継続中で、内閣の終了日は暫定値。共同通信の2026年7月・8月は値のみが"
        f"報じられ、原表を確認できないため収録していない。内閣と月の組{n(N_BUCKETS)}のうち{n(N_SINGLE)}は、"
        f"単一の媒体の調査しかない。",
        f"也有缺月。高市内阁仍在任,内阁结束日是暂定值。共同社 2026 年 7 月、8 月只有数值见报,原表无法确认,"
        f"因此未收录。内阁与月的组合共 {n(N_BUCKETS)} 个,其中 {n(N_SINGLE)} 个只有单一媒体的调查。",
        f"Some months are missing. The Takaichi cabinet is still in office, so its end date is provisional. Kyodo’s "
        f"July and August 2026 figures were reported as numbers only, with no source table to verify, so they are "
        f"not included. Of the {n(N_BUCKETS)} cabinet-month cells, {n(N_SINGLE)} rest on a single outlet."),
    "b.doc.cal.p4": (
        "既知の誤差も明記しておく。NHKの2008年・2009年は年度表の「9月」と「9月(緊)」を取り違え、10–12月が"
        "一列ずれていた(8行を削除し10行を補って修正)。日経の同じ月の二つの値は重複ではなく、定例調査と"
        "緊急調査という別々の調査である。",
        "已知误差也写明。NHK 2008、2009 年度的「9月」与「9月(緊)」两列被错取,10–12 月整体右移一格(已删 8 行、"
        "补 10 行修正)。日经同月的两个数值不是重复,而是定例调查与紧急调查两场不同的调查。",
        "Known errors are stated too. For NHK 2008 and 2009 the annual table’s September and September "
        "(emergency) columns were swapped, shifting October–December one column right (fixed by dropping 8 rows "
        "and adding 10). The two Nikkei values in one month are not duplicates: they are separate regular and "
        "emergency surveys."),
    "b.doc.fact.src": ("出典", "来源", "Source"),
    "b.doc.fact.polls": ("調査", "调查", "Polls"),
    "b.doc.fact.months": ("月", "月", "Months"),
    "b.doc.fact.cabinets": ("内閣", "内阁", "Cabinets"),
    "b.doc.fact.single": ("単一ソースの組", "单一来源组合", "Single-source cells"),
    "b.doc.fact.swing": ("最大月変動", "最大单月变动", "Largest monthly swing"),
    "b.doc.read.h": ("どう読むか", "怎么读", "How to read it"),
    "b.doc.read.p1": (
        "第一に、線ではなく点の並びとして読む。線は実測月だけを結ぶ。平らな区間は「支持率が動かなかった」のでは"
        "なく、「その月に測っていない」かもしれない。第二に、内閣の切れ目を見る。一本の線に"
        f"{len(CAB['cabinets'])}の内閣が連なり、切れ目は支持率の跳びとして現れる。平均でならすと、この跳びが消える。",
        f"第一,把它当成点的排列,而不是线。线只连实测月。平坦的一段,未必是「支持率没动」,也可能是「那个月没测」。"
        f"第二,看内阁的接缝。一条线串起 {len(CAB['cabinets'])} 届内阁,接缝表现为支持率的跳变。一取平均,跳变就没了。",
        f"First, read it as a row of points rather than a line. The line joins measured months only, so a flat "
        f"stretch may mean “nothing was measured that month”, not “approval held steady”. Second, look at the "
        f"seams: {len(CAB['cabinets'])} cabinets run along one line, and each seam shows up as a jump. Smooth it "
        f"away and the jump disappears."),
    "b.doc.read.p2": (
        "第三に、水準と変化量を混ぜない。「高かった月」と「大きく動いた月」は別の問いである。第四に、短い"
        "在任期間の平均は安定しない。月数を並べて読む。数字の主語は内閣であり、個人の評価として読ませない。",
        "第三,不要把水平和变化量混为一谈。「最高的月份」与「变动最大的月份」是两个不同的问题。第四,任期短的均值不稳定,"
        "要连着月数一起读。数字的主语是内阁,不要当成某个人的评价来读。",
        "Third, do not mix level with change. “The highest month” and “the largest move” answer different "
        "questions. Fourth, the mean over a short term in office is unstable; read it next to the month count. "
        "The subject of the number is a cabinet, never a person."),
    "b.doc.faq.h": ("よくある質問", "常见问题", "Frequently asked questions"),
    "b.doc.faq.q1": (
        f"{len(MONTH_MEAN)}か月と{n(len(POLLS))}調査の違いは何か。",
        f"{len(MONTH_MEAN)} 个月和 {n(len(POLLS))} 次调查有什么区别?",
        f"What is the difference between {n(len(MONTH_MEAN))} months and {n(len(POLLS))} polls?"),
    "b.doc.faq.a1": (
        "月数と回数の違い。同じ月の複数の調査をすべて入れて平均するので、調査の数が月の数になる。",
        "一个是月数,一个是次数。同月的多项调查全部计入再取平均,所以调查数被压成月数。",
        "Months versus poll count. Every poll in a month is averaged together, so the polls collapse into months."),
    "b.doc.faq.q2": ("支持率が動かない月は、安定していたのか。", "支持率不动的月份,是稳定吗?", "If approval does not move for a month, was it stable?"),
    "b.doc.faq.a2": (
        "わからない。その月に調査がなかった可能性がある。線は実測月だけを結び、補間しない。",
        "不一定。可能那个月根本没有调查。线只连实测月,不做插值。",
        "Unknown. There may have been no poll that month. The line joins measured months only and never "
        "interpolates."),
    "b.doc.faq.q3": ("直近は何月までか。", "最新到几月?", "How recent is the data?"),
    "b.doc.faq.a3": (
        f"月次平均は{_ym_ja(CAB_LAST['date'][:7])}まで。高市内閣は継続中なので、内閣の終了日は暫定値である。",
        f"月度平均到 {_ym_zh(CAB_LAST['date'][:7])}。高市内阁仍在任,内阁结束日是暂定值。",
        f"Monthly means run to {_ym_en(CAB_LAST['date'][:7])}. The Takaichi cabinet is still in office, so its end "
        f"date is provisional."),
    "b.doc.faq.q4": ("媒体ごとの偏りはないのか。", "不同媒体会有偏差吗?", "Do the outlets bias the line?"),
    "b.doc.faq.a4": (
        "この章は媒体を横断した月次平均であり、単一媒体の系列ではない。個別の値は媒体とURLつきで残っている。",
        "本章是跨媒体的月度平均,不是某一家媒体的系列。每个具体数值都带着媒体与 URL。",
        "The line is a cross-outlet monthly mean, not one outlet’s series. Each individual value keeps its outlet "
        "and URL."),

    "h.doc.eyebrow": ("この章の読み方", "本章怎么看", "How to read this chapter"),
    "h.doc.what.h": ("この章で見るもの", "这一章看的是什么", "What this chapter shows"),
    "h.doc.what.p1": (
        f"中古マンション等の成約価格を、町名(地区名)ごとにまとめた地図。対象は{HOUSE['basis']}"
        f"(2025年4月–2026年3月)の直近4四半期。東京都全域の成約は{n(HOUSE_N)}件、このうち23区の"
        f"{n(HOUSE['totals']['trades'])}件が区と町名の価格表示に使われている。町名は{n(HOUSE_TOWNS_ALL)}あり、"
        f"実際に成約があるのは{n(HOUSE_TOWNS)}町名。残る{n(HOUSE_TOWNS_ZERO)}町名は成約0件で、価格は空欄になる。",
        f"把二手公寓等的成交价按町名(地区名)汇总的地图。对象是 {HOUSE['basis']}(2025 年 4 月–2026 年 3 月)的最近四个季度。"
        f"东京全域成交 {n(HOUSE_N)} 笔,其中 23 区的 {n(HOUSE['totals']['trades'])} 笔用于区与町名的价格显示。"
        f"町名共 {n(HOUSE_TOWNS_ALL)} 个,实际有成交的是 {n(HOUSE_TOWNS)} 个,其余 {n(HOUSE_TOWNS_ZERO)} 个成交 0 笔,价格留空。",
        f"A map of used-flat closed prices by town. The window is the latest four quarters, {HOUSE['basis']} "
        f"(April 2025 – March 2026). Tokyo-wide there are {n(HOUSE_N)} transactions, of which "
        f"{n(HOUSE['totals']['trades'])} in the 23 wards carry ward and town prices. There are "
        f"{n(HOUSE_TOWNS_ALL)} towns; {n(HOUSE_TOWNS)} of them have at least one deal, and the other "
        f"{n(HOUSE_TOWNS_ZERO)} are blank."),
    "h.doc.what.p2": (
        "同じページに三つの塗り分けがある。開いた直後のポスターは区の中央値で塗り、起動後の町名モードは"
        "町の平均m2単価、区モードは町の平均を成約件数で加重平均した値を使う。どの基準で塗っているかを"
        "確かめてから読む。",
        "同一页上有三种上色口径。打开时的海报按区的中央值上色,启动后的町名模式用町的平均 m2 单价,"
        "区模式用町平均按成交笔数加权平均的值。先确认用的是哪一种口径,再往下读。",
        "The same page shades three different quantities. The opening poster shades the ward median; the town mode "
        "after launch uses each town’s mean price per m2; the ward mode uses the town means weighted by "
        "transaction count. Check which one you are looking at before reading."),
    "h.doc.cal.h": ("データの口径", "数据口径", "Data and definitions"),
    "h.doc.cal.p1": (
        "出典は国土交通省「不動産情報ライブラリ」の不動産取引価格情報・成約価格情報(中古マンション等・"
        "成約価格情報)。ライセンスはPDL 1.0。",
        "来源是国土交通省「不动产信息图书馆」的不动产交易价格信息・成交价格信息(二手公寓等・成交价格信息)。"
        "许可为 PDL 1.0。",
        "Source: the MLIT Real Estate Information Library — transaction price information and closed price "
        "information (used flats, closed prices). Licensed under PDL 1.0."),
    "h.doc.cal.p2": (
        f"対象期間は{HOUSE['basis']}(2025年4月–2026年3月)の4四半期。国の公表は約1四半期遅れるため、"
        f"それより新しい四半期はまだ出ていない。データの生成日は{_day_ja(HOUSE['generated'])}。",
        f"对象期间是 {HOUSE['basis']}(2025 年 4 月–2026 年 3 月)的四个季度。国家公布约滞后一个季度,"
        f"更新的季度尚未公布。数据生成日为 {_day_zh(HOUSE['generated'])}。",
        f"The window is four quarters, {HOUSE['basis']} (April 2025 – March 2026). Publication lags by about one "
        f"quarter, so newer quarters do not exist yet. The data was generated on "
        f"{_day_en(HOUSE['generated'])}."),
    "h.doc.cal.p3": (
        "町名の値は、成約1件ごとの「総額÷面積」を単純平均したm2単価。面積での絞り込みもしない。区の値は"
        "中央値で、平均も併記される。区の帯の統計は面積60–80m2に絞った層である。同じページに複数の"
        "統計量が並ぶ。",
        "町名的数值,是每笔成交「总额 ÷ 面积」的简单平均 m2 单价,也不按面积筛选。区的数值是中央值,同时并列平均值。"
        "区的区间统计是面积 60–80m2 的筛选层。同一页上并排放着多个统计量。",
        "A town’s figure is the simple mean of price ÷ area over individual deals, with no area filter. A ward’s "
        "figure is the median, with the mean shown alongside. The ward band statistics come from a layer filtered "
        "to 60–80 m². Several different statistics sit on one page."),
    "h.doc.cal.p4": (
        "位置の粒度は「市区町村+地区名」までで、丁目と座標は含まれない。地図の町名の形は、町丁境界を"
        "町名単位にまとめて作ったもので、国土交通省のデータから作った境界ではない。集計・地図化・本文は"
        "当サイトが加工して作成したもので、国が作成・公表したものではない。",
        "位置精度只到「市区町村 + 地区名」,不含丁目与坐标。地图上町名的形状,是把町丁边界按町名合并而成的,"
        "不是从国土交通省数据生成的边界。汇总、地图化与正文由本站加工制作,并非国家制作公布。",
        "Location granularity stops at municipality plus district name; block numbers and coordinates are not "
        "included. The town shapes on the map were merged from neighbourhood boundaries, not taken from MLIT "
        "geometry. The aggregation, the map and this text are compiled by this site; they are not produced or "
        "published by the government."),
    "h.doc.fact.src": ("出典", "来源", "Source"),
    "h.doc.fact.period": ("期間", "期间", "Period"),
    "h.doc.fact.n": ("成約(都全域)", "成交(都全域)", "Deals (Tokyo-wide)"),
    "h.doc.fact.trades": ("成約(23区)", "成交(23 区)", "Deals (23 wards)"),
    "h.doc.fact.towns": ("町名", "町名", "Towns"),
    "h.doc.fact.gen": ("生成日", "生成日", "Generated"),
    "h.doc.read.h": ("どう読むか", "怎么读", "How to read it"),
    "h.doc.read.p1": (
        "第一に、平均と中央値を分ける。分布は右に裾を引くので、都心ほど平均が高く出る。区のカードには"
        "両方が並ぶ。第二に、単価と総額を分ける。単価は面積を吸収して町同士を比べられる。総額は「その町で"
        "成約した物件がいくらだったか」で、戸数と面積の構成に依存する。",
        "第一,把平均值和中央值分开。分布向右拖尾,越靠都心平均值越高。区的卡片上两者并排。"
        "第二,把单价和总额分开。单价吸收了面积,町与町之间可比;总额是「那个町成交的房子是多少钱」,"
        "取决于户数与面积构成。",
        "First, separate mean from median. The distribution has a long right tail, so central wards read higher on "
        "the mean; the ward card shows both. Second, separate price per m2 from total price. Per-m2 absorbs area "
        "and makes towns comparable; the total is what the deals in that town actually cost, and it depends on the "
        "mix of unit sizes."),
    "h.doc.read.p2": (
        f"第三に、件数を同時に読む。成約1件の町と成約300件の町を同じ重みで読ませない。第四に、4四半期を"
        f"ひとつの窓として読む。単四半期は振れが大きい。高いことは、将来の値上がり率や投資価値を意味しない。",
        f"第三,连着件数一起读。不要用一个成约 1 笔的町和一个成约 300 笔的町做等权比较。第四,把四个季度当成一个窗口来读,"
        f"单个季度波动很大。价格高,并不意味着未来涨幅或投资价值。",
        f"Third, always read the count with it: never weigh a town with one deal the same as a town with three "
        f"hundred. Fourth, read the four quarters as one window; a single quarter is noisy. And a high price is "
        f"not a future rate of return."),
    "h.doc.faq.h": ("よくある質問", "常见问题", "Frequently asked questions"),
    "h.doc.faq.q1": ("対象期間はいつか。", "对象期间是什么时候?", "What period does this cover?"),
    "h.doc.faq.a1": (
        f"{HOUSE['basis']}(2025年4月–2026年3月)の直近4四半期。公表は約1四半期遅れるため、"
        f"それより新しい四半期はまだ出ていない。",
        f"{HOUSE['basis']}(2025 年 4 月–2026 年 3 月)的最近四个季度。公布约滞后一个季度,更新的季度还没有。",
        f"The latest four quarters, {HOUSE['basis']} (April 2025 – March 2026). Publication lags by about a "
        f"quarter, so nothing newer exists yet."),
    "h.doc.faq.q2": ("平均はどう計算しているのか。", "平均值是怎么算的?", "How is the average calculated?"),
    "h.doc.faq.a2": (
        "町名は成約1件ごとのm2単価の単純平均で、面積の絞り込みはない。区は中央値と60–80m2帯の統計。"
        "同じページに複数の口径があることを注記しておく。",
        "町名是每笔成交 m2 单价的简单平均,不按面积筛选。区是中央值与 60–80m2 区间的统计。请注意同一页上有多种口径。",
        "For a town it is the simple mean of the per-m2 price of each deal, with no area filter. For a ward it is "
        "the median plus the 60–80 m² band. Note that several definitions share one page."),
    "h.doc.faq.q3": ("なぜ町名までしか分かれないのか。", "为什么只分到町名?", "Why does it stop at town level?"),
    "h.doc.faq.a3": (
        "公式データの位置が「市区町村+地区名」までで、丁目や座標がないため。地図の町名の形は、町丁境界を"
        "別途まとめたものである。",
        "因为官方数据的位置只到「市区町村 + 地区名」,没有丁目和坐标。地图上的町名形状是另行合并町丁边界得到的。",
        "Because the official data locates a deal only to municipality plus district name; block numbers and "
        "coordinates are absent. The town shapes on the map were merged separately from neighbourhood boundaries."),
    "h.doc.faq.q4": ("価格の高い町は投資に有利か。", "价格高的町是否更适合投资?", "Does a pricier town mean a better investment?"),
    "h.doc.faq.a4": (
        "この章は成約価格の分布であり、将来の値上がり率を語るデータではない。投資判断の材料にしないでほしい。",
        "本章是成交价格的分布,不是讲未来涨幅的数据。请勿作为投资判断依据。",
        "This chapter is a distribution of closed prices, not data about future appreciation. Do not use it to "
        "make an investment decision."),
    "foot.built": ("静的生成", "静态生成", "Statically generated"),

    # 海报 SVG 的标注(六张卡与章节页共用同一张图):随页面语言出文案,ja/zh/en 三列,
    # zh-Hant 由 zh 列转出(与其他文案同一条路径、同一道字符集闸)。
    "plate.quake.aria": ("日本周辺のM4以上震源密度、{a}–{b}",
                         "{a}–{b} 年日本周边 M4 以上震源密度",
                         "M4+ hypocentre density around Japan, {a}–{b}"),
    "plate.crime.aria": ("東京都心の町丁別犯罪率と認知件数",
                         "东京都心町丁犯罪率与认知件数",
                         "Crime rate and recorded incidents by neighbourhood, central Tokyo"),
    "plate.crime.chome": ("23区 / {n}町丁", "23区 / {n} 个町丁", "23 wards / {n} chome"),
    "plate.cab.aria": ("{a}年から{b}年までの内閣支持率、{n}か月",
                       "{a} 年至 {b} 年的内阁支持率,{n} 个月",
                       "Cabinet approval {a}–{b}, {n} months"),
    "plate.cab.seam": ("安倍2次", "安倍第二次", "Abe II"),
    "plate.cab.obuchi": ("小渕", "小渊", "Obuchi"),
    "plate.cab.koizumi": ("小泉", "小泉", "Koizumi"),
    "plate.cab.abe2": ("安倍2", "安倍2", "Abe II"),
    "plate.cab.takaichi": ("高市", "高市", "Takaichi"),
    "plate.house.aria": ("東京23区の中古マンション価格、{per}",
                         "东京 23 区二手公寓价格,{per}",
                         "Used-flat prices in the 23 wards of Tokyo, {per}"),
    "plate.house.deals": ("東京全域 {t} 町 / {d} 件", "东京全域 {t} 町 / {d} 笔",
                          "Tokyo-wide: {t} towns / {d} deals"),
    "plate.house.legend": ("WARD MEDIAN / 万円 per m2", "WARD MEDIAN / 万日元 per m2",
                           "WARD MEDIAN / ¥10k per m2"),
    "plate.pop.aria": ("1,719市町村の2020→2025年人口増減",
                       "1,719 个市町村 2020→2025 年人口增减",
                       "Population change 2020→2025 across 1,719 municipalities"),
    "plate.pop.head": ("91.2% の市町村が減少", "91.2% 的市町村在减少",
                       "91.2% of municipalities are shrinking"),
    "plate.pop.down": ("減少", "减少", "Falling"),
    "plate.pop.up": ("増加", "增加", "Growing"),
    "plate.pop.flat": ("横ばい", "持平", "Flat"),
    "plate.weather.aria": ("今日の日本天気予報", "今日日本天气预报",
                           "Today's Japan weather forecast"),
    "plate.weather.source": ("気象庁 予報", "气象厅 预报", "JMA forecast"),
}

# 海报上的地名标注:ja/zh 汉字原样,en 出罗马字(见 home_plates 的 PLACE_EN)。
PLATE_KEYS = tuple(k for k in COPY if k.startswith("plate."))


def plates():
    """海报标注的当前语言版本(章节页与首页卡共用)。"""
    return {k: tr(k) for k in PLATE_KEYS}



# ---------------------------------------------------------------- 语言
# 四份真静态页:ja 走默认路径,其余走 /zh-Hans/ /zh-Hant/ /en/。每份页面在构建期
# 就把对应语言的文案渲染进 HTML(不再靠 shell.js 改 DOM),所以下面几处必须一致:
# 目录前缀、<html lang>、hreflang、sitemap 的 <loc>、JSON-LD 的 inLanguage。
LANGS = ("ja", "zh-Hans", "zh-Hant", "en")
PREFIX = {"ja": "", "zh-Hans": "/zh-Hans", "zh-Hant": "/zh-Hant", "en": "/en"}
OG_LOCALE = {"ja": "ja_JP", "zh-Hans": "zh_CN", "zh-Hant": "zh_TW", "en": "en_US"}
LANG_SCHEMA = {"ja": "ja", "zh-Hans": "zh-Hans", "zh-Hant": "zh-Hant", "en": "en"}
# 章节视图(app/<章>/view.js)自带 ja/zh/zh-Hant/en 四套词表:zh-Hant 由 zh 经站内
# s2tw 规则转出(表在 app/hant.js,生成与闸见 tools/gen_view_hant.py / src/view_i18n.py),
# 所以四语各自的 data-view-lang 都能落到自己的词条上,不再把 zh-Hant 落到 zh。
VIEW_LANG = {"ja": "ja", "zh-Hans": "zh", "zh-Hant": "zh-Hant", "en": "en"}
# COPY 的列序:繁体列不单独维护,由简体列按 OpenCC s2tw 转换(见 src/hant.py)。
_COPY_IDX = {"ja": 0, "zh-Hans": 1, "en": 2}
COPY_HANT = {k: hant.convert(v[1]) for k, v in COPY.items()}
CUR = "ja"


def set_lang(lang):
    global CUR
    CUR = lang


def url(path="/"):
    """站内路由 → 当前语言下的真实 URL(`/` → `/`、`/zh-Hans/`)。"""
    return PREFIX[CUR] + path


def url_in(lang, path="/"):
    return PREFIX[lang] + path


def tr(key):
    if CUR == "zh-Hant":
        return COPY_HANT[key]
    return COPY[key][_COPY_IDX[CUR]]


def alternate_urls(path):
    """一条路由的四种语言 URL(顺序固定,ja 在前,便于人读)。"""
    return [(lang, SITE_URL + url_in(lang, path)) for lang in LANGS]


PAGES = []
CSS_VER = "__CSS_VER__"
JS_VER = "__JS_VER__"
FONT_VER = "__FONT_VER__"
WEATHER_VER = "__WEATHER_VER__"


def route_key(path):
    """路由 → og:image 文件名用的键(/ → home,/weather/ → weather)。"""
    if path == "/":
        return "home"
    return path.strip("/").split("/")[-1].replace(".html", "")


def og_image(path):
    return f"/assets/og/{route_key(path)}-{CUR}.png"


def head(title, desc, path, jsonld=None, extra_head="", body_class="", chapter=""):
    is_404 = path == "/404.html"
    u = SITE_URL + url("/" if is_404 else path)
    # 四向互指 + x-default 指 ja 版。每一条目标都是构建产物里真实存在的页面,
    # 不再有 ?lang= 那种「同一份 HTML 换 query」的假变体。
    alts = ""
    if not is_404:
        alts = "".join(
            f'<link rel="alternate" hreflang="{lang}" href="{SITE_URL + url_in(lang, path)}">\n'
            for lang in LANGS)
        alts += (f'<link rel="alternate" hreflang="x-default" '
                 f'href="{SITE_URL + url_in("ja", path)}">')
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
    boot = ("<script>try{var d=document.documentElement;d.classList.add('js');"
            "var t=null;try{t=localStorage.getItem('pj-theme')}catch(e){}"
            "if(t!=='sage'&&t!=='dark'){var h=new Date().getHours();t=(h>=6&&h<18)?'sage':'dark';}"
            "d.dataset.theme=t;"
            "}catch(e){}</script>")
    # 404 是 noindex 的一次性页面,也不参与分享:不发 og:image(没有它的卡片)。
    og_block = ""
    if not is_404:
        og_block = (f'<meta property="og:image" content="{SITE_URL + og_image(path)}">\n'
                    f'<meta property="og:image:width" content="1200">\n'
                    f'<meta property="og:image:height" content="630">\n'
                    f'<meta property="og:image:alt" content="{esc(title)}">\n')
    locale_alts = "".join(
        f'<meta property="og:locale:alternate" content="{OG_LOCALE[lang]}">\n'
        for lang in LANGS if lang != CUR)
    return f"""<!doctype html>
<html lang="{CUR}" data-view-lang="{VIEW_LANG[CUR]}" data-theme="sage"{f' data-chapter="{chapter}"' if chapter else ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{('<meta name="robots" content="noindex">' if is_404 else '')}
<link rel="canonical" href="{u}">
{alts}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{u}">
{og_block}<meta property="og:locale" content="{OG_LOCALE[CUR]}">
{locale_alts}<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F3ED">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/outfit-800.woff2?v=__FONT_VER__" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css?v=__CSS_VER__">
{boot}
{ld}
{extra_head}
{GA_SNIPPET}</head>
<body{body_class}>
<a class="skip" href="#main">{tr('skip')}</a>
<div class="grain" aria-hidden="true"></div>
<div class="scroll-progress" aria-hidden="true"></div>
"""


def theme_toggle():
    return f"""<button class="theme-toggle" type="button" data-theme-toggle data-label-to-dark="{esc(tr('ui.theme.toDark'))}" data-label-to-light="{esc(tr('ui.theme.toLight'))}" aria-label="{esc(tr('ui.theme'))}" title="{esc(tr('ui.theme'))}" hidden>
<svg class="theme-icon" viewBox="0 0 16 16" aria-hidden="true">
<g class="icon-sun" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"></circle><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13"></path></g>
<path class="icon-moon" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M13 9.7A5.5 5.5 0 0 1 6.3 3a5.5 5.5 0 1 0 6.7 6.7Z"></path>
</svg>
</button>"""


LANG_NAMES = {"ja": "日本語", "zh-Hans": "简体中文", "zh-Hant": "繁體中文", "en": "English"}


def lang_switch(path="/"):
    """语言切换器 = 四条真站内链接。

    原生 `<details>` 披露菜单:不依赖 JS、键盘可达;爬虫在任意语言页都能顺着这些
    `<a href>` 发现其余三语(旧版是 JS 改 ?lang= 的按钮,爬虫看不见目标页)。
    """
    items = "".join(
        f'<a href="{url_in(lang, path)}" lang="{lang}" hreflang="{lang}"'
        f'{" aria-current=\"page\"" if lang == CUR else ""}>{LANG_NAMES[lang]}</a>'
        for lang in LANGS)
    return f"""<details class="lang-switch" data-lang-switch>
<summary class="lang-btn"><span class="sr-only">{esc(tr('ui.lang'))}</span><span lang="{CUR}">{LANG_NAMES[CUR]}</span><svg class="lang-caret" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3 4 5.5 6.5 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path></svg></summary>
<div class="lang-menu">{items}</div>
</details>"""


def mast(active="", path="/"):
    def link(href, key, ch):
        cur = ' aria-current="page"' if ch == active else ""
        return f'<a href="{url(href)}"{cur}>{tr(key)}</a>'

    switch = lang_switch(path)
    return f"""<header class="masthead"><div class="wrap masthead-in">
<a class="wordmark wordmark-cycle" href="{url('/')}" aria-label="{BRAND}">{animated_wordmark()}</a>
<nav class="chapters" aria-label="{esc(tr('nav.label'))}">
{link('/weather/', 'nav.weather', 'weather')}
{link('/quake/', 'nav.quake', 'quake')}
{link('/crime/', 'nav.crime', 'crime')}
{link('/cabinet/', 'nav.cabinet', 'cabinet')}
{link('/housing/', 'nav.housing', 'housing')}
{link('/population/', 'nav.population', 'population')}
</nav>
<div class="tools">
{theme_toggle()}
{switch}
<button class="burger" type="button" data-burger aria-expanded="false" aria-controls="mobile-menu" aria-label="{esc(tr('nav.label'))}"><span></span><span></span></button>
</div>
</div></header>
<div class="mobile-menu" id="mobile-menu">
<nav class="mobile-nav-links" aria-label="{esc(tr('nav.label'))}">
{link('/weather/', 'nav.weather', 'weather')}
{link('/quake/', 'nav.quake', 'quake')}
{link('/crime/', 'nav.crime', 'crime')}
{link('/cabinet/', 'nav.cabinet', 'cabinet')}
{link('/housing/', 'nav.housing', 'housing')}
{link('/population/', 'nav.population', 'population')}
</nav>
<div class="mobile-foot">
{switch}
{theme_toggle()}
</div>
</div>
"""


def shell_tail():
    return '<script src="/assets/shell.js?v=__JS_VER__" defer></script>\n</body></html>'


# ---------------------------------------------------------------- 结构化数据
# 站点实体(Organization / Person / WebSite)每页都发一份 @graph,页面上的发布者与
# 作者都能解析到稳定 @id;章节页再把 Dataset 挂进同一张图。
SITE_ORG_ID = SITE_URL + "/#organization"
SITE_PERSON_ID = SITE_URL + "/#person"
SITE_SITE_ID = SITE_URL + "/#website"


def organization_node():
    return {
        "@type": "Organization",
        "@id": SITE_ORG_ID,
        "name": BRAND,
        "alternateName": "ouuut",
        # @id 与 url 同域(japan.ouuut.com);另两站与社媒进 sameAs。
        "url": SITE_URL + "/",
        "sameAs": ["https://ouuut.com/", "https://saaaai.com/", "https://x.com/saaaaicom"],
        "founder": {"@id": SITE_PERSON_ID},
        "logo": {"@type": "ImageObject", "url": SITE_URL + "/assets/favicon.svg"},
    }


def person_node():
    return {
        "@type": "Person",
        "@id": SITE_PERSON_ID,
        "name": "中本蔡",
        "alternateName": "NAKAMOTO SAI",
        "url": "https://saaaai.com/",
        "sameAs": ["https://saaaai.com/", "https://ouuut.com/", "https://x.com/saaaaicom"],
        # 联系邮箱按域名归属走(2026-11-06 最终口径):ouuut.com 的站(含子域)显示 out@ouuut.com,
        # saaaai.com 的站显示 sai@saaaai.com。above 的 url/sameAs 是作品主页链接,不是联系方式,不动。
        "email": "mailto:out@ouuut.com",
        "knowsLanguage": list(LANGS),
    }


def website_node():
    return {
        "@type": "WebSite",
        "@id": SITE_SITE_ID,
        "name": BRAND,
        "url": SITE_URL + "/",
        "inLanguage": list(LANGS),
        "publisher": {"@id": SITE_ORG_ID},
        "author": {"@id": SITE_PERSON_ID},
    }


def is_top(path):
    """封面与 404 是顶层页:没有面包屑层级。"""
    return path in ("/", "/404.html")


def breadcrumb_node(path):
    items = [{"@type": "ListItem", "position": 1, "name": tr("crumb.home"),
              "item": SITE_URL + url("/")},
             {"@type": "ListItem", "position": 2, "name": tr(f"nav.{route_key(path)}"),
              "item": SITE_URL + url(path)}]
    return {"@type": "BreadcrumbList", "@id": SITE_URL + url(path) + "#breadcrumb",
            "itemListElement": items}


def breadcrumbs(path):
    """可见面包屑(顶层 → 章节);封面与 404 不发。与 JSON-LD 同源。"""
    if is_top(path):
        return ""
    return (f'<nav class="crumbs" aria-label="{esc(tr("crumb.nav"))}"><ol>'
            f'<li><a href="{url("/")}">{tr("crumb.home")}</a></li>'
            f'<li aria-current="page">{tr(f"nav.{route_key(path)}")}</li>'
            f'</ol></nav>\n')


def page_graph(path, title, desc, node=None):
    page_url = SITE_URL + url(path)
    graph = [
        organization_node(),
        person_node(),
        website_node(),
        {"@type": "WebPage",
         "@id": page_url + "#webpage",
         "url": page_url,
         "name": title,
         "description": desc,
         "inLanguage": LANG_SCHEMA[CUR],
         "isPartOf": {"@id": SITE_SITE_ID},
         "about": {"@id": SITE_ORG_ID},
         "author": {"@id": SITE_PERSON_ID},
         "publisher": {"@id": SITE_ORG_ID},
         "breadcrumb": {"@id": page_url + "#breadcrumb"}},
    ]
    if not is_top(path):
        graph.append(breadcrumb_node(path))
    if node:
        node = dict(node)
        node.setdefault("author", {"@id": SITE_PERSON_ID})
        node.setdefault("inLanguage", LANG_SCHEMA[CUR])
        graph.append(node)
    return {"@context": "https://schema.org", "@graph": graph}


def dataset_node(name, desc, path, official, distribution, coverage, spatial,
                 license_url, variables, extra_citations=()):
    """章节页 Dataset:creator / publisher 都是本站,官方机构是出处不是作者。

    它们进 isBasedOn 与 citation;distribution 指向本站真实存在的数据文件。
    """
    page_url = SITE_URL + url(path)
    return {
        "@type": "Dataset",
        "@id": page_url + "#dataset",
        "name": name,
        "description": desc,
        "url": page_url,
        "inLanguage": LANG_SCHEMA[CUR],
        "creator": {"@id": SITE_ORG_ID},
        "publisher": {"@id": SITE_ORG_ID},
        "author": {"@id": SITE_PERSON_ID},
        "isBasedOn": official,
        "citation": [official, *extra_citations],
        "license": license_url,
        "isAccessibleForFree": True,
        "dateModified": BUILD_DATE,
        "temporalCoverage": coverage,
        "spatialCoverage": spatial,
        "variableMeasured": variables,
        "distribution": [
            {"@type": "DataDownload", "contentUrl": SITE_URL + u,
             "encodingFormat": fmt, "name": u.rsplit("/", 1)[-1]}
            for u, fmt in distribution
        ],
        "isPartOf": {"@id": SITE_SITE_ID},
    }


def foot():
    return f"""<footer class="foot hp-foot"><div class="wrap foot-in">
<div class="foot-top"><a class="wordmark" href="{url('/')}" aria-label="{BRAND}">{WM}</a></div>
<div class="foot-bottom">
<span><a href="https://saaaai.com/" rel="author me">中本蔡 / NAKAMOTO SAI</a> · <a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a> · <span>{tr('foot.built')}</span> · {BUILD_DATE}</span>
</div>
</div></footer>
{shell_tail()}"""


def page(path, title, desc, body, active="", node=None, register=True, head_extra="", fullscreen=False):
    body = body.replace('<table class="data-table">', '<div class="table-scroll"><table class="data-table">')
    body = body.replace('</table>', '</table></div>')
    body_class = ' class="chapter-app"' if fullscreen else ''
    html_doc = head(title, desc, path, page_graph(path, title, desc, node),
                    head_extra, body_class, active)
    html_doc += mast(active, path) + breadcrumbs(path) + body
    # 四章も正文を持つ一枚の文書になったので、他章と同じ页脚で閉じる(旧: 全屏舞台は shell だけ)。
    html_doc += foot()
    if register:
        PAGES.append({"path": path, "lang": CUR, "title": title, "desc": desc})
    return html_doc


def stats(items):
    out = ['<dl class="stats rv">']
    for label_key, value, unit in items:
        u = f"<small>{esc(unit)}</small>" if unit else ""
        out.append(f'<div><dt>{tr(label_key)}</dt>'
                   f'<dd>{value}{u}</dd></div>')
    out.append("</dl>")
    return "".join(out)


def pager(prev_href, prev_label, next_href, next_label):
    a = f'<a href="{prev_href}">← {esc(prev_label)}</a>' if prev_href else "<span></span>"
    b = f'<a href="{next_href}">{esc(next_label)} →</a>' if next_href else "<span></span>"
    return f'<nav class="pager">{a}<span class="spacer"></span>{b}</nav>'


# ---------------------------------------------------------------- 四章の静的正文
# 四章(地震・犯罪・内閣・住宅)は舞台(ポスター→起動)の下に、同じ四つの節を置く:
# 是什么(この章で見るもの)/ 数据口径(データの口径)/ 怎么读(どう読むか)/ 常见问题。
# 見出しは h2 を四本だけ、四言語で同じ並び。本文の数値はすべてデータから差し込む。
DOC_SHAPE = {"q": (2, 3, 3, 3), "c": (2, 4, 3, 4), "b": (2, 4, 2, 4), "h": (2, 4, 2, 4),
             "w": (2, 3, 2, 3)}


def doc_para(prefix, key, count):
    return "".join(f"<p>{tr(f'{prefix}.doc.{key}.p{i}')}</p>" for i in range(1, count + 1))


def doc_section(prefix, key, inner, eyebrow=""):
    head = f'<p class="ch-doc-eyebrow">{tr(eyebrow)}</p>' if eyebrow else ""
    return (f'<section class="wrap ch-doc">\n'
            f'<header class="ch-doc-head">{head}<h2>{tr(f"{prefix}.doc.{key}.h")}</h2></header>\n'
            f'{inner}\n</section>')


def doc_facts(prefix, items):
    rows = "".join(f"<div><dt>{tr(f'{prefix}.doc.fact.{k}')}</dt><dd>{esc(str(v))}</dd></div>"
                   for k, v in items)
    return f'<dl class="ch-facts">{rows}</dl>'


def doc_faq(prefix, count):
    rows = "".join(f'<dt>{tr(f"{prefix}.doc.faq.q{i}")}</dt><dd>{tr(f"{prefix}.doc.faq.a{i}")}</dd>'
                   for i in range(1, count + 1))
    return f'<dl class="ch-faq">{rows}</dl>'


def chapter_doc(prefix, facts):
    n_what, n_cal, n_read, n_faq = DOC_SHAPE[prefix]
    return (
        doc_section(prefix, "what", doc_para(prefix, "what", n_what), eyebrow=f"{prefix}.doc.eyebrow")
        + doc_section(prefix, "cal", doc_para(prefix, "cal", n_cal) + doc_facts(prefix, facts))
        + doc_section(prefix, "read", doc_para(prefix, "read", n_read))
        + doc_section(prefix, "faq", doc_faq(prefix, n_faq))
    )


# ---------------------------------------------------------------- pages
def build_home_preview():
    """Six plates, all live chapter links.

    The sixth plate is population: 1,719 equal cells, one per municipality.
    Provenance remains readable without JavaScript, and the closing statement
    stays on one line.
    """
    css = (SRC / "home-preview.css").read_text(encoding="utf-8")

    # key, num, href, verb, topic, count, unit, claim, source, plate
    rows = [
        ("weather", "01", "/weather/", "card.weather.title", "card.weather.topic", "47",
         "card.weather.unit", "card.weather.claim", "card.weather.source",
         HP.weather_svg(OUTLINE, T=plates(), lang=CUR)),
        ("quake", "02", "/quake/", "card.quake.title", "nav.quake", n(Q_N),
         "card.quake.unit", "card.quake.claim", "card.quake.source",
         HP.quake_svg(Q, OUTLINE, YEARS, T=plates(), lang=CUR)),
        ("crime", "03", "/crime/", "card.crime.title", "nav.crime", "5,234",
         "card.crime.unit", "card.crime.claim", "card.crime.source",
         HP.crime_svg(POINTS, MUNI_POLY, WARD_RATE, T=plates(), lang=CUR)),
        ("cabinet", "04", "/cabinet/", "card.cabinet.title", "nav.cabinet", "331",
         "card.cabinet.unit", "card.cabinet.claim", "card.cabinet.source",
         HP.cabinet_svg(ALL_MONTHS, MONTH_MEAN, CAB, T=plates(), lang=CUR)),
        ("housing", "05", "/housing/", "card.housing.title", "nav.housing", f"{HOUSE['totals']['trades']:,}",
         "card.housing.unit", "card.housing.claim", "card.housing.source",
         HP.housing_svg(HOUSE_WARDS, MUNI_POLY, deals=HOUSE_N, towns=HOUSE_TOWNS, T=plates(), lang=CUR)),
        ("population", "06", "/population/", "card.population.title", "card.population.topic",
         "", "card.population.unit", "card.population.claim",
         "card.population.source", HP.population_svg(POP, T=plates(), lang=CUR)),
    ]

    entries = []
    for key, num, href, verb, topic, count, unit, claim, source_key, svg in rows:
        foot = f'<span class="hp-enter"><span>{tr("prod.open")}</span> ↗</span>'
        count_html = (f'<b>{tr("card.population.count")}</b>'
                      if key == "population" else f"<b>{count}</b>")
        card = f"""<div class="hp-entry-head"><span class="hp-num">{num}</span><span class="hp-verb">{tr(verb)}</span><span class="hp-topic">{tr(topic)}</span></div>
<div class="hp-entry-visual" aria-hidden="true"><div class="hp-plate">{svg}</div></div>
<div class="hp-entry-body">
<p class="hp-count">{count_html}<small>{tr(unit)}</small></p>
<p class="hp-claim">{tr(claim)}</p>
<div class="hp-entry-foot"><span class="hp-source">{tr(source_key)}</span>{foot}</div>
</div>"""
        entries.append(f'<a class="hp-entry" data-chapter="{key}" href="{url(href)}">\n{card}\n</a>')

    source_items = []
    for key in ("weather", "quake", "crime", "cabinet", "housing", "population"):
        source_items.append(
            f'<article class="hp-source-item"><h3><span>{tr(f"home.{key}.title")}</span>'
            f'<span aria-hidden="true">—</span><a href="{url(f'/{key}/')}"><span>{tr(f"home.{key}.source")}</span> ↗</a></h3>'
            f'<p>{tr(f"home.{key}.copy")}</p></article>'
        )

    body = f"""<main id="main" class="hp">
<section class="wrap hp-band hp-live" aria-label="Chapters">
{''.join(entries)}
</section>
<section class="wrap hp-statement" aria-labelledby="home-statement-title">
<h1 id="home-statement-title">{tr('cover.title')}</h1>
<div class="hp-author">
<div class="hp-author-intro">
<p class="hp-author-role">{tr('author.role')}</p>
<p class="hp-author-name">中本蔡 <span lang="en">NAKAMOTO SAI</span></p>
<p class="hp-author-bio">{tr('author.bio')}</p>
</div>
<nav class="hp-author-links" aria-label="Author and contact links">
<a href="https://ouuut.com/"><strong>ouuut.com</strong><small>{tr('author.projects')}</small><span aria-hidden="true">↗</span></a>
<a href="https://saaaai.com/"><strong>saaaai.com</strong><small>{tr('author.personal')}</small><span aria-hidden="true">↗</span></a>
<div class="hp-author-contact">
<span class="hp-author-contact-label">{tr('author.contact')}</span>
<a href="mailto:out@ouuut.com">out@ouuut.com</a>
<a href="https://x.com/saaaaicom" rel="me">X <span class="hp-author-handle">@saaaaicom</span></a>
</div>
</nav>
</div>
</section>
<section class="wrap hp-provenance" aria-labelledby="method-title">
<div class="hp-provenance-panel">
<div class="hp-provenance-intro">
<p class="hp-kicker">PRIMARY SOURCES / STATIC BUILD</p>
<h2 id="method-title">{tr('m.h1')}</h2>
<p class="hp-provenance-lede">{tr('home.c.lede')}</p>
</div>
<div class="hp-provenance-content">
<details class="hp-sources" open>
<summary>{tr('home.details')}</summary>
<div class="hp-sources-body">
<div class="hp-sources-list">{''.join(source_items)}</div>
<div class="hp-definitions">
<h3>{tr('home.definitions')}</h3>
<p>{tr('home.definitions.copy')}</p>
<p>{tr('home.compiled')}</p>
</div>
</div>
</details>
</div>
</div>
</section>
</main>"""

    return page("/", PAGE_META["home"][CUR][0], PAGE_META["home"][CUR][1],
                body, "", None, register=True,
                head_extra='<style>\n' + css + '\n</style>')


def build_404():
    links = "".join(f'<li><a href="{url(f"/{key}/")}">{tr(f"nav.{key}")}</a></li>'
                    for key in ("weather", "quake", "crime", "cabinet", "housing", "population"))
    body = f'''<main id="main" class="cover"><div class="wrap">
<p class="eyebrow">404</p>
<h1>{tr("nf.h1")}</h1>
<p class="lede">{tr("nf.p")}</p>
<nav aria-label="{esc(tr('nav.label'))}"><ul>{links}</ul></nav>
<div class="hero-actions">
<a class="btn-primary" href="{url("/")}">{tr("nf.home")}</a>
<a href="mailto:out@ouuut.com">{tr("author.contact")}</a>
</div>
</div></main>'''
    return page("/404.html", PAGE_META["404"][CUR][0], PAGE_META["404"][CUR][1], body,
                register=False)


def build_preview_redirect():
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=/">
<link rel="canonical" href="{SITE_URL}/">
<title>{BRAND}</title>
</head>
<body><p><a href="/">{BRAND}</a></p></body>
</html>"""


def weather_assets():
    """Weather runtime ships as content-stamped static assets, never inlined.

    The page references them with `?v=<content hash>`, so each release publishes fresh
    cache keys and can never inherit an entry filled by an older deployment. `_headers`
    keeps them revalidating (`max-age=0, must-revalidate`), so a stamp costs at most one
    conditional round trip and can never pin a stale body for a year — which is how a
    single `?v=` entry from 11-02 held the previous snapshot through all of 2026-11-03.
    """
    return {
        "app.js": (WEATHER_SRC / "app.js").read_text(encoding="utf-8"),
        "data.js": (WEATHER_SRC / "data.js").read_text(encoding="utf-8"),
        "geo.js": (WEATHER_SRC / "geo.js").read_text(encoding="utf-8"),
        "weather.css": (WEATHER_SRC / "lab.css").read_text(encoding="utf-8"),
    }


def region_name(r):
    """都道府県名:ja / zh-Hans / zh-Hant / en;繁体同样走站点自己的转换规则。"""
    if CUR == "zh-Hans":
        return r.get("nameZh") or r["nameJa"]
    if CUR == "zh-Hant":
        return hant.convert(r.get("nameZh") or r["nameJa"])
    if CUR == "en":
        return r.get("nameEn") or r["nameJa"]
    return r["nameJa"]


def build_weather(ver):
    def temp(v):
        return "—" if v is None or v == "" else f"{esc(v)}°"

    def pop_text(r):
        v = r.get("pop")
        return "—" if v is None else f"{esc(v)}%"

    def day_text(iso):
        """2026-11-03 → ja/zh「11月3日」、en「3 Nov」。"""
        _y, m, d = (int(x) for x in iso.split("-"))
        if CUR == "en":
            return f"{d} {('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec')[m - 1]}"
        return f"{m}月{d}日"

    # 过期快照的诚实标注:JS 有 JS 的那句,无 JS 时这句留着(两处只有一句会显示)。
    stale_note = ""
    if WEATHER_STALE:
        stale_note = ('<p class="weather-stale" role="status">'
                      + tr("w.stale").replace("{d}", day_text(WEATHER_REPORT_DATE))
                                       .replace("{t}", day_text(WEATHER_TODAY))
                      + "</p>")

    rows = "".join(
        f'<tr><th scope="row">{esc(region_name(r))}</th>'
        f'<td>{esc(r.get("summaryJa") or "")}</td>'
        f'<td>{temp(r.get("today", {}).get("high"))} / {temp(r.get("today", {}).get("low"))}</td>'
        f'<td>{pop_text(r)}</td></tr>'
        for r in WEATHER_REGIONS
    )
    week = WEATHER_REGIONS[0]["week"]
    jsonld = dataset_node(
        "Japan weather forecast by prefecture",
        "JMA short-range and seven-day forecasts for all 47 prefectures; a static snapshot, not live observations.",
        "/weather/",
        "https://www.jma.go.jp/bosai/forecast/",
        [("/data/weather.csv", "text/csv")],
        f"{week[0]['date']}/{week[-1]['date']}",
        "Japan (47 prefectures)",
        "https://www.jma.go.jp/jma/kishou/info/coment.html",
        ["Forecast temperature (°C)", "Precipitation probability (%)", "Weather code"],
    )
    # zh-Hant:交互部件也要繁体。站点唯一的 s2tw 表是 app/hant.js(章节视图同源),
    # 这里用一段 inline module 把它交给 app.js(后者仍是经典脚本,不改成模块)。
    hant_boot = ""
    if CUR == "zh-Hant":
        hant_boot = ('<script type="module">import { toHant } from "/app/hant.js";'
                     'window.__pjToHant = toHant;'
                     'window.dispatchEvent(new Event("pj:hant"));</script>\n')
    body = f"""<main id="main" class="weather-lab">
<div class="wrap" id="weather-app"></div>
<noscript><section class="wrap weather-static-fallback">
<p class="micro">気象庁 / JMA</p>
<h1>{tr('w.noscript.h1')}</h1>
<p class="muted">{tr('w.noscript.p')}</p>
{stale_note}
<div class="table-scroll"><table><thead><tr><th>{tr('w.th.pref')}</th><th>{tr('w.th.summary')}</th><th>{tr('w.th.temp')}</th><th>{tr('w.th.pop')}</th></tr></thead><tbody>{rows}</tbody></table></div>
</section></noscript>
{chapter_doc("w", [
    ("src", "気象庁 (JMA)"),
    ("period", f"{week[0]['date']} – {week[-1]['date']}"),
    ("regions", f"{len(WEATHER_REGIONS)} (代表予報区)"),
    ("issued", f"{WEATHER_REGIONS[0]['reportDatetime'][:16].replace('T', ' ')} JST"),
    ("report", WEATHER_REPORT_DATE),
    ("gen", WEATHER_DOC["generatedAt"]),
])}
</main>
<script src="/assets/weather/data.js?v={ver}" defer></script>
<script src="/assets/weather/geo.js?v={ver}" defer></script>
{hant_boot}<script src="/assets/weather/app.js?v={ver}" defer></script>"""
    return page("/weather/", PAGE_META["weather"][CUR][0], PAGE_META["weather"][CUR][1],
                body, "weather", jsonld,
                head_extra=f'<link rel="stylesheet" href="/assets/weather/weather.css?v={ver}">')


def build_quake():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only">{tr('q.h1')}</h1>
<p class="sr-only">{tr('q.lede')}</p>
<div class="stage" data-live="0" data-stage-auto="quake" data-view="quake">
<div class="stage-poster">{quake_poster()}</div>
<p class="stage-caption">{tr('q.caption').format(n=n(Q_N), end=Q_END_DOT)}</p>
<div class="stage-live" id="v-quake-viewport"></div>
</div>
{chapter_doc("q", [
    ("src", "USGS ComCat"),
    ("period", f"2000-01-01 – {Q_END[:10]}"),
    ("n", f"{n(Q_N)} (M4.0+)"),
    ("max", f"M{Q_MAX} ({Q_MAX_DAY})"),
    ("m6", n(Q_M6_N)),
    ("share", f"{PCT_2011_E}%"),
])}
</main>"""
    jsonld = dataset_node(
        "Japan M4+ hypocentres 2000–2026",
        "USGS ComCat hypocentres M4.0+ in the Japan region.",
        "/quake/",
        "https://earthquake.usgs.gov/fdsnws/event/1/",
        [("/data/quakes.csv", "text/csv")],
        f"2000-01-01/{Q_END[:10]}",
        "Japan region (120–150E, 20–50N)",
        "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
        ["Hypocentre magnitude (Mw)", "Hypocentre depth (km)", "Origin time (UTC)"],
        extra_citations=("https://earthquake.usgs.gov/data/comcat/",),
    )
    return page("/quake/", PAGE_META["quake"][CUR][0], PAGE_META["quake"][CUR][1],
                body, "quake", jsonld, fullscreen=True)


def build_crime():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only">{tr('c.h1')}</h1>
<p class="sr-only">{tr('c.lede')}</p>
<div class="stage stage-crime" data-live="0" data-stage-auto="crime" data-view="crime">
<div class="stage-poster">{crime_poster()}</div>
<p class="stage-caption">{tr('c.caption').format(n=n(len([p for p in POINTS if p.get("lng") and 138.9 <= p["lng"] <= 139.96 and 35.46 <= p["lat"] <= 35.92])))}</p>
<div class="stage-live"></div>
</div>
{chapter_doc("c", [
    ("chome", n(CHOME_COUNT)),
    ("munis", len(MUNI)),
    ("pop", n(CHOME_POP)),
    ("rate", "1 / 1,000"),
    ("norate", n(CHOME_NO_RATE)),
])}
</main>"""
    jsonld = dataset_node(
        "Tokyo crime by neighbourhood, 2025",
        "Tokyo Metropolitan Police recorded incidents by chome, 2025.",
        "/crime/",
        "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/statistics/",
        [("/data/crime.csv", "text/csv")],
        "2025",
        "Tokyo",
        "https://creativecommons.org/licenses/by/4.0/",
        ["Recorded incidents", "Resident population", "Incidents per 1,000 residents"],
    )
    return page("/crime/", PAGE_META["crime"][CUR][0], PAGE_META["crime"][CUR][1],
                body, "crime", jsonld, fullscreen=True)


def build_cabinet():
    series = [(ym[2:], v) for ym, v in sorted(MONTH_MEAN.items())]
    head_extra = """<link rel="preload" href="/app/cabinet/data.json" as="fetch" crossorigin>
<link rel="modulepreload" href="/app/cabinet/view.js">"""
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only">{tr('b.h1')}</h1>
<p class="sr-only">{tr('b.lede')}</p>
<div class="stage stage-cabinet" data-live="0" data-stage-auto="cabinet" data-view="cabinet">
<noscript><style>#cab-app-veil{{display:none !important}}</style></noscript>
<div class="cab-veil" id="cab-app-veil" role="progressbar" aria-label="Loading cabinet approval data">
  <div class="cab-veil-inner">
    <div class="cab-veil-pulse">
      <svg class="cab-veil-wave" viewBox="0 0 120 28" fill="none">
        <path class="cab-veil-path-base" d="M0,14 L30,14 L45,4 L60,24 L75,10 L90,14 L120,14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="cab-veil-path-glow" d="M0,14 L30,14 L45,4 L60,24 L75,10 L90,14 L120,14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="cab-veil-text">{tr('cab.loading')}</div>
  </div>
</div>
<noscript>
<div class="stage-poster">
<figure class="figure" style="margin:0">
{line_svg(series)}
<figcaption>1998–2026 · monthly mean · {n(len(POLLS))} polls</figcaption>
</figure>
</div>
</noscript>
<div class="stage-live"></div>
</div>
{chapter_doc("b", [
    ("src", "NHK · Nikkei · Asahi · Jiji · Yomiuri · JNN · Kyodo"),
    ("polls", n(len(POLLS))),
    ("months", n(len(MONTH_MEAN))),
    ("cabinets", len(CAB['cabinets'])),
    ("single", f"{n(N_SINGLE)} / {n(N_BUCKETS)}"),
    ("swing", f"{SWING:+.1f}"),
])}
</main>"""
    jsonld = dataset_node(
        "Japanese cabinet approval, 1998–2026",
        "Monthly cabinet approval ratings aggregated from NHK, Nikkei, Asahi, Jiji, Yomiuri, JNN and Kyodo polls.",
        "/cabinet/",
        "https://www.nhk.or.jp/senkyo/",
        [("/data/cabinet-monthly.csv", "text/csv"), ("/data/cabinet.csv", "text/csv")],
        f"{min(p['date'] for p in POLLS)[:7]}/{max(p['date'] for p in POLLS)[:7]}",
        "Japan",
        "https://creativecommons.org/licenses/by/4.0/",
        ["Cabinet approval (%)", "Poll count per month"],
        extra_citations=("https://www.nikkei.com/", "https://www.kyodo.co.jp/"),
    )
    return page("/cabinet/", PAGE_META["cabinet"][CUR][0], PAGE_META["cabinet"][CUR][1],
                body, "cabinet", jsonld, head_extra=head_extra, fullscreen=True)


def build_housing():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only">{tr('h.h1')}</h1>
<p class="sr-only">{tr('h.lede')}</p>
<div class="stage stage-housing" data-live="0" data-stage-auto="housing" data-view="housing">
<div class="stage-poster">{HP.housing_svg(HOUSE_WARDS, MUNI_POLY, 1000, 620, deals=HOUSE_N, towns=HOUSE_TOWNS, T=plates(), lang=CUR)}</div>
<p class="stage-caption">{tr('h.caption').format(n=f"{HOUSE_N:,}", basis=HOUSE['basis'])}</p>
<div class="stage-live"></div>
</div>
{chapter_doc("h", [
    ("src", "MLIT · PDL 1.0"),
    ("period", HOUSE['basis']),
    ("n", n(HOUSE_N)),
    ("trades", n(HOUSE['totals']['trades'])),
    ("towns", f"{n(HOUSE_TOWNS)} / {n(HOUSE_TOWNS_ALL)}"),
    ("gen", HOUSE['generated']),
])}
</main>"""
    jsonld = dataset_node(
        f"Tokyo — used flat mean prices by town, {HOUSE['basis']}",
        "Mean closed price per town for used flats in Tokyo's 23 wards, derived from the MLIT Real Estate Information Library.",
        "/housing/",
        "https://www.reinfolib.mlit.go.jp/",
        [("/app/housing/data/towns.json", "application/json")],
        "2025-04-01/2026-03-31",
        "Tokyo 23 wards",
        "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0",
        ["Mean closed price per m2 (JPY)", "Transaction count per town"],
    )
    return page("/housing/", PAGE_META["housing"][CUR][0], PAGE_META["housing"][CUR][1],
                body, "housing", jsonld, fullscreen=True)


def pop_pyramid_svg(doc, w=1000, h=540):
    """National age pyramid: 2025 actual filled, 2050 IPSS medium outlined."""
    bins = doc["age"]["bins"]
    y25 = doc["age"]["y2025"]
    y50 = doc["age"]["y2050"]
    m25, f25 = y25["male"], y25["female"]
    m50, f50 = y50["male"], y50["female"]
    maxv = max(max(m25), max(f25), max(m50), max(f50)) or 1
    cx = w / 2
    halfw = w * 0.36
    top, bottom = 58, h - 54
    n = len(bins)
    rh = (bottom - top) / n
    out = [
        f'<text x="{cx}" y="24" text-anchor="middle" font-size="12" '
        f'fill="var(--muted)" letter-spacing="1">2025 / 2050</text>',
        f'<text x="{cx - halfw - 10}" y="44" text-anchor="end" font-size="11" '
        f'fill="var(--muted)">M</text>',
        f'<text x="{cx + halfw + 10}" y="44" text-anchor="start" font-size="11" '
        f'fill="var(--muted)">F</text>',
    ]
    for i in range(n - 1, -1, -1):
        y = top + (n - 1 - i) * rh
        hh = max(1.0, rh - 2.2)
        bm25 = max(0.0, m25[i] / maxv * halfw)
        bf25 = max(0.0, f25[i] / maxv * halfw)
        bm50 = max(0.0, m50[i] / maxv * halfw)
        bf50 = max(0.0, f50[i] / maxv * halfw)
        out.append(f'<rect x="{cx - 12 - bm25:.1f}" y="{y:.1f}" width="{bm25:.1f}" '
                   f'height="{hh:.1f}" fill="var(--accent)" opacity=".30"/>')
        out.append(f'<rect x="{cx + 12:.1f}" y="{y:.1f}" width="{bf25:.1f}" '
                   f'height="{hh:.1f}" fill="var(--accent)" opacity=".30"/>')
        out.append(f'<rect x="{cx - 12 - bm50:.1f}" y="{y:.1f}" width="{bm50:.1f}" '
                   f'height="{hh:.1f}" fill="none" stroke="var(--ink)" stroke-width="1" opacity=".55"/>')
        out.append(f'<rect x="{cx + 12:.1f}" y="{y:.1f}" width="{bf50:.1f}" '
                   f'height="{hh:.1f}" fill="none" stroke="var(--ink)" stroke-width="1" opacity=".55"/>')
    for i in range(0, n, 4):
        y = top + (n - 1 - i) * rh + rh / 2 + 3
        out.append(f'<text x="{cx}" y="{y:.1f}" text-anchor="middle" font-size="9" '
                   f'fill="var(--muted)">{bins[i]}</text>')
    ky = h - 18
    out.append(f'<rect x="{cx - 74}" y="{ky - 9}" width="12" height="12" '
               f'fill="var(--accent)" opacity=".30"/>')
    out.append(f'<text x="{cx - 56}" y="{ky + 1}" font-size="10" fill="var(--muted)">2025</text>')
    out.append(f'<rect x="{cx + 4}" y="{ky - 9}" width="12" height="12" '
               f'fill="none" stroke="var(--ink)" stroke-width="1" opacity=".55"/>')
    out.append(f'<text x="{cx + 22}" y="{ky + 1}" font-size="10" fill="var(--muted)">2050</text>')
    return (f'<svg class="pop-pyr" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="年齢構成 2025年と2050年">'
            f'<title>年齢構成 2025年と2050年</title>{"".join(out)}</svg>')


def build_population():
    nat = POP_N
    n_munis = POP["meta"]["n"]

    def strip(key, value, unit=None):
        u = f'<small>{tr(unit)}</small>' if unit else ""
        return (f'<div><dt>{tr(key)}</dt>'
                f'<dd>{value}{u}</dd></div>')

    strip_html = "".join([
        strip("pop.strip.pop", n(nat["pop"]), "pop.unit.people"),
        strip("pop.strip.rate", sgn_pct(nat["rate"])),
        strip("pop.strip.munis", n(n_munis)),
        strip("pop.strip.age65", f'{nat["age65Share"]}%'),
        strip("pop.strip.hh", n(nat["households"]), "pop.unit.hh"),
        strip("pop.strip.foreign", n(nat["foreign"]), "pop.unit.people"),
        strip("pop.strip.proj", n(nat["pop2050"]), "pop.unit.people"),
        strip("pop.strip.density", f'{nat["density"]}', "pop.unit.km2"),
    ])

    prefs_sorted = sorted(POP["prefs"], key=lambda p: -p["pop"])
    rows = []
    for i, p in enumerate(prefs_sorted, 1):
        cls = "up" if (p["rate"] or 0) > 0 else "down"
        rows.append(
            f'<tr><td class="idx">{i:02d}</td><td class="name">{esc(p["name"])}</td>'
            f'<td class="num">{n(p["pop"])}</td>'
            f'<td class="num {cls}">{sgn_pct(p["rate"])}</td>'
            f'<td class="num">{p["age65Share"]}%</td>'
            f'<td class="num">{n(p["pop2050"])}</td>'
            f'<td class="num">{p["index2050"]}</td></tr>'
        )
    table = f"""<div class="pop-table-wrap"><table class="data-table">
<thead><tr><th class="idx">#</th><th>{tr('pop.table.th.pref')}</th>
<th class="num">{tr('pop.table.th.pop')}</th>
<th class="num">{tr('pop.table.th.change')}</th>
<th class="num">{tr('pop.table.th.age65')}</th>
<th class="num">{tr('pop.table.th.pop2050')}</th>
<th class="num">{tr('pop.table.th.index')}</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>"""

    pyramid = pop_pyramid_svg(POP)
    jsonld = dataset_node(
        "Japan population by municipality, 2025",
        "2025 Census population, households, age structure and IPSS 2050 projection for 1,719 municipalities.",
        "/population/",
        "https://www.e-stat.go.jp/stat-search/files?page=1&layout=datalist&lid=000001491012",
        [("/data/population.csv", "text/csv")],
        "2025-10-01/2050-10-01",
        "Japan",
        "https://www.e-stat.go.jp/terms-of-use",
        ["Population", "Households", "Age structure", "2050 IPSS projection"],
        extra_citations=("https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/t-page.asp",),
    )

    body = f"""<main id="main" class="pop-page">
<section class="pop-hero"><div class="wrap pop-hero-in">
<p class="pop-eyebrow">{tr('pop.eyebrow')}</p>
<h1 class="pop-h1">{tr('pop.h1')}</h1>
<p class="pop-lede">{tr('pop.lede')}</p>
<dl class="pop-strip">{strip_html}</dl>
</div></section>
<section class="wrap pop-read">
<div class="pop-read-head">
<p class="pop-read-eyebrow">{tr('pop.read.eyebrow')}</p>
<h2>{tr('pop.read.title')}</h2>
<p>{tr('pop.read.lede')}</p>
</div>
<ol class="pop-read-steps">
<li><span class="pop-read-num">01</span><b>{tr('pop.read.s1h')}</b><p>{tr('pop.read.s1p')}</p></li>
<li><span class="pop-read-num">02</span><b>{tr('pop.read.s2h')}</b><p>{tr('pop.read.s2p')}</p></li>
<li><span class="pop-read-num">03</span><b>{tr('pop.read.s3h')}</b><p>{tr('pop.read.s3p')}</p></li>
</ol>
<p class="pop-read-note">{tr('pop.read.note')}</p>
</section>
<section class="wrap pop-stage-wrap">
<div class="stage pop-stage" data-live="0" data-stage-auto="population" data-view="population">
<div class="stage-poster">{HP.population_svg(POP, T=plates(), lang=CUR)}</div>
<p class="stage-caption">{tr('pop.caption').format(n=n(POP["meta"]["n"]))}</p>
<div class="stage-live"></div>
</div>
</section>
<section class="wrap pop-section pop-pyramid">
<div class="pop-section-head"><h2>{tr('pop.pyramid.title')}</h2>
<p>{tr('pop.pyramid.lede')}</p></div>
<div class="pop-pyramid-grid">
<figure>{pyramid}
<figcaption class="pop-pyramid-note">{tr('pop.pyramid.note')}</figcaption>
</figure>
<dl class="pop-pyramid-stats">
<div class="pop-pyramid-stat"><dt>{tr('pop.pyramid.stat65')}</dt>
<dd>{nat['age65Share']}% <span>→</span> <em>{POP_2050_65}%</em></dd></div>
<div class="pop-pyramid-stat"><dt>{tr('pop.pyramid.stat0')}</dt>
<dd>{nat['age0Share']}% <span>→</span> <em>{POP_2050_0}%</em></dd></div>
<div class="pop-pyramid-stat"><dt>{tr('pop.pyramid.statpop')}</dt>
<dd><b>{tr('pop.pyramid.pop2025')}</b> <span>→</span> <em>{tr('pop.pyramid.pop2050')}</em></dd></div>
</dl>
</div>
</section>
<section class="wrap pop-section pop-table">
<div class="pop-section-head"><h2>{tr('pop.table.title')}</h2>
<p>{tr('pop.table.lede')}</p></div>
{table}
<p class="pop-table-note">{tr('pop.table.note')}</p>
</section>
<section class="wrap pop-section pop-method">
<div class="pop-section-head"><h2>{tr('pop.method.title')}</h2>
<p>{tr('pop.method.lede')}</p></div>
<div class="pop-method-grid">
<section><h3>{tr('pop.method.census.h')}</h3>
<p>{tr('pop.method.census.p')}</p></section>
<section><h3>{tr('pop.method.proj.h')}</h3>
<p>{tr('pop.method.proj.p')}</p></section>
<section><h3>{tr('pop.method.def.h')}</h3>
<p>{tr('pop.method.def.p')}</p></section>
<section><h3>{tr('pop.method.src.h')}</h3>
<p>{tr('pop.method.src.p')}</p></section>
<section><h3>{tr('pop.method.lic.h')}</h3>
<p>{tr('pop.method.lic.p')}</p></section>
</div>
<p class="pop-method-src">
<a href="https://www.stat.go.jp/data/kokusei/2025/index.html" rel="noopener">令和7年国勢調査</a> ·
<a href="https://www.e-stat.go.jp/stat-search/files?page=1&amp;layout=datalist&amp;lid=000001491012" rel="noopener">e-Stat</a> ·
<a href="https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/t-page.asp" rel="noopener">社人研</a> ·
<a href="https://www.gsi.go.jp/KOKUJYOHO/MENCHO-title.htm" rel="noopener">国土地理院</a>
</p>
</section>
</main>"""

    css = (SRC / "population.css").read_text(encoding="utf-8")
    return page("/population/", PAGE_META["population"][CUR][0],
                PAGE_META["population"][CUR][1], body, "population", jsonld,
                head_extra='<style>\n' + css + '\n</style>')


def fill_copy(s):
    return s.replace("{{B}}", str(N_BUCKETS)).replace("{{S}}", str(N_SINGLE))


# ---------------------------------------------------------------- main
def og_cards():
    """把预生成的 1200×630 卡片读进站点产物;缺一张就报错(绝不发半套 og:image)。

    卡片由 tools/make_og_cards.py 从本文件的语言模型生成(见该脚本),是构建输入,
    不是构建期渲染——线上构建机没有字体源,不该再压一份排版逻辑上去。
    """
    out, missing = {}, []
    for key in ("home", "weather", "quake", "crime", "cabinet", "housing", "population"):
        for lang in LANGS:
            f = ROOT / "assets" / "og" / f"{key}-{lang}.png"
            if not f.is_file():
                missing.append(f.name)
                continue
            out[f"/assets/og/{f.name}"] = f.read_bytes()
    if missing:
        raise SystemExit("og: 缺少卡片 " + ", ".join(sorted(missing)) +
                         " —— 跑 python tools/make_og_cards.py 重新生成")
    return out


def main():
    global CSS_VER, JS_VER, FONT_VER, WEATHER_VER
    files = {}

    # 天气快照的鲜度:JMA 的发表日不是今天时,页面会把昨天的数值当「今天」出(2026-11-04:
    # 一次手工部署把 11-03 的快照装进 11-04 的站点,线上 5 小时都在说假话)。所以这里
    # 永远把状态打出来;`PANOUT_REQUIRE_TODAY_WEATHER=1`(部署路径与日更流水线都设它)时
    # 直接失败,挡住「用旧数据部署」这条路。
    freshness = (
        f"weather: report {WEATHER_REPORT_DATE}, snapshot {WEATHER_SNAPSHOT_DATE}, "
        f"built {WEATHER_TODAY}"
    )
    if WEATHER_STALE:
        freshness += " — STALE: run `git pull` (the 06:10 JST job commits the current snapshot) and rebuild"
        print(freshness)
        if os.environ.get("PANOUT_REQUIRE_TODAY_WEATHER") == "1":
            raise SystemExit(
                f"weather: refusing to build a deployable site from the {WEATHER_REPORT_DATE} "
                f"snapshot while today is {WEATHER_TODAY} (PANOUT_REQUIRE_TODAY_WEATHER=1)"
            )
    else:
        print(freshness)

    # 繁体列由简体列转出:文案出现词表外的字时在这里报错,而不是悄悄漏转。
    hant.assert_covered([v[1] for v in COPY.values()] +
                        [PAGE_META[p]["zh-Hans"][i] for p in PAGE_META for i in (0, 1)],
                        where="COPY / PAGE_META 的简体文案")

    # 章节视图的 zh-Hant 词表(app/hant.js):表过期、手改、或文案新增了字,都在这里报错。
    view_i18n.check_all()

    weather_files = weather_assets()
    # The stamp is the runtime's content hash, so every release publishes fresh asset
    # URLs and can never be answered from an entry an older deployment filled.
    # `_headers` keeps these assets revalidating, so the stamp cannot pin a body.
    WEATHER_VER = hashlib.sha1(
        "".join(weather_files[k] for k in sorted(weather_files)).encode("utf-8")
    ).hexdigest()[:8]

    # 六章 + 封面,四语各一份真页面:ja 在 /<章>/,其余在 /zh-Hans/<章>/ 等。
    routes = [
        ("/", build_home_preview),
        ("/weather/", lambda: build_weather(WEATHER_VER)),
        ("/quake/", build_quake),
        ("/crime/", build_crime),
        ("/cabinet/", build_cabinet),
        ("/housing/", build_housing),
        ("/population/", build_population),
    ]
    for lang in LANGS:
        set_lang(lang)
        for route, build in routes:
            files[url_in(lang, route)] = build()
    set_lang("ja")

    # CF Pages 只认根目录的 404.html:它只有 ja 一份,内部链接也指 ja。
    files["/404.html"] = build_404()
    files["/preview/"] = build_preview_redirect()
    for name, content in weather_files.items():
        files[f"/assets/weather/{name}"] = content
    for path, content in og_cards().items():
        files[path] = content

    # 主题 token 消费自 sai-assets 的 ouuut-editorial 包(见 design-lock.json assets[]):
    # 包 type.css(字体族/版式刻度)+ 包 all.css(双模配色/和色六景)+ 本站专有覆盖。
    css = (PACKS / "ouuut-editorial" / "css" / "type.css").read_text(encoding="utf-8") + "\n" + \
          (PACKS / "ouuut-editorial" / "css" / "all.css").read_text(encoding="utf-8") + "\n" + \
          (SRC / "theme-overrides.css").read_text(encoding="utf-8") + "\n" + \
          (SRC / "app.css").read_text(encoding="utf-8")
    js = (SRC / "shell.js").read_text(encoding="utf-8")

    css_bytes = css.encode("utf-8")
    js_bytes = js.encode("utf-8")
    CSS_VER = hashlib.sha1(css_bytes).hexdigest()[:8]
    # The shell stamps its own ?v= onto every lazy /app/ module URL, so it must
    # change whenever any app code (view/vendor) changes, not just shell.js.
    # 章节样式表的内容哈希:外壳把 ?v= 打在模块 URL 上,若样式变了而模块字节没变,
    # 浏览器会拿旧 view.js(旧样式链接)当缓存,所以先把补丁写进参与哈希的字节里。
    HSG_CSS_VER = hashlib.sha1((ROOT / "app/housing/app.css").read_bytes()).hexdigest()[:8]
    app_code = b""
    for ap in sorted((ROOT / "app").rglob("*")):
        if ap.is_file() and "/data/" not in ap.as_posix() and ap.suffix in (".js", ".css"):
            b = ap.read_bytes()
            if ap.as_posix().endswith("app/housing/view.js"):
                b = b.replace(b'/app/housing/app.css"',
                              f'/app/housing/app.css?v={HSG_CSS_VER}"'.encode())
            app_code += b
    JS_VER = hashlib.sha1(js_bytes + app_code).hexdigest()[:8]

    # fonts first (needs the charset), then CSS can reference the version
    charset = collect_chars(files)
    font_meta = build_fonts(charset)
    FONT_VER = font_meta["ver"]
    css = css.replace("__FONT_VER__", FONT_VER)
    if font_meta.get("faces"):
        css = css.replace("/*__FONT_FACES__*/", font_meta["faces"])
    css_bytes = css.encode("utf-8")
    CSS_VER = hashlib.sha1(css_bytes).hexdigest()[:8]
    files["/assets/app.css"] = css
    files["/assets/shell.js"] = js

    # HTML was rendered before CSS_VER existed — patch placeholders now.
    for k, v in list(files.items()):
        if isinstance(v, str) and v.startswith("<!doctype html>"):
            files[k] = v.replace("__CSS_VER__", CSS_VER).replace("__JS_VER__", JS_VER) \
                        .replace("__FONT_VER__", FONT_VER)

    # GA4 闸:四条语言路由 × 7 页面 = 28 张静态页,每页恰好一段 gtag(由 head() 注入)。
    ga_bad = []
    for lang in LANGS:
        for route, _build in routes:
            path = url_in(lang, route)
            html = files[path]
            hits = html.count(f"gtag/js?id={GA_ID}") + html.count(f'gtag("config","{GA_ID}")')
            if hits != 2:
                ga_bad.append(f"{path}={hits}")
    if ga_bad:
        raise SystemExit(f"GA4: 28 页各须恰好一段 gtag(loader+config),异常:{', '.join(ga_bad)}")

    write_site(files)
    write_data()
    write_meta(font_meta)
    print("pages:", len(PAGES), "chars:", len(charset), "css:", CSS_VER, "js:", JS_VER)


def collect_chars(files):
    chars = set()
    for p, h in files.items():
        if isinstance(h, str):
            chars.update(h)
    for m in MUNI:
        chars.update(m["ward"])
    for c in CAB["cabinets"]:
        chars.update(c["pm"])
    for m in POP["munis"]:
        chars.update(m["name"])
    for p in POP["prefs"]:
        chars.update(p["name"])
    for p in POINTS:
        chars.update(p.get("n") or p.get("name") or "")
        chars.update(p.get("w") or "")
    try:
        c_poly = json.loads((ROOT / "app/crime/data/chome_poly.json").read_text(encoding="utf-8"))
        for f in c_poly.get("features", []):
            for val in f.get("properties", {}).values():
                if isinstance(val, str):
                    chars.update(val)
    except Exception:
        pass
    for y in YEARS:
        chars.update(y)
    # Interactive views carry their own Japanese/Chinese UI strings. Strip JS
    # comments first (the skill's lesson: comments alone can be 5x the visible
    # CJK), then feed every remaining string character into the subset.
    for js in (ROOT / "app").rglob("*.js"):
        if not js.is_file():
            continue
        try:
            src = js.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
        src = re.sub(r"(?m)//.*$", "", src)
        chars.update(src)
    # ASCII + common punctuation + arrows/units
    chars.update(chr(i) for i in range(32, 127))
    chars.update("　、。・「」『』（）—–…‰×÷±→←↑↓▶●○■□◆◇①②③④⑤⑥⑦⑧⑨⑩"
                 "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺")
    return "".join(sorted(c for c in chars if c.isprintable() or c in "\u3000"))


def build_fonts(charset):
    """Subset the faces the site needs.

    A failure here is loud on purpose: the typography is part of the design, and a
    silent skip ships a fontless site (no `@font-face`, `?v=0`) that still prints a
    successful build — which is what happened on 2026-11-03 when `src/build.py` ran
    without the `PANOUT_*` font sources in the environment. `verify_build()` in the
    refresh pipeline refuses to deploy such a build.
    """
    try:
        import fonts
        return fonts.build(charset, SITE / "assets/fonts", ROOT / ".cache/fonts")
    except Exception as e:
        print("fonts: SKIPPED — the built site would ship no @font-face and `?v=0`:", e)
        print("fonts: set PANOUT_LATIN_FONTS / PANOUT_SC_FONTS / PANOUT_OUTFIT_FONT (see src/fonts.py)")
        return {"ver": "0", "faces": ""}


def write_site(files):
    for path, content in files.items():
        if path.endswith("/"):
            dest = SITE / path.strip("/") / "index.html"
        else:
            dest = SITE / path.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        enc = content if isinstance(content, bytes) else content.encode("utf-8")
        dest.write_bytes(enc)

    # 退役文件:i18n.json(语言切换改成四语真页面后不再生成)不能跟着部署上去。
    for stale in (SITE / "assets" / "i18n.json",):
        if stale.is_file():
            stale.unlink()

    # A rebuild must not leave old routes behind. Keep assets, drop stale HTML.
    expected = set()
    for path in files:
        if path.endswith("/"):
            expected.add((path.strip("/") + "/index.html").lstrip("/"))
        else:
            expected.add(path.lstrip("/"))
    for f in SITE.rglob("*.html"):
        rel = f.relative_to(SITE).as_posix()
        if rel not in expected:
            f.unlink()
    for d in sorted([p for p in SITE.rglob("*") if p.is_dir()],
                    key=lambda p: len(p.parts), reverse=True):
        try:
            d.rmdir()
        except OSError:
            pass

    # app runtime (views + vendor + data) — copied verbatim
    for ch in ("quake", "crime", "cabinet", "housing", "population"):
        src = ROOT / "app" / ch
        dst = SITE / "app" / ch
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst,
                            ignore=shutil.ignore_patterns("__pycache__", "*.map"))

    # zh-Hant 转换表:view.js 的静态 import。URL 必须带版本(与 housing/app.css 同理),
    # 否则表改了浏览器还拿旧缓存,页面就退回简体。
    hantjs = ROOT / "app" / "hant.js"
    if hantjs.is_file():
        (SITE / "app").mkdir(parents=True, exist_ok=True)
        shutil.copy2(hantjs, SITE / "app" / "hant.js")
        hver = hashlib.sha1(hantjs.read_bytes()).hexdigest()[:8]
        for ch in ("quake", "crime", "cabinet", "housing", "population"):
            vp = SITE / "app" / ch / "view.js"
            if not vp.is_file():
                continue
            txt = vp.read_text(encoding="utf-8")
            txt = txt.replace('from "../hant.js"', f'from "../hant.js?v={hver}"')
            vp.write_text(txt, encoding="utf-8")

    # 章节样式表加内容哈希：Pages/浏览器会缓存无版本号的 URL，改色后仍旧图
    hv = SITE / "app" / "housing" / "view.js"
    hc = SITE / "app" / "housing" / "app.css"
    if hv.exists() and hc.exists():
        v = hashlib.sha1(hc.read_bytes()).hexdigest()[:8]
        txt = hv.read_text(encoding="utf-8")
        txt = txt.replace('/app/housing/app.css"', f'/app/housing/app.css?v={v}"')
        hv.write_text(txt, encoding="utf-8")

    # favicon
    fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
           f'<rect width="64" height="64" fill="#F5F3ED"/>'
           f'<text x="31" y="48" text-anchor="middle" font-family="Outfit,Helvetica,Arial,sans-serif" '
           f'font-weight="800" font-size="46" fill="#CD5545">J</text></svg>')
    (SITE / "assets/favicon.svg").write_text(fav, encoding="utf-8")


def write_data():
    d = SITE / "data"
    d.mkdir(parents=True, exist_ok=True)
    with (d / "quakes.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "lon", "lat", "depth_km", "mag", "place"])
        for x in sorted(Q, key=lambda r: r["time"]):
            w.writerow([x["time"], x["lon"], x["lat"], x["depthKm"], x["mag"], x["place"]])
    with (d / "crime.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ward", "chome", "pop", "total", "violent", "rough", "breakin",
                    "nonbreakin", "other", "rate_per_1000"])
        for p in sorted(POINTS, key=lambda r: (r["w"], r["n"])):
            pop = p.get("pop") or 0
            t = p.get("t") or 0
            w.writerow([p["w"], p["n"], pop, t, p.get("v", 0), p.get("r", 0),
                        p.get("bi", 0), p.get("nb", 0), p.get("o", 0),
                        f"{t / pop * 1000:.2f}" if pop else ""])
    with (d / "cabinet.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "pm", "value", "source", "kind"])
        for p in sorted(POLLS, key=lambda r: r["date"]):
            w.writerow([p["date"], p["pm"], p["value"], p["source"], p.get("kind", "")])
    # monthly means
    with (d / "cabinet-monthly.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["month", "mean", "n"])
        for ym in sorted(MONTH_MEAN):
            vs = [p["value"] for p in POLLS if p["date"][:7] == ym]
            w.writerow([ym, f"{sum(vs) / len(vs):.2f}", len(vs)])
    with (d / "weather.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["prefecture_ja", "prefecture_en", "weather_code", "today_high",
                    "today_low", "precip_prob", "week_start", "week_end", "summary_ja"])
        for r in WEATHER_REGIONS:
            week = r.get("week") or []
            w.writerow([r["nameJa"], r.get("nameEn", ""), r.get("weatherCode", ""),
                        r.get("today", {}).get("high", ""), r.get("today", {}).get("low", ""),
                        r.get("pop", ""), week[0]["date"] if week else "",
                        week[-1]["date"] if week else "", r.get("summaryJa", "")])
    with (d / "population.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["code", "prefecture", "municipality", "pop2025", "pop2020",
                    "change", "rate", "age65_share", "pop2050", "index2050",
                    "households", "foreign", "density"])
        for m in POP["munis"]:
            w.writerow([m["code"], m["pref"], m["name"], m["pop"], m["pop2020"],
                        m["change"], m["rate"], m["age65Share"],
                        m["pop2050"], m["index2050"], m["households"],
                        m["foreign"], m["density"]])


def write_meta(font_meta):
    # 每条路由 4 个 <loc>(四语各一),每条 <loc> 都带四语 xhtml:link + x-default。
    routes = []
    for rec in PAGES:
        if rec["path"] != "/404.html" and rec["path"] not in routes:
            routes.append(rec["path"])
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for route in routes:
        pri = "1.0" if route == "/" else ("0.8" if route.count("/") <= 2 else "0.5")
        alts = "".join(f'<xhtml:link rel="alternate" hreflang="{lang}" href="{u}"/>'
                       for lang, u in alternate_urls(route))
        alts += (f'<xhtml:link rel="alternate" hreflang="x-default" '
                 f'href="{SITE_URL + url_in("ja", route)}"/>')
        for lang in LANGS:
            sm.append(f"<url><loc>{SITE_URL + url_in(lang, route)}</loc>{alts}"
                      f"<lastmod>{BUILD_DATE}</lastmod><changefreq>weekly</changefreq>"
                      f"<priority>{pri}</priority></url>")
    sm.append("</urlset>")
    (SITE / "sitemap.xml").write_text("\n".join(sm), encoding="utf-8")

    (SITE / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE_URL, encoding="utf-8")

    (SITE / "_headers").write_text(
        "/*\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  X-Frame-Options: DENY\n"
        "  Permissions-Policy: geolocation=(), microphone=(), camera=()\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n"
        "\n"
        "/404.html\n"
        "  X-Robots-Tag: noindex\n"
        "\n"
        "# The site default is to revalidate, because a deployment switch is not atomic:\n"
        "# while the edge still answers from the previous deployment, a request for an\n"
        "# asset path returns the previous body. With a ?v= stamp under a long cache, that\n"
        "# stale body then stays pinned to the fresh URL for the whole max-age, so a fix\n"
        "# looks like it never applied and the page serves old data until the next stamp\n"
        "# (2026-11-03: the weather refresh was rolled back for exactly this). ETag keeps\n"
        "# revalidation at a 304, so the only cost is one conditional round trip.\n"
        "# Fingerprinted bytes are the single exception: a URL identifies them fully.\n"
        "/assets/fonts/*\n"
        "  ! Cache-Control\n"
        "  Cache-Control: public, max-age=31536000, immutable\n"
        "\n"
        "# The weather runtime is regenerated hourly, so it is the one place where a copy\n"
        "# reused without revalidation matters. `no-cache` would be the precise answer, and\n"
        "# the artifact serves it — but the production domain does not: the zone's browser\n"
        "# cache TTL rewrites the browser-facing value (our max-age=0 came back as\n"
        "# `public, max-age=14400, must-revalidate`, no-cache dropped, measured 2026-11-03),\n"
        "# and only the dashboard's Browser Cache TTL can change that. What keeps such a copy\n"
        "# honest is the ?v= stamp instead: it can only ever be the release that published it.\n"
        "# `! Cache-Control` 先清掉 `/*` 那条继承来的值:两层都命中时 Pages 是**追加**而不是覆盖,\n"
        "# 不写这一行线上会拿到 `public, max-age=0, must-revalidate, public, max-age=0, must-revalidate`。\n"
        "/assets/weather/*\n"
        "  ! Cache-Control\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n"
        "\n"
        "/data/*\n"
        "  ! Cache-Control\n"
        "  Cache-Control: public, max-age=86400\n", encoding="utf-8")

    # 尾斜杠 301:四条语言路由各一条,由 LANGS/PREFIX 推出,不再手抄路径。
    reds = []
    for route in ("/weather/", "/quake/", "/crime/", "/cabinet/", "/housing/", "/population/"):
        for lang in LANGS:
            full = url_in(lang, route)
            reds.append(f"{full.rstrip('/')} {full} 301")
    reds += ["/preview / 301", "/preview/ / 301"]
    (SITE / "_redirects").write_text("\n".join(reds) + "\n", encoding="utf-8")

    # 退役 `?lang=` 变体的 301 中间件:wrangler 认的是 **仓库根** 的 `functions/`
    # (不是 site/ 里的 —— Functions 目录按 cwd 解析,部署命令 `wrangler pages deploy site`
    # 从仓库根跑),所以它既不是 site/ 的产物,也不会被每次构建覆盖。这里只做存在性闸:
    # 文件被删掉时,`?lang=` 变体会静悄悄回到 200。
    mw = ROOT / "functions" / "_middleware.js"
    if not mw.is_file() or "Response.redirect(" not in mw.read_text(encoding="utf-8"):
        raise SystemExit("functions/_middleware.js 缺失或不完整 —— 退役 ?lang= 变体的 301 会失效")

    (SITE / "llms.txt").write_text(f"""# {BRAND}

> 日本を六つの尺度で見る静的データサイト。天気(仰いで見る)、地震(引いて見る)、犯罪(寄って見る)、内閣(通して見る)、住宅(並べて見る)、人口(数えて見る)の六章。

言語: ja(既定,パスは /weather/ など)、zh-Hans(/zh-Hans/…)、zh-Hant(/zh-Hant/…)、en(/en/…)。各ページは四語それぞれ静的生成。

- [天気](/weather/): 気象庁の予報、47都道府県。今日・明日と7日間、気温と降水確率。
- [地震](/quake/): 2000–{Q_END_DOT}、M4以上の震源{n(Q_N)}点。年別・月別・エネルギー。
- [犯罪](/crime/): 2025年、東京都内5,234町丁、62区市町村。人口あたりの率。
- [内閣](/cabinet/): 1998–2026、646調査、331か月、14内閣。
- [住宅](/housing/): 直近4四半期 2025Q2–2026Q1(2025年4月–2026年3月)、東京、中古マンション成約26,416件を町名(1,237町)ごとに平均したm2単価の地図。
- [人口](/population/): 2025年国勢調査、{POP['meta']['n']:,}市町村。91.2%が減少、73.4%が減少市町村に住む。2050年は社人研推計で{POP_N['pop2050']:,}人。CSV: /data/population.csv

Build: {BUILD_STAMP}. Sources: 気象庁, USGS ComCat, 警視庁, NHK, 日経, 朝日, 時事, 読売, JNN, 共同, 総務省統計局, 国立社会保障・人口問題研究所.
""", encoding="utf-8")


if __name__ == "__main__":
    main()
