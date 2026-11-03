#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""view_i18n.py — 章节视图(app/*/view.js)的 zh-Hant 转换表。

站点给 zh-Hans 的词条是唯一的简体来源。zh-Hant 页不能落回 zh,但章节视图的交互词条
(工具条/图例/提示/面板/海报标注)只有 ja/zh/en 三份来源,所以这里把站内 src/hant.py
的 s2tw 规则**裁剪成一张 JS 表**(`app/hant.js`),由 view.js 在运行时对简体词条逐条
转出 —— 与 COPY 的繁体列是同一套规则、同一份数据(`hant_data.py`),不另维护第二份。

裁剪比 hant.py 更进一步:先按字符集裁(键里每个字都出自章节视图的文案),再按「枚举
出来的域名里真的会被最长匹配选中的键」裁。域名 = 所有含 CJK 的文案字面量的全部
≤MAXLEN 子串 + 全部文案拼接后的 6 字窗口。于是:

  * 域名内(站点自己会渲染的每一条词条,含拼接出来的短串)转换结果与 hant.convert
    逐字相同 —— assert_equivalent() 在构建与本地验收时逐条核对;
  * 被删掉的键在域名内从不被选中,删掉它不改变任何一条结果 —— assert_fresh() 保证
    盘上的 app/hant.js 与重新生成的结果逐字节一致(文案新增字/新增词条就必须重跑
    `python tools/gen_view_hant.py`,而不是悄悄漏转)。

与 hant.py 一样:运行期不依赖 opencc,只依赖生成好的表。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
sys.path.insert(0, str(SRC))

import hant  # noqa: E402
from hant_data import MAXLEN, PHRASES, STCHAR, TWVAR  # noqa: E402

MODULE = ROOT / "app" / "hant.js"
SOURCES = [SRC / "shell.js"] + sorted((ROOT / "app").glob("*/view.js"))

# 单引号/双引号/模板字符串的字面量内容。模板里的 ${...} 会一起被切出来,但域名只看
# 子串,多出来的表达式片段的字也属于「章节视图的文案字符集」,按字符集裁掉即可。
_LIT = re.compile(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"|`([^`\\]*)`")
_CJK = 0x2E80
# 域名里跨边界的窗口长度:拼接窗口只用来覆盖「两个片段紧挨着」的情形,6 字足够
_CROSS = 6


def _load(blob):
    out = {}
    for line in blob.split("\n"):
        if not line:
            continue
        k, v = line.split("\t", 1)
        out[k] = v
    return out


def literals(text):
    """源码里的字符串字面量内容(含模板字面量,含 ${...} 片段)。"""
    out = []
    for m in _LIT.finditer(text):
        out.append(m.group(1) or m.group(2) or m.group(3) or "")
    return out


def source_literals():
    out = []
    for f in SOURCES:
        out.extend(literals(f.read_text(encoding="utf-8")))
    return out


def dom_literals():
    """域名用的文案:含 CJK 的字面量(含日文——日文串里也有简体形,一并验)。"""
    return [s for s in source_literals() if any(ord(c) > _CJK for c in s)]


def chars(texts):
    return set("".join(texts))


def tables(texts=None):
    """裁剪出 (CH, PH, TW):逐字表、词组表、台用字表。"""
    lits = dom_literals() if texts is None else [s for s in texts if any(ord(c) > _CJK for c in s)]
    cs = chars(lits)
    st = _load(STCHAR)
    ph = _load(PHRASES)
    tw = _load(TWVAR)
    D = dict(st)
    D.update(ph)

    used = set()
    for lit in lits:
        body = lit[:400]
        for i in range(len(body)):
            for j in range(i + 2, min(len(body), i + MAXLEN) + 1):
                _select(body[i:j], D, cs, used)
    cat = "".join(lits)
    for i in range(len(cat)):
        _select(cat[i:i + _CROSS], D, cs, used)

    CH = {c: v for c, v in sorted(st.items()) if len(c) == 1 and c in cs and c != v}
    # sorted:set 的迭代顺序随哈希种子变,生成物必须逐字节可复现(assert_fresh 靠这个)
    PH = {k: D[k] for k in sorted(used) if len(k) >= 2}
    TW = {k: v for k, v in sorted(tw.items()) if k != v}
    return CH, PH, TW


def _select(s, D, cs, used):
    """hant.convert 的最长匹配:把选中的键记进 used(裁剪的依据)。"""
    i, n = 0, len(s)
    while i < n:
        for size in range(min(MAXLEN, n - i), 1, -1):
            k = s[i:i + size]
            if k in D and set(k) <= cs:
                used.add(k)
                i += size
                break
        else:
            i += 1
    return used


def to_hant(s, tabs=None):
    """src/hant.py 的 convert() 在裁剪表上的等价实现(生成期与验收期的判据)。"""
    CH, PH, TW = tabs or tables()
    out = []
    i, n = 0, len(s)
    while i < n:
        for size in range(min(MAXLEN, n - i), 1, -1):
            hit = PH.get(s[i:i + size])
            if hit is not None:
                out.append(hit)
                i += size
                break
        else:
            out.append(CH.get(s[i], s[i]))
            i += 1
    return "".join(TW.get(c, c) for c in "".join(out))


