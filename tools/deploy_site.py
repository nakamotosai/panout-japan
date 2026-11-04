#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The one way to deploy site/ to Cloudflare Pages by hand.

Why this exists (2026-11-04): a hand-run `npx wrangler pages deploy site` shipped a
build made from a checkout that was nine commits ahead of origin/main and carrying
the *previous* day's weather snapshot. /weather/ then spent five hours calling
11-03 "today", and the daily 06:10 JST pipeline would have reverted the deploy at
its next run anyway, because it builds from origin/main. Both halves of that are
now refusals:

  * HEAD must be origin/main (the pipeline and production share one tree), and
  * the weather snapshot must be today's (a stale snapshot makes the page lie).

Then the upload is verified against production bytes, so "deployed" means the
deployment actually answers.

Usage:
  python tools/deploy_site.py                    # build, verify, deploy, verify live
  python tools/deploy_site.py --skip-build       # deploy the site/ already on disk
  python tools/deploy_site.py --allow-stale-weather   # only when you mean it
  python tools/deploy_site.py --no-verify-live   # stop after the upload
"""
from __future__ import annotations

import argparse
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
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
SITE_URL = "https://japan.ouuut.com"
PROJECT = "panout-site"
WRANGLER = "4.152.0"  # keep in step with tools/refresh_weather.py
UA = "PanOutJapan-Deploy/1.0 (+https://japan.ouuut.com/)"
JST = timezone(timedelta(hours=9))
LANGS = ("", "/zh-Hans", "/zh-Hant", "/en")
ROUTES = ("/", "/weather/", "/quake/", "/crime/", "/cabinet/", "/housing/", "/population/")
CSS_RE = re.compile(r"/assets/app\.css\?v=([0-9a-f]{8})")
JS_RE = re.compile(r"/assets/shell\.js\?v=([0-9a-f]{8})")
WX_RE = re.compile(r"/assets/weather/data\.js\?v=([0-9a-f]{8})")


def say(message: str) -> None:
    print(f"[deploy] {message}", flush=True)


def run(cmd: list[str], env: dict | None = None, timeout: int = 900,
        capture: bool = False) -> subprocess.CompletedProcess:
    say("$ " + " ".join(cmd))
    proc = subprocess.run(cmd, cwd=ROOT, env=env, timeout=timeout, text=True,
                          encoding="utf-8", errors="replace",
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out = proc.stdout or ""
    if not capture:
        print(out.rstrip(), flush=True)
    return proc


def git(*args: str) -> str:
    proc = subprocess.run(["git", *args], cwd=ROOT, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
    if proc.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {proc.stdout.strip()[:300]}")
    return proc.stdout.strip()


def fetch(path: str, timeout: int = 30) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(SITE_URL + path, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read(), {k.lower(): v for k, v in response.headers.items()}
    except urllib.error.HTTPError as exc:  # type: ignore[attr-defined]
        return exc.code, b"", {}


def jst_day(value: str) -> str:
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(JST).date().isoformat()


def ensure_on_main() -> None:
    """Refuse anything the daily pipeline would revert."""
    git("fetch", "origin", "--prune")
    head, remote = git("rev-parse", "HEAD"), git("rev-parse", "origin/main")
    if head != remote:
        behind = subprocess.run(["git", "merge-base", "--is-ancestor", head, remote],
                                cwd=ROOT).returncode == 0
        remedy = ("git pull --ff-only origin main" if behind
                  else "git push origin main && git push gitea main")
        raise SystemExit(
            f"Refusing to deploy: HEAD {head[:9]} is not origin/main {remote[:9]}.\n"
            "The 06:10 JST job builds and deploys from origin/main, so a deploy from any other\n"
            "tree is reverted at its next run (2026-11-04: that is how production ended up\n"
            f"serving the previous day's weather for five hours).\nRun {remedy} first."
        )
    dirty = [line for line in git("status", "--porcelain", "--untracked-files=no").splitlines()
             if line.strip()]
    if dirty:
        raise SystemExit("Refusing to deploy with uncommitted tracked changes:\n  " + "\n  ".join(dirty))
    say(f"HEAD is origin/main ({head[:9]}), working tree clean")


def build(require_today: bool) -> None:
    env = dict(os.environ)
    env["PANOUT_REQUIRE_TODAY_WEATHER"] = "1" if require_today else "0"
    proc = run([sys.executable, "src/build.py"], env=env, timeout=900, capture=True)
    out = proc.stdout or ""
    print(out.rstrip(), flush=True)
    if proc.returncode != 0:
        raise SystemExit("Refusing to deploy: the build failed (see above)")


def preflight(allow_stale: bool) -> dict:
    """Everything that must be true of site/ before a byte goes to Cloudflare."""
    if not SITE.is_dir():
        raise SystemExit("Refusing to deploy: site/ does not exist (run the build)")

    missing = [f"{lang}{route}" for lang in LANGS for route in ROUTES
               if not (SITE / f"{lang}{route}".strip("/") / "index.html").is_file()]
    if missing:
        raise SystemExit(f"Refusing to deploy: missing built pages: {', '.join(missing[:6])}")

    css_path = SITE / "assets" / "app.css"
    css = css_path.read_text(encoding="utf-8")
    if css.count("@font-face") < 10 or "?v=0" in css:
        raise SystemExit(
            "Refusing to deploy: the built CSS has no @font-face or a ?v=0 stamp, which means "
            "the font build was skipped (set PANOUT_LATIN_FONTS / PANOUT_SC_FONTS / PANOUT_OUTFIT_FONT)"
        )

    home = (SITE / "index.html").read_text(encoding="utf-8")
    css_ver, js_ver = CSS_RE.search(home), JS_RE.search(home)
    if not css_ver or not js_ver:
        raise SystemExit("Refusing to deploy: the built HTML has no /assets/app.css?v= or shell.js?v= stamp")

    raw = (SITE / "assets" / "weather" / "data.js").read_text(encoding="utf-8")
    doc = json.loads(raw.split("=", 1)[1].rstrip().rstrip(";"))
    report_day = jst_day(doc["regions"][0]["reportDatetime"])
    today = datetime.now(JST).date().isoformat()
    if report_day != today:
        message = (
            f"weather snapshot is JMA's {report_day} issue but today is {today}: the page would "
            f"label it \"today\". Run `git pull` (the 06:10 JST job commits the current snapshot) "
            f"and rebuild."
        )
        if not allow_stale:
            raise SystemExit("Refusing to deploy: " + message)
        say("WARNING — " + message)

    wx = WX_RE.search((SITE / "weather" / "index.html").read_text(encoding="utf-8"))
    if not wx:
        raise SystemExit("Refusing to deploy: /weather/ does not reference a stamped data.js")

    facts = {"css": css_ver.group(1), "js": js_ver.group(1), "weather": wx.group(1),
             "generated_at": doc["generatedAt"], "report_day": report_day}
    say("preflight ok: pages 28, fonts ok, css v{css}, js v{js}, weather v{weather} "
        "({report_day})".format(**facts))
    return facts


def deploy() -> tuple[str | None, str | None]:
    # Windows 上 npx 是 npx.cmd:裸 "npx" 会 WinError 2,先按 PATH/PATHEXT 解析一次。
    npx = shutil.which("npx") or "npx"
    proc = run([npx, "--yes", f"wrangler@{WRANGLER}", "pages", "deploy", "site",
                f"--project-name={PROJECT}", "--branch=main"], timeout=1800, capture=True)
    out = proc.stdout or ""
    print(out.rstrip(), flush=True)
    if proc.returncode != 0:
        raise SystemExit("Deploy failed (see wrangler output above)")
    url = re.search(r"https://[0-9a-f]{8}\." + re.escape(PROJECT) + r"\.pages\.dev", out)
    deployment_url = url.group(0) if url else None
    return deployment_url, out


def deployment_id(url: str | None, attempts: int = 12, delay: int = 5) -> str | None:
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        return None
    for _ in range(attempts):
        try:
            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{PROJECT}/deployments?per_page=5",
                headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = json.load(response)
            for item in payload.get("result", []):
                if url and item.get("url") == url:
                    return item.get("id")
        except Exception:
            pass
        time.sleep(delay)
    return None


def verify_live(facts: dict, allow_stale: bool, attempts: int = 12, delay: int = 10) -> None:
    """Production must answer with these bytes. Pages switches deployments, not atomically."""
    local_css = hashlib.sha1((SITE / "assets" / "app.css").read_bytes()).hexdigest()[:8]
    today = datetime.now(JST).date().isoformat()
    last = "no attempt"
    for attempt in range(attempts):
        stamp = str(int(time.time() * 1000))
        code, body, _ = fetch(f"/?cb={stamp}")
        if code != 200:
            last = f"/ -> HTTP {code}"
        else:
            home = body.decode("utf-8", "replace")
            if f"/assets/app.css?v={facts['css']}" not in home:
                last = f"/ does not reference app.css?v={facts['css']} yet"
            else:
                code, css_body, _ = fetch(f"/assets/app.css?v={facts['css']}&cb={stamp}")
                got = hashlib.sha1(css_body).hexdigest()[:8] if code == 200 else ""
                if got != local_css:
                    last = f"app.css?v={facts['css']} served {got or 'HTTP ' + str(code)}"
                else:
                    code, weather, _ = fetch(f"/weather/?cb={stamp}")
                    wx = WX_RE.search(weather.decode("utf-8", "replace")) if code == 200 else None
                    if not wx or wx.group(1) != facts["weather"]:
                        last = f"/weather/ references data.js?v={wx.group(1) if wx else 'none'}"
                    else:
                        code, raw, _ = fetch(f"/assets/weather/data.js?v={facts['weather']}&cb={stamp}")
                        try:
                            doc = json.loads(raw.decode("utf-8").split("=", 1)[1].rstrip().rstrip(";"))
                        except Exception:
                            doc = {}
                        if doc.get("generatedAt") != facts["generated_at"]:
                            last = f"data.js served generatedAt {doc.get('generatedAt')}"
                        else:
                            report_day = str((doc.get("regions") or [{}])[0].get("reportDatetime", ""))[:10]
                            if report_day != today and not allow_stale:
                                last = f"production snapshot is {report_day}, today is {today}"
                            else:
                                broken = [route for route in ROUTES
                                          if fetch(f"{route}?cb={stamp}")[0] != 200]
                                if broken:
                                    last = f"routes not 200: {', '.join(broken)}"
                                else:
                                    say(f"production verified: css v{facts['css']}, js v{facts['js']}, "
                                        f"weather v{facts['weather']} (snapshot {facts['report_day']}), "
                                        f"7 routes 200")
                                    return
        if attempt < attempts - 1:
            say(f"waiting for production to answer with this build ({last})")
            time.sleep(delay)
    raise SystemExit(f"Refusing to call it deployed: production never matched this build ({last})")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-build", action="store_true", help="deploy the site/ already on disk")
    parser.add_argument("--allow-stale-weather", action="store_true",
                        help="deploy even though the weather snapshot is not today's")
    parser.add_argument("--no-verify-live", action="store_true", help="stop after the upload")
    args = parser.parse_args()

    ensure_on_main()
    if not args.skip_build:
        build(require_today=not args.allow_stale_weather)
    facts = preflight(allow_stale=args.allow_stale_weather)
    deployment_url, _ = deploy()
    if not deployment_url:
        raise SystemExit("Deploy finished but wrangler printed no deployment URL; verify by hand")
    say(f"deployment url {deployment_url}")
    ident = deployment_id(deployment_url)
    if ident:
        say(f"deployment id {ident}")
    if args.no_verify_live:
        say("production not verified (--no-verify-live)")
        return 0
    verify_live(facts, allow_stale=args.allow_stale_weather)
    say("done — origin/main and production are on the same build; the 06:10 JST job keeps them in step")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())