#!/usr/bin/env python
"""导出给外部 LLM（Gemini 网页版）评审用的纯文本包。

输入：仓库里的源文件 + 构建产物 site/*.html
输出：.review/text/ 下的若干 *.txt（UTF-8），外加 .review/manifest.txt

约定：
- 二进制（字体、echarts/quake vendor、polygon/quakes 数据）不入包，只在 manifest 里记名字与体积。
- 内联 SVG 的 path 数据压成占位符，保留结构可读性。
- 每个包开头写文件清单、字节数，包内每个文件用小节头分隔，便于评审逐段引用。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".review" / "text"

# 单个包：(输出名, 标题, [源文件相对路径])
PACKS: list[tuple[str, str, list[str]]] = [
    (
        "B_HTML.txt",
        "渲染后的 HTML（构建产物 site/，内联 SVG path 数据已压缩）",
        [
            "site/index.html",
            "site/cabinet/index.html",
            "site/crime/index.html",
            "site/quake/index.html",
        ],
    ),
    (
        "C_CSS.txt",
        "全站样式表",
        [
            "src/packs/ouuut-editorial/css/type.css",
            "src/packs/ouuut-editorial/css/all.css",
            "src/theme-overrides.css",
            "src/app.css",
            "src/home-preview.css",
        ],
    ),
    (
        "D_JS.txt",
        "客户端脚本（页壳 + 三个章节应用的 view 模块）",
        [
            "src/shell.js",
            "app/cabinet/view.js",
            "app/crime/view.js",
            "app/quake/view.js",
        ],
    ),
]

# 体积大但需要露脸的：只取结构 + 少量样本
SAMPLES = [
    ("app/cabinet/data.json", 2600),
    ("app/crime/data/points.json", 900),
    ("app/quake/data/japan-outline.json", 400),
]

SVG_ATTR = re.compile(r'\b(d|points|d2)="([^"]{60,})"')
DATA_URI = re.compile(r'data:image/[a-z+]+;base64,[A-Za-z0-9+/=]{60,}')


def compress(text: str) -> str:
    """压掉不可读的长串：SVG 路径数据、base64。"""
    def _attr(m: re.Match[str]) -> str:
        return f'{m.group(1)}="[{len(m.group(2))} chars of geometry data omitted]"'

    text = SVG_ATTR.sub(_attr, text)
    text = DATA_URI.sub("[base64 image omitted]", text)
    return text


def section(path: str, body: str) -> str:
    body = body.rstrip("\n")
    lines = body.count("\n") + 1
    return (
        "\n"
        + "=" * 78
        + f"\n=== FILE: {path}  ({len(body)} bytes, {lines} lines)\n"
        + "=" * 78
        + "\n\n"
        + body
        + "\n"
    )


def build_packs() -> list[tuple[Path, str, int]]:
    written = []
    for name, title, files in PACKS:
        chunks = [
            f"{name}\n{title}\n"
            f"仓库：japan.ouuut.com（panout-japan）。下面每个 === FILE: ... === 小节是一个文件的完整内容。\n"
        ]
        for rel in files:
            p = ROOT / rel
            if not p.exists():
                print(f"!! missing {rel}", file=sys.stderr)
                continue
            chunks.append(section(rel, compress(p.read_text(encoding="utf-8"))))
        OUT.mkdir(parents=True, exist_ok=True)
        dest = OUT / name
        dest.write_text("".join(chunks), encoding="utf-8")
        written.append((dest, title, dest.stat().st_size))
    return written


def build_data_sample() -> Path:
    parts = [
        "E_DATA.txt\n数据文件结构（JSON 太大，只给结构 + 头部样本）\n"
        "站点数据不入包：quake 瓦片 75MB、crime 町丁目多边形 10MB、cabinet 逐月调查 130KB。\n"
    ]
    for rel, limit in SAMPLES:
        p = ROOT / rel
        if not p.exists():
            print(f"!! missing {rel}", file=sys.stderr)
            continue
        raw = p.read_text(encoding="utf-8")
        head = raw[:limit]
        parts.append(
            section(
                rel + "（截断样本）",
                f"[total {len(raw)} bytes; first {len(head)} bytes follow]\n\n{head}\n\n[...truncated...]",
            )
        )
    dest = OUT / "E_DATA.txt"
    dest.write_text("".join(parts), encoding="utf-8")
    return dest


def build_manifest(entries: list[tuple[Path, str, int]], extra: list[Path]) -> Path:
    lines = ["# 评审包清单\n"]
    for dest, title, size in entries:
        lines.append(f"- {dest.name:<14} {size / 1024:8.1f} KB  {title}")
    for dest in extra:
        lines.append(f"- {dest.name:<14} {dest.stat().st_size / 1024:8.1f} KB  数据样本")
    lines.append("\n## 刻意未入包的体积/二进制\n")
    for rel in [
        "app/quake/data/quakes/tiles/*.json（USGS 瓦片，75MB，构建期按需加载）",
        "app/crime/data/chome_poly.json + muni_poly.json（10MB 町丁目/市区町村边界）",
        "app/cabinet/data.json（130KB 逐月调查明细）",
        "app/cabinet/vendor/echarts.min.js（1MB 压缩库）",
        "app/quake/vendor/quake-core.js（746KB 压缩库）",
        "site/assets/fonts/*.woff2（自制子集，15 文件 2.7MB）",
    ]:
        lines.append(f"- {rel}")
    dest = ROOT / ".review" / "manifest.txt"
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dest


def main() -> None:
    entries = build_packs()
    data = build_data_sample()
    manifest = build_manifest(entries, [data])
    print(manifest.read_text(encoding="utf-8"))
    total = sum(e[2] for e in entries) + data.stat().st_size
    print(f"text bundle total: {total / 1024:.1f} KB -> {OUT}")


if __name__ == "__main__":
    main()
