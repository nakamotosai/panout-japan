# tokyo-crime-map 会话流水（progress.md）

## 2026-10-05 · 深色验收 + 转长项目收口

- 深色模式用户已验收（`d8e470c`：暖黑底 + 提亮色带，`qa_site` 72/72）。
- 由 `F:/omp-data` 实验区转正，生产根 `F:/projects/tokyo-crime-map`
 （`data/lod_cache.json` 未入库——`.gitignore` 忽略，`fetch_lod.mjs` 可重抓；旧址整体归档）。
- M6 转长项目收口完成：门规 + 真相源 + 双远端（SHA 一致）+ 项目本双卡（`slug=tokyo-crime-map`，`stage=active`）。
  新仓内 `qa_data` 21/21 + `qa_site` 72/72；旧址归档 `F:/archive/20261005-012337-tokyo-crime-map-ompdata-旧址/`。
- 记忆：`wiki:tokyo-crime-map-longproject` + `wiki:windows-dir-move-cwd-lock` + omp-global 双指针。
- M7 公网发布完成：`https://crime.saaaai.com`（桌面/深色/搜索/手机四截图已验，零报错）。
- M8 视觉升级上线（2026-10-07）：preview 割接为 index 并部署，线上验证双卡/62注记/MiSans/居中[0,0]/零报错；备份见 HANDOFF。

## 2026-10-07 · M9 3D 战术沙盘 PoC

- 新建 `site/3d/`，零补丁把町丁犯罪率投到上游 `jeantimex/tokyo`（procedural-tokyo，MIT）的真实东京 3D 模型：
  地面战术热力（界址多边形贴地、加法混合、9 档）+ 热点光柱 + 悬浮 HUD + 热点巡礼飞抵。
- 交付：`scripts/build_3d_crime.py`（数据包，口径与 `site/index.html` 逐位对齐）、
  `scripts/qa_3d.py`（**29/29 PASS**）、`site/3d/build_preview.mjs`（一键装配 + 本地预览）、
  `site/3d/overlay/`（`crime.html` / `crime-main.js` / `crime.js` / `vite.crime.config.js`）、`site/3d/README.md`。
- 新宿实测：52 町丁 / 45 参色 / 16 光柱 / 10 HUD，console 零报错；
  投影精度用上游 HUD 回读验证（`35.69647N 139.70378E` = 数据源坐标，逐位相同）。
  （注：当时记的「60+ fps」是无头浏览器的假读数，真机帧率见 M10。）
- 取证期间发现线上 2D 站两处缺陷（区市面非「全部」指标全渲染最深色；K=2000 收缩未在代码生效），
  已记入 `HANDOFF.md` 残留与 `site/3d/README.md`。
- 下一步：数据更新机制（R8 定稿后重跑 `build_*` + 重新发布）。

## 2026-10-07 · M10 3D 性能减负

- 用户反馈「卡，拖动尤其卡」。先量后改：最大单项是上游**水镜反射**（把整座城在水下再画一遍），
  关掉后 815→506 draws、43→70 fps，画面差别仅部分玻璃高光；
  分辨率有用但**不能在运动过程中改**（重建后期渲染目标 → 那一帧 65 ms，正是拖动顿挫的来源）。
- 交付 `site/3d/overlay/quality.js`：三档（画质 3840 / **平衡 2560 默认** / 流畅 1920，按长边预算换算像素比）
  + 运动时只切 reflect/AO、停手 300 ms 恢复 + 面板档位与实时读数；新增 `?q=` / `?autoq=0`。
- 实测（RTX 2080 Ti）：默认档静止 68 fps、真实鼠标拖动 69–75 fps（原 18 / 17 fps），console 零报错。
- **修复（同日）**：用户回报拖动时右半屏纯黑 + 乱闪。根因是「运动时关遮蔽」写了
  `ao.configuration.intensity = 0` —— n8ao 2.0.1 在这条路径上会把合成画坏（帧缓冲 x ≥ W/2 全黑，
  随启停闪烁）。改为只切 `ao.enabled`，并加防线兜住上游 Settings 里的同名开关。
  三档位 + 启停切换共 15 次拖动中采样，黑区占比全 0。教训：验收必须包含「拖动进行中」这一面。

## 2026-10-07 · M11 3D 沙盘拆分为独立项目

- 判断依据（实测）：3D 与 2D 在做同一件事（把犯罪率画到地理上），且 3D 六区域合计只覆盖
  **410/5234 町丁 = 7.8%**（人口 4.9%、案件 17.5%、9/62 区市），成不了全域的另一种视图；
  2D 站也没有町丁级深链（只有 `?lang=`），双向跳转的成本与露馅风险都不划算。
- 处置：整体拆出为独立项目 **`F:/projects/tokyo-after-dark`（夜行東京 / Tokyo After Dark）**，
  主题改为第一人称夜行东京（步行/驾驶/飞行 + 摄影模式），与犯罪率无关。
- 本仓：`site/3d/` 整棵 + `scripts/build_3d_crime.py` + `scripts/qa_3d.py` 移入
  `F:\archive\20261007-crime-3d-split\`；可复用层迁入新仓；M9/M10 的通用知识迁入新仓
  `docs/upstream-notes.md`。3D 从未上线，本仓无线上动作。
- 新仓 P0 已过验收：零补丁装配器（新增上游 commit 固定）+ 画质调度器重新落地，
  20:30 夜、静止 62 fps、拖动中运动降质生效、黑区 0、console 零报错。
