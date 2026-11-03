# Weather refresh runbook

## What runs

The VPS refreshes the official JMA forecast snapshot once a day and redeploys the static site.

- Host: `vps-jp`, user `ubuntu`
- Checkout: `/home/ubuntu/panout-japan`
- Entry: `/home/ubuntu/panout-japan/tools/panout_weather_refresh.sh`
- Timer: `panout-weather-refresh.timer` (systemd user unit)
- Schedule: `06:10 JST` daily, `Persistent=true` so a missed run catches up after boot
- Data: `src/weather/data.js` + `src/weather/DATA-NOTES.md`
- State: `/home/ubuntu/.cache/panout-weather/state.json`
- Secrets: `/home/ubuntu/.config/panout/weather.env` (mode 600)
- Kuma: `panout-weather-refresh` push monitor, id 54, interval 93600s, notification 1
- Production: Cloudflare Pages `panout-site`, branch `main`

The 06:10 run uses JMA's 05:00–06:00 JST short-range products. Those products do
not publish today's minimum temperature, so `todayLow` is normally `null`; this is
an official data gap, not a fetch failure. The daily job does not fetch Natural Earth and does
not rebuild `geo.js`.

## Host prerequisites

- Python 3.12 with `fonttools`, `brotli` and `python3-shapely` (the full build uses
  shapely for the homepage SVG clipping; the data-only refresh does not).
- Node 24 with `npx`; the script pins `wrangler@4.152.0`.
- Font cache: `/home/ubuntu/panout-fonts/{latin,sc}` plus
  `/home/ubuntu/panout-japan/.cache/fonts/{NotoSansJP-VF,NotoSerifJP-VF}.ttf`.
- Cloudflare API token with Pages edit access, stored only in the 600-mode env file.

## Manual commands

```bash
# inspect timer
systemctl --user list-timers --all | grep panout
systemctl --user status panout-weather-refresh.timer

# fetch + validate only; no repo or production changes
cd /home/ubuntu/panout-japan
bash tools/panout_weather_refresh.sh --dry-run

# build and verify without deploying or committing
bash tools/panout_weather_refresh.sh --no-deploy --no-commit

# force a real run (ignores today's success state)
bash tools/panout_weather_refresh.sh --force

# run through the timer unit
systemctl --user start panout-weather-refresh.service
journalctl --user -u panout-weather-refresh.service -n 80 --no-pager
```

The script is idempotent: if `state.json` says today's refresh succeeded, a second
run exits 0 without fetching or deploying. Use `--force` only for a deliberate
manual refresh.

## What the job checks

1. 95 JMA resources: `area.json`, 47 short/weekly forecasts, 47 overviews.
2. All 47 short-range `reportDatetime` dates are today in JST.
3. 47 unique regions match the 47 features in `geo.js`; Hokkaido `016000`,
   Kagoshima `460100`, Okinawa `471000`.
4. Seven unique week dates; valid weather categories; high >= low when both exist;
   valid precipitation period; required metadata.
5. Completeness floors: at most 7 missing `todayHigh`, at most 7 missing
   `todayPop`, at most 2 empty overviews.
6. Full build: 6 pages, 47 no-JS weather rows, current `data.js?v=` hash, no
   unresolved placeholders.
7. Deployment artifact first: the Pages URL `wrangler` just printed must already
   serve the new `generatedAt` (3 tries, 5s apart). The artifact is authoritative
   the moment the upload returns, so a failure here is a real defect.
8. Then production: `/weather/` 200, the referenced `data.js` parses,
   `generatedAt` matches, 47 regions, immutable cache policy — retried 10 times,
   20s apart. The production domain is only re-pointed at the new deployment
   *after* the upload, so a short budget measures propagation, not correctness:
   on 2026-11-03 06:12 JST that lag outlived the old 3x10s budget (the artifact
   was already `v=a1513657` while `japan.ouuut.com` still served `v=6e0b6e42`),
   a good deployment was rolled back and the day's refresh was lost.
