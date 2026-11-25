#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""fonts.py — subset every face the panout-japan UI actually needs (Wireframe Studio Edition).

Output
  site/assets/fonts/*.woff2 + @font-face CSS

Roles
  Outfit 800                     404 display code / fallback wordmark
  Instrument Serif 400 / 400i    EN display headings & editorial numerals
  Geist 400 / 500 / 600          EN body + UI
  JetBrains Mono 400 / 500 / 700 Eyebrow, badges, tabular numerals & data rails
  Noto Serif JP 700 / SC 700 / TC 700 (+ TC Punct)   CJK Display Headings
  Noto Sans JP 400/500 / SC 400/500 / TC 400/500 (+ TC Punct) CJK Body + UI
"""
import hashlib
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent

LATIN_DIR = Path(os.environ.get("PANOUT_LATIN_FONTS", "F:/projects/ouuut-v2/assets/fonts"))
SC_CACHE = Path(os.environ.get("PANOUT_SC_FONTS", "F:/projects/saaaai-v3/tools/.cache"))
TC_CACHE = Path(os.environ.get("PANOUT_TC_FONTS", ""))
OUTFIT_SRC = Path(os.environ.get("PANOUT_OUTFIT_FONT",
                                 "F:/archive/20261014-omp-data-retire/dirs/tmp_fonts/outfit.ttf"))

PUNCT_CHARS = "、。，：；！？"
PUNCT_RANGE = "U+3001-3002, U+FF01, U+FF0C, U+FF1A, U+FF1B, U+FF1F"

LATIN = [
    ("InstrumentSerif-400-normal.woff2", "instrument-serif-400", "Instrument Serif", 400, "normal"),
    ("InstrumentSerif-400-italic.woff2", "instrument-serif-400i", "Instrument Serif", 400, "italic"),
    ("Geist-400-normal.woff2", "geist-400", "Geist", 400, "normal"),
    ("Geist-500-normal.woff2", "geist-500", "Geist", 500, "normal"),
    ("Geist-600-normal.woff2", "geist-600", "Geist", 600, "normal"),
    ("JetBrainsMono-400-normal.woff2", "jetbrains-mono-400", "JetBrains Mono", 400, "normal"),
    ("JetBrainsMono-500-normal.woff2", "jetbrains-mono-500", "JetBrains Mono", 500, "normal"),
    ("JetBrainsMono-700-normal.woff2", "jetbrains-mono-700", "JetBrains Mono", 700, "normal"),
]


def _resolve_first(candidates):
    for p in candidates:
        if p and Path(p).is_file():
            return Path(p)
    return None


def _subset(src, dst, text, weight=None):
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools import subset

    f = TTFont(str(src), recalcTimestamp=False)
    if weight is not None and "fvar" in f:
        instantiateVariableFont(f, {"wght": weight}, inplace=True, updateFontNames=False)
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG", "SVG "]
    ss = subset.Subsetter(options=opts)
    ss.populate(text=text)
    ss.subset(f)
    f.flavor = "woff2"
    f.save(str(dst))


def build(charset, out_dir, cache_dir):
    out_dir = Path(out_dir)
    cache_dir = Path(cache_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    sans_jp_src = _resolve_first([cache_dir / "NotoSansJP-VF.ttf", Path("C:/Windows/Fonts/NotoSansJP-VF.ttf")])
    serif_jp_src = _resolve_first([cache_dir / "NotoSerifJP-VF.ttf", Path("C:/Windows/Fonts/NotoSerifJP-VF.ttf")])
    sans_sc_src = _resolve_first([SC_CACHE / "NotoSansSC[wght].ttf", Path("C:/Windows/Fonts/NotoSansSC-VF.ttf")])
    serif_sc_src = _resolve_first([SC_CACHE / "NotoSerifSC[wght].ttf", Path("C:/Windows/Fonts/NotoSerifSC-VF.ttf")])
    sans_tc_src = _resolve_first([
        TC_CACHE / "NotoSansTC-VF.ttf" if TC_CACHE.name else None,
        cache_dir / "NotoSansTC-VF.ttf",
        Path("F:/projects/speak-site/tools/.cache/NotoSansTC-VF.ttf"),
        Path("C:/Windows/Fonts/NotoSansTC-VF.ttf"),
    ])
    serif_tc_src = _resolve_first([
        TC_CACHE / "NotoSerifTC-Bold.otf" if TC_CACHE.name else None,
        cache_dir / "NotoSerifTC-Bold.otf",
        Path("C:/Windows/Fonts/NotoSerifTC-Bold.otf"),
    ])

    for label, p in [
        ("NotoSansJP-VF.ttf", sans_jp_src),
        ("NotoSerifJP-VF.ttf", serif_jp_src),
        ("NotoSansSC[wght].ttf", sans_sc_src),
        ("NotoSerifSC[wght].ttf", serif_sc_src),
    ]:
        if p is None:
            raise FileNotFoundError(f"Missing required CJK font source: {label}")

    files = []
    faces = []  # (family, weight, style, fname, unicode_range_or_None)

    outfit_text = "".join(chr(i) for i in range(32, 127)) + "panoutjapan"
    outfit_dst = out_dir / "outfit-800.woff2"
    _subset(OUTFIT_SRC, outfit_dst, outfit_text, 800)
    files.append(outfit_dst)
    faces.append(("Outfit", 800, "normal", outfit_dst.name, None))

    cjk_jobs = [
        ("noto-sans-jp-400", sans_jp_src, 400, "Noto Sans JP", charset, None),
        ("noto-sans-jp-500", sans_jp_src, 500, "Noto Sans JP", charset, None),
        ("noto-serif-jp-700", serif_jp_src, 700, "Noto Serif JP", charset, None),
        ("noto-sans-sc-400", sans_sc_src, 400, "Noto Sans SC", charset, None),
        ("noto-sans-sc-500", sans_sc_src, 500, "Noto Sans SC", charset, None),
        ("noto-serif-sc-700", serif_sc_src, 700, "Noto Serif SC", charset, None),
    ]

    if sans_tc_src is not None:
        cjk_jobs.extend([
            ("noto-sans-tc-400", sans_tc_src, 400, "Noto Sans TC", charset, None),
            ("noto-sans-tc-500", sans_tc_src, 500, "Noto Sans TC", charset, None),
            ("noto-sans-tc-punct-400", sans_sc_src, 400, "Noto Sans TC Punct", PUNCT_CHARS, PUNCT_RANGE),
            ("noto-sans-tc-punct-500", sans_sc_src, 500, "Noto Sans TC Punct", PUNCT_CHARS, PUNCT_RANGE),
        ])
    else:
        print("[warn] NotoSansTC-VF.ttf missing — zh-Hant sans falls back to Noto Sans SC/JP")

    if serif_tc_src is not None:
        cjk_jobs.extend([
            ("noto-serif-tc-700", serif_tc_src, None, "Noto Serif TC", charset, None),
            ("noto-serif-tc-punct-700", serif_sc_src, 700, "Noto Serif TC Punct", PUNCT_CHARS, PUNCT_RANGE),
        ])
    else:
        print("[warn] NotoSerifTC-Bold.otf missing — zh-Hant serif falls back to Noto Serif SC/JP")

    for name, src, weight, family, subset_chars, u_range in cjk_jobs:
        dst = out_dir / (name + ".woff2")
        _subset(src, dst, subset_chars, weight)
        files.append(dst)
        faces.append((family, weight or 700, "normal", dst.name, u_range))

    for src_name, name, family, weight, style in LATIN:
        src = LATIN_DIR / src_name
        if not src.exists():
            raise FileNotFoundError(str(src))
        dst = out_dir / (name + ".woff2")
        shutil.copyfile(src, dst)
        files.append(dst)
        faces.append((family, weight, style, dst.name, None))

    keep = {p.name for p in files}
    for old in out_dir.glob("*.woff2"):
        if old.name not in keep:
            old.unlink()

    h = hashlib.sha1()
    for p in files:
        h.update(p.read_bytes())
    ver = h.hexdigest()[:8]

    css = []
    for family, weight, style, fname, u_range in faces:
        ur = f"unicode-range:{u_range};" if u_range else ""
        css.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%d;font-display:swap;%s"
            "src:url('/assets/fonts/%s?v=%s') format('woff2')}"
            % (family, style, weight, ur, fname, ver))
    total = sum(p.stat().st_size for p in files)
    print("fonts:", len(files), "files,", total // 1024, "KB, ver", ver)
    return {"ver": ver, "faces": "\n".join(css), "total": total}
