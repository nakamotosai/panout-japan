#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""市区町村面管线 B（23区 + 多摩30 + 岛有数6）：crime 裸名/計行 + pop 総数行 → muni.json + muni_poly.json
口径：只收 crime_R7/R8 + pop 皆有行（56 个）；无数 7 个（檜原村/奥多摩町/日の出町/瑞穂町/八丈町/三宅村/所属未定地）面照画、灰掉、卡片写“暂无数据”。
色带口径与站内一致：面颜色=所选罪种每千人件数（R7/R8 切），23区+市部同断点。
"""
import csv, json, os, unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "raw")
OUT = os.path.join(BASE, "data")

CATS = {
    "total": "総合計", "violent": "凶悪犯計", "rough": "粗暴犯計",
    "breakin": "侵入窃盗計", "nonbreakin": "非侵入窃盗計", "other": "その他計",
}

def load_crime_rows(path):
    with open(path, encoding="cp932") as fh:
        rows = list(csv.reader(fh))
    hdr, body = rows[0], rows[1:]
    idx = {c: i for i, c in enumerate(hdr)}
    table = {}
    for r in body:
        n = unicodedata.normalize("NFKC", r[0]).strip()
        table[n] = r
    return hdr, idx, table

ALIASES = {"瑞穂町": ["西多摩郡瑞穂町"], "日の出町": ["西多摩郡日の出町"],
           "檜原村": ["西多摩郡檜原村"], "奥多摩町": ["西多摩郡奥多摩町"],
           "三宅村": ["三宅島三宅村"], "八丈町": ["八丈島八丈町"]}

def crime_vals(idx, table, target):
    cands = [target, target + "計"] + [a for a in ALIASES.get(target, [])] + [a + "計" for a in ALIASES.get(target, [])]
    r = next((table[c] for c in cands if c in table), None)
    if r is None:
        return None
    out = {}
    for k, col in CATS.items():
        try: out[k] = int(r[idx[col]])
        except: out[k] = 0
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    hdr7, idx7, tab7 = load_crime_rows(os.path.join(RAW, "crime_R7.csv"))
    _, idx8, tab8 = load_crime_rows(os.path.join(RAW, "crime_R8.csv"))
    pop = {}
    with open(os.path.join(RAW, "pop_R8_t5.csv"), encoding="utf-8-sig") as fh:
        for r in list(csv.reader(fh))[1:]:
            if r[2] != "0":
                continue
            n = unicodedata.normalize("NFKC", r[3]).replace("総数", "")
            try: pop[n] = int(r[5]) if r[5] not in ("-", "") else 0
            except: pop[n] = 0
    gj = json.load(open(os.path.join(RAW, "tokyo.geojson"), encoding="utf-8"))
    feats, munis = [], []
    nodata = []
    for f in gj["features"]:
        name = f["properties"]["ward_ja"]
        area = f["properties"].get("area_ja")
        if name == "所属未定地":
            continue
        v7 = crime_vals(idx7, tab7, name)
        v8 = crime_vals(idx8, tab8, name)
        p = pop.get(name)
        if v7 is None or v8 is None or p is None:
            nodata.append(name)
            feats.append(f)
            munis.append({"ward": name, "area": area, "pop": p, "R7": None, "R8cum": None, "nodata": True})
            continue
        feats.append(f)
        munis.append({"ward": name, "area": area, "pop": p,
                      "R7": {"total": v7["total"], "violent": v7["violent"], "rough": v7["rough"],
                             "breakin": v7["breakin"], "nonbreakin": v7["nonbreakin"],
                             "other": v7["other"]},
                      "R8cum": {"total": v8["total"], "violent": v8["violent"], "rough": v8["rough"],
                                "breakin": v8["breakin"], "nonbreakin": v8["nonbreakin"],
                                "other": v8["other"]},
                      "nodata": False})
    def rnd(o):
        if isinstance(o, float): return round(o, 4)
        if isinstance(o, list): return [rnd(x) for x in o]
        return o
    for f in feats:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
        f.pop("crs", None)
    json.dump({"type": "FeatureCollection", "features": feats},
              open(os.path.join(OUT, "muni_poly.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    json.dump(munis, open(os.path.join(OUT, "muni.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))
    ok = sum(1 for m in munis if not m["nodata"])
    print(f"munis: {len(munis)} ok={ok} nodata={nodata}")

if __name__ == "__main__":
    main()
