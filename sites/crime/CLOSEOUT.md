# tokyo-crime-map 收口（CLOSEOUT.md）

## 2026-10-05 · M6 转长项目收口（深色已验收）

- DoD（全过）：
  - 生产根迁 `F:/projects/tokyo-crime-map`，旧址归档 `F:/archive/20261005-012337-tokyo-crime-map-ompdata-旧址/`（只搬不拷，原位已删）。
  - 新仓基线 commit `291547e`（本地/github/gitea 三处 SHA 一致，双 remote 均 private）。
  - `qa_data` 21/21 + `qa_site` 72/72（新仓内实跑）。
  - 项目本双卡 `slug=tokyo-crime-map`（`projects` + `now`，`stage=active`），`validate_data.py --all` PASS。
- 版本：暂无 `version` 字段（N/A）。
- 记忆：`wiki:tokyo-crime-map-longproject`（handbooks）+ `wiki:windows-dir-move-cwd-lock`（runbooks）
  + omp-global 两条指针（`{"success":true,"items_count":2}`）。两篇 wiki 均 `read` 回读正文核对。
- 残留：定是否公网发布（`HANDOFF.md` 承接）。
- Rollback：新仓 `git revert <sha>`；项目本备份在 vps-jp `/tmp/projects.csv.bak-20261005-tokyocrime`
  与 `/tmp/now.csv.bak-20261005-tokyocrime`；旧址归档 `F:/archive/20261005-012337-tokyo-crime-map-ompdata-旧址/`。
- 备注：旧址搬迁曾被遗留 `python -m http.server 8766 --directory site`（PID 43004，CWD=项目根）占用，
  经 psutil 定位 CWD 后杀掉即搬成（见 `wiki:windows-dir-move-cwd-lock`）。
