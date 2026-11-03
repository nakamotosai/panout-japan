# CLOSEOUT

## 2026-11-03 · 缓存策略收口(静态资源 + 天气日更)

**完成**

- 定性:自定义域上 `/assets/*` 被抬到 `max-age=14400, must-revalidate`,根因是 **zone 的 Browser Cache TTL(4h)改写浏览器侧 `Cache-Control`**,不是 Pages 默认;`*.pages.dev` 不过这条改写。同一条改写让本地与预览全绿、线上「改了不生效」。
- 修法:不动管 16 个主机名的 zone 级设置,改为 `ouuut.com` zone 上一条 **host 级 Cache Rule** —— `http.host eq "japan.ouuut.com"` → `set_cache_settings` + `browser_ttl: {mode: "respect_origin"}`(ruleset `59f0e3bd2d1f4b2eb390341190a13857`,rule `03d96559182942969c946a84a372fe0f`,2026-11-03 建)。浏览器现在收到源站写的 `max-age=0, must-revalidate`。
- 定向 purge 9 条旧策略下存下的边缘条目(含把 11-02 快照钉死的 `?v=a1513657`);未做 Purge Everything。
- 站点侧配套:字体子集构建可复现(`recalcTimestamp`);`?v=<内容哈希>` 覆盖 weather 运行时三文件 + i18n 字典;天气脚本的部署指针改用唯一 `&cb=` 测量、内容戳只做身份。
- 生产快照 `2026-11-03T06:08:05Z`,deployment `506b8c3b-7b8e-42c2-90ed-f21dc0256665`,数据提交 `82494ba`。

**证据**

- `curl -D- https://japan.ouuut.com/assets/weather/data.js` → `public, max-age=0, must-revalidate` + `cf-cache-status: REVALIDATED`;`/assets/app.css` 同;`/assets/fonts/outfit-800.woff2` → `31536000, immutable`;`/data/quakes.csv` → `86400`;zone 级 `browser_cache_ttl` 仍 `14400`;`status.ouuut.com` 等其它主机名不受影响;`?v=a1513657` 现返回当前快照。
- 探针 `panout_weather_watch.py` 退出 0;Kuma id 54 心跳 ok;ego 实载字体 `loaded`、47 行表、运行时统一戳 `?v=e9c24e26`。
- 文档:`docs/WEATHER-REFRESH.md` § Asset cache policy、`HANDOFF.md`、`MASTER-CHECKLIST.md` E6、`README.md`。

**未完成 / 尾巴**

- 2026-11-03 06:10 JST 的自动刷新在**生产校验步失败**(Kuma id 54 DOWN @06:12:29 JST,单元 `status=1/FAILURE`;journald 已轮转)。已加 systemd drop-in,把输出落到 `~/.cache/panout-weather/refresh.log`;待 2026-11-04 06:10 观察是否恢复。
- web-audit 未跑通:`.audit/config.json` 缺失,48 项全为「未跑」;2026-11-01 的 `REPORT.md` 即 `FAIL`(`65 项 / 实跑 0`)。

**回滚**

- 见 `HANDOFF.md` § Rollback:上一版部署 `de9d5303-374d-468a-813a-10f29e7b46f0`,数据提交 `82494ba`;`state.json` 里同时留着 `previous_deployment_id`。