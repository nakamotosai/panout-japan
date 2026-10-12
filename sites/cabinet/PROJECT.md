# PROJECT · 内閣支持率可视化（cabinet-approval）

## 项目分型
- 数据 → 可视化 → 在线发布 的静态数据仪表盘
- 单文件 HTML + JSON 数据，无构建（直接 ECharts CDN）

## 生产根
`F:/projects/cabinet-approval/`（生产根，含 dist/ 部署目录；真相源，本地=线上唯一依据）

## 数据真源
- NHK 放送文化研究所「政治意識月例調査」2000-2017：`_crs/` nhk_bunken HTML 抓取
- NHK 選挙WEB 月次 2018-2026：官方 PDF（同意墙后手动核对值，`survey_end` 以报道日为准、开始日按金-日模式推断并在 note 标明）
- 日経/朝日/時事/読売/JNN 各社月次：v8 起并入，多源按月平均
- 生成器注意：`gen_data.py` 仍只复刻 v7（319 点）——直接重跑会把 `data.json` 从 v8.1（632 点）打回 v7，禁直接跑；`merge_polls.py` 内 `PROJECT` 路径仍写死旧 `F:/cabinet-approval`，跑前必先改成 `F:/projects/cabinet-approval`
- 当前线上：`data.json` v8.1（632 点，175856B），2000-01~2026-09 零断月

## 里程碑
1. [x] v6 全量官方 NHK 月度线（316 点，2000-01~2026-07）
2. [x] 四主题（gruvbox/paper/cream/mono）切换
3. [x] 底部 zoom 窗 + slider + 图例聚焦翻译
4. [x] 循环 UI：覆盤聚焦 → 平移不缩放、退出按钮、统一 8px 圆角设计
5. [x] 上线 CF Pages 子域名（japan.saaaai.com）
6. [x] 多媒体对比线——v8 起已并入平均（不再单列对比线）：日経/朝日/時事/読売/JNN 已进月平均
7. [x] 缺月补数据策略拍板（2026-08-09）：**多源按月平均**——某月搜到 N 家媒体即平均 N 家（上限 9 家），1 家显示单值；目标每月都有数据不断线；换相月按调查日分辨老首相/新首相支持率
8. [x] v8.1 上线（2026-09-16）：+6 点（2026-08×4、2026-09×2，零插值）+ 移动端 3 修（legend 168px/grid 44/12/markLine hideOverlap）+ meta 文案修正，已部署 japan.saaaai.com 并复核线上字节一致

## 非目标
- 不是实时/动态数据源（静态月次）
- 不预测（未来值不外推）
- 不断线：每月至少 1 个真实调查值（缺月用其他媒体线补，不用插值/编造）

## 风险
- 依赖 NHK 选挙WEB 契约墙抓 PDF（已下载缓存）
- ECharts CDN 挂掉时页面白板（无本地 fallback）→ 可考虑 vendor 本地化

## 命令
- 本地服务：`python -m http.server 8137`（PTY 必须、否则 cwd 被 bash 拦截）
- 打开：`cmd /c open_view.bat`
- 部署：`cd ./dist && npx wrangler@4 pages deploy . --project-name=cabinet --branch=main`（需 `CLOUDFLARE_API_TOKEN`=保险柜 saas/cloudflare_codex_admin_token，`CLOUDFLARE_ACCOUNT_ID`=同库 account_id；cloudflare_api_token 主 token 已失效，2nd token 能 whoami 但无 Pages 部署权限；`.wrangler/` 默认不上传——wrangler Pages 硬编码忽略表含根目录 `.wrangler`，已用上传文件数 10=非隐藏文件数 + 线上探针回 index.html（SPA fallback）双重证实，勿加 `--exclude-files`（该 flag 不存在）或 `.assetsignore`（仅 Workers 有效，Pages 直接无视））