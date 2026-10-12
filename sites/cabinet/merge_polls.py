#!/usr/bin/env python3
"""
merge_polls.py — 合并各媒体 poll-<media>.json 进 F:/cabinet-approval/data.json
用法： python merge_polls.py [--dry-run]
"""
import json, os, sys, datetime
from pathlib import Path
from collections import defaultdict

PROJECT = Path("F:/cabinet-approval")
DATA = PROJECT / "data.json"
POLL_FILES = [
    "poll-nikkei.json",
    "poll-asahi.json",
    # poll-yomiuri.json     — 読売会员墙 0 点
    # poll-mainichi.json    — 正则错抓废数据（URL 段落号当成独立 poll / 不支持率当支持率），Advisor reject
    # poll-fnn.json         — 同模式复发第 2 次：20 点 19 条 date 全 fallback 'YYYY-07-01'，URL id 跨年单调增，日期全错，Advisor reject（2026-08-10 同族第 3 次触发 sai-scold §3）
    # poll-kyodo.json / poll-jiji.json / poll-jnn.json — 未直采
]
LOCAL_DIR = Path(os.environ.get("OMP_LOCAL", "C:/Users/sai/.omp/agent/sessions/-omp/2026-08-08T22-36-36-380Z_019fe385-5e9c-7000-890f-f66fac44f8da/local"))

# pm 名单（严格 14 任）
VALID_PMS = {"小渕恵三","森喜朗","小泉純一郎","安倍晋三(1次)","福田康夫","麻生太郎","鳩山由紀夫","菅直人","野田佳彦","安倍晋三(2次)","菅義偉","岸田文雄","石破茂","高市早苗"}

# Cabinet 边界（date 字符串 YYYY-MM-DD 比较）
CABINETS = [
    ("obuchi","小渕恵三","1998-07-30","2000-04-05"),
    ("mori","森喜朗","2000-04-05","2001-04-26"),
    ("koizumi","小泉純一郎","2001-04-26","2006-09-26"),
    ("abe1","安倍晋三(1次)","2006-09-26","2007-09-26"),
    ("fukuda","福田康夫","2007-09-26","2008-09-24"),
    ("aso","麻生太郎","2008-09-24","2009-09-16"),
    ("hatoyama","鳩山由紀夫","2009-09-16","2010-06-08"),
    ("kan","菅直人","2010-06-08","2011-09-02"),
    ("noda","野田佳彦","2011-09-02","2012-12-26"),
    ("abe2","安倍晋三(2次)","2012-12-26","2020-09-16"),
    ("suga","菅義偉","2020-09-16","2021-10-04"),
    ("kishida","岸田文雄","2021-10-04","2024-10-01"),
    ("ishiba","石破茂","2024-10-02","2025-10-21"),
    ("takaichi","高市早苗","2025-10-21","2030-12-31"),
]

def pm_by_date(date_str):
    d = date_str
    for cid, pm, start, end in CABINETS:
        if start <= d < end:
            return pm
    return None

def main():
    dry = "--dry-run" in sys.argv
    data = json.load(open(DATA, encoding="utf-8"))
    existing = data["polls"]
    existing_keys = set()
    for p in existing:
        existing_keys.add((p["source"], p["date"], p["value"]))

    new_polls = []
    stats = defaultdict(int)
    errors = []

    for fname in POLL_FILES:
        path = LOCAL_DIR / fname
        if not path.exists():
            print(f"[missing] {fname}")
            stats["missing_files"] += 1
            continue
        try:
            doc = json.load(open(path, encoding="utf-8"))
        except Exception as e:
            print(f"[parse-error] {fname}: {e}")
            stats["parse_error"] += 1
            continue
        media = doc.get("source_name", "?")
        points = doc.get("points", [])
        stats[f"input_{media}"] = len(points)
        kept = 0
        for pt in points:
            # 校验 schema
            date = pt.get("date")
            pm = pt.get("pm")
            val = pt.get("value")
            url = pt.get("url", "")
            if not date or not pm or val is None:
                errors.append(f"{media}: 缺字段 {pt}")
                continue
            if pm not in VALID_PMS:
                # 自动按 date 纠正 pm
                corrected_pm = pm_by_date(date)
                if not corrected_pm:
                    errors.append(f"{media}: pm 不合法且date无法判属 {pt}")
                    continue
                pm = corrected_pm
            # 进一步校验 pm 与 date 一致（survey start 在该首相任期内）
            correct_pm = pm_by_date(date)
            if correct_pm != pm:
                errors.append(f"{media}: pm与date不一致 date={date} claim={pm} actual={correct_pm}")
                pm = correct_pm  # 修正以 date 为准

            # 去重（同 source + date + value）
            key = (media, date, val)
            if key in existing_keys:
                stats[f"dup_skip_{media}"] += 1
                continue
            existing_keys.add(key)

            rec = {
                "date": date,
                "pm": pm,
                "value": float(val),
                "source": media,
                "url": url,
                "derived": False,
                "kind": "月次"
            }
            new_polls.append(rec)
            kept += 1
        stats[f"kept_{media}"] = kept
        print(f"[{media}] input={len(points)} kept={kept}")

    # 报错
    print(f"\n=== errors ({len(errors)}) ===")
    for e in errors[:20]:
        print("  -", e)

    if dry:
        print(f"\n[dry-run] new_polls={len(new_polls)} existing={len(existing)} total_after={len(existing)+len(new_polls)}")
        return

    data["polls"] = existing + new_polls
    data["_meta"]["real_source_count"] = len(data["polls"])
    data["_meta"]["derived_count"] = sum(1 for p in data["polls"] if p.get("derived"))
    # 按日期排序
    data["polls"].sort(key=lambda p: p["date"])
    data["_meta"]["version"] = "8.0-multi-source-monthly-avg"

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = PROJECT / f"_archive_{ts}.json"
    backup.write_text(json.dumps(json.load(open(DATA, encoding="utf-8")), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[backup] {backup}")

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[merged] new_polls={len(new_polls)} total={len(data['polls'])}")
    print(f"[sources] {dict((s[0], sum(1 for p in data['polls'] if p['source']==s[0])) for s in set((p['source'],0) for p in data['polls']))}")

if __name__ == "__main__":
    main()
