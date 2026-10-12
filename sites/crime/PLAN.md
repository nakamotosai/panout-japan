# PLAN · M6 转长项目收口（2026-10-05）

## 执行步骤

1. 全量拷 `F:/omp-data/tokyo-crime-map` → `F:/projects/tokyo-crime-map`（已做，`diff` 验一致）。
2. 补门规 + 真相源（本文件在内）；README 加状态节（状态 + 最近完成 + 唯一 next）。
3. 新仓 `git init` + 基线 commit；`gh repo create tokyo-crime-map --private` + Gitea 同名 private；
   双远端 push，核对 SHA 一致。
4. 项目本写前整包备份，`upsert projects` + `upsert now`（`slug=tokyo-crime-map`，`stage=active`），
   写完 `validate_data.py --all` + 行数对上。
5. 旧址移 `F:\archive\<ts>-tokyo-crime-map-旧址\`（只搬不拷），`F:/omp-data` 侧减法 commit。
6. 走 `sai-closeout` 八步收口（含记忆双写），卡保留 `active`。

## 文件变更

- 新增：`AGENTS.md` / `PROJECT_CONSTITUTION.md` / `TRACK_TREE.md` /
  `SPEC.md` / `PLAN.md` / `progress.md` / `HANDOFF.md` / `CLOSEOUT.md`
- 改：`README.md` 状态节；`.gitignore` 加 `__pycache__/`
- 不动：`scripts/` / `site/` / `data/` / `raw/`（M5 已验证）

## 验证方式

- 新仓 `git log --oneline -1` + 双远端 `git ls-remote <remote> HEAD` SHA 一致。
- `qa_data` 21/21 + `qa_site` 72/72 实跑（新仓内跑一遍）。
- `ls -d F:/omp-data/tokyo-crime-map` 不存在；`git -C F:/omp-data status --porcelain=v1` 干净。
