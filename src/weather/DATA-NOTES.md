# Weather snapshot

Generated at **2026-11-03T06:03:21Z**; this is a static JMA forecast snapshot, not live observations.

## Fetch

- 95 JMA resources requested; downloaded **95**, reused cache **0**.
- Short-range report timestamps: **2026-11-03T11:00:00+09:00** through **2026-11-03T11:00:00+09:00** (JST offsets preserved).
- The static map geometry in `geo.js` is not refetched by the daily job.

## Validation

- Regions **47**, geometries **47**, categories `{"cloud": 8, "clear": 39}`.
- Missing values: `{"todayHigh": 0, "todayLow": 47, "todayPop": 0, "weekHigh": 47, "weekLow": 47, "weekPop": 47, "weekReliability": 94, "emptyOverviewText": 0, "missingTomorrowJa": 0}`.
- `null` means JMA did not issue the value. No temperature, precipitation probability, reliability, observation or overview is invented.
- `week[0]` is the day after the report date; the UI renders today from `today`/`pop` and the next six days from `week`.
- Daytime short-range products (05:00–16:00 JST) do not publish today's minimum; `todayLow` is therefore normally null.
- Source: 気象庁 (JMA) forecast JSON; attribution and source links are rendered on `/weather/`.
