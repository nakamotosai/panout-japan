#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_og_cards.py — 生成站点 28 张 og:image 卡片(7 页 × 4 语,1200×630)。

文案只有一个来源:src/build.py。标题取 PAGE_META[key][lang][0]、描述取 [1]、章节名走
tr('nav.*')、作者走 person_node()、品牌与语言名走 BRAND / LANG_NAMES——本脚本不另抄一份
文案。色值同理,从品牌包 src/packs/ouuut-editorial/css/all.css 里读。章节 01–06 的顺序
本身也在生成前与 build.py 首页的 rows 对齐校验,漂移就报错。

字体实例化 + 子集化的做法照 src/fonts.py:变量字体先 subset 到本次用到的字符集,再
instantiateVariableFont 定权重,存到系统临时目录交给 PIL(仓库里不留中间文件)。

用法:
  python tools/make_og_cards.py            # 生成 28 张并打印校验表
  python tools/make_og_cards.py --verify   # 不生成,只读 PNG 头核对已有卡片
"""
import argparse
import os
import re
import string
import struct
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import build as B  # noqa: E402  (纯元数据:导入不会跑构建)

from PIL import Image, ImageChops, ImageDraw, ImageFont  # noqa: E402
from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib.instancer import instantiateVariableFont  # noqa: E402

# ---------------------------------------------------------------- 版面常量(1× 坐标)
W, H = 1200, 630
SS = 2                      # 2 倍超采样后 LANCZOS 缩回,得到干净的大字边缘
MARGIN_X, MARGIN_Y = 72, 64
X0, X1 = MARGIN_X, W - MARGIN_X          # 72 .. 1128
Y0, Y1 = MARGIN_Y, H - MARGIN_Y          # 64 .. 566
MAX_W = X1 - X0                          # 1056
EYEBROW_BASE = Y0 + 38
TITLE_TOP, TITLE_BOTTOM = Y0 + 74, 358
TITLE_AREA_H = TITLE_BOTTOM - TITLE_TOP
RULE_Y, RULE_W, RULE_H = 386, 88, 3
DESC_TOP, DESC_BOTTOM = 416, 502
DESC_AREA_H = DESC_BOTTOM - DESC_TOP
FOOT_RULE_Y = 526
FOOT_BASE = Y1 - 10                      # 556,让下伸部仍留在 566 之内
STRIP_H = 6
TITLE_BASE, TITLE_FLOOR, TITLE_LINES, TITLE_LH = 92, 52, 2, 1.16
DESC_BASE, DESC_FLOOR, DESC_LINES, DESC_LH = 30, 20, 2, 1.40
EYEBROW_NUM_SIZE, EYEBROW_NAME_SIZE, EYEBROW_TRACK = 30, 26, 6
WORDMARK_SIZE = 44
FOOT_SIZE = 21

KEYS = ("home", "weather", "quake", "crime", "cabinet", "housing", "population")
CHAPTERS = ("weather", "quake", "crime", "cabinet", "housing", "population")

# ---------------------------------------------------------------- 字体
SC_DIR = Path(os.environ.get("PANOUT_SC_FONTS", "F:/projects/saaaai-v3/tools/.cache"))
LATIN_DIR = Path(os.environ.get("PANOUT_LATIN_FONTS", "F:/projects/ouuut-v2/assets/fonts"))
OUTFIT_SRC = Path(os.environ.get("PANOUT_OUTFIT_FONT",
                                 "F:/archive/20261014-omp-data-retire/dirs/tmp_fonts/outfit.ttf"))
# face → (源文件, 可变字重或 None)
FACES = {
    "serif-jp": (ROOT / ".cache/fonts/NotoSerifJP-VF.ttf", 700),
    "sans-jp": (ROOT / ".cache/fonts/NotoSansJP-VF.ttf", 400),
    "serif-sc": (SC_DIR / "NotoSerifSC[wght].ttf", 700),
    "sans-sc": (SC_DIR / "NotoSansSC[wght].ttf", 400),
    "outfit": (OUTFIT_SRC, 800),
    "serif-en": (LATIN_DIR / "InstrumentSerif-400-normal.woff2", None),
    "geist": (LATIN_DIR / "Geist-400-normal.woff2", None),
    "mono": (LATIN_DIR / "JetBrainsMono-500-normal.woff2", None),
}
# 语言 → (主字体, 备用字体链)。CJK 缺字一律往同语言的另一族退,繁体走 SC 再退 JP。
TITLE_STACK = {
    "ja": ("serif-jp", ("sans-jp",)),
    "zh-Hans": ("serif-sc", ("serif-jp", "sans-sc", "sans-jp")),
    "zh-Hant": ("serif-sc", ("serif-jp", "sans-sc", "sans-jp")),
    "en": ("serif-en", ("geist", "sans-jp")),
}
DESC_STACK = {
    "ja": ("sans-jp", ("serif-jp",)),
    "zh-Hans": ("sans-sc", ("sans-jp", "serif-sc")),
    "zh-Hant": ("sans-sc", ("sans-jp", "serif-sc")),
    "en": ("geist", ("sans-jp", "serif-en")),
}
EYEBROW_STACK = {
    "ja": ("sans-jp", ()),
    "zh-Hans": ("sans-sc", ("sans-jp",)),
    "zh-Hant": ("sans-sc", ("sans-jp",)),
    "en": ("mono", ("sans-jp",)),
}
FOOT_STACK = {
    "ja": ("mono", ("sans-jp",)),
    "zh-Hans": ("mono", ("sans-sc", "sans-jp")),
    "zh-Hant": ("mono", ("sans-sc", "sans-jp")),
    "en": ("mono", ("sans-jp",)),
}

# ---------------------------------------------------------------- 颜色(读品牌包)
CSS = (ROOT / "src/packs/ouuut-editorial/css/all.css").read_text(encoding="utf-8")


def css_token(name):
    m = re.search(r"--%s:\s*(#[0-9A-Fa-f]{6})" % re.escape(name), CSS)
    if not m:
        raise SystemExit("品牌包里找不到 --%s,色值单一来源断了" % name)
    return tuple(int(m.group(1)[i:i + 2], 16) for i in (1, 3, 5))


PAPER = css_token("bg")
INK = css_token("ink")
CHAPTER_COLOR = {k: css_token("c-" + k) for k in CHAPTERS}
SIX_COLOR = [css_token(v.lstrip("-")) for v in B.SIX]      # 与站内六色字标同序
SIX_KEY = {v: i for i, v in enumerate(B.SIX)}


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


DESC_INK = mix(INK, PAPER, 0.22)
FOOT_INK = mix(INK, PAPER, 0.38)
HAIRLINE = mix(INK, PAPER, 0.85)

# ---------------------------------------------------------------- 文案(全部来自 build.py)
_ROW = re.compile(r'\("([a-z]+)",\s*"(\d{2})",\s*"/[a-z]+/"')
_HOME_ROWS = dict(_ROW.findall((ROOT / "src/build.py").read_text(encoding="utf-8")))
for _i, _k in enumerate(CHAPTERS):
    if _HOME_ROWS.get(_k) != "%02d" % (_i + 1):
        raise SystemExit("章节号与 src/build.py 首页 rows 不一致(%s):先对齐再生成卡片"
                         % _k)


def strip_brand(title):
    """去掉标题里的 ` — japan.ouuut.com` / ` | japan.ouuut.com`(域名改由页脚承担)。"""
    t = title.strip()
    for sep in (" — ", " | "):
        if t.endswith(sep + B.BRAND):
            t = t[: -len(sep + B.BRAND)]
        if t.startswith(B.BRAND + sep):
            t = t[len(B.BRAND + sep):]
    t = t.strip()
    if B.BRAND in t:
        raise SystemExit("标题里仍留着品牌域名,PAGE_META 的写法变了?%r" % title)
    return t


def card_text(key, lang):
    B.set_lang(lang)
    title, desc = B.PAGE_META[key][lang]
    chap = B.tr("nav.%s" % key) if key != "home" else None
    return strip_brand(title), desc, chap


def footer_text(lang):
    p = B.person_node()
    return "%s · %s / %s · %s" % (B.BRAND, p["name"], p["alternateName"], B.LANG_NAMES[lang])


# ---------------------------------------------------------------- 排版引擎
CJK_MIN = 0x2E80
BR_OPEN = "「『〔【（(《〈“‘"
BR_CLOSE = "」』〕】）)》〉”’"
NO_START = "、。,:;.!?]}%…・—" + BR_CLOSE      # 不能落在行首
NO_END = BR_OPEN                               # 不能落在行尾


def _is_cjk(ch):
    return ord(ch) >= CJK_MIN


def atomize(text):
    """切成不可再内折的排版块:拉丁词成块(带前导空格),CJK 与标点逐字。

    句读不落行首:以 NO_START 开头的块并进前一块。
    """
    atoms, cur = [], ""
    for ch in text:
        if ch == " ":
            if cur:
                atoms.append(cur)
            cur = " "
            continue
        if _is_cjk(ch):
            atoms.append(cur + ch)
            cur = ""
            continue
        cur += ch
    if cur:
        atoms.append(cur)
    merged, depth = [], 0
    for a in atoms:
        if merged and (depth or a[0] in NO_START):
            merged[-1] += a
        else:
            merged.append(a)
        # 括号成组不拆:开括号进去,闭括号出来;整组超宽时才由 _hard_split 硬拆
        depth += sum(a.count(c) for c in BR_OPEN) - sum(a.count(c) for c in BR_CLOSE)
        depth = max(0, depth)
    return merged


class Fonts:
    """实例化 + 子集化各字体族,并按字符解析字体(缺字自动退到备用族)。"""

    def __init__(self, tmpdir, charset):
        self._dir = Path(tmpdir)
        self._cache, self._cov = {}, {}
        for name, (src, weight) in FACES.items():
            if not Path(src).is_file():
                raise SystemExit("字体缺失:%s" % src)
            dst = self._dir / (name + ".ttf")
            self._build(Path(src), dst, weight, charset)
            self._cov[name] = set(TTFont(str(dst), lazy=True)["cmap"].getBestCmap() or {})

    @staticmethod
    def _build(src, dst, weight, charset):
        f = TTFont(str(src), recalcTimestamp=False)
        if f.flavor:
            f.flavor = None
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.name_languages = ["*"]
        opts.notdef_outline = True
        opts.recalc_bounds = True
        opts.drop_tables += ["DSIG", "SVG "]
        ss = subset.Subsetter(options=opts)
        ss.populate(text=charset)
        ss.subset(f)
        if "fvar" in f and weight is not None:
            instantiateVariableFont(f, {"wght": weight}, inplace=True, updateFontNames=False)
        f.save(str(dst))

    def font(self, name, size):
        key = (name, size)
        if key not in self._cache:
            self._cache[key] = ImageFont.truetype(str(self._dir / (name + ".ttf")), size)
        return self._cache[key]

    def resolve(self, ch, stack):
        """这个字符最终落到哪一族(主字体优先,其次备用链;都没有则 None)。"""
        order = (stack[0],) + tuple(stack[1])
        cp = ord(ch)
        return next((c for c in order if cp in self._cov[c]), None)

    def runs(self, text, stack):
        out = []
        for ch in text:
            name = self.resolve(ch, stack) or stack[0]
            if out and out[-1][0] == name:
                out[-1][1] += ch
            else:
                out.append([name, ch])
        return [(n, t) for n, t in out]

    def width(self, text, stack, size, track=0):
        if not text:
            return 0.0
        w = sum(self.font(n, size).getlength(t) for n, t in self.runs(text, stack))
        return w + track * (len(text) - 1)

    def ink_left(self, text, stack, size):
        """文本首字墨迹相对笔位的左缘(衬线首字母常是负的)。"""
        if not text:
            return 0.0
        name = self.runs(text[:1], stack)[0][0]
        return self.font(name, size).getbbox(text[0])[0]

    def draw_ink_left(self, d, x, baseline, text, stack, size, fill, track=0):
        """把墨迹左缘落在 x 上,首字母的负左边距不会戳出安全框。"""
        return self.draw(d, x - min(0.0, self.ink_left(text, stack, size)), baseline,
                         text, stack, size, fill, track)

    def draw(self, d, x, baseline, text, stack, size, fill, track=0):
        for n, t in self.runs(text, stack):
            f = self.font(n, size)
            d.text((x, baseline), t, font=f, fill=fill, anchor="ls")
            x += f.getlength(t) + track * len(t)
        return x

    def audit(self, text, stack, size=40):
        """返回(各族实际接管的字符集, 出豆腐块的字符集)。

        豆腐块有两种:没有一族带这个字形,或带了这个码位但墨迹是空的。
        """
        use, bad = {}, set()
        for ch in sorted(set(text)):
            name = self.resolve(ch, stack)
            if name is None:
                bad.add(ch)
                continue
            if not ch.isspace() and self.font(name, size).getmask(ch).getbbox() is None:
                bad.add(ch)
                continue
            use.setdefault(name, set()).add(ch)
        return use, bad


def _hard_split(a, F, stack, size, max_w):
    out, cur = [], ""
    for ch in a:
        if cur and F.width(cur + ch, stack, size) > max_w:
            out.append(cur)
            cur = ""
        cur += ch
    out.append(cur)
    return out


def wrap(atoms, F, stack, size, max_w):
    lines, cur = [], ""
    for a in atoms:
        if cur and F.width(cur + a, stack, size) > max_w:
            lines.append(cur)
            cur = ""
        if F.width(a, stack, size) > max_w:
            pieces = _hard_split(a, F, stack, size, max_w)
            lines.extend(pieces[:-1])
            cur = pieces[-1]
        else:
            cur += a
    if cur or not lines:
        lines.append(cur)
    return lines


def fit(atoms, F, stack, base, floor, max_lines, max_w, max_h, lh_factor):
    """逐档降字号直到行数/行高都放得下;末行只剩一两个字的孤行宁可再降一档。

    到 floor 仍放不下就截断加省略号。
    """
    fallback = None
    for size in range(base, floor - 1, -2):
        lines = wrap(atoms, F, stack, size, max_w)
        if len(lines) > max_lines or len(lines) * round(size * lh_factor) > max_h:
            continue
        if len(lines) == 1 or F.width(lines[-1], stack, size) >= 0.25 * max_w:
            return size, lines, False
        if fallback is None:
            fallback = (size, lines, False)
    if fallback:
        return fallback
    keep = list(atoms)
    while len(keep) > 1:
        keep.pop()
        lines = wrap(keep + ["…"], F, stack, floor, max_w)
        if len(lines) <= max_lines:
            txt = "".join(keep).rstrip(" 、,。.··,")
            return floor, wrap(atomize(txt + "…"), F, stack, floor, max_w), True
    return floor, wrap(["…"], F, stack, floor, max_w), True


def block_baselines(n_lines, size, lh_factor, top, area_h):
    lh = round(size * lh_factor)
    y = top + max(0.0, (area_h - n_lines * lh) / 2.0) + 0.82 * lh
    return y, lh


# ---------------------------------------------------------------- 单张卡片
def render(key, lang, F, report):
    title, desc, chap = card_text(key, lang)
    foot = footer_text(lang)
    accent = INK if key == "home" else CHAPTER_COLOR[key]
    img = Image.new("RGB", (W * SS, H * SS), PAPER)
    d = ImageDraw.Draw(img)
    P = lambda v: int(round(v * SS))            # noqa: E731  1× → 画布坐标
    tr_ = lambda v: v * SS                      # noqa: E731  长度/字号

    # 底边色条:章节页是本章色,封面是六色拼条
    strip_y = P(H - STRIP_H)
    if key == "home":
        seg = W * SS / 6
        for i, col in enumerate(SIX_COLOR):
            d.rectangle([round(i * seg), strip_y, round((i + 1) * seg), H * SS], fill=col)
    else:
        d.rectangle([0, strip_y, W * SS, H * SS], fill=accent)

    # 眉标:封面是六色字标,章节页是「01 天気」
    if key == "home":
        wm = F.font("outfit", tr_(WORDMARK_SIZE))
        x = tr_(X0) - min(0.0, F.ink_left(B.BRAND, ("outfit", ()), tr_(WORDMARK_SIZE)))
        for i, ch in enumerate(B.BRAND):
            col = SIX_COLOR[SIX_KEY[B.SIX[B.WM_COLOUR[i]]]] if i in B.WM_COLOUR else INK
            d.text((x, tr_(EYEBROW_BASE)), ch, font=wm, fill=col, anchor="ls")
            x += wm.getlength(ch)
    else:
        num = F.font("mono", tr_(EYEBROW_NUM_SIZE))
        num_str = _HOME_ROWS[key]
        F.draw_ink_left(d, tr_(X0), tr_(EYEBROW_BASE), num_str, ("mono", ()),
                        tr_(EYEBROW_NUM_SIZE), accent)
        x = tr_(X0) + num.getlength(num_str) + tr_(20)
        name = chap.upper() if lang == "en" else chap
        F.draw_ink_left(d, x, tr_(EYEBROW_BASE), name, EYEBROW_STACK[lang],
                        tr_(EYEBROW_NAME_SIZE), INK, track=tr_(EYEBROW_TRACK))

    # 大标题
    t_size, t_lines, t_cut = fit(atomize(title), F, TITLE_STACK[lang],
                                 tr_(TITLE_BASE), tr_(TITLE_FLOOR),
                                 TITLE_LINES, tr_(MAX_W - 2), tr_(TITLE_AREA_H), TITLE_LH)
    y, lh = block_baselines(len(t_lines), t_size, TITLE_LH, tr_(TITLE_TOP),
                            tr_(TITLE_AREA_H))
    for i, line in enumerate(t_lines):
        F.draw_ink_left(d, tr_(X0), y + i * lh, line, TITLE_STACK[lang], t_size, INK)

    # 章节色短线 + 描述
    d.rectangle([tr_(X0), P(RULE_Y), tr_(X0 + RULE_W), P(RULE_Y + RULE_H)], fill=accent)
    d_size, d_lines, d_cut = fit(atomize(desc), F, DESC_STACK[lang],
                                 tr_(DESC_BASE), tr_(DESC_FLOOR),
                                 DESC_LINES, tr_(MAX_W - 2), tr_(DESC_AREA_H), DESC_LH)
    y, lh = block_baselines(len(d_lines), d_size, DESC_LH, tr_(DESC_TOP),
                            tr_(DESC_AREA_H))
    for i, line in enumerate(d_lines):
        F.draw_ink_left(d, tr_(X0), y + i * lh, line, DESC_STACK[lang], d_size, DESC_INK)

    # 页脚
    d.rectangle([tr_(X0), P(FOOT_RULE_Y), tr_(X1), P(FOOT_RULE_Y) + 1], fill=HAIRLINE)
    F.draw_ink_left(d, tr_(X0), tr_(FOOT_BASE), foot, FOOT_STACK[lang], tr_(FOOT_SIZE),
                    FOOT_INK)

    img = img.resize((W, H), Image.LANCZOS)

    # 自查:缺字(豆腐块)、文字越界、非空像素;顺便记下哪些字走了备用族兼顶
    bad, fb = set(), {}
    for text, stack in ((title, TITLE_STACK[lang]), (desc, DESC_STACK[lang]),
                        (foot, FOOT_STACK[lang]), (chap or "", EYEBROW_STACK[lang]),
                        (B.BRAND, ("outfit", ()))):
        use, miss = F.audit(text, stack)
        bad |= miss
        for name, chars in use.items():
            if name != stack[0]:
                fb.setdefault(name, set()).update(c for c in chars if not c.isspace())
    diff = ImageChops.difference(img.crop((0, 0, W, 600)),
                                 Image.new("RGB", (W, 600), PAPER)).convert("L")
    bbox = diff.point(lambda v: 255 if v >= 16 else 0).getbbox()
    ink = sum(diff.histogram()[16:]) / float(W * H)
    issues = []
    if bad:
        issues.append("缺字形:" + " ".join(bad))
    if not bbox:
        issues.append("空白图")
    elif not (X0 - 1 <= bbox[0] and bbox[2] <= X1 + 1 and
              Y0 - 1 <= bbox[1] and bbox[3] <= Y1 + 1):
        issues.append("越出安全框:%s" % (bbox,))
    if not 0.004 <= ink <= 0.4:
        issues.append("墨迹比例异常:%.4f" % ink)

    report.append({
        "key": key, "lang": lang, "size": "%dx%d" % img.size, "ink": ink, "bbox": bbox,
        "issues": issues, "lines": "%d+%d" % (len(t_lines), len(d_lines)),
        "title_px": t_size / SS, "desc_px": d_size / SS,
        "cut": [n for n, c in (("title", t_cut), ("desc", d_cut)) if c],
        "fallback": ",".join("%s×%d" % (n, len(c)) for n, c in sorted(fb.items())),
    })
    return img


def png_header_size(path):
    b = path.read_bytes()
    if b[:8] != b"\x89PNG\r\n\x1a\n" or b[12:16] != b"IHDR":
        raise SystemExit("%s 不是 PNG" % path.name)
    w, h = struct.unpack(">II", b[16:24])
    return w, h, len(b)


def verify(out_dir):
    """只读 PNG 头核对尺寸,并整幅解码一遍(截断的文件在这里就会暴露)。"""
    print("%-11s %-8s %-11s %9s %s" % ("key", "lang", "png-header", "bytes", "decode"))
    ok = True
    for key in KEYS:
        for lang in B.LANGS:
            p = Path(out_dir) / ("%s-%s.png" % (key, lang))
            if not p.is_file():
                print("%-11s %-8s %-11s %9s %s" % (key, lang, "MISSING", "-", "-"))
                ok = False
                continue
            w, h, n = png_header_size(p)
            with Image.open(p) as im:
                im.load()
                dec = "ok" if im.size == (w, h) else "PIL=%s" % (im.size,)
            print("%-11s %-8s %-11s %9d %s" % (key, lang, "%dx%d" % (w, h), n, dec))
            ok = ok and (w, h) == (W, H) and dec == "ok"
    print("28/28 1200×630" if ok else "存在缺失或尺寸不对")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--verify", action="store_true", help="只读 PNG 头核对,不生成")
    ap.add_argument("--out", default=str(ROOT / "assets" / "og"))
    args = ap.parse_args()

    out_dir = Path(args.out)
    if args.verify:
        return verify(out_dir)

    # 先算出所有文案,再据此把字体子集化到刚好够用
    texts, plan = [], []
    for key in KEYS:
        for lang in B.LANGS:
            title, desc, chap = card_text(key, lang)
            foot = footer_text(lang)
            plan.append((key, lang))
            texts.append(title + desc + foot + (chap or "") + B.BRAND)
    charset = "".join(sorted(set("".join(texts) + string.printable + "…·—×→↗°")))
    B.set_lang("ja")

    out_dir.mkdir(parents=True, exist_ok=True)
    report = []
    with tempfile.TemporaryDirectory(prefix="panout-og-", ignore_cleanup_errors=True) as tmp:
        F = Fonts(tmp, charset)
        for key, lang in plan:
            img = render(key, lang, F, report)
            p = out_dir / ("%s-%s.png" % (key, lang))
            img.save(p, "PNG", optimize=True)

    print("%-11s %-8s %-9s %9s %6s %4s %4s %5s %-22s %s"
          % ("key", "lang", "size", "bytes", "ink%", "t/px", "d/px", "lines",
             "ink-bbox", "notes(fallback/cut/issue)"))
    failed = []
    for r in report:
        p = out_dir / ("%s-%s.png" % (r["key"], r["lang"]))
        w, h, n = png_header_size(p)
        if (w, h) != (W, H):
            raise SystemExit("%s-%s 落盘尺寸是 %dx%d" % (r["key"], r["lang"], w, h))
        note = ",".join(r["cut"] + r["issues"])
        if r["issues"]:
            failed.append("%s-%s %s" % (r["key"], r["lang"], " ".join(r["issues"])))
        print("%-11s %-8s %-9s %9d %6.2f %4d %4d %5s %-22s %s"
              % (r["key"], r["lang"], r["size"], n, r["ink"] * 100,
                 r["title_px"], r["desc_px"], r["lines"], str(r["bbox"]),
                 r["fallback"] + (" " + note if note else "")))
    if failed:
        print("FAIL:%d 张有问题:\n  %s" % (len(failed), "\n  ".join(failed)))
        return 1
    print("%d/28 张,全部 %d×%d,PNG 头已复核,无缺字/溢出/空白" % (len(report), W, H))
    return 0


if __name__ == "__main__":
    sys.exit(main())
