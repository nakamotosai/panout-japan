#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""fonts.py — subset every face the panout-japan UI actually needs.

Inputs
  .cache/fonts/NotoSansJP-VF.ttf, NotoSerifJP-VF.ttf
  F:/projects/saaaai-v3/tools/.cache/Noto{Sans,Serif}SC[wght].ttf
  F:/archive/20261014-omp-data-retire/dirs/tmp_fonts/outfit.ttf
  F:/projects/ouuut-v2/assets/fonts/ (Latin statics already split by ouuut)

Output
  site/assets/fonts/*.woff2 + @font-face CSS

Roles
  Outfit 800        wordmark / giant wordmark / 404
  Instrument 400    EN headings
  Geist 400/500     EN body + UI
  JetBrains 400/500 Latin numerals + eyebrow
  Noto Serif JP 700 / SC 700   CJK headings
  Noto Sans JP 500 / SC 500    CJK body + UI
"""
import hashlib
import os
import shutil
from pathlib import Path

LATIN_DIR = Path(os.environ.get("PANOUT_LATIN_FONTS", "F:/projects/ouuut-v2/assets/fonts"))
SC_CACHE = Path(os.environ.get("PANOUT_SC_FONTS", "F:/projects/saaaai-v3/tools/.cache"))
OUTFIT_SRC = Path(os.environ.get("PANOUT_OUTFIT_FONT", "F:/archive/20261014-omp-data-retire/dirs/tmp_fonts/outfit.ttf"))

# name, source path or filename in cache_dir, weight, family
CJK = [
    ("noto-sans-jp-200", "NotoSansJP-VF.ttf", 200, "Noto Sans JP"),
    ("noto-sans-jp-350", "NotoSansJP-VF.ttf", 350, "Noto Sans JP"),
    ("noto-sans-jp-400", "NotoSansJP-VF.ttf", 400, "Noto Sans JP"),
    ("noto-sans-sc-200", SC_CACHE / "NotoSansSC[wght].ttf", 200, "Noto Sans SC"),
    ("noto-sans-sc-350", SC_CACHE / "NotoSansSC[wght].ttf", 350, "Noto Sans SC"),
    ("noto-sans-sc-400", SC_CACHE / "NotoSansSC[wght].ttf", 400, "Noto Sans SC"),
]

LATIN = [
    ("InstrumentSerif-400-normal.woff2", "instrument-serif-400", "Instrument Serif", 400, "normal"),
    ("InstrumentSerif-400-italic.woff2", "instrument-serif-400i", "Instrument Serif", 400, "italic"),
    ("Geist-400-normal.woff2", "geist-400", "Geist", 400, "normal"),
    ("Geist-500-normal.woff2", "geist-500", "Geist", 500, "normal"),
    ("JetBrainsMono-400-normal.woff2", "jetbrains-mono-400", "JetBrains Mono", 400, "normal"),
    ("JetBrainsMono-500-normal.woff2", "jetbrains-mono-500", "JetBrains Mono", 500, "normal"),
]


def _subset(src, dst, text, weight):
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools import subset

    f = TTFont(str(src), recalcTimestamp=False)
    if "fvar" in f:
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
    # fontTools rewrites head.modified to "now" on save unless recalcTimestamp is off —
    # set in the constructor above. Before that, one build after another produced
    # different bytes for the same input (28096 vs 28144 bytes for one face on
    # 2026-11-03), so every deploy minted a new FONT_VER and every visitor re-downloaded
    # ~0.7 MB of fonts although nothing about the fonts had changed.
    f.save(str(dst))


def build(charset, out_dir, cache_dir):
    out_dir = Path(out_dir)
    cache_dir = Path(cache_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    files = []
    faces = []

    # Wordmark: Outfit 800, ASCII + product name. Subsetting a VF keeps the file tiny.
    outfit_text = "".join(chr(i) for i in range(32, 127)) + "panoutjapan"
    outfit_dst = out_dir / "outfit-800.woff2"
    _subset(OUTFIT_SRC, outfit_dst, outfit_text, 800)
    files.append(outfit_dst)
    faces.append(("Outfit", 800, "normal", outfit_dst.name))

    for name, src_name, weight, family in CJK:
        src = src_name if isinstance(src_name, Path) else cache_dir / src_name
        dst = out_dir / (name + ".woff2")
        if not src.exists():
            raise FileNotFoundError(str(src))
        _subset(src, dst, charset, weight)
        files.append(dst)
        faces.append((family, weight, "normal", dst.name))

    for src_name, name, family, weight, style in LATIN:
        src = LATIN_DIR / src_name
        if not src.exists():
            raise FileNotFoundError(str(src))
        dst = out_dir / (name + ".woff2")
        shutil.copyfile(src, dst)
        files.append(dst)
        faces.append((family, weight, style, dst.name))

    keep = {p.name for p in files}
    for old in out_dir.glob("*.woff2"):
        if old.name not in keep:
            old.unlink()

    h = hashlib.sha1()
    for p in files:
        h.update(p.read_bytes())
    ver = h.hexdigest()[:8]

    css = []
    for family, weight, style, fname in faces:
        css.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%d;font-display:swap;"
            "src:url('/assets/fonts/%s?v=%s') format('woff2')}"
            % (family, style, weight, fname, ver))
    total = sum(p.stat().st_size for p in files)
    print("fonts:", len(files), "files,", total // 1024, "KB, ver", ver)
    return {"ver": ver, "faces": "\n".join(css), "total": total}
