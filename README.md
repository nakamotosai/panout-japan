# Pan Out Japan · 日本本土信息汇聚

`japan.ouuut.com` —— 地震 / 犯罪率 / 内阁支持率 /（未来）日本本土新闻聚合，常驻 ouuut.com 的产品。

> 状态：**立项 bootstrap**（2026-10-12 登记，生产根 `F:/projects/panout-japan`）
> 命名拍板：产品名 **Pan Out Japan**（pan out = 拉远看全景 + 结果如人意；pan = パン/Japan 尾音，不懂日本文化的人看站内解释）；域名直球 **`japan.ouuut.com`**（URL 一眼日本）；仓 `nakamotosai/panout-japan`（ouuut 组织建仓权限不足，先个人仓顶上，slug 中性方便以后 transfer）。
> 详情：见 `HANDOFF.md`；里程碑见 `TRACK_TREE.md`；当轮 spec 见 `SPEC.md`。

## 为什么做

- 地震地图（`3d.saaaai.com`）、犯罪率地图（`crime.saaaai.com`）、内阁支持率（`japan.saaaai.com`）三站各活各的，都是日本本土信息，缺一个汇聚门面。
- 未来还要模仿 cnjpv5 做日本本土新闻聚合站，一并收进本项目（预留 `news/`）。
- 落到 ouuut 品牌下做常驻产品（ouuut 家族 `xxx out` 梗：`find out` / `chill out` / 本站 `pan out`），个人项目才放 saaaai.com。

## 当前进度

| | |
|---|---|
| **已完成** | 立项命名拍板（产品 Pan Out Japan / 域 japan.ouuut.com / 仓个人顶上）；GitHub 建仓 `nakamotosai/panout-japan`（public）；本地生产根 `F:/projects/panout-japan` git init + origin；十真相源骨架落地 |
| **唯一 next** | M0：聚合门面跑通 —— `japan.ouuut.com` 首页四板块（地震/犯罪率/支持率/新闻预告）+ 三站跳转，外链先指现有三站，老站保持在线做回滚锚 |

## 验证方式

```bash
cd F:/projects/panout-japan
git log --oneline -5
git remote -v
```

## 已知阻塞

- ouuut 组织建仓权限不足（`nakamotosai cannot create a repository for ouuut`），Gitea 镜像惯例待确认（`sai/find-out` 等 scope 全探不到，疑为旧体系记录）。
