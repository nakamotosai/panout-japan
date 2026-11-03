#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Daily production refresh for japan.ouuut.com/weather/.

Flow: fetch JMA -> validate 47 prefectures -> write data.js -> build site ->
verify build -> deploy Cloudflare Pages -> verify production -> commit/push.

Any failure before a verified deployment restores the previous data.js. A
post-deploy verification failure attempts a Cloudflare rollback. The old
snapshot stays live when anything is uncertain.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/weather/data.js"
NOTES = ROOT / "src/weather/DATA-NOTES.md"
GEO = ROOT / "src/weather/geo.js"
SITE = ROOT / "site"
STATE = Path.home() / ".cache/panout-weather/state.json"
CACHE = Path.home() / ".cache/panout-weather/cache"
SITE_URL = "https://japan.ouuut.com"
PROJECT = "panout-site"
WRANGLER = "4.152.0"
UA = "PanOutJapan-WeatherRefresh/1.0 (+https://japan.ouuut.com/weather/)"
JST = dt.timezone(dt.timedelta(hours=9))

sys.path.insert(0, str(ROOT / "tools"))
import weather_data as W  # noqa: E402


def log(message: str) -> None:
    print(f"[{dt.datetime.now(JST).isoformat(timespec='seconds')}] {message}", flush=True)


def today_jst() -> str:
    return dt.datetime.now(JST).date().isoformat()


