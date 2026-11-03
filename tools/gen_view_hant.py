#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_view_hant.py — 生成 app/hant.js(章节视图的 zh-Hant 转换表)。

规则与裁剪口径都在 src/view_i18n.py(那里也有构建期与本地验收的闸)。改了
app/*/view.js 或 src/shell.js 的文案后重跑本脚本;忘了跑,构建会当场报错。

用法:
  python tools/gen_view_hant.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import view_i18n  # noqa: E402


def main():
    CH, PH, TW = view_i18n.tables()
    view_i18n.MODULE.write_text(view_i18n.module_text((CH, PH, TW)), encoding="utf-8")
    bad = view_i18n.mismatch((CH, PH, TW))
    if bad:
        raise SystemExit(f"生成后仍有不一致的文案:{bad[:3]!r}")
    print(f"wrote {view_i18n.MODULE} · CH {len(CH)} · PH {len(PH)} · TW {len(TW)} · "
          f"{view_i18n.MODULE.stat().st_size} B")


if __name__ == "__main__":
    main()
