# -*- coding: utf-8 -*-
"""Home-preview data plates.

These are deliberately build-time SVGs: the first screen must render without
waiting for WebGL, Leaflet or ECharts. Every mark is derived from the same
data files as the three chapter pages.
"""
import math
from collections import defaultdict

import svgkit as S

# 海报上的地名:ja/zh 用汉字原样,en 出罗马字。标注文案(T)由构建传进来 —— 单一真相源是
# src/build.py 的 COPY(四语,zh-Hant 由 zh 列经 src/hant.py 转出),这里不另存一份。
PLACE_EN = {"千代田": "Chiyoda", "世田谷": "Setagaya", "足立": "Adachi",
            "札幌": "Sapporo", "東京": "Tokyo", "那覇": "Naha", "秋田": "Akita"}


def _t(T, key, **kw):
    if not T or key not in T:
        raise SystemExit(f"home_plates: 缺少海报标注文案 {key}(见 src/build.py 的 COPY)")
    return T[key].format(**kw) if kw else T[key]


def _place(name, lang):
    return PLACE_EN.get(name, name) if lang == "en" else name


def _svg(w, h, label, body):
    return (f'<svg class="hp-svg" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="{label}" preserveAspectRatio="xMidYMid meet">'
            f'<title>{label}</title>{body}</svg>')


def quake_svg(quakes, outline, years, w=1000, h=760, T=None, lang="ja"):
    bbox = (121.0, 23.0, 151.0, 48.0)
    proj = S.Proj(bbox, w, h, 10)

    segs = S.clip_lines(outline["features"], bbox, 0.03)
    coast = "".join(S.path(seg, proj) for seg in segs)

    cell = 0.45
    bins = defaultdict(int)
    for q in quakes:
        lon, lat = q["lon"], q["lat"]
        if bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]:
            bins[(int((lon - bbox[0]) / cell), int((lat - bbox[1]) / cell))] += 1
    maxc = max(bins.values()) or 1

    levels = 6
    buckets = defaultdict(list)
    for (ix, iy), count in bins.items():
        if count < 2:
            continue
        level = min(levels - 1, int((count / maxc) ** 0.45 * levels))
        x0, y0 = proj.xy(bbox[0] + ix * cell, bbox[1] + iy * cell)
        x1, y1 = proj.xy(bbox[0] + (ix + 1) * cell, bbox[1] + (iy + 1) * cell)
        buckets[level].append((x0, y1, abs(x1 - x0), abs(y1 - y0)))

    out = []
    for level in sorted(buckets):
        opacity = 0.09 + 0.18 * level
        d = "".join(
            f"M{x:.1f} {y:.1f}h{ww:.1f}v{hh:.1f}h{-ww:.1f}z"
            for x, y, ww, hh in buckets[level]
        )
        out.append(f'<g class="hp-q" style="--i:{level}"><path d="{d}" fill="var(--accent)" '
                   f'opacity="{opacity:.2f}"/></g>')

    out.append(f'<path d="{coast}" fill="none" stroke="var(--ink)" stroke-width="1.4" '
               f'opacity="0.95" stroke-linejoin="round"/>')

    mx, my = proj.xy(142.37, 38.30)
    out.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="9" fill="none" '
               f'stroke="var(--accent)" stroke-width="1.7"/>')
    out.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="2.4" fill="var(--accent)"/>')
    out.append(f'<text x="{mx + 15:.1f}" y="{my + 5:.1f}" class="note halo ink">'
               f'2011-03-11 · M9.1</text>')

    # A 27-year ruler, not decoration: one tick per year in the catalogue.
    pad = 54
    base = h - 54
    for i, year in enumerate(years):
        x = pad + (w - 2 * pad) * i / max(1, len(years) - 1)
        hot = year == "2011"
        out.append(f'<rect x="{x:.1f}" y="{base - (16 if hot else 8):.1f}" width="1.2" '
                   f'height="{16 if hot else 8}" fill="var(--accent)" '
                   f'opacity="{0.9 if hot else 0.32}"/>')
    for i, year in enumerate(years):
        if year not in ("2000", "2011", "2026"):
            continue
        x = pad + (w - 2 * pad) * i / max(1, len(years) - 1)
        cls = "note accent" if year == "2011" else "micro"
        anchor = "end" if year == "2026" else "middle"
        out.append(f'<text x="{x:.1f}" y="{base + 30}" text-anchor="{anchor}" '
                   f'class="{cls}">{year}</text>')

    return _svg(w, h, _t(T, "plate.quake.aria", a=years[0], b=years[-1]), "".join(out))


