#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build.py — render the japan.ouuut.com site into site/.

Single source of truth:
  app/quake/data/*      USGS hypocentres + coastline
  app/crime/data/*      Tokyo chome counts + polygons + population
  app/cabinet/data.json polls + cabinets
  app/housing/data/*   Tokyo 23-ward used-flat mean prices (MLIT) + ward polygons
  src/*.css, src/shell.js

Output: pre-rendered pages + assets + CSV + sitemap + headers.
"""
import csv
import hashlib
import html
import json
import math
import re
import shutil
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import svgkit as S
import home_plates as HP

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SRC = ROOT / "src"
WEATHER_SRC = SRC / "weather"
SITE_URL = "https://japan.ouuut.com"
BRAND = "japan.ouuut.com"
# 六色字标：只有 ouuut 五个字母和第二个点吃六色，japan / com 保持墨色，
# 这样字标还是一句话，而不是一道彩虹。顺序与站点六章一致（青磁→紫）。
SIX = ("--c-weather", "--c-quake", "--c-crime", "--c-cabinet", "--c-housing", "--c-population")
WM_COLOUR = {6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5}


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
        out.append(f"<span{hide}{style}>{ch}</span>")
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

# 每页三语 title/description：静态 HTML 里只有 ja，shell 在切语言时替换 head
PAGE_META = {
    "home": {
        "ja": (f"{BRAND} — 日本を、六つの尺度で見る",
               f"{f"{Q_N:,}"}の震源、5,234の町丁、331か月の内閣支持率、23区の住宅価格、47都道府県の天気、1,719市町村の人口。六つの尺度、六つの入口から直接起動する。"),
        "zh": (f"{BRAND} — 用六个尺度看日本",
               f"{f"{Q_N:,}"} 个震源、5,234 个町丁、331 个月的內閣支持率、23 区住宅价格、47 个都道府县的天气、1,719 个市町村的人口。六个尺度，六个入口直接启动。"),
        "en": (f"{BRAND} — Japan in six scales",
               f"{f"{Q_N:,}"} hypocentres, 5,234 neighbourhoods, 331 months of cabinet approval, 23-ward housing prices, 47-prefecture weather and 1,719 municipalities of population. Six scales; six entry points."),
    },
    "quake": {
        "ja": (f"地震 — {f"{Q_N:,}"}の震源 | {BRAND}",
               f"2000年から{Q_END_JA}までのM4以上震源{f"{Q_N:,}"}点。年別・月別・深さ・エネルギーで見る。"),
        "zh": (f"地震 — {f"{Q_N:,}"} 个震源 | {BRAND}",
               f"2000 年至 {Q_END_JA}，M4 以上震源 {f"{Q_N:,}"} 点。按年份、月份、深度与能量查看。"),
        "en": (f"Earthquakes — {f"{Q_N:,}"} hypocentres | {BRAND}",
               f"{f"{Q_N:,}"} M4+ hypocentres from 2000 to {Q_END_JA}. By year, month, depth and energy."),
    },
    "crime": {
        "ja": (f"犯罪 — 5,234の町丁 | {BRAND}",
               "2025年の東京都内5,234町丁の認知件数。人口あたりの率で62区市町村を並べる。"),
        "zh": (f"犯罪 — 5,234 个町丁 | {BRAND}",
               "2025 年东京都内 5,234 个町丁的立案数，按人均发案率排列 62 个区市町村。"),
        "en": (f"Crime — 5,234 neighbourhoods | {BRAND}",
               "Recorded offences for 5,234 neighbourhoods across Tokyo in 2025, ranked per capita across 62 municipalities."),
    },
    "cabinet": {
        "ja": (f"内閣 — 331か月の支持率 | {BRAND}",
               "1998年から2026年までの内閣支持率646調査。月次平均331か月、14内閣。"),
        "zh": (f"内阁 — 331 个月的支持率 | {BRAND}",
               "1998 年至 2026 年的 646 次内阁支持率调查，月度均值 331 个月、14 届内阁。"),
        "en": (f"Cabinet — 331 months of approval | {BRAND}",
               "646 approval polls from 1998 to 2026: 331 monthly means across 14 cabinets."),
    },
    "housing": {
        "ja": (f"住宅 — 町名の価格 | {BRAND}",
               "東京の中古マンション成約価格。直近4四半期（2025Q2–2026Q1）を町名（地区名）ごとの平均㎡単価で塗った地図。国交省データを加工。"),
        "zh": (f"住宅 — 町名房价 | {BRAND}",
               "东京二手房成交价：把最近四个季度（2025Q2–2026Q1）按町名的平均㎡单价涂成地图，数据来自国土交通省。"),
        "en": (f"Housing — town-level prices | {BRAND}",
               "Closed condo prices in Tokyo for the latest four quarters (2025Q2–2026Q1), mapped as mean price per m² by town. Derived from MLIT data."),
    },
    "weather": {
        "ja": (f"天気 — 日本の47都道府県 | {BRAND}",
               "気象庁の予報から、47都道府県の今日・明日と7日間の天気、気温、降水確率を見る。"),
        "zh": (f"天气 — 日本47都道府县 | {BRAND}",
               "来自日本气象厅的预报：47 个都道府县的今天、明天与未来七天天气、气温和降水概率。"),
        "en": (f"Weather — Japan’s 47 prefectures | {BRAND}",
               "JMA forecasts for all 47 prefectures: today, tomorrow and the next seven days, with temperatures and precipitation probability."),
    },
    "404": {
        "ja": (f"404 — この頁は、ない | {BRAND}", "このURLには頁がありません。表紙または五つの章から辿り直せます。"),
        "zh": (f"404 — 这一页不存在 | {BRAND}", "这个网址没有对应页面。可以回到首页或五个章节。"),
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
    "zh": (f"人口 — {POP['meta']['n']:,} 个市町村的现在 | {BRAND}",
           f"2025 年国势调查。{POP_N['pop']:,} 人、{POP['meta']['n']:,} 个市町村。"
           f"{100 * POP_N['declining'] / POP['meta']['n']:.1f}% 的市町村在减少，"
           f"{POP_N['decliningShare']}% 的人住在减少的市町村。2050 年为 {POP_N['pop2050']:,} 人。"),
    "en": (f"Population — {POP['meta']['n']:,} municipalities | {BRAND}",
           f"2025 census: {POP_N['pop']:,} people across {POP['meta']['n']:,} municipalities. "
           f"{100 * POP_N['declining'] / POP['meta']['n']:.1f}% of municipalities are shrinking; "
           f"{POP_N['decliningShare']}% of people live in them. {POP_N['pop2050']:,} by 2050."),
}
_weather_raw = (WEATHER_SRC / "data.js").read_text(encoding="utf-8")
WEATHER_DOC = json.loads(_weather_raw.split("=", 1)[1].rstrip().rstrip(";"))
WEATHER_REGIONS = WEATHER_DOC["regions"]

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

CAB_BUCKETS = defaultdict(int)
for p in POLLS:
    CAB_BUCKETS[(p["pm"], p["date"][:7])] += 1
N_BUCKETS = len(CAB_BUCKETS)
N_SINGLE = sum(1 for v in CAB_BUCKETS.values() if v == 1)

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
    "card.cabinet.claim": ("最大の月変動は+20.5。",
                           "最大单月 +20.5。",
                           "Largest swing +20.5."),
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
    "q.beat1.p": ("2011年は件数で14.6%、エネルギーでは86.7%。同じ年でも、数える尺度を変えると景色が変わる。",
                  "2011年按件数占14.6%，按能量占86.7%。同一年，换一种计量，风景就变了。",
                  "2011 holds 14.6% of events and 86.7% of energy. Change the measure and the picture changes."),
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

    "b.stat.polls": ("調査", "调查", "Polls"),
    "b.stat.months": ("月", "月", "Months"),
    "b.stat.cabinets": ("内閣", "内阁", "Cabinets"),
    "b.stat.swing": ("最大月変動", "最大单月变动", "Largest swing"),
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
    "d.year.note": ("USGS ComCat、M4以上、日本周辺。2026年は7月15日まで。",
                    "USGS ComCat，M4以上，日本周边。2026年截至7月15日。",
                    "USGS ComCat, M4+, Japan region. 2026 through 15 July."),
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

    "foot.built": ("静的生成", "静态生成", "Statically generated"),
}


def ja(key):
    return COPY[key][0]


def tattr(key):
    return f' data-t="{key}"'


PAGES = []
CSS_VER = "__CSS_VER__"
JS_VER = "__JS_VER__"
FONT_VER = "__FONT_VER__"


def head(title, desc, path, jsonld=None, extra_head="", body_class="", chapter=""):
    is_404 = path == "/404.html"
    u = SITE_URL + ("/" if is_404 else path)
    alts = "".join(
        f'<link rel="alternate" hreflang="{code}" href="{u}{"" if code == "ja" else "?lang=" + code}">'
        for code in ("ja", "zh", "en"))
    alts += f'<link rel="alternate" hreflang="x-default" href="{u}">'
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
    boot = ("<script>try{var d=document.documentElement;d.classList.add('js');"
            "var t=null;try{t=localStorage.getItem('pj-theme')}catch(e){}"
            "if(t!=='sage'&&t!=='dark'){var h=new Date().getHours();t=(h>=6&&h<18)?'sage':'dark';}"
            "d.dataset.theme=t;"
            "var l=null;try{l=(new URLSearchParams(location.search)).get('lang')}catch(e){}"
            "if(l!=='ja'&&l!=='zh'&&l!=='en'){try{l=localStorage.getItem('pj-lang')}catch(e){l=null}}"
            "if(l==='ja'||l==='zh'||l==='en')d.lang=l;"
            "}catch(e){}</script>")
    return f"""<!doctype html>
<html lang="ja" data-theme="sage"{f' data-chapter="{chapter}"' if chapter else ""}>
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
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#F5F3ED">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/outfit-800.woff2?v=__FONT_VER__" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css?v=__CSS_VER__">
{boot}
{ld}
{extra_head}
</head>
<body{body_class}>
<a class="skip" href="#main"{tattr('skip')}>{ja('skip')}</a>
<div class="grain" aria-hidden="true"></div>
<div class="scroll-progress" aria-hidden="true"></div>
"""


THEME_DOTS = """<button class="theme-toggle" type="button" data-theme-toggle aria-label="切换配色" title="切换配色" hidden>
<svg class="theme-icon" viewBox="0 0 16 16" aria-hidden="true">
<g class="icon-sun" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="3"></circle><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13"></path></g>
<path class="icon-moon" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M13 9.7A5.5 5.5 0 0 1 6.3 3a5.5 5.5 0 1 0 6.7 6.7Z"></path>
</svg>
</button>"""

LANG_SWITCH = """<div class="lang-switch" data-lang-switch>
<button class="lang-btn" type="button" aria-expanded="false"><span class="sr-only" data-t="ui.lang">语言</span><span data-lang-current lang="ja">日本語</span><svg class="lang-caret" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3 4 5.5 6.5 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path></svg></button>
<div class="lang-menu">
<button type="button" data-lang="ja" lang="ja" aria-current="true">日本語</button>
<button type="button" data-lang="zh" lang="zh" aria-current="false">中文</button>
<button type="button" data-lang="en" lang="en" aria-current="false">EN</button>
</div>
</div>"""


def mast(active=""):
    def link(href, key, ch):
        cur = ' aria-current="page"' if ch == active else ""
        return f'<a href="{href}"{cur}{tattr(key)}>{ja(key)}</a>'

    return f"""<header class="masthead"><div class="wrap masthead-in">
<a class="wordmark wordmark-cycle" href="/" aria-label="{BRAND}">{animated_wordmark()}</a>
<nav class="chapters" aria-label="Chapters">
{link('/weather/', 'nav.weather', 'weather')}
{link('/quake/', 'nav.quake', 'quake')}
{link('/crime/', 'nav.crime', 'crime')}
{link('/cabinet/', 'nav.cabinet', 'cabinet')}
{link('/housing/', 'nav.housing', 'housing')}
{link('/population/', 'nav.population', 'population')}
</nav>
<div class="tools">
{THEME_DOTS}
{LANG_SWITCH}
<button class="burger" type="button" data-burger aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu"><span></span><span></span></button>
</div>
</div></header>
<div class="mobile-menu" id="mobile-menu">
<nav class="mobile-nav-links" aria-label="Chapters">
{link('/weather/', 'nav.weather', 'weather')}
{link('/quake/', 'nav.quake', 'quake')}
{link('/crime/', 'nav.crime', 'crime')}
{link('/cabinet/', 'nav.cabinet', 'cabinet')}
{link('/housing/', 'nav.housing', 'housing')}
{link('/population/', 'nav.population', 'population')}
</nav>
<div class="mobile-foot">
{LANG_SWITCH}
{THEME_DOTS}
</div>
</div>
"""


def shell_tail():
    return '<script src="/assets/shell.js?v=__JS_VER__" defer></script>\n</body></html>'


def foot():
    return f"""<footer class="foot hp-foot"><div class="wrap foot-in">
<div class="foot-top"><a class="wordmark" href="/" aria-label="{BRAND}">{WM}</a></div>
<div class="foot-bottom">
<span><a href="https://creativecommons.org/licenses/by/4.0/" rel="license">CC BY 4.0</a> · <span{tattr('foot.built')}>{ja('foot.built')}</span> · {BUILD_DATE}</span>
</div>
</div></footer>
{shell_tail()}"""


def page(path, title, desc, body, active="", jsonld=None, register=True, head_extra="", fullscreen=False):
    body = body.replace('<table class="data-table">', '<div class="table-scroll"><table class="data-table">')
    body = body.replace('</table>', '</table></div>')
    body_class = ' class="chapter-app"' if fullscreen else ''
    html_doc = head(title, desc, path, jsonld, head_extra, body_class, active) + mast(active) + body
    html_doc += shell_tail() if fullscreen else foot()
    if register:
        PAGES.append((path, title, desc))
    return html_doc


def stats(items):
    out = ['<dl class="stats rv">']
    for label_key, value, unit in items:
        u = f"<small>{esc(unit)}</small>" if unit else ""
        out.append(f'<div><dt{tattr(label_key)}>{ja(label_key)}</dt>'
                   f'<dd>{value}{u}</dd></div>')
    out.append("</dl>")
    return "".join(out)


def pager(prev_href, prev_label, next_href, next_label):
    a = f'<a href="{prev_href}">← {esc(prev_label)}</a>' if prev_href else "<span></span>"
    b = f'<a href="{next_href}">{esc(next_label)} →</a>' if next_href else "<span></span>"
    return f'<nav class="pager">{a}<span class="spacer"></span>{b}</nav>'


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
         HP.weather_svg(OUTLINE)),
        ("quake", "02", "/quake/", "card.quake.title", "nav.quake", n(Q_N),
         "card.quake.unit", "card.quake.claim", "card.quake.source",
         HP.quake_svg(Q, OUTLINE, YEARS)),
        ("crime", "03", "/crime/", "card.crime.title", "nav.crime", "5,234",
         "card.crime.unit", "card.crime.claim", "card.crime.source",
         HP.crime_svg(POINTS, MUNI_POLY, WARD_RATE)),
        ("cabinet", "04", "/cabinet/", "card.cabinet.title", "nav.cabinet", "331",
         "card.cabinet.unit", "card.cabinet.claim", "card.cabinet.source",
         HP.cabinet_svg(ALL_MONTHS, MONTH_MEAN, CAB)),
        ("housing", "05", "/housing/", "card.housing.title", "nav.housing", f"{HOUSE['totals']['trades']:,}",
         "card.housing.unit", "card.housing.claim", "card.housing.source",
         HP.housing_svg(HOUSE_WARDS, MUNI_POLY, deals=HOUSE_N, towns=HOUSE_TOWNS)),
        ("population", "06", "/population/", "card.population.title", "card.population.topic",
         "", "card.population.unit", "card.population.claim",
         "card.population.source", HP.population_svg(POP)),
    ]

    entries = []
    for key, num, href, verb, topic, count, unit, claim, source_key, svg in rows:
        foot = f'<span class="hp-enter"><span data-t="prod.open">{ja("prod.open")}</span> ↗</span>'
        count_html = (f'<b data-t="card.population.count">{ja("card.population.count")}</b>'
                      if key == "population" else f"<b>{count}</b>")
        card = f"""<div class="hp-entry-head"><span class="hp-num">{num}</span><span class="hp-verb" data-t="{verb}">{ja(verb)}</span><span class="hp-topic" data-t="{topic}">{ja(topic)}</span></div>
<div class="hp-entry-visual" aria-hidden="true"><div class="hp-plate">{svg}</div></div>
<div class="hp-entry-body">
<p class="hp-count">{count_html}<small data-t="{unit}">{ja(unit)}</small></p>
<p class="hp-claim" data-t="{claim}">{ja(claim)}</p>
<div class="hp-entry-foot"><span class="hp-source" data-t="{source_key}">{ja(source_key)}</span>{foot}</div>
</div>"""
        entries.append(f'<a class="hp-entry" data-chapter="{key}" href="{href}">\n{card}\n</a>')

    source_items = []
    for key in ("weather", "quake", "crime", "cabinet", "housing", "population"):
        source_items.append(
            f'<article class="hp-source-item"><h3><span data-t="home.{key}.title">{ja(f"home.{key}.title")}</span>'
            f'<span aria-hidden="true">—</span><a href="/{key}/"><span data-t="home.{key}.source">{ja(f"home.{key}.source")}</span> ↗</a></h3>'
            f'<p data-t="home.{key}.copy">{ja(f"home.{key}.copy")}</p></article>'
        )

    body = f"""<main id="main" class="hp">
<section class="wrap hp-band hp-live" aria-label="Chapters">
{''.join(entries)}
</section>
<section class="wrap hp-statement" aria-labelledby="home-statement-title">
<h1 id="home-statement-title" data-t="cover.title">{ja('cover.title')}</h1>
<div class="hp-author">
<div class="hp-author-intro">
<p class="hp-author-role" data-t="author.role">{ja('author.role')}</p>
<p class="hp-author-name">中本蔡 <span lang="en">NAKAMOTO SAI</span></p>
<p class="hp-author-bio" data-t="author.bio">{ja('author.bio')}</p>
</div>
<nav class="hp-author-links" aria-label="Author and contact links" data-t-aria="author.links">
<a href="https://ouuut.com/"><strong>ouuut.com</strong><small data-t="author.projects">{ja('author.projects')}</small><span aria-hidden="true">↗</span></a>
<a href="https://saaaai.com/"><strong>saaaai.com</strong><small data-t="author.personal">{ja('author.personal')}</small><span aria-hidden="true">↗</span></a>
<div class="hp-author-contact">
<span class="hp-author-contact-label" data-t="author.contact">{ja('author.contact')}</span>
<a href="mailto:sai@saaaai.com">sai@saaaai.com</a>
<a href="https://x.com/saaaaicom" rel="me">X <span class="hp-author-handle">@saaaaicom</span></a>
</div>
</nav>
</div>
</section>
<section class="wrap hp-provenance" aria-labelledby="method-title">
<div class="hp-provenance-panel">
<div class="hp-provenance-intro">
<p class="hp-kicker">PRIMARY SOURCES / STATIC BUILD</p>
<h2 id="method-title" data-t="m.h1">{ja('m.h1')}</h2>
<p class="hp-provenance-lede" data-t="home.c.lede">{ja('home.c.lede')}</p>
</div>
<div class="hp-provenance-content">
<details class="hp-sources" open>
<summary data-t="home.details">{ja('home.details')}</summary>
<div class="hp-sources-body">
<div class="hp-sources-list">{''.join(source_items)}</div>
<div class="hp-definitions">
<h3 data-t="home.definitions">{ja('home.definitions')}</h3>
<p data-t="home.definitions.copy">{ja('home.definitions.copy')}</p>
<p data-t="home.compiled">{ja('home.compiled')}</p>
</div>
</div>
</details>
</div>
</div>
</section>
</main>"""

    jsonld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Organization", "@id": SITE_URL + "/#organization", "name": "ouuut",
         "url": "https://ouuut.com/", "sameAs": ["https://x.com/saaaaicom"]},
        {"@type": "WebSite", "@id": SITE_URL + "/#website", "name": BRAND, "url": SITE_URL + "/",
         "inLanguage": ["ja", "zh", "en"],
         "publisher": {"@id": SITE_URL + "/#organization"}},
    ]}
    return page("/", PAGE_META["home"]["ja"][0], PAGE_META["home"]["ja"][1],
                body, "", jsonld, register=True,
                head_extra='<style>\n' + css + '\n</style>')


def build_404():
    links = "".join(f'<li><a href="/{key}/" data-t="nav.{key}">{ja(f"nav.{key}")}</a></li>'
                    for key in ("weather", "quake", "crime", "cabinet", "housing", "population"))
    body = f'''<main id="main" class="cover"><div class="wrap">
<p class="eyebrow" data-t="nf.code">404</p>
<h1 data-t="nf.h1">{ja("nf.h1")}</h1>
<p class="lede" data-t="nf.p">{ja("nf.p")}</p>
<nav aria-label="Chapters"><ul>{links}</ul></nav>
<div class="hero-actions">
<a class="btn-primary" href="/" data-t="nf.home">{ja("nf.home")}</a>
<a href="mailto:sai@saaaai.com" data-t="author.contact">{ja("author.contact")}</a>
</div>
</div></main>'''
    return page("/404.html", PAGE_META["404"]["ja"][0], PAGE_META["404"]["ja"][1], body,
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
    """Weather runtime is shipped as static assets on a stable URL, not inlined.

    Deliberately no `?v=` stamp: while a deployment switch is in flight the edge can
    still answer an asset path from the previous deployment, so a freshly minted URL
    buys nothing and, under a long cache, pins the previous body to it (2026-11-03).
    These files are revalidated instead — see the `_headers` block in `write_meta()`.
    """
    return {
        "app.js": (WEATHER_SRC / "app.js").read_text(encoding="utf-8"),
        "data.js": (WEATHER_SRC / "data.js").read_text(encoding="utf-8"),
        "geo.js": (WEATHER_SRC / "geo.js").read_text(encoding="utf-8"),
        "weather.css": (WEATHER_SRC / "lab.css").read_text(encoding="utf-8"),
    }


def build_weather():
    def temp(v):
        return "—" if v is None or v == "" else f"{esc(v)}°"

    def pop_text(r):
        v = r.get("pop")
        return "—" if v is None else f"{esc(v)}%"

    rows = "".join(
        f'<tr><th scope="row">{esc(r["nameJa"])}</th>'
        f'<td>{esc(r.get("summaryJa") or "")}</td>'
        f'<td>{temp(r.get("today", {}).get("high"))} / {temp(r.get("today", {}).get("low"))}</td>'
        f'<td>{pop_text(r)}</td></tr>'
        for r in WEATHER_REGIONS
    )
    week = WEATHER_REGIONS[0]["week"]
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": "Japan weather forecast by prefecture",
        "description": "JMA short-range and seven-day forecasts for all 47 prefectures; a static snapshot, not live observations.",
        "temporalCoverage": f"{week[0]['date']}/{week[-1]['date']}",
        "spatialCoverage": "Japan (47 prefectures)",
        "creator": {"@type": "Organization", "name": "気象庁"},
        "isBasedOn": "https://www.jma.go.jp/bosai/forecast/",
        "url": SITE_URL + "/weather/",
    }
    body = f"""<main id="main" class="weather-lab">
<div class="wrap" id="weather-app"></div>
<noscript><section class="wrap weather-static-fallback">
<p class="micro">気象庁 / JMA</p>
<h1>日本の天気</h1>
<p class="muted">気象庁の予報を47都道府県ごとに整列しました。インタラクティブな地図はJavaScriptで動作します。</p>
<div class="table-scroll"><table><thead><tr><th>都道府県</th><th>天気</th><th>最高 / 最低</th><th>降水確率</th></tr></thead><tbody>{rows}</tbody></table></div>
</section></noscript>
</main>
<script src="/assets/weather/data.js" defer></script>
<script src="/assets/weather/geo.js" defer></script>
<script src="/assets/weather/app.js" defer></script>"""
    return page("/weather/", PAGE_META["weather"]["ja"][0], PAGE_META["weather"]["ja"][1],
                body, "weather", jsonld,
                head_extra='<link rel="stylesheet" href="/assets/weather/weather.css">')


def build_quake():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only"{tattr('q.h1')}>{ja('q.h1')}</h1>
<p class="sr-only"{tattr('q.lede')}>{ja('q.lede')}</p>
<div class="stage" data-live="0" data-stage-auto="quake" data-view="quake">
<div class="stage-poster">{quake_poster()}</div>
<p class="stage-caption">M4+ · {n(Q_N)} hypocentres · 2000–{Q_END_DOT} · USGS ComCat</p>
<div class="stage-live" id="v-quake-viewport"></div>
</div>
</main>"""
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": "Japan M4+ hypocentres 2000–2026",
        "description": "USGS ComCat hypocentres M4.0+ in the Japan region.",
        "temporalCoverage": "2000-01-01/2026-07-15",
        "spatialCoverage": "Japan region (122–150E, 20–50N)",
        "license": "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
        "creator": {"@type": "Organization", "name": "USGS"},
        "url": SITE_URL + "/quake/",
    }
    return page("/quake/", PAGE_META["quake"]["ja"][0], PAGE_META["quake"]["ja"][1],
                body, "quake", jsonld, fullscreen=True)


def build_crime():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only"{tattr('c.h1')}>{ja('c.h1')}</h1>
<p class="sr-only"{tattr('c.lede')}>{ja('c.lede')}</p>
<div class="stage stage-crime" data-live="0" data-stage-auto="crime" data-view="crime">
<div class="stage-poster">{crime_poster()}</div>
<p class="stage-caption">1 dot = 1 町丁 · 本土 {n(len([p for p in POINTS if p.get("lng") and 138.9 <= p["lng"] <= 139.96 and 35.46 <= p["lat"] <= 35.92]))} chome（島嶼部は枠外）· 2025 · 警視庁</p>
<div class="stage-live"></div>
</div>
</main>"""
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": "Tokyo crime by neighbourhood, 2025",
        "description": "Tokyo Metropolitan Police recorded incidents by chome, 2025.",
        "temporalCoverage": "2025",
        "spatialCoverage": "Tokyo",
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "creator": {"@type": "Organization", "name": "警視庁"},
        "url": SITE_URL + "/crime/",
    }
    return page("/crime/", PAGE_META["crime"]["ja"][0], PAGE_META["crime"]["ja"][1],
                body, "crime", jsonld, fullscreen=True)


def build_cabinet():
    series = [(ym[2:], v) for ym, v in sorted(MONTH_MEAN.items())]
    head_extra = """<link rel="preload" href="/app/cabinet/data.json" as="fetch" crossorigin>
<link rel="modulepreload" href="/app/cabinet/view.js">"""
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only"{tattr('b.h1')}>{ja('b.h1')}</h1>
<p class="sr-only"{tattr('b.lede')}>{ja('b.lede')}</p>
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
    <div class="cab-veil-text"{tattr('cab.loading')}>{ja('cab.loading')}</div>
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
</main>"""
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": "Japanese cabinet approval, 1998–2026",
        "description": "Monthly cabinet approval ratings aggregated from NHK, Nikkei, Asahi, Jiji, Yomiuri, JNN and Kyodo polls.",
        "temporalCoverage": "1998-07/2026-10",
        "spatialCoverage": "Japan",
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "url": SITE_URL + "/cabinet/",
    }
    return page("/cabinet/", PAGE_META["cabinet"]["ja"][0], PAGE_META["cabinet"]["ja"][1],
                body, "cabinet", jsonld, head_extra=head_extra, fullscreen=True)


def build_housing():
    body = f"""<main id="main" class="chapter-app-page">
<h1 class="sr-only"{tattr('h.h1')}>{ja('h.h1')}</h1>
<p class="sr-only"{tattr('h.lede')}>{ja('h.lede')}</p>
<div class="stage stage-housing" data-live="0" data-stage-auto="housing" data-view="housing">
<div class="stage-poster">{HP.housing_svg(HOUSE_WARDS, MUNI_POLY, 1000, 620, deals=HOUSE_N, towns=HOUSE_TOWNS)}</div>
<p class="stage-caption">中古マンション · 成約 {HOUSE_N:,}件 · {HOUSE['basis']}（直近4四半期） · 国土交通省</p>
<div class="stage-live"></div>
</div>
</main>"""
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": f"Tokyo — used flat mean prices by town, {HOUSE['basis']}",
        "description": "Mean closed price per town for used flats in Tokyo's 23 wards, derived from the MLIT Real Estate Information Library.",
        "temporalCoverage": "2025-04-01/2026-03-31",
        "spatialCoverage": "Tokyo 23 wards",
        "license": "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0",
        "creator": {"@type": "Organization", "name": "国土交通省 不動産情報ライブラリ"},
        "url": SITE_URL + "/housing/",
    }
    return page("/housing/", PAGE_META["housing"]["ja"][0], PAGE_META["housing"]["ja"][1],
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
        u = f'<small data-t="{unit}">{ja(unit)}</small>' if unit else ""
        return (f'<div><dt data-t="{key}">{ja(key)}</dt>'
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
<thead><tr><th class="idx">#</th><th data-t="pop.table.th.pref">{ja('pop.table.th.pref')}</th>
<th class="num" data-t="pop.table.th.pop">{ja('pop.table.th.pop')}</th>
<th class="num" data-t="pop.table.th.change">{ja('pop.table.th.change')}</th>
<th class="num" data-t="pop.table.th.age65">{ja('pop.table.th.age65')}</th>
<th class="num" data-t="pop.table.th.pop2050">{ja('pop.table.th.pop2050')}</th>
<th class="num" data-t="pop.table.th.index">{ja('pop.table.th.index')}</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>"""

    pyramid = pop_pyramid_svg(POP)
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset",
        "name": "Japan population by municipality, 2025",
        "description": "2025 Census population, households, age structure and IPSS 2050 projection for 1,719 municipalities.",
        "temporalCoverage": "2025-10-01/2050-10-01",
        "spatialCoverage": "Japan",
        "license": "https://www.e-stat.go.jp/terms-of-use",
        "creator": [{"@type": "Organization", "name": "総務省統計局"},
                    {"@type": "Organization", "name": "国立社会保障・人口問題研究所"}],
        "url": SITE_URL + "/population/",
    }

    body = f"""<main id="main" class="pop-page">
<section class="pop-hero"><div class="wrap pop-hero-in">
<p class="pop-eyebrow" data-t="pop.eyebrow">{ja('pop.eyebrow')}</p>
<h1 class="pop-h1" data-t="pop.h1">{ja('pop.h1')}</h1>
<p class="pop-lede" data-t="pop.lede">{ja('pop.lede')}</p>
<dl class="pop-strip">{strip_html}</dl>
</div></section>
<section class="wrap pop-read">
<div class="pop-read-head">
<p class="pop-read-eyebrow" data-t="pop.read.eyebrow">{ja('pop.read.eyebrow')}</p>
<h2 data-t="pop.read.title">{ja('pop.read.title')}</h2>
<p data-t="pop.read.lede">{ja('pop.read.lede')}</p>
</div>
<ol class="pop-read-steps">
<li><span class="pop-read-num">01</span><b data-t="pop.read.s1h">{ja('pop.read.s1h')}</b><p data-t="pop.read.s1p">{ja('pop.read.s1p')}</p></li>
<li><span class="pop-read-num">02</span><b data-t="pop.read.s2h">{ja('pop.read.s2h')}</b><p data-t="pop.read.s2p">{ja('pop.read.s2p')}</p></li>
<li><span class="pop-read-num">03</span><b data-t="pop.read.s3h">{ja('pop.read.s3h')}</b><p data-t="pop.read.s3p">{ja('pop.read.s3p')}</p></li>
</ol>
<p class="pop-read-note" data-t="pop.read.note">{ja('pop.read.note')}</p>
</section>
<section class="wrap pop-stage-wrap">
<div class="stage pop-stage" data-live="0" data-stage-auto="population" data-view="population">
<div class="stage-poster">{HP.population_svg(POP)}</div>
<p class="stage-caption">1,719市町村 · 2025年国勢調査 · 総務省統計局</p>
<div class="stage-live"></div>
</div>
</section>
<section class="wrap pop-section pop-pyramid">
<div class="pop-section-head"><h2 data-t="pop.pyramid.title">{ja('pop.pyramid.title')}</h2>
<p data-t="pop.pyramid.lede">{ja('pop.pyramid.lede')}</p></div>
<div class="pop-pyramid-grid">
<figure>{pyramid}
<figcaption class="pop-pyramid-note" data-t="pop.pyramid.note">{ja('pop.pyramid.note')}</figcaption>
</figure>
<dl class="pop-pyramid-stats">
<div class="pop-pyramid-stat"><dt data-t="pop.pyramid.stat65">{ja('pop.pyramid.stat65')}</dt>
<dd>{nat['age65Share']}% <span>→</span> <em>{POP_2050_65}%</em></dd></div>
<div class="pop-pyramid-stat"><dt data-t="pop.pyramid.stat0">{ja('pop.pyramid.stat0')}</dt>
<dd>{nat['age0Share']}% <span>→</span> <em>{POP_2050_0}%</em></dd></div>
<div class="pop-pyramid-stat"><dt data-t="pop.pyramid.statpop">{ja('pop.pyramid.statpop')}</dt>
<dd><b data-t="pop.pyramid.pop2025">{ja('pop.pyramid.pop2025')}</b> <span>→</span> <em data-t="pop.pyramid.pop2050">{ja('pop.pyramid.pop2050')}</em></dd></div>
</dl>
</div>
</section>
<section class="wrap pop-section pop-table">
<div class="pop-section-head"><h2 data-t="pop.table.title">{ja('pop.table.title')}</h2>
<p data-t="pop.table.lede">{ja('pop.table.lede')}</p></div>
{table}
<p class="pop-table-note" data-t="pop.table.note">{ja('pop.table.note')}</p>
</section>
<section class="wrap pop-section pop-method">
<div class="pop-section-head"><h2 data-t="pop.method.title">{ja('pop.method.title')}</h2>
<p data-t="pop.method.lede">{ja('pop.method.lede')}</p></div>
<div class="pop-method-grid">
<section><h3 data-t="pop.method.census.h">{ja('pop.method.census.h')}</h3>
<p data-t="pop.method.census.p">{ja('pop.method.census.p')}</p></section>
<section><h3 data-t="pop.method.proj.h">{ja('pop.method.proj.h')}</h3>
<p data-t="pop.method.proj.p">{ja('pop.method.proj.p')}</p></section>
<section><h3 data-t="pop.method.def.h">{ja('pop.method.def.h')}</h3>
<p data-t="pop.method.def.p">{ja('pop.method.def.p')}</p></section>
<section><h3 data-t="pop.method.src.h">{ja('pop.method.src.h')}</h3>
<p data-t="pop.method.src.p">{ja('pop.method.src.p')}</p></section>
<section><h3 data-t="pop.method.lic.h">{ja('pop.method.lic.h')}</h3>
<p data-t="pop.method.lic.p">{ja('pop.method.lic.p')}</p></section>
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
    return page("/population/", PAGE_META["population"]["ja"][0],
                PAGE_META["population"]["ja"][1], body, "population", jsonld,
                head_extra='<style>\n' + css + '\n</style>')


def fill_copy(s):
    return s.replace("{{B}}", str(N_BUCKETS)).replace("{{S}}", str(N_SINGLE))


# ---------------------------------------------------------------- main
def main():
    global CSS_VER, JS_VER, FONT_VER
    files = {}

    weather_files = weather_assets()

    # Six chapters: /weather/, /quake/, /crime/, /cabinet/, /housing/, /population/ (plus the cover).
    # /preview/ remains a tiny redirect for the old preview URL.
    files["/"] = build_home_preview()
    files["/404.html"] = build_404()
    files["/preview/"] = build_preview_redirect()
    files["/weather/"] = build_weather()
    files["/quake/"] = build_quake()
    files["/crime/"] = build_crime()
    files["/cabinet/"] = build_cabinet()
    files["/housing/"] = build_housing()
    files["/population/"] = build_population()
    for name, content in weather_files.items():
        files[f"/assets/weather/{name}"] = content

    # i18n dictionary (only the three languages; ja already in HTML)
    dic = {k: {"ja": fill_copy(v[0]), "zh": fill_copy(v[1]), "en": fill_copy(v[2])}
           for k, v in COPY.items()}
    for _pk, _pv in PAGE_META.items():
        dic[f"meta.{_pk}.title"] = {lg: _pv[lg][0] for lg in ("ja", "zh", "en")}
        dic[f"meta.{_pk}.desc"] = {lg: _pv[lg][1] for lg in ("ja", "zh", "en")}
    i18n_json = json.dumps(dic, ensure_ascii=False, separators=(",", ":"))
    i18n_ver = hashlib.sha1(i18n_json.encode("utf-8")).hexdigest()[:8]
    files["/assets/i18n.json"] = i18n_json

    css = (SRC / "tokens.css").read_text(encoding="utf-8") + "\n" + \
          (SRC / "app.css").read_text(encoding="utf-8")
    js = (SRC / "shell.js").read_text(encoding="utf-8").replace("__I18N_VER__", i18n_ver)

    css_bytes = css.encode("utf-8")
    js_bytes = js.encode("utf-8")
    CSS_VER = hashlib.sha1(css_bytes).hexdigest()[:8]
    # The shell stamps its own ?v= onto every lazy /app/ module URL, so it must
    # change whenever any app code (view/vendor) changes, not just shell.js.
    # 章节样式表的内容哈希：外壳把 ?v= 打在模块 URL 上，若样式变了而模块字节没变，
    # 浏览器会拿旧 view.js（旧样式链接）当缓存，所以先把补丁写进参与哈希的字节里。
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
    charset = collect_chars(files, i18n_json)
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

    write_site(files)
    write_data()
    write_meta(font_meta)
    print("pages:", len([p for p in PAGES]))
    print("css", CSS_VER, len(css_bytes), "js", JS_VER, len(js_bytes))
    print("charset", len(charset))


def collect_chars(files, i18n_json):
    chars = set()
    for p, h in files.items():
        if isinstance(h, str):
            chars.update(h)
    chars.update(i18n_json)
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
    try:
        import fonts
        return fonts.build(charset, SITE / "assets/fonts", ROOT / ".cache/fonts")
    except Exception as e:
        print("fonts: skipped", e)
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
    urls = [SITE_URL + p for p, _, _ in PAGES]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, _, _ in PAGES:
        if p == "/404.html":
            continue
        pri = "1.0" if p == "/" else ("0.8" if p.count("/") <= 2 else "0.5")
        sm.append(f"<url><loc>{SITE_URL}{p}</loc><lastmod>{BUILD_DATE}</lastmod>"
                  f"<changefreq>weekly</changefreq><priority>{pri}</priority></url>")
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
        "/data/*\n"
        "  Cache-Control: public, max-age=86400\n", encoding="utf-8")

    (SITE / "_redirects").write_text(
        "/weather /weather/ 301\n/quake /quake/ 301\n/crime /crime/ 301\n/cabinet /cabinet/ 301\n/housing /housing/ 301\n/population /population/ 301\n"
        "/preview / 301\n/preview/ / 301\n", encoding="utf-8")

    (SITE / "llms.txt").write_text(f"""# {BRAND}

> 日本を六つの尺度で見る静的データサイト。天気（仰いで見る）、地震（引いて見る）、犯罪（寄って見る）、内閣（通して見る）、住宅（並べて見る）、人口（数えて見る）の六章。

- [天気](/weather/): 気象庁の予報、47都道府県。今日・明日と7日間、気温と降水確率。
- [地震](/quake/): 2000–{Q_END_DOT}、M4以上の震源{n(Q_N)}点。年別・月別・エネルギー。
- [犯罪](/crime/): 2025年、東京都内5,234町丁、62区市町村。人口あたりの率。
- [内閣](/cabinet/): 1998–2026、646調査、331か月、14内閣。
- [住宅](/housing/): 直近4四半期 2025Q2–2026Q1（2025年4月–2026年3月）、東京、中古マンション成約26,416件を町名（1,237町）ごとに平均した㎡単価の地図。
- [人口](/population/): 2025年国勢調査、{POP['meta']['n']:,}市町村。91.2%が減少、73.4%が減少市町村に住む。2050年は社人研推計で{POP_N['pop2050']:,}人。CSV: /data/population.csv

Build: {BUILD_STAMP}. Sources: 気象庁, USGS ComCat, 警視庁, NHK, 日経, 朝日, 時事, 読売, JNN, 共同, 総務省統計局, 国立社会保障・人口問題研究所.
""", encoding="utf-8")


if __name__ == "__main__":
    main()
