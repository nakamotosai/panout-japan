# tokyo-crime-map 接手文档（HANDOFF.md）

> 生产根：`F:/projects/tokyo-crime-map`；旧址 `F:/omp-data/tokyo-crime-map` 已废（归档后删光）。
> 公网：`https://crime.saaaai.com`（2026-10-05 上线）。

## 已做（回执）

- M1–M5 全绿：数据装配 / 口径正本 / 交互 / 绝对标尺 / 深色（`qa_data` 21/21 + `qa_site` 72/72，commit `d8e470c`）。
- M6 转长项目：生产根迁移 + 门规 + 真相源 + 双远端（`github`/`gitea` SHA 一致，均 private）
 + 项目本双卡 `slug=tokyo-crime-map` `stage=active`（`validate_data.py --all` PASS）。
- M7 公网发布：`https://crime.saaaai.com` 已上线——
 站点源 `vps-jp:/srv/crime.saaaai.com`（原 `site/` 全量，`www-data`），常驻服务
 `crime-map-4124.service`（`python -m http.server 4124 --bind 127.0.0.1`），隧道
 `openclaw-tunnel` 加 `crime.saaaai.com → 127.0.0.1:4124` ingress，DNS `route dns` 指向该隧道。
 桌面 / 深色 / 搜索(`町田` 13 项) / 手机 四张截图已验，零报错。
- M8 视觉升级上线（2026-10-07）：`site/preview.html` 割接为 `site/index.html`（旧版已备份
  `F:/archive/20261007-021852-tokyo-crime-map-cutover/`），并已部署到
  `vps-jp:/srv/crime.saaaai.com/index.html`（VPS 侧旧站备份 `/tmp/crime.saaaai.com.bak-20261007`）。
  内容：双主题（纸感白/暖琥珀黑曜石、日出日落自动切换）+ 54px 毛玻璃顶栏 + 左下分布仪 +
  町丁/区市双卡 + 所属边界高亮 + 橙色竖向缩放条 + 底部选中气泡 + MiSans VF 极细字 + 隐形滚动条。
  线上一手验证：双卡 2 / 注记 62 / MiSans 生效 / 居中 [0,0] / 零报错（截图 `qa/out/live_final.png`）。
- ⤴ M9 3D 战术沙盘 PoC（2026-10-07；**已随 M11 移出本仓**，M9/M10 三段留作历史）：新建 `site/3d/`，把町丁犯罪率投射到上游 procedural-tokyo
  （MIT）的真实东京 3D 模型上，**零补丁**接入（走 `window.__app` + 自建 rAF）。
  交付：`scripts/build_3d_crime.py`（口径与 `site/index.html` 逐位对齐的数据包生成）+
  `site/3d/build_preview.mjs`（一键装配：克隆上游→拷叠加层→抓取/编译瓦片→构建→起服务）+
  `site/3d/overlay/`（crime.html / crime-main.js / crime.js / vite.crime.config.js）。
  实测：新宿场景 52 町丁 / 45 参色 / 16 光柱 / 10 HUD，零 console 报错；
  投影精度用上游 HUD 回读验证（`35.69647N 139.70378E` = 数据源坐标，逐位相同）。
- M10 3D 性能减负（2026-10-07）：用户反馈「卡、拖动尤其卡」。先量后改（页内逐帧 rAF 采样，
  与应用 HUD 交叉核对；发现早期测量被「多标签页争抢 + 探针泄漏 + 预热」污染，改为重载后测量才可复现）。
  两条结论：① 最大单项是上游水镜——它把整座城在水下**再画一遍**，关掉后 815→506 draws、43→70 fps，
     而画面差别仅部分玻璃高光；② 分辨率有用但**不能在运动过程中改**（重建后期渲染目标 → 那一帧 65 ms，
     正是「一拖就顿」的来源）。
  交付 `site/3d/overlay/quality.js`：按「长边预算」换算像素比的三个档位（画质 3840 / 平衡 2560 / 流畅 1920）
  + 运动时只切 reflect/AO 两个布尔开关、停手 300 ms 自动恢复；面板内嵌档位与实时读数；
  新增 URL 参数 `?q=` 与 `?autoq=0`。默认档「平衡」：静止 68 fps / 真实拖动 69–75 fps（原为 18/17 fps）。
