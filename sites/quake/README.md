# japan-3d-earthquake · 日本 3D 震源

全屏 **真地球球** 看地震：**自由相机 / 慢速自转**，全球镂空岸线，震源按深度着色。  
历史目录为 **全球 USGS 瓦片**（默认只加载你看见的地方 + 日本；默认年份 2000→今，可筛回 1970）。  
默认视角钉日本。主题：**Gruvbox 深色** 与 **EVA（黑·绿·紫·红）** 可切换。  
灵感：[nagix/japan-eq-locator](https://github.com/nagix/japan-eq-locator)（深度点）+ 本仓 free-orbit 地球。

> **不是**地震预报或预警。数据为历史公开目录可视化。

## 在线

- **https://3d.saaaai.com/**（Cloudflare Pages）
- 备用：https://japan-3d-earthquake.pages.dev/

## 本地跑

```powershell
cd F:\earthquake
npm install
npm run dev
# 浏览器 http://127.0.0.1:5173
```

更新数据（可选）：

```powershell
npm run fetch-data      # USGS 全球 M≥4 · 1970→今 → public/data/quakes/ 瓦片（久）
npm run fetch-data -- --since=2026-07-01   # 增量（周更）
npm run fetch-outline   # Natural Earth 10m 岸线 + 50m 国境
npm run build           # 产出 dist/
```

周更预留：`.github/workflows/quakes-weekly.yml`（仓库上 GitHub 后启用 Actions）。

## 操作

| 操作 | 行为 |
|---|---|
| 左键拖 | **抓住地表拖**（谷歌地球式，光标下的点跟手走） |
| **Ctrl+左键** / 右键 / 中键 | 绕焦点转方位 + 俯仰 |
| 底左「旋转」条 | 绕当地天顶水平转 |
| 滚轮 / 左侧竖条 | 缩放（滚轮尽量钉住光标下地表） |
| 底左复位 | 回到初始视角 |
| 底左播放/暂停 | 自动旋转；图标跟真实是否在转一致（拖动时也会变播放） |
| 菜单「震级/等大」 | 点大小：按震级（差拉开）或全部等大（看断层） |
| 菜单「EVA / Gruv」 | 主题：Gruvbox ↔ 福音战士（界面+背景+深度色条一起换） |
| 顶中扁钮「历史」「30天」「名震」 | 历史=静态长目录；30天=USGS 刷新 + 与历史同径 + 平面涟漪；名震=精选著名地震抽屉，点选飞近/停转/涟漪/维基详述 |
| 鼠标悬停震源球 | 旁侧信息卡：震级 / 地点 / 深度 / 时间 / 经纬；移开即隐；**30天/名震**悬停停自转，**历史模式不停**（球太多） |

## 技术栈

| 项 | 选择 |
|---|---|
| 构建 | Vite |
| 渲染 | three.js + 自研 `globeNav`（谷歌地球式抓地表） |
| 动画 | gsap（近30天 / 名震 平面涟漪） |
| 数据 | USGS FDSN（预抓 JSON + 近30天浏览器拉取）+ 名震精选 `famousQuakes.js` |
| 轮廓 | Natural Earth 岸线 10m + 国界 50m |
| 视觉 | Gruvbox + EVA（见 `DESIGN.md`） |

## 目录

```
F:\earthquake\
├── DESIGN.md           # 视觉真源
├── CLAUDE.md           # 给 AI/协作者的项目约定
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA.md
│   └── ROADMAP.md
├── public/data/        # quakes.json · japan-outline.json
├── scripts/            # 数据抓取
└── src/                # 场景与 UI
```

## 约定速记

- **真地球球** `R≈6371km`；岸线贴球面；震源沿半径往球心
- 不钳平移；拉远可见整球；复位钉日本斜俯视
- 深度色随主题：gruvbox 蓝→黄→红；eva 绿→紫→深红（`src/depthColor.js`）

## 数据与免责

- 地震：[USGS](https://earthquake.usgs.gov/) FDSN
- 海岸线：[Natural Earth](https://www.naturalearthdata.com/)（公有领域）
- 本项目 **仅** 历史公开数据可视化，**非** 预报 / 官方产品

## 仓库

- 本地真相源：`F:\earthquake`
- Gitea（私有）`origin` · GitHub（私有）`github`
- 旧草稿路径 `C:\Users\sai\claude\japan-3d-eq` 仅跳转，勿在那边改
