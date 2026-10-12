---
name: japan-3d-earthquake
description: 日本 3D 震源可视化 — Gruvbox / EVA 双深色主题
updated: 2026-07-15
---

# DESIGN.md · japan-3d-earthquake

> 视觉真源。改 UI / 色 / 图例前先读本文；冲突时以本文为准。

## Overview

全屏 **真地球球** 3D 震源场景 + **左上菜单折叠工具** + **左侧中部无框缩放** + **底栏**。  
气质：仪器台 / 可选 **EVA 监看台**。主题仅 **Gruvbox 深色** 与 **EVA**，**无浅色**。

**Signature**
- 默认 Gruvbox 深色；可切 EVA（黑·绿·紫·深红）
- 深度色随主题换板（见下）
- **完整地球球壳** + 经纬网；岸线镂空贴球面（日本粗、全球细）；**不钳平移**
- 默认视角钉日本；深度沿半径往球心

## Colors（`data-theme=gruvbox|eva`）

| Token | Gruvbox | EVA | 用途 |
|---|---|---|---|
| `--bg0` | `#282828` | `#050508` | 页面 / 场景底 |
| `--bg1` / `--bg2` | 暖灰 | 黑紫 | 面板 / 边框 |
| `--fg` / `--fg1` | 米黄 | 绿白 / 亮绿 | 主/次文字 |
| `--orange` | `#fe8019` | `#9d4edd` 紫 | 控件强调 |
| `--aqua` | `#8ec07c` | `#39ff14` | 链接 |
| `--red` | `#fb4934` | `#ff1744` | 警告 |

**Depth（`depthColor.js`）**
- **gruvbox**：蓝 → 黄 → 橙 → 红
- **eva**：亮绿 → 初号机紫 → 警报深红  
曲线：`(depth/400)^0.65`；彩条 CSS `--eq-legend-grad` 同步

禁止：再加浅色主题；禁止 spectral 乱虹。

## Typography

- 系统栈：`system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
- 面板标题 ~14px 半粗；正文 12px；meta 11px
- 数字用 tabular（震级 / 夸张倍数）
- 本阶段 **不** 引入 Web 字体包

## Layout

| 区 | 规则 |
|---|---|
| Canvas | 全视口，`#app` 100% |
| 顶中模式 | `.eq-mode-bar`：三钮「历史」「30天」「名震」（同 top、同宽高 token 扁钮拼组）；默认历史；30天=USGS + 与历史同径 + 涟漪；名震=精选列表抽屉 + 飞近 + 详述面板；模式钮下无状态浮层 |
| 左上工具 | `.eq-left-dock`：宽屏**默认展开** 6 扁钮；**1 分钟**无按菜单才收；窄屏（≤640px）默认收起 |
| 左侧中 | `.eq-zoom-dock`：垂直居中无框竖滑条；**手机默认藏**，触屏/动图后滑入，闲置约 2.8s 再藏 |
| 弹层 | 展开菜单后点震级/年份/深度 → `.eq-pop` 下弹竖滑条 |
| 最底栏 | 左：复位+播放/暂停+旋转条（手机缩短）；右：操作提示（拖地图后渐显 3s）在署名前 + 彩条 |
| 色条 | 右下双端拖点；选中段铺满深度上色 |

### 左栏等宽铁律（前端基准）

> **钮一律同宽半高**（宽 `--eq-dock-w`、高 `--eq-dock-h = w/2`）。顶中模式 / 左菜单同一套扁钮，**不再用正方形**。横排拓宽也用同一宽，禁止另写像素宽高。

| Token / 类 | 规则 |
|---|---|
| `--eq-dock-w` | 钮宽（默认 `52px`） |
| `--eq-dock-h` | 钮高（默认 `w/2`，约 `26px`） |
| `--eq-dock-gap` | 钮间距（默认 `8px`） |
| `--eq-dock-radius` | 圆角统一（默认 `6px`） |
| `.eq-sq` | 宽 = `--eq-dock-w`，高 = `--eq-dock-h`（含顶中模式钮） |
| `.eq-sq-row` | 横排 flex；复位右侧继续加钮 |
| `.eq-zoom` | 外壳宽 = `--eq-dock-w`，在钮行下方左对齐 |
| `.eq-pop` | 工具钮下方弹层；竖 `range` 或年份双竖条 |

筛选约定：震级默认 M≥4（4–7）；年份默认 **2000–今年**（双滑条可拖回 1970，服务器仍有全量）；深度夸张默认 ×2（1–3）。历史点按**可见区瓦片**加载，不进站下全地球。

### 底栏分区

| 侧 | 内容 | 类 |
|---|---|---|
| 左 | 水平「旋转」滑条 + 角度读数 | `.eq-rotate-bar` |
| 右 | USGS / Natural Earth 署名 | `.eq-footer` |

二者同在 `.eq-bottom`，一左一右；旋转条 `pointer-events: auto`，署名区默认穿透、仅链接可点。

移动端：面板可叠画布；底栏可纵向堆叠（窄屏时 `flex-wrap`），但仍禁止与署名绝对定位叠死。

## Elevation / Motion

