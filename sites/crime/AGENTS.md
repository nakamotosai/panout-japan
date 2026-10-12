# tokyo-crime-map 门规（AGENTS.md）

> 生产根：`F:/projects/tokyo-crime-map`；旧址 `F:/omp-data/tokyo-crime-map` 已废（迁移后归档删光）。

1. **动核心文件先备份**：改 `scripts/`、`site/index.html` 前，先把待改文件拷进
   `F:\archive\<YYYYMMDD-HHMMSS>-tokyo-crime-map\`（只搬不拷回原位、禁墓碑后缀）。
2. **开发改动验证通过当轮即 git commit**（仅 commit，push 留给 `sai-closeout`），不许攒多轮；
   一功能一 commit；收口常规 push 免确认直接推（禁 `force push` / `reset --hard`）。
3. **版本字段**：本项目暂无 `version` 字段，此条 `N/A`；将来若加 `package.json` 再随提交同步抬版本。
4. **复现链**：`python scripts/build_muni.py` → `python scripts/build_data.py` →
   `bun scripts/fetch_lod.mjs`（抓取必须走 Bun，本机 bash 内联 HTTP 被拦截）→
   `python scripts/build_chome_poly.py`（离线装配）→ `python scripts/qa_data.py`（21 项）→
   `python scripts/qa_site.py --retries 6`（72 项）。`site/data/` 是 `data/` 的服务副本，
   两边 `md5` 必须一致（`qa_data` 覆盖此项），改数据必同步拷过去。
5. **大件不进库**：`data/lod_cache.json`（11M 抓取缓存，可重抓）、`qa/out/`（截图产物）、
   `__pycache__/` 不进 git；`site/data/`（11M）进库，保证克隆完直接 `http.server` 即跑。
6. **数据许可**：町丁界住所 LOD（CC BY-SA 4.0）+ 区界面 dataofjapan/land + ©OpenStreetMap contributors；
   页面右下角署名常驻，请勿移除。警视厅「計」列原样呈现，不自编聚合口径。
