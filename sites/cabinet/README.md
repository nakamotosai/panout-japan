# cabinet-approval

日本内閣支持率 2000→ 全量可视化。「多源按月平均」：每月取当月所有已搜媒体线真实调查值的算术平均（N 家=N 家平均，上限 9 家），目标每月不断线。当前源集=NHK 放送文化研究所 2000-2017 + NHK 選挙WEB 2018-2026 + 日経/朝日/時事/読売/JNN 各社月次。

## 状态

**active · 已上线** → https://japan.saaaai.com/

## 当前进度

- 上线：CF Pages 项目 `cabinet`，部署目录 `dist/`（index.html + data.json），子域名 `japan.saaaai.com`（2026-08-09 由 `cab.saaaai.com` 重绑）
- **独立 reviewer 验收通过（2026-08-09，仅 v6 基准）**：HTTP 200、data.json 62895B 与本地字节一致、14 系列×316 点、首末点正确、双主题切换无 JS 错误、官方缺月（2011-03/2019-10/2025-10）确认不插值
- v7 变更（2026-08-09）：+3 時事缺月点（319 点/63576B）+ slider 手柄改实心圆角——轻任务档机械自证（headless 实测渲染通过），未独立 review
- 功能：10y 默认窗、首相任期聚焦（平移不缩放）、显式「✕ 全部表示」退出、删除前缀、四主题、统一 8px 圆角设计语言
- 数据：v8.1 多源按月平均 632 点（`data.json` 175856B），`_meta.version=8.1-multi-source-monthly-avg`，2000-01~2026-09 每月皆有数据（零断月）；2026-08=4 社平均 54.9%（日経 62/時事 48.4/NHK 53.0/読売 56）、2026-09=2 社平均 57.8%（JNN 62.5/NHK 53.0）；高市内阁延续中（takaichi.end=2030-12-31）
- 缺月策略（2026-08-09 拍板）：**多源按月平均**——缺月用其他媒体真实值补点，目标每月不断线；换相月按调查日分辨老/新首相（前端分桶逻辑）
- v8.1 上线已确认（2026-09-16）：dist 已部署 japan.saaaai.com，线上复核 data.json 175856B/v8.1/尾点 2026-09-11 NHK 53.0、桌面+移动端真机渲染通过（14 系列、尾点 54.9/57.8、横向溢出 0、legend 168px/14 pill、聚焦退出正常）

## 直达详情

- 生产根：`F:/projects/cabinet-approval/`（真相源，含 dist/；`C:/Users/sai/omp/cabinet-approval` 为旧副本别用，`F:/cabinet-approval` 不存在）
- 数据生成注意：`gen_data.py` 只复刻 v7（禁直接重跑，会打回 319 点）；`merge_polls.py` 内 PROJECT 路径仍是旧 `F:/cabinet-approval`，跑前必改
- 数据生成：`gen_data.py`
- 可视化单文件：`index.html`
- 双仓：无（单机文件 + CF Pages，无 git 远端）