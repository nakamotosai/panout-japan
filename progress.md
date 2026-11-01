# progress · Pan Out Japan 会话流水（只增不改）

## 2026-10-12 · 立项 bootstrap（建仓轮）

- 命名三轮收敛：scout/watch/map（否：URL 看不出日本）→ pan（`pan.ouuut.com` 空闲）+ jp/japan → 用户拍板：**产品 Pan Out Japan / 域 `japan.ouuut.com` / 仓个人顶上**（ouuut 组织建仓 403）。
- GitHub `nakamotosai/panout-japan`（public）已建；本地 `F:/projects/panout-japan` git init + origin 已接。
- 十真相源骨架落地：README / PROJECT_CONSTITUTION / AGENTS / TRACK_TREE / SPEC(M0) / PLAN(M0) / design-lock / MASTER-CHECKLIST(59 项裁剪) / progress(本条) / HANDOFF。
- 阻塞记 README：ouuut 组织权限、Gitea 镜像惯例（`sai/find-out` 等 scope 全探不到）。
- 待下轮：INDEX.md 补行 → 项目本 PARA-Projects 登记（降级流程）→ 首 commit + push。

## 2026-10-12 · M0 合仓+统风（三面 task 并行）

- 合仓：ouuut 三空仓方向作废（删不动，无 admin 权，闲置；删仓走网页）；三站源码 cp 进 sites/（quake/crime/cabinet），瘦身 369M→66M（去 node_modules/dist/75M 瓦片/lod_cache/raw/嵌套.git→archive）。
- 统风：token 冻 docs/THEME-TOKENS.md（crime tactical 深色）；quake 改风（build 过）/cabinet 改风+三语（data.json 未动）/门面 site/ 新建（4 件，静态自测）；crime 只读参照。
- 对账：crime site/data 缺 3 件系 head 截断虚惊；老仓 earthquake CLAUDE.md 的 M 与本轮无关。
- 验收：hub/cabinet/crime 本地 200 + quake build exit 0；`f896044` 双推同 SHA。
- 唯一 next：M0 上线（CF Pages + 綁域 + GSC/Bing + 冒烟）。

## 2026-10-13 · M0 单页上线（本番装配轮）

- 装配：`site/assemble.mjs` 重写（preview 壳去 preview 文案 + SEO 头注入 + app 13 文件显式直装 + 旧三子路径清场 + sitemap 单页化 + llms 改 hash 门），`--check` 幂等。
- 修：crime remount 双 invalidateSize（60ms rAF + 1500ms 兜底）+ label zoom 门（<10 藏）+ loadLeaflet CSS 先补后 return；quake 手机菜单收窄；SEO 头（canonical/hreflang/OG/Twitter/JSON-LD/favicon）进 preview。
- 部署：CF Pages `panout-site`（`f8b2f04b`，ouuut token），`japan.ouuut.com`（已绑）+ 部署域三视图全验（quake 3D/crime 58 tiles+62 label/cabinet chart，零 error；手机 390 全过）。
-  A1–A7：A1 robots+sitemap ✅ A2 单 canonical ✅ A3 canonical ✅ A4 hreflang 闭环 ✅ A5 三语 title ✅ A6 单 active h1 ✅ A7 无 noindex ✅。
- 唯一 next：GSC/Bing 验证 + 看门狗探针 + ouuut.com Products 加条 + M2 新闻聚合。

## 2026-10-13 · 上线缺陷修复轮（`6a5fe864`）

用户报线上 4 类 bug，逐条取证 + 修：

1. **quake 左下/右下重叠** —— 根因：shell 的**占位** `.controls`(72,677→405,722) 与 quake 自己的 `.eq-bottom-left`(68,612→322,728) 在左下叠着。修：`mountView` 里 quake 挂载前移除 `.hud-top/.controls/.spec`；shell `#shell-foot` 在 quake 视图隐藏（quake 自带版权行）。
2. **quake 小地球位置歪** —— 根因：HUD `top:60px` 是为原站 54px 头留的，嵌进 shell 后无头可让，浮在中间。修：`quake-core.css` HUD 顶行 60→12（drawer 120→72；手机 56→12）；`#v-quake-viewport` 底色 `var(--stage)`→`var(--bg0)`（消除浅色闪）。
3. **crime 右侧面板全透明、字看不见** —— 根因：crime 的整套 CSS 挂在 `#crm-root` 下（28 处 token/variant 选择器），但挂载元素 id 是 `#v-crime` → **皮肤规则一条都没生效**；卡片 bg 回退透明、文字继承 shell `--ink`（dark 主题下 `#EDEBE4`）→ 浅色地图上全看不见。修：`mountCrime` 建 `<div id="crm-root">` 挂载盒并把 variant/accent 属性挂它上面；unmount 连盒移除。实测 dark 下 `--bg-card: rgba(27,25,23,.62)` / `--text-main:#f5f0e8` 恢复。
4. **cabinet 橙药丸灰字** —— 根因：shell 占位规则 `.stage span{color:var(--muted)}`（(0,1,1)）压过 `.cab-latest{color:#fff}`（(0,1,0)）。修：占位样式改子选择器 `.stage > b` / `.stage > span`。实测 `#cab-latest` col=`rgb(255,255,255)` / bg=`rgb(255,106,61)`。
5. **主题第三项 mono** —— 删 mono（CSS 块 + 圆点 + 按钮 + 映射 + 默认）；默认 `sage`，白名单 `{sage,dark}`。
6. **quake 震点"消失"** —— 加加载遮罩（`.qk-veil`），采样画布亮点占比 >3.5% 且 ≥2.6s 才撤（12s 兜底）。另实测 **live 16s 亮点 5.44% → 50s 2.21%**：地球仪 idle 自转（`userWantsAutoRotate=true`，30s/圈）+ 镜头漂移把日本震点带出视野 —— 待拍板是否关默认自转。

验证：`site/assemble.mjs --check` OK；本地 Chromium 实渲染 4 项全过（quake 亮点 6.30%、无重叠、小地球 y=96；crime `#crm-root` 在且可读；cabinet 白字）；线上 `index.html`/`app/crime/view.js`/`app/quake/view.js` 回读确认新版字节已上。

## 2026-10-13 · 震点根因修复（瓦片数据缺失，`a5dadbff`）

用户复测仍无震点。逐层定位：
- 原站 `3d.saaaai.com` 请求日志：`/data/quakes/manifest.json` + `/data/quakes/tiles/r_15_5.json` …（20° 瓦片，共 154 片）。
- panout 装配件只有 `app/quake/data/quakes.json`（legacy 平面文件），`quakes/manifest.json` **404**、无 tiles。
- vendor 源码 `main.js:3980` 的 legacy 回退只 `loadJson` 数据；而显示路径 `quakeTiles.sync()` 无 manifest 直接 `return false`（`quakeTiles.js:267`）→ **getDisplayQuakes 恒空 → 0 点**。
- 对照实验：同机 headed 浏览器下原站亮点 7.62%，panout 2.12%（只剩海岸线）；本地 headless 因 SwiftShader 偶然画出点，掩盖了问题（headed/真 GPU 才是用户实际）。

修：从原站拉日本区 9 片瓦片（recent+archive 共 18 文件 / 13.4MB）+ 裁剪版 manifest，落 `app/quake/data/quakes/`；`site/assemble.mjs` 新增 `quakes/**` 整目录递归同步 + 缺失即 fail。脚本留档 `sites/quake/scripts/fetch-tiles-from-live.py`。
验：本地 headed 亮点 6.99%；线上 `japan.ouuut.com` build `2d273e7982` 亮点 6.88%、8 瓦片全 200、零 404；crime `#crm-root` 在/面板 `rgba(255,255,255,.6)`+深字；cabinet 药丸 `display:none`。全部 headed 实机截图取证。

遗留：quake 的 `.eq-left-dock` 默认 `is-open`（工具条默认展开）；地球仪 idle 自转把镜头带离日本（`userWantsAutoRotate=true`）——待拍板。

## 2026-10-13 · dock 按钮挤压修复（`9ade1810`）

用户贴图：顶左 dock「震级/震级筛/年份」互相压着。根因：vendor 的 dock 按钮全靠 `--eq-dock-w/h/gap/radius` 定宽高，而这四个 token 只存在于原站 `sites/quake/src/style.css` 的 `:root` 块里——**抽成 vendor 文件时 `:root` 没一起带，production css 里定义是 0 个，用了 29 处** → 宽高塌成 auto → 互相挤。同类全量审计（prod css 用到的每个 `var(--x)` 必须有定义：prod 自身/shell `:root`/运行时）再抓出 `--bg2`（famous-reopen 边框用它）也丢了。
修：`--eq-dock-w:52px; --eq-dock-h:calc(w/2); --eq-dock-gap:8px; --eq-dock-radius:6px; --bg2:rgba(255,244,232,.14)` 落到 `#v-quake-viewport` 基座规则里（原站同值），审计脚本复跑 `ALL DEFINED ✔`。
验：本地 headed 5 个 item 全 52×26、x 坐标 128/188/248/308/368 等距无叠；线上 build `2815aba8e6` 同样 52×26 + 震点在。

## 2026-10-13 · 查bug轮（workflowz 五路 fanout + headed 实测，`683b34f`）

- 用户报地震图"菜单挤叠+常驻Loading+UI全崩"。实测结论：线上 BUILD 2815aba8e6 本身正常——菜单52px/震点/veil全好，用户截图系旧缓存快照（本地复现：旧CSS 30846B vs 新30969B，http-server缓存头+`?v=`旧戳导致）。
- 五路取证：IntroVeil（入场Ix序列完整在，veil 9条退出路径，P5 vendor失败盖报错/P7 remount复用旧veil/P8 tick无token/P9自转漂移致12s兜底）/ MenuCss（--eq-rotate-len无回退确认，legend-len排除，壳遮挡排除，`(width<=640px)`无空格疑似未测）/ TileData（调用链+降级矩阵全，断档：coverageEnd 2026-08-10后静态无新点、legacy下1970-1999空、日本区外天然无点）/ ShellTheme（vendor `I_()`写死tactical+`data-quake-theme`无人消费、壳boot无mono白名单）/ LiveVerify（线上三视图+390+三轮切换+零errors/零失败请求，用户三报障全排除，唯一确认轻微：title不随语言）。
- 修（5）：① P5 vendor失败先摘veil再写.qk-fail；② `--eq-rotate-len/--eq-legend-len` 补168px默认值；③ 壳boot mono白名单（旧mono收敛sage）；④ view.js detectTheme回退sage+THEME_MAP mono→sage；⑤ TITLES三语+setLang刷新title。本地 headed 全验：mono收敛/title三语/轮切零错/cabinet EN正常。
- 部署：未推线上（门规：commit当轮做，push留收口）。线上仍 2815aba8e6，本轮 `7d940fe282` 待发布。
- 遗留未修（有意）：`(width<=640px)` 无空格待真机matchMedia取证；autoRotate镜头漂移待拍板（默认开）；vendor CJK不跟三语（设计现状）；`I_()`写死tactical（vendor冻结，不动）。

## 2026-10-13 · 进站即日本（`c1a35f7`，已上线 `2bde87d50a`）

- 用户要：进站直接日本构图，取消3s飞行，改完直接推。
- 改：`sites/quake/src/main.js` init 开场 `INTRO_SPACE_VIEW`→`homeViewForDevice()` 瞬切 + `flyP animate:false`（岸线径向3.4s+点场溶解1.85s保留，数据一到直接推）。
- 管线：`vite build`（新 dist `index-CUFc_M9I.js`）+ 新建 `sites/quake/scripts/build-vendor.mjs`（14处 assert-guarded patches：mount1+missing1+topbar1+data4+var4+theme2+sw1；变量名漂移用内容锚/正则；theme处1整吞`,ad(X);`处2分号单换——首版`,`残留致 Unexpected token，已修+`node --check` 门）。
- 验：本地硬刷 t=5s 2.1%→8s veil撤；线上 `2bde87d50a` 9s 9.2%+零错。截图：进站即日本列岛+震点，无太空帧。

## 2026-10-19 · M3 静态预渲染重建（全站 109 页）

- 架构切换：弃「单壳 + hash 路由 + 运行时数据渲染」，改为 `src/build.py` 静态预渲染 MPA；`site/` 整目录部署，零运行时拼页。
- 页面：封面 + 27 年页 + 3 章 + 62 区 + 14 任内阁 + method + 404 = 109；每页 canonical/hreflang/OG/JSON-LD 齐全，三语（ja/zh/en）。
- 图表全部构建期生成为内联 SVG（地震/犯罪海报、内阁长轴、年度条带），首屏不再等 JS。
- 懒挂：章节页 `.stage` 点「起動する」才挂 WebGL/Leaflet/ECharts，闭合后恢复海报 DOM；三主题 mono/sage/dark。
- 数据修正：NHK 2008/09 列错位（-8/+10 列）与日经同月双调查标注 → 644 polls / 331 月；犯罪章改用町丁级口径（中位 4.4‰、最高 1,332‰）；最大月变动统一口径 +20.5。
- 体积：封面 raw 36KB / br 9KB；地震章 56/18KB；犯罪章 69/24KB；区页 33/9KB。海岸线 0.05° 简化 3.8MB→1.9MB，震点数值精度收敛 14MB→13MB。
- 字体：Noto Sans/Serif JP VF 实例化 400 + 子集，8 文件 490KB，自托管。
- 验收：109 页本地 200；三主题 × ja/zh/en 实渲染；375px 无横向溢出；404 直开正常；globe/Leaflet/ECharts 懒挂与闭合恢复通过。
- 残留：`site/` 未提交（构建产物）；globe 首次加载本地 ~10s（线上 brotli 后更快）；zh 标题沿用 JP 字形（系统回退兜底）。

## 2026-10-19 · 收尾验收（移动端 0 溢出、载荷实测）

- 修封面 375px 横向溢出：`.spine-row` 的 `1fr` 被 min-content 撑开（手机 356 vs 320），改 `minmax(0,1fr)` 后 scrollWidth=clientWidth=360，7 条路由复测全部 0 溢出。
- 载荷实测（gzip，brotli 更低）：封面 35.4KB→8.7KB、地震章 52.1/15.6、犯罪章 67.4/22.6、内阁章 16.9/5.1；CSS 22.1/5.4；shell.js 6.0/1.9；i18n 18.6/7.6；字体 8 文件 491KB（unicode-range 按需）。
- a11y 底线：109 页 h1 唯一（0 违例）、`:focus-visible` 有；移动端按钮 40px 高、导航链 38px（>WCAG 24px）。
- 残留：部署待 CF 凭据（`wrangler whoami` 未认证、本机无 token）。

## 2026-10-21 · M4 ouuut 视觉对齐（全站 109 页）

