# PLAN · M0 聚合门面

## 执行步骤

1. 定技术形态：单文件静态站（复用 ouuut-v2 的纸质编辑风 token）还是轻生成器？M0 开工时拍板，落 ADR（如有落选者）。
2. 写首页三语：ja / zh-CN / en，`pan out` 配一句人话解释（P1 要求）。
3. 四板块卡：地震 / 犯罪率 / 支持率（外链老站）+ 新闻预告卡。
4. 本地三语 × 双视口验收（截图 + console 零 error）。
5. 建 CF Pages 项目，`japan.ouuut.com` 綁域，并跑验收后切流。
6. ouuut.com 官网 Products 加条（M3 可提前顺手做，用户点头为准）。

## 文件变更

- 新建：`index.html`（或 `src/` + 生成器）/ `assets/` / SEO 件（robots/sitemap/llms.txt/og）。
- 不碰：三老站任何文件。

## 验证方式

- 本地 `python -m http.server` + 线上带 `?cb` 绕缓存实测。
- 冒烟脚本固化（首页 200 + 三跳转 + 三语 + 双视口），结果贴 progress。