def crime_svg(points, muni_poly, ward_rate, w=1000, h=760, T=None, lang="ja"):
    from shapely.geometry import shape
    from shapely.validation import make_valid

    bbox = (139.51, 35.52, 139.95, 35.87)
    proj = S.Proj(bbox, w, h, 10)
    out = []

    features = [f for f in muni_poly["features"]
                if f.get("geometry") and f["properties"].get("area_ja") == "都区部"]
    wards = {f["properties"]["ward_ja"] for f in features}
    max_rate = max((ward_rate.get(f["properties"]["ward_ja"]) or 0) for f in features) or 1
    chome_n = sum(1 for p in points if p.get("w") in wards)
    for f in features:
        g = make_valid(shape(f["geometry"]))
        rate = ward_rate.get(f["properties"]["ward_ja"]) or 0
        opacity = 0.04 + 0.16 * math.sqrt(max(0.0, rate) / max_rate)
        d = S.rings_path(g, proj, 0.0004)
        if d:
            out.append(f'<path d="{d}" fill="var(--accent)" fill-opacity="{opacity:.3f}" '
                       f'stroke="var(--accent)" stroke-width="0.8" stroke-opacity="0.32"/>')

    groups = {0: [], 1: [], 2: [], 3: []}
    for p in points:
        lon, lat = p.get("lng"), p.get("lat")
        if lon is None or lat is None:
            continue
        if p.get("w") not in wards:
            continue
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        total = p.get("t") or 0
        level = 0 if total <= 2 else (1 if total <= 6 else (2 if total <= 15 else 3))
        x, y = proj.xy(lon, lat)
        groups[level].append((x, y))

    widths = [1.3, 1.9, 2.6, 3.6]
    opacities = [0.38, 0.50, 0.64, 0.80]
    for level, pts in groups.items():
        if not pts:
            continue
        d = "".join(f"M{x:.1f} {y:.1f}h0" for x, y in pts)
        out.append(f'<g class="hp-dot" style="--i:{level}"><path d="{d}" stroke="var(--accent)" '
                   f'stroke-width="{widths[level]}" stroke-linecap="round" '
                   f'opacity="{opacities[level]}"/></g>')

    # The lens is the chapter's promise: a municipality is not the end scale.
    lx, ly = proj.xy(139.735, 35.690)
    lens = [f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="88" fill="none" '
            f'stroke="var(--accent)" stroke-width="2" opacity="0.9"/>',
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="2.6" fill="var(--accent)"/>']
    for dx, dy in ((0, -96), (0, 96), (-96, 0), (96, 0)):
        lens.append(f'<rect x="{lx + dx - 0.7:.1f}" y="{ly + dy - 6:.1f}" width="1.4" '
                    f'height="12" fill="var(--accent)" opacity="0.9"/>')
    out.append('<g class="hp-lens">' + "".join(lens) + "</g>")
    out.append(f'<text x="{lx:.1f}" y="{ly - 104:.1f}" text-anchor="middle" '
               f'class="note halo ink">{_t(T, "plate.crime.chome", n=f"{chome_n:,}")}</text>')

    labels = [
        ("千代田", 139.7536, 35.6938, 8, -10, "start"),
        ("世田谷", 139.6463, 35.6461, -8, 22, "end"),
        ("足立", 139.8048, 35.7750, 8, -8, "start"),
    ]
    for name, lon, lat, dx, dy, anchor in labels:
        x, y = proj.xy(lon, lat)
        out.append(f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" text-anchor="{anchor}" '
                   f'class="ward halo ink">{_place(name, lang)}</text>')

    # Rate key, flat blocks only.
    ky = h - 56
    out.append(f'<text x="54" y="{ky}" class="legend">RATE / 1,000</text>')
    for i, op in enumerate((0.10, 0.22, 0.36, 0.52)):
        out.append(f'<rect x="{54 + i * 24}" y="{ky + 14}" width="16" height="16" '
                   f'fill="var(--accent)" opacity="{op}"/>')
    out.append(f'<text x="{54 + 4 * 24 + 8}" y="{ky + 27}" class="legend">LOW → HIGH</text>')
    out.append(f'<text x="{w - 54}" y="{ky}" text-anchor="end" class="legend">'
               f'{_t(T, "plate.crime.chome", n=f"{chome_n:,}")}</text>')

    return _svg(w, h, _t(T, "plate.crime.aria"), "".join(out))


def cabinet_svg(months, month_mean, cabinet_data, w=1000, h=760, T=None, lang="ja"):
    n = len(months)
    index = {ym: i for i, ym in enumerate(months)}
    pad_l, pad_r = 56, 28
    x0, x1 = pad_l, w - pad_r

    def x_at(i):
        return x0 + (x1 - x0) * i / max(1, n - 1)

    out = []

    # Cabinet ribbon: width is time served, not an equal-width card row.
    ribbon_y, ribbon_h = 58, 34
    shortcuts = {"obuchi": _t(T, "plate.cab.obuchi"), "koizumi": _t(T, "plate.cab.koizumi"),
                 "abe2": _t(T, "plate.cab.abe2"), "takaichi": _t(T, "plate.cab.takaichi")}
    for j, cab in enumerate(cabinet_data["cabinets"]):
        i0 = index.get(cab["start"][:7], 0)
        i1 = index.get(cab["end"][:7], n - 1)
        i0, i1 = max(0, min(i0, n - 1)), max(0, min(i1, n - 1))
        left, right = x_at(i0), x_at(i1)
        width = max(1.0, right - left - 1)
        opacity = 0.09 + 0.028 * (j % 5)
        out.append(f'<rect x="{left + 1:.1f}" y="{ribbon_y}" width="{width:.1f}" '
                   f'height="{ribbon_h}" rx="1" fill="var(--accent)" opacity="{opacity:.2f}"/>')
        if cab["id"] in shortcuts and width > 44:
            out.append(f'<text x="{left + width / 2:.1f}" y="{ribbon_y + 23}" '
                       f'text-anchor="middle" class="ribbon ink">{shortcuts[cab["id"]]}</text>')
    out.append(f'<text x="{x0}" y="{ribbon_y - 18}" class="micro">14 CABINETS / 331 MONTHS</text>')
    out.append(f'<text x="{x1}" y="{ribbon_y - 18}" text-anchor="end" class="micro">'
               f'ONE LINE, 1998—2026</text>')

    # Approval line. 0–100 is the shared scale, so the line is comparable.
    top, bottom = 150, 620
    base_y = bottom

    def y_at(v):
        return top + (bottom - top) * (1 - v / 100)

    for value in (0, 25, 50, 75, 100):
        y = y_at(value)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" '
                   f'stroke="var(--muted)" stroke-width="0.7" opacity="0.14"/>')
        out.append(f'<text x="{x0 - 10}" y="{y + 4:.1f}" text-anchor="end" '
                   f'class="micro">{value}</text>')

    points = []
    for i, ym in enumerate(months):
        if ym in month_mean:
            points.append((x_at(i), y_at(month_mean[ym])))
    if points:
        area = f"M{points[0][0]:.1f},{base_y:.1f} " + \
               " ".join(f"L{x:.1f},{y:.1f}" for x, y in points) + \
               f" L{points[-1][0]:.1f},{base_y:.1f} Z"
        line = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
        out.append(f'<path d="{area}" fill="var(--accent)" opacity="0.10"/>')
        out.append(f'<polyline points="{line}" fill="none" stroke="var(--accent)" '
                   f'stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>')

    # One seam worth naming; the ribbon already carries the other cabinets.
    for ym, label in (("2012-12", "2012 / " + _t(T, "plate.cab.seam")),):
        if ym not in index:
            continue
        x = x_at(index[ym])
        out.append(f'<line x1="{x:.1f}" y1="{top}" x2="{x:.1f}" y2="{bottom}" '
                   f'stroke="var(--accent)" stroke-width="0.8" opacity="0.28"/>')
        out.append(f'<text x="{x + 8:.1f}" y="{top - 8}" class="micro accent">{label}</text>')

    if points:
        last_x, last_y = points[-1]
        out.append(f'<circle cx="{last_x:.1f}" cy="{last_y:.1f}" r="5" fill="var(--accent)"/>')
        out.append(f'<text x="{last_x - 10:.1f}" y="{last_y - 14:.1f}" text-anchor="end" '
                   f'class="note accent">{month_mean[months[-1]]:.1f}%</text>')
        out.append(f'<g class="hp-play" style="--d:{x1 - x0:.1f}">'
                   f'<line x1="{x0}" y1="{top}" x2="{x0}" y2="{bottom}" '
                   f'stroke="var(--accent)" stroke-width="2.4" opacity="0.5"/></g>')

    # Year labels are placed by month index, not eyeballed.
    for year in ("1998", "2005", "2012", "2019", "2026"):
        candidates = [i for i, ym in enumerate(months) if ym.startswith(year)]
        if not candidates:
            continue
        anchor = "end" if year == "2026" else "middle"
        out.append(f'<text x="{x_at(candidates[0]):.1f}" y="{bottom + 30}" '
                   f'text-anchor="{anchor}" class="micro">{year}</text>')

    out.append(f'<text x="{x0}" y="{top - 8}" class="micro">APPROVAL / %</text>')

    return _svg(w, h, _t(T, "plate.cab.aria", a=months[0][:4], b=months[-1][:4], n=len(months)), "".join(out))


