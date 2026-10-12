#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据层 QA：校验 data/ 与 site/data/ 的口径、完整性与分档质量。
用法: python scripts/qa_data.py   （退出码 0 = 全过）
"""
import json, math, os, sys
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(BASE, "data")
S = os.path.join(BASE, "site", "data")
RES = []


def ck(name, ok, detail=""):
    RES.append((name, bool(ok), detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"   :: {detail}" if detail else ""), flush=True)
    return ok


def j(p):
    return json.load(open(p, encoding="utf-8"))


def main():
    muni = j(os.path.join(D, "muni.json"))
    mpoly = j(os.path.join(D, "muni_poly.json"))
    chome = j(os.path.join(D, "chome_poly.json"))
    pts = j(os.path.join(D, "points.json"))
    meta = j(os.path.join(D, "meta.json"))
    cache = j(os.path.join(D, "lod_cache.json"))

    # ---- 1. 区市 ----
    ck("1.1 区市 62", len(muni) == 62, str(len(muni)))
    mn, pn = {w["ward"] for w in muni}, {f["properties"]["ward_ja"] for f in mpoly["features"]}
    ck("1.2 区市名 与 区市面对齐", mn == pn, f"json-only={sorted(mn-pn)} poly-only={sorted(pn-mn)}")
    ck("1.3 区市都有 pop 与两期数据",
       all(w.get("pop", 0) > 0 and set(w["R7"]) == set(w["R8cum"]) ==
           {"total", "violent", "rough", "breakin", "nonbreakin", "other"} for w in muni))

    # ---- 2. 町丁 ----
    cn = [f["properties"]["name"] for f in chome["features"]]
    pt = [p["n"] for p in pts]
    ck("2.1 町丁 5234 且无重名", len(cn) == 5234 and len(set(cn)) == 5234, f"{len(cn)}/{len(set(cn))}")
    ck("2.2 町丁面与点位一一对应", set(cn) == set(pt), f"面only={len(set(cn)-set(pt))} 点only={len(set(pt)-set(cn))}")
    nullg = sorted(f["properties"]["name"] for f in chome["features"] if not f["geometry"])
    nullp = sorted(p["n"] for p in pts if p["lat"] is None)
    ck("2.3 无面=无坐标 且同一批", nullg == nullp, f"无面{len(nullg)} 无坐标{len(nullp)}")

    WF = ["t", "nb", "bi", "r", "v", "o",
          "r8", "r8nb", "r8bi", "r8r", "r8v", "r8o", "pop", "g", "ward"]
    miss = [(f["properties"]["name"], k) for f in chome["features"] for k in WF if k not in f["properties"]]
    ck("2.4 町丁属性齐全", not miss, str(miss[:4]))

    wards_set = mn
    badw = sorted({f["properties"]["ward"] for f in chome["features"]} - wards_set)
    ck("2.5 町丁 ward 都在区市集合内", not badw, str(badw[:6]))

    # ---- 3. 分档 ----
    gd = Counter(f["properties"]["g"] for f in chome["features"])
    ck("3.1 分档 A-E/* 合计=5234", sum(gd.values()) == 5234 and set(gd) == set("ABCDE*"), str(dict(gd)))
    ck("3.2 meta 计数一致",
       meta["counts"]["chome"] == 5234 and meta["counts"]["munis"] == 62
       and meta["counts"]["pop_missing"] == gd["*"], json.dumps(meta["counts"]))

    # 分档单调：A 段均值 < ... < E
    by = {g: [] for g in "ABCDE"}
    for f in chome["features"]:
        pr = f["properties"]
        if pr["pop"] and pr["pop"] >= 200 and pr["g"] in by:
            by[pr["g"]].append(pr["t"] / pr["pop"] * 1000)
    mm = {g: (sum(v) / len(v) if v else 0) for g, v in by.items()}
    ck("3.3 分档均值单调 A<B<C<D<E",
       mm["A"] < mm["B"] < mm["C"] < mm["D"] < mm["E"],
       " ".join(f"{g}={mm[g]:.1f}" for g in "ABCDE"))

    # ---- 4. 绝对标尺质量（复刻页面 buildScales：区市R7+R8+町丁R7+R8 全并，log 等距 9 档） ----
    MW = {"t": "total", "nb": "nonbreakin", "bi": "breakin",
          "r": "rough", "v": "violent", "o": "other"}
    MF = {"t": ("t", "r8"), "nb": ("nb", "r8nb"), "bi": ("bi", "r8bi"),
          "r": ("r", "r8r"), "v": ("v", "r8v"), "o": ("o", "r8o")}

    def pool_rates(fld):
        out = []
        for w in muni:
            if w.get("nodata") or not w.get("pop"):
                continue
            for t in ("R7", "R8cum"):
                out.append(w[t][MW[fld]] / w["pop"] * 1000)
        for f in chome["features"]:
            pr = f["properties"]
            if pr["pop"] and pr["pop"] >= 200:
                for ff in MF[fld]:
                    out.append((pr[ff] or 0) / pr["pop"] * 1000)
        return sorted(out)

    def abs_breaks(vals):
        q = lambda p: vals[min(len(vals) - 1, int(p * len(vals)))]
        hi = q(0.99)
        nz = [v for v in vals if v > 0]
        zero = (1 - len(nz) / len(vals)) >= 0.35
        L1 = math.log1p(hi)
        if zero:
            L0 = math.log1p(nz[0])
            b = [0] + [math.expm1(L0 + (L1 - L0) * k / 7) for k in range(1, 7)] + [hi]
        else:
            L0 = math.log1p(vals[0])
            b = [math.expm1(L0 + (L1 - L0) * k / 8) for k in range(1, 8)] + [hi]
        for i in range(1, len(b)):
            if b[i] <= b[i - 1]:
                b[i] = b[i - 1] + 1e-6
        return b

    thin, nonmono = {}, []
    for fld in ("t", "nb", "bi", "r", "v", "o"):
        vals = pool_rates(fld)
        b = abs_breaks(vals)
        if not (len(b) == 8 and all(b[i] < b[i + 1] for i in range(7))):
            nonmono.append((fld, [round(x, 3) for x in b]))
        bins = [0] * 9
        for v in vals:
            idx = 8
            for i in range(8):
                if v <= b[i]:
                    idx = i
                    break
            bins[idx] += 1
        if sum(1 for x in bins if x > 0) < 9:
            thin[fld] = bins
    ck("4.1 六个指标标尺8断点严格递增", not nonmono, str(nonmono))
    ck("4.2 六个指标9色用满", not thin, json.dumps(thin))
    # 用户指控回归：8.2 与 1331 不得同档
    tb = abs_breaks(pool_rates("t"))
    def binof(v):
        for i in range(8):
            if v <= tb[i]:
                return i
        return 8
    ck("4.3 危险/安全不同色(8.2 vs 1331)", binof(8.2) != binof(1331.5), f"{binof(8.2)} vs {binof(1331.5)}")

    # ---- 5. 坐标范围 ----
    outb = [p["n"] for p in pts if p["lat"] is not None
            and not (20.0 <= p["lat"] <= 36.0 and 138.0 <= p["lng"] <= 154.0)]
    ck("5.1 坐标都在日本范围", not outb, str(outb[:5]))

    # ---- 6. site/data 与 data 一致 ----
    import hashlib
    def md5(p):
        return hashlib.md5(open(p, "rb").read()).hexdigest()
    for fn in ("muni.json", "muni_poly.json", "chome_poly.json", "points.json", "meta.json"):
        a, b = os.path.join(D, fn), os.path.join(S, fn)
        ok = os.path.exists(b) and md5(a) == md5(b)
        ck(f"6 site/data/{fn} 同步", ok, "" if ok else "缺失或不一致")

    # ---- 7. 缓存 ----
    ck("7.1 lod_cache 覆盖全部町丁", set(cache) == set(cn), f"cache={len(cache)} chome={len(cn)}")

    fails = [r for r in RES if not r[1]]
    print(f"\n=== {len(RES) - len(fails)}/{len(RES)} PASS ===")
    for n, _, d in fails:
        print("FAIL:", n, "::", d)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
