#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""patch_vendor.py — deterministic string patches on the frozen quake bundle.

The vendor file is the original dist bundle with a documented set of literal
replacements (see app/quake/view.js header). This script applies the shell-level
branding fixes that cannot be done from outside the bundle.
"""
from pathlib import Path

P = Path(__file__).resolve().parent.parent / "app/quake/vendor/quake-core.js"

REPLACEMENTS = [
    ("quake.japan.ouuut.com", "japan.ouuut.com", 2),
    ("数据来源", "出典", 1),
    ("刷新网页重新开始", "ページを再読み込み", 1),
    (
        "F_={tactical:{bg:1315344,coast:16117992,gridA:3814188,gridB:2762015},gruvbox:{bg:1315344,coast:16117992,gridA:3814188,gridB:2762015}};function I_(e){return`tactical`}",
        "F_={tactical:{bg:921100,coast:15592420,gridA:2236958,gridB:1710614},gruvbox:{bg:921100,coast:15592420,gridA:2236958,gridB:1710614},sage:{bg:15330787,coast:1713436,gridA:13686472,gridB:12108462}};function I_(e){return(e==='sage'||e==='light'||e==='editorial')?'sage':'tactical'}",
        1,
    ),
    (
        "sage:{bg:15330787,coast:1713436,gridA:13686472,gridB:12108462}",
        "sage:{bg:16118765,coast:1710614,gridA:15131610,gridB:14276042}",
        1,
    ),
    (
        "gv=I_((()=>{try{return localStorage.getItem(`eq-theme`)}catch{return`tactical`}})());",
        "gv=I_((()=>{try{return document.documentElement.getAttribute('data-theme')||localStorage.getItem('eq-theme')}catch{return'sage'}})());try{window.__setQuakeTheme=function(t){ax(t)}}catch(e){};",
        1,
    ),
]


def main():
    s = P.read_text(encoding="utf-8")
    for old, new, expect in REPLACEMENTS:
        n = s.count(old)
        if n != expect:
            print("skip %r: found %d, expected %d" % (old, n, expect))
            continue
        s = s.replace(old, new)
        print("patched %r -> %r" % (old, new))
    P.write_text(s, encoding="utf-8")


if __name__ == "__main__":
    main()
