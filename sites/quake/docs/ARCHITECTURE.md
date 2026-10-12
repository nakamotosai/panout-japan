# 架构 · japan-3d-earthquake

## 一句话

浏览器里用 three.js 画「完整地球球 + 镂空岸线 + 地下震源球」，默认看向日本；历史数据仍为东亚 USGS 静态包（近30天同矩形）。

## 分层

```
index.html
  └── src/main.js          # 场景、相机、控件、HUD、加载
        ├── coords.js      # 真地球球 lon/lat/depth → xyz（km）
        ├── earth.js       # 球壳 + 经纬网
        ├── depthColor.js  # 深度 → gruvbox / eva 色板
        ├── globeNav.js    # 谷歌地球式抓地表导航
        ├── japanOutline.js# 岸线：CPU 瓦片索引 + 前半球才建 Line2
        ├── quakes.js      # InstancedMesh 震源（history / live 点径）
        ├── liveFeed.js    # 近30天 USGS FDSN 轮询 + 离线滤静态包
        ├── famousQuakes.js# 名震精选（坐标+导读+维基）
        ├── ripples.js     # 近30天/名震 平面涟漪（GSAP，唯一）
        └── style.css      # gruvbox + eva UI
public/data/
  ├── quakes/              # 全球历史瓦片 + manifest
  │   ├── manifest.json
  │   └── tiles/r_*.json · a_*.json
  ├── quakes.json          # 兼容：日本框 recent 小包
  └── japan-outline.json
scripts/
  ├── fetch-data.mjs       # 全球全量 / --since 增量
  └── fetch-japan-outline.mjs
.github/workflows/
  └── quakes-weekly.yml    # 周更预留（GitHub Actions）
```

## 为何 three.js 而不是 MapLibre / deck.gl

要 **钻到地下再绕回来**。地图库 pitch 上限和「地表以下」体验弱；Mapbox 还要 token。  
参考 nagix 的深度着色；相机用自研 `globeNav`（谷歌地球式抓地表 + 当地天顶）。

## 坐标

| 项 | 含义 |
|---|---|
| 形状 | 真地球球，`R = 6371` km（`coords.js`） |
| 轴向 | Y 上；赤道 lon=0 → +Z |
| 深度 | `r = R - depthKm * exaggeration`（往球心） |
| 岸线 | 贴球壳外少量海拔，Line2 镂空 |

## 相机

- 默认 / 复位：`cameraPoseNorthUp` 钉日本 + **正北朝上**
- 导航：`globeNav`（左键抓地表、右键转、滚轮缩放）；**不钳平移**
- 自转慢速（绕当地天顶）；用户交互 pause → 5s idle resume

## 可见性 / 加载（硬规则）

> **地球背面绝不常驻 GPU。** 半透明壳挡不住贴球外侧的线——必须深度遮挡 + 半球裁剪。

| 层 | 策略 |
|---|---|
| 球壳 `earth.js` | 深度墙 + 经纬网只画地平线以上段 |
| 岸线 `OutlineLayer` | 顶点拆瓦片；**地平线 + 焦点视锥** 内才建；自转不重建 |
| 全球历史震源 | 地平线 + 焦点锥（硬顶~26°）+ 单次≤12 瓦片；太空/开场只日本 bootstrap |
| 点场 GPU | sticky=wanted 可缩；远眺自动降 cap；自转同焦点零重刷 |

判定（Cesium 思路）：**地平线裁剪** + **焦点视锥随高度（有硬顶）**；禁整球 NDC 灌入。

## 数据流

```
USGS FDSN（全球 M≥4）
  ──scripts/fetch-data --full──►  public/data/quakes/tiles + manifest
  ── --since=YYYY-MM-DD ───────►  增量合并（周更 / Actions）

浏览器历史模式：
  进站：太空俯视 → 3s 落到日本；并行 bootstrap；点场按画面渗入
  拖地图停稳 → 当前浏览器画面内瓦片按需 fetch；离屏移出 GPU
  年份 <2000 → 再拉 archive 瓦片
  （不一次下全地球；不以 look-at 角半径硬塞）

近30天：浏览器直连 USGS 全球 · 5min 轮询
名震：精选 + 周边瓦片余震
```

历史模式运行时 **不** 直连 USGS 全目录；只读静态瓦片。近30天直连。

## 部署形态（本轮未做）

静态站：`npm run build` → `dist/` → 任意静态托管（CF Pages 等）。  
无后端、无登录、无 token。
