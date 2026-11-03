---
name: ouuut-editorial
description: Apply the ouuut Editorial palette (和色六景 · 纸白/炭黑) to web pages, editorial sites, dashboards and report layouts. Use when the task needs a Japanese-colour chapter system, paper/charcoal dual theme, zero-structure-line editorial hierarchy, or AA-safe small type on a shared accent palette.
---

# ouuut-editorial

给任何网页装上"杂志社论"这套配色:**深浅只翻中性色,强调色两模共用**,六章各取一色,层级靠留白与字号而不是线框。

## When to use

- 内容型 / 杂志型 / 报告型站点,要纸白与炭黑双模
- 需要"一个色管一个域/章节"的分类色体系(`data-chapter`)
- 需要小字彩色文本达到 AA(用 `--accent-ink`,而不是原色)
- 需要零结构线(无边框、无阴影)的层级

## When not to use

- 霓虹 / 赛博 / 高饱和营销落地页
- 密集数据工具面板(用 gruvbox-dark 或工具类暗色主题)
- 需要厚阴影、玻璃拟态、渐变装饰的页面

## Default

`data-theme="paper"`(纸白)+ `data-palette="a"`(和色六景)

| role | value |
|------|-------|
| bg | `#F5F3ED`(炭黑 `#0E0E0C`) |
| ink | `#1A1A16`(炭黑 `#EDEBE4`) |
| muted | `#5B5A53`(炭黑 `#A3A199`) |
| accent / danger | `#CD5545` 朱 |
| chapter hues | 青磁 `#0C8B7A` · 山吹 `#A77109` · 朱 `#CD5545` · 藍 `#3F7DCA` · 苔 `#678618` · 紫 `#A165AE` |

## Variants and axes

| 轴 | 属性 | 取值 | 说明 |
|---|---|---|---|
| 主题 | `data-theme` | `paper`(默认) / `charcoal`(别名 `light` / `dark` 兼容) | 只翻中性色 |
| 强调色组 | `data-palette` | `a` 和色六景(默认) / `b` 矿物大地 / `c` 双色印刷 / `d` 三色分类 | 与主题正交 |
| 章节提色 | `data-chapter` | `weather` `quake` `crime` `cabinet` `housing` `population` | 把该章颜色提为当页重点色 |

## Files

| path | use |
|------|-----|
| `tokens/absolute.json` | 原色表(中性斜坡 + 四套色组 + 小字提亮参数) |
| `tokens/index.json` | 变体与三个轴的目录 |
| `tokens/semantic/<variant>.json` | 供 agent 读取的语义映射 |
| `css/default.css` | 只含默认(纸白 + A),最快 apply |
| `css/all.css` | 双模 + 四套色组 + 章节提色(含 `:root`,单主题直接应用) |
| `css/themes.css` | 同上但**只出 `[data-theme]` 作用域**:与项目自带主题切换器并存时用这份 |
| `css/type.css` | 字族 / 字号档 / 动效刻度(与配色正交) |
| `docs/usage.md` | **配对规则 + 双模硬约束 + 反模式** |
| `preview/index.html` | 活预览(含深浅切换与色组切换) |

## Agent apply steps

1. 读 `tokens/semantic/paper.json`(或 `charcoal.json`)拿到语义色;**禁止**自己编 hex。
2. 把 `css/type.css` + `css/all.css` 拷进项目样式目录(或按 `scripts/apply.py`)。
3. 在 `<html>` 上打轴:`data-theme="paper"`(默认可省)、`data-palette="a"`、章节页加 `data-chapter="<章名>"`。
4. 映射组件:`页面底→--bg`、`卡面→--surface`(不加边框/阴影)、`正文→--ink`、`次要→--muted`、`主按钮与色块→--accent`、**小字彩色文本与链接→--accent-ink**、`危险→--danger`、`成功点→--green`。
5. 必带**可见深浅切换按钮**:44px 热区、纯图标(浅色太阳 / 深色空心月亮)、无边框无胶囊、`aria-label`、选择写 `localStorage`、无 JS 跟随系统。
6. 自检:纸白/炭黑都不是纯白纯黑;卡面没有边框与阴影;彩色小字用的是 `--accent-ink`;一页强调色不超过三套。

## Hard rules

- 深浅**只翻中性色**,强调色两模完全一致(不要为深色模式另调一套强调色)。
- 纸白侧强调色只有 3.8:1(仅图形/大字);**小字必须走 `--accent-ink`**(纸白 4.9:1 / 炭黑 5.8:1)。
- 层级不用线和阴影:用 `--surface` 块、留白(`--sec-y`)和字号档。
- CJK 不用斜体、不用 `border-bottom` 当下划线、不用 `vw` 给中文标题外推字号上限。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack`/`version`/`sha`)。
