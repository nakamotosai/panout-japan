# 数据 · japan-3d-earthquake

## 历史震源（全球瓦片）

| 项 | 值 |
|---|---|
| 来源 | [USGS FDSN Event API](https://earthquake.usgs.gov/fdsnws/event/1/)（免费公开） |
| 脚本 | `npm run fetch-data` → `scripts/fetch-data.mjs` |
| 规格 | **全球** · **M ≥ 4.0** · **1970-01-01 → 抓取日** |
| 布局 | `public/data/quakes/manifest.json` + `tiles/r_*.json`（≥2000）+ `tiles/a_*.json`（1970–1999） |
| 瓦片 | 经纬 **20°**；空格不写文件 |
| 进站 | 日本 bootstrap；上屏默认 **≤7 万点**（地平线+焦点锥；近焦点优先） |
| 视野 | 地平线裁剪 + 焦点锥硬顶~26°（`viewCull`）；单次≤16 瓦片；离屏移出 GPU |
| 转场 | 焦点/高度变才溶解；自转同焦点零重画（数据可在内存+IDB） |
| 卡顿 | 真掉帧才降 `maxDisplay`（底线 2 万～上限 **10 万**；丝滑可自动回升） |
| 缓存 | 内存 + **IndexedDB**；同瓦片 URL 不重复打网（PWA 按需预留） |
| 年份 UI | 默认 **2000→今年**；滑到 1970 才请求 archive |
| 兼容 | `public/data/quakes.json` = 日本框 recent 小包 |

字段（单条）：

```json
{ "lon": 142.37, "lat": 38.3, "depthKm": 24, "mag": 9.1, "time": "...", "place": "..." }
```

### 更新

| 命令 | 含义 |
|---|---|
| `npm run fetch-data` / `--full` | 全量重建瓦片（耗时长） |
| `npm run fetch-data -- --since=YYYY-MM-DD` | 增量合并（周更） |
| GitHub Actions | `.github/workflows/quakes-weekly.yml`（挂 GitHub 后启用） |

manifest 含 `fetchedAt` / `coverageEnd`，页面与 CI 用它判断「数据截至哪天」。

> **死数据说明**：历史模式读静态瓦片，不会自动变新。上线后靠周更 Actions 或本地重跑脚本；**近 30 天模式**仍是浏览器直连 USGS，始终新。

## 海岸线 `public/data/japan-outline.json`

| 项 | 值 |
|---|---|
| 来源 | Natural Earth **岸线 10m** + **国界 50m**（公有领域） |
| 脚本 | `npm run fetch-outline` |
| 运行时 | CPU 索引一次；按顶点拆瓦片；GPU 仅**当前浏览器画面** + 格内裁背面（`OutlineLayer`） |

## 近 30 天模式

| 项 | 值 |
|---|---|
| 范围 | **全球** M≥4 · 30 天（浏览器直连，limit 20000） |
| 轮询 | 5 分钟 |
| 离线 | 已加载历史瓦片中滤近 30 天 |

## 名震模式

精选列表 `famousQuakes.js`；余震从**已加载瓦片**目录抽 7 日邻域，并强制补该场周边瓦片。

## 合规

| 可以 | 不可以 |
|---|---|
| USGS 历史公开目录可视化 | 当作预报 / 预警 |
| Natural Earth 轮廓 | 测绘导航精度 |

页脚保留数据源链接。
