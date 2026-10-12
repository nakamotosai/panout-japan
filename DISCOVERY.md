# DISCOVERY · 四站整合（2026-10-12，四路 scout 只读收敛）

> 输入：TechStackRecon / DomainSeoCutover / BrandIaDesign / NewsPipelineReuse findings。
> 结论先行：**M0 纯外链门面（A）→ M1 子域家族（C）→ M2 新闻聚合（cnjpv5 复用）**；子路径迁入（B）否决。

## 1 · 候选树

| 形态 | 含义 | 技术面打分 | SEO 面 |  verdict |
|---|---|---|---|---|
| A 纯外链门面 | `japan.ouuut.com` 静态门面，四卡外链老站 | 1/1/1/1（零动三站） | 新域白纸起 SEO，老域不动 | ✅ M0 |
| B 子路径迁入 | 三站并入 `japan.ouuut.com/<quake|crime|approval>/` | 4/5/4/3 | 301+权重合一最好 | ❌ 否决 |
| C 子域家族 | `quake./crime./cabinet.japan.ouuut.com` + 老域 301 | 1/1/1/2 | 边缘整站 301+canonical 翻转+GSC 地址变更 | ✅ M1 |
| D 反代统一 | 单域反代混 Pages+VPS 源 | 1/1/1/4 | 单域权重 | 备选（仅强制单域 SEO 时） |

## 2 · 否决 B 的理由（致命约束，两面独立命中）

- earthquake 绝对路径（`/favicon.svg`、`/data`、`/icons`）+ Vite base 待改；与 crime 11M + quake 85M 并入同一 Pages 项目致部署膨胀 + Leaflet 瓦片缓存冲突；cabinet canonical/OG 硬编码重写；crime 两处口径缺陷随迁放大。
- D 同理：Pages+VPS 隧道混源，隧道抖动即整站抖动。

## 3 · 各面 trade-off 摘要

- **技术**：earthquake=Vite+three 85M（周更预留未启）；crime=零构建 11M，唯一 VPS 隧道（无 301 能力，M1 前 MUST 换 Caddy/nginx 或走 CF Bulk Redirect）；cabinet=零构建 341K，主 token 失效靠保险柜；cnjpv5=VPS 日更+小时抓存双线，fetch_pool+SSR+verify 可复用。
- **SEO**：cabinet 件齐但单语无验证；crime 三语最全但 AI 爬虫政策反向（放行 vs 另两站拦截，M0 统一）；quake 仓线漂移（SEO 件只活在线上，M1 前 MUST 入仓）。并存期 self-canonical 绝不互指。
- **品牌/IA**：门面复 ouuut-v2 纸质 token（mono 纸#F3F1EA/柿#E8431A + sage，零线条，Instrument Serif+Geist+Mono 眉标，content.json 单真源）；IA 推 **B：地震主视觉+三小卡**（Hero 右嵌地震缩略，下接三行索引），M2 新闻长在 B 之下。pan out 三语解释文案已出（ja/zh/en）。调和=纸壳+暗室（门面纸质，子站保深色，仅统一眉标/页头页脚/返回链；否决全站漂白）。
- **新闻**：cnjpv5 今晨 08:05 链活；复用=照搬（FreshRSS/发布闸/feed 系）+改参（BATCH/选题query/cron 错峰 09:05/和风化）+重写（合成器透镜/日文词表/三语管线/分钟级实时流另起）。日本源 14 候选（NHK/Yahoo/GN-JP 活；日经/读卖/朝日墙或终走聚合代取；JMA 予報 JSON+P2PQuake 实时；警视庁/e-Stat 口径源）。M0 预告卡=纯静态占位零 JS；M2 数据存 `~/japan-news/` 同机异目录。

## 4 · M0 决策（收敛为 SPEC  frozen 项）

1. 形态 A：静态三语门面 + 三外链（现行老 URL）+ 新闻预告占位卡。
2. IA 采 B（地震主视觉+三小卡），pan out 三语解释落 Hero。
3. SEO 白纸起：robots/sitemap/hreflang/OG/JSON-LD/GSC+Bing 当天验证；AI 爬虫政策三站统一先拍板。
4. 老站零改动（回滚锚）；`japan.ouuut.com` 独立 CF Pages 项目。
5. M1 预告：子域家族 + 逐站 301（先 cabinet），crime 先补 301 能力、quake 先 SEO 入仓。

## 5 · 开放风险（M0 开工前/中 close）

- quake 托管/SEO 注入层未知（仓内无 wrangler/_redirects）。
- crime 原地改服务有停机窗。
- 三语成本×3 vs 纸质版式（headed 320–1920 折行重测）。
- 日大报直连 404 常态，聚合依赖 GN/Yahoo 代取；Nikkei/JT 只存摘要+外链。
