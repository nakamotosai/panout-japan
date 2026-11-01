# japan.ouuut.com · 日本本土信息汇聚

`japan.ouuut.com` —— 抬头看天气，拉远看地震，凑近看犯罪，拉长看内阁，比着看住宅，数着看人口。同一片国土，六种尺度。

> 状态：**六章齐全，人口章已上生产**（2026-11-01）。`/population/` 用 2025 年国势调查（2026-09-29 公布）与社人研 2050 推计，1,719 市町村等面积方格 ↔ 人口加权树图，附年龄金字塔与 47 县表；首页第六块板已从新闻预告换成人口。构建 7 个内容页；新闻占位代码已删除。线上 `https://japan.ouuut.com/population/`（2026-11-01 01:44 JST 部署，`ea896d63`）；VPS 06:10 天更任务已同步到含人口章的版本。生产根 `F:/projects/panout-japan`，仓 `ouuut/panout-japan`。本地验收见 `C:/Users/sai/ego/population-qa/` 与 `HANDOFF.md`。
> 命名：**japan.ouuut.com**。域名即品牌，旧字标已退役。
> 封面:**六块数据板,三列两行**——天气 / 地震 / 犯罪 / 内阁 / 住宅 / 人口(2026-10-31)。六块全部是链接;第六块不再是「予告」预告板。六卡以下是 **C＋A** 收尾:先为「方法与出典」面板(六个真实章节来源、计算口径,原生展开/收起、无 JS 可读),后为单行大字「六种尺度看日本。」——只有「六种尺度」使用主题重点色,日/英也保留同一单行收尾。大字同一节内接作者落款:中本蔡 / NAKAMOTO SAI、三语简介,以及 ouuut.com(独立项目)、saaaai.com(主站)、邮件与 X。页脚精简为字标、CC BY 4.0、静态生成与日期。
> 顶栏字标每 12 秒一轮:`japan.ouuut.com` 逐字从左出现,完整后停约 3 秒再渐隐;随后按界面语言换成对应 LOGO——日文「六つの尺度で日本を見る」、中文「六种尺度看日本」、英文「Six scales of Japan」——同样显隐并停约 3 秒,再回域名。日/中字标与卡片「抬头看」同为 250 字重;纯 CSS,宽度固定不推挤右侧按钮,减少动态效果与无 JS 时固定显示域名。
> 线上：`https://japan.ouuut.com`（Cloudflare Pages `panout-site`，天气数据 commit `6d37d1b`，部署 `e16a2b8e`）。
> 本地预览：`http://127.0.0.1:8900/`（构建后 `cd site && python -m http.server 8900`）；旧 `/preview/` 自动跳到 `/`。
> 天气：`/weather/` 把気象庁（JMA）的 47 都道府县预报快照做成可交互地图；今日/明日 + 未来 7 天，未发布气温留空，预报值不冒充观测值。数据与运行时在 `src/weather/`，构建产物在 `/assets/weather/`。VPS 每天 **06:10 JST** 抓取 95 个 JMA 资源、校验 47 县、重建并部署；失败保留上一快照。Kuma id 54 与每小时 :45 的外部探针双重对账 `state.json` / 线上 `data.js`，06:40 JST 未成功即告警。运行手册见 `docs/WEATHER-REFRESH.md`。
> 住宅：`/housing/` 用国土交通省不动产情报图书馆（PDL 1.0）2025Q2–2026Q1 的成約明细，按官方最小定位单位「市区町村 + 町名（地区名）」汇总平均㎡単価：東京全域 1,237 个町上色（1,614 个町多边形，无成交的留白）。数据期间取官方已公布的最新滚动四个季度（2026-10 时为 2025Q2–2026Q1，即 2025 年 4 月–2026 年 3 月），页内工具条徽标、数据卡与 FAQ 均明示。界面与犯罪率章同一套模板（工具栏 / 右侧卡片 / 左下分布仪 / 竖向缩放条）；点选任一区域会平滑飞入该区域（区级 12 级、町级 14 级，手机各降一级）。不筛面积、不算中位数、不做 70㎡ 换算。首页第五块数据板同步上屏。
> 人口：`/population/` 用 2025 年国势调查（总务省统计局，2026-09-29 公布）的 1,719 市町村人口/世带/年龄/外国人，加社人研 2023 年 2050 推计。主视觉不是地图：1,719 个等面积方格按都道府县分组，切换成人口加权树图；91.2% 的市町村在减少，73.4% 的人住在减少的市町村。年龄金字塔 2025 vs 2050；47 县表；无 JS 可读。数据管线 `tools/build_population_data.py`，产物 `app/population/data/population.json`；5 年一更，无日更任务。

## 架构

**一仓一构建一部署**：`python src/build.py` 从 `src/` + `app/{quake,crime,cabinet,housing,population}/data` + `src/weather/` 生成整个 `site/`（**7 个内容页**），
`site/` 原样部署到 Cloudflare Pages。没有运行时拼页、没有 hash 路由、没有客户端数据渲染。

