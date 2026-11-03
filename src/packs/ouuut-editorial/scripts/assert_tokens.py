#!/usr/bin/env python3
"""ouuut-editorial 断言:锚点色 / 语义键 / 色值合法 / 对比度双档 / 产物齐备。退出 0 = 通过。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
RGBA = re.compile(r"^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$")
REQUIRED = ("bg", "ink", "muted", "surface", "accent")

ANCHORS = {
    "paper": {"bg": "#F5F3ED", "ink": "#1A1A16", "muted": "#5B5A53", "accent": "#CD5545"},
    "charcoal": {"bg": "#0E0E0C", "ink": "#EDEBE4", "muted": "#A3A199", "accent": "#CD5545"},
}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def lum(color: str) -> float:
    h = color.lstrip("#")
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main() -> None:
    pack = json.loads((ROOT / "pack.json").read_text(encoding="utf-8"))
    abs_path, idx_path = ROOT / "tokens" / "absolute.json", ROOT / "tokens" / "index.json"
    for p in (abs_path, idx_path):
        if not p.is_file():
            fail(f"missing {p.relative_to(ROOT)}")

    absolute = json.loads(abs_path.read_text(encoding="utf-8"))
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if idx.get("default") != "paper":
        fail(f"default must be paper, got {idx.get('default')}")
    if len(idx.get("variants", [])) < 2:
        fail("expected ≥2 variants (paper, charcoal)")

    measured: list[str] = []
    for variant in idx["variants"]:
        vid = variant["id"]
        data = json.loads((ROOT / variant["path"]).read_text(encoding="utf-8"))
        colors = data.get("colors", {})
        for key in REQUIRED:
            if key not in colors:
                fail(f"{vid} missing colors.{key}")
        for key in ("bg", "ink", "muted", "accent"):
            value = colors[key]
            if not HEX.match(value):
                fail(f"{vid}.{key} not hex6: {value}")
            expected = ANCHORS[vid][key]
            if value.lower() != expected.lower():
                fail(f"{vid}.{key} expected {expected} got {value}")
        if not RGBA.match(colors["surface"]):
            fail(f"{vid}.surface not rgba: {colors['surface']}")

        c_body = contrast(colors["ink"], colors["bg"])
        c_muted = contrast(colors["muted"], colors["bg"])
        if c_body < 4.5:
            fail(f"{vid} ink/bg contrast {c_body:.2f} < 4.5")
        if c_muted < 4.5:
            fail(f"{vid} muted/bg contrast {c_muted:.2f} < 4.5")
        measured.append(f"{vid}: ink/bg {c_body:.2f}, muted/bg {c_muted:.2f}")

    # 强调色双档:全部色组 × 两模
    paper_bg, charcoal_bg = ANCHORS["paper"]["bg"], ANCHORS["charcoal"]["bg"]
    worst_dark, worst_light, y_min, y_max, n = 99.0, 99.0, 9.0, 0.0, 0
    for palette in absolute["palettes"].values():
        for name, hexv in palette["colors"].items():
            if not HEX.match(hexv):
                fail(f"palette color {name} not hex6: {hexv}")
            n += 1
            y = lum(hexv)
            c_dark, c_light = contrast(hexv, charcoal_bg), contrast(hexv, paper_bg)
            y_min, y_max = min(y_min, y), max(y_max, y)
            worst_dark, worst_light = min(worst_dark, c_dark), min(worst_light, c_light)
            if c_dark < 4.5:
                fail(f"{name} {hexv} on charcoal {c_dark:.2f} < 4.5")
            if c_light < 3.0:
                fail(f"{name} {hexv} on paper {c_light:.2f} < 3.0")
            if not (0.15 <= y <= 0.25):
                fail(f"{name} {hexv} luminance Y={y:.3f} outside band [0.15, 0.25]")

    for rel in ("css/default.css", "css/all.css", "css/themes.css", "css/type.css", "SKILL.md", "docs/usage.md", "preview/index.html"):
        if not (ROOT / rel).is_file():
            fail(f"missing {rel}")
    if pack.get("default_variant") != "paper":
        fail("pack.json default_variant must be paper")

    usage = (ROOT / "docs" / "usage.md").read_text(encoding="utf-8")
    for cue in ("配", "--accent-ink", "反模式", "data-palette"):
        if cue not in usage:
            fail(f"docs/usage.md missing cue: {cue}")

    print("PASS assert_tokens ouuut-editorial")
    print("  " + " | ".join(measured))
    print(f"  accents: {n} colors, Y {y_min:.3f}-{y_max:.3f}, charcoal ≥{worst_dark:.2f}, paper ≥{worst_light:.2f}")


if __name__ == "__main__":
    main()
