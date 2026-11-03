# MASTER-CHECKLIST · panout-japan

> 正本：`sai-long-project/references/website-launch-checklist.md`（10 组 59 项）。纯静态 MPA，无后端/账号/支付；A1–A7 任一不过即阻断。
> 本次发布：2026-10-26，部署 `e16a2b8e-fcc9-4f5b-81d0-c9c744814c16`，源码 `ec09254`。证据集中在 `.review/weather-lab/`、`.review/release/` 与 `HANDOFF.md`。
> 记号：`[x]` 本次已实测；`[~]` 已明确范围或未完整覆盖；`[ ]` 未执行；`[N/A]` 当前产品不适用。

## A. 抓取与索引（阻断级）

- [x] **A1** robots 生产 200 + Allow / + Sitemap；未对 AI bot 另设封禁。
- [x] **A2** sitemap 恰为六个 canonical 内容页；lastmod 为构建日期；无 404 或 preview。
- [x] **A3** 六页自指 canonical；运行时语言 canonical 与 URL 参数一致。
- [x] **A4** ja / zh / en / x-default 四向 alternate，语言运行时 canonical 同步。
- [x] **A5** 六页静态 JA title/description 唯一；三语字典驱动对应语言 head。
- [x] **A6** 六页及 404 各一个 H1；首页方法 H2 / 来源 H3 递进。
- [x] **A7** 六个内容页无 noindex / X-Robots-Tag noindex；刻意保留 404/preview noindex。

## B. GEO / AI 搜索

- [x] **B1** `/llms.txt` 生产 200，含项目与五章口径。
- [x] **B2** 首页 WebSite + Organization JSON-LD 已上线；五章 Dataset JSON-LD 保留。
- [x] **B3** 五章 Dataset 类型，无伪造 FAQ 结构化数据。
- [~] **B4** 首页有“方法与出典”及计算口径；未另做独立 FAQ 富媒体模板。

## C. 社交传播

- [ ] **C1** 现有 OG title/description/url/type 但无 `og:image` 1200×630；未补图。
- [ ] **C2** 现有 `twitter:card=summary`，未做大图卡及验证器验收。
- [ ] **C3** 未执行 Facebook / LinkedIn / Telegram / WhatsApp / Slack 平台预览。
- [N/A] **C4** 无站内分享按钮或 UTM 渠道计划。

## D. 数据统计与增长

- [~] **D1** Pages 自带 Web Analytics beacon；未另行验证实时报表，无新增第三方统计。
- [ ] **D2** 未新增事件埋点计划或上报验收。
- [ ] **D3** 未提交 Search Console / Bing。
- [N/A] **D4** 静态 MPA 非 PWA，不引入离线缓存需求。
- [N/A] **D5** 新闻聚合未启动，暂无 RSS/订阅入口。

## E. 性能

- [x] **E1** 图版为构建期内联 SVG，不拉伸；无需要响应式替代的大照片。
- [x] **E2** 13 个字体文件约 2128KB，CJK 按页面字符集子集化；版本化 woff2。
- [~] **E3** 共享 shell 约 15KB，章节按需加载；天气页额外按需加载 343KB 运行时。首页 Lighthouse TBT 0ms 为上一发布；天气页未重跑 Lighthouse，实测 1 个 133ms long task。
- [x] **E4** 首页 LCP 2.1s（上一发布）；天气页实测 LCP 240ms，静态直出。
- [~] **E5** 生产 CLS 0；字标固定舞台，动效只改 opacity。天气页实测 CLS 0。
- [x] **E6** HTML 与全部静态资源 `max-age=0, must-revalidate`(2026-11-03 起;仅字体 woff2 保持 `immutable`、`/data/*` 保持一天);字典独立版本化。
- [~] **E7** 校验直接取页面发布的 URL(资源每次校验,不再需要 cache-bust);生产已正确返回新版,未额外执行全站 purge。
- [~] **E8** 首页移动端 Lighthouse 97/100/100/100（上一发布）；天气页未重跑 Lighthouse，CLS 0、LCP 240ms、无横向溢出。

## F. 安全

- [~] **F1** HTTPS 与证书实测，剩余 76 天；未新增全子域 preload 策略。
- [~] **F2** 页面为 HTTPS，未做全站所有外链/第三方请求的混合内容专项扫描。
- [~] **F3** `_headers` 声明 nosniff、frame deny、Referrer/Permissions-Policy；平台默认行为另见 HANDOFF，未做所有响应类型覆盖证明。
- [ ] **F4** 未启用 CSP Report-Only / 强制 CSP。
- [ ] **F5** 本轮未新建依赖 lockfile 或全量供应链审计。
- [~] **F6** 部署目录为生成的公开 `site/`；无密钥打包，source map 未随应用复制；未做全历史泄密审计。

## G. 可靠性

