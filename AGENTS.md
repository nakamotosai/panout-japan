# AGENTS · panout-japan 门规

## 备份

- 动核心文件（`index.html` / 生成器 / 数据）先备份到 `F:\archive\<时间戳>-panout-japan\`。

## 提交纪律

- 开发改动验证通过**当轮即 git commit**（仅 commit，push 留给收口），不许攒多轮。
- 含 version 字段的随提交同步抬版本。
- README 进度节每轮收尾必刷（状态 + 最近已完成 1-2 条 + 唯一 next）。

## 老站纪律

- `3d/crime/japan.saaaai.com` 三老站是回滚锚：本项目只做聚合门面 + 跳转，不动老站代码与部署。
- 摘老线必须先并跑验收，用户点头才摘。

## 双账号纪律（ouuut 系，2026-10-12 夜审 P1-4 待固化）

- 身份：GH + CF 全走 ouuut（nkmtsai@gmail.com）。CF token：`python C:\Users\sai\.omp\agent\scripts\secrets_manager.py read custom ouuut_cf_api_token`，输出 JSON **取 `.value`**；account 用同命令读 `ouuut_cf_account_id`（cf9d7aabc983abab99b5e3fdd080ec4d）。GH 用 `custom.ouuut_github_token`（凭据库 `git:https://github.com` username=ouuut）。
- CF Pages 项目:`panout-site`(`*-site` 惯例)。**手工发布一律走 `python tools/deploy_site.py`**,不要裸跑 `npx wrangler pages deploy site`:它先要求 `HEAD == origin/main`(06:10 的日更从 `origin/main` 构建,别的树发的版会在下一次 run 被盖回去),再要求天气快照是今天 JST 的(否则页面会把昨天的数据叫「今天」),上传后按字节核对 `app.css?v=`、`data.js?v=` 与 7 条路由。要拿部署 id 时用 `CLOUDFLARE_API_TOKEN=<tok> CLOUDFLARE_ACCOUNT_ID=cf9d7a...` 环境跑它,它会顺带打印 deployment id。
- 仓：`ouuut/panout-japan`（canonical，origin 已切）；个人 `nakamotosai/panout-japan` 残留待删；Gitea `sai/panout-japan` 镜像。

## 构建

- `python src/build.py` 生成 `site/`，`site/` 是产物不入库、不手改。
- 预览：`cd site && python -m http.server 8900`。

## 发布（网站类，MASTER-CHECKLIST.md 为验收载体）

- 发布前逐项打勾，**A1–A7 任一不过即阻断**。
- 天气快照由 `vps-jp` 的 `panout-weather-refresh.timer` 每日 06:10 JST 自动刷新、构建、部署并提交双远端;本地改动前先 `git pull --ff-only origin main`,不要手改 `src/weather/data.js` 绕过刷新脚本。运行手册 `docs/WEATHER-REFRESH.md`。
- 推了主线的改动要顺手把 VPS 的 checkout 也同步掉(`ssh vps-jp 'cd /home/ubuntu/panout-japan && git fetch origin && git rebase origin/main'`):它就是那台每天 06:10 全量重建并部署的机器,落后一天就会用旧源码把站点盖回去(2026-11-04)。流水线自己开场也会做这一步,但别指望它替你补差。
- 回滚：DNS 下线即回（M0 门面无状态）；老站三域独立不受影响。
