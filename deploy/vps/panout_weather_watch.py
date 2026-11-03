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
            return f"{rid} week 覆盖不足（到 {axis[-1]}）"
    # 2026-11-03:部署切换不是原子的 —— 边缘还在回上一版时,新 URL 的请求会拿到旧正文,
    # 长缓存会把它钉在那个 URL 上一整个 max-age(当天天气刷新就是因此被判失败并回滚)。
    # 判据因此反过来:data.js 必须每次校验。
    cache = headers.get("cache-control", "")
    if "immutable" in cache or "max-age=31536000" in cache:
        return f"data.js 被长缓存钉住(新版 URL 会锁住旧正文): {cache}"
    if "max-age=0" not in cache and "no-cache" not in cache:
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
