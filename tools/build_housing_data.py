#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_housing_data.py — 生成 /housing/ 的区级房价统计与 23 区几何。

两种取数口径：
  1) --csv <path>   从国交省「不動産情報ライブラリ」下载的取引価格/成約価格 CSV 统计（离线、可复现）
  2) --api          用官方 API 拉取（需环境变量 REINFOLIB_API_KEY；构建机执行，key 不进前端）

统计口径（与 docs/housing-feasibility.md 一致）：
  中古マンション等 · 成約価格情報 · 面積 60–80㎡ · 各条 価格/面積 取中位数
  同时输出全区间的総額中位/平均，用于卡片上的对照数字。

用法：
  python tools/build_housing_data.py --csv .cache/housing-probe/tokyo_all.csv
  python tools/build_housing_data.py --api --from 2025Q2 --to 2026Q1
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import statistics as st
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "housing" / "data"

WARD_CODES = {
    "13101": "千代田区", "13102": "中央区", "13103": "港区", "13104": "新宿区",
    "13105": "文京区", "13106": "台東区", "13107": "墨田区", "13108": "江東区",
    "13109": "品川区", "13110": "目黒区", "13111": "大田区", "13112": "世田谷区",
    "13113": "渋谷区", "13114": "中野区", "13115": "杉並区", "13116": "豊島区",
    "13117": "北区", "13118": "荒川区", "13119": "板橋区", "13120": "練馬区",
    "13121": "足立区", "13122": "葛飾区", "13123": "江戸川区",
}
BAND_MIN, BAND_MAX = 60.0, 80.0
TYPE_USED = "中古マンション等"
CATEGORY_CLOSED = "成約価格情報"

SOURCE_JA = "国土交通省 不動産情報ライブラリ「不動産取引価格情報／成約価格情報」"
SOURCE_URL = "https://www.reinfolib.mlit.go.jp/"


def num(s):
    s = (s or "").strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def median(xs):
    return st.median(xs) if xs else None


def collect_csv(path: Path):
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit(f"cannot decode {path}")

    rows = list(csv.DictReader(io.StringIO(text)))
    q = defaultdict(list)          # ward -> [(price_yen, area)]
    periods = set()
    for r in rows:
        code = r.get("市区町村コード", "")
        if code not in WARD_CODES:
            continue
        if not (r.get("種類") or "").startswith(TYPE_USED):
            continue
        if r.get("価格情報区分") != CATEGORY_CLOSED:
            continue
        p, a = num(r.get("取引価格（総額）")), num(r.get("面積（㎡）"))
        if not p or not a or a <= 0:
            continue
        q[code].append((p, a))
        per = r.get("取引時期")
        if per:
            periods.add(per)
    return q, sorted(periods)


def collect_api(q_from: str, q_to: str):
    key = os.environ.get("REINFOLIB_API_KEY", "").strip()
    if not key:
        raise SystemExit("REINFOLIB_API_KEY is not set")
    y0, s0 = int(q_from[:4]), int(q_from[5])
    y1, s1 = int(q_to[:4]), int(q_to[5])
    seasons = []
    y, s = y0, s0
    while (y, s) <= (y1, s1):
        seasons.append((y, s))
        s += 1
        if s == 5:
            y, s = y + 1, 1
    out = defaultdict(list)
    base = "https://www.reinfolib.mlit.go.jp/ex-api/external/XIT001"
    for code in WARD_CODES:
        for y, s in seasons:
            url = f"{base}?year={y}&quarter={s}&city={code}&priceClassification=02"
            req = urllib.request.Request(url, headers={"Ocp-Apim-Subscription-Key": key,
                                                       "Accept-Encoding": "gzip"})
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    body = resp.read()
                    if resp.headers.get("Content-Encoding") == "gzip":
                        import gzip
                        body = gzip.decompress(body)
                    data = json.loads(body.decode("utf-8"))
            except urllib.error.HTTPError as e:
                if e.code == 404:      # 该区该季无数据：正常
                    continue
                raise
            for row in data.get("data", []):
                if not (row.get("Type") or "").startswith(TYPE_USED):
                    continue
                p, a = num(str(row.get("TradePrice"))), num(str(row.get("Area")))
                if not p or not a or a <= 0:
                    continue
                out[code].append((p, a))
            time.sleep(1.1)            # 官方要求间隔请求
    return out, f"{q_from}–{q_to}"