def module_text(tabs=None):
    CH, PH, TW = tabs or tables()
    lines = [
        "/* app/hant.js — 生成物,勿手改。",
        "   章节视图(app/<章>/view.js)的 zh-Hant 转换表:简体词条 → 繁体,规则与 src/hant.py 的",
        "   s2tw 一致,按「站点文案字符集 + 域名内实际被选中的键」裁剪后固化。",
        "   改文案后重跑:python tools/gen_view_hant.py(构建期 assert_fresh() 会拦下过期的表)。 */",
        "",
        f"const MAX = {MAXLEN};",
        _js_map("CH", CH),
        _js_map("PH", PH),
        _js_map("TW", TW),
        "",
        "export function toHant(s) {",
        "  if (typeof s !== \"string\") return s;",
        "  let out = \"\";",
        "  for (let i = 0; i < s.length;) {",
        "    let hit = null, step = 1;",
        "    for (let n = Math.min(MAX, s.length - i); n > 1; n--) {",
        "      const k = s.slice(i, i + n);",
        "      if (PH[k] !== undefined) { hit = PH[k]; step = n; break; }",
        "    }",
        "    if (hit === null) { const c = s[i]; hit = CH[c] !== undefined ? CH[c] : c; }",
        "    out += hit;",
        "    i += step;",
        "  }",
        "  let tw = \"\";",
        "  for (const c of out) tw += TW[c] !== undefined ? TW[c] : c;",
        "  return tw;",
        "}",
        "",
    ]
    return "\n".join(lines)


def _js_map(name, tab):
    items = list(tab.items())
    body = []
    line = "  "
    for k, v in items:
        piece = json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) + ","
        if len(line) + len(piece) > 116:
            body.append(line)
            line = "  "
        line += piece
    if line.strip():
        body.append(line)
    return f"const {name} = {{\n" + "\n".join(body) + "\n};"


# ------------------------------------------------------------------ 闸
def fresh_error():
    """盘上的 app/hant.js 与重新生成的结果不一致时返回原因。"""
    if not MODULE.is_file():
        return f"{MODULE.name} 不存在——跑 python tools/gen_view_hant.py"
    disk = MODULE.read_text(encoding="utf-8")
    want = module_text()
    if disk != want:
        return (f"{MODULE.name} 与当前文案生成的表不一致(文案改了字没重跑生成脚本?)"
                f"——跑 python tools/gen_view_hant.py")
    return None


def assert_fresh():
    err = fresh_error()
    if err:
        raise SystemExit("view_i18n: " + err)


def mismatch(tabs=None):
    """域名内与 src/hant.convert 不一致的文案(空列表 = 等价)。"""
    tabs = tabs or tables()
    bad = []
    for s in dom_literals():
        if to_hant(s, tabs) != hant.convert(s):
            bad.append(s)
    return bad


def assert_equivalent():
    bad = mismatch()
    if bad:
        raise SystemExit(
            f"view_i18n: app/hant.js 的表在这些文案上与 src/hant.py 的转换结果不同"
            f"(表过期或手改):{bad[:3]!r}——跑 python tools/gen_view_hant.py 重新生成。"
        )


# 手写的那几处 zh-Hant 词条(shell 的兜底文案等)没法运行时转,只能照 zh 列写死:
# 这里按「同一行上的 zh 与 zh-Hant 是同一个词条」核对,写成别的字就报错。
_PAIR = re.compile(
    r"(?:'zh'|\"zh\"|zh)\s*:\s*(?:'([^']*)'|\"([^\"]*)\")[^\n]*?"
    r"(?:'zh-Hant'|\"zh-Hant\")\s*:\s*(?:'([^']*)'|\"([^\"]*)\")")


def hand_written_mismatches():
    bad = []
    for f in SOURCES:
        for line in f.read_text(encoding="utf-8").split("\n"):
            m = _PAIR.search(line)
            if not m:
                continue
            simp = m.group(1) or m.group(2) or ""
            trad = m.group(3) or m.group(4) or ""
            if hant.convert(simp) != trad:
                bad.append((f.name, simp, trad, hant.convert(simp)))
    return bad


def assert_hand_written():
    bad = hand_written_mismatches()
    if bad:
        f, simp, trad, want = bad[0]
        raise SystemExit(
            f"view_i18n: {f} 里手写的 zh-Hant 词条与 s2tw 结果不同:{simp!r}→{trad!r}"
            f"(应为 {want!r})。"
        )


def check_all():
    """构建与本地验收共用的闸:表新鲜、与 hant.py 等价、手写繁体无笔误。"""
    assert_fresh()
    assert_equivalent()
    assert_hand_written()


if __name__ == "__main__":
    check_all()
    CH, PH, TW = tables()
    print(f"view_i18n: OK · CH {len(CH)} · PH {len(PH)} · TW {len(TW)} · "
          f"模块 {MODULE.stat().st_size} B")