- [~] **G1** GitHub + Gitea + 本地生产根 + Cloudflare 部署留存；RPO=源码提交，RTO=回滚部署。未做全基础设施 3-2-1 灾备审计。
- [x] **G2** 从源码完整重建六页与资源并在本地预览实测。
- [x] **G3** Kuma id 53 + TG + 每小时首页/robots/sitemap/llms/TLS 探针已接；部署后手动跑 exit 0、心跳 13:14 JST，首发缺少 JSON-LD 的真实故障已被捕获并恢复。
- [~] **G4** 静态站 CDN 日志与探针日志；未新增 Sentry/RUM。
- [~] **G5** 本地完整构建、预览、生产冒烟完成；未做真实生产回滚计时。
- [ ] **G6** 未查域名商续费页；TLS 到期已测并由监控继续跟踪。
- [x] **G7** 天气日更已接：vps-jp systemd timer 每日 06:10 JST，抓 95 个 JMA 资源、校验 47 县、全量构建、Pages 部署、线上复核、双远端提交；Kuma id 54 26h push monitor（1 retry/120s）；外部探针 `panout_weather_watch.py` cron `45 * * * *`，registry `panout-japan.weather`，心跳 `panout-weather-refresh.ok`，06:40 JST 截止，对账 state/线上 data.js/47 县/week[0]；首次手动 run、两次 `--force` 生产 run、幂等跳过和 systemd service 均 exit 0。2026-10-26 强制 run 发现并修复周日期 off-by-one（`week[0]` 是明日，UI 误当今日），浏览器复核 dateline 10/26、7 卡 10/26–11/01。首次自动 06:10 run 尚待 2026-10-27 观察。

## H. 合规 / 无障碍

- [~] **H1** 键盘移动菜单开/Esc 关、链接及 404 路径已测；未做全五章所有控件键盘矩阵。
- [x] **H2** 全局 `:focus-visible` 2px 外框，主题色对比，菜单键盘操作实测。
- [~] **H3** 目标正文/作者/导航对比度已测：sage 最低 4.9:1，dark 最低 6.48:1；过渡中间值不作终点判据。Lighthouse A11y 100；未逐字全站扫描。
- [x] **H4** reduced-motion 与 no-JS 固定域名、无动画；字标只改透明度。
- [~] **H5** 无表单/新增统计 cookie；未新增隐私条款页，Pages 自带分析未单独审计。
- [x] **H6** 五章一次来源、计算口径、CC BY 4.0 可查。
- [x] **H7** 数据期间和来源在卡面/章节标注；非投资建议、无敏感操作。
- [x] **H8** 作者邮件/X 可点；404 提供首页、五章、联系入口。

## I. 多语言 / 移动端

- [x] **I1** `?lang=` 优先，其次本地记忆，默认 ja；URL 与按钮同步。
- [x] **I2** alternate 含 x-default；canonical 在切换时同步。
- [x] **I3** 191 键三语完整，使用键无缺失；字典按内容版本加载。
- [x] **I4** 320/390/1440 三语无横向溢出；章节页桌面实际挂载无溢出。
- [~] **I5** 顶栏触控按钮 44px、移动抽屉开/Esc 关实测；抽屉未实现完整焦点陷阱，见后续无障碍改进。

## J. 发布流程与发布后

- [x] **J1** 旧部署 `b9b0c617`、旧 HTML 与 Cloudflare 元数据已存 `F:/archive/20261026-panout-production/`；本轮源码与旧部署元数据另存 `F:/archive/20261026-125659-panout-weather/`。
- [~] **J2** 已记录旧部署 `b9b0c617` 及官方 rollback endpoint；未真切生产回滚计时。
- [x] **J3** 未知 URL 返回真 404 + no-store + 三语错误页；五章稳定 URL 200。
- [x] **J4** 生产三语、移动端、六页、五章挂载、字典、404 实测，证据 `.review/weather-lab/` 与 `.review/release/`。
- [x] **J5** README / HANDOFF / progress / TRACK_TREE 已记录；源码双远端推齐。
- [~] **J6** Kuma+TG 已启动并见 UP;24h 与首周持续观察不能提前勾选。

## K. 人口章（2026-10-31，待发布）

- [x] **J1** `/population/` 本地 200；47 县表、年龄金字塔、数字条、方法与出典为构建期静态内容；无 JS 可读。
- [x] **J2** 数据管线 `tools/build_population_data.py` 可重建 `app/population/data/population.json`（2025 国势调查 1-1/2-7/49-1 + 社人研 2050）；13 个浜通り市町村 2050 为「—」。
- [x] **J3** 方格 ↔ 人口加权树图、指标 増減/人口/65+/2050、搜索、卡片、tooltip、prefers-reduced-motion。
- [x] **J4** 桌面 1440 无横向溢出；首页六卡全链接、第六块为人口；出典六章。
- [x] **J5** 构建 7 个内容页；sitemap 7；llms 六章；`_redirects` 加 `/population`；字体子集含 1,719 市町村名。
- [ ] **J6** 移动 390 / 平板 768 截图验收；JA/ZH/EN 静态与 app 标签；无 JS 截图。
- [ ] **J7** 发布：`npx wrangler pages deploy site`，线上冒烟与回滚点。

## 后续(不属于已完成验收)

1. Search Console / Bing 提交与收录检查。
2. 1200×630 OG 图、Twitter 大图卡与各社交平台实测。
3. 全站键盘矩阵、抽屉焦点陷阱与 CSP。
4. 人口章发布后观察；天气日更持续跑；新闻聚合不再计划（第六张已改为人口）。