def load_state() -> dict:
    try:
        return json.loads(STATE.read_text("utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(STATE)


def record_failure(exc: Exception) -> None:
    """Keep the last success but mark the latest attempt as failed for the watchdog."""
    state = load_state()
    state["last_failure_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    state["last_error"] = str(exc)[:300]
    save_state(state)


def run(cmd: list[str], timeout: int = 600, env: dict | None = None) -> subprocess.CompletedProcess:
    log("$ " + " ".join(cmd))
    proc = subprocess.run(cmd, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=timeout)
    if proc.stdout:
        print(proc.stdout.rstrip(), flush=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}")
    return proc


def parse_js_text(text: str, namespace: str) -> dict:
    prefix, suffix = f"window.{namespace}=", ";\n"
    if not text.startswith(prefix) or not text.endswith(suffix):
        raise ValueError(f"Unexpected JavaScript wrapper for {namespace}")
    return json.loads(text[len(prefix):-len(suffix)])


def http_get(url: str, timeout: int = 30) -> tuple[int, dict, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.status, dict(response.headers), response.read()


def weather_version() -> str:
    names = ["app.js", "data.js", "geo.js", "weather.css"]
    payload = "".join((SITE / "assets/weather" / name).read_text("utf-8") for name in sorted(names))
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:8]


def verify_build(data: dict, report: dict) -> None:
    if not SITE.exists():
        raise RuntimeError("site/ was not created")
    for page in ("index.html", "weather/index.html", "quake/index.html", "crime/index.html",
                 "cabinet/index.html", "housing/index.html", "404.html"):
        if not (SITE / page).is_file():
            raise RuntimeError(f"Missing built page: {page}")
    html = (SITE / "weather/index.html").read_text("utf-8")
    if "__WEATHER_VER__" in html or "__CSS_VER__" in html:
        raise RuntimeError("Unresolved placeholder in weather HTML")
    version = weather_version()
    if f"/assets/weather/data.js?v={version}" not in html:
        raise RuntimeError("Weather HTML does not reference the current data version")
    body = html.split("<tbody>", 1)[1].split("</tbody>", 1)[0]
    rows = body.count("<tr>")
    if rows != 47:
        raise RuntimeError(f"Expected 47 no-JS rows, got {rows}")
    built = W.parse_js_object(SITE / "assets/weather/data.js", "WEATHER_DATA")
    if built["generatedAt"] != data["generatedAt"] or len(built["regions"]) != 47:
        raise RuntimeError("Built data.js does not match the validated snapshot")
    log(f"Build verified: 6 pages, 47 rows, weather v{version}, {report['regions']} regions")


def list_production_deployments() -> list[dict]:
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        return []
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{PROJECT}/deployments?env=production&per_page=10"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = json.load(response)
        return [item for item in payload.get("result", []) if item.get("environment") == "production"]
    except Exception as exc:
        log(f"Could not read deployments: {exc}")
        return []


def get_deployment_id() -> str | None:
    for item in list_production_deployments():
        if item.get("id"):
            return item["id"]
    return None


def find_deployment_id(url: str | None) -> str | None:
    if not url:
        return None
    for item in list_production_deployments():
        if item.get("url") == url and item.get("id"):
            return item["id"]
    return None


def rollback(deployment_id: str | None) -> bool:
    if not deployment_id:
        return False
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        return False
    url = f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{PROJECT}/deployments/{deployment_id}/rollback"
    req = urllib.request.Request(url, method="POST", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.load(response)
        return bool(payload.get("success"))
    except Exception as exc:
        log(f"Rollback failed: {exc}")
        return False


def deploy() -> tuple[str | None, str | None]:
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        raise RuntimeError("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are not set")
    npx = shutil.which("npx")
    if not npx:
        raise RuntimeError("npx is not available")
    previous = get_deployment_id()
    proc = run([npx, "--yes", f"wrangler@{WRANGLER}", "pages", "deploy", "site",
                f"--project-name={PROJECT}", "--branch=main"], timeout=900)
    text = proc.stdout or ""
    deployment_id = None
    match = re.search(r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b", text)
    if match:
        deployment_id = match.group(1)
    url_match = re.search(r"https://[a-z0-9-]+\.panout-site\.pages\.dev", text)
    deployment_url = url_match.group(0) if url_match else None
    if deployment_url:
        for _ in range(3):
            deployment_id = find_deployment_id(deployment_url)
            if deployment_id:
                break
            time.sleep(2)
    log(f"Deployed: id={deployment_id or 'unknown'} url={deployment_url or 'unknown'}")
    return deployment_id, deployment_url


def verify_site(base_url: str, expected: str) -> str:
    """Fetch one base URL and check it serves the new snapshot. Returns the cache policy."""
    status, _headers, raw = http_get(base_url + "/weather/")
    if status != 200:
        raise RuntimeError(f"{base_url} /weather/ HTTP {status}")
    html = raw.decode("utf-8", "replace")
    match = re.search(r'src="(/assets/weather/data\.js\?v=[^"]+)"', html)
    if not match:
        raise RuntimeError(f"{base_url} weather HTML does not reference data.js")
    status, headers, raw = http_get(base_url + match.group(1))
    if status != 200:
        raise RuntimeError(f"{base_url} data.js HTTP {status}")
    live = parse_js_text(raw.decode("utf-8"), "WEATHER_DATA")
    if live.get("generatedAt") != expected:
        raise RuntimeError(f"{base_url} live generatedAt {live.get('generatedAt')} != {expected}")
    if len(live.get("regions", [])) != 47:
        raise RuntimeError(f"{base_url} live data does not contain 47 regions")
    cache_control = headers.get("Cache-Control", "")
    if "immutable" not in cache_control and "max-age=31536000" not in cache_control:
        raise RuntimeError(f"{base_url} unexpected data.js cache policy: {cache_control!r}")
    return cache_control


def verify_production(data: dict, deployment_url: str | None = None) -> None:
    """Two stages, because the two failures mean different things.

    The Pages artifact is authoritative and stable the moment ``wrangler`` returns, so a
    failure there is a real defect. The production domain is only re-pointed at the new
    deployment *after* the upload: on 2026-11-03 06:12 JST that lag outlived the old
    3x10s budget (the artifact was already correct at v=a1513657 while japan.ouuut.com
    still served v=6e0b6e42), so a good deployment got rolled back and the refresh was
    lost. Hence: artifact first with a short budget, then the production domain with a
    budget sized for propagation.
    """
    expected = data["generatedAt"]
    if deployment_url:
        last_error = None
        for attempt in range(3):
            try:
                verify_site(deployment_url, expected)
                log(f"Deployment artifact verified: {deployment_url}")
                break
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(5)
        else:
            raise RuntimeError(f"Deployment artifact verification failed: {last_error}")
    attempts, delay = 10, 20
    last_error = None
    for attempt in range(attempts):
        try:
            cache_control = verify_site(SITE_URL, expected)
            log(f"Production verified: {expected}, data.js {cache_control}")
            return
        except Exception as exc:
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(delay)
    raise RuntimeError(f"Production verification failed after {attempts} attempts: {last_error}")


def commit_and_push(data: dict) -> str:
    status = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True).stdout
    allowed = {"src/weather/data.js", "src/weather/DATA-NOTES.md"}
    changed = {line[3:].strip() for line in status.splitlines() if line.strip()}
    extra = changed - allowed
    if extra:
        raise RuntimeError(f"Refusing to commit unrelated changes: {sorted(extra)}")
    run(["git", "add", "src/weather/data.js", "src/weather/DATA-NOTES.md"])
    message = f"weather: refresh {today_jst()}"
    run(["git", "commit", "-m", message])
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True,
                            stdout=subprocess.PIPE, check=True).stdout.strip()
    for remote in ("origin", "gitea"):
        run(["git", "push", remote, "main"], timeout=180)
    for remote in ("origin", "gitea"):
        run(["git", "fetch", remote, "main"], timeout=120)
        counts = subprocess.run(["git", "rev-list", "--left-right", "--count",
                                 f"{remote}/main...main"], cwd=ROOT, text=True,
                                stdout=subprocess.PIPE, check=True).stdout.strip()
        if counts != "0\t0":
            raise RuntimeError(f"{remote} is not reconciled: {counts}")
    log(f"Committed and pushed {commit}")
    return commit


def kuma(status: str, message: str) -> None:
    try:
        sys.path.insert(0, "/home/ubuntu/vps-ops/scripts")
        from watchdog_common import kuma_push  # type: ignore
        kuma_push("panout-weather-refresh", status, message)
    except Exception as exc:
        log(f"Kuma push skipped/failed: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate only; do not write the repo")
    parser.add_argument("--no-deploy", action="store_true", help="build and verify, but do not deploy")
    parser.add_argument("--no-commit", action="store_true", help="do not commit or push")
    parser.add_argument("--force", action="store_true", help="ignore today's success state")
    parser.add_argument("--reuse-cache", action="store_true", help="reuse cached JMA responses (test only)")
    args = parser.parse_args()

    state = load_state()
    if not args.force and not args.dry_run and state.get("last_success_date") == today_jst():
        log(f"Already refreshed today ({state.get('generatedAt')}); skip")
        return 0

    old_data = DATA.read_text("utf-8")
    old_notes = NOTES.read_text("utf-8") if NOTES.is_file() else None
    deployed = False
    previous_deployment = None
    try:
        data, manifest = W.build_snapshot(CACHE, refresh=not args.reuse_cache)
        geo = W.load_geo(GEO)
        report = W.validate_snapshot(data, geo, expected_date=today_jst())
        log(f"Snapshot validated: {report['regions']} regions, {report['generatedAt']}, missing={report['missing']}")

        if args.dry_run:
            log("Dry run complete; no repo files changed")
            return 0

        W.write_data_js(data, DATA)
        W.write_notes(data, report, manifest, NOTES)
        run([sys.executable, "src/build.py"], timeout=600)
        verify_build(data, report)

        if args.no_deploy:
            log("--no-deploy: build verified, not deployed")
            return 0

        previous_deployment = get_deployment_id()
        deployment_id, deployment_url = deploy()
        deployed = True
        try:
            verify_production(data, deployment_url)
        except Exception as exc:
            if rollback(previous_deployment):
                deployed = False
                raise RuntimeError(f"{exc}; rolled back to the previous deployment") from exc
            raise

        commit = None
        if not args.no_commit:
            commit = commit_and_push(data)
        state = {
            "last_success_date": today_jst(),
            "generatedAt": data["generatedAt"],
            "deployment_id": deployment_id,
            "previous_deployment_id": previous_deployment,
            "commit": commit,
            "regions": report["regions"],
            "missing": report["missing"],
        }
        save_state(state)
        kuma("up", f"{data['generatedAt']} {deployment_id or ''}".strip())
        log("Refresh complete")
        return 0
    except Exception as exc:
        if not deployed:
            DATA.write_text(old_data, encoding="utf-8")
            if old_notes is not None:
                NOTES.write_text(old_notes, encoding="utf-8")
            log("Restored previous data.js and DATA-NOTES.md")
        try:
            record_failure(exc)
        except Exception as state_exc:
            log(f"Failed to record failure state: {state_exc}")
        kuma("down", str(exc)[:180])
        log(f"FAILED: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