```
src/
  build.py      # 唯一构建入口：三语字典、页面模板、静态图表 SVG、CSV/i18n/sitemap/headers
  home_plates.py# 总入口六张构建期数据板（天气/地震/犯罪/内阁/住宅/人口）
  home-preview.css # 总入口六块同屏原型（/）
  weather/      # /weather/ 运行时：JMA 快照、47 都道府县地图、app.js、weather CSS
  svgkit.py     # Web Mercator、海岸线裁剪、SVG path
  fonts.py      # Outfit 800 + Noto Serif/Sans JP/SC 700/500 子集化 → site/assets/fonts (13 文件 ~2.3MB)
  fix_cabinet.py# 内阁数据修正（NHK 2008/09 列错位、同月双调查标注）
  fetch_fonts.py# 字体源下载
  patch_vendor.py # quake bundle 的品牌字符串补丁（域名/出典/重载文案）
  slim_quake_data.py # 海岸线 0.05° 简化 + 震点数值精度收敛（原文件备份 .cache/quake-orig）
app/
  quake/        # 3D 地球（WebGL）+ 瓦片数据，章节页全屏自动挂载
  crime/        # Leaflet 町丁目地图，同一全屏挂载机制
  cabinet/      # ECharts 支持率长轴，同一全屏挂载机制
  housing/      # 23 区房价 Leaflet 地图（canvas 多边形）+ 排行面板，同一全屏挂载机制
  population/   # 1,719 市町村方格/树图 + 年龄金字塔 + 47 县表（Canvas，无地图）
site/           # 构建产物，gitignore
```

页面只有 **7 个内容页**：`/`（总入口）、`/weather/`、`/quake/`、`/crime/`、`/cabinet/`、`/housing/`、`/population/`。
年份、区市町村、内阁任期不再生成独立详情页；数据保留在章节页表格与图表内。`/preview/` 只是旧链接的跳转别名。

### 当前改版预览

`/` 是总入口:六块数据板三列两行同屏,每块本身是一个板面。六块全部是 `<a>`,直接进入对应章节页;第六块是人口(1,719 市町村方格),不再是预告板。没有弹层、没有“先选中、再打开”的中间状态。六章各自是独立 URL:天气/人口为可滚动的编辑式长页,地震/犯罪/内阁/住宅为吸顶 header + 全屏应用;交互全部在页面内。SEO/GEO 以 title、description、JSON-LD 和静态表格/`sr-only` H1 保底;人口章有 47 县表与无 JS 可读的内容。它使用 `src/home_plates.py` + `src/home-preview.css`。

视觉系统与 `ouuut.com` 同源：sage/dark 两态自动主题（本地时间，手动可覆盖）、Outfit 800 字标、EN/JA/ZH 分流字阶、4px surface 块、零结构线条。

## 构建与发布

```bash
python src/build.py                        # 生成 site/（约 100s，含字体子集）
cd site && python -m http.server 8900      # 本地预览
npx wrangler pages deploy site --project-name=panout-site --branch=main
```

构建产出 `_headers` / `_redirects` / `sitemap.xml` / `robots.txt` / `llms.txt` / `data/*.csv`，
全部由构建生成，不手改 `site/`。

### 天气日更

生产在 `vps-jp` 用 systemd timer 每天 **06:10 JST** 执行：

```bash
bash tools/panout_weather_refresh.sh --dry-run      # 只抓取校验
bash tools/panout_weather_refresh.sh --no-deploy --no-commit
bash tools/panout_weather_refresh.sh --force        # 手动强制一次
```

流程为抓取 95 个 JMA 资源 → 校验 47 都道府县 → 写 `src/weather/data.js` → 全量构建 → Cloudflare Pages 部署 → 线上复核 → 双远端提交。失败保留旧快照；运行手册见 `docs/WEATHER-REFRESH.md`。

## 数据

| 章 | 口径 | 源 |
|---|---|---|
| 天气 | 47 都道府县；今天/明天 + 未来 7 天；预报值，不是观测值；每日 06:10 JST 刷新 | 気象庁（JMA）予報スナップショット |
| 地震 | 27 年（2000–2026.08），M4+，40,145 次；2011 年按次数 14.6% / 按能量 86.2% | USGS ComCat |
| 犯罪 | 2025 全年，5,234 町丁，中位 4.4‰，最高 1,332‰ | 警視庁 町丁目別犯罪統計 |
| 内阁 | 14 任 331 个月，646 次调查；最大单月变动 +20.5 | 各社世论调查汇总（NHK/日经/共同/时事/朝日/读卖/JNN） |
| 住宅 | 2025Q2–2026Q1，東京中古マンション成約 26,416 件；按市区町村 + 町名（地区名）汇总的平均㎡単価 | 国土交通省 不动产情报图书馆（PDL 1.0） |
| 人口 | 2025-10-01，1,719 市町村；人口/世带/年龄/外国人；2050 年为社人研中位推计；5 年一更 | 総務省統計局 令和7年国勢調査（e-Stat 第1-1/2-7/49-1表）＋ 国立社会保障・人口問題研究所 令和5年推計 |

修正记录见 `src/fix_cabinet.py` 与 `app/cabinet/data.json` 的 `_meta`。

## 文档

- `progress.md` —— 逐轮流水（只增不改）
- `F:/archive/20261025-ca-hybrid-panout/closing-options/` —— 已归档的六卡以下四方案历史对照台。用户选定 **C＋A**，正式实现见 `src/build.py` 与 `src/home-preview.css`；本地 `http://127.0.0.1:8900/` 为定稿首页。六章全部接入；人口章见 `/population/`，新闻占位已删除。入口见 `HANDOFF.md`。
- `MASTER-CHECKLIST.md` —— 发布验收清单
- `docs/WEATHER-REFRESH.md` —— 天气日更运行手册（systemd、Kuma、失败恢复、回滚）
- `docs/UPGRADE-DIRECTIONS.md` —— 三个子站的后续升级方向
- `AGENTS.md` —— 本仓门规（备份、提交、发布）