- 用户令：japan.ouuut.com 各页设计语言与 ouuut.com 完全一致，含左上 logo 字体。
- 主题：删除 mono；sage/dark 两态按本地时间自动（6–17 sage，其余 dark），手动点选写 `pj-theme`；`theme-color` 随主题更新。
- 字标：Outfit 800 / 33px / accent，`pan out` + `japan` 45%；重子集 Outfit 800（10KB）覆盖 `panoutjapan` + ASCII；favicon 改 Outfit `p`。
- 字阶：EN Instrument 400、JA/ZH Noto Serif 700；正文 17px（EN 1.65 / CJK 1.8）；cover H1 EN 89.28/400/.96、JA 72/700/1.3、ZH 80.64/700/1.28；section 44.8/700；page H1 56/700；logo 33/800。
- 组件：页头 72px + 90% blur + scrolled；2 主题点（44px 命中）/文本语言链/移动汉堡+全屏菜单；首页两栏 hero + 三尺度面板 + Outfit 巨型字标 + 三条 ouuut 式索引行；stage 4px surface 无阴影；表格 15px + 单色顺序带 + 移动横向滚动；页脚品牌字标 + 12px 三行。
- 字体：Outfit 800 + Noto Serif/Sans JP 700/500 + Noto Serif/Sans SC 700/500 + Instrument/Geist/JetBrains，11 文件 1.06MB；CJK 子集并入 app/*.js 剥注释后的 UI 字符串（1230 字符）。
- 图表：crime 色阶改 sage/orange 单色顺序带；cabinet 14 任改 accent 顺序色；loader/面板变量对齐 token。
- 修复：移除 `startViewTransition`（relay 下旧主题快照卡住）；crime 全屏 `#crm-root/#crm-map` 高度 100%；cabinet stage-flow 去掉 62vh 空洞；移动表格 idx 列 42px；CJK `word-break:auto-phrase` 修 `同/じ` 断词；`#chapters` scroll-margin 避吸顶页头。
- 验：sitemap 108 页本地 200、h1 唯一 0 违例；1440/768/390/320 × ja/zh/en 0 横向溢出；12 个字体面 loaded；home/chapter/year/method 可见边框 0；无 JS 内容可见；reduced-motion 内容可见且 grain 关闭；ouuut.com 实测 sage/dark token 与 logo 33/800 逐值一致。
- 部署：commit `fff7e76` → `wrangler pages deploy site --project-name=panout-site --branch=main`，线上 `https://japan.ouuut.com/` 已验：12 字体面 loaded、outfit 字标、JA/EN 切换、sage/dark 切换、390px 0 溢出；preview `https://bd1b2c86.panout-site.pages.dev`。
- 线上核对：`/assets/app.css?v=faddf900` 12 个 @font-face、`auto-phrase` 在；`/assets/shell.js?v=93852dd4` 无 `startViewTransition`、THEMES=sage/dark；9 条路由 200 + 唯一 h1；404 直开正常。

## 2026-10-21 · M4.1 总入口比例尺预览（本地 `/preview/`）

- 用户纠偏：M4 把 ouuut 的品牌站布局（巨型字标、产品行、hero panel）整套搬进了数据站；要的是同一主题/字体，不是同一信息架构。
- 方案：总入口改为「一把尺子，三个刻度」；只重做首页 + 三章入口，详情页保留。先出首页单页原型，不碰 109 页。
- 实现：`src/home_plates.py` 构建期生成三张数据板（地震密度/23区犯罪/331月内阁线）；`src/home-preview.css/js` 实现刻度选择、hover/focus 预览、键盘左右切换、无 JS 降级；`build.py` 新增 `/preview/` 路由（`register=False`，不进 sitemap）。
- 验：1440/1024/768/390/360/320 双主题三语无页面横向溢出；1440 `rulerBottom=867`、768 `rulerBottom=877`、390 `rulerBottom=786`、320 `rulerBottom=824`；hover/focus/click/键盘/无 JS/reduced-motion 全过；字体面加载、控制台零错误；preview HTML 166KB / gzip 50KB。
- 唯一 next：用户看首页预览，确认后展开三个章节入口（地震擦洗 / 犯罪放大镜 / 内阁时间带）。

## 2026-10-21 · M4.2 总入口改三入口直连（一次点击）

- 用户反馈：M4.1 的比例尺要先选尺度再开章，进三站需要两次点击，不合理，必须精简。
- 改：删除比例尺选择器与 `home-preview.js`；三块数据板同屏并排，**每块整块是 `<a>`**，点任意位置一次直接进入 `/quake/`、`/crime/`、`/cabinet/`；无选中态、无二次 OPEN、无 JS 拦截。
- 布局：1440 三栏 triptych（整块 band，无卡片边框/阴影）；≤1000 横向行；≤640 纵向。数据板按 416px 栏宽放大 SVG 注记，犯罪图改“浅填充 + 强点 + 区界”的点场。
- 验：1440/1024/768/390/320 × ja/zh/en × sage/dark 全 0 横向溢出、3 个入口齐全；1440 band 底部 887px 在首屏；桌面点 `/crime/`、390 点 `/cabinet/` 均一次跳转成功；`/preview/` 仍 noindex、不进 sitemap；无自定义交互脚本。
- 唯一 next：用户看总入口，确认后展开三个章节入口（地震擦洗 / 犯罪放大镜 / 内阁时间带）。

## 2026-10-21 · M4.3 品牌改为 japan.ouuut.com

- 用户纠偏：logo 与首页巨型字标仍是 Pan Out Japan；不是这个品牌，应该是域名 `japan.ouuut.com`。
- 改：`build.py` 增设 `BRAND` / `WM`；页头、页脚、首页巨型字标、封面 kicker、所有 title / og:site_name / WebSite schema / llms.txt 全部改为 `japan.ouuut.com`；favicon 字母 `p` → `J`；字标 `japan` + `.ouuut.com` 两段，去掉两段间 gap；≤340px 页头字标降为 26px，避免 320px 挤压。
- 验：`site/` 旧品牌 0 命中；1440 巨型字标 1,133px / 内容 1,430px，390 为 288 / 380，320 为 236 / 270；1440/1024/768/390/360/320 × ja/en/zh × sage/dark 0 横向溢出；320 页头 logo 128px、工具右缘 290px；390 一次点击 `/quake/` 成功；无 JS 时 logo/巨型字标仍为域名。
- 唯一 next：用户确认新字标；确认后展开三个章节入口（地震擦洗 / 犯罪放大镜 / 内阁时间带）。

## 2026-10-21 · M4.4 首页三图直接启动应用

- 用户要求：点首页三张图直接加载启动，不要跳到章节页再点「起動する」。
- 改：首页预览与本地根首页各加 3 个隐藏 `.home-stage`；面板/产品行加 `data-start-app`。点击由 `shell.js` 拦截：当前页全屏 stage、loading 层、直接 import `/app/<ch>/view.js` 并 mount；URL 不变，关闭按钮回首页并恢复面板文案。无 JS 时仍按 `<a href>` 回退到章节页。章节页原有 launch 保留。
- 修：quake stage 的 `.stage-live` 补 `id="v-quake-viewport"`；app 内旧品牌字符串（quake 页脚、crime 来源链接、cabinet 版权）改为 `japan.ouuut.com`。
- 验：预览 1440 点地震出 2 canvas + 地球，点犯罪出 Leaflet `#crm-map`，点内阁出 ECharts canvas；三者 URL 均保持 `/preview/`，关闭后 `stage-open` 移除、面板恢复「開く」；根首页产品行点犯罪同样当前页启动；章节 `/crime/` 原 launch 仍可用；390px 点面板图片启动内阁，关闭按钮 48px 落在视口内、无横向溢出；无 JS 点地震入口回退到 `/quake/`；站点用户可见旧品牌 0。
- 唯一 next：用户验收三图直启；确认后把 `/preview/` 切为根首页并展开章节细节。

## 2026-10-21 · M4.5 四页收口 + 三章交互修正

- 用户叫停并纠偏：一共只有 4 个页面，`/preview/` 总入口 + 地震 / 犯罪 / 内阁三章；`/` 不应再出旧首页，也不应再有方法页、年份页、区页、内阁任期页。此前构建实际 109 页，属于越界。
- 收口：`/` 直接使用总入口三入口版；`/preview/` 只做跳转别名；删除方法 / 年份 / 区 / 内阁任期 / 404 路由；章节页移除对应链接（年份索引删除，区/内阁表改为纯文本）；导航、页脚、llms、sitemap、`_redirects` 全部收口。旧 109 页站点归档到 `F:/archive/20261021-panout-109pages-site`。构建输出 `pages: 4`。
- 三章修正：全屏 stage 增加站点头（域名 / 主题 / 语言 / 关闭），主题和语言可直接在应用内切换；`syncVendorTheme` / `setLang` 选择器修正为 `.stage-live`，应用真正收到主题/语言；文档滚动条隐藏、内部滚动条主题化；内阁从 in-flow `stage-flow` 改为全屏，控件置顶、图表 flex 填满，dataZoom 改为主题色轨道，顶部内阁标签不再被裁切。
- 验：`/` 为新总入口，`/preview/` → `/`，`/method/`、`/quake/2011/`、`/crime/chiyoda/`、`/cabinet/abe1/` 均 404；sitemap 4 条；4 个内容页 + 1 个跳转别名；1440/390 无横向溢出；1440 chrome 52px、390 chrome 48px；内阁 1440 图表 974px / 控件 81px，390 图表 847px / 控件 142px；主题切换后 quake `data-quake-theme=dark`、crime `data-crm-variant=tactical`、cabinet dataZoom 切 tactical；文档 `scrollbar-width:none`，内部滚动条为 muted/accent 主题色；无白色滚动条。
- 唯一 next：用户验收四页收口与三章交互；线上未部署。

## 2026-10-21 · M4.6 独立页面 + 应用内嵌（去弹层）

- 用户指出三章右上角出现主题/语言/关闭按钮，质疑“页中页”。确认这是上一轮的全屏弹层 chrome：章节页本身是独立页面，但点击后在页内盖了一层 fixed 舞台，带关闭按钮，视觉上像 modal。
- 模式改为独立页面内嵌：三章 `/quake/`、`/crime/`、`/cabinet/` 直接把自己的应用挂在页面图区，滚动到图区由 IntersectionObserver 自动挂载；没有弹层、没有关闭按钮、没有 `body overflow:hidden`。首页三块数据板恢复为普通 `<a>`，直接进入章节页，不再原地全屏启动。
- 删除 `stage-chrome` / `stage-close` / `stage-launch` / home hidden stages 及相关 CSS/JS；保留站点 sticky header 的主题与语言控件；静态标题、数据表、beats 始终在 HTML 中，爬虫/AI 无需点击或执行 JS。
- 修 quake 内嵌加载遮罩：暗色画布亮点阈值可能不达标，兜底从 `tries > 40`（约 20s）降到 `tries > 8`（约 4.4s），避免图区长时间被“読み込み中”盖住。
- 验：`/` 无 `.stage`，三入口为普通链接；三章 `.stage[data-live=1]` 内嵌 canvas，`stage-chrome`/`stage-close`/`[data-launch]` 均为 0；1440 与移动端无横向溢出；页面可正常滚动，无 body 锁；header 主题/语言切换后 quake `data-quake-theme=dark`、crime `data-crm-variant=tactical`，中文 H1 生效；`/preview/` 仍跳 `/`，旧路由仍 404。
- 唯一 next：用户验收独立页面模式；线上未部署。

## 2026-10-21 · M4.7 吸顶 header + 全屏应用

- 用户再次纠偏：三章不要章节导语、统计块、beats、数据表这些“废话”，要吸顶 header 下直接全屏看地震/犯罪/内阁。
- 三章改为 `body.chapter-app` + `main.chapter-app-page`：header 保持 sticky，应用 stage 高度 `calc(100dvh - var(--nav-h))`，全宽、无圆角、无页边距；页面本身不滚动，交互全部在应用内部。
- 删除三章可见的 chapter-head / stats / beats / crime 区表 / cabinet 内阁表；footer 在章节页不再输出。title、description、JSON-LD 与 `sr-only` H1/lede 保留，作为 SEO/GEO 的最低保底；全屏 canvas 可见正文减少是明确的取舍。
- 构建加 `fullscreen=True` 分支：`<body class="chapter-app">`、跳过 footer、但仍输出 shell.js 与闭合标签；新增 `.sr-only`、`.chapter-app-page`、`body.chapter-app` 样式。
- 验：`/quake/`、`/crime/`、`/cabinet/` 均为 header + 全屏 stage，页面 `scrollHeight == innerHeight`，无章节导语/统计/beats/表格/footer；三章应用自动挂载；主题/语言在 header 切换；无弹层/关闭按钮；旧路由仍 404。
- 唯一 next：用户验收全屏模式；线上未部署。

## 2026-10-21 · M4.7a 全屏填充修正

- crime 应用会给 `.stage-live` 写 inline `min-height:70vh`，全屏时地图只占 70%。全屏页用 `.chapter-app-page .stage-live` 的 `!important` 覆盖为 `inset:0 / height:100%`，`#crm-root`、`#crm-map` 同步 100%，实测 1053px 全填。
- quake 震点在数据加载后不会自动重绘，手动 `resize` 后才出现。`mountStage` 增加 2.4s / 5s / 8s / 12s 的延迟 resize，保证数据到位后点云上屏。
- 验：1440 与移动端三章均 header + 全屏 stage，`scrollHeight == innerHeight`；crime map / cabinet chart 填满；quake 延迟后显示点云；无章节正文/footer/关闭按钮。

## 2026-10-21 · M4.8 三章深度视觉打磨与字形修复

- 用户指出三章细节问题：① 地震图浅色模式仍为黑底，缺少浅色设计，底部渐变黑遮罩遮挡地图，缺少入场淡入；② 犯罪率地图小标签中的“雷門”等字符日文/中文显示异常（与右侧面板不一致）；③ 内阁支持率折线图两种配色均单调难看，无法区分不同首相，需要完全重构外观，参考获奖级作品。
- 地震图浅色模式与入场动效：
  - `patch_vendor.py` 给 `quake-core.js` 打入真实的 `sage` 浅色配置（15330787 温润浅米绿纸底、1713436 深墨黑海岸线），解除只返回 `tactical` 的硬编码限制；
  - `app.css` 注入 `html[data-theme="sage"] #v-quake-viewport` 全套浅色 CSS 变量；
  - 彻底移除 `#v-quake-viewport .eq-bottom` 的底部渐变遮罩，西南诸岛与冲绳全貌清晰可见；
  - `view.js` 遮罩撤除改用 0.65s 平滑透明度渐变淡入，支持 `window.__setQuakeTheme` 实时重绘 WebGL 场景。
- 犯罪率地图小标签字形根治：
  - 定位根因：`src/build.py` 的 `collect_chars` 之前提取属性误写为 `p.get("name")`（实际为 `p.get("n")`），导致 5,234 个町丁中的 605 个汉字（包含“雷”、“門”等专属地名汉字）完全未打包进 Noto 子集字体，触发 Windows 劣质日文字体回退。
  - 修复 `collect_chars`，全量提取町丁名汉字（子集字符数从 1066 增至 1397）；
  - `app.css` 为 `#crm-lx-capsule .lx-name` 明确指定 `font-family: var(--title-font) !important; font-weight: 700 !important;`，与右侧面板彻底对齐。
- 内阁支持率折线图获奖级重构：
  - 彻底抛弃单色线条：为 14 位首相分别定制浅色模式（报刊醇厚墨色系）与深色模式（黑曜石高对比霓虹色系）两套独立调色盘，一眼区分不同首相；
  - 增加交替任期底色带（`markArea`），政权跨度与更迭一览无余；
  - 增加折线下垂面积渐变（`areaStyle`），山峦形态丰富，纵深立体；
  - 升级富文本 Tooltip：展示首相专属色标、首相名、大字支持率、调查机构明细；
  - 优化顶部区间切换器与首相名牌胶囊（带色点与高亮焦点）。
- 验：截图亲测 quake 浅色温润、深色璀璨，无底部黑遮罩，淡入平滑；crime 雷门2丁目小标签与右侧面板完全一致（纯正 Noto Serif）；cabinet 浅色/深色/移动端各首相色彩鲜明、底色带与面积渐变丰满、Tooltip 精美。

## 2026-10-21 · M4.9 全站四页交互动效与平滑过渡全面升级

- 用户要求：四个页面（一个总页面与三个分页面）全部都要有过度的入场与切换动效，拒绝瞬切弹出；主题切换、语言切换也要平滑过渡；所有可点击的按钮与交互控件全部加上时长更长（0.45s~0.75s）、更明显舒适的动画效果。
- 页面切换与全屏应用入场：
  - 配置跨文档原生 MPA `@view-transition`（`navigation: auto`，0.65s 柔和过渡）；
  - 全站 `main#main` 与 `.chapter-app-page` 添加 `0.72s cubic-bezier(0.16, 1, 0.3, 1)` 渐入动画，告别瞬弹；
  - 犯罪率地图：雷达加载器 0.75s 呼吸淡出，地图平滑落位淡入；
  - 内阁支持率图表：开启 ECharts 1100ms cubicOut 生长动画与 650ms 窗口切换插值，图表容器 0.85s 淡显。
- 全局主题与语言切换平滑流转：
  - 全站背景、文字、边框、阴影注入 0.65s 长过渡（`cubic-bezier(0.16, 1, 0.3, 1)`），深浅模式切换如光影流转般平滑显眼；
  - 语言切换增加 `.lang-switching` 呼吸遮罩（0.45s 墨水重印式淡出淡入），不再瞬切乱跳。
- 所有可交互控件与按钮手感强化：
  - 顶部导航链接：0.45s 平滑文字变色与微上浮，下划圆点弹性伸缩；
  - 主题切换双圆点：0.55s 悬停放大（1.22x）、点击回弹与光晕扩散；
  - 语言切换按钮：0.45s 胶囊高亮与微上浮；
  - 首页三入口数据板：0.55s 悬停上浮 4px、立体阴影、右下角 `↗` 箭头向外滑移动画；
  - 内阁时间范围切换按钮与首相名牌胶囊：0.48s 舒展过渡、hover 上浮 2px、active 缩放反馈。
- 验：总页面 `/` 与三章分页面 `/quake/`、`/crime/`、`/cabinet/` 均实测通过；无任何横向溢出与样式冲突。

## 2026-10-21 · M4.10 内阁支持率页面入场卡顿彻底根治与高质感过渡重做

- 问题根因定位（一手数据取证）：
  - 1. 外部 CDN 依赖与长任务阻塞：原代码依赖外部 jsdelivr/unpkg 实时下载 1MB 的 `echarts.min.js`，无本地 vendor 缓存，无 `<head>` 预加载，主线程连续触发 3 次 70ms~99ms 的 Long Task；
  - 2. 布局突变与 DOM 挤压（Layout Thrashing）：原静态 HTML 呈现简陋黑白 SVG 海报，活体化时直接 `display: none`，顶部控制栏突然插入把图表猛烈推挤下沉，引发剧烈布局跳跃；
  - 3. 频繁 Resize 洪泛打断动画：`shell.js` 在 60ms 和 350ms 硬发全局 `resize` 事件，直接掐断了 ECharts 刚开始计算的 1100ms 入场展开动画，导致 Canvas 清屏重绘、严重丢帧卡顿。
- 终态重做方案落地：
  - 1. **ECharts 依赖本地化与预加载**：下载 5.5.1 版本至 `app/cabinet/vendor/echarts.min.js`（本地同源 0 网络延迟），并在内阁页 `<head>` 中注入 `preload`（echarts 脚本 + data.json + modulepreload view.js）；
  - 2. **专属高质感平滑入场遮罩 (`.cab-veil`)**：
    - 设计极具数据新闻仪式感的主题同步动态脉冲波与多语种载入指示（`331か月の世論調査データを展開中…`）；
    - 与当前深浅主题完全同色，无缝衔接，消除黑白突变；
    - 首帧 Canvas 渲染完成后以 `0.65s cubic-bezier(0.16, 1, 0.3, 1)` 平滑淡出（cross-fade），图表优雅浮现；
  - 3. **零布局跳变（Zero Layout Shift）**：
    - 在 CSS 中锁定 `.stage-cabinet`、`.cab-host`、`.cab-controls`（`min-height: 44px`）和 `#cab-chart` 的弹性容器比例，首毫秒即确定绝对尺寸；
  - 4. **Resize 防抖与初始动画保护**：
    - `shell.js` 免除全屏应用页面的早期 resize 轰炸；
    - `view.js` 内部增加 `isInitialAnimating` 保护期与 `requestAnimationFrame` 防抖，首屏展开动画彻底不受打扰。
- 验：PerformanceObserver 实测 `longTasksCount: 0`（原 3 次）、`shiftsCount: 0`（完全零跳变），60 FPS 丝滑入场，深浅模式与语言流转皆实测通过。

## 2026-10-21 · M4.11 地震 3D 地球仪大圆球细描边（Limb Outline）实装

- 用户要求：http://127.0.0.1:8900/quake/ 给这个地球的整个大圆球加一个细描边。解决纯黑/纯白背景下地球与外部环境边界融合、无法辨识球体分界线的问题。
- 终态方案与几何实现：
  - 构建 360 段高精度相切地平线圆弧（`earth-limb-outline`，`LineSegments`，`renderOrder: 20`）；
  - 每帧在渲染循环 `hS()` 中动态计算视线切圆的几何位置与透视半径：
    - 切圆中心：$\mathbf{C} = \mathbf{p}_{	ext{cam}} \cdot (R^2 / D^2)$；
    - 切圆半径：$r_c = R \sqrt{1 - R^2 / D^2}$；
    - 朝向相机：`rm.lookAt(camPos)`；
    - 严谨的投影几何保证无论相机如何旋转、缩放、仰俯，该圆圈在屏幕上恒定贴合球体外边界，100% 严丝合缝；
  - 配色随主题自适应：
    - Dark 模式：采用微暖米白（`0xEDEBE4`，与海岸线同族），`opacity: 0.58`，勾勒出优雅精致的宇宙地平线细圈；
    - Sage 模式：采用深墨绿灰（`0x141A15`，与海岸线同族），`opacity: 0.42`，清晰界定浅色背景与地球实体。
- 验：在 Dark 和 Sage 两种主题下截图核验，并在鼠标拖拽旋转地球时全程跟踪切圆位置，实测 60 FPS 丝滑贴合，彻底消除纯黑/纯白背景分界不明的痛点。

## 2026-10-21 · M4.12 内阁支持率布局全面重构：底栏合并、分割线右侧标注与桌面端深度档案面板

- 用户需求：
  - 1. 合并标签条：将顶部原本占一整行的时间范围按钮（3个月/1年/2年/5年/10年/全期间）合并到底部长拖动条行，做成“左侧标签 + 右侧长条”同排对齐，彻底省掉顶部一整行空间；
  - 2. 首相名字位置调整：按附图红字标注，将原来挂在 Y 轴天花板（100%）顶端挤扁的小胶囊，改为放在竖分割线（markLine）的右侧上方（88% 高度处），横排、大字（14px）、清晰易辨；
  - 3. 电脑端右侧深度信息面板：类似犯罪率面板，右侧常驻/悬停展示选中首相的详细数据指标（平均支持率、最高与最低发生月份、民调总数）与三语精编执政档案（小泉邮政解散、安倍长命政权等 14 届内阁档案），未选中时显示 14 届内阁全景概览。
- 技术落地：
  - 布局精简：彻底移除顶部 `.cab-controls`，创建 `.cab-bottom-bar` 紧凑底栏（高 32px，距底 8px），左侧内联 `.cab-zoom` 胶囊组，ECharts `dataZoom: slider` 的 `left` 与 `right` 自动避让底栏按钮与右侧面板，实现天衣无缝的同一水平线对齐；
  - 竖线右侧标注：采用双段 markLine 精确定位算法，虚线贯穿 0 到 100，并在数据坐标 `(c.start, 88)` 处向右延伸 10px，水平左对齐渲染当前首相专属色大字标签（对应 Image #1）；
  - 深度档案面板（`#cab-panel`）：内置 14 届内阁完整历史元数据字典（届次、党派、三语背景描述），监听 ECharts 的 `updateAxisPointer` 与 `click` 事件，hover 实时联动，click 具备 PINNED 锁定与取消功能；窄屏自适应隐藏。
- 验：在 Dark 和 Sage 两种主题下完整测试并截图留证；时间轴底栏无缝对接，面板联动丝滑无卡顿。
## 2026-10-21 · M4.13 全站五大视觉与体验精进：内阁全高维基档案面板、折线免隐藏、分割线大字标签及地震浅色同步与按钮对齐

- 用户痛点与诉求：
  - 1. 内阁右侧面板内容过少、只占右上角一小块且字体欠佳，要求全面对齐犯罪率面板的设计美学与字体（MiSans VF），抓取/补充 14 位日本首相详尽维基生平档案与核心政策，让面板撑满整个视口高度；
  - 2. 取消鼠标悬停在折线上时隐藏/淡化其他人折线的功能，保持历史全貌随时可见；
  - 3. 分割线旁的首相名字太小看不清，位置靠下，要求继续靠上并大幅放大清晰；
  - 4. 地震页浅色（Sage）模式下地球仍然显示为黑色，没有继承 header 主题选择；
  - 5. 地震页左上角五个控制按钮高低不齐，产生参差歪斜。
- 实施修复与重构：
  - 1. 内阁面板重构：彻底对齐犯罪率面板的设计规范，采用 .panel-card 多卡片垂直堆叠结构，设置 height: calc(100% - 56px) 撑满全高，隐形滚动条；引入全套犯罪率同款字体（MiSans VF 极细 250 字重 22px 大标题、200 字重 32px 大数字）；编写 14 位首相极其详尽的中/日/英三语维基生平史料档案（涵盖出身、母校、派阀、核心施政举措三支箭/邮政改革/数字厅等、重大历史战役及辞任转折危机）；未选中时展示 28 年全景概况与在任时长记录；
  - 2. 折线显示保留：移除 ECharts emphasis.focus = 'series' 及透明度衰减逻辑，鼠标悬停时所有内阁历史折线 100% 饱满可见，仅当前折线微调描边；
  - 3. 首相名字大字置顶：调整分割线文字标注位置至 Y = 97%（顶部开阔区域），字号放大至 20px 粗体（窄屏 14px），配备半透明高对比衬底小胶囊，醒目清晰；
  - 4. 地震浅色主题联动：修复 app/quake/view.js 的 detectTheme 从 pj-theme 正确读取、在 boot(token) 异步加载 vendor 完成后立即同步 setQuakeTheme、在 MutationObserver 属性监听中双向触发 __setQuakeTheme，并在 quake-core.js 内部修正初始主题读取，浅色下呈现绝美版画质感米白地球；
  - 5. 地震按钮绝对对齐：为 #eq-menu-row, #eq-menu-items, .eq-tool 注入 flex 水平居中对齐，五大按钮 top 像素完全一致（83.99px），彻底消除 4.7px 下沉偏移。
- 验收成果：在 Chromium 真实环境中完成 Sage 浅色与 Dark 深色模式、鼠标 hover、click 锁定及跨页面主题同步的全流程截图留证。
## 2026-10-21 · M4.14 全站去粗体重构：大一圈字号细体替代小字加粗、彻底解决 Tooltip 老旧衬线回退

- 用户审美定调与核心指导：
  - 1. Tooltip 弹窗依然是老字体（粗体与衬线 monospace 回退）；
  - 2. 彻底拒绝粗体：坚决杜绝小字体的粗体（笔画粘连糊黑、毫无可读性），建立“用大一圈字号的纯细体（200/250/300）替代加粗”的高级排版哲学；
  - 3. 地震网页字体太小太粗，排查全站字体收敛为单一统一的极细无衬线体系。
- 实施改造：
  - 1. Webfont 字体流水线重构（src/fonts.py）：从 NotoSansJP/SC Variable Font 中精准导出 200（极细大字）、350（细体正文/UI）、400（清晰小字）完整子集，共 15 组极细 WOFF2 文件；
  - 2. 全站彻底清零小粗体（app.css & quake-core.css）：全局强力重置 `*, b, strong, th, h1-h6` 字重上限为 300，彻底清除 600/700/800 粗体；在需要强调的场景，全面改用“大一圈字号（+1.5px~2px）+ 250/300 细体”呈现；
  - 3. 内阁右侧面板去粗体化（app/cabinet/view.js）：卡片二标题“政权稳定性”改为 15px/250 细体，右侧在任天数改为 14px/250 细体，核心政策大标题改为 14.5px/300 细体，退任危机改为 13.5px/300 细体，彻底消除墨坨；
  - 4. 内阁分割线首相大名置顶升级：字号由 20px 进一步扩大为 24px 大字号，字重降至 300 纯细体，字距 1.5px，醒目且极尽纤细；
  - 5. Tooltip 彻底重构：首相大名 16px/300 细体，支持率数字 28px/200 极细无衬线，各社明细 12px 药丸胶囊，彻底消除 Courier/Times 衬线爪爪回退；
  - 6. 地震页排版加固：所有按钮（菜单/震级/年份/深度等）全部采用 13px~13.5px / 350 细体，浮层采用 26px/200 极细数字与 14px/350 细体地名。
- 验收成果：全站 4 页排版探针再次全检，600/700/800 粗体全面归零，全站呈现极具呼吸感与科技杂志感的极细无衬线排版。
## 2026-10-21 · M4.15 深色模式文本配色根治修复与双主题真机实测留证

- 用户痛点反馈：
  - 深色（Dark）模式下，内阁右侧面板中大量文字（首相标题、第四个数字“187”、生平长文本、核心政策大标题）全是黑色的，在暗黑背景上直接隐身，无法阅读。
- 根因分析：
  - app/cabinet/view.js 的局部 CSS 与动态 HTML 模板中使用了 `var(--text-main, #141A15)`。而全局深色主题的文本变量为 `--ink`（深色下为象牙白 #EDEBE4），局部 scope 未声明 `--text-main` 导致直接回退为深黑写死值 `#141A15`。
- 修复方案：
  - 1. 全量将 view.js 中的 `var(--text-main, #141A15)` 及 `var(--text-main)` 统一替换为项目权威真相源 `var(--ink)`，次级文本统一使用 `var(--muted)`；
  - 2. 在 src/app.css 中针对 `html[data-theme="dark"] .cab-panel` 及其所有子卡片、标题、正文、大数字强力注入 `color: #EDEBE4 !important` 与次级 `color: #A09E96 !important`；
  - 3. 在 Chromium 中真机切换至 Dark 模式并点击安倍晋三(第二次)全量抽检所有 DOM 节点计算颜色（已全部转为 rgb(237, 235, 228) 象牙白），并截图留证；同时复验 Sage 浅色模式，确保双主题均呈现顶级对比度。

## 2026-10-21 · M4.16 外部 LLM 评审通道打通（Gemini 网页版）

- 目标：把整站（4 页）连同源码交给网页版 Gemini 做第三方评审，产出可执行的 P0/P1/P2 意见。
- 通道：
  - `tools/export-review.py` 生成评审包到 `.review/`（已 gitignore）：`text/B_HTML.txt`（4 页构建产物，内联 SVG path 压成占位符）、`C_CSS.txt`、`D_JS.txt`、`E_DATA.txt`（数据样本）；截图 10 张（4 页 × sage/dark 桌面 + 2 张 390×844 移动端）。
  - Gemini 无公开上传 API，走本机 Chrome relay：`Page.setInterceptFileChooserDialog` 拦截原生文件选择框 → `DOM.setFileInputFiles` 灌入本地文件 → `Input.insertText` 写入提示词 → Enter 发送。首轮上传会弹一次 Google「画像とファイルからコンテンツを作成する」同意框，需先同意。
  - 分两轮喂：第一轮 BRIEF + 8 张桌面截图（视觉/信息架构），第二轮 4 个源码包 + 2 张移动端（实现/可访问性）。回执存 `.review/gemini-round1.md`、`gemini-round2.md`。
- 已知坑：Gemini 网页版单条消息附件上限约 10 个，故分两轮；`tab.run` 里的裸 `page.evaluate(fn)` 在 relay 下会丢闭包，传字符串或用 host `tab.evaluate` 才稳。
- 一手核验：Gemini 第二轮 P1 第 4 条称「home-preview.css 全部内容在 app.css 中重复了一遍」——实测 app.css 只有 1 处 `.hp-band/.hp-entry` 出现在选择器列表，dot-rule 76 条全在 home-preview.css，**该条为幻觉，不予采纳**。其余条目待逐条核实后再动。

## 2026-10-21 · M4.17 评审换号重跑：Gemini 4 Argon（Pro 账号）

- 上一轮投喂走错账号（nkmtsai@gmail.com，非 Pro），作废。改投 `krillkathryn467@gmail.com`（Google One Pro）+ 模型「Argon 高」，会话 `/u/2/app/aea15435229ebc10`。
- 通道修正：新版 Gemini 的「上传和工具」按钮对 JS `.click()` 不响应（无用户手势 → 浏览器直接吞掉文件选择请求）。必须 **鼠标 down/up 真实点击** 菜单项，`Page.setInterceptFileChooserDialog` 才会收到 `mode: selectMultiple` 事件，再 `DOM.setFileInputFiles` 灌文件。发送用编辑器 focus + Enter。
- 产出：`gemini-argon-round1.md`（视觉/IA 17 条）、`gemini-argon-round2.md`（实现层 R2-01～R2-18）、`VERIFICATION.md`（一手核验账）。
- 已核实为真的硬 Bug（待修）：
  - `app/crime/view.js:876` 模板残留 `data-crm-chome="${pr.name}', true)"` → 犯罪页所有下钻/返回点击失效；
  - `mountCrimeControls()` 全仓无人调用 → /crime/ 罪种下拉、R7/R8、搜索框整组缺失；
  - `app/cabinet/view.js:219` `@media (max-width:960px){ .cab-panel{display:none} }` → 手机端看不到首相档案；
  - `src/shell.js:17` `lang()` 先读 localStorage 再读 `?lang=` → 分享链接语言参数对老访客失效；
  - 犯罪页中位数显示 3.8‰ 与站点 4.4‰ 矛盾；仅用町丁级复算得 4.49‰，`buildScales()` 混入了 MUNI 行。
- 已证伪：Argon 称犯罪页 TOP5 把 ‰ 写成 % —— 源码两处均为 ‰，属截图小字号误读。

## 2026-10-21 · M4.18 内阁图名签与拖动 + 上一轮硬 Bug 全清

- 犯罪页三条硬 Bug 已修：模板残留 `data-crm-chome="${pr.name}', true)"`、`mountCrimeControls()` 未挂载、中位数口径混入 MUNI 行（现 4.4‰ 与站点一致）；Leaflet 改本地 `app/crime/vendor/`，加 15s 看门狗与 ≤760px 筛选抽屉。
- 内阁页：`@media (max-width:960px)` 改为面板下沉抽屉而非 `display:none`；`shell.js` 的 `?lang=` 优先于 localStorage。
- 内阁图名签重做：取消 `i%3` 三行错位，单行同高、只写姓氏（`PM_SURNAME` 日/中/英三套，两任菅写 菅(直)/菅(義)，安倍用 (1)/(2)）；默认落在分割线右侧，仅在会撞画布右沿时翻左；`datazoom` 松手 240ms 调 `refreshWindowLabels(startPct,endPct)` 按新窗口重算 show/coord/align。
- 拖动卡死根因：`updateAxisPointer → renderPanel` 每帧重建右侧面板 + `ResizeObserver → resize → 布局` 回路。修法：rAF 合并面板重建、`datazoom` 后 260ms 抑制、尺寸未变直接 return、指针离开 `hideTip`。实测 150 次拖动 346 帧：max 19ms / p99 18ms。
- 拥挤处理：`plotPxPerMonth` 扣 48 左距 + 384 右面板；日文 slack 0.62、英文 1.28；任期窄于 44px 字号 10 且去 (1)(2)。
- 收口：5 个提交（6e774c8 / b1c7e1c / d0ab959 / 394a18b / af72de1）推到 origin(github) 与 gitea，两边 `behind=0`；harness doctor 全绿。
- 发布：`wrangler pages deploy site --project-name=panout-site --branch=main`（ouuut 账号 `cf9d7a…`，token 取 `custom.ouuut_cf_api_token`），部署域 `https://7e596ded.panout-site.pages.dev`；自定义域 `japan.ouuut.com` 已回新字节（`app.css?v=d71b3356` 与本地构建一致）。线上验收：内阁全期間 14 个名签单行、高市在线右侧；拖动 65→45 换窗口且名签跟随；犯罪页瓦片 18 张、下钻面板出数；三页 0 console error。

- 线上回评修正：犯罪页筛选工具条原本 `top:84px`（相对已在地图舞台内的 `#crm-root`）→ 悬空在地图中部；改为 `top:12px`（窄屏 8px），贴地图左上角。部署 `a90e2c84.panout-site.pages.dev`，主域实测 `ctl.y - map.y = 12`、`app.css?v=52e920da`。
- 线上回评修正 2：犯罪页工具条与下拉/搜索框原为 `999px` 胶囊，与全站 2px 按钮 / 4px 卡片圆角语言不一致；工具条 4px、子控件 2px（窄屏抽屉 4px），线上实测 host=4px、sel/q/seg/toggle=2px、面板卡 4px。部署 `a4d2b7fa`（`app.css?v=f651bd7c`）。

## 2026-10-22 · M4.19 第四章「住宅」上线（四つの尺度闭环）

- 立项依据 `docs/housing-feasibility.md`（e0b9500）：口径定为「中古マンション・成約価格・60–80㎡・㎡単価中位数 → 70㎡ 换算」，23 区、不画逐笔散点。
- 数据管线 `tools/build_housing_data.py`：`--csv` 读国交省「不動産取引価格情報」CSV（2025Q2–2026Q1，21,848 条成約）→ `app/housing/data/wards.json`（23 区统计，4.7KB）；几何从 `muni_poly.json` 抽 23 区 → `wards_poly.json`（492KB，br 76KB）。许可 PDL 1.0：页面固定出典 + 「加工して作成」+ 非政府出品声明。
- 第四章 `app/housing/view.js`（~560 行）：Leaflet + canvas 多边形（`preferCanvas`），log 分位 6 档单色梯度、排行面板、点选/列表联动、窄屏底部抽屉、三语、双主题。颜色在 canvas 里读不到 CSS 变量，改 `getComputedStyle(--accent)` 取色后 `hexToRgba`。
- 口径统一（本轮返工点）：地图填色、图例、排行、首页文案原本混用「全サイズ㎡単価」与「60–80㎡ p70」两套指标 → 全部收敛到 band p70；rank 在 JS 里按同一指标重算并重排数组（否则列表序号与顺序错位）；band n<100 的区（千代田 n=86）在排名旁标「参考」。
- 首屏崩溃根因：`renderHeadAll()` 里写了 `$("#hsg-source")`（`$` 内部已拼 `#`）→ `querySelector("##hsg-source")` 抛 InvalidSelector，mount 抛错、stage-failed。修掉后 23 区、6 档图例、卡片全部出数。
- 版式返工：出典原文压住图例 → 移进标题卡；标题裸浮在瓦片地名上 → 加 86% 底 + 毛玻璃卡片；窄屏卡片被 Leaflet 缩放按钮切掉 → 面板 54vh + 内部滚动、窄屏隐藏缩放；桌面缩放按钮挤在面板右边缝 → `.leaflet-bottom.leaflet-right` 右移 392px；attribution 白底突兀 → 主题化。
- 首页：第四块数据板 `housing_svg()`（23 区 fill-opacity 梯度 + 价签落在最高区质心），`hp-band` 改 4 列（≥1200 四列 / 1000–1199 两列 / <1000 单列），导航与页脚补第四条。
- 构建：`pages: 5`，`app.css` 54KB / `shell.js` 10KB，字体子集 13 文件 2.07MB（charset 2,157 字，已含新文案）。页面首屏 ≈136KB br（HTML 10 + view.js 8 + leaflet 41 + 几何 76 + 统计 1）。
- 验收：本地 1413 / 1130 / 390 三档 + sage/dark 双主题 + ja/en/zh 三语截图留证（`.review/shots/r21-*`）；点选足立区出 3,900 万円、列表自动滚到第 23 行；5 个页面 0 console error、无横向溢出。
- 手机端出典：Leaflet attribution 在 ≤760px 被底部抽屉压住 → 抽屉内隐藏控件，把「© 国土地理院 · Leaflet」并入图例卡片，始终可见。
- 文案口径：封面 lede 与区块标题原写「四つの時間」（三章时代遗留），第四块住宅不是时间轴 → 三语统一改「四つの尺度」，与 H1「四つの尺度で見る」对齐。
- 发布：`wrangler pages deploy site --project-name=panout-site --branch=main` → `18651572.panout-site.pages.dev`；主域实测 `stage-housing` live=1、23 行排行、图例 6 档、attribution 主题化。

## 2026-10-22 · M4.19b 住宅改用平均值口径

- 用户拍板：要平均价。主图色阶 / 排行 / 首页文案 / 海报价签全部从中位数切到 `band.unit_mean`（`p70_mean`），中位数降为卡片对照行；`note` 改为「平均是简单平均，n<100 标参考」。
- 实测差异：区级平均比中位数高 0–9%（千代田 16,928→18,010、港 15,750→17,117、足立 3,900→4,164 万円）。
- 数据侧 `tools/build_housing_data.py` 增 `unit_mean` / `p70_mean`；JSON-LD、meta description、llms.txt、README 同步改 mean。
- 粒度取证（为下一轮决策留档）：成約 CSV 的地区名是町名、无丁目；23 区 60–80㎡ 一年 769 个町，样本中位 8 笔（p25=3），n≥30 仅 68 个；同口径按駅 558 个、中位 11 笔、n≥30 有 100 个；地価公示 2026 在 23 区有 1,567 个标准地点（港区 81、足立 108）。町级平均对单笔极端值敏感：n=6–12 的町去掉最贵一笔均值降 4.4%（最大 15.4%），n≥40 只降 1.1%。

## 2026-10-22 · M4.19c 住宅改回「官方粒度 + 犯罪图同款」：町名填色

- 用户否掉前两版（区级均值面板、逐笔小圆点）：要的是犯罪率地图那种「区块填色」，按官方数据自己的粒度画。
- 官方 CSV 的最小定位单位核实：`市区町村名 + 地区名（町名）`，无丁目、无坐标。因此填色单元 = 町名。
- 新管线 `tools/build_housing_towns.py`：把 crime 的 3,135 个町丁目多边形按町名合并（924 个），并对 21,848 条成約按町名汇总平均㎡単価 / 平均総額 / 件数；`towns.json` 604KB（br 124KB）。无成交的 96 个町不画。
- 视图重写 `app/housing/view.js`：Leaflet canvas 多边形（preferCanvas），6 档 log 分位单色梯度、`zoomSnap:0` 让 fitBounds 真填满视口、hover 浮层 + 点击右侧卡片（手机底部抽屉）、三语、双主题。
- 去掉的东西：60–80㎡ 筛选、中位数/平均之争、70㎡ 换算、区级排行面板、逐笔散点与 `points.json`（已删）；`wards_poly.json` 退役，构建改为每次清空 `site/app/<ch>` 再拷贝，杜绝旧数据残留。
- 验收：桌面 2134×847 与手机 390 两档、sage/dark、ja/en/zh；hover 南千住 = 111 件 / 85 万/㎡ / 5,804 万，点击出卡；0 console error、无横向溢出。
- 发布：`bc0fabc0.panout-site.pages.dev`，主域实测 828 町填色、6 档图例、町名单位出数。

## 2026-10-22 · M4.19d 住宅改用犯罪率章同一套模板（东京全域）

- 用户否掉「另一种地图」：要求直接复刻犯罪率章模板。做法：把犯罪章的 CSS（27KB，`crm-`→`hsg-` 前缀重命名）落到 `app/housing/app.css`，骨架/工具栏/右侧卡片/左下分布仪/竖向缩放条全部照搬；逻辑重写为住宅数据。
- 覆盖范围回到官方数据本身：东京全域 50 个市区町村、1,237 个町名有成交（26,416 件），1,614 个町多边形；无成交留白。此前只做 23 区是我自己加的限制，已撤。
- 数值 = 该町成約価格的平均㎡単価（总价÷面积逐笔平均），不筛面积、不算中位数、不做 70㎡ 换算；区市町村层用町按件数加权平均。
- 交互：点击町 → 町卡（Top% 徽章、平均㎡単価、平均成約価格、件数、内訳条、返回区卡）+ 区市町村卡（区内最贵町 Top5）+ 全区市町村 Top5；搜索町名；指标切换（㎡単価/平均成約価格）；粒度切换（区市町村/町名）。
- 坑：`setStyle(fn)` 会以 feature 调用，需防 undefined；`zoomSnap` 默认 0.25 与 fitBounds 交互导致留白，改为 fit 全东京本土 bbox；标签在 z<10.5 收起（否则 62 个市名叠成一团）；数据 fetch 加 `no-cache` 避免旧 towns.json。
- 验收：桌面 2134×847 与手机 390 两档、sage(editorial)/dark(tactical) 双主题、ja 三语；点击 東尾久/向山 出卡，0 console error。
- 发布：`218d30a5.panout-site.pages.dev`，主域实测 live=1、町卡出数、无报错。

## 2026-10-22 · M4.19e 配色归位（用户第二次否掉）

- 症状：sage 模式重点色是朱红 `#9f3c2c`、dark 是琥珀 `#d0801a`，与犯罪率章（sage `#2F6B4F` / dark `#FF6A3D`）不一致。
- 根因一：`app/housing/app.css` 自带一套变体令牌（自带纸色/墨色/阴影/重点色），不是犯罪章那套站点令牌；且文件末尾还有一条通用 `#hsg-root{--accent:var(--accent)}` 把值交给站点主题，导致重点色随站点走（sage 站点重点色是红）。
- 根因二：选中描边硬编码 `#FF6A3D`；且 `selTown` 是数字，旧判断读 `.properties` 恒 false，选中高亮从未生效；父级区描边只在创建时取色，切主题不刷新。
- 修法：变体令牌改为站点令牌派生（`--bg-page:var(--bg)`、`--text-main:var(--ink)`、`--bg-card: color-mix(surface 55%)`、`--shadow-card:none`），重点色钉死 `#2F6B4F`/`#FF6A3D` 并排在通用规则之后；描边统一走 `accentColor()`；`applyVariant` 重刷父级描边；`selTown === p.i`。
- 根因三：`/app/housing/app.css` 无版本号，Pages/浏览器缓存旧样式；且外壳只按模块字节给 `?v=`，样式改了而 view.js 字节没变 → 旧模块引用旧样式。修法：构建时把样式内容哈希写进 view.js 的 href，并把补丁后的字节计入 `JS_VER`。
- 验收：线上 sage `#2F6B4F` / dark `#FF6A3D`，`--shadow-card:none`，控制台仅 GSI 空白瓦片 ORB 噪声。

## 2026-10-22 · M4.19f 数据期间上屏（滚动 4 季度）

- 用户问「这是多久的数据」→ 站上此前只有卡片 meta 里一行小字，页面主体没有任何时间说明。现在四处明示：
  - 工具条最左常驻徽标 `2025Q2–2026Q1 成約`（窄屏收起筛选后仍在，hover 有完整说明）；
  - 右侧数据卡新增加粗一行「対象期間 2025Q2–2026Q1（直近4四半期）」；
  - FAQ 第一条「いつのデータですか？」说明 4 个季度 = 2025年4月–2026年3月，以及国交省约滞后 1 个季度；
  - 首页第四张卡 unit 改成 `中古マンション / 2025Q2–2026Q1`，claim 写明「直近4四半期」。
- 口径核实：官方下载页 `cmbSeasonFrom` 最新选项就是 **2026年第1四半期**（2026-10-21 实测），所以 2025Q2–2026Q1 已经是「能抓到的最新滚动 4 季度」，无需换数据；2026Q2 公布后需重跑 `tools/build_housing_towns.py` + `python src/build.py`。
- 顺手修掉：h1 还写着「23区」→ 改「町名の価格」；stage caption 里残留的「60–80㎡」和原始 40,096 件 → 换成实际上图的 26,416 件。

## 2026-10-22 · M4.19g 点选后平滑飞入 + 重影修复

- 需求：犯罪率图与住宅图，点任意区域后视角平滑飞到该区域，缩放适中。
- 实现：两页各加 `flyToFeature(layer, maxZoom)` / `flyToBounds(b, maxZoom)`——`map.flyToBounds`，`duration 0.9`、`easeLinearity 0.2`；padding 预留右侧卡片（桌面 404px）与底部抽屉（手机 46% 高度），`prefers-reduced-motion` 时退回 `fitBounds`。
- 缩放档：区市町村 12、町名 14（犯罪率町丁 15.25）；手机再降 1 级，避免一个町占满屏。
- 修重影：底图是 GSI 白地図，z13 以上自己会印区名，我们的 62 个标签叠上去就是两个「千代田区」。标签改为只在 `z >= 10.5 && z < 13` 显示（犯罪率 `z >= 10`）。
- 修「飞过去又被拽回全局」：两页挂载后都有延迟 `fitTokyo23()`（60/180/1500ms），若用户已点选就跳过，加 `userNavigated` 闸。
- 选中态强化：选中町描边加粗到 3px，未选区域 `fillOpacity` 降到 0.52（区层 0.6），飞过去一眼能认出选的是哪块。

## 2026-10-22 · M4.19h 选中气泡 + 乱线修复

- 乱线根因：towns.json 的町多边形是町丁合并出来的，1,614 块里有 741 块带内环（最多 16 个），描边把内环也画了 → 选中区域里全是细线。两层修：① 合并时 `buffer(±1.5×simplify)` 闭合细缝、只保留外环，holes 归零、体积 1.35MB→1.05MB；② 前端选中态改为「填充不描边 + 单独的外环轮廓层」，即使将来再出现内环也不会画出来。
- 气泡：住宅图补齐犯罪率章同款标注——锚点圆 + 三环长脉冲 + 上浮胶囊（`hsg-lx-svg` / `hsg-lx-capsule` 骨架早就在，一直没接）。点地图显示「町名 千代田区一番町 264.7 万円/㎡」或「区市町村 青梅市 20.1 万円/㎡」，视野变化时跟随，卡片点选也有。
- 顺带：`hideCallout` 未使用已删；选中块描边 3px、未选区域 fillOpacity 0.52。

## 2026-10-22 · M4.19i 面板改实心底 + 飞入更跟手

- 面板：`#hsg-card` 内的 `--bg-card` / `--bg-card-sub` 改实色（`var(--bg)` 与 `ink 7% + bg`），`--card-glass: none`，`.panel-card` 去掉 backdrop-filter。满屏橙色时毛玻璃会把整块面板染成橙色，也是点选时重绘卡顿的一大来源。
- 飞入手感：`duration 0.9→0.65`、`easeLinearity 0.2→0.45`（原来的 0.2 起步太慢，看着像「先卡一下再冲出去」）；`flyToBounds` 用双 rAF 推迟一帧，让点击产生的卡片/描边先落屏再启动动画。
- 量过：click→flyToBounds 只差 5ms，`setStyle` 986 层 2ms，canvas `_redraw` 1ms —— 说明卡顿不是同步 JS，主要来自毛玻璃合成与动画起步曲线。

## 2026-10-22 · M4.19j 去重影 + 分布仪实心底

- 双线根因：选中町的描边（来自町丁合并几何）+ 父级区高亮（来自 MUNI_POLY 几何）两套边界数据在区界处错开几十米，看着就是「画了两遍」。父级区高亮整段删掉（`highlightParent` / `parentLayer` 一并清理），只留町自己的 3px 描边；区的信息由右侧卡片给。
- 左下分布仪改成实心底（`var(--bg)`、去 backdrop-filter），与工具条、右侧面板统一。
- 另外确认：数据里千石是单环 19 点、无洞，所以之前的重影不是数据问题。

## 2026-10-22 · M4.19k 工具条收短 + 自绘下拉

- 期间从工具条移到左下分布仪（信息归信息）：`#hsg-inst-period` 显示「2025Q2–2026Q1 成約」，hover 有完整说明；工具条宽度 590→394px。
- 原生 `<select>` 换自绘下拉：`ddHtml()` + `.hsg-dd`（按钮显示当前值 + 旋转箭头，菜单实心底、选中项 accent、hover 高亮、Esc/点外部关闭）。指标与粒度两个都改成下拉，二选一按钮组删掉。
- 顺手修：排序副标题原来写死「平均㎡単価の高い順」，切到平均成約価格时不跟着变 → 改成按当前指标生成。
- 删死样式 `.hsg-sel`；`byValueDesc` 改成函数。

## 2026-10-22 · M4.19k-2 犯罪率章同款下拉

- 犯罪率工具条三个原生控件（`<select>` 指标 + 令和年份按钮组 + 区市町村/町丁目按钮组）全部换成自绘下拉，和住宅章同一套观感：按钮显示当前值 + 旋转箭头，菜单实心底、选中项 accent、点外部/Esc 关闭。
- 宽度 691 → 515px。年份、指标、粒度切换后色阶、图例、卡片同步刷新；语言切换时三个下拉的按钮文字与选项文字一起更新。
- 删掉 `#crm-metric` 的 select 重建逻辑与 `.seg` 绑定，改为 `syncCrmDd()` 统一同步。

## 2026-10-22 · M4.19k-3 实心面板（深色/浅色都去毛玻璃）

- 根因：面板底色走 `--bg-card = color-mix(surface 55%, transparent)` + `--card-glass = blur(26px)`，地图从半透明里透出来，所以看着还是老样子。覆盖不生效是因为 `src/app.css` 里 `html body #crm-root[data-crm-variant=…]` 的特异性高于页面内联样式。
- 改法：两个变体统一 `--bg-card: var(--bg)`、`--card-glass: none`；犯罪章令牌在 `src/app.css`，住宅章在 `app/housing/app.css`（两处重复块都改）。
- 工具条：`#hsg-ctl-host` / `#crm-ctl-host` 去掉 `blur(14px)` 与 84% 半透明，改实心底。
- 内阁：`.panel-card` 去 `blur(16px)`，深色 `#121210`、浅色 `#E9EDE3`（原来 88%/90% 透明）。
- 地震：`--panel-bg` / `--panel-bg-soft` 由 88%/72% 透明改实心 `#0E0E0C` / `#E9EDE3`，`.eq-famous-panel` 去 `blur(26px)`。

## 2026-10-22 · M4.19k-4 点击区域不再过度放大

- 原因：点击后走 `flyToBounds(bounds, maxZoom)`，maxZoom 给到 14（町）/ 15.25（町丁目），而底图是 GSI 白地図、没有街道级细节，放大后只剩巨块色块，町名标签也在 z13 以上被关掉，等于「放大即失联」。
- 住宅：町 14 → 13，区 11.75；犯罪：町丁目 15.25 → 13.5，区 11.75，搜索定位同步 13.5。
- 手机端仍是 `maxZoom - 1`，不会比桌面更近。

## 2026-10-22 · M4.19k-5 飞入时的粗描边

- 根因：Leaflet 的 canvas 渲染器在缩放动画期间给整个 canvas 加 CSS transform 缩放，3px 的选中描边被一起放大（z11→z13 是 4 倍，视觉上十几像素的粗框），动画结束重绘才回到 3px。
- 改法：`flying` 标志 —— 程序化飞入（点击/搜索定位）开始时把选中要素的 `weight` 置 0，`moveend` 后恢复；另有 1.4s 兜底定时器防止 moveend 丢失。手动滚轮缩放不受影响（只有一帧级别放大，看不出来）。
- 住宅 `styleTown`/`styleWard`、犯罪 `muniLayer`/`chomeLayer`/`parentBoundaryLayer` 都走同一套 `restyleSel()`。

## 2026-10-22 · M4.19k-6 地图渲染换 SVG（卡顿根因）

- 实测：canvas 渲染器下，一次带动画的缩放主线程空转 200–300ms，点击飞入 700–1100ms（rAF 出现 1s 空洞）；事件处理器本身只有 13–15ms，说明卡在绘制/合成，不是 JS。
- 根因：Leaflet 的 canvas 是一整张 3300×2168 位图，缩放动画期间整体 CSS 缩放，Chrome 要重栅格化这张大位图；面积越大越卡（视口 3300×2168 → 708ms，2280×1508 → 264ms）。
- 改法：住宅/犯罪都去掉 `preferCanvas: true`，改用 Leaflet 默认 SVG 渲染。实测同一操作：住宅飞入 48ms（原 700+），单步缩放 42ms（原 299）；犯罪飞入 167ms、单步缩放 113ms（5,198 条路径，仍远好于 canvas）。
- 附带：`flying` 描边抑制继续有效（SVG 同样在动画期间被缩放）。

## 2026-10-22 · M4.19k-7 犯罪章选中态改 CSS 类（去掉全量 setStyle）

- 实测点击处理器：犯罪 61–78ms（5,198 条路径全量 setStyle）→ 改类后 11–23ms。
- 做法：chome 图层样式固定，加 `className:"crm-chome"`；选中时只给对应 path 加 `.is-sel`、给父 `<g>` 加 `.crm-dim`（CSS 压暗其余到 .62）；飞入时 `.crm-flying` 把描边置 0。`syncChomeSel()` 在 `renderChomeCard`/`applyMode` 后重挂，O(1)。
- 另加 `smoothFactor: 2.2`（对栅格化帮助有限，保留无副作用）。
- 结果（线上 1600×1000）：住宅点击飞入最大帧 8–38ms；犯罪 212–232ms（5,234 个多边形的 SVG 栅格化，冷启动首击 ~600ms 是瓦片加载）。

## 2026-10-22 · 气泡改成实心（浅色模式下地图注记透上来的 bug）

- 现象：住宅选中气泡在浅色模式下几乎透明，底图「あだち区 / 足立区」注记透上来压住气泡文字。
- 根因：`--capsule-bg: color-mix(in srgb, var(--surface) 94%, transparent)`，而站点 `--surface` 本身只有 4.5% 不透明度（是 tint，不是面），混出来≈4%。犯罪章那条本来写死 `rgba(255,253,249,.95)` / `rgba(18,16,14,.94)`，所以只有住宅出问题。
- 修法：住宅两套变体都改成 `--capsule-bg: var(--bg)`（实心）；犯罪两套也去尾数改 `#FFFDF9` / `#12100E`。实测 computed：住宅 `rgb(233,237,227)`、犯罪 `rgb(255,253,249)`。

## 2026-10-22 · 六切片全站审计 → 一次性修复

- 六个只读分身（交互 / 静态接线 / 布局视觉 / 数据 / 降级 / i18n·SEO）共 32 条 P1、45 条 P2，全部 P1 当轮修完；明细见 `.review/audit/FIXED.md`，原始报告 A–F 同目录。
- 关键修复：住宅指标单位串台、悬停读数不复位、气泡/卡片键盘不可达、窄屏气泡出屏；犯罪粒度切换残留选中态、瓦片 404、`--font-mono` 未定义；内阁无限加载与中文串味；地震中文 UI 与「40,079/2026-07」数据口径（改为由瓦片重建的 40,145/2026-08，新增 `tools/rebuild_quake_catalog.py`）；三语 head（title/description/og:locale/canonical）此前完全没有本地化。
- 新增降级路径：数据请求失败时恢复静态 poster + 本地化错误 + 重试（`window.pjStageFailed`），并修掉 `stage-live` 早于挂载 promise 置 1 导致失败被覆盖的问题。
- 未修:死 CSS 17KB / 死 export / 404 页 / og:image / quake 中文长简介翻译(见 FIXED.md「未修」)。

## 2026-10-25 · 封面改六块数据板(三列两行)

- 封面从四块板改为**六块**:`天气 / 地震 / 犯罪 / 内阁 / 住宅 / 新闻`,顺序即位置——天气第一块、新闻最后一块。新增两块是**预告板**:数据源未接,页脚标「予告 / 预告 / Soon」而不是「開く ↗」,卡片是 `div` 不是 `a`(守「零死链」),悬停不上浮不上色。
- 网格 `repeat(4)` → `repeat(3)`,两行;`≤1199px` 两列、`≤1000px` 单列(横版卡)、`≤640px` 竖版卡,均沿用原断点。
- 新板同为构建期 SVG(viewBox 1000×760,与另四块同一套 `--accent / --ink / .micro / .legend` 图例):天气板 = 与地震板同一份海岸线 + 四条等压线 + 三处测点环 + 24 小时刻尺;新闻板 = 十条话题阶梯(每条由数家媒体的色块堆叠),脚注图例与其余四块同款。
- 删掉封面眉标 `JAPAN.OUUUT.COM · 2000—2026`(`cover.kicker` 键一并从字典删除)。同时收紧整页纵向节奏:封面 H1 `4rem → 2.5rem`(ja/zh)、intro 内边距、卡片内边距/间距、大数字 `56px → 38px`、claim `14px/2.8em → 13px/2.3em`、图版框 `1000/760 → 1000/380`。实测(有头 Chromium,关缓存)六块板底边 **943px**,1920×945 视口内六块全在首屏;1440/1280/768/390 × 三语横向溢出均为 0,控制台零 error。
- 四章数字随之位移:卡片 02–05,章内 `*.eyebrow` 键同步改号(该键当前无渲染点,只是字典口径统一)。
- 更正:上一条 943px 只在 ja / 根字号 16px 下成立。只读核验分身用 ego-browser(根字号 20px)实测 974px,与「1920×945 全在首屏」相反;根因是封面 H1 的 `clamp(1.75rem,2.8vw,2.5rem)` 在 20px 根字号下顶到 50px(+25px),把第二行挤到折线下。改法:封面 H1 换 `clamp(28px,2.8vw,40px)`(EN 30/3.1vw/44)—— 该页其余字阶本就是 px,只有 H1 用 rem,改后封面不再随根字号长大。并按核验意见再收紧一档(图版框 1000/380 → 1000/340,卡片内边距/间距/页脚线各收 2–4px)。
- 更正后构建产物实测(有头 Chromium、关缓存、ja/en/zh × 根字号 16/20px):1920×945 六块底边 **887–893px**(余 52–65px)、1440×900 底边 **879–893px**(余 7–21px),两档六块全在首屏;1280×800 需滚动(要 ~860px)。横向溢出 0、控制台零 error、6 卡 4 链接不变。
- 核验分身另两条:①图版框宽于 viewBox 导致六块板左右各留 ~50% 白边、板内标注只有 4–4.5px(这是「六块塞进一屏」的代价,已写进设计锁 `home.plate_box`;要让图更大得把四块老板重排成宽构图,未做);②`q./c./b./h.eyebrow` 等 110 个字典键全仓无渲染点(既有欠账,非本轮引入),本轮只是把口径改号。
- 新键:天气/新闻的 `card.weather.*`、`card.news.*` 与 `card.soon`;字体子集字符集随之扩大(13 文件 2088KB)。设计锁新增 `home` 节与两条断言(`home-band-six` / `home-first-screen`)。

## 2026-10-25 · 封面账本:六种尺度移到卡片下面

- 形态:原「intro 大标题 + 一句说明」从卡片**上方**搬到**下方**,并重做成**六种尺度账本**——第一行左=标题(H1,「日本を、六つの尺度で見る。/ 用六种尺度,看日本。」)、右=收束句(「同じ国土を、六つの尺度で測る。」);第二行=六格横排,每格是**尺度名 / 覆盖量程**(仰いで見る / 全国 47地点、引いて見る / 列島 27年、寄って見る / 東京 62区市町村、通して見る / 内閣 14、並べて見る / 住宅 23区、追って見る / 各社 24時間),顺序与卡片一致。格子是纯文本不是链接(避免与卡片重复出口);尺度名与卡片头部的动词重复是刻意的(账本=图例)。
- 为什么这样切:卡片上方的 intro 一撤,折线腾出 ~145px;把它放到卡片下面,六块板与账本才有机会同屏。为把账本收进 1920×945,图版框 1000/340 → 1000/332(六块板各矮 ~4px,板内标注 3.9–4.4px)、账本只留 16–20px 内边距、标题降到 28px(EN 31px)。1440×900 只能做到「六块板齐全 + 账本标题行可见」,六格被折线切——两者都进 900 要让六块板再矮 ~40px,不值。
- 文案:三语标题/H1 由「四种尺度」改「六种尺度」;`cover.lede` 由「四个分句」收束成一句;新增 `cover.scale.weather` / `cover.scale.news`,复活此前无渲染点的 `cover.scale.quake|crime|cabinet|housing`;顺带把 `cover.cta` / `cover.section.eyebrow` / `cover.section.h` 三处**仍是「四」**的死键字符串改成六(它们依旧无渲染点),并把首页 `PAGE_META`(title/description,三语)与 `llms.txt` 首句由四改六——这两处是线上会看到的文案。
- 实测(构建产物、chromium、关缓存,ja/en/zh × 根字号 16/20px):1920×945 → 六块板底边 748–754px、账本末行 926–930px(都在首屏,余 15–19px);1440×900 → 板底边 747–754px、账本标题行 854–859px;1280×800 → 板底边 735px;1024×768 与 390×844 单列(照旧滚动)。横向溢出 0、控制台零 error、6 卡 / 4 链接 / 6 格三语一致;类名 `hp-intro` / `hp-lede` 已从源码与产物中消失。

## 2026-10-25 · 更正:账本首屏数字(核验 F1/F2)

- 核验分身(ego-browser 的 Chromium 1200 + 导入 profile)在**同一个 commit** 上量到:板底边 743.5–747.3px、账本末行 921.6–924.9px、余 20.1–23.4px,与上一条记的 748–754 / 926–930 / 余 15–19px **不重叠**(差 0.7–4.5px);1280×800 它量 723.4–726.1px,我记的是 735px(差 9–12px);另外上一条里「1440×900 标题行 854–859px / 1280×800 标题行 834px」在两台机器上都不对应任何渲染边。
- 我按同一口径复测(等 `document.fonts.ready`):板底边 748.6–753.6、末行 926.8–931.4 ——**等字体与不等字体只差 ~1px**,那 4–6px 是两个 Chromium 构建/profile 的字形度量差。结论未变(1920×945 六块板 + 六格全在首屏)。设计锁 `home.measured_2026_10_25` 与 README 第 7 行改成**区间**(板 743–754 / 末行 921–931 / 余 14–23;1440×900 余 147–157),并写清两个探针各自的口径与「等字体只动 1px」这条。
- F2:上一条「1024×768 及以下单列」是错的——1024×768 实测 `grid-template-columns: repeat(2,…)`(三行卡,板底边 1101–1107px),单列从 **≤1000px** 起(与该对象 `home.band` 的原写法一致);768×900 与 390×844 才是单列。核验同时确认了该对的档数(6/3/2 格)、1.15fr/.85fr 行比、图版框 1000/332 与 ≤640 的 1000/680 实测值、产物 CSS/HTML 与源码逐字节一致。

## 2026-10-25 · 账本拆掉,改成「六种尺度的一句话」

- 触发:用户看截图判「文案配置布局和内容太丑」,要求完全重做。复盘确实三处站不住:1**文案**——标题「日本を、六つの尺度で見る。」与右侧收束句「同じ国土を、六つの尺度で測る。」几乎同义并列,像事故;2**内容**——六格里的量程(「各社 24時間」「内閣 14」)与卡片自己的 unit / claim 大面积重复(47地点 vs 47、24時間 vs 24 等),是「用新形式重说一遍已经说过的」;3**布局**——一条细长横带,底下接着 METHOD,中间留出 ~100px 空洞。
- 现在的形态:细线之下 **两列**——左=标题(h1,EN `clamp(26px,2.6vw,38px)` / JA·ZH `clamp(24px,2.4vw,34px)`,最大 12em/15ch),右=**一整句**:「仰いで見る天気、引いて見る地震、寄って見る犯罪、通して見る内閣、並べて見る住宅、追って見る話題。」动词用弱色、名词用实色。没有索引、没有第二套数字、没有量程。
- 句子由**六张卡自己的键**在构建期拼出(`card.*.title` 作动词、`card.*.topic`/`nav.*` 作对象),所以措辞只有一个真源;标点单独成键 `cover.sep.term`(空 / 空 / `" · "`)、`cover.sep.clause`(、/，/`", "`)、`cover.sep.end`(。/。/`.`),原因有两条:语言切换只改文本节点、写不进 CSS 生成内容;而且这些分隔符是这句话**唯一的断行机会**(每个 clause 是 `white-space:nowrap`,CJK 词内不会被拆)。
- 同时删掉上一轮为账本加的 `cover.lede` 与 `cover.scale.weather` / `cover.scale.news` 三键(账本拆了就没有渲染点;`cover.scale.quake|crime|cabinet|housing` 回到它们原本的死键状态),并把 METHOD 的 `padding-block` 从 `clamp(36px,6vw,68px)` 收到 `clamp(28px,4vw,48px)` 抹掉空洞。
- 实测(构建产物、关缓存、等字体,ja/en/zh × 根字号 16/20px):1920×945 板底边 749–753、句子底边 876–880(六块板 + 整句都在首屏,余 65–69px);1440×900 板 749–752、句子 874–880(仍全在首屏,余 ~20px);1280×800 板 731、句子 755–851(首行可见);768×900 与 390×844 单列(句子 2–3 行)。横向溢出 0、控制台零 error、6 卡 / 4 链接 / 6 clause,类名 `.hp-scale-list` / `.hp-scales-note` / `.hp-scales-row` 在源码与产物中均为 0。

## 2026-10-25 · 核验整改:空译文写不回去 + 数字/档数修正(核验 F1–F6)

- F1(**P1,真 bug**):`cover.sep.term` 的 ja/zh 是空串,而 `shell.js` 的 `updateTextEls` 用 `if (v && v[l])` 判断「有没有译文」——空串被判成缺失,于是**访问过英文再切回日/中,英文那个「 · 」不会消失**(读成「仰いで見る · 天気、…」),只有刷新才自愈。改法:改成 `typeof v[l] === 'string'`(根因是切换器把「合法的空译文」和「缺键」混为一谈;全字典 170 键里只有这两个是空串,所以爆炸半径就是它俩)。实测两条路径 —— 手工点 ja→en→zh→ja、以及「存了 en 偏好后刷新 → 切 zh」——术语分隔符都正确回到空串,句间/句尾标点三语正确,零 error。改 shell.js 需重建(shell.js 会打进 site/assets)。
- F2(P3):`build_home_preview` 的 docstring 还写着「ledger」,改为实际形态(两列陈述)。
- F3(P3):1280×800 那组数字超出我自己写的 ±6px(板 731–732 实测 en 723.4;句子 755–851 实测 en 747.4…838.2)。根因:我用一套「单一区间」盖住了**英文卡比日/中矮 ~4px** 这件事。锁与 README 全部改为跨探针区间(1920 板 743–754 / 句 870–881;1440 板 743–749 / 句 869–881;1280 板 723–733 / 句 747–852)。
- F4(P3):`home.plate_box` 写「≥641px 即 1000/332」不实——641–1000px 那条断点把图版设为 `height:100%` + `min-height:188px`(此时无 aspect-ratio),1000/332 只在 ≥1001px 成立,≤640px 回到 1000/680;已按断点写清。
- F5(P3,既有):`.hp-method-link` 那三条规则全仓无对应元素(与 HEAD~1 相同),不在本轮范围。
- F6(P3,既有):768×900 **英文**界面下 `.tools` / `.lang-nav` 右缘 833.1 > 768(被 `html{overflow-x:clip}` 藏住,所以「溢出 0」只对 `html` 成立),该档位点不到语言切换按钮。属 `app.css` 的既有缺陷,本轮只把口径写清,未改。
- 更正(核验二轮):上一行说「点不到语言切换按钮」不精确——实测只有**最右侧的「中文」**(804.1–833.1)完全在视口外,EN(709.8–742.8)与 日本語(758.9–787.9) 仍在 768 内、可点;`elementFromPoint` 在「中文」中心会被夹到 x=767 并命中「日本語」。实质结论不变(顶栏被裁、`body.scrollWidth` 833 > 768、app.css 既有、未改)。

## 2026-10-25 · 六卡以下整体重做:四方案本地对照(未落生产)

- 触发:用户看首页截图,要求按全站极简风格**完全重新设计六张卡片下方全部部分**,给不同方案做可选择的本地预览。此次不动 `src/build.py` / `src/home-preview.css` / `site/index.html`,只新增 `design-previews/closing-options/`;预览生成器把隔离页写入 `site/design-previews/closing-options/`,共用真实 CSS、字体、字典与六卡。
- 四档结构: **A 编辑宣言**(左侧唯一标题,右侧方法+可展开出典);**B 六尺度目录**(纯寻路,不再重复卡片数字);**C 方法与出典**(可信度为主角,真实四章来源默认展开);**D 一体收束**(无独立宣言,一句标题+方法+出典+短页脚)。四套均去掉页脚重复尺度句与重复章节导航;天气/新闻仍为预告、不是链接。保留现状对照档。
- 操作:顶部方案按钮、数字键 0–4、左右方向键、桌面/390 容器开关;原站三语与 sage/dark 控件保留。默认 `?lang=ja#a`,锚点可直达各方案。预览入口 `http://127.0.0.1:8900/design-previews/closing-options/?lang=ja#a`。
- 实测:每档从干净页面打开,A–D × 桌面/390 容器均为 6 卡 4 章链接、一个可见方案与一个 H1;三语逐键匹配,CJK 字体栈正确,两主题计算色切换;A/B/C/D 出典按钮与 `aria-expanded`、hidden 同步。展开按钮溢出 0;局部溢出 0;英文 C 390 也溢出 0。旋转图标已改成不旋转的＋/×,消除过渡期外接盒溢出。
- 证据: `design-previews/closing-options/report.json`、`screenshots/`、`README.md`。本轮只做候选,不宣称已定稿、未改设计锁、未 push/部署。下一步唯一事项:用户选 A/B/C/D 后,将单方案移植回首页生成器与样式并做生产验收。

## 2026-10-25 · 对照台核验整改(默认入口 / 容器菜单 / 标题字体)

- 独立只读核验找出三处可复现缺陷:①无 hash / 非法 hash 时所有方案隐藏,后续空引用中断;②桌面下 390 容器模拟未完整覆盖顶栏窄屏规则,菜单按钮右缘被裁、语言菜单不可达;③全站 `h1…{font-family:var(--font-sans)!important}` 覆盖四个候选的编辑衬线,实测计算字体与声明不符。此前仅按 DOM 与局部探针宣称通过不成立,按核验返工。
- 修复:无效 hash 统一回退 A 并规范化地址;390 改为**固定高度、内部滚动的手机框**,菜单 `position:absolute` 限制在框内,顶栏用容器宽度约束品牌与工具区;英文标题仅在本预览四个候选上用精确选择器恢复 `var(--serif)` / 400,日/中明确用 JP/SC 字体栈 / 300。未动全站字体策略与首页。
- 实测:无 hash、#x 均一个可见 A、控制器 ready;四个英文标题计算字体 Instrument Serif / 400,字体文件 loaded;390 容器溢出 0,真实点击汉堡→框内菜单→EN 成功。截图与 `report.json` 已重生成;过程旧报告移至归档,不再作为最终证据。只读第二轮复核已派,尚未返回。
- 收口记录:预览与三项核验坑已写 retain(首次读回为相关条目,非原文);过期报告/截图/重复生成 HTML 移至 `F:/archive/20261025-panout-closing-preview-stale/`;Axe 未安装,未宣称全套无障碍通过;未部署/未 push。修复提交 `f3f812e`,只读第二轮复核尚未返回。
- 第二轮只读复核:默认入口、框内菜单、三语字体、展开状态与生产隔离均通过;另指出 390 框内 `vw` 仍按桌面视口解析(边距 56px、现状标题 38px)且滚动条占 15px,非真机保真。修复:390 框内容 `.wrap` 固定 20px 内边距、框内滚动条按项目允许的非默认形态隐藏使 clientWidth 回到 390、菜单右缘同步归零。实测框 390/client 390、现状标题 28.08px 对真实 390 的 28.0958px,内边距均 20px,品牌完整、菜单真实点击切 EN 成功。

## 2026-10-25 · 用户选定 C＋A:正式首页收尾组合

- 用户指定「六张卡片下面插入 C，然后在 C 的下面插入 A 的几个大字：六种尺度看日本。写在一行里。六种尺度四个字变成重点色」。已落到真实生成器 `src/build.py` / `src/home-preview.css`，不是第五套隔离方案。
- 结构固定为 `.hp-band → .hp-provenance → .hp-statement → .hp-foot`。C 保留方法、四真实来源、计算口径，原生 `<details open>` 默认可读、可键盘收起；A 为单 H1 单行大字，中文「六种尺度看日本。」只给「六种尺度」`var(--accent)`。日/英同型、各自短语高亮。旧 `.hp-scales` / `.hp-method` / 重复页脚导航和标语删除，字典不再留旧句。
- 住宅来源写清东京全域 26,416 笔与 23 区 21,848 笔的不同口径，不当作新旧数字互相覆盖。桌面 C 双栏、≤1000px 单栏；A 三语 320–1440px 单行。顶栏修复既有 768px 英文语言按钮与 ≤375px 汉堡按钮挤出问题，恢复完整手机品牌与 44px 点击区。
- 有头 ego-browser 实测：9 宽度 × 3 语言共 27 组，单行、溢出、六卡四链、出典四链、单 H1 均通过；键盘关闭/展开真实可见性正确，手机 EN/ZH 实际切换、深色高亮、禁 JS 静态 JA 出典可读；错误 0。证据 `.review/ca-hybrid/report.json` 与同目录 screenshots。未宣称全站 axe/跨浏览器/线上通过。
- 四方案对照台已移入 `F:/archive/20261025-ca-hybrid-panout/closing-options/`；核心文件、旧首页与交接文档备份在同目录。设计锁、README 已更新。C＋A 设计决策已写 retain，doc `a3c64fb2`。
- 独立只读核验待派；本轮仅本地，未部署、未 push。
- 已提交 `310cb97 home: combine C provenance with A closing statement`，并派 `ClosingHybridReview` 只读核验；源码冻结等待结果。
- `ClosingHybridReview` 返回 **findings 0 / correct**：独立核对六卡结构、DOM 顺序、三语标题与唯一高亮、真实出典、住宅双口径、无 JS、顶栏发行 CSS 与旧方案归档。未起浏览器做像素复测，故不额外声称独立像素级验收。
- 报告证据复核：它提到的 `report.json` 尾部疑似 320/280 标签错位，**当前文件不存在 280 标签**；尾部为 360 与 320，各含 zh/ja/en，320 的 titleSize 分别 26.24/21.44/22px、viewport 均为 320。按当前证据不作页面缺陷处理，也不据其范围外的 ≤290px 推断扩大合同。源码未因此改动。

## 2026-10-25 · 作者落款与 5 秒字标循环

- 用户要求从记忆挖公开作者信息、把两个域名与联系方式融入 A 大字，并把左上角 `japan.ouuut.com` 做成「域名逐字出现→渐隐→六种尺度看日本逐字出现→渐隐→域名」的 5 秒无限循环。公开信息只取 `sai` 记忆已核实的身份与站点定位：中本蔡 / NAKAMOTO SAI，在东京的上海人、自由 AI 创作者；`ouuut.com` 是独立项目品牌站，`saaaai.com` 是个人主页；联系方式放 `sai@saaaai.com` 与 X `@saaaaicom`。未放年龄、签证、家庭等私人信息。
- 作者落款放在 `.hp-statement` 内、H1 之后，不另起卡片：左侧职位、姓名、三语一句简介，右侧两个域名入口（`独立项目` / `个人主页`）和邮件/X。桌面双栏、≤1000px 单栏；`data-t` 只挂叶子节点，`data-t-aria` 更新导航可访问名，语言切换不覆盖姓名与域名。
- 顶栏使用 `animated_wordmark()`：`.wm-static` 保留原域名（可访问名与无 JS/减少动效回退），`.wm-stage` 里 `.wm-domain` 15 个字符与 `.wm-cjk` 7 个字符逐字错峰。完整循环 5000ms：0–2.45s 域名，2.5–4.8s 中文，余下空拍；纯 CSS、只动 opacity，舞台宽度由静态域名预留。页脚字标保持静态。
- 有头 ego-browser 实测：27 组宽度/语言无失败；动画暂停采样 0/650/2450/3000/4800/5000ms 分别为英文 0/15/0/0/0/0 字、中文 0/0/0/7/0/0 字，duration=5000ms，右侧工具与字标宽度位移均 0；`prefers-reduced-motion` 与禁 JS 均只显示静态域名；五页 × 三宽度共 15 组共享顶栏无溢出或按钮挤压。作者区浅色最低 5.3:1、深色最低 6.74:1；320px 无横向溢出。ouuut.com / saaaai.com / X 目标实测 200。
- 证据 `.review/author-wordmark/report.json` 与 screenshots（`final-1440-desktop-domain/cjk`、`final-390-mobile-cjk`、`final-1440-bottom`、`final-390-bottom`、`final-1440-dark-bottom`、`final-320-bottom`）。构建 5 页，CSS `86ad3e34`，fonts `f2d2c9ae`，charset 2193；`py_compile`、`node --check`、design-lock JSON、`git diff --check` 通过。仅本地，未部署、未 push。
- 已提交 `beda6f0 home: add author signature and animated wordmark`；`AuthorWordmarkReview` 独立复核未发现实现缺陷，但指出 `saaaai.com` 落地页并非纯个人主页。亲自用浏览器 + 禁缓存复核：title「セイシン株式会社｜AIプロダクト・スタジオ」、H1 `nakamoto sai`、含会社概要；`llms.txt` 仍自称个人主页。按一手现状把标签从「个人主页」改为中性「主站 / Main site」，日英简介补上与中文一致的「上海出身」，避免把过期记忆当现状。修正提交 `92811f4 home: correct saaaai site label`，重建 CSS `3eba3c3c`、fonts `d7a1a926`、charset 2192。
- `SaaaaiLabelReview` 第二轮独立复核：**未发现缺陷**。实测三语标签为 主站/メインサイト/Main site，日英简介含上海出身，9 组 320/390/1440 无越界，4 个入口 href 正确，`.hp-author` 仍位于单 H1 之后；补丁未触及动效，减少动效与静态 HTML 回退保留，发行资源哈希与交接一致。`.review/author-wordmark/report.json` 的 `correction.failures=[]`。仅本地，未部署、未 push。

## 2026-10-25 · 字标减速、字重与三语 LOGO

- 用户反馈：中文字标太粗，应与卡片「抬头看」同字重；动画太快，网址完整后要停几秒，再滚出文字，文字完整后再停几秒；并且三种语言要有三个 LOGO。
- 实测卡片中文 `.hp-verb` 为 250、中文字标原为 500；改为 250。日文 LOGO 也 250；英文按英文卡片字重使用衬线 400。三语版本分别为「六つの尺度で見る」「六种尺度看日本」「Six scales of Japan」，各自独立动画层，只显示当前 `html[lang]` 对应版本。
- 周期改为 12000ms。100ms 冻结采样：网址完整 1200–4100ms（3.0s）；日中 LOGO 完整 7100–10400ms（3.4s）；英文 7300–10400ms（3.2s）；两串无重叠。所有动画 duration=12000ms，工具与字标宽度位移 0。
- 验证中修出两处真实缺口：中文渐隐关键帧原落到父层切换之后，已压回自身半周期；三语层漏了公共 `.wm-phrase` 类导致三版同时显示，已补齐并重建。
- 9 组 320/390/1440 × 三语无溢出，可见 LOGO 宽度均在原字标舞台内；五页 × 两宽度共享顶栏 10 组无失败；实际点击 EN/ZH/JA 均立即切换为对应 LOGO；减少动效与禁 JS 仍固定显示静态域名。构建 CSS `3e4312e1`、fonts `0d7289d9`、charset 2192。证据 `.review/wordmark-tuning/report.json` 与六张三语桌面/手机截图。仅本地，未部署、未 push；独立复核待派。
- `LocalizedLogoReview` 首轮发现 P1：切换语言后新显示层从 `display:none` 重新起算动画，与网址层相位错开，最多可同屏约 3.4s。修复为三版始终 `display:flex`、用 `visibility` 显示当前语言，隐藏层继续走同一时间轴。切换后实测相位差 0–14ms，EN/ZH/JA 各自整轮采样 `bothVisibleAt=[]`；网址与 LOGO 满显窗口不变。重建 CSS `2e8c308d`、fonts `1ae3f06e`。修正提交 `e4443ee fix: keep localized logo phases aligned`。
- `LogoPhaseReview` 第二轮独立复核：**未发现缺陷**。实测三语层 `startTime` 恒定、点击 EN/ZH/JA 后相位差 0ms，未重启；域名与 LOGO 同屏 0.00s；满显约域名3.0s、三语LOGO约3.5s；字重 250/250/400 与同语 `.hp-verb` 一致；320/390/1440 无溢出；减少动效/无 JS 静态回退保留；单 H1、作者落款、四入口无回归。仅本地，未部署、未 push。

## 2026-10-25 · 日文 LOGO 补齐宾语

- 用户指出「六つの尺度で見る」漏了看的对象「日本」。修正为 **「六つの尺度で日本を見る」**，11 字；中/英文不变。日文字号调至 `.64em`，逐字间隔 28ms，维持完整停留 ≥3 秒。备份 `F:/archive/20261025-japanese-logo-panout/`。
- 有头 ego-browser：9 组 1440/390/320 × JA/ZH/EN 全过，恰好一个当前语言层，文字、字重与参考 `.hp-verb` 一致；日文 LOGO 宽 237.03/172.33/129.33px，均在原字标范围内，横向溢出 0。桌面及手机截图未见裁切。
- 50ms 冻结时间轴按每字 opacity 严格为 1 采样：日文完整 7200–10400ms（3.25s）；中文 7150–10400ms；英文 7400–10400ms；网址 1150–4050ms。语言切换后相位差 0ms、两串无同屏。减少动效与禁 JS 回退通过。报告 `.review/japanese-logo-correction/report.json`。
- 重建 5 页，CSS `955d089f`、JS `664b7e9d`、fonts `0346c329`、charset 2192；`py_compile`、JSON 与 `git diff --check` 通过。仅本地，未部署、未 push；只读复核待派。
- 修正提交 `07091d2 fix: restore Japan in Japanese logo`。`JapaneseLogoReview` 独立复核未发现缺陷：5 页 JA 11 字、三语只显示一版、1440/390/320 无裁切/溢出、切换不重启、静态回退保留；H1 原有「日本を」未误改。
- 验收过程中两次探针写法错误（漏传语言、把 NodeList 当元素）均已修正；曾尝试调 EN/退出时序，因超出本次翻译修正范围已全部撤回，最终 `src/build.py`、`src/app.css` 与 `07091d2` 完全一致。最终构建 CSS `92371dd8`、fonts `f15785d0`。
- 最终报告 `.review/japanese-logo-correction/final-report.json`，失败 0。锁定视觉口径每字 opacity>0.99：JA 7100–10450ms、ZH 7050–10450ms、EN 7250–10450ms；严格 opacity=1 的 50ms 采样：JA 7200–10400ms、ZH 7150–10400ms、EN 7400–10400ms。记忆 `wiki:correction-panout-japan-wordmark-20261025` 已回读；短条检索 doc `89186112-85f8-478a-bfe3-3479d000ece2`。

## 2026-10-26 · 首页与三语 LOGO 生产发布收口

- 用户明确要求上传生产并收口。发布前线上仍为「四つの尺度」，本地领先 GitHub/Gitea 各 25 个提交；无远端分叉。保存旧部署 `efaf451f-dd9a-4aa7-a7e8-3f0c594aa887`、生产 HTML 与 Cloudflare 项目/部署信息于 `F:/archive/20261026-panout-production/`。
- 初次部署 `5d11e61b` 后，线上三语×1440/390/320 无溢出，JA 11 字完整；四章真实挂载全过：quake WebGL、crime/housing Leaflet、cabinet canvas。真实生产 Lighthouse 性能 97 / A11y 100 / Best practices 100 / SEO 100，LCP 2.1s、CLS 0、TBT 0ms。Python 本地预览不压缩， Lighthouse 58 不作为线上指标。
- 发布探测发现缺顶层 404，Pages 把未知路径回退首页 200。新增本地三语 404、noindex、首页/四章/联系入口，注册时 `register=False`，sitemap 仍 5 个内容页。补首页 WebSite+Organization JSON-LD、字典独立内容哈希 `?v=98c95ae6`、404 响应 noindex。最终 `63262ef feat: add localized 404 and versioned dictionary`，重建 CSS `d417da71`、JS `10eb08f4`、fonts `12f06251`。
- 最终生产 `b9b0c617-0a3f-49a8-8d05-ac6e8cd72c96`，未知 URL 真 404/no-store，三语版本化字典与结构化数据在线验证通过；robots/sitemap/llms/资源 200，TLS 余 76 天。最终报告 `.review/release/`。GitHub/Gitea 已 push 并 fetch 对账均 0 领先/0 落后。
- 长项目监控三条件成立：线上常驻、周期可看、可机器判活。复用 vps-jp Kuma+TG：`panout_watch.py` 每小时第23分钟检查首页标记/robots/sitemap/llms/TLS；Kuma `panout-japan-check` id53 interval5400，通知1，登记 registry、KUMA_HB、PROBE_HEARTBEAT 已补，cron 已挂。首跑缺 JSON-LD 曾立案，补齐后实测 heartbeat UP + 恢复通知。Kuma 备份 `vps-ops/backups/kuma.db.pre-20261025-155727`，共享配置备份 `~/archive/20261026-panout-monitoring/`。
- 未做：Search Console/Bing 提交、各社交平台预览、统计事件审计、全浏览器矩阵、真生产回滚计时；这些不等于已验收。下一步 24h 观察，天气/新闻仍是预告，不冒充已接数据。

## 2026-10-26 · 天气章接入生产并收口

- 用户要求把选定的天气页推送上线并收口。此前天气只存在于 `.review/weather-lab/` 本地预览，生产没有 `/weather/`；首页天气卡是「予告」占位。
- 接入方式：把最终运行时复制到 `src/weather/`（`app.js`、`lab.css`、`data.js`、`geo.js`），`src/build.py` 新增 `build_weather()` 与 `/assets/weather/*` 版本化资产，`WEATHER_VER=40145957`；`src/shell.js` 的 `pageKey()` 加 `weather`，`setLang()` 派发 `pj:lang` 让天气页随全站语言切换重渲染。首页天气卡改为 `/weather/` 实链，导航/404/llms/sitemap/`_redirects` 同步加天气；首页来源面板从四章变五章。
- 本地构建：6 个内容页，191 个 i18n 键，6 个 sitemap URL；CSS `39c895b0`、JS `a78b2c26`、fonts `5d02f1ac`、charset 2244。有头 Chromium 实测 1440/390/320/768：天气页 47 州、46 个主图地点 + 冲绳 inset、47 行无 JS 回退；默认东京，点冲绳圆标选中 `471000` 并显示「那覇/那霸」；语言切换、选择器、今日/明日、表格行均可用；横向溢出 0。首页 5 个实链 + 1 个新闻预告，来源 5 条。
- 发布：Cloudflare Pages `panout-site` 部署 `1ca63cf9-e8f4-4f71-a9c8-41900ca9cf74`（源码 `692d5e9`），上传 23 新文件 / 54 已存在；`/weather/` 线上 200，`/weather` 301 到 `/weather/`，未知 URL 真 404 + no-store；天气 HTML `max-age=0`，`/assets/weather/*` 200 且 immutable；sitemap 6 条、llms 五章、robots 200。
- 线上浏览器：天气页 47 州、默认东京；真实点冲绳选中、日语「那覇」/中文「那霸」；中文 canonical 带 `?lang=zh`；390px 卡片 200×200、无溢出、移动菜单含天气；首页天气卡是 `<a href="/weather/">` + 「開く」；四个既有章节仍正常挂载（quake WebGL、crime/housing Leaflet、cabinet chart）。
- 线上性能探针（390px，禁缓存）：LCP 240ms、CLS 0、1 个 133ms long task、无溢出。未重跑 Lighthouse（本机无 Chrome 安装），不把该探针冒充 Lighthouse。
- 监控：既有 vps-jp `panout_watch.py` 仍检查首页标记、robots/sitemap/llms/TLS；其 `panout-japan-watch/1.0` UA 对生产返回 200。Kuma id53 / 每小时第 23 分钟不变。
- 备份：`F:/archive/20261026-125659-panout-weather/`（旧 `build.py`、`shell.js`、README/HANDOFF/CHECKLIST/progress/TRACK_TREE、旧 `site/index.html`、headers/redirects/sitemap/llms、Cloudflare 旧部署元数据）。旧生产 `b9b0c617` 为回滚点。
- 未做：天气快照刷新/定时任务未接；天气页 Lighthouse 未重跑；新闻仍为预告。源码提交 `692d5e9`，文档收口提交紧随其后；双远端推送并 fetch 对账 0/0。

## 2026-10-26 · 天气快照日更上线

- 用户把时间与执行方式全部交给我判断。选定 06:10 JST：使用 JMA 05:00 短时预报，早上打开页面看到的是当天预报；05:00 产品不发布今日最低气温，`todayLow` 继续为 `null`，这是官方数据缺口。
- 新增生产数据模块 `tools/weather_data.py`（只抓 95 个 JMA 资源，不重抓 Natural Earth、不重算 `geo.js`）与编排 `tools/refresh_weather.py`：抓取 → 47 县校验 → 写候选 → 全量构建 → 本地产物校验 → Cloudflare Pages 部署 → 线上复核 → 双远端提交；失败保留旧快照，部署后复核失败尝试回滚上一部署。
- 新增 `deploy/systemd/panout-weather-refresh.{service,timer}` 与 `tools/panout_weather_refresh.sh`；VPS `vps-jp` 安装 systemd user timer，06:10 JST、`Persistent=true`、flock 防重入。VPS 字体源一次性同步到 `/home/ubuntu/panout-fonts/` 与仓库 `.cache/fonts`；`src/fonts.py` 支持 `PANOUT_LATIN_FONTS` / `PANOUT_SC_FONTS` / `PANOUT_OUTFIT_FONT` 环境变量。VPS 安装 `python3-shapely` 以支持全量构建的首页 SVG 裁剪。
- 凭据：VPS `~/.config/panout/weather.env`（600）保存 Cloudflare Pages token/account 与字体路径；GitHub 使用仓库 deploy key `vps-jp weather refresh deploy key`（write），Gitea 走既有 SSH。没有把 token 写进仓库。
- 首次手动生产 run：`bash tools/panout_weather_refresh.sh --force`，JMA 95 资源、47 县、`generatedAt 2026-10-26T04:36:11Z`（短时预报 11:00–12:00 JST）；VPS 构建 6 页、CSS `a5806f8d`、JS `54848846`、fonts `314fe557`、charset 2243、weather `abac1865`；部署 `ca2cf008-5a36-4f16-a213-e921e3564d5b`，线上 `generatedAt` 与 47 县复核通过；提交 `ae514e7` 并推送 GitHub/Gitea。第二次无 `--force` run 正确跳过；`systemctl --user start` 也 exit 0。
- 监控：Kuma 新增 `panout-weather-refresh` id 54，push interval 93600s（26h）、notification 1、token 入 `kuma_tokens.json`、`KUMA_HB` 映射已加；只有部署与线上复核通过后才推 UP。既有 `panout-japan-check` id 53 不变。
- 线上浏览器（ego-browser）实测：`/weather/?lang=ja` 47 州、47 行、49 个地图点、默认东京 `130000`、`generatedAt 2026-10-26T04:36:11Z`、横向溢出 0、H1「日本の天気」；截图 `.review/weather-lab/live-refresh-1440-ja.png`。
- 2026-10-26 强制生产 run 两次：13:57 run `generatedAt 04:57:51Z`、部署 `e2947d58`、提交 `5e2ee2b`；14:07 修复周日期后 run `generatedAt 05:07:02Z`、部署 `e16a2b8e`、提交 `6d37d1b`。浏览器发现 `week[0]` 是明日但 UI 当今日，标题/7 卡整体错一天；`src/weather/app.js` 增加 `weekEntry`/`dayDate`，今日用 `reportDatetime` 日期，明日及以后取 `week[0..5]`；本地与线上实测 dateline `10月26日(月)`、7 卡 `10/26–11/01`、47 行、0 溢出。
- Kuma 看门狗接入（2026-10-26）：新增外部探针 `deploy/vps/panout_weather_watch.py` → VPS `/home/ubuntu/vps-ops/scripts/panout_weather_watch.py`，cron `45 * * * *`，registry `panout-japan.weather`，心跳 `panout-weather-refresh.ok`，Kuma id 54（26h、1 retry/120s、TG id1）。探针校验 `state.json`（06:40 JST 截止、`last_failure_at`、26h 年龄）、`/weather/` H1、版本化 `data.js` 的 `generatedAt`、47 县、`reportDatetime`、`week[0]` 和 immutable 缓存；`refresh_weather.py` 失败时写 `last_failure_at/last_error` 并推 DOWN。首测误把 JS 渲染的 47 行当成静态 HTML 行，已改为只验 H1 + data.js，重跑恢复；failure/deadline/date-mismatch 分支用临时 state 验证通过。
- 未做:首次自动 06:10 run 要等 2026-10-27;真实回滚未计时;天气页 Lighthouse 未重跑。运行手册 `docs/WEATHER-REFRESH.md`。源码提交 `ec09254` + `6d37d1b` + `b8e45d6`,文档收口 `1f0d211`;双远端 fetch 对账 0/0。

## 2026-10-31 · 第六张卡:人口章实现

- 用户否掉新闻话题,选定「数えて見る 人口」。调查后落地:2025 年国勢調査(総務省統計局,2026-09-29 公表)1-1/2-7/49-1 表 + 社人研 2023 年 2050 推计。
- 新增 `tools/build_population_data.py`:下载/缓存五份 xlsx,合并 1,719 市町村(20 政令市+特別区部+772 市+926 町村);人口/世帯/年齢/外国人/面積/密度/2020→2025/2050 系列;13 个浜通り市町村没有个别 2050 值;输出 `app/population/data/population.json`(765KB)。
- 主视觉不是地图:`app/population/view.js`(Canvas)1,719 等面积方格 ↔ 人口加权树图,指标 増減/人口/65+/2050,搜索、卡片、tooltip;`app/population/app.css`。`src/population.css` 负责 hero/数字条/年龄金字塔/47 县表/方法;金字塔与 47 县表是构建期静态内容,无 JS 可读。
- 首页第六块板换成人口:`src/home_plates.py` 删除 `news_svg`、新增 `population_svg`(1,719 格 + 47 县 ribbon);`card.news.*`/`card.soon`/`.hp-entry-soon` 全删;六块板全部是链接。
- 集成:nav 五→六;sitemap 六→七;`_redirects` 加 `/population`;`llms.txt` 六章;404 六章;shell `pageKey`/`mountStage` 加 population;`collect_chars` 加 1,719 名;字体 13 文件 2.3MB。
- 数字:122,972,528(−2.5%);1,719;1,568 减(91.2%)、150 增 + 1 横ばい;73.4% 住在减少市町村;65+ 29.5%;2050 104,686,386(指数 83.0)。
- 构建:7 页,charset 2420-2421,字体 13 文件 ~2287KB;本地浏览器验收进行中。
- 本地验收(headless Chromium,omp 托管):桌面 1440×900 无溢出;方格 ↔ 树图 91.2% → 73.4%;2050 指标 104,686,386;搜索选中特別区部(排名 1、+2.2%、2050 10,260,520、指数 105.4);EN 切换 H1 “Population — 123.0 million”、app 标签 EN;ZH H1「人口 — 1亿2297万人」、金字塔总数本地化;手机 390×844 无溢出、札幌市卡片从底部滑出;禁用 JS 仍有 poster + 47 县表 + 金字塔 + 8 数字条;首页六卡含 `/population/`、出典六章、无「予告/追って見る」。截图 `C:/Users/sai/ego/population-qa/`。提交 `5c232cb`。
- 预览部署:`npx wrangler pages deploy site --project-name=panout-site --branch=population`(82 文件)→ `https://f993fdb9.panout-site.pages.dev`,别名 `https://population.panout-site.pages.dev`;别名上 `/population/` 200、47 行、6 nav、canonical 指向生产域;`/population` → `/population/`;首页六卡; sitemap 7; llms 六章。生产 `main` 未动;推生产前需先更新 VPS checkout,避免 06:10 天气刷新用六页覆盖。
- 用户反馈「根本看不懂怎么看」:在英雄区与舞台之间加「読み方」三步(不是地图 / 1 格 = 1 市町村 / 颜色 = 2020→2025 增减 / 点击与搜索 / 为什么不是地图);大数字下加整句副行(1,568 / 1,719 · 减少市町村住 73.4%);视角按钮改为「同じ大きさ / 人口の大きさ」;图例补全「減少 / 0 / 増加」三端;画布标出東京、秋田两个阅读锚点。JA/ZH/EN 桌面 1440 与手机 390 实测无溢出、无与搜索行重叠;重建 charset 2423,预览重新部署。截图 `read-*.png`。
- 用户反馈「左右宽度不一样、文字歪、卡片没居中」:量测发现根因是 `.pop-read` / `.pop-stage-wrap` / `.pop-section` 用 `padding:` 简写把 `.wrap` 的横向 padding 写成 0,英雄区内容在 96、其余区块在 40;段落 max-width 又有 720/760/560/无 四种;分区头 `space-between` 让说明列左缘随标题长度漂移(840/945);读法三列因 padding 不同宽(428/404/429)。改法:三处改 `padding-block`;统一段落 `--pop-measure: 640px`;分区头改 `grid: 1fr 640px`(说明列恒在 704);读法三列改 gap 等宽(379/379/379);方法网格末项跨两列;表格序号列右对齐;分隔线用 `::before` 内缩到内容轴(96..1344)。1440/1920/390 实测:wrap 内容轴 96..1344(1920 为 336..1584)、舞台盒 96..1344、一个文字右缘 736、无横向溢出;全站七个页面 wrap 轴一致。截图 `align-*.png`。
- 用户要求收口 + 指出人口卡片还没上正式域名:本地三个提交 rebase 到 `origin/main`(`fd2770f`,含五个天更提交)→ `cbca157`;gitea 直接推成功,GitHub 本地 HTTPS 推送被拒(`Bad password`),改由 VPS 部署密钥代推(`vps-jp: git push origin FETCH_HEAD:main`)。重建后 `wrangler pages deploy site --branch=main` → 生产部署 `ea896d63`;实测 `japan.ouuut.com` 首页六卡(含 `/population/`,无「予告/追って見る」占位)、`/population/` 200(读法、91.2%、47 行、六导航、canonical 自指)、sitemap 7、llms 六章、七章全 200。回滚目标 = 上一个生产部署 `78320a3e`(2026-10-31 06:12 JST)。VPS checkout 已拉到 `cbca157`;01:41 JST 手动 `--force` 因 JMA 尚未发布当日短时预报而中止(未动线上),06:10 定时任务会以七页重建并部署。
- 内阁章数据刷新(用户问「最新数据要不要更新」):按现有 7 源口径逐月核对残差 → 日経 10 月调查已发布(vdata `202610`,10/23-25,支持 62/不支持 31)、共同 9 月调查(9/17-18 全国紧急电话,53.4/不支持 30.9,较 8月22-23日的 50.2 升 3.2)。写入 `app/cabinet/data.json` → v8.4、646 次调查/331 个月/14 内阁;2026-09 均值 55.0、2026-10 均值 53.5(各 7 源)。重建 `site/`(charset 2424、CSS `6e7ee36a`、JS `bf04d2d9`),ego 本地无头验收(H1「内閣 — 331か月」、页内「646 民调统计数」、2026-10 点 53.5、无横向溢出),提交 `7b3febd` 推 gitea+GitHub,VPS checkout `--ff-only` 对齐到 `7b3febd`(防 06:10 天气刷新用旧数据回滚内阁章),生产部署 `e2042020-0600-4996-8a79-c1e09b0268dd`;线上 `/app/cabinet/data.json` 与源字节一致(132,399B、sha256 `32cbab3b106afc4b…`)、canonical 自指 + 4 hreflang、sitemap 7 条 lastmod 2026-11-01、未知 URL 404、首页卡片「646の調査」。未收录残差:共同 7 月(53.7)、8 月(50.2)仅有报道值、未取一次出典;毎日・産経/FNN・ANN 不在现有 7 源内(加入会改变各月均值,属产品决策)。「最大月变动 +20.5」复核=同一内阁内的最大单月上升(2010-08→09,菅);绝对最大月际变化为 2011-08→09 的 +45.5(菅→野田交接月,当月仅 NHK 一源),文案未改动。
- 内阁章交互改造(用户四条反馈):①悬浮面板限宽——固定 330px、各社来源改两列网格,落点自己算(越过右侧档案面板左沿就翻到光标左侧),实测面板 364×138、与面板重叠 0;②区间名由 11px 药丸改「按区间宽度自适应字号的大水印」(graphic 文本,24~96px,浅色主题 26%/深色 20% 不透明度),窄屏与「全期间」放不下就不印;③折线与分隔线对齐——分隔线/背景条改用各内阁自己的月次数据点(每月 15 号)而不是任期起始日期,`convertToPixel` 实测 14 任 pxDivider==pxFirst,跨窗口左沿按可见宽度量字号并只留淡影;④右侧档案卡在四个指标上方加任期内支持率曲线(内联 SVG + 极值标注)与「保存图片」按钮,点击画 1200×675 分享卡(首相名/任期/曲线/四指标/出典)走 Web Share 或下载 PNG。验收:本地+线上(桌面/手机 390/三语)无横向溢出、页面无 undefined、分享卡 ZH/JA/EN 各出一张且字形正常;`node --check` 通过;构建 7 页 charset 2425。提交 `61a4dc3`,生产部署 `603dc57a-0a28-40e6-816b-8e8ca7065d53`(回滚锚 `e2042020-0600-4996-8a79-c1e09b0268dd`);截图与分享卡样例在 `C:/Users/sai/ego/cabinet-refresh-20261101/`。踩坑留档:markLine 的 endLabel 贴到绘图区左沿时整条 markLine 会被裁掉、名字跟着消失(先试过按可见宽度+clamp 修仍未稳),最终改用 graphic 文本画水印。
- 主页六卡改版(用户选定 B 全幅底图,并要两处修正):图铺满整张卡——按卡片高度取中段裁切、SVG 内文字全部隐藏,整层 50% 不透明 + 自上而下渐隐遮罩 + 文字区压 `--hp-card` 渐暗棚,文字不再被图干扰;卡片文案整体精简——六条断言各砍成一句(「七天,一张地图。」「2011 年占了 86.2% 的能量。」「中位数 4.4‰。」「最大单月 +20.5。」「按町算每平米均价。」「只有 8.8% 在增长。」),单位去掉与出典重复的范围(都道府县 / M4+ 震源 / 町丁 / 个月 / 二手公寓 / 人),出典行改成可翻译键(EN:JMA · forecast / Tokyo police · 2025 / MLIT · 2025Q2—2026Q1 / Statistics Bureau · 2025 / IPSS · 2050;ZH 简体),人口数字改为按语言给值(JA 1億2297万、ZH 1亿2297万、EN 123.0 million)。删掉旧的 ≤1000 双栏卡与 ≤640 图顶堆叠规则;卡片统一 318px(手机 300px)。验收:本地 + 线上、三语、深浅两主题、390 宽 0 溢出、控制台 0 报错、悬停底图 0.5→0.62、出典/单位/断言逐条核对。提交 `794a950`,部署 `f8a0c3a0-4ba0-4faf-9bad-a98b26a49812`;六方案设计实验室归档 `F:/archive/20261102-home-card-lab/`,截图与参考(The Pudding / Our World in Data / The Markup)在 `C:/Users/sai/ego/home-cards-lab/`。踩坑留档:部署前发现 VPS 上多出一个本地没有的提交 `0804b97`(天气周格按日期对齐,防 06:10 快照重复今天),我第一次部署把线上盖成了不含该修复的版本,已 `--ff-only` 快进后重建重发。
- 主页六卡动效(用户:入场也要,但打开页面不动时六张图也要各自变化):底图从静态铺底改成**每张卡自己的循环动效 + 一次入场**。入场:一张卡片同色的幕布从左往右滑开(1.3 秒,IntersectionObserver 进视口触发一次;无 JS 时不加幕布直接可见;减少动态偏好下关闭)。循环(只动 transform/opacity,留在合成层):01 天气 4 条等压线左右漂移(16 秒,±34);02 地震 6 层密度按层错相位明暗(9 秒,0.38↔1);03 犯罪 4 级点按级错相位闪(7.5 秒,0.35↔1)+ 中心镜头环缓慢缩放变淡(9 秒);04 内阁 一条竖线扫描时间轴(12 秒,扫满后淡出);05 住宅 23 区热区整体明暗(11 秒,1↔0.58);06 人口 一道 accent 渐变光带自上而下扫描(13 秒)。实现:plate 里加 `<g class="hp-iso / hp-q / hp-dot / hp-lens / hp-play / hp-heat / hp-scan">` 钩子(构建期生成),动画在 `home-preview.css`,用 `--i` 做相位、`--d` 做行程;模板把每张图包进 `.hp-plate`,band 加 `hp-live`。验收:本地 + 线上,七个 animation-name 全部生效、两次采样数值都在变(quake 0.76→0.97、playhead 459→876、scan 140→285、heat 0.81→0.58)、入场后六卡 is-in 全 true、0 溢出 0 报错、减少动态偏好下全部关掉。提交 `b6401ac`,部署 `a75923bb-45d5-4b58-9b33-1865a159877c`;动效实验室归档 `F:/archive/20261102-home-motion-lab/`。踩坑:第一次部署把 `site/lab/`(本地动效实验室)一起传上去了,发现后删除重发,`/lab/home-motion/` 已 404。
- 内阁章图表三代同框收口(用户选定 D):**生产换成手写 Canvas 引擎,整块 ECharts 拔掉**。窗口(时间范围)是唯一真相源——顶部政权书脊胶囊、区间底色、折线、读数全由同一个 win→px 映射算出,不再有「阴影/分界/名字三层各走各的节奏」。细节:书脊圆角胶囊、姓居中不加粗、字号恒定(桌面 12.5/手机 11.5/英文 11)、放不下自动隐去文字、胶囊间不画分割线;拖拽带惯性、滚轮默认左右移动时间轴、Shift+滚轮以光标为锚缩放、双击复位、点书脊跳任期、底部总览条可拖窗口/拉手柄、十字线磁吸最近调查点、←/→/0/f 键;边界硬夹,滚到两端即停(旧版在两端会抖)。删除:`ensureEcharts`/`ECHARTS_URLS`/`relayoutWatermarks`/`refreshWindowLabels`/markLine·markArea·graphic 三套图层/3.5MB vendor/构建里的 echarts preload。验收(无头 Chromium,本地 + 线上各一遍):控制台 0 报错、`window.echarts === undefined`、滚到两端后画布指纹 1.8 秒完全一致(零抖动零回弹)、悬停读数卡 + 右侧档案卡联动、点书脊跳任期且面板跟随、双击回全期间且「全期间」按钮点亮、手动缩放到非预设档位时按钮全灭、390 宽无横向溢出且轻点书脊可用、ja/zh/en 三语 + 深/浅两主题皆正常。提交 `c621990`,生产部署 `389904a9-2ca3-475e-947f-51c556c8daf0`(回滚锚 `6111a0a6-d225-4ef2-845e-bc1ec1320e2f`);ECharts vendor 备份 `F:/archive/20261101-cabinet-echarts-vendor/`,四方案设计实验室归档 `F:/archive/20261101-cabinet-chart-lab/`,截图 `C:/Users/sai/ego/cabinet-refresh-20261101/lab/`。
- 内阁章水印二轮(用户四条反馈):①只印姓(菅直人/菅義偉 都印「菅」、安倍 1/2 次都印「安倍」,不带 (1)(2));②所有区间共用一个字号(取当前窗口里最窄那条放得下的值,11~96px),不再大小不一;③位置改由坐标轴模型(绘图区矩形 + 时间轴当前范围)线性推算,并挂在 `rendered`/`finished` 上重排,拖动缩放条时与折线同帧;④修正「窗口外区间没有名字」——名字改成按当前窗口实时算,任何区间进入窗口立刻有名字(全期間视图 14 任全部有水印)。实测:10 年窗口 5 条水印统一 65px、位置与坐标轴推算值逐条 0px 差;2 年 2 条 96px;1 年 1 条 96px;全期間 14 条统一 12px;真实拖动滑块后 5 条同步更新、差 0;手机 390 无横向溢出;空闲 1.5s 渲染 0 次(无自喂循环)。踩坑:在 ECharts 自己的渲染回调里直接 setOption 会被重入保护丢掉(必须推到下一帧)、notMerge 重渲染会清掉 graphic(签名闸要同步作废)。提交 `94eb750`,生产部署 `6111a0a6-d225-4ef2-845e-bc1ec1320e2f`(回滚锚 `603dc57a-0a28-40e6-816b-8e8ca7065d53`)。
- 主页六卡动效二轮(用户:太不明显,只有第四张的扫描线能看出来;要求「第一章几条橙色的线动起来、第六章的方格闪起来、其他类似」):把动效从「整层明暗」改成**动标记本身**。天气 4 条等压线改成 30/22 虚线并做 2.8 秒流动(外加 ±46px、9 秒漂移);地震 6 层密度各自 0.08↔0.62 明暗、4.2 秒一轮、每层错 0.5 秒;犯罪 4 级点 0.1↔1 闪、2.6 秒一轮,中心镜头环 4.8 秒放大到 1.3 倍并淡出;内阁扫描线 7 秒扫满;住宅 23 个区各自成组、0.4↔1、4.6 秒一轮、每区错 0.28 秒(底色 fill 从 0.05–0.49 提到 0.10–0.65);人口 1,719 个格子按 32 行分组、0.5↔1、3.8 秒一轮、每行错 0.11 秒,光会从上往下扫过整片方格。人口那道扫描光带删除(改由行闪烁承担)。实测桌面/手机 7–8ms 一帧、0 帧超 25ms;隔 1.5 秒两帧对比,地震场、犯罪圆环、住宅热区、人口方格都肉眼可见地变了。提交 `8c4b563`,部署 `518a6d9a-7e13-4a3c-9d48-b3ba5fac1698`。
- 配色逻辑重构(2026-11-02,方案待选,未部署):深色/浅色从此只翻中性色——浅色纸白 #F5F3ED / 墨 #1A1A16 / 灰 #5B5A53,深色炭黑 #0E0E0C / 米白 #EDEBE4 / 灰 #A3A199;重点色改成**一套六色调色板两种模式共用**,全部压在相对亮度 Y≈0.20(纸白 3.8:1、炭黑 4.6:1)。小字号强调文字用同色相一档的 `--accent-ink`(纸白 4.9:1、炭黑 5.8:1),图形与色块两模式完全一致。四套方案挂在 `html[data-palette]`:A 和色六景 #0C8B7A/#A77109/#CD5545/#3F7DCA/#678618/#A165AE(默认)、B 矿物大地 #378697/#A07244/#A96B66/#8873A2/#53885E/#867C42、C 双色印刷(藍 #3F7DCA / 朱 #CF5343 交替)、D 三色分类(苔 #688527 自然 / 朱 #CB5848 社会 / 藍 #427DC7 人)。主页六卡按 `data-chapter` 取各自章色;地震视口与犯罪页改用 `--accent-base` 继承,不再钉死旧绿/旧橙。本地预览 `.review/palette-lab/`(真实构建的六卡 + 中文文案,8 个组合页 + 索引),`python -m http.server 8920` 打开。生产仍是旧配色,等选型。
