#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_hant_tables.py — 从 OpenCC 生成 `src/hant_data.py`(繁体页词表)。

只在本机跑(需要 `pip install opencc`)。线上构建机不装 opencc:构建只读
生成好的 `src/hant_data.py`,再用 `src/hant.py` 里的等价实现转换。

词表口径:
  STCharacters  全量(整字简化 → 繁体)
  TWVariants    全量(繁体 → 台湾用字)
  STPhrases     裁剪为「键的每个字都出现在站点简体文案字符集里」的条目

裁剪是**保真**的:只要文本里用到的字都在这套字符集里,任何能命中的词组键都
必然被保留(它的每个字都在文本里出现过)。`src/hant.py:assert_covered()` 在
构建时核对这条前提——文案用到新字时构建直接报错,提示重跑本脚本。

用法:
    python tools/gen_hant_tables.py            # 重新生成
    python tools/gen_hant_tables.py --check    # 只核对,不写文件
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = SRC / "hant_data.py"

sys.path.insert(0, str(SRC))


def corpus() -> str:
    """站点上所有简体中文文案(COPY 的 zh 列 + 每页 zh 的 title/description)。"""
    import build as B  # noqa: PLC0415 — 需要 SRC 先进 sys.path

    parts = [v[1] for v in B.COPY.values()]
    for page in B.PAGE_META:
        for lang in ("zh-Hans",):
            if lang in B.PAGE_META[page]:
                parts.append(B.PAGE_META[page][lang][0])
                parts.append(B.PAGE_META[page][lang][1])
    return " ".join(parts)


def dict_path(name: str) -> str:
    import opencc  # noqa: PLC0415

    return os.path.join(os.path.dirname(opencc.__file__), "dictionary", name)


def load_pairs(path: str) -> list[tuple[str, str]]:
    rows = []
    for line in (Path(path).read_text(encoding="utf-8")).split("\n"):
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 2 and parts[0].strip():
            rows.append((parts[0], parts[1].split(" ")[0]))
    return rows


def render() -> str:
    text = corpus()
    charset = sorted(set(text))
    phrases = [(k, v) for k, v in load_pairs(dict_path("STPhrases.txt"))
               if set(k) <= set(charset)]
    chars = load_pairs(dict_path("STCharacters.txt"))
    tw = load_pairs(dict_path("TWVariants.txt"))
    maxlen = max(len(k) for k, _ in phrases) if phrases else 2

    def blob(rows: list[tuple[str, str]]) -> str:
        return "\n".join(f"{k}\t{v}" for k, v in rows)

    return (
        "#!/usr/bin/env python3\n"
        "# -*- coding: utf-8 -*-\n"
        f"# 由 tools/gen_hant_tables.py 从 OpenCC 生成,不要手改。\n"
        f"# STPhrases {len(phrases)} 条(按站点简体文案字符集裁剪)/ "
        f"STCharacters {len(chars)} 条 / TWVariants {len(tw)} 条。\n"
        f"CHARS = \"{''.join(charset).replace(chr(92), chr(92) * 2).replace(chr(34), chr(92) + chr(34))}\"\n"
        f"MAXLEN = {maxlen}\n"
        f"PHRASES = \"\"\"{blob(phrases)}\"\"\"\n"
        f"STCHAR = \"\"\"{blob(chars)}\"\"\"\n"
        f"TWVAR = \"\"\"{blob(tw)}\"\"\"\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只比对,不写文件")
    args = ap.parse_args()
    new = render()
    if args.check:
        old = OUT.read_text(encoding="utf-8") if OUT.is_file() else ""
        if old == new:
            print(f"OK {OUT.relative_to(ROOT)} 与 OpenCC 词表一致")
            return 0
        print(f"STALE {OUT.relative_to(ROOT)} — 重跑不带 --check 的脚本")
        return 1
    OUT.write_text(new, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}  ({len(new):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
