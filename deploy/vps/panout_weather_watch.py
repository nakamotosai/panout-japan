#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""External watchdog for the daily Pan Out Japan weather refresh.

Read-only: checks the refresh state, the production page and the data.js it
publishes, then pushes Kuma monitor panout-weather-refresh. Incidents go through
watchdog_common so the TG event layer stays separate from the Kuma red/green.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from watchdog_common import incident_alert, incident_recovered  # noqa: E402

PROBE = "panout-weather"
HB = "panout-weather-refresh"
STATE = Path("/home/ubuntu/.cache/panout-weather/state.json")
SITE = "https://japan.ouuut.com"
UA = {"User-Agent": "panout-weather-watch/1.0"}
JST = dt.timezone(dt.timedelta(hours=9))
DEADLINE = dt.time(6, 40)
MAX_AGE = dt.timedelta(hours=26)
DATA_RE = re.compile(r"/assets/weather/data\.js(?:\?v=[0-9a-f]+)?")


def fetch(path: str, timeout: int = 25) -> tuple[int, bytes, dict]:
    last: Exception | None = None
    for _ in range(2):
        try:
            req = urllib.request.Request(SITE + path, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.status, response.read(), {
                    key.lower(): value for key, value in response.headers.items()
                }
        except Exception as exc:  # retry once, then surface the last error
            last = exc
    raise RuntimeError(str(last))


def iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def jst_date(value: object, field: str) -> dt.date:
    """Parse an ISO timestamp (JST-normalised) into its JST calendar date."""
    if not value:
        raise ValueError(f"缺少 {field}")
    try:
        return iso(str(value)).astimezone(JST).date()
    except Exception:
        raise ValueError(f"{field} 无法解析: {value}")


def freshness_error(payload: dict, now_jst: dt.datetime) -> str | None:
    """Judge production freshness from production's own bytes.

    2026-11-04: a manual deploy from a checkout that had not pulled the pipeline's
    data commit served the 11-03 snapshot for ~5h while the page labelled it
    "today". The old probe missed it because every check was anchored to
    ~/.cache/panout-weather/state.json, which was stale in exactly the same way.
    This helper reads only the payload served by production.
    """
    try:
        generated_date = jst_date(payload.get("generatedAt"), "generatedAt")
    except ValueError as exc:
        return f"线上快照 {exc}"
    raw_report = payload.get("reportDatetime")
    if not raw_report:
        regions = payload.get("regions") or []
        raw_report = next(
            (r.get("reportDatetime") for r in regions if r.get("reportDatetime")), None
        )
    if not raw_report:
        raw_report = payload.get("generatedAt")
    try:
        report_date = jst_date(raw_report, "reportDatetime")
    except ValueError as exc:
        return f"线上快照 {exc}"
    # 2026-11-04:JMA 发布日与抓取日不是同一天 = 混装/过期构建(手动部署把 11-03 的
    # Snapshot 放在 11-04 的页面,页面却标成「今天」)。这两个日期必须一致。
    if report_date != generated_date:
        return f"线上快照日期混装: 发布 {report_date} != 抓取 {generated_date}"
    # 当天 06:10 的刷新跑完前,昨天那份仍是正常在线的;06:40 之后必须已经是今天。
    if now_jst.time() >= DEADLINE:
        if report_date != now_jst.date():
            return f"线上快照过期: 发布 {report_date} 不是今天(已过 06:40 JST)"
    elif report_date not in (now_jst.date(), now_jst.date() - dt.timedelta(days=1)):
        return f"线上快照过期: 发布 {report_date}(今天 {now_jst.date()})"
    return None


def check() -> str | None:
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except Exception as exc:
        return f"state.json 读取失败: {exc}"
    for key in ("last_success_date", "generatedAt", "deployment_id"):
        if not state.get(key):
            return f"state.json 缺少 {key}"
    try:
        generated = iso(state["generatedAt"])
    except Exception as exc:
        return f"generatedAt 无效: {exc}"

    now = dt.datetime.now(dt.timezone.utc)
    if now - generated > MAX_AGE:
        return f"快照超过 26h: {state['generatedAt']}"
    generated_date = generated.astimezone(JST).date().isoformat()
    if state["last_success_date"] != generated_date:
        return f"last_success_date {state['last_success_date']} != generatedAt {generated_date}"

    failure = state.get("last_failure_at")
    if failure:
        try:
            if iso(failure) > generated:
                return f"最近一次刷新失败: {str(state.get('last_error') or '')[:140]}"
        except Exception:
            return f"last_failure_at 无效: {failure}"

    now_jst = dt.datetime.now(JST)
    today = now_jst.date().isoformat()
    yesterday = (now_jst.date() - dt.timedelta(days=1)).isoformat()
    if now_jst.time() >= DEADLINE:
        if state["last_success_date"] != today:
            return f"06:40 JST 后仍未成功: last_success_date={state['last_success_date']}"
    elif state["last_success_date"] not in (today, yesterday):
        return f"last_success_date 过期: {state['last_success_date']}"

    try:
        code, raw, _ = fetch("/weather/")
    except Exception as exc:
        return f"/weather/ 抓取失败: {exc}"
    if code != 200:
        return f"/weather/ HTTP {code}"
    html = raw.decode("utf-8", "replace")
    if "日本の天気" not in html:
        return "/weather/ 缺少 H1"
    match = DATA_RE.search(html)
    if not match:
        return "/weather/ 未引用 data.js"

    try:
        code, raw, headers = fetch(match.group(0))
    except Exception as exc:
        return f"data.js 抓取失败: {exc}"
    if code != 200:
        return f"data.js HTTP {code}"
    text = raw.decode("utf-8", "replace")
    if "window.WEATHER_DATA=" not in text:
        return "data.js 缺少 window.WEATHER_DATA"
    try:
        payload = json.loads(text.split("=", 1)[1].rstrip().rstrip(";"))
    except Exception as exc:
        return f"data.js 解析失败: {exc}"
    if payload.get("generatedAt") != state["generatedAt"]:
        return f"线上 generatedAt {payload.get('generatedAt')} != state {state['generatedAt']}"
    regions = payload.get("regions") or []
    if len(regions) != 47:
        return f"线上 region 数 {len(regions)} != 47"
    # 2026-11-02：JMA 周间轴随发布时刻漂移 —— 17:00 产品覆盖「次日起 7 天」，但每日
    # 06:10 刷新拿到的是前一天 17:00 那份，week[0] 就是当天。两种都合法（前端已按日期
    # 对齐），判据改成：连续 7 天、起点是今天或明天、末尾覆盖到 +6。
    base = dt.date.fromisoformat(state["last_success_date"])
    for region in regions:
        rid = region.get("id", "?")
        if not str(region.get("reportDatetime", "")).startswith(state["last_success_date"]):
            return f"{rid} reportDatetime 与 last_success_date 不一致"
        week = region.get("week") or []
        try:
            axis = [dt.date.fromisoformat(str(day.get("date") or "")) for day in week]
        except ValueError:
            return f"{rid} week 日期无法解析"
        if len(axis) != 7:
            return f"{rid} week 长度 {len(axis)} != 7"
        if axis[0] not in (base, base + dt.timedelta(days=1)):
            return f"{rid} week 起点 {axis[0]} 不是 {base} 或 {base + dt.timedelta(days=1)}"
        if any((b - a).days != 1 for a, b in zip(axis, axis[1:])):
            return f"{rid} week 日期不连续"
        if axis[-1] < base + dt.timedelta(days=6):
            return f"{rid} week 覆盖不足(到 {axis[-1]})"
    # 2026-11-04:线上自己的字节说了算 —— 即使 state.json 与陈旧快照一致,也要报错。
    stale = freshness_error(payload, now_jst)
    if stale:
        return stale
    # 2026-11-03:长缓存会把「部署切换窗口里填进来的旧正文」钉在新版 URL 上(当天两次
    # 事故都是这一类:?v=a1513657 钉住 11-02 快照,裸路径条目钉了 29.6h 且 purge 权限
    # 为 0)。判据:不得 immutable、不得 ≥1 天、必须每次校验;zone 的 browser cache TTL
    # 会把我们写的 max-age=0 抬到 4h,所以只卡这两个上界。
    cache = headers.get("cache-control", "")
    if "immutable" in cache:
        return f"data.js 被 immutable 钉住(新版 URL 会锁住旧正文): {cache}"
    longest = max((int(m) for m in re.findall(r"max-age=(\d+)", cache)), default=0)
    if longest >= 86400:
        return f"data.js 被长缓存 {longest}s(切换窗口的旧正文会被钉住): {cache}"
    if not any(w in cache for w in ("must-revalidate", "no-cache", "no-store")):
        return f"data.js 不是每次校验: {cache}"
    return None


def main() -> int:
    error = check()
    if error:
        incident_alert(PROBE, "weather-refresh", error[:180], heartbeat=HB)
        return 0
    incident_recovered(PROBE, HB)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