- 面板：轻阴影 `0 8 24 rgba(0,0,0,.45)`，无大模糊毛玻璃
- 相机：`globeNav` 谷歌地球式；自转默认 **慢**（~0.12，绕当地天顶）
- 交互：拖/滚轮立刻停自转；松手 **5s** 后若仍开启自转偏好则恢复

## Interaction（相机手感）

| 操作 | 行为 | 备注 |
|---|---|---|
| 左键拖 | 抓住地表拖（点跟手） | `src/globeNav.js`：射线∩球，四元数绕地心 |
| **Ctrl / Alt / Meta / Shift + 左键** | 绕焦点转方位+俯仰 | 相对当地天顶限极角 |
| 右键 / 中键拖 | 同上旋转 | `contextmenu` preventDefault |
| 滚轮 / 左栏竖条 | 缩放 | 滚轮尽量钉光标下地表 |
| 底左「旋转」条 | 改方位角 0–360° | 绕当地天顶，非世界 Y |
| 主题 | 左上「EVA/Gruv」切换 | 仅 gruvbox ↔ eva；无浅色 |
| 历史/30天/名震 | 顶中三扁钮（对齐左栏） | 30天：禁用年份、可见震源全涟漪(上限200)、5min 轮询；名震：抽屉+飞近停转+详述+维基 |
| 点径 | 左上菜单「震级/等大」切换 | **震级**：大小差拉开（M4 小 · M7+ 很大）；**等大**：统一半径看断层带；记 `localStorage eq-size-mode` |
| 底栏复位 | 播放钮左侧 | 回 `HOME_VIEW` |
| 底栏播放/暂停 | 跟 `controls.autoRotate` 真值 | 转=暂停；拖动临时停也显示播放 |
| 震级 / 年份 / 深度 | 左上扁钮 → 下弹竖滑条 | 年份为起/止双竖条 |

轴心说明：左键**没有**漂在空中的神秘 pivot——抓住的是光标下那块「地皮」，地皮跟手走（谷歌地球同款）。

## Components（当前 = 原生 DOM，非 shadcn）

| 组件 | 约定 |
|---|---|
| `.eq-left-dock` | 左上工具区（横排 + 缩放） |
| `.eq-sq-row` | 横排扁钮 |
| `.eq-sq` | 同宽半高工具钮 |
| `.eq-tool` / `.eq-pop` | 带下拉弹层的工具 |
| `.eq-zoom` | 竖向缩放轨外壳 |
| `.eq-bottom` | 最底通栏：左旋转 / 右署名 |
| `.eq-rotate-bar` | 水平旋转滑条 |
| `.eq-panel` | 右上色条筛选 + 白话提示；手机隐藏 |
| `.eq-depth-range` | 彩条双端圆点；拖 = 把选中色段铺满整段深度上色（不滤点） |
| `.eq-hint` | `左键抓住地表拖 · 右键转视角 · 滚轮缩放` |
| `.eq-footer` | 底右署名 |
| 3D 点 | InstancedMesh 球；色=深度，径=震级 |
| 海岸线 | Line2；Natural Earth **10m 岸线** + 50m 国界；日本粗 / 全球细；gruvbox 米白 / eva 亮绿 |
| 网格 | GridHelper 在 Y=0；色随主题（eva 紫系） |

若未来上 React/shadcn：  
`--background`←bg0 · `--foreground`←fg · `--primary`←orange · `--muted`←gray · `--destructive`←red · radius 4–6px。

## Scene conventions

- 坐标：**真地球**（`EARTH_RADIUS_KM = 6371`）；Y 上；lon0/lat0 → +Z；`project(lon,lat,depth)`
- 深度：沿半径 `r = R - depthKm * exaggeration`（默认夸张 2）
- 导航：`globeNav` 抓地表平移 + 当地天顶；**不钳 REGION**（REGION 只约束 USGS 历史/近30天抓取框）
- **复位**钉日本本州地表 + **正北朝上**（`HOME_VIEW` ≈ 138°E/37°N，`cameraPoseNorthUp` 倾角 ~28°、距 ~2200 km）
- 壳：**不透明 BackSide 深度墙**（挡背面）+ 淡正面 + 经纬网；岸线略浮于壳外
- 岸线：`OutlineLayer` 按 20° 瓦片；**只建前半球 GPU 线**（背面不加载到显存）

## Do's and Don'ts

**Do**
- 先改 CSS token / `depthColor.js` 色板，再改散落 hex
- gruvbox 深度蓝→黄→红；eva 绿→紫→深红；主题切换要重画点云
- 页脚只保留 USGS 震源 + Natural Earth 海岸线署名
- 数据脚本输出进 `public/data/`，运行时不直连 API（MVP）

**Don't**
- 不要再加浅色主题
- 不要 AI 默认深蓝背景 / 电光蓝点云（eva 的亮绿是有意的）
- 不要把网格中心的 Y 设成震源云中心（会悬空）
- 不要引入 Mapbox token 或锁定俯视
- 不要重分发 NIED Hi-net 等禁止再分发数据
- 不要在仓内放密钥 / 完整原始抓取日志

## Handoff

- 改视觉身份 → 先改本文，再改 `src/style.css` / `depthColor.js` / `japanOutline.js`
- 写新 UI 控件 → 读本文 + `frontend-design`（若上组件库再 `ui-styling`）
- 定调大变 → `ui-ux-pro-max` 后再回写本文
