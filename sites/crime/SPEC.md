# SPEC · M6 转长项目收口（2026-10-05）

## 目标

把 `tokyo-crime-map` 从 `F:/omp-data` 实验区转正成长项目并收口本轮，深色已验收。

## 范围

- [ ] 生产根迁 `F:/projects/tokyo-crime-map`，旧址归档后删光（只搬不拷）
- [ ] 立门规 + 10 真相源（`docs/adr` 按停用结论不建）
- [ ] GitHub + Gitea 双 private 远端，SHA 一致
- [ ] 项目本 `tokyo-crime-map` 双卡（`projects` + `now`），`stage=active`
- [ ] 按 `sai-closeout` 八步收本轮，卡保留 `active`

## 非目标

- 不动口径/标尺/交互/深色实现（M1–M5 已验证，不重碰）。
- 不加 `version` 字段（暂无，按 N/A）。

## 验收条件

1. 新仓 `git log` 有转正基线 commit，双远端 `ls-remote` SHA 一致 — `git ls-remote` 对۔
2. `python scripts/qa_data.py` 21/21，`python scripts/qa_site.py --retries 6` 72/72 — 实跑回执。
3. 项目本 `validate_data.py --all` PASS，双卡可查 — 远端回执。
4. `F:/omp-data/tokyo-crime-map` 已无残留（`git status` 干净 + 目录不存在）。