def housing_svg(wards, muni_poly, w=1000, h=760, deals=None, towns=None, T=None, lang="ja"):
    """23 wards filled by the median price per m² (log scale, single accent)."""
    from shapely.geometry import shape
    from shapely.validation import make_valid

    bbox = (139.51, 35.52, 139.95, 35.87)
    proj = S.Proj(bbox, w, h, 10)
    out = []

    features = [f for f in muni_poly["features"]
                if f.get("geometry") and f["properties"].get("area_ja") == "都区部"]
    by_ward = {x["ward"]: x for x in wards}
    units = [x["unit"] for x in wards if x.get("unit")]
    lo, hi = math.log10(min(units)), math.log10(max(units))
    span = (hi - lo) or 1.0

    heat = []
    for f in features:
        name = f["properties"]["ward_ja"]
        rec = by_ward.get(name) or {}
        unit = rec.get("unit") or 0
        t = (math.log10(unit) - lo) / span if unit else 0.0
        opacity = 0.10 + 0.55 * max(0.0, min(1.0, t))
        g = make_valid(shape(f["geometry"]))
        d = S.rings_path(g, proj, 0.0004)
        if d:
            heat.append(f'<g class="hp-heat" style="--i:{len(heat)}">'
                        f'<path d="{d}" fill="var(--accent)" fill-opacity="{opacity:.3f}" '
                        f'stroke="var(--accent)" stroke-width="0.8" stroke-opacity="0.30"/></g>')
    out.append("".join(heat))

    labels = [
        ("千代田", 139.7536, 35.6938, 10, -6, "start"),
        ("世田谷", 139.6463, 35.6461, -10, 20, "end"),
        ("足立", 139.8048, 35.7750, 10, -6, "start"),
    ]
    for name, lon, lat, dx, dy, anchor in labels:
        x, y = proj.xy(lon, lat)
        out.append(f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" text-anchor="{anchor}" '
                   f'class="ward halo ink">{_place(name, lang)}</text>')

    if deals:
        tx, ty = proj.xy(139.735, 35.660)
        # 卡片抬头是「23 WARDS 21,848」,这里必须写明是都全域口径,否则同一张图两个总数
        label = (_t(T, "plate.house.deals", t=f"{towns:,}", d=f"{deals:,}")
                 if towns else f'{deals:,}')
        out.append(f'<text x="{tx:.1f}" y="{ty:.1f}" text-anchor="middle" class="note halo ink">'
                   f'{label}</text>')

    ky = h - 56
    out.append(f'<text x="54" y="{ky}" class="legend">{_t(T, "plate.house.legend")}</text>')
    for i, op in enumerate((0.10, 0.22, 0.34, 0.46)):
        out.append(f'<rect x="{54 + i * 24}" y="{ky + 14}" width="16" height="16" '
                   f'fill="var(--accent)" opacity="{op}"/>')
    out.append(f'<text x="{54 + 4 * 24 + 8}" y="{ky + 27}" class="legend">LOW → HIGH</text>')
    out.append(f'<text x="{w - 54}" y="{ky}" text-anchor="end" class="legend">23 WARDS / 2025Q2–2026Q1</text>')

    return _svg(w, h, _t(T, "plate.house.aria", per="2025Q2–2026Q1"), "".join(out))


