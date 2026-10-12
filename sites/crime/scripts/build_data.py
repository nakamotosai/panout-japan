#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""东京犯罪地图全都町丁管线
输入 raw/: crime_R7.csv(年累计) crime_R8.csv(当年月次累计) pop_R8_t5.csv(住基人口第5表)
输出 data/: chome.json(全都町丁明细+分档) wards.json(23区聚合+分档,旧站兼容) meta.json(口径/出处/更新)
口径: 只用批量合计; 评分=相对参考分档(A-E), 非官方评价; 小人口收缩K=2000; 对数标准化; 都内分位数切档。
町丁键=crime原名(NFKC):23区/多摩/岛直收;郡前缀与島前缀原样保留(西多摩郡瑞穂町…/三宅島三宅村…/八丈島八丈町…);
裸区市名/計行/23区計等聚合行排除;异体字(麹/麴)与IVS不归一,miss即pop_missing由站内灰显。
"""
import csv, json, math, os, re, unicodedata
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "raw")
OUT = os.path.join(BASE, "data")

# 全都区市町村(geo顺):23区+多摩26市3町1村+岛2町7村;郡前缀/島前缀名仍以前缀归属
MUNIS = ["千代田区","中央区","港区","新宿区","文京区","台東区","墨田区","江東区",
           "品川区","目黒区","大田区","世田谷区","渋谷区","中野区","杉並区",
           "豊島区","北区","荒川区","板橋区","練馬区","足立区","葛飾区","江戸川区",
           "八王子市","立川市","武蔵野市","三鷹市","青梅市","府中市","昭島市","調布市",
           "町田市","小金井市","小平市","日野市","東村山市","国分寺市","国立市","福生市",
           "狛江市","東大和市","清瀬市","東久留米市","武蔵村山市","多摩市","稲城市",
           "羽村市","あきる野市","西東京市","瑞穂町","日の出町","檜原村","奥多摩町",
           "大島町","利島村","新島村","神津島村","三宅村","御蔵島村","八丈町","青ヶ島村","小笠原村"]
# crime侧别名→归属(键保留原名,只定ward):郡前缀4+島前缀2
MUNI_ALIAS = {"西多摩郡瑞穂町":"瑞穂町","西多摩郡日の出町":"日の出町","西多摩郡檜原村":"檜原村",
               "西多摩郡奥多摩町":"奥多摩町","三宅島三宅村":"三宅村","八丈島八丈町":"八丈町"}
CATS = {  # 输出大类: (列名前缀匹配) 中文名
    "total": ("総合計", "全部刑法犯"),
    "violent": ("凶悪犯計", "凶恶犯"),
    "rough": ("粗暴犯計", "粗暴犯"),
    "breakin": ("侵入窃盗計", "入室盗窃"),
    "nonbreakin": ("非侵入窃盗計", "非入室盗窃"),
    "other": ("その他計", "其他"),
}
WEIGHTS = {"breakin": 3.0, "rough": 2.5, "violent": 3.0, "nonbreakin": 1.0, "other": 1.0}
K_SMOOTH = 2000

KANJI = "一二三四五六七八九"
def kj2num(s):
    def rep(m):
        k = m.group(1)
        if k == "十": n = 10
        elif len(k) == 2 and "十" in k:
            if k[0] == "十": n = 10 + KANJI.index(k[1]) + 1
            else: n = (KANJI.index(k[0])+1) * 10
        elif len(k) == 3 and k[1] == "十":
            n = (KANJI.index(k[0])+1)*10 + KANJI.index(k[2])+1
        else:
            n = KANJI.index(k) + 1 if k in KANJI else 0
        return str(n) + "丁目"
    return re.sub(r"([一二三四五六七八九十]{1,3})丁目", rep, s)

AGGREGATES = ("23区計", "多摩地区・島部計", "他県", "海外認知", "不明", "合計")

def muni_of(name):
    for m in sorted(MUNIS, key=len, reverse=True):
        if name.startswith(m):
            return m
    for pre, m in MUNI_ALIAS.items():
        if name.startswith(pre):
            return m
    return None

def load_crime(path):
    with open(path, encoding="cp932") as fh:
        rows = list(csv.reader(fh))
    hdr, body = rows[0], rows[1:]
    idx = {c: i for i, c in enumerate(hdr)}
    chome = {}
    for r in body:
        raw = unicodedata.normalize("NFKC", r[0]).strip()
        if not raw or raw in AGGREGATES or raw.endswith("計"):
            continue  # 計行/都全体合计/他県/不明:不进町丁
        m = muni_of(raw)
        if m is None or raw == m or raw in MUNI_ALIAS:
            continue  # 裸区市名/郡島长名裸名(西多摩郡瑞穂町…/三宅島三宅村…)=合计行,不进町丁
        vals = {}
        for c in idx:
            if c == "市区町丁": continue
            try: vals[c] = int(r[idx[c]])
            except: vals[c] = 0
        chome[raw] = vals  # 后行覆盖前行:去重西多摩郡檜原村/神津島村重复
    return hdr, chome

def strip_vs(s):
    return "".join(c for c in s if not (0xE0100 <= ord(c) <= 0xE01EF or 0xFE00 <= ord(c) <= 0xFE0F))

def load_pop(path):
    with open(path, encoding="utf-8-sig") as fh:
        rows = list(csv.reader(fh))
    pop = {}
    for r in rows[1:]:
        if len(r) < 6 or r[2] != "1" or not r[1]: continue
        name = unicodedata.normalize("NFKC", strip_vs(r[1] + kj2num(r[3].replace("　","").replace(" ",""))))
        try: p = int(r[5]) if r[5] not in ("-","") else 0
        except: p = 0
        pop[name] = p  # 大塚󠄄→大塚,去IVS后直连crime
    return pop

def cat_vals(vals):
    out = {}
    for key, (col, _zh) in CATS.items():
        out[key] = vals.get(col, 0)
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    hdr, chome7 = load_crime(os.path.join(RAW, "crime_R7.csv"))
    _, chome8 = load_crime(os.path.join(RAW, "crime_R8.csv"))
    pop = load_pop(os.path.join(RAW, "pop_R8_t5.csv"))

    # 町丁: R7∪R8并集;人口直连+郡島别名;ward=归属;缺人口标pop_missing由站内灰显
    chomes = {}
    nopop = []
    for name in sorted(set(chome7) | set(chome8)):
        v7 = chome7.get(name); v8 = chome8.get(name)
        key = unicodedata.normalize("NFKC", strip_vs(name))
        p = pop.get(key, 0)
        if p == 0 and "麹町" in key:
            p = pop.get(key.replace("麹町", "麴町"), 0)  # 住基表用旧字体麴,crime用麹,同地
        if p == 0:
            # 郡島别名:crime西多摩郡瑞穂町…→pop瑞穂町…;三宅島三宅村…→pop三宅村…;八丈島八丈町…→pop八丈町…
            for pre, short in MUNI_ALIAS.items():
                if name.startswith(pre):
                    p = pop.get(short + name[len(pre):], 0)
                    if p: break
        if p == 0: nopop.append(name)
        m = muni_of(name)
        chomes[name] = {"ward": m,
                        "R7": cat_vals(v7) if v7 else {k: 0 for k in list(CATS)},
                        "R8cum": cat_vals(v8) if v8 else {k: 0 for k in list(CATS)},
                        "pop": p, "pop_missing": p == 0}
    # 评分: R = Σw*r(千人率); 收缩; log标准化; 都内分位数 A-E
    wmean = {}
    for ck in list(CATS):
        num = sum(c["R7"][ck] for c in chomes.values() if not c["pop_missing"])
        den = sum(c["pop"] for c in chomes.values() if not c["pop_missing"])
        wmean[ck] = num / max(den, 1) * 1000
    R = {}
    for name, c in chomes.items():
        if c["pop_missing"] or c["pop"] <= 0:
            R[name] = None; continue
        r = 0.0
        for ck, w in WEIGHTS.items():
            r += w * (c["R7"][ck] / c["pop"] * 1000)
        base = sum(WEIGHTS[ck] * wmean[ck] for ck in WEIGHTS)
        R[name] = (c["pop"]/(c["pop"]+K_SMOOTH))*r + (K_SMOOTH/(c["pop"]+K_SMOOTH))*base
    vals = sorted(v for v in R.values() if v is not None)
    logs = [math.log1p(v) for v in vals]
    mu = sum(logs)/len(logs)
    sd = (sum((x-mu)**2 for x in logs)/len(logs)) ** 0.5 or 1.0
    S = {n: None if v is None else max(0, min(100, 100-20*(math.log1p(v)-mu)/sd)) for n, v in R.items()}
    # 分档: R越小=相对越安全, 按R升序排, A=最安全的20%
    ranked = sorted((n for n, v in R.items() if v is not None), key=lambda n: R[n])
    N = len(ranked)
    gr = {}
    for i, n in enumerate(ranked):
        q = 1 - i / N  # 越大越安全
        gr[n] = "A" if q >= 0.8 else "B" if q >= 0.6 else "C" if q >= 0.4 else "D" if q >= 0.2 else "E"
    for name, c in chomes.items():
        c["score"] = round(S[name], 1) if S[name] is not None else None
        c["grade"] = gr.get(name, "*")
    with open(os.path.join(OUT, "chome.json"), "w", encoding="utf-8") as fh:
        json.dump([{"name": n, **c} for n, c in sorted(chomes.items())], fh, ensure_ascii=False)
    meta = {
        "sources": [
            {"name": "警視庁 区市町村の町丁別、罪種別及び手口別認知件数(令和7年・年計)",
             "url": "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html",
             "license": "CC BY（東京都オープンデータカタログ catalog.data.metro.tokyo.lg.jp/dataset/t000022d0000100001）"},
            {"name": "警視庁 同(R8・月次累計)",
             "url": "https://www.keishicho.metro.tokyo.lg.jp/about_mpd/jokyo_tokei/jokyo/ninchikensu.html",
             "license": "CC BY"},
            {"name": "住民基本台帳による東京都の世帯と人口 第5表(令和8年1月1日)",
             "url": "https://catalog.data.metro.tokyo.lg.jp/dataset/t000003d0000000577",
             "license": "CC BY"},
            {"name": "区界ポリゴン dataofjapan/land tokyo.geojson（配布元:地球地図日本）",
             "url": "https://github.com/dataofjapan/land",
             "license": "出典明記（営利目的は著作権者へ利用報告）"},
            {"name": "底図 国土地理院 淡色地図",
             "url": "https://maps.gsi.go.jp/",
             "license": "国土地理院コンテンツ利用規約"},
        ],
        "method": "認知件数(批量合計のみ)を町丁人口で割り千人率化→罪種加权→小人口収縮(K=2000)→対数標準化→都内分位数でA-E分档。分档は相対参考であり官方評価ではない。安全を保証しない。",
        "notes": ["月次は累計値。前月差分=当月累計-上月累計(推定)。",
                  "認知件数≠発案数。届出率の影響を受ける。駅前・繁華街の町丁は昼間人口により高く出る。",
                  "人口欠損町丁(以下不詳・中央防波堤等)は * 表示し分档対象外。",
                  "声かけ・前兆事案に町丁批量はないため本図に含まず。デジポリスへの外部リンクを掲載。",
                  "交通事故を含まない。"],
        "counts": {"chome": len(chomes), "pop_missing": len(nopop), "munis": len(MUNIS)},
        "pop_missing_examples": sorted(set(nopop))[:16],
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print("chome:", len(chomes), "pop_missing:", len(nopop))
    print("grade dist:", {g: sum(1 for c in chomes.values() if c["grade"]==g) for g in "ABCDE*"})

if __name__ == "__main__":
    main()
