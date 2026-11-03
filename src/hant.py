#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""hant.py — 简体 → 繁体(台湾标准,s2tw)转换。

繁体页不是「机翻」,而是把站点自己的简体词条按 OpenCC 的 s2tw 规则转过去
(同一条规则、同一份词表),这样 zh-Hant 与 zh-Hans 的差异只在字形与台用词上。

词表在 `hant_data.py`,由 `tools/gen_hant_tables.py` 从 OpenCC 的
STPhrases / STCharacters / TWVariants 生成:整字表(STCharacters)与台用字表
(TWVariants)全量保留,词组表(STPhrases)按「键里每个字都出现在站点简体文案的
字符集里」裁剪——对只用这些字的任何文本,裁剪后的词组表与原表**等价**。
`assert_covered()` 在构建时核对这条前提:新文案只要用到字符集外的字,构建就
报错并要求重跑生成脚本,而不是悄悄漏转。

运行期不依赖 opencc(线上构建机没装它),只依赖本模块 + 生成好的数据表。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from hant_data import CHARS, MAXLEN, PHRASES, STCHAR, TWVAR  # noqa: E402


def _load(blob):
    out = {}
    for line in blob.split("\n"):
        if not line:
            continue
        k, v = line.split("\t", 1)
        out[k] = v
    return out


# 词组表 + 整字表合成一张 s2tw 的分组词典(OpenCC 的 group dict 语义)
_DICT = _load(STCHAR)
_DICT.update(_load(PHRASES))
_TWVAR = _load(TWVAR)


def convert(s):
    """OpenCC s2tw 的等价实现:最长匹配(MaxMatch)+ 台用字表。"""
    out = []
    i, n = 0, len(s)
    while i < n:
        hit = None
        for size in range(min(MAXLEN, n - i), 1, -1):
            hit = _DICT.get(s[i:i + size])
            if hit is not None:
                out.append(hit)
                i += size
                break
        else:
            out.append(_DICT.get(s[i], s[i]))
            i += 1
    text = "".join(out)
    return "".join(_TWVAR.get(c, c) for c in text)


def uncovered(strings):
    """返回站点文案里超出已建词表字符集的字符(空集 = 词表对当前文案完整)。"""
    seen = set()
    for s in strings:
        seen.update(c for c in s if c not in CHARS)
    return seen


def assert_covered(strings, where="zh-Hans"):
    """构建期闸:文案字符集越界即报错,而不是悄悄漏转。"""
    extra = uncovered(strings)
    if extra:
        raise SystemExit(
            f"hant: {where} 文案出现词表字符集外的字符 {''.join(sorted(extra))!r}——"
            f"请重跑 python tools/gen_hant_tables.py 重新生成 src/hant_data.py "
            f"(否则 zh-Hant 会漏转)。"
        )