def weather_svg(outline, w=1000, h=760, bbox=(121.0, 23.0, 151.0, 48.0), T=None, lang="ja"):
    """Today's forecast plate — the archipelago, the day's ruler, the plan.

    The forecast feed is not connected yet, so nothing here is a reading: the
    only marks are real geography (the same coastline as the quake plate),
    the hour scale, and where the readings will sit.
    """
    proj = S.Proj(bbox, w, h, 10)
    segs = S.clip_lines(outline["features"], bbox, 0.03)
    coast = "".join(S.path(seg, proj) for seg in segs)

    out = []
    # Pressure field: four isobars, one hue, shape only. The group drifts, so
    # the card keeps moving after the entrance.
    iso = []
    for i in range(4):
        y = 122 + i * 146
        amp = 42 - i * 6
        d = (f"M-24 {y + 12:.1f}C{w * .20:.0f} {y - amp:.1f} {w * .36:.0f} {y + amp:.1f} "
             f"{w * .54:.0f} {y:.1f}S{w * .80:.0f} {y - amp * .7:.1f} {w + 24:.0f} {y + 10:.1f}")
        iso.append(f'<path d="{d}" fill="none" stroke="var(--accent)" stroke-width="3.2" '
                   f'opacity="{0.30 - 0.05 * i:.3f}"/>')
    out.append('<g class="hp-iso">' + "".join(iso) + "</g>")

    out.append(f'<path d="{coast}" fill="none" stroke="var(--ink)" stroke-width="1.4" '
               f'opacity="0.95" stroke-linejoin="round"/>')

    # Reading stations: prefectural capitals, three of them named.
    for name, lon, lat, dx, dy, anchor in (
            ("札幌", 141.35, 43.06, 13, 5, "start"),
            ("東京", 139.69, 35.69, -13, 22, "end"),
            ("那覇", 127.68, 26.21, 13, 6, "start")):
        x, y = proj.xy(lon, lat)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="none" '
                   f'stroke="var(--accent)" stroke-width="1.6"/>')
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" fill="var(--accent)"/>')
        out.append(f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" text-anchor="{anchor}" '
                   f'class="ward halo ink">{_place(name, lang)}</text>')

    # The day, ticked hour by hour.
    pad = 54
    base = h - 54
    for i in range(25):
        x = pad + (w - 2 * pad) * i / 24
        major = i % 6 == 0
        out.append(f'<rect x="{x:.1f}" y="{base - (18 if major else 9):.1f}" width="1.2" '
                   f'height="{18 if major else 9}" fill="var(--accent)" '
                   f'opacity="{0.9 if major else 0.32}"/>')
    for i in (0, 6, 12, 18, 24):
        x = pad + (w - 2 * pad) * i / 24
        anchor = "start" if i == 0 else ("end" if i == 24 else "middle")
        out.append(f'<text x="{x:.1f}" y="{base + 30}" text-anchor="{anchor}" '
                   f'class="micro">{i:02d}</text>')
    out.append(f'<text x="{pad}" y="{base - 34}" class="micro">TODAY / 24H</text>')
    out.append(f'<text x="{w - pad}" y="{base - 34}" text-anchor="end" class="micro">'
               f'{_t(T, "plate.weather.source")}</text>')

    return _svg(w, h, _t(T, "plate.weather.aria"), "".join(out))


