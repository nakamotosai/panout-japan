#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_data v6: 2000-2026 全量官方 NHK 月度线
- 2000-01 ~ 2017-12: NHK放送文化研究所「政治意識月例調査」网页表格 (整数%)
  URL: https://www.nhk.or.jp/bunken/yoron/political/{year}.html (旧路径)
       https://www.nhk.or.jp/bunken/research/yoron/political/{year}.html (2016+)
- 2018-01 ~ 2026-07: NHK選挙WEB PDF (已有 data.json 里 source=NHK世論調査 的点, 小数)
- 官方缺月: 2011-03 (東日本大震災で調査打ち切り), 2019-10 / 2025-10 (NHK調査なし)
  → 多源按月平均设计: 补入中央調査報・時事世論調査同月真实值 (source=時事世論調査), 该月仅此1源则显示此值
- 换相月取新内阁発足值: 2008-09(緊), 2009-09(緊) 用緊急调查; bunken 网页 9月(緊) 列
"""

# 缺月补点: 中央調査報・時事世論調査 (crs.or.jp 归档 PDF, 真实官方调查)
# 设计=多源按月平均 (用户 2026-08-09 拍板): 每月所有已搜源的平均值, 缺月用其他源真实值补, 禁断线
# date = survey_start (铁律: 真实调查开始日, 禁当月15号假日期)
CRS_GAP_FILL = [
    {"date": "2011-03-04", "pm": "菅直人",     "value": 18.9, "url": "https://www.crs.or.jp/backno/pdf/No.642.pdf"},
    {"date": "2019-10-11", "pm": "安倍晋三(2次)", "value": 44.2, "url": "https://www.crs.or.jp/backno/pdf/No.745.pdf"},
    {"date": "2025-10-10", "pm": "石破茂",     "value": 25.1, "url": "https://www.crs.or.jp/backno/pdf/No.817.pdf"},
]
import json, os, re
from datetime import date
os.chdir(os.path.dirname(os.path.abspath(__file__)))

CABINETS = [
    {"id":"obuchi","pm":"小渕恵三","start":"1998-07-30","end":"2000-04-05"},
    {"id":"mori","pm":"森喜朗","start":"2000-04-05","end":"2001-04-26"},
    {"id":"koizumi","pm":"小泉純一郎","start":"2001-04-26","end":"2006-09-26"},
    {"id":"abe1","pm":"安倍晋三(1次)","start":"2006-09-26","end":"2007-09-26"},
    {"id":"fukuda","pm":"福田康夫","start":"2007-09-26","end":"2008-09-24"},
    {"id":"aso","pm":"麻生太郎","start":"2008-09-24","end":"2009-09-16"},
    {"id":"hatoyama","pm":"鳩山由紀夫","start":"2009-09-16","end":"2010-06-08"},
    {"id":"kan","pm":"菅直人","start":"2010-06-08","end":"2011-09-02"},
    {"id":"noda","pm":"野田佳彦","start":"2011-09-02","end":"2012-12-26"},
    {"id":"abe2","pm":"安倍晋三(2次)","start":"2012-12-26","end":"2020-09-16"},
    {"id":"suga","pm":"菅義偉","start":"2020-09-16","end":"2021-10-04"},
    {"id":"kishida","pm":"岸田文雄","start":"2021-10-04","end":"2024-10-01"},
    {"id":"ishiba","pm":"石破茂","start":"2024-10-02","end":"2025-10-21"},
    {"id":"takaichi","pm":"高市早苗","start":"2025-10-21","end":"2026-08-09"},
]
# 换相月: bunken 表格列顺序里 9月(緊) 额外列的位置 (2008, 2009)
# bunken 值: {year: [12 或 13 个月值]}, 13 值时索引8=9月常规, 9=9月(緊)
BUNKEN = json.load(open("_crs/nhk_bunken_full.json", encoding="utf-8"))

def pm_for(ym):
    d = date(int(ym[:4]), int(ym[5:7]), 15)
    for c in CABINETS:
        if c["start"] <= d.isoformat() <= c["end"]:
            return c["pm"]
    return None

polls = []
bunken_used = 0
for year in range(2000, 2018):
    vals = BUNKEN[str(year)]
    for mi, v in enumerate(vals, 1):
        if mi > 12:
            continue  # 13th cell (9月(緊)) handled below
        if not v or v in ("-", "&nbsp;"):
            continue
        ym = f"{year}-{mi:02d}"
        pm = pm_for(ym)
        if pm is None:
            continue
        # 2008/2009 9月: use 緊急调查 (new cabinet) instead of regular
        if (year, mi) == (2008, 9) and len(vals) > 12 and vals[9]:
            v = vals[9]
        if (year, mi) == (2009, 9) and len(vals) > 12 and vals[9]:
            v = vals[9]
        polls.append({
            "date": ym + "-15",
            "pm": pm,
            "value": float(v),
            "source": "NHK世論調査",
            "url": f"https://www.nhk.or.jp/bunken/research/yoron/political/{year}.html" if year >= 2016 else f"https://www.nhk.or.jp/bunken/yoron/political/{year}.html",
            "derived": False,
            "kind": "月次",
        })
        bunken_used += 1

# 2018-2026: take NHK世論調査 points from previous data.json (ONE PDF, decimals)
old = json.load(open("_crs/data_v5.1_backup.json", encoding="utf-8"))
one_used = 0
seen = set()
for p in old["polls"]:
    if p.get("source") == "NHK世論調査" and p["date"][:4] >= "2018":
        key = p["date"][:7]
        if key in seen:
            continue
        seen.add(key)
        p = dict(p)
        p["pm"] = pm_for(key)
        polls.append(p)
        one_used += 1

# 缺月补点: 中央調査報・時事世論調査 (真实调查, 多源按月平均设计的组成部分)
crs_used = 0
for g in CRS_GAP_FILL:
    polls.append({
        "date": g["date"],
        "pm": g["pm"],
        "value": g["value"],
        "source": "時事世論調査",
        "url": g["url"],
        "derived": False,
        "kind": "月次",
    })
    crs_used += 1

polls.sort(key=lambda p: p["date"])

# continuity check
months = set(p["date"][:7] for p in polls)
gaps = []
y, m = 2000, 1
while (y, m) <= (2026, 7):
    ym = f"{y}-{m:02d}"
    if ym not in months:
        gaps.append(ym)
    m += 1
    if m > 12:
        m = 1
        y += 1

meta = {
    "version": "7.0-multi-source-monthly-avg",
    "description": "日本内閣支持率 2000→ 月度线 (多源按月平均): NHK放送文化研究所 2000-2017 (整数) + NHK選挙WEB PDF 2018-2026 (小数) + 缺月中央調査報・時事世論調査 (2011-03/2019-10/2025-10)。每月=当月所有已搜源真实调查值的算术平均, 禁断线",
    "real_source_count": len(polls),
    "derived_count": 0,
    "official_gaps": [],
    "note": "v7: 设计=多源按月平均 (用户2026-08-09拍板: 某月3家=3家平均, 1家=显示此值, 上限9家=9家平均; 目标每月都有数据不断线; 换相月按调查日分辨新旧首相)。当前源集=NHK世論調査+時事世論調査(3点), 其余媒体线后续补。",
}

data = {"_meta": meta, "cabinets": CABINETS, "polls": polls}
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

print(f"OK polls={len(polls)} bunken={bunken_used} one={one_used} crs={crs_used}")
print(f"official_gaps={meta['official_gaps']}")
print(f"unexpected_gaps={gaps}")
from collections import Counter
years = Counter(p['date'][:4] for p in polls)
print("by year:", dict(sorted(years.items())))
print(f"file={os.path.getsize('data.json')}B")