def summarise(q, periods):
    wards = []
    for code, name in WARD_CODES.items():
        rows = q.get(code, [])
        units = [p / a for p, a in rows]
        prices = [p / 1e4 for p, a in rows]
        band = [(p, a) for p, a in rows if BAND_MIN <= a <= BAND_MAX]
        band_units = [p / a for p, a in band]
        band_prices = [p / 1e4 for p, a in band]
        wards.append({
            "code": code,
            "ward": name,
            "n": len(rows),
            "unit": round(median(units)) if units else None,
            "unit_mean": round(st.mean(units)) if units else None,
            "total_med": round(median(prices)) if prices else None,
            "total_mean": round(st.mean(prices)) if prices else None,
            "band": {
                "n": len(band),
                "unit": round(median(band_units)) if band_units else None,
                "unit_mean": round(st.mean(band_units)) if band_units else None,
                "total_med": round(median(band_prices)) if band_prices else None,
                "total_mean": round(st.mean(band_prices)) if band_prices else None,
                "p70": round(median(band_units) * 70 / 1e4) if band_units else None,
                "p70_mean": round(st.mean(band_units) * 70 / 1e4) if band_units else None,
            },
        })
    wards.sort(key=lambda w: -(w["unit"] or 0))
    for i, w in enumerate(wards, 1):
        w["rank"] = i
    return wards


def write_geo():
    # 区界几何已由 tools/build_housing_towns.py 的町名多边形取代，这里不再产出。
    return None


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, help="取引価格/成約価格 CSV（東京）")
    ap.add_argument("--api", action="store_true", help="用官方 API 拉取（需 REINFOLIB_API_KEY）")
    ap.add_argument("--from", dest="q_from", default="2025Q2")
    ap.add_argument("--to", dest="q_to", default="2026Q1")
    args = ap.parse_args(argv)

    def compact(p):
        # "2025年第2四半期" -> "2025Q2"
        try:
            y, n = p.split("年第")
            return f"{y}Q{n[0]}"
        except Exception:
            return p

    if args.csv:
        q, periods = collect_csv(args.csv)
        basis = f"{compact(periods[0])}–{compact(periods[-1])}" if periods else "unknown"
        kind = "csv"
    elif args.api:
        q, basis = collect_api(args.q_from, args.q_to)
        kind = "api"
    else:
        raise SystemExit("need --csv or --api")

    wards = summarise(q, None)
    total = sum(w["n"] for w in wards)
    doc = {
        "generated": date.today().isoformat(),
        "kind": kind,
        "basis": basis,
        "source_ja": SOURCE_JA,
        "source_url": SOURCE_URL,
        "license": "PDL 1.0 (https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)",
        "definition": {
            "type": TYPE_USED, "category": CATEGORY_CLOSED,
            "band": [BAND_MIN, BAND_MAX],
            # `unit` / `band.*` / `band.p70` は中央値(median)、`*_mean` が平均。
            # 2026-11-04 まで "mean" と書いてあり、実装(と凡例)と食い違っていた。
            "statistic": "median",
            "fields": {"unit": "median", "unit_mean": "mean",
                       "total_med": "median", "total_mean": "mean",
                       "band.unit": "median", "band.unit_mean": "mean",
                       "band.total_med": "median", "band.total_mean": "mean",
                       "band.p70": "median×70m2"},
        },
        "totals": {"wards": len(wards), "trades": total},
        "wards": wards,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "wards.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    geo = write_geo()
    print(f"wards {len(wards)} · trades {total} · basis {basis}")
    print(f"wrote {(OUT / 'wards.json').stat().st_size} B wards.json" + (f" · geo {geo[0]} feats {geo[1]} B" if geo else ""))
    top = wards[0]
    print(f"top: {top['ward']} unit {top['unit']} p70 {top['band']['p70']}")


if __name__ == "__main__":
    sys.exit(main())