- M10 修复（同日）：用户回报「拖动时右半屏纯黑 + 乱闪」。第一版漏验「拖动中」这一面（只在拖动结束后截图），
  缺陷正是出在拖动中。定位：`autoMotion=false` 拖动 → 完好，`autoMotion=true` → 右半黑；
  单独置 `ao.configuration.intensity = 0`（静止、可逆）即复现，黑区占宽 0.498；
  `readPixels` 直读帧缓冲确认 x≥W/2 全黑（排除截图合成假象）；钩住 `setViewport`/`scissor`/`blitFramebuffer`
  发现两种状态下调用序列逐条相同、视口满幅 → 是 n8ao 2.0.1 在 `intensity === 0` 时把合成画坏，
  与尺寸/视口无关。修法：只切 `ao.enabled`（黑区 0.000），并在 `update()` 加防线把上游 Settings 的
  `occlusion`（同样是写 intensity=0）转成 `enabled = false`。
  验收：三档位 + 启停切换共 15 次拖动中采样，黑区占比全 0，console 无报错。
- M11 3D 沙盘拆分移出（2026-10-07）：判定 3D 与 2D 在做同一件事（把犯罪率画到地理上），
  且 3D 最多只覆盖 410/5234 町丁 = 7.8%（人口 4.9%、案件 17.5%），成不了全域的另一种视图，
  于是整体拆为独立项目 `F:/projects/tokyo-after-dark`（夜行東京），主题改为第一人称夜行东京。
  处理：可复用层（装配器 / 画质调度器 / 构建配置）迁入新仓；犯罪专用件
  （`site/3d/` 整棵 + `scripts/build_3d_crime.py` + `scripts/qa_3d.py`）移入
  `F:\archive\20261007-crime-3d-split\`；M9/M10 攒下的通用知识（零补丁架构、上游接口清单、
  性能归因、n8ao intensity=0 半屏黑屏反模式、验收纪律）迁入新仓 `docs/upstream-notes.md`。
  原 3D 的未验项随项目转移（→ 新仓 `PLAN.md` 风险节）。

- 记忆：`wiki:tokyo-crime-map-longproject`（handbooks）+ `wiki:windows-dir-move-cwd-lock`（runbooks）
 + omp-global 两条指针。

## Commands run（跑过命令 + 真实返回）

```bash
cd F:/projects/tokyo-crime-map && python scripts/qa_data.py                # === 21/21 PASS ===
cd F:/projects/tokyo-crime-map && python scripts/qa_site.py --retries 3    # === 72/72 PASS ===
git ls-remote github HEAD; git ls-remote gitea HEAD                        # 同 SHA 4d6801a
ssh vps-jp "cd ~/project-portfolio && python3 scripts/validate_data.py --all"  # PASS — schema=11 sections, data=11 csv
ssh vps-jp "systemctl --user is-active crime-map-4124.service"             # active

# ↓ 以下 3D 相关命令随 M11 移出本仓，原样保留作历史（脚本已归档到 F:\archive\20261007-crime-3d-split）
# M9（3D 沙盘）
cd F:/projects/tokyo-crime-map && python scripts/build_3d_crime.py --area shinjuku
#   [ok] site/3d/data/crime_shinjuku.json 45.6 KB chome=52 wards=3
#   total hi=71.61 breaks=0.71,1.92,3.99,7.52,13.56,23.87,41.50,71.61   ← 与线上 SCALES 完全一致
cd F:/projects/tokyo-crime-map && node site/3d/build_preview.mjs --area=shinjuku --work=F:/tmp/tokyo3d-build
#   [3.3s] ✅ 预览产物：…\dist-crime\crime.html
# 线上 SCALES 取证（浏览器直读 window）：
#   SCALES.total.n=10022（muni+poly）  SCALES.{nb,bi,r,v,o}.n=9898（仅 poly）  SCALES.v.hi=1.3441

