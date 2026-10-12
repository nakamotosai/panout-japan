# progress · cabinet-approval

## 2026-08-09 会话
- promote 长项目 + 首个子域名上线（CF Pages `cabinet` → `cab.saaaai.com`）
- 统一设计语言：底部 zoom 按钮组 + ECharts slider + 顶部首相 pills 全部 8px 圆角矩形、同面板色同边框色；slider height 24/bottom 18/borderRadius 8/handle 12/圆角 4；四主题 slider 色逐项对齐
- 此前（同日本会话）：v6 全量官方 NHK 月度 316 点；首相聚焦平移不缩放+退出按钮；标题 2000→ 文案修正；删「首相:」前缀；底部一行式布局
- 验证：DOM 断言圆角/颜色/height/bottom 全过；四主题色核验；全页截图像素采样面板色+accent handle；无 headless 残留；JS SYNTAX OK
- logo 做了 + UI 改版上线（CF Pages `cabinet` → japan.saaaai.com）：notebook-bars preset（暗底+奶油+橙三数据条 gruvbox 主题）→ favicon kit 装进 dist/（favicon.svg/ico/png32/apple-touch/png/logo.png 共 6 文件）；index.html 头注入 4 个 favicon link + Noto Serif JP 字体 link
- 标题 UI 改版（同步 a-console demo 到正式版）：h1 去掉 🇯🇵 emoji + 拆成长度最小「内閣支持率」单字衬线（var(--font-masthead) Noto Serif jp 22px 700）；旁加 `japan.saaaai.com` 网址链接（14px faint 色竖线分隔 baseline 对齐 diff≤2px）；subtitle 13→14px
- 全字号合规：theme-btn/theme-menu/legend-pill/zoom-button 原 11-13px 全改 14px（BLOCKER 同族≤13px 禁项已根治）；getBoundingClientRect violations=0
- 图表对称：grid/grid slider 原 left:64,right:32/380,12 → 全 64/64 左右对称；getOption 确认四边距全等
- 验证：eval fetch 线上 japan.saaaai.com 200 + hasMasthead/Favicon/NewTitle 全 true + 5 个 favicon 文件 HTTP 200 全返正确 byte；headless getComputedStyle h1=22px Noto Serif baselineDiff=2；series=14

## 2026-09-16 会话（v8.1 上线）
- 数据：+6 点（2026-08: 日経 62/時事 48.4/NHK 53.0/読売 56；2026-09: JNN 62.5/NHK 53.0），零插值；月平均 08=54.9%/09=57.8%；takaichi.end 修正为 2030-12-31；data.json 632 点/175856B/v8.1，2000-01~2026-09 零断月
- 移动端修复：legend-bar 放开到 168px 全显 14 个首相 pill（原 68px+overflow-y:hidden 会裁掉点不到）；窄屏 grid/slider 边距 64→44/12、body 两侧 padding 28→12px；markLine 标签窄屏 11px + hideOverlap 防重叠
- 部署：wrangler pages deploy 成功（https://d2620452.cabinet-d42.pages.dev），线上复核 data.json 字节一致、index markers 全中、桌面+手机真机渲染通过（14 系列、横向溢出 0、聚焦退出正常）
- 最新徽标（2026-09-16）：副标题右侧加「最新 2026年9月 57.8%（2社平均）」橙底徽标（accent 底+白字，JS 从当月 buckets 自动算平均，下月有新数据自动变，不手写）；窄屏纵排免压 markLine 标签；本地双验+部署 https://0ed9e371.cabinet-d42.pages.dev，线上真机确认徽标已出（fetch 看 HTML 会滞后，属 CF 缓存，以真机渲染为准）
- 9 月点被裁修复（2026-09-17）：根因 x 轴 max 取 raw 末点 2026-09-11，早于 9 月 bucket 点 2026-09-15，9 月被裁在轴外；改为 max(bucket 末月 15 号，raw 末点)+18 天垫边（当前 2026-10-03），本地双验+部署 https://905ec5c9.cabinet-d42.pages.dev，线上真机确认 9 月点可见；sitemap lastmod 顺手改到 2026-09-17 同轮带上