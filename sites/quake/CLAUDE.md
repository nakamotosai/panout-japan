# japan-3d-earthquake · 项目指令

> 本地真相源：`F:\earthquake`  
> 全局规则见 `~/.claude/CLAUDE.md`。本文件只写本仓约定。

## 这是什么

日本周边 **3D 震源** 可视化站：Vite + three.js + 自研 `globeNav`（谷歌地球式）。  
历史公开数据（USGS）+ Natural Earth 海岸线镂空。**非预报 / 非官方。**

## UI

- 视觉真源：根目录 `DESIGN.md`（冲突时以它为准）
- 主题：`gruvbox` | `eva`（无浅色）；深度色板随主题换，`localStorage eq-theme`
- 改页面样式：先 Read `DESIGN.md`，再 `frontend-design` / 直接改 `src/`
- 一次性无关 demo：`saiweb-flow`（不替代本仓 DESIGN）

## 目录

```
F:\earthquake\
├── DESIGN.md          # 视觉真源
├── CLAUDE.md          # 本文件
├── README.md          # 人读入口
├── docs/              # 架构 / 数据 / 路线
├── public/data/       # 预抓取 JSON（运行时静态）
├── scripts/           # fetch-data / fetch-outline
└── src/               # 场景与 UI
```

## 开发

```powershell
cd F:\earthquake
npm install
npm run dev          # http://127.0.0.1:5173
npm run build
npm run fetch-data   # USGS → public/data/quakes.json
npm run fetch-outline
```

## 验收（机器 · M4）

| 用途 | 命令 | 过线 |
|---|---|---|
| 开发 | `npm run dev` | vite 起 |
| **验收** | `npm run build` | exit 0 |
| 预览 | `npm run preview` | 可打开 |

无 unit test：`npm run build` = 本仓机器验收。改 `src/` / 构建配置后应收工自跑 build。  
Stop 硬闸默认不启用（模板：`F:\知识库\evals\templates\project-verify.md`）。

## Git

- 本地：`F:\earthquake`
- `origin` → Gitea 私有（vps-jp:2222）`sai/japan-3d-earthquake`
- `github` → GitHub 私有 `nakamotosai/japan-3d-earthquake`
- 推送：`git push origin main && git push github main`
- 禁 force push；密钥不进仓

## 硬约束

1. 网格 / 海岸线贴 **Y=0 海平面**；震源在负 Y
2. 轨道中心跟 **震源云框**，勿只钉陆地原点
3. 自转要慢；拖完停 5s 再恢复（见 `src/main.js`）
4. 不接 Hi-net 再分发数据；不接 Mapbox token
5. 页脚署名 + 非预报声明不可删

## 旧路径

`C:\Users\sai\claude\japan-3d-eq` 仅跳转说明，**不要**在那里继续开发。
