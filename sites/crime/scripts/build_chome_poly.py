#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""町丁面装配（离线）：data/chome.json + data/lod_cache.json → data/chome_poly.json + data/points.json
- lod_cache.json：{町丁名: WKT或null}，由 scripts/fetch_lod.mjs 抓取（住所LOD uedayou.net/loa, CC BY-SA 4.0）。
  抓取用 JS（Bun fetch）而非 urllib：本机 bash 内联 HTTP 被工具策略拦截，Python urllib 走不通。
- chome_poly.json：全部町丁；40 个无 LOD 面（以下不詳/中央防波堤/新设町丁等）geometry=null，卡片照常出。
- points.json：搜索/跳转用点位；有面者取多边形 bbox 中心，无面者 lat/lng=null。
口径：WKT POLYGON/MULTIPOLYGON → GeoJSON（括号匹配切分，兼容单环双括号）；
坐标取 5 位小数（≈1.1m），并对长环做 Douglas-Peucker 抽稀（容差 1.5e-5°，≈1.5m）：
457k 点 → ~100k 点，体积 11.8MB → ~3MB，缩放重绘成本大降，视觉无差。
"""
import json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")
CACHE = os.path.join(DATA, "lod_cache.json")
OUT_POLY = os.path.join(DATA, "chome_poly.json")
OUT_PTS = os.path.join(DATA, "points.json")


def _split_top(s):
    # 顶层逗号切分(括号深度0处):POLYGON多环/MULTIPOLYGON多面通用
    parts, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
            cur.append(ch)
        elif ch == ")":
            depth -= 1
            cur.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    if cur:
        parts.append("".join(cur).strip())
    return [p for p in parts if p]


TOL = 1.5e-5  # Douglas-Peucker 容差(度) ≈1.5m;z18 下约 2.5px,肉眼无差


def _dp_open(pts, tol):
    # 开曲线 Douglas-Peucker(保留首末)
    n = len(pts)
    if n < 3:
        return pts
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = math.hypot(px - ax, py - ay) if den == 0 else abs(dy * (px - ax) - dx * (py - ay)) / den
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def simplify_ring(pts, tol=TOL):
    # 闭环抽稀:首末重合,直接跑 DP 会退化(弦长为0)-> 从最远点切成两段开曲线分别抽
    n = len(pts)
    if n < 8:
        return pts
    ax, ay = pts[0]
    far, fd = 0, -1.0
    for i in range(1, n):
        d = math.hypot(pts[i][0] - ax, pts[i][1] - ay)
        if d > fd:
            far, fd = i, d
    if far == 0:
        return pts
    out = _dp_open(pts[:far + 1], tol) + _dp_open(pts[far:], tol)[1:]
    return out if len(out) >= 4 else pts


def _parse_ring(rs):
    rs = rs.strip()
    if rs.startswith("(") and rs.endswith(")"):
        rs = rs[1:-1]
    pts = []
    for tok in rs.split(","):
        t = tok.strip().split()
        if len(t) < 2:
            continue
        try:
            pts.append([round(float(t[0]), 5), round(float(t[1]), 5)])
        except ValueError:
            continue
    return simplify_ring(pts)


def parse_wkt(wkt):
    # 通用WKT→GeoJSON:括号匹配切分,兼容 POLYGON((r)) 单环双括号(旧正则要求三层括号会全灭)
    s = wkt.strip()
    if s.startswith("POLYGON"):
        inner = s[len("POLYGON"):].strip()
        if not (inner.startswith("(") and inner.endswith(")")):
            return None
        rings = [_parse_ring(rs) for rs in _split_top(inner[1:-1])]
        rings = [r for r in rings if r and len(r) >= 4]
        return {"type": "Polygon", "coordinates": rings} if rings else None
    if s.startswith("MULTIPOLYGON"):
        inner = s[len("MULTIPOLYGON"):].strip()
        if not (inner.startswith("(") and inner.endswith(")")):
            return None
        polys = []
        for ps in _split_top(inner[1:-1]):
            ps = ps.strip()
            if not (ps.startswith("(") and ps.endswith(")")):
                continue
            rings = [_parse_ring(rs) for rs in _split_top(ps[1:-1])]
            rings = [r for r in rings if r and len(r) >= 4]
            if rings:
                polys.append(rings)
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return None


def bbox_center(g):
    xs, ys = [], []
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for rings in polys:
        for r in rings:
            for x, y in r:
                xs.append(x)
                ys.append(y)
    return round((min(xs) + max(xs)) / 2, 5), round((min(ys) + max(ys)) / 2, 5)


def props_of(c):
    R7, R8 = c["R7"], c["R8cum"]
    return {"name": c["name"], "ward": c["ward"],
            "t": R7["total"],
            "bi": R7["breakin"], "nb": R7["nonbreakin"],
            "r": R7["rough"], "v": R7["violent"], "o": R7["other"],
            "r8": R8["total"],
            "r8bi": R8["breakin"], "r8nb": R8["nonbreakin"],
            "r8r": R8["rough"], "r8v": R8["violent"], "r8o": R8["other"],
            "pop": c["pop"], "g": c["grade"]}


def main():
    ch = json.load(open(os.path.join(DATA, "chome.json"), encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    feats, pts, nopoly, badwkt = [], [], [], []
    for c in ch:
        n = c["name"]
        wkt = cache.get(n)
        g = parse_wkt(wkt) if wkt else None
        if wkt and not g:
            badwkt.append(n)
        if not g:
            nopoly.append(n)
        feats.append({"type": "Feature", "properties": props_of(c), "geometry": g})
        if g:
            lng, lat = bbox_center(g)
        else:
            lng = lat = None
        p = {"n": n, "w": c["ward"], "lng": lng, "lat": lat}
        p.update({k: v for k, v in props_of(c).items() if k not in ("name", "ward")})
        pts.append(p)
    json.dump({"type": "FeatureCollection", "features": feats},
              open(OUT_POLY, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(pts, open(OUT_PTS, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT_POLY}: {len(feats)} feats, null-geom={len(nopoly)}, badwkt={len(badwkt)}")
    print(f"wrote {OUT_PTS}: {len(pts)} pts, with-coords={sum(1 for p in pts if p['lat'] is not None)}")
    print("null-geom head:", nopoly[:20])
    print("poly size MB:", round(os.path.getsize(OUT_POLY) / 1e6, 2),
          "pts size MB:", round(os.path.getsize(OUT_PTS) / 1e6, 2))


if __name__ == "__main__":
    main()