9. Source: commit `src/weather/data.js` and `src/weather/DATA-NOTES.md`, push to
   GitHub and Gitea, fetch and require `0 ahead / 0 behind`.

Any failure before deployment restores the previous `data.js` **and**
`DATA-NOTES.md` (the notes were previously left dirty, so the next run started
from a half-written tree). A post-deploy verification failure attempts a rollback
to the previous production deployment, and the recorded `last_error` keeps the
inner failure text — it used to be swallowed by "Production verification failed;
rolled back...", which is all the watchdog could see. If source push fails after
a verified deployment, the production snapshot is kept and the monitor goes red;
the next run retries the source update.

## Manual release check

Automated data checks do not see the rendered dates. After a forced refresh, open
`https://japan.ouuut.com/weather/?lang=ja` and confirm:

- `.editorial-dateline` is the report date, not tomorrow.
- The seven `.week-day` cards start with `今日` + the report date, then six
  consecutive dates; today uses `today`/`pop`, tomorrow and later use
  `week[0..5]`.
- Tokyo shows the map, high/low, precipitation and the 47-row table.

This gate caught the 2026-10-26 off-by-one where `week[0]` (tomorrow) was rendered
as today. Do not treat the data-level validation as proof of the rendered date.

## Monitoring

Kuma monitor `panout-weather-refresh` (id 54) is fed by two independent paths:

- The refresh script records `last_failure_at` / `last_error` in `state.json` and
  pushes DOWN on failure, UP only after deployment and production verification.
- The external probe `/home/ubuntu/vps-ops/scripts/panout_weather_watch.py`
  (source `deploy/vps/panout_weather_watch.py`) runs at minute 45 every hour.
  It reads `state.json`, requires a success by **06:40 JST**, rejects a failure
  newer than the last success, then fetches `/weather/` and the versioned
  `data.js`. It reconciles `generatedAt`, 47 regions, all `reportDatetime`
  dates, the seven-day week axis (consecutive, starting today *or* tomorrow —
  JMA's 17:00 product covers "tomorrow + 6" while the 06:10 refresh holds the
  previous day's copy, so `week[0]` is often today; the front end aligns by
  date, not by offset), and the immutable cache header.

Registration: `/home/ubuntu/watchdog/registry.json` item
`panout-japan.weather`, cron `panout-weather-watch`, heartbeat
`/home/ubuntu/watchdog/heartbeats/panout-weather-refresh.ok`, Kuma token in
`/home/ubuntu/vps-ops/scripts/kuma_tokens.json`. Kuma interval is 26h, and push
monitors run with `maxretries=0`: on a push monitor a retry is a scheduled check
that writes a spurious `No heartbeat` DOWN row, so the grace comes from
`interval × 1.5` instead.

Manual probe run:

```bash
python3 /home/ubuntu/vps-ops/scripts/panout_weather_watch.py
```

The probe is read-only and exits 0; incidents are pushed through
`watchdog_common` (Kuma red + TG event).

## Recovery

```bash
# current deployment and previous deployment
cat /home/ubuntu/.cache/panout-weather/state.json

# production rollback (previous deployment id from state)
curl -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/panout-site/deployments/<previous-id>/rollback"
```

To stop the daily job:

```bash
systemctl --user disable --now panout-weather-refresh.timer
```

To re-enable:

```bash
systemctl --user enable --now panout-weather-refresh.timer
```

## Local development

The daily commit lands on `main`. Before editing locally:

```bash
git pull --ff-only origin main
```

`tools/weather_data.py` is the production normalization module; it is data-only
and does not need shapely. `src/fonts.py` accepts `PANOUT_LATIN_FONTS`,
`PANOUT_SC_FONTS` and `PANOUT_OUTFIT_FONT`; the VPS font cache is
`/home/ubuntu/panout-fonts/`, with the JP variable fonts in
`/home/ubuntu/panout-japan/.cache/fonts/`.

Do not edit `site/` or deploy an unverified directory. Do not commit the raw JMA
cache or Cloudflare tokens.
