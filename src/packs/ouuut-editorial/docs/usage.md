# usage · ouuut-editorial 配对规则

> 这套配色的核心主张:**层级不靠线和阴影,靠 surface 块、留白和字号**;颜色只承担"分类"和"重点",不承担装饰。

## 1 谁配谁(组件 → token)

| UI 部位 | token | 说明 |
|---|---|---|
| 页面底 | `--bg` | 纸白 `#F5F3ED` / 炭黑 `#0E0E0C` |
| 卡面 / 分区块 | `--surface` | 半透明层,不给边框、不给阴影 |
| 正文 | `--ink` | 纸白 15.7:1 / 炭黑 16.2:1 |
| 次要信息、图注 | `--muted` | 6.24:1 / 7.47:1 |
| 主按钮、当前章节标记、强调色块 | `--accent` | 图形/色块用**原色** |
| 小字强调(≤18px 的彩色文字、链接) | `--accent-ink` | 同色相提亮/压暗一档,4.9:1 / 5.8:1 |
| 大面积淡底(徽标、提示条) | `--accent-soft` | `color-mix(accent 10–14%, transparent)` |
| 链接 | `--link` = `--accent-ink` | **不要**和主按钮同色同档 |
| 危险 / 警示 | `--danger`(朱) | 只用在文案与描边,避免大块实心红 |
| 成功点 / 通过 | `--green`(苔) | 12px 左右的小圆点即可 |

## 2 双模规则(硬约束)

1. **深浅只翻中性色**(`--bg` `--ink` `--muted` `--surface` + 小字参数),强调色两模完全相同。
2. 同一色值不可能同时满足黑白两侧的 4.5:1(纸白要 Y ≤ 0.160、炭黑要 Y ≥ 0.193)→ 所以强调色统一落在 **Y 0.199–0.203**,实测:
   - on 炭黑:4.57–4.65:1(**文字可用**)
   - on 纸白:3.75–3.81:1(**仅图形/大字**)
3. 因此**纸白模的小字彩色文本一律走 `--accent-ink`**,不许直接用 `--accent`。
4. 页面必须带**可见的深浅切换按钮**:44px 热区、纯图标(太阳 / 空心月亮)、无边框无胶囊、`aria-label` 写用途、选择写 `localStorage`、无 JS 时跟随系统、刷新保持。

## 3 四套强调色组(`data-palette`)

| id | 名称 | 什么时候用 |
|---|---|---|
| `a`(默认) | 和色六景 | 章节多、要色彩分辨力:六章各一色 |
| `b` | 矿物大地 | 要"安静一档":土色系,新闻/档案类 |
| `c` | 双色印刷 | 只要两墨、跨章交替;印刷感 |
| `d` | 三色分类 | 三个域各一色(自然 / 社会 / 人) |

章节页用 `data-chapter="<章名>"` 把该章颜色提为当页重点色;卡片需要独立重点色时在容器上覆写 `--accent-base`(不要改 `--accent`,避免自引用)。

## 4 反模式

- 用纯黑/纯白平面(`#000` / `#fff`)替代纸白与炭黑。
- 给卡片加边框或阴影来"分层"——本套用 surface 块与留白分层。
- 小字彩色文本直接用 `--accent`(纸白侧只有 3.8:1,不达 AA)。
- 一页里同时用三套以上的强调色;主色一个区段只出现一次。
- 给正文拉 `border-bottom` 当前下划线;CJK 不使用斜体。
- 深色模沿用系统灰(`#111827`、slate 系)当底——那不是炭黑。
- 用 `vw` 给中文标题外推字号上限(本包用 `clamp(rem, vw, rem)` 并给 CJK 与拉丁分别设档)。

## 5 取用

```bash
python <sai-assets>/scripts/apply.py ouuut-editorial --to src/styles
```

```html
<link rel="stylesheet" href="styles/ouuut-editorial/type.css">
<link rel="stylesheet" href="styles/ouuut-editorial/all.css">
<html data-theme="paper" data-palette="a">
```

消费后在项目 `design-lock.json` 记 `assets[]`:`pack=ouuut-editorial`、`version`、`sha`(见 `docs/USAGE-INTEGRATION.md`)。