def population_svg(doc, w=1000, h=760, T=None, lang="ja"):
    """1,719 equal cells, one per municipality, coloured by 2020→2025 change.

    The sixth scale is a wall of places, not a map. The thin ribbon above it is
    the 47 prefectures, width proportional to the number of municipalities; the
    grid itself is row-major in prefecture order, largest municipality first.
    """
    munis = doc["munis"]
    prefs = doc["prefs"]
    rates = sorted(abs(m["rate"]) for m in munis if m["rate"] is not None)
    cap = rates[int(len(rates) * 0.98)] if rates else 10.0
    cap = max(2.0, min(12.0, cap))
    cols, rows = 54, 32
    pad = 90
    cell = min((w - 2 * pad) / cols, (h - 230) / rows)
    gx = (w - cols * cell) / 2
    gy = 150
    out = []

    # Prefecture ribbon: 47 segments, width = number of municipalities.
    total = sum(p["n"] for p in prefs) or 1
    rx = gx
    for p in prefs:
        seg = (w - 2 * gx) * p["n"] / total
        r = p["rate"] or 0
        fill = "var(--accent)" if r > 0 else "var(--ink)"
        op = 0.22 + 0.68 * min(1.0, abs(r) / cap)
        out.append(f'<rect x="{rx:.2f}" y="116" width="{max(1.0, seg - 1):.2f}" '
                   f'height="7" rx="1.5" fill="{fill}" opacity="{op:.2f}"/>')
        rx += seg

    out.append(f'<text x="{gx}" y="40" class="micro">1,719 MUNICIPALITIES</text>')
    out.append(f'<text x="{w - gx}" y="40" text-anchor="end" class="micro">'
               f'2020→2025</text>')
    out.append(f'<text x="{gx}" y="78" class="note ink">{_t(T, "plate.pop.head")}</text>')

    rows_cells = defaultdict(list)
    for m in munis:
        x = gx + m["gx"] * cell
        y = gy + m["gy"] * cell
        r = m["rate"]
        if r is None:
            fill, op = "var(--muted)", 0.22
        elif r > 0:
            fill = "var(--accent)"
            k = min(3, int(min(1.0, r / cap) * 4))
            op = [0.55, 0.70, 0.85, 0.98][k]
        else:
            fill = "var(--ink)"
            k = min(3, int(min(1.0, -r / cap) * 4))
            op = [0.08, 0.14, 0.20, 0.28][k]
        rows_cells[m["gy"]].append(
            f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(1.0, cell - 2):.2f}" '
            f'height="{max(1.0, cell - 2):.2f}" rx="1.4" fill="{fill}" '
            f'opacity="{op:.2f}"/>')
    for row in sorted(rows_cells):
        out.append(f'<g class="hp-row" style="--i:{row}">' + "".join(rows_cells[row]) + "</g>")

    # Two reading stations: the one growing prefecture and the steepest decline.
    for code, label, dx, dy, anchor in (
            ("13100", "東京", 18, 5, "start"),
            ("05201", "秋田", 18, 18, "start")):
        m = next((x for x in munis if x["code"] == code), None)
        if not m:
            continue
        x = gx + m["gx"] * cell + cell / 2
        y = gy + m["gy"] * cell + cell / 2
        out.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{cell * .85:.2f}" '
                   f'fill="none" stroke="var(--ink)" stroke-width="1.4" opacity="0.8"/>')
        out.append(f'<text x="{x + dx:.2f}" y="{y + dy:.2f}" text-anchor="{anchor}" '
                   f'class="ward halo ink">{_place(label, lang)}</text>')

    ky = h - 56
    out.append(f'<text x="{gx}" y="{ky}" class="legend">MUNICIPALITY / 2020→2025</text>')
    for i, (fill, op, label) in enumerate((
            ("var(--ink)", 0.55, _t(T, "plate.pop.down")),
            ("var(--accent)", 0.90, _t(T, "plate.pop.up")),
            ("var(--muted)", 0.30, _t(T, "plate.pop.flat")))):
        lx = gx + i * 118
        out.append(f'<rect x="{lx}" y="{ky + 14}" width="16" height="16" rx="1.5" '
                   f'fill="{fill}" opacity="{op}"/>')
        out.append(f'<text x="{lx + 24}" y="{ky + 28}" class="legend">{label}</text>')
    out.append(f'<text x="{w - gx}" y="{ky}" text-anchor="end" class="legend">'
               f'54 × 32 / 1,719</text>')

    return _svg(w, h, _t(T, "plate.pop.aria"), "".join(out))
