# Pan Out Japan 全家统一 token（冻 · 2026-10-12）

> 源：犯罪率站 tactical 深色（`sites/crime/site/index.html:205-258`）。
> 全家四页（门面 `site/` + quake/crime/cabinet）一律 tactical 深色为默认；editorial 纸白保留为可切换 variant，不做默认。
> 用户令：四个页面全部和犯罪率站完全统一风格。

## 色板

| token | 值 | 说明 |
|---|---|---|
| `--bg-page` | `#141210` | 暖炭黑页面底 |
| `--bg-map` | `#0d0c0b` | 地图/画布底 |
| `--bg-card` | `rgba(27,25,23,.62)` | 卡片 |
| `--bg-card-sub` | `rgba(53,47,42,.42)` | 次级卡 |
| `--bg-hover` | `rgba(255,244,232,.08)` | 悬停 |
| `--text-main` | `#f5f0e8` | 主文字 |
| `--text-muted` | `#a89d8d` | 次文字 |
| `--text-faint` | `#6f675b` | 微文字 |
| `--line-main` | `rgba(255,244,232,.1)` | 分隔线 |
| `--accent` | `#d0801a` | 暖琥珀（默认 accent=amber） |
| `--accent-soft` | `rgba(208,128,26,.16)` | accent 淡底 |
| `--card-glass` | `blur(26px) saturate(1.5)` | 卡片毛玻璃 |

## 字体

- 西文眉标/数据：JetBrains Mono 11px uppercase tracking .12em（ouuut 家族眉标）
- CJK 标题：Noto Serif SC/JP 700（自托管子集，禁整包）
- 西文标题：Instrument Serif（门面；数据站内可用系统栈兜底）
- 正文：系统栈 / Geist（门面）

## 共享 chrome（四页一致）

- 顶栏：常驻，站名 + 四站切换 + 三语切换器（`?lang=` > localStorage > navigator > 默认 ja）
- 页脚：© + 数据来源与许可（USGS / 警视庁 / NHK）+ 回门面链
- 卡片：tactical 卡片（glass + accent-soft 框），禁纸白漂白图表
- H1 每页唯一；对比度正文 ≥4.5:1；触摸目标 ≥44px；`prefers-reduced-motion` 生效

## 铁律

- 禁改口径：犯罪率 9 级 YlOrRd 绝对标尺不断点；支持率 632 点月平均不重算；地震深度色条蓝→红 `#076678…#9d0006` 不动。
- CDN 依赖收敛：Leaflet/ECharts/字体能自托管就自托管，至少加 fallback；M0 门面零 CDNs（除字体自托管）。
- 老站现行域（3d/crime/japan.saaaai.com）保持可回滚，改只改仓内 `sites/`。
