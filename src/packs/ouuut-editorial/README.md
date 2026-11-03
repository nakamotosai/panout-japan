# ouuut-editorial · 和色六景(纸白 / 炭黑)

杂志社论式的双模配色:**深浅只翻中性色,强调色两模共用**。六章各取一色,小字彩色文本走同色相提亮一档,层级靠留白与字号而不是线框。

```html
<link rel="stylesheet" href="css/type.css">
<link rel="stylesheet" href="css/all.css">
<html data-theme="paper" data-palette="a">
```

| | 纸白(默认) | 炭黑 |
|---|---|---|
| 底 | `#F5F3ED` | `#0E0E0C` |
| 墨 | `#1A1A16` | `#EDEBE4` |
| 灰 | `#5B5A53` | `#A3A199` |
| 面 | `rgba(26,26,22,.045)` | `rgba(237,235,228,.055)` |

强调色(两模共用,全部 Y≈0.20):青磁 `#0C8B7A` · 山吹 `#A77109` · 朱 `#CD5545`(主色/警示) · 藍 `#3F7DCA` · 苔 `#678618` · 紫 `#A165AE`。

- 配对规则与双模硬约束:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)
- 自检:`python scripts/assert_tokens.py`

实测(2026-11-03):`ink/bg 15.73(纸白)/16.20(炭黑)`、`muted/bg 6.24/7.47`、24 个强调色 `Y 0.199–0.203`、炭黑侧 `≥4.57:1`、纸白侧 `≥3.75:1`(故纸白侧小字必须用 `--accent-ink`)。

MIT。来源与归属见 `pack.json.attribution`。