# M10（3D 性能）——归因矩阵（同上机位，重载后测量）
#   全效果 pr2 水镜开     40.6 ms / 25 fps / 1149 draws
#   全效果 · 拖动         33.5 ms / 30 fps / 1105 draws
#   关水镜反射            14.3 ms / 70 fps /  506 draws
#   真实鼠标拖动（平衡档） 全程 69–75 fps，reflect=false ao=0 稳定生效，松手恢复

# ↓ M11（3D 沙盘拆分移出本仓 —— 2026-10-07 实跑；本段为新追加，以上 3D 命令保留作历史）
cd F:/projects/tokyo-crime-map && mv site/3d F:/archive/20261007-crime-3d-split/site-3d
#   → 移动成功（只搬不拷，原 `site/3d/` 整棵）
cd F:/projects/tokyo-crime-map && mv scripts/build_3d_crime.py scripts/qa_3d.py F:/archive/20261007-crime-3d-split/scripts/
#   → 两个 3D 脚本同轮归档（本仓 scripts/ 已无 3D 脚本）
ls F:/archive/20261007-crime-3d-split/
#   → legacy-source-readme.md  scripts/  site-3d/  tmp/
cd F:/projects/tokyo-crime-map && python scripts/qa_data.py     # → === 21/21 PASS ===
cd F:/projects/tokyo-crime-map && git push                      # → 44367e6..77d97ac（GitHub + Gitea 双远端）
cd F:/projects/tokyo-after-dark && git rev-parse HEAD           # → 9a4dce6（新仓首提交）
#   新仓提交信息：feat: 夜行東京 P0 —— 从 tokyo-crime-map 拆分为独立项目
#   新仓生产根：F:/projects/tokyo-after-dark（`.git` 已建，远端尚未创建）
#   新仓后续账目（P0 验收数字、P1 探针计划、发布门禁）见 F:/projects/tokyo-after-dark/HANDOFF.md
```

## Not verified

- 尚未在新机器上从零 `git clone` 验「克隆即跑」（本机是原地目录，非克隆产物）。
- 未验：Cloudflare 各 PoP 缓存行为、长尾弱网加载、搜索引擎收录。
- HTTPS 证书：本次经 Cloudflare 边缘（`proxied`），源站未单独申请证书；如需回源直连另议。
- （原 M9/M10 的 3D 未验项已随项目移出，见 `F:/projects/tokyo-after-dark/PLAN.md` 风险节。）

## 残留

- 数据更新机制：R8 定稿后重跑 `scripts/build_*.py` → 同步 `site/data/` → 重新发布到
 `vps-jp:/srv/crime.saaaai.com`（备份→健康检查→原子替换，见 `PLAN.md` 发布节）。
- **线上 2D 站点两处口径缺陷**（M9 期间用浏览器取证，尚未修）：
  ① 区市面非「全部刑法犯」指标全渲染最深色（`muni.json` 长键 vs 代码短键）；
  ② K=2000 收缩只在文案里，着色代码未生效。
  （两处的取证记录随 3D 拆分归档在 `F:\archive\20261007-crime-3d-split\`。）

## Next safe action（下一步只一件）

```bash
cd F:/projects/tokyo-crime-map && python scripts/build_data.py   # R8 定稿后重跑数据链
```

## 引用

- 复现链见 `AGENTS.md` §4；数据许可见 `PROJECT_CONSTITUTION.md`（署名勿删）。
- 看板：vps-jp project-portfolio `projects`/`now` 两卡 slug=`tokyo-crime-map`。
