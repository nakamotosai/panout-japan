/* japan.ouuut.com · Crime view (single-page mount)
 * Source: sites/crime/site/index.html (read-only rollback anchor, 2459 lines).
 * Frozen verbatim: I18N dict + rateOf/buildScales/colorFor + chomeRateOf + updateHistogram/moveHistCursor/hideHistCursor/updateLegendBar + card builders + initMap/highlightParentBoundary/initZoomSlider/applyMode/select + fitTokyo23 + COLOR_RAMPS/VARIANTS/CF maps.
 * Stripped shell chrome: header/topbar/search-box/lang-group/palette+theme buttons/site-domain/SEO-head writes/boot Promise.all.
 * Namespace: crm- prefix. Mount box contract: #v-crime-viewport > #crm-root > #crm-map.
 * Theme map (ouuut shell -> crime variant): mono/sage -> editorial, dark -> tactical.
 * Data: ./app/crime/data/*.json on mount only (fallback ../ for preview/ dev).
 * Leaflet: dynamic import (jsdelivr primary, unpkg fallback), no static script tag.
 * API: mountCrime(el,{controls,searchInput,lang,theme,accent}) / unmountCrime() / mountCrimeControls(box,{searchInput}) / setCrimeLang / setCrimeTheme / cycleCrimeAccent / searchCrime / selectCrimeByName / selectCrimeWard / resetCrimeView / isCrimeMounted / getCrimeLegend
 */
'use strict';
const crmStore = { getItem(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, setItem(k, val) { try { localStorage.setItem(k, val); } catch (e) {} }, removeItem(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const CRM_CSS = "/* 首屏极简雷达加载器 (第一毫秒绘制，平滑淡出) */\r\n#crm-app-loader {\r\n  position: absolute; inset: 0; z-index: 9999;\r\n  background: var(--bg-page, #F5F3ED);\r\n  display: flex; align-items: center; justify-content: center;\r\n  transition: opacity .4s var(--ease, ease), visibility .4s var(--ease, ease);\r\n}\r\n#crm-app-loader.fade-out {\r\n  opacity: 0; visibility: hidden; pointer-events: none;\r\n}\r\n.loader-inner {\r\n  display: flex; flex-direction: column; align-items: center; gap: 14px;\r\n  text-align: center; user-select: none;\r\n}\r\n.loader-radar {\r\n  position: relative; width: 48px; height: 48px; border-radius: 50%;\r\n  border: 1.5px solid color-mix(in srgb, var(--accent) 25%, transparent);\r\n  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 15%, transparent);\r\n  overflow: hidden;\r\n}\r\n.loader-radar::before {\r\n  content: \"\"; position: absolute; inset: 8px; border-radius: 50%;\r\n  border: 1px dashed color-mix(in srgb, var(--accent) 35%, transparent);\r\n}\r\n.radar-sweep {\r\n  position: absolute; inset: 0; border-radius: 50%;\r\n  background: conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 45%, transparent) 0deg, transparent 90deg, transparent 360deg);\r\n  animation: radarRotate 1.2s linear infinite;\r\n}\r\n.radar-dot {\r\n  position: absolute; left: 50%; top: 50%; width: 6px; height: 6px;\r\n  background: var(--accent); border-radius: 50%; transform: translate(-50%, -50%);\r\n  box-shadow: 0 0 8px var(--accent);\r\n}\r\n@keyframes radarRotate {\r\n  from { transform: rotate(0deg); }\r\n  to { transform: rotate(360deg); }\r\n}\r\n.loader-title {\r\n  font-size: 15px; font-weight: 350; letter-spacing: 1px; color: var(--ink);\r\n  font-family: var(--font-sans);\r\n}\r\n.loader-status {\r\n  font-size: 11.5px; color: var(--muted); font-family: var(--font-sans);\r\n  letter-spacing: 0.5px;\r\n}\r\n/* =====================================================================\r\n   1. 设计系统基础变量 (严格色彩克制与统一度规)\r\n   ===================================================================== */\r\n#crm-root {\r\n  --trans: 0.2s cubic-bezier(0.16, 1, 0.3, 1);\r\n  --hh: 54px; /* 紧凑单行顶栏 */\r\n  --radius-ui: 6px;    /* 统一步调：所有控件严格 6px */\r\n  --radius-inner: 4px; /* 内嵌药丸/徽章严格 4px */\r\n  --radius-card: 8px;  /* 卡片外框严格 8px */\r\n  --zoom-accent: var(--accent); /* 缩放拖动条跟随当前全局重点色 */\r\n  --zoom-accent-soft: var(--accent-soft);\r\n  /* ---- 全站统一字体：无衬线极细（MiSans VF，可变字重 150–700） ---- */\r\n  --font-sans: \"MiSans VF\", \"MiSans\", \"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif;\r\n  --font-num: var(--font-sans);\r\n  --title-font: var(--font-sans);\r\n  --fw-xs: 350;      /* ≤12px 小字（再细会笔画溶解） */\r\n  --fw-sm: 330;      /* 12.5–13.5px 控件/正文 */\r\n  --fw-body: 310;    /* 15px+ */\r\n  --fw-mid: 250;     /* 19–20px 标题 */\r\n  --fw-display: 180; /* ≥34px 大字 */\r\n}\r\n\r\n/* ---- 纸白：只翻中性色，重点色来自全站调色板 ---- */\r\n#crm-root[data-crm-variant=\"editorial\"] {\r\n  color-scheme: light;\r\n  --bg-page: var(--bg);\r\n  --bg-glass: color-mix(in srgb, var(--bg) 45%, transparent);\r\n  --bg-map: var(--bg);\r\n  --bg-card: color-mix(in srgb, var(--bg) 60%, transparent);\r\n  --bg-card-sub: color-mix(in srgb, var(--bg) 38%, transparent);\r\n  --text-main: var(--ink);\r\n  --text-muted: var(--muted);\r\n  --text-faint: color-mix(in srgb, var(--muted) 72%, var(--bg));\r\n  --line-main: color-mix(in srgb, var(--ink) 12%, transparent);\r\n  --line-strong: var(--ink);\r\n  --accent: var(--accent-base);\r\n  --accent-soft: var(--accent-soft-base);\r\n  --shadow-card: none;\r\n  --card-glass: blur(26px) saturate(1.4);\r\n  --capsule-bg: var(--bg);\r\n  --capsule-line: color-mix(in srgb, var(--ink) 14%, transparent);\r\n}\r\n\r\n/* ---- 炭黑：只翻中性色，重点色来自全站调色板 ---- */\r\n#crm-root[data-crm-variant=\"tactical\"] {\r\n  color-scheme: dark;\r\n  --bg-page: var(--bg);\r\n  --bg-glass: color-mix(in srgb, var(--bg) 55%, transparent);\r\n  --bg-map: var(--bg);\r\n  --bg-card: color-mix(in srgb, var(--bg) 62%, transparent);\r\n  --bg-card-sub: color-mix(in srgb, var(--bg) 42%, transparent);\r\n  --bg-hover: color-mix(in srgb, var(--ink) 8%, transparent);\r\n  --text-main: var(--ink);\r\n  --text-muted: var(--muted);\r\n  --text-faint: color-mix(in srgb, var(--muted) 72%, var(--bg));\r\n  --line-main: color-mix(in srgb, var(--ink) 10%, transparent);\r\n  --line-strong: var(--ink);\r\n  --accent: var(--accent-base);\r\n  --accent-soft: var(--accent-soft-base);\r\n  --shadow-card: none;\r\n  --card-glass: blur(26px) saturate(1.4);\r\n  --capsule-bg: var(--bg);\r\n  --capsule-line: color-mix(in srgb, var(--ink) 14%, transparent);\r\n}\r\n\r\n/* 重点色不按应用切换：直接继承全站调色板（data-chapter 决定章节色）。 */\r\n\r\n/* =====================================================================\r\n   4. 地图画布与地标注记样式\r\n   ===================================================================== */\r\n/* 地图满屏铺底，顶栏以亚克力毛玻璃覆盖其上（毛玻璃才有真实内容可透） */\r\n#crm-map {\r\n  position: absolute; top: 0; left: 0; right: 0; bottom: 0;\r\n  z-index: 0; background: var(--bg-map); transition: background-color var(--trans);\r\n}\r\n\r\n/* 自带柔和地标/区名浮动标签 (解决地图无文字盲区) */\r\n.map-ward-label {\r\n  background: transparent !important; border: none !important;\r\n  text-align: center; pointer-events: none; white-space: nowrap;\r\n}\r\n.map-ward-label span {\r\n  display: inline-block; font-size: 12.5px; font-weight: 350; letter-spacing: 0.5px;\r\n  color: var(--text-muted);\r\n  text-shadow: 0 0 4px var(--bg-map), 0 0 2px var(--bg-map), 0 1px 2px var(--bg-map);\r\n  font-family: var(--font-sans); transition: color var(--trans);\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .map-ward-label span {\r\n  color: var(--muted);\r\n  text-shadow: 0 0 4px var(--bg), 0 0 3px var(--bg), 0 1px 2px var(--bg);\r\n}\r\n\r\n/* =====================================================================\r\n   5. 左下角「态势分布仪」\r\n   ===================================================================== */\r\n#crm-legend-instrument {\r\n  position: absolute; left: 16px; bottom: 16px; width: 360px; z-index: 1000;\r\n  background: var(--bg-card); -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n  border: 1px solid var(--line-main); border-radius: var(--radius-card);\r\n  padding: 10px 14px 8px; box-shadow: var(--shadow-card);\r\n  transition: all var(--trans);\r\n}\r\n.inst-header {\r\n  display: flex; justify-content: space-between; align-items: baseline;\r\n  font-size: 12.5px; margin-bottom: 5px; gap: 8px;\r\n}\r\n.inst-header .inst-title { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }\r\n.inst-header .inst-readout { flex: 0 0 auto; max-width: 72%; }\r\n.inst-title {\r\n  font-weight: 350; color: var(--text-main); font-size: 12.5px; white-space: nowrap;\r\n}\r\n.inst-readout {\r\n  font-size: 12.5px; font-weight: 350; color: var(--accent); font-family: var(--font-num);\r\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right;\r\n}\r\n.inst-hist-wrap {\r\n  position: relative; height: 22px; margin-bottom: 4px;\r\n}\r\n#crm-hist-svg {\r\n  width: 100%; height: 100%; display: block; overflow: visible;\r\n}\r\n.hist-bar {\r\n  fill: var(--text-muted); opacity: 0.25;\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .hist-bar {\r\n  fill: var(--muted); opacity: 0.3;\r\n}\r\n#crm-hist-cursor {\r\n  position: absolute; top: -2px; bottom: 0; width: 2px;\r\n  background: var(--accent); pointer-events: none; opacity: 0;\r\n  transition: left 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;\r\n  z-index: 10;\r\n}\r\n.inst-bar {\r\n  display: flex; height: 6px; border-radius: 3px; overflow: hidden;\r\n  border: 1px solid var(--line-main);\r\n}\r\n.inst-bar div { flex: 1; }\r\n.inst-ticks {\r\n  display: flex; justify-content: space-between; font-size: 11px; font-weight: var(--fw-xs);\r\n  color: var(--text-muted); margin-top: 3px; font-family: var(--font-num);\r\n}\r\n\r\n/* =====================================================================\r\n   6. 右侧自适应贴合数据面板\r\n   ===================================================================== */\r\n#crm-card {\r\n  position: absolute; right: 16px; top: 16px;\r\n  width: 352px; max-height: calc(100% - 44px);\r\n  overflow-y: auto; overflow-x: hidden; z-index: 1000;\r\n  display: flex; flex-direction: column; gap: 12px;\r\n  background: transparent; border: none; padding: 0; box-shadow: none;\r\n  /* 隐形滚动条：保留滚动能力，不显示灰条 */\r\n  scrollbar-width: none;      /* Firefox */\r\n  -ms-overflow-style: none;   /* 旧 Edge / IE */\r\n}\r\n#crm-card::-webkit-scrollbar { width: 0; height: 0; display: none; } /* Chromium / Safari */\r\n/* 单张数据卡（町丁卡 / 区市卡 各自独立成卡） */\r\n.panel-card {\r\n  flex-shrink: 0;\r\n  background: var(--bg-card); -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n  border: 1px solid var(--line-main); border-radius: var(--radius-card);\r\n  padding: 14px 16px; font-size: 15px; box-shadow: var(--shadow-card);\r\n  transition: all var(--trans);\r\n}\r\n/* 层级标签：町丁 / 区市 */\r\n.card-level {\r\n  display: inline-block; font-size: 11px; font-weight: 350; letter-spacing: 1px;\r\n  padding: 1px 5px; border-radius: var(--radius-inner); margin-bottom: 5px;\r\n  font-family: var(--font-num);\r\n}\r\n.card-level.lv-chome {\r\n  background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent-soft);\r\n}\r\n.card-level.lv-ward {\r\n  background: rgba(0, 0, 0, 0.05); color: var(--text-muted); border: 1px solid var(--line-main);\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .card-level.lv-ward {\r\n  background: color-mix(in srgb, var(--ink) 6%, transparent); color: var(--muted);\r\n}\r\n\r\n.card-head {\r\n  display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;\r\n  margin-bottom: 6px;\r\n}\r\n.card-head h2 {\r\n  margin: 0; font-size: 20px; font-family: var(--title-font); font-weight: var(--fw-mid);\r\n  line-height: 1.25; color: var(--text-main);\r\n}\r\n\r\n.rank-badge {\r\n  font-size: 11.5px; font-weight: 350; padding: 2px 6px; border-radius: var(--radius-inner);\r\n  white-space: nowrap; font-family: var(--font-num);\r\n}\r\n.rank-badge.danger {\r\n  background: var(--accent-soft); color: var(--accent);\r\n  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);\r\n}\r\n.rank-badge.neutral {\r\n  background: rgba(0, 0, 0, 0.04); color: var(--text-muted);\r\n  border: 1px solid var(--line-main);\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .rank-badge.neutral {\r\n  background: color-mix(in srgb, var(--ink) 5%, transparent); color: var(--muted);\r\n  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);\r\n}\r\n\r\n.metric-hero {\r\n  margin: 8px 0 12px; padding: 10px 12px; border-radius: var(--radius-inner);\r\n  background: var(--bg-card-sub); border: 1px solid var(--line-main);\r\n}\r\n.metric-hero .val-row {\r\n  display: flex; align-items: baseline; gap: 5px;\r\n}\r\n.metric-hero .big-val {\r\n  font-size: 34px; font-weight: var(--fw-display); line-height: 1; font-family: var(--font-num);\r\n  color: var(--text-main); letter-spacing: -0.5px;\r\n}\r\n.metric-hero .unit {\r\n  font-size: 12.5px; color: var(--text-muted); font-weight: 350;\r\n}\r\n.metric-hero .benchmark {\r\n  font-size: 12.5px; color: var(--text-muted); margin-top: 4px; font-weight: var(--fw-xs);\r\n}\r\n\r\n.breakdown-section { margin-top: 10px; }\r\n.section-title {\r\n  font-size: 11.5px; font-weight: 350; text-transform: uppercase; letter-spacing: 0.5px;\r\n  color: var(--text-muted); margin-bottom: 6px; font-family: var(--font-num);\r\n}\r\n.crime-row {\r\n  display: flex; align-items: center; justify-content: space-between; gap: 8px;\r\n  padding: 4px 0; border-bottom: 1px solid var(--line-main); font-size: 12px;\r\n}\r\n.crime-row.active {\r\n  font-weight: 450; color: var(--text-main);\r\n}\r\n.crime-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }\r\n.crime-bar-wrap {\r\n  width: 64px; height: 4px; background: rgba(0, 0, 0, 0.06); border-radius: 2px;\r\n  margin: 0; overflow: hidden; flex-shrink: 0;\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .crime-bar-wrap {\r\n  background: color-mix(in srgb, var(--ink) 8%, transparent);\r\n}\r\n.crime-bar-fill {\r\n  height: 100%; background: var(--accent); border-radius: 2px;\r\n  transition: width 0.2s ease;\r\n}\r\n.crime-count {\r\n  font-family: var(--font-num); font-weight: 350; min-width: 44px; text-align: right;\r\n  font-size: 12px; flex-shrink: 0;\r\n}\r\n\r\n.tops-box { margin-top: 12px; }\r\n.top-item {\r\n  padding: 5px 6px; border-radius: var(--radius-inner); font-size: 12.5px; cursor: pointer;\r\n  display: flex; justify-content: space-between; align-items: center;\r\n  transition: background 0.15s; border-bottom: 1px dashed var(--line-main);\r\n}\r\n.top-item:hover { background: var(--bg-hover); }\r\n.top-item .tname { color: var(--text-main); }\r\n.top-item .trate {\r\n  font-family: var(--font-num); font-size: 12.5px; color: var(--accent); font-weight: 350;\r\n}\r\n\r\n\r\n#crm-drop {\r\n  position: absolute; z-index: 1500; background: var(--bg-card); -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n  color: var(--text-main); border: 1px solid var(--line-main); border-radius: var(--radius-ui);\r\n  max-height: 260px; overflow: auto; display: none; box-shadow: var(--shadow-card);\r\n}\r\n#crm-drop div {\r\n  padding: 7px 12px; font-size: 13.5px; cursor: pointer; border-bottom: 1px solid var(--line-main);\r\n}\r\n#crm-drop div:hover { background: var(--bg-hover); }\r\n\r\n/* =====================================================================\r\n   7. 地图选中标注 (脉冲锚点 → 三环长脉冲 + 上浮地名胶囊)\r\n   ===================================================================== */\r\n#crm-lx-svg { position: absolute; left: 0; top: 0; z-index: 1500; pointer-events: none; display: block; overflow: visible; }\r\n#crm-lx-svg .lx-ring { fill: none; stroke: var(--accent); stroke-width: 2; opacity: 0; }\r\n#crm-lx-svg .lx-dot { fill: var(--accent); }\r\n#crm-lx-capsule {\r\n  position: absolute; left: 0; top: 0; z-index: 1501; pointer-events: none;\r\n  display: flex; gap: 14px; align-items: center;\r\n  background: var(--capsule-bg); -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n  border: 1px solid var(--capsule-line); border-radius: var(--radius-card);\r\n  box-shadow: var(--shadow-card);\r\n  padding: 10px 18px;\r\n  color: var(--text-main);\r\n  white-space: nowrap; opacity: 0;\r\n  transform: translate(-50%, -100%) translateY(6px);\r\n  transition: opacity 0.2s ease, transform 0.2s ease;\r\n}\r\n#crm-lx-capsule.on { opacity: 1; transform: translate(-50%, -100%) translateY(0); }\r\n#crm-lx-capsule .lx-main { display: flex; gap: 10px; align-items: baseline; }\r\n#crm-lx-capsule .lx-lvl {\r\n  font-size: 13px; font-weight: 700; color: var(--accent);\r\n  font-family: var(--font-num); letter-spacing: 0.5px; flex-shrink: 0;\r\n}\r\n#crm-lx-capsule .lx-name {\r\n  font-size: 22px; font-weight: var(--fw-mid); line-height: 1.25;\r\n  color: var(--text-main); font-family: var(--title-font);\r\n}\r\n#crm-lx-capsule .lx-num { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-variant-numeric: tabular-nums; }\r\n#crm-lx-capsule .lx-val {\r\n  font-size: 26px; font-weight: var(--fw-display); line-height: 1;\r\n  color: var(--text-main); font-family: var(--font-num); letter-spacing: -0.5px;\r\n}\r\n#crm-lx-capsule .lx-unit {\r\n  font-size: 11px; color: var(--text-muted); font-weight: var(--fw-xs); line-height: 1;\r\n  white-space: nowrap;\r\n}\r\n\r\n/* =====================================================================\r\n   8. 左侧竖向缩放拖动条 (橙色 · 替代 Leaflet 默认缩放按钮)\r\n   ===================================================================== */\r\n#crm-zoom-slider {\r\n  position: absolute; left: 16px; top: 50%; transform: translateY(-50%);\r\n  z-index: 1200; display: flex; flex-direction: column; align-items: center; gap: 4px;\r\n  background: var(--bg-card);\r\n  -webkit-backdrop-filter: var(--card-glass);\r\n  backdrop-filter: var(--card-glass);\r\n  border: 1px solid var(--line-main); border-radius: var(--radius-card);\r\n  padding: 7px 6px; box-shadow: var(--shadow-card);\r\n  user-select: none; -webkit-user-select: none;\r\n}\r\n#crm-zoom-slider .zs-cap {\r\n  font-size: 15px; font-weight: 350; line-height: 1; color: var(--text-muted);\r\n  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;\r\n  cursor: pointer; border-radius: var(--radius-inner); transition: color 0.15s, background 0.15s;\r\n  font-family: var(--font-num);\r\n}\r\n#crm-zoom-slider .zs-cap:hover { color: var(--zoom-accent); background: var(--bg-hover); }\r\n.zs-track {\r\n  position: relative; width: 6px; height: 164px; margin: 3px 0;\r\n  background: var(--line-main); border-radius: 3px; cursor: pointer;\r\n  touch-action: none;\r\n}\r\n.zs-fill {\r\n  position: absolute; left: 0; right: 0; bottom: 0; height: 0%;\r\n  background: var(--zoom-accent); border-radius: 3px;\r\n  transition: height 0.12s linear;\r\n}\r\n.zs-thumb {\r\n  position: absolute; left: 50%; bottom: 0%; width: 18px; height: 8px;\r\n  background: var(--zoom-accent); border-radius: var(--radius-inner);\r\n  transform: translate(-50%, 50%);\r\n  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);\r\n  transition: box-shadow 0.15s, bottom 0.12s linear;\r\n}\r\n.zs-track:hover .zs-thumb, .zs-thumb:active {\r\n  box-shadow: 0 0 0 4px var(--zoom-accent-soft), 0 1px 4px rgba(0, 0, 0, 0.35);\r\n}\r\n\r\n@media (max-width: 900px) {\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n  #crm-card {\r\n    left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 38%;\r\n    padding: 0; background: transparent; border: none; box-shadow: none;\r\n    overflow-x: clip;\r\n  }\r\n  #crm-card .panel-card { padding: 12px 14px; }\r\n  #crm-lx-capsule { max-width: calc(100vw - 24px); font-size: 14px; }\r\n  #crm-lx-capsule .lx-name { font-size: 16px; }\r\n  #crm-lx-capsule .lx-val { font-size: 20px; }\r\n  #crm-legend-instrument { display: none; }\r\n  /* 手机端缩放条收短、贴近左缘 */\r\n  #crm-zoom-slider { left: 10px; top: 46%; padding: 6px 5px; }\r\n  .zs-track { height: 110px; }\r\n}\r\n/* =====================================================================\r\n   9. 地图左上角 HUD 状态胶囊 (对齐 GPT 专业情报站)\r\n   ===================================================================== */\r\n#crm-hud-capsule {\r\n  position: absolute; left: 16px; top: calc(var(--hh) + 14px); z-index: 1200;\r\n  display: flex; align-items: center; gap: 8px;\r\n  background: var(--bg-card); -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n  border: 1px solid var(--line-main); border-radius: var(--radius-ui);\r\n  box-shadow: var(--shadow-card); padding: 5px 12px;\r\n  font-size: 12px; color: var(--text-main); font-family: var(--font-sans);\r\n  pointer-events: auto; user-select: none;\r\n}\r\n.hud-dot {\r\n  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);\r\n  box-shadow: 0 0 6px var(--accent); flex-shrink: 0;\r\n}\r\n.hud-sep { color: var(--text-faint); font-size: 11px; }\r\n.hud-item { font-weight: var(--fw-sm); }\r\n.hud-sub { color: var(--text-muted); font-size: 11.5px; }\r\n#crm-hud-reset {\r\n  margin-left: 4px; background: var(--bg-card-sub); border: 1px solid var(--line-main);\r\n  color: var(--text-main); padding: 2px 7px; border-radius: var(--radius-inner);\r\n  font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: var(--font-sans);\r\n}\r\n#crm-hud-reset:hover { background: var(--bg-hover); color: var(--accent); }\r\n@media (max-width: 768px) {\r\n  #crm-hud-capsule { display: none; }\r\n}\r\n\r\n/* =====================================================================\r\n   10. 双列核心 KPI 与全东京都排名看板\r\n   ===================================================================== */\r\n.metric-grid-2col {\r\n  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;\r\n  margin: 8px 0 10px;\r\n}\r\n.mg-col {\r\n  background: var(--bg-card-sub); border: 0;\r\n  border-radius: var(--radius-inner); padding: 12px 14px;\r\n}\r\n.mg-val {\r\n  font-size: 32px; font-weight: 200; line-height: 1.05;\r\n  font-family: var(--font-sans); color: var(--text-main); letter-spacing: -0.025em;\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n.mg-lbl {\r\n  font-size: 11px; color: var(--text-muted); font-weight: var(--fw-xs); margin-top: 3px;\r\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\r\n}\r\n\r\n.rank-card-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }\r\n.rank-card-item {\r\n  display: flex; align-items: center; gap: 8px; padding: 4px 6px;\r\n  border-radius: var(--radius-inner); font-size: 12px; cursor: pointer;\r\n  transition: background 0.15s; border-bottom: 1px dashed var(--line-main);\r\n}\r\n.rank-card-item:hover { background: var(--bg-hover); }\r\n.rci-idx { font-family: var(--font-num); font-size: 11px; color: var(--text-faint); width: 16px; }\r\n.rci-name { width: 56px; color: var(--text-main); white-space: nowrap; font-size: 12px; }\r\n.rci-bar-wrap { flex: 1; height: 3px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; }\r\n#crm-root[data-crm-variant=\"tactical\"] .rci-bar-wrap { background: rgba(255,244,232,0.08); }\r\n.rci-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; }\r\n.rci-val { font-family: var(--font-num); font-size: 12px; color: var(--accent); min-width: 44px; text-align: right; }\r\n\r\n/* 比例尺微调样式 */\r\n.leaflet-control-scale { margin-bottom: 74px !important; margin-left: 16px !important; }\r\n.leaflet-control-scale-line {\r\n  background: var(--bg-card) !important; border: 1px solid var(--line-main) !important;\r\n  border-top: none !important; color: var(--text-muted) !important;\r\n  font-family: var(--font-num) !important; font-size: 11px !important;\r\n  line-height: 1.1 !important; padding: 2px 5px !important;\r\n  -webkit-backdrop-filter: var(--card-glass); backdrop-filter: var(--card-glass);\r\n}\r\n/* 选中父级边界外发光 (对齐 GPT 突出选区质感) */\r\n.sel-parent-glow path {\r\n  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 75%, transparent));\r\n}\r\n#crm-root[data-crm-variant=\"editorial\"] .sel-parent-glow path {\r\n  filter: drop-shadow(0 0 6px rgba(159, 60, 44, 0.45));\r\n}\r\n/* 国土地理院纯净白图滤镜 (免 API Key，黑曜石模式自动转暗黑战术风) */\r\n.leaflet-tile-pane { transition: opacity 0.25s, filter 0.25s; }\r\n#crm-root[data-crm-variant=\"tactical\"] .leaflet-tile-pane {\r\n  filter: invert(100%) hue-rotate(180deg) brightness(70%) contrast(120%);\r\n  opacity: 0.45;\r\n}\r\n#crm-root[data-crm-variant=\"editorial\"] .leaflet-tile-pane {\r\n  filter: brightness(98%) contrast(95%);\r\n  opacity: 0.55;\r\n}\r\n/* 调色盘切换按钮 */\r\n.crm-palette-btn {\r\n  width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;\r\n  border-radius: var(--radius-inner); background: var(--bg-card); border: 1px solid var(--line-main);\r\n  cursor: pointer; transition: all 0.15s ease;\r\n}\r\n.crm-palette-btn:hover { background: var(--bg-hover); }\r\n.palette-swatch-dot {\r\n  width: 14px; height: 14px; border-radius: 50%;\r\n  background: var(--accent);\r\n  box-shadow: 0 0 6px var(--accent-soft), 0 0 0 1.5px var(--bg-card);\r\n  transition: background-color 0.2s ease, box-shadow 0.2s ease;\r\n}\r\n\r\n/* Leaflet 署名小标签磨砂适配 (彻底消灭深色模式下的刺眼白底) */\r\n.leaflet-control-attribution {\r\n  font-family: var(--font-sans) !important;\r\n  font-size: 11px !important;\r\n  border-radius: var(--radius-inner) 0 0 0 !important;\r\n  padding: 3px 8px !important;\r\n  line-height: 1.2 !important;\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .leaflet-control-attribution {\r\n  background: color-mix(in srgb, var(--bg) 78%, transparent) !important;\r\n  color: var(--muted) !important;\r\n  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent) !important;\r\n  border-left: 1px solid color-mix(in srgb, var(--ink) 8%, transparent) !important;\r\n  -webkit-backdrop-filter: blur(12px) !important;\r\n  backdrop-filter: blur(12px) !important;\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .leaflet-control-attribution a {\r\n  color: var(--muted) !important;\r\n  text-decoration: none !important;\r\n}\r\n#crm-root[data-crm-variant=\"tactical\"] .leaflet-control-attribution a:hover {\r\n  color: var(--accent) !important;\r\n  text-decoration: underline !important;\r\n}\r\n#crm-root[data-crm-variant=\"editorial\"] .leaflet-control-attribution {\r\n  background: color-mix(in srgb, var(--bg) 78%, transparent) !important;\r\n  color: var(--muted) !important;\r\n  border-top: 1px solid var(--line-main) !important;\r\n  border-left: 1px solid var(--line-main) !important;\r\n  -webkit-backdrop-filter: blur(12px) !important;\r\n  backdrop-filter: blur(12px) !important;\r\n}\r\n#crm-root[data-crm-variant=\"editorial\"] .leaflet-control-attribution a {\r\n  color: var(--ink) !important;\r\n  text-decoration: none !important;\r\n}\r\n#crm-root[data-crm-variant=\"editorial\"] .leaflet-control-attribution a:hover {\r\n  color: var(--accent) !important;\r\n  text-decoration: underline !important;\r\n}\r\n/* 口径与免责（可见文字，与 FAQPage 结构化数据一致） */\r\n.faq-block { margin-top: 10px; border-top: 1px solid var(--line-main); padding-top: 8px; }\r\n.faq-head { margin-bottom: 4px; }\r\n.faq-title { display: block; font-size: 11.5px; font-weight: var(--fw-mid); color: var(--text-main); letter-spacing: 0.5px; }\r\n.faq-sub { display: block; font-size: 11px; color: var(--text-faint); margin-top: 2px; }\r\n.faq-item { border-bottom: 1px dashed var(--line-main); }\r\n.faq-item summary {\r\n  cursor: pointer; list-style: none; padding: 5px 0;\r\n  font-size: 12px; color: var(--text-main); position: relative; padding-right: 16px;\r\n}\r\n.faq-item summary::-webkit-details-marker { display: none; }\r\n.faq-item summary::after {\r\n  content: \"+\"; position: absolute; right: 2px; top: 4px;\r\n  font-size: 13px; line-height: 1; color: var(--accent); font-family: var(--font-num);\r\n}\r\n.faq-item[open] summary::after { content: \"−\"; }\r\n.faq-item summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }\r\n.faq-a { font-size: 11.5px; color: var(--text-muted); line-height: 1.55; padding: 0 0 8px; }\r\n.faq-source { margin-top: 8px; font-size: 11px; color: var(--text-faint); }\r\n\r\n#crm-site-domain{display:none !important}\r\n\r\n#crm-root{position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;background:var(--bg-map);color:var(--text-main);isolation:isolate;z-index:0}\r\n#crm-root{--stage:var(--bg);--faint:color-mix(in srgb,var(--muted) 72%,transparent);--bg-page:var(--bg);--bg-glass:var(--surface);--bg-map:var(--stage);--bg-card:var(--surface);--bg-card-sub:var(--surface);--bg-hover:var(--surface);--text-main:var(--ink);--text-muted:var(--muted);--text-faint:var(--faint);--line-main:color-mix(in srgb,var(--ink) 14%,transparent);--line-strong:var(--ink);--accent:var(--accent);--accent-soft:var(--accent-soft);--zoom-accent:var(--accent);--zoom-accent-soft:var(--accent-soft);--shadow-card:0 4px 20px rgba(0,0,0,.10);--card-glass:blur(26px) saturate(1.6);--capsule-bg:var(--bg);--capsule-line:color-mix(in srgb,var(--ink) 14%,transparent)}\r\n.crm-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:10px}\r\n.crm-sel,.crm-q{height:32px;box-sizing:border-box;background:var(--surface);border:0;border-radius:999px;color:var(--ink);font-family:var(--font-num);font-size:11px;letter-spacing:.06em;padding:0 14px;outline:none}\r\n.crm-q{width:190px}\r\n.crm-sel:focus-visible,.crm-q:focus-visible{outline:2px solid var(--accent);outline-offset:2px}/* MOBILE */\r\n#crm-map .leaflet-top.leaflet-left { top: 60px; }\r\n#crm-map .leaflet-control-scale-line { background: var(--bg); color: var(--text-muted); border-color: var(--line-main); }\r\n@media (max-width: 640px) {\r\n  #crm-legend-instrument { left: 8px; right: 8px; bottom: 8px; width: auto; }\r\n  #crm-card { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: 38%; }\r\n  #crm-zoom-slider { display: none !important; }\r\n  #crm-map { overflow: hidden; }\r\n  #crm-map .leaflet-control-scale { display: none; }\r\n  #crm-map .leaflet-top.leaflet-left { top: 60px; }\r\n  #crm-map .leaflet-bottom { bottom: calc(38% + 8px); }\r\n}\r\n";
const CRM_DD_CSS = [
'#crm-ctl-host .crm-dd{position:relative}',
'#crm-ctl-host .crm-dd-btn{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 10px 0 12px;border:0;border-radius:2px;background:var(--surface);color:var(--ink);font-family:var(--font-sans);font-size:13px;font-weight:350;letter-spacing:.01em;cursor:pointer;white-space:nowrap;transition:background .15s ease}',
'#crm-ctl-host .crm-dd-btn:hover{background:color-mix(in srgb,var(--ink) 10%,var(--bg))}',
'#crm-ctl-host .crm-dd.open .crm-dd-btn{background:color-mix(in srgb,var(--ink) 16%,var(--bg))}',
'#crm-ctl-host .crm-dd-btn .dd-caret{opacity:.55;transition:transform .18s ease}',
'#crm-ctl-host .crm-dd.open .dd-caret{transform:rotate(180deg)}',
'#crm-ctl-host .crm-dd-menu{position:absolute;top:calc(100% + 6px);left:0;min-width:100%;padding:4px;z-index:1400;background:var(--bg);border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-radius:4px;box-shadow:0 14px 32px rgba(0,0,0,.38);display:none}',
'#crm-ctl-host .crm-dd.open .crm-dd-menu{display:block}',
'#crm-ctl-host .crm-dd-opt{display:block;width:100%;text-align:left;padding:7px 12px;border:0;border-radius:2px;background:transparent;color:var(--ink);font-family:var(--font-sans);font-size:13px;font-weight:350;cursor:pointer;white-space:nowrap}',
'#crm-ctl-host .crm-dd-opt:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}',
'#crm-ctl-host .crm-dd-opt.on{background:var(--accent);color:var(--bg)}',
'#crm-map .crm-dim .crm-chome:not(.is-sel){opacity:.62}',
'#crm-map .crm-chome.is-sel{stroke:var(--text-main);stroke-width:2.5px;opacity:1}',
'#crm-map .crm-flying .crm-chome.is-sel{stroke-width:0}'
].join('\n');
const CRM_SKELETON = "\n<div id=\"crm-app-loader\" role=\"progressbar\" aria-label=\"loading\"><div class=\"loader-inner\"><div class=\"loader-radar\"><div class=\"radar-sweep\"></div><div class=\"radar-dot\"></div></div><div class=\"loader-title\" id=\"crm-loader-title\"></div><div class=\"loader-status\" id=\"crm-loader-status\"></div></div></div><div id=\"crm-map\"></div><div id=\"crm-drop\"></div><div id=\"crm-zoom-slider\"><span class=\"zs-cap\" id=\"crm-zsPlus\" title=\"+\">+</span><div class=\"zs-track\" id=\"crm-zsTrack\"><div class=\"zs-fill\" id=\"crm-zsFill\"></div><div class=\"zs-thumb\" id=\"crm-zsThumb\"></div></div><span class=\"zs-cap\" id=\"crm-zsMinus\" title=\"-\">-</span></div><aside id=\"crm-legend-instrument\"><div class=\"inst-header\"><span class=\"inst-title\" id=\"crm-inst-title\"></span><span class=\"inst-readout\" id=\"crm-inst-readout\"></span></div><div class=\"inst-hist-wrap\"><svg id=\"crm-hist-svg\" viewBox=\"0 0 332 22\" preserveAspectRatio=\"none\"></svg><div id=\"crm-hist-cursor\"></div></div><div class=\"inst-bar\" id=\"crm-legendBarDiv\"></div><div class=\"inst-ticks\" id=\"crm-legendTicks\"></div></aside><aside id=\"crm-card\"></aside><svg id=\"crm-lx-svg\"></svg><div id=\"crm-lx-capsule\"></div>\n";
// =====================================================================
// 0. 三语国际化 (i18n: 日/中/英 · 严格对齐警视厅官方统计原名)
// =====================================================================
import { toHant } from "../hant.js";
const I18N = {
  zh: {
    siteTitleEditorial: "东京都犯罪率地势图",
    siteTitleTactical: "东京都犯罪率态势图",
    edition: "2026 EDITION",
    metrics: {
      total: "全部刑法犯", nb: "非入室盗窃", bi: "入室盗窃",
      r: "粗暴犯", v: "凶恶犯", o: "其他",
    },
    times: { R7: "R7年计", R8: "R8累计" },
    modes: { muni: "23区·市部", chome: "町丁细分" },
    searchPh: "搜索区市或町丁...", noResults: "没有匹配的町丁",
    hudWholeTokyo: "东京都全域",
    hudReset: "⟲ 复位全域",
    levelChome: "町丁",
    levelWard: "区市",
    popLabel: "常住人口",
    popMissing: "暂无",
    unitRate: "件 / 千人",
    reportedCases: "认知件数",
    totalCases: "认知总数",
    wardTotalCases: "全区案发总量 (件)",
    wardRate: "全区千人率",
    wardBenchmark: "全区基准",
    breakdownTitle: "罪种细分",
    backTo: "← 返回",
    top5ChomeTitle: "辖区高发町丁 TOP 5",
    noChomeData: "该町村暂无细分数据",
    top5WardTitle: "全东京都高发区市 TOP 5",
    byRateDesc: "按千人率",
    metaTitle: "数据源与渲染规格",
    metaL1: "5,234 町丁全量渲染 · 常住人口 1,400 万基数",
    metaL2: "小样本收缩 (K=2000) 消除昼夜畸变 · Leaflet SVG",
    rankExtreme: "极高",
    rankHigh: "偏高",
    rankNormal: "常规",
    instTitle: "每千人率分布",
    instMedian: "全域中位数",
    instMax: "封顶",
    calloutSelected: "已选中",
    noGeoNotice: "暂无町丁界（新设/埋立/以下不詳）· 件数照常列",
    seoTitle: "东京都犯罪率地图 · 5,234 町丁分级设色 | Tokyo Crime Rates",
    seoDesc: "基于警视厅官方统计的东京都犯罪率交互地图：62 个区市町村 / 5,234 个町丁，6 类罪种、R7年计与R8累计，按千人率分级设色。支持中/日/英三语，可查高发排行。",
    ogLocale: "zh_CN",
    faqTitle: "口径与免责",
    faqSub: "点开看统计口径 · 数据不构成地区安全性评价",
    faq: [
      { q: "千人率是怎么算的？", a: "千人率 = 该町丁的刑法犯认知件数 ÷ 常住人口 × 1000。为削弱小人口町丁的极端值，分档前做了小样本收缩（K = 2000）。" },
      { q: "为什么繁华街的犯罪率看起来特别高？", a: "分母用的是常住人口，而繁华街与车站前的白天流动人口远高于常住人口，导致千人率被推高。这属于口径偏差，不代表居住安全水平。" },
      { q: "数据多久更新一次，来源是什么？", a: "来自警视厅公开的「区市町村の町丁別、罪種別及び手口別認知件数」（令和7年年計与令和8年月次累计）及东京都住民基本台帐人口，许可 CC BY，随官方发布更新。" },
      { q: "可以用这些数据做租房或投资决策吗？", a: "认知件数不等于发案数，且受报案率影响；本图仅呈现官方统计的分布形态，不构成对任何地区安全性的评价或担保，请勿作为单一决策依据。" }
    ],
    siteBy: "数据来源：警视厅 · 東京都在住人口",
    navQuake: "地震", navCabinet: "支持率",
    loadingTitle: "东京都犯罪率地图",
    loadingStatus: "● 正在装配东京都 5,234 町丁空间统计数据...",
    casesUnit: "件",
    areaFallback: "东京都",
    tooltipMetric: "选择罪种",
    tooltipLangGroup: "切换界面语言",
    tooltipPalette: "切换重点色风格",
    tooltipThemeLight: "切换至纸感白",
    tooltipThemeDark: "切换至黑曜石",
    tooltipReset: "复位东京都全域视图",
    tooltipZoomIn: "放大",
    tooltipZoomOut: "缩小",
    loaderAria: "正在载入空间数据",
    accentNames: { vermilion: "朱" }
  },
  ja: {
    siteTitleEditorial: "東京都犯罪発生状況アトラス",
    siteTitleTactical: "東京都犯罪情勢マップ",
    edition: "2026年版",
    metrics: {
      total: "刑法犯総数", nb: "非侵入窃盗", bi: "侵入窃盗",
      r: "粗暴犯", v: "凶悪犯", o: "その他"
    },
    times: { R7: "令和7年計", R8: "令和8年累計" },
    modes: { muni: "区市町村", chome: "町丁別" },
    searchPh: "区市町村や町丁名を検索…", noResults: "該当なし",
    hudWholeTokyo: "東京都全域",
    hudReset: "⟲ 全域復帰",
    levelChome: "町丁",
    levelWard: "区市",
    popLabel: "常住人口",
    popMissing: "データなし",
    unitRate: "件 / 千人",
    reportedCases: "認知件数",
    totalCases: "認知総数",
    wardTotalCases: "全区認知総数 (件)",
    wardRate: "全域千人率",
    wardBenchmark: "全区基準",
    breakdownTitle: "罪種別内訳",
    backTo: "← 戻る",
    top5ChomeTitle: "管内多発町丁 TOP 5",
    noChomeData: "該当町村の町丁データなし",
    top5WardTitle: "都内多発区市 TOP 5",
    byRateDesc: "千人率順",
    metaTitle: "データ出典と仕様",
    metaL1: "都内 5,234 町丁全量描画 · 常住人口 1,400万人基準",
    metaL2: "小標本収縮(K=2000)で昼夜間人口歪みを補正 · Leaflet SVG",
    rankExtreme: "極高",
    rankHigh: "やや高",
    rankNormal: "平均水準",
    instTitle: "千人率の分布",
    instMedian: "都内中央値",
    instMax: "以上",
    calloutSelected: "選択中",
    noGeoNotice: "境界ポリゴンなし（以下不詳等）· 件数のみ表示",
    seoTitle: "東京都犯罪率マップ · 5,234 町丁の認知件数ヒートマップ",
    seoDesc: "警視庁の公式統計にもとづく東京都の犯罪率マップ。区市町村62・町丁5,234を罪種6分類・令和7年計／令和8年累計で千人率の階級別に色分け。多発ランキングも表示、日本語・中文・English対応。",
    ogLocale: "ja_JP",
    faqTitle: "口径と免責",
    faqSub: "統計口径はこちら · 地域の安全性評価ではありません",
    faq: [
      { q: "千人率はどう算出していますか？", a: "千人率 = 当該町丁の刑法犯認知件数 ÷ 常住人口 × 1000。人口の少ない町丁の極端値を抑えるため、区分前に小標本収縮（K = 2000）を行っています。" },
      { q: "繁華街の犯罪率が高く見えるのはなぜ？", a: "分母は常住人口ですが、繁華街や駅前は昼間の流動人口が常住人口を大きく上回るため、千人率が押し上げられます。口径による偏りであり、居住の安全性を示すものではありません。" },
      { q: "データの更新頻度と出典は？", a: "警視庁公開の「区市町村の町丁別、罪種別及び手口別認知件数」（令和7年計・令和8年月次累計）と東京都住民基本台帳人口によるもので、ライセンスは CC BY、公表に合わせて更新します。" },
      { q: "賃貸や投資の判断に使えますか？", a: "認知件数は発案件数とは異なり、届出率の影響も受けます。本図は公式統計の分布を示すのみで、いかなる地域の安全性の評価・保証も行いません。単独の判断材料としないでください。" }
    ],
    siteBy: "出典：警視庁 · 東京都常住人口",
    navQuake: "地震", navCabinet: "支持率",
    loadingTitle: "東京都犯罪情勢マップ",
    loadingStatus: "● 都内 5,234 町丁の空間統計データを読み込み中...",
    casesUnit: "件",
    areaFallback: "東京都",
    tooltipMetric: "罪種を選択",
    tooltipLangGroup: "表示言語を切り替え",
    tooltipPalette: "重点色を切り替え",
    tooltipThemeLight: "紙感ホワイトに切替",
    tooltipThemeDark: "黒曜石に切替",
    tooltipReset: "東京都全域表示に戻す",
    tooltipZoomIn: "拡大",
    tooltipZoomOut: "縮小",
    loaderAria: "空間データを読み込み中",
    accentNames: { vermilion: "朱" }
  },
  en: {
    siteTitleEditorial: "Tokyo Crime Rate Atlas",
    siteTitleTactical: "Tokyo Crime Tactical Map",
    edition: "2026 EDITION",
    metrics: {
      total: "Total Penal Code", nb: "Non-burglary Theft", bi: "Burglary",
      r: "Violent Crimes", v: "Heinous Crimes", o: "Other Crimes"
    },
    times: { R7: "2025 Annual", R8: "2026 YTD" },
    modes: { muni: "Municipalities", chome: "Districts (Chome)" },
    searchPh: "Search municipality or district…", noResults: "No match",
    hudWholeTokyo: "Tokyo Metro",
    hudReset: "⟲ Reset View",
    levelChome: "District",
    levelWard: "Muni",
    popLabel: "Resident Pop.",
    popMissing: "N/A",
    unitRate: "cases / 1k pop.",
    reportedCases: "Reported Cases",
    totalCases: "Total Cases",
    wardTotalCases: "Total Muni Cases",
    wardRate: "Muni Rate (‰)",
    wardBenchmark: "Muni Avg",
    breakdownTitle: "Crime Breakdown",
    backTo: "← Back to",
    top5ChomeTitle: "High-Crime Districts TOP 5",
    noChomeData: "No subdivision data for this municipality",
    top5WardTitle: "High-Crime Municipalities TOP 5",
    byRateDesc: "by Rate per 1k",
    metaTitle: "Data Source & Specs",
    metaL1: "5,234 districts fully rendered · 14M population base",
    metaL2: "Empirical Bayes shrinkage (K=2000) · Leaflet SVG",
    rankExtreme: "High",
    rankHigh: "Elevated",
    rankNormal: "Average",
    instTitle: "Distribution per 1,000 Pop.",
    instMedian: "Metro Median",
    instMax: "& above",
    calloutSelected: "Selected",
    noGeoNotice: "Boundary geometry unavailable · Statistics included",
    seoTitle: "Tokyo Crime Rates Map · 5,234 Districts Choropleth",
    seoDesc: "Interactive Tokyo crime-rate map built on official Metropolitan Police statistics: 62 municipalities and 5,234 districts, six offense categories, FY2025 annual and FY2026 cumulative, coloured by rate per 1,000 residents. Available in Chinese, Japanese and English.",
    ogLocale: "en_US",
    faqTitle: "Methodology & Disclaimer",
    faqSub: "Statistics definitions · not a safety rating",
    faq: [
      { q: "How is the rate per 1,000 computed?", a: "Rate = reported Penal Code offenses in that district ÷ resident population × 1000. To damp extreme values in small-population districts, an empirical-Bayes shrinkage (K = 2000) is applied before binning." },
      { q: "Why do entertainment districts look so high?", a: "The denominator is resident population, while daytime footfall in entertainment and station areas far exceeds it, inflating the rate. This is a definitional bias, not a measure of residential safety." },
      { q: "How often is data updated and what are the sources?", a: "Sources are the Tokyo Metropolitan Police Department's published crime counts by district and crime type (FY2025 annual and FY2026 monthly cumulative) plus Tokyo's Basic Resident Register population, licensed CC BY, refreshed as the authorities publish." },
      { q: "Can I use this for renting or investment decisions?", a: "Reported counts differ from actual incidents and are affected by reporting rates. This map only visualises the distribution of official statistics; it is not an assessment or guarantee of any area's safety and must not be used as a sole basis for decisions." }
    ],
    navQuake: "Quakes", navCabinet: "Approval",
    siteBy: "Source: Tokyo Metropolitan Police Dept. · Tokyo resident population",
    loadingTitle: "Tokyo Crime Rate Atlas",
    loadingStatus: "● Loading spatial statistics for 5,234 Tokyo districts...",
    casesUnit: "",
    areaFallback: "Tokyo",
    tooltipMetric: "Select crime type",
    tooltipLangGroup: "Switch interface language",
    tooltipPalette: "Switch accent color",
    tooltipThemeLight: "Switch to paper light",
    tooltipThemeDark: "Switch to obsidian dark",
    tooltipReset: "Reset to Tokyo-wide view",
    tooltipZoomIn: "Zoom in",
    tooltipZoomOut: "Zoom out",
    loaderAria: "Loading spatial data",
    accentNames: { vermilion: "Vermilion" }
  }
};

/* zh-Hant:四语真页面把 <html data-view-lang> 写成 zh-Hant,章节视图挑自己的词条,不落回
   zh(简体)。简体词条是唯一来源,繁体由站内 s2tw 规则转出(app/hant.js;规则与
   src/hant.py 同一份,生成与闸见 tools/gen_view_hant.py / src/view_i18n.py)。 */
const isZh = (l) => l === "zh" || l === "zh-Hant";
const zhx = (l, s) => (l === "zh-Hant" ? toHant(String(s)) : s);
function deepHant(v) {
  if (typeof v === "string") return toHant(v);
  if (typeof v === "function") return (...a) => toHant(v(...a));
  if (Array.isArray(v)) return v.map(deepHant);
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = deepHant(v[k]); return o; }
  return v;
}
I18N["zh-Hant"] = deepHant(I18N.zh);

function detectInitialLang() {
  const urlParams = new URLSearchParams(window.location.search);
  const qLang = urlParams.get("lang");
  if (qLang && I18N[qLang]) return qLang;
  const saved = crmStore.getItem("panout-crime-lang");
  if (saved && I18N[saved]) return saved;
  const navLangs = navigator.languages || [navigator.language || ""];
  for (const l of navLangs) {
    const s = l.toLowerCase();
    if (s.startsWith("ja")) return "ja";
    // 繁体标签(zh-Hant / zh-TW / zh-HK / zh-MO)走 zh-Hant 词表,不再落到 zh(简体)。
    if (s.startsWith("zh")) return /(hant|[-_](tw|hk|mo))/i.test(s) ? "zh-Hant" : "zh";
    if (s.startsWith("en")) return "en";
  }
  return "zh"; // 默认中文兜底
}

let currentLang = (function () { try { return detectInitialLang(); } catch (e) { return "zh"; } })();
const initLdr = (typeof document !== "undefined" ? $el("crm-app-loader") : null);
if (initLdr) {
  const ldrT = I18N[currentLang] || I18N.zh;
  const lt = $el("crm-loader-title");
  const ls = $el("crm-loader-status");
  if (lt) lt.textContent = ldrT.loadingTitle;
  if (ls) ls.textContent = ldrT.loadingStatus;
}
// =====================================================================
// 0.5 低饱和重点色系统 (4 套精心调配 · 一键热切换)
// =====================================================================
const ACCENT_PALETTES = [
  { id: "vermilion" }
];

/* One signal hue per theme: sage green on paper, vermilion on charcoal.
   The map is a sequential scale, not a categorical rainbow. */
const COLOR_RAMPS = {
  vermilion: {
    tactical: ["#0E0E0C", "#231713", "#38201A", "#4F2821", "#663128", "#7F3A2F", "#984336", "#B24C3E", "#CD5545"],
    editorial: ["#F5F3ED", "#F3E0D7", "#EFCCC2", "#EBB9AD", "#E7A698", "#E19283", "#DB7F6F", "#D46A5A", "#CD5545"]
  }
};

function detectInitialAccent() {
  const saved = crmStore.getItem("panout-crime-accent");
  if (saved && ACCENT_PALETTES.some(p => p.id === saved)) return saved;
  return "vermilion";
}
let currentAccent = (function () { try { return detectInitialAccent(); } catch (e) { return "vermilion"; } })();

function applyAccentPalette(acc) {
  if (!ACCENT_PALETTES.some(p => p.id === acc)) acc = "vermilion";
  currentAccent = acc;
  crmStore.setItem("panout-crime-accent", acc);
  (rootEl||document.documentElement).setAttribute("data-crm-accent", acc);

  // 重新计算分级色标，全量重绘地图多边形、直方图与图例（实现地图背景重点色与UI完全同步）
  if (typeof buildScales === "function") buildScales();
  if (typeof updateLegendBar === "function") updateLegendBar();
  if (typeof updateHistogram === "function") updateHistogram();
  if (chomeLayer) chomeLayer.setStyle(chomeLayer.options.style);
  if (muniLayer) muniLayer.setStyle(muniLayer.options.style);
  if (parentBoundaryLayer && curSelected) {
    const wardName = mode === "chome" ? curSelected?.properties?.ward : curSelected;
    if (wardName) highlightParentBoundary(wardName);
  }
  if (typeof syncPaletteTooltip === "function") syncPaletteTooltip();
}

function cycleAccentPalette() {
  const idx = ACCENT_PALETTES.findIndex(p => p.id === currentAccent);
  const nextIdx = (idx + 1) % ACCENT_PALETTES.length;
  applyAccentPalette(ACCENT_PALETTES[nextIdx].id);
}

// 调色盘按钮的 tooltip / aria-label（含当前重点色名，随语言与配色同步）
function syncPaletteTooltip() {
  const el = $el("crm-palette-btn");
  if (!el) return;
  const t = I18N[currentLang] || I18N.zh;
  const name = (t.accentNames && t.accentNames[currentAccent]) || currentAccent;
  const tip = `${t.tooltipPalette} · ${name}`;
  el.title = tip;
  el.setAttribute("aria-label", tip);
}

// =====================================================================
// 7. 色彩与主题管理 (单色调顺次色阶，琥珀暖调，根据时间自动感知)
// =====================================================================
const ICONS = {
  moon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/></svg>`
};

const VARIANTS = {
  editorial: {
    nodata: "#DDE2D8",
    nopop: "#E3E7DE",
    lineColor: "rgba(26, 26, 22, 0.18)",
    selLine: "#1A1A16"
  },
  tactical: {
    nodata: "#1A1A17",
    nopop: "#141412",
    lineColor: "rgba(237, 235, 228, 0.12)",
    selLine: "#EDEBE4"
  }
};

// 自动根据时间感知日夜模式 (晚 18:00 - 早 06:00 默认为黑曜石夜间模式)
function detectInitialTheme() {
  const saved = crmStore.getItem("panout-crime-variant");
  if (saved && VARIANTS[saved]) return saved;
  const hour = new Date().getHours();
  return (hour >= 18 || hour < 6) ? "tactical" : "editorial";
}

let currentVariant = (function () { try { return detectInitialTheme(); } catch (e) { return "editorial"; } })();
let baseTileLayer = null;

function applyThemeVariant(v) {
  currentVariant = v;
  (rootEl||document.documentElement).setAttribute("data-crm-variant", v);
  const t = I18N[currentLang] || I18N.zh;

  { const __h = $el("crm-hdr-title"); if (__h) __h.textContent = v === "editorial" ? t.siteTitleEditorial : t.siteTitleTactical; }
  { const __hg = $el("crm-hdr-tag"); if (__hg) __hg.textContent = t.edition; }
  const themeWrap = $el("crm-theme-icon-wrap");
  if (themeWrap) {
    themeWrap.innerHTML = v === "tactical" ? ICONS.moon : ICONS.sun;
  }
  const themeBtn = $el("crm-theme-btn");
  if (themeBtn) {
    themeBtn.title = v === "tactical" ? t.tooltipThemeLight : t.tooltipThemeDark;
  }

  buildScales();
  updateLegendBar();
  updateHistogram();
  if (chomeLayer) chomeLayer.setStyle(chomeLayer.options.style);
  if (muniLayer) muniLayer.setStyle(muniLayer.options.style);
  if (parentBoundaryLayer && curSelected && curSelected.properties) {
    highlightParentBoundary(curSelected.properties.ward);
  }
  if (typeof applyMode === "function") applyMode();
  if (curSelected) {
    if (mode === "chome") renderChomeCard(curSelected);
    else renderWardCard(curSelected);
  }
}

function setLanguage(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  crmStore.setItem("panout-crime-lang", lang);
  (function(v){ try { rootEl.setAttribute('lang', v); } catch (e) {} try { document.documentElement.setAttribute('data-panout-crime-lang', v); } catch (e) {} return v; })(lang === "zh-Hant" ? "zh-Hant" : (lang === "zh" ? "zh-CN" : (lang === "ja" ? "ja-JP" : "en-US")));

  // 语言按钮高亮
  $qa("[data-crm-lang]").forEach(b => {
    b.classList.toggle("on", b.getAttribute("data-crm-lang") === lang);
  });

  const t = I18N[lang];
  const titleEl = $el("crm-hdr-title");
  if (titleEl) titleEl.textContent = currentVariant === "editorial" ? t.siteTitleEditorial : t.siteTitleTactical;
  const tagEl = $el("crm-hdr-tag");
  if (tagEl) tagEl.textContent = t.edition;

  // 更新指标下拉选项文字
  $qa("[data-crm-metric]").forEach(b => {
    const k = b.getAttribute("data-crm-metric");
    if (t.metrics[k]) b.textContent = t.metrics[k];
  });

  // 更新时间切换按钮文字
  $qa("[data-crm-t]").forEach(b => {
    if (t.times[b.getAttribute("data-crm-t")]) b.textContent = t.times[b.getAttribute("data-crm-t")];
  });

  // 更新模式按钮文字
  $qa("[data-crm-mode]").forEach(b => {
    if (t.modes[b.getAttribute("data-crm-mode")]) b.textContent = t.modes[b.getAttribute("data-crm-mode")];
  });
  syncCrmDd("metric", t.metrics[curMetric]);
  syncCrmDd("time", t.times[curT]);
  syncCrmDd("mode", t.modes[mode]);

  // 搜索框 placeholder
  const qInput = $el("crm-q");
  if (qInput) qInput.placeholder = t.searchPh;

  // 同步 MLABEL 词典
  for (const k of Object.keys(t.metrics)) {
    MLABEL[k] = t.metrics[k];
  }

  // 更新 HUD 胶囊
  if (curSelected) {
    if (mode === "chome" && curSelected.properties) {
      const p = curSelected.properties;
      const rate = chomeRateOf(p);
      updateHudCapsule(p.name, `${rate != null ? rate.toFixed(1) + ' ‰' : '—'} (${MLABEL[curMetric]})`);
    } else if (typeof curSelected === "string") {
      const rate = rateOf(MUNI.find(x => x.ward === curSelected));
      updateHudCapsule(curSelected, `${rate != null ? rate.toFixed(1) + ' ‰' : '—'} (${MLABEL[curMetric]})`);
    }
  } else {
    updateHudCapsule(t.hudWholeTokyo, `62 ${t.levelWard} · ${MLABEL[curMetric]}`);
  }
  const resetBtn = $el("crm-hud-reset");
  if (resetBtn) {
    resetBtn.textContent = t.hudReset;
    resetBtn.title = t.tooltipReset;
  }

  // ---- 静态控件的 title / aria-label 全量本地化（此前遗漏的残留）----
  const setTip = (sel, tip) => {
    const el = document.querySelector(sel);
    if (el) { el.title = tip; el.setAttribute("aria-label", tip); }
  };
  setTip('.crm-dd[data-dd="metric"] .crm-dd-btn', t.tooltipMetric);
  setTip(".crm-lang-group", t.tooltipLangGroup);
  setTip("#crm-zsPlus", t.tooltipZoomIn);
  setTip("#crm-zsMinus", t.tooltipZoomOut);
  if (typeof syncPaletteTooltip === "function") syncPaletteTooltip();
  const loaderEl = $el("crm-app-loader");
  if (loaderEl) loaderEl.setAttribute("aria-label", t.loaderAria);
  const themeBtnEl = $el("crm-theme-btn");
  if (themeBtnEl) {
    const tip = currentVariant === "tactical" ? t.tooltipThemeLight : t.tooltipThemeDark;
    themeBtnEl.title = tip;
    themeBtnEl.setAttribute("aria-label", tip);
  }
  // (shell owns head: SEO/OG writes stripped)
  // 若地名胶囊正显示，同步刷新其层级标签、数值与 aria-label
  const coCap = $el("crm-lx-capsule");
  if (coCap && coCap.classList.contains("on") && coCap.dataset.placeName) {
    const lvlText = levelLabel(coCap.dataset.lvlKey);
    let syncRate = null;
    if (coCap.dataset.lvlKey === "ward") {
      const w0 = MUNI.find(x => x.ward === coCap.dataset.placeName);
      if (w0) syncRate = rateOf(w0);
    } else {
      const hit0 = POLY.features.find(x => x.properties && x.properties.name === coCap.dataset.placeName);
      if (hit0) syncRate = chomeRateOf(hit0.properties);
    }
    const syncRateText = syncRate != null ? syncRate.toFixed(1) : "—";
    coCap.innerHTML = `<span class="lx-lvl">${lvlText}</span>` +
      `<span class="lx-name">${coCap.dataset.placeName}</span>` +
      `<span class="lx-num"><span class="lx-val">${syncRateText}</span>` +
      `<span class="lx-unit">${t.unitRate}</span></span>`;
    const sep = lang === 'en' ? ': ' : '：';
    const sp = lang === 'en' ? ' ' : '';
    coCap.setAttribute("aria-label", `${t.calloutSelected}${sp}${lvlText}${sep}${coCap.dataset.placeName}${sep}${syncRateText} ${t.unitRate}`);
  }

  // 重绘直方图与图例
  updateLegendBar();
  updateHistogram();

  // 重绘右侧卡片
  if (curSelected) {
    if (mode === "chome") renderChomeCard(curSelected);
    else renderWardCard(curSelected);
  }
}
function toggleTheme() {
  const next = currentVariant === "editorial" ? "tactical" : "editorial";
  crmStore.setItem("panout-crime-variant", next);
  applyThemeVariant(next);
}

// 地图折线标注：起点 → 斜线 → 横线 → 地名标签；线用 dashoffset 做生长动画
function levelLabel(key) {
  const t = I18N[currentLang] || I18N.zh;
  if (key === "ward") return t.levelWard;
  if (key === "chome") return t.levelChome;
  return key; // 兼容旧调用传入的已本地化文本
}
function showToast(name, tag) { showCallout(name, tag || "chome"); }
// 选中标注：锚点圆 + 三环长脉冲 + 上浮地名胶囊（方案一）
function showCallout(name, tag) {
  const svg = $el("crm-lx-svg");
  const cap = $el("crm-lx-capsule");
  if (!svg || !cap || !name || !map) return;
  if (!lastAnchor) { // 程序化调用无点击坐标：用地块点位兜底
    const hit = PTS.find(p => p.n === name);
    if (hit && hit.lat != null) lastAnchor = L.latLng(hit.lat, hit.lng);
    else return;
  }
  const pt = map.latLngToContainerPoint(lastAnchor);
  const vw = window.innerWidth, vh = window.innerHeight;
  svg.setAttribute("width", vw);
  svg.setAttribute("height", vh);
  svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  const RING = RM_MOTION ? "" :
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>` +
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>` +
    `<circle class="lx-ring" cx="${pt.x}" cy="${pt.y}" r="6"/>`;
  svg.innerHTML = `<circle class="lx-dot" cx="${pt.x}" cy="${pt.y}" r="4"/>` + RING;

  const tCo = I18N[currentLang] || I18N.zh;
  const lvlText = levelLabel(tag);
  // 数值：町丁用该町丁千人率，区市用全区千人率；无人口地块显示 —
  let capRate = null;
  if (tag === "ward") {
    const w0 = MUNI.find(x => x.ward === name);
    if (w0) capRate = rateOf(w0);
  } else {
    const hit0 = POLY.features.find(x => x.properties && x.properties.name === name);
    if (hit0) capRate = chomeRateOf(hit0.properties);
  }
  const capRateText = capRate != null ? capRate.toFixed(1) : "—";
  cap.dataset.lvlKey = tag;
  cap.dataset.placeName = name;
  cap.innerHTML = `<span class="lx-lvl">${lvlText}</span>` +
    `<span class="lx-name">${name}</span>` +
    `<span class="lx-num"><span class="lx-val">${capRateText}</span>` +
    `<span class="lx-unit">${tCo.unitRate}</span></span>`;
  cap.setAttribute("role", "status");
  const sep = currentLang === 'en' ? ': ' : '：';
  const sp = currentLang === 'en' ? ' ' : '';
  cap.setAttribute("aria-label", `${tCo.calloutSelected}${sp}${lvlText}${sep}${name}${sep}${capRateText} ${tCo.unitRate}`);
  placeCapsule(pt);
  cap.classList.remove("on");
  if (RM_MOTION) { cap.classList.add("on"); return; }
  void cap.offsetWidth;
  // 三环长脉冲：半径 6 → 108，单圈 2s，错相 0.62s，共 3 圈
  svg.querySelectorAll(".lx-ring").forEach((c, i) => {
    c.animate(
      [{ opacity: 0.85, r: 6 }, { opacity: 0, r: 108 }],
      { duration: 2000, delay: i * 620, iterations: 3, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }
    );
  });
  requestAnimationFrame(() => cap.classList.add("on"));
}
// 地图视野变化时标注跟随
function refreshCallout() {
  const svg = $el("crm-lx-svg");
  const cap = $el("crm-lx-capsule");
  if (!svg || !cap || !lastAnchor || !map) return;
  if (!cap.classList.contains("on")) return;
  const pt = map.latLngToContainerPoint(lastAnchor);
  svg.querySelectorAll("circle").forEach(c => {
    c.setAttribute("cx", pt.x); c.setAttribute("cy", pt.y);
  });
  placeCapsule(pt);
}

// 窄屏贴边时把气泡夹回视口（旧实现整块出屏，390 宽实测左右各裁 119px）
function placeCapsule(pt) {
  const cap = $el("crm-lx-capsule");
  if (!cap) return;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const half = (cap.offsetWidth || 240) / 2;
  const x = Math.max(half + 8, Math.min(vw - half - 8, pt.x));
  cap.style.left = x + "px";
  cap.style.top = (pt.y - CAPSULE_LIFT) + "px";
}
let lastAnchor = null;
const CAPSULE_LIFT = 84; // 胶囊底部距锚点的像素（避让鼠标：约两倍脉冲半径）
const RM_MOTION = (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);

// =====================================================================
// 8. 核心数据管线
// =====================================================================
const CF = { total: "t", nb: "nb", bi: "bi", r: "r", v: "v", o: "o" };
const CF_R8 = { total: "r8", nb: "r8nb", bi: "r8bi", r: "r8r", v: "r8v", o: "r8o" };
const MLABEL = { ...(I18N[currentLang] || I18N.zh).metrics };

let map = null, muniLayer = null, chomeLayer = null, labelLayer = null, parentBoundaryLayer = null;
let userNavigated = false; // 用户已主动点选：延迟的首次 fit 不要再把视角拽回全局
let zoomSliderRender = null;
let curSelected = null;
let chomeByName = new Map();
let selChomeEl = null;
// 程序化飞入期间隐藏选中描边：canvas 在缩放动画里被整体缩放，描边会跟着放大成粗块
let flying = false;
let PTS = [], POLY, MUNI_POLY, MUNI;
let curMetric = "total", curT = "R7", selWard = null;
let mode = "chome";
let SCALES = {};

function rateOf(w) {
  if (!w || w.nodata || !w.pop) return null;
  const c = curT === "R7" ? w.R7 : w.R8cum;
  if (!c) return null;
  const count = curT === "R7" ? c[curMetric] : (c[CF_R8[curMetric]] ?? c[curMetric]);
  return (count / w.pop) * 1000;
}

function buildScales() {
  const cfg = VARIANTS[currentVariant];
  SCALES = {};
  const useMuni = mode === "muni";
  const tKey = curT === "R7" ? "R7" : "R8cum";
  for (const m of Object.keys(CF)) {
    // 分布口径必须与当前图层一致：区市模式只用 62 个区市，町丁模式只用 5,234 个町丁，
    // 且只取当前选中年份。此前把两级 + 两个年份混进同一个数组，中位数被打偏到 3.8‰（真实 4.5‰）。
    const vals = [];
    const col = CF[m], colR8 = CF_R8[m];
    if (useMuni) {
      if (MUNI) {
        for (const w of MUNI) {
          if (w.nodata || !w.pop) continue;
          const v = w[tKey]?.[m];
          if (v != null) vals.push((v / w.pop) * 1000);
        }
      }
    } else if (POLY) {
      const fld = curT === "R7" ? col : colR8;
      for (const f of POLY.features) {
        const pr = f.properties;
        if (!pr || !pr.pop || pr.pop < 200) continue;
        const v = pr[fld];
        if (v != null) vals.push((v / pr.pop) * 1000);
      }
    }
    vals.sort((a, b) => a - b);
    if (!vals.length) continue;

    const q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    const hi = q(0.99);
    const nz = vals.filter(v => v > 0);
    const zero = (1 - nz.length / vals.length) >= 0.35;
    const L1 = Math.log1p(hi);
    let breaks = [];
    if (zero) {
      const L0 = Math.log1p(nz[0] || 0.01);
      breaks = [0];
      for (let k = 1; k < 7; k++) breaks.push(Math.expm1(L0 + (L1 - L0) * k / 7));
      breaks.push(hi);
    } else {
      const L0 = Math.log1p(vals[0]);
      for (let k = 1; k < 8; k++) breaks.push(Math.expm1(L0 + (L1 - L0) * k / 8));
      breaks.push(hi);
    }
    for (let i = 1; i < breaks.length; i++) {
      if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1e-6;
    }
    const curRamp = (COLOR_RAMPS[currentAccent] || COLOR_RAMPS.vermilion)[currentVariant];
    SCALES[m] = {
      breaks, hi, zero, vals,
      ramp: [...curRamp]
    };
  }
}

function colorForScale(r, S) {
  if (r == null || !S) return VARIANTS[currentVariant].nodata;
  if (r <= 0 && S.zero) return S.ramp[0];
  const b = S.breaks;
  for (let i = 0; i < b.length; i++) {
    if (r <= b[i]) return S.ramp[i];
  }
  return S.ramp[8];
}

function colorForChome(r) {
  if (r == null) return VARIANTS[currentVariant].nopop;
  return colorForScale(r, SCALES[curMetric]);
}

function colorForRate(r) {
  if (r == null) return VARIANTS[currentVariant].nodata;
  return colorForScale(r, SCALES[curMetric]);
}

function chomeRateOf(pr) {
  if (!pr || !pr.pop || pr.pop < 200) return null;
  const fld = curT === "R7" ? CF[curMetric] : CF_R8[curMetric];
  return (pr[fld] / pr.pop) * 1000;
}

// =====================================================================
// 9. 态势分布仪更新
// =====================================================================
function updateHistogram() {
  const S = SCALES[curMetric];
  if (!S || !S.vals.length) return;

  const vals = S.vals;
  const nBins = 28;
  const maxV = S.hi * 1.05;
  const minV = 0;
  const binWidth = maxV / nBins;
  const counts = new Array(nBins).fill(0);

  for (const v of vals) {
    if (v >= maxV) counts[nBins - 1]++;
    else {
      const idx = Math.floor((v - minV) / binWidth);
      counts[Math.max(0, Math.min(nBins - 1, idx))]++;
    }
  }

  const maxCount = Math.max(...counts);
  const svgW = 332, svgH = 22;
  const barW = svgW / nBins;

  let barsHtml = "";
  for (let i = 0; i < nBins; i++) {
    const h = (counts[i] / maxCount) * (svgH - 2);
    const x = i * barW;
    const y = svgH - h;
    barsHtml += `<rect class="hist-bar" x="${x + 0.5}" y="${y}" width="${barW - 1}" height="${h}" rx="1"/>`;
  }
  { const __e = $el("crm-hist-svg"); if (__e) __e.innerHTML = barsHtml;
 }

  const t = I18N[currentLang] || I18N.zh;
  { const __e = $el("crm-inst-title"); if (__e) __e.textContent = `${MLABEL[curMetric]} · ${t.instTitle}`;
 }
  const med = S.vals[Math.floor(S.vals.length * 0.5)].toFixed(1);
  { const __e = $el("crm-inst-readout"); if (__e) __e.textContent = `${t.instMedian}: ${med} ${t.unitRate}`;
 }
}

function moveHistCursor(val, label) {
  const t = I18N[currentLang] || I18N.zh;
  const cursor = $el("crm-hist-cursor"); if (!cursor) return;
  const S = SCALES[curMetric];
  if (val == null || !S) {
    cursor.style.opacity = "0";
    return;
  }
  const maxV = S.hi * 1.05;
  const pct = Math.max(0, Math.min(100, (val / maxV) * 100));
  cursor.style.left = pct + "%";
  cursor.style.opacity = "1";

  { const __e = $el("crm-inst-readout"); if (__e) __e.textContent = `${label || ''} · ${val.toFixed(1)} ${t.unitRate}`;
 }
}

function hideHistCursor() {
  const t = I18N[currentLang] || I18N.zh;
  { const __e = $el("crm-hist-cursor"); if (__e) __e.style.opacity = "0";
 }
  const S = SCALES[curMetric];
  if (S && S.vals.length) {
    const med = S.vals[Math.floor(S.vals.length * 0.5)].toFixed(1);
    { const __e = $el("crm-inst-readout"); if (__e) __e.textContent = `${t.instMedian}: ${med} ${t.unitRate}`;
 }
  }
}

function updateLegendBar() {
  const t = I18N[currentLang] || I18N.zh;
  const S = SCALES[curMetric];
  if (!S) return;
  const barDiv = $el("crm-legendBarDiv"); if (!barDiv) return;
  barDiv.innerHTML = S.ramp.map(c => `<div style="background:${c}"></div>`).join("");

  const b = S.breaks;
  const tickVals = [b[0], b[1], b[3], b[5], b[7]];
  const ticksDiv = $el("crm-legendTicks"); if (!ticksDiv) return;
  ticksDiv.innerHTML = `
    <span>${tickVals[0] === 0 ? "0" : tickVals[0].toFixed(1)}</span>
    <span>${tickVals[1].toFixed(1)}</span>
    <span>${tickVals[2].toFixed(1)}</span>
    <span>${tickVals[3].toFixed(1)}</span>
    <span>≥${Math.round(S.hi)} ${t.instMax}</span>
  `;
}

// =====================================================================
// 10. 右侧数据卡：町丁卡 + 区市卡（选中地块时两张卡同时呈现）
// =====================================================================
function crimeRowsHtml(o) {
  const t = I18N[currentLang] || I18N.zh;
  const cats = [
    { k: "total", n: t.metrics.total, v: o.total },
    { k: "nb", n: t.metrics.nb, v: o.nb },
    { k: "bi", n: t.metrics.bi, v: o.bi },
    { k: "r", n: t.metrics.r, v: o.r },
    { k: "v", n: t.metrics.v, v: o.v },
    { k: "o", n: t.metrics.o, v: o.o }
  ];
  const maxV = Math.max(...cats.map(c => c.v || 0), 1);
  return cats.map(c => {
    const pct = Math.round(((c.v || 0) / maxV) * 100);
    const isAct = c.k === curMetric ? "active" : "";
    return `
      <div class="crime-row ${isAct}">
        <span class="crime-label">${c.n}</span>
        <div class="crime-bar-wrap"><div class="crime-bar-fill" style="width:${pct}%"></div></div>
        <span class="crime-count">${(c.v ?? 0).toLocaleString()}${t.casesUnit ? ' ' + t.casesUnit : ''}</span>
      </div>`;
  }).join("");
}

// 町丁属性 → 当前期间六罪种件数
function chomeCounts(p) {
  return curT === "R7"
    ? { total: p.t, nb: p.nb, bi: p.bi, r: p.r, v: p.v, o: p.o }
    : { total: p.r8, nb: p.r8nb, bi: p.r8bi, r: p.r8r, v: p.r8v, o: p.r8o };
}

// 区市数据 → 当前期间六罪种件数
function wardCounts(w) {
  const R = curT === "R7" ? w.R7 : w.R8cum;
  if (!R) return { total: 0, nb: 0, bi: 0, r: 0, v: 0, o: 0 };
  return { total: R.total, nb: R.nonbreakin, bi: R.breakin, r: R.rough, v: R.violent, o: R.other };
}

function chomeCardBodyHtml(f) {
  const t = I18N[currentLang] || I18N.zh;
  const p = f.properties;
  const rate = chomeRateOf(p);
  const cnt = chomeCounts(p);
  const S = SCALES[curMetric];
  let badgeHtml = "";
  if (rate != null && S) {
    const vals = S.vals;
    let rankIdx = 0;
    while (rankIdx < vals.length && vals[rankIdx] <= rate) rankIdx++;
    const topPct = +(100 - (rankIdx / vals.length) * 100).toFixed(1);
    if (topPct <= 5) badgeHtml = `<span class="rank-badge danger">Top ${topPct}% ${t.rankExtreme}</span>`;
    else if (topPct <= 20) badgeHtml = `<span class="rank-badge danger">Top ${topPct}% ${t.rankHigh}</span>`;
    else badgeHtml = `<span class="rank-badge neutral">${t.rankNormal}</span>`;
  }
  const nogeo = f.geometry ? "" : `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:6px">${t.noGeoNotice}</div>`;
  return `
    <span class="card-level lv-chome">${t.levelChome}</span>
    <div class="card-head">
      <div>
        <h2>${p.name}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${p.ward || ""} · ${t.popLabel} ${p.pop ? p.pop.toLocaleString() : t.popMissing}</div>
      </div>
      ${badgeHtml}
    </div>
    ${nogeo}
    <div class="metric-grid-2col">
      <div class="mg-col">
        <div class="mg-val big-val">${rate != null ? rate.toFixed(1) : "—"}</div>
        <div class="mg-lbl">${t.unitRate} (${curT === 'R7' ? t.times.R7 : t.times.R8})</div>
      </div>
      <div class="mg-col">
        <div class="mg-val">${cnt.total != null ? cnt.total.toLocaleString() : "0"}</div>
        <div class="mg-lbl">${MLABEL[curMetric]} ${t.reportedCases}</div>
      </div>
    </div>
    <div class="breakdown-section">
      <div class="section-title">${t.breakdownTitle}</div>
      ${crimeRowsHtml(cnt)}
    </div>
    <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
      <button data-crm-ward="${p.ward}" style="background:var(--bg-card-sub);border:1px solid var(--line-main);color:var(--text-main);padding:4px 8px;border-radius:var(--radius-inner);font-size:12px;cursor:pointer;font-weight:350">
        ${t.backTo} ${p.ward}
      </button>
      <span style="font-size:11px;color:var(--text-faint);font-family:var(--font-num)">KEISHICHO</span>
    </div>`;
}

function wardCardBodyHtml(name) {
  const t = I18N[currentLang] || I18N.zh;
  const w = MUNI.find(x => x.ward === name);
  if (!w) return "";
  const rate = rateOf(w);
  const cnt = wardCounts(w);
  const chomesInWard = POLY ? POLY.features.filter(f => f.properties && f.properties.ward === name) : [];
  chomesInWard.sort((a, b) => (chomeRateOf(b.properties) || 0) - (chomeRateOf(a.properties) || 0));
  const topsHtml = chomesInWard.slice(0, 5).map(f => {
    const pr = f.properties;
    const r = chomeRateOf(pr);
    return `<div class="top-item" data-crm-chome="${pr.name}"><span class="tname">${pr.name}</span><span class="trate">${r != null ? r.toFixed(1) : "—"} ‰</span></div>`;
  }).join("");
  return `
    <span class="card-level lv-ward">${t.levelWard}</span>
    <div class="card-head">
      <div>
        <h2>${w.ward}</h2>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${w.area || t.areaFallback} · ${t.popLabel} ${w.pop ? w.pop.toLocaleString() : t.popMissing}</div>
      </div>
      <span class="rank-badge neutral">${t.wardBenchmark}</span>
    </div>
    <div class="metric-grid-2col">
      <div class="mg-col">
        <div class="mg-val big-val">${rate != null ? rate.toFixed(1) : "—"}</div>
        <div class="mg-lbl">${t.wardRate} (${curT === 'R7' ? t.times.R7 : t.times.R8})</div>
      </div>
      <div class="mg-col">
        <div class="mg-val">${cnt.total != null ? cnt.total.toLocaleString() : "0"}</div>
        <div class="mg-lbl">${t.wardTotalCases}</div>
      </div>
    </div>
    <div class="breakdown-section">
      <div class="section-title">${t.breakdownTitle}</div>
      ${crimeRowsHtml(cnt)}
    </div>
    <div class="tops-box">
      <div class="section-title">${t.top5ChomeTitle}</div>
      ${topsHtml || `<div style="font-size:12px;color:var(--text-muted)">${t.noChomeData}</div>`}
    </div>`;
}

function allTokyoTop5Html() {
  const t = I18N[currentLang] || I18N.zh;
  const list = MUNI.map(w => {
    const r = rateOf(w) || 0;
    const cnt = wardCounts(w);
    return { ward: w.ward, rate: r, total: cnt.total || 0 };
  });
  list.sort((a, b) => b.rate - a.rate);
  const top5 = list.slice(0, 5);
  const maxR = top5[0]?.rate || 1;
  return `
    <div class="panel-card" id="crm-card-ranking">
      <div class="card-head" style="margin-bottom:4px">
        <div style="font-size:13px;font-weight:var(--fw-mid);color:var(--text-main)">${t.top5WardTitle}</div>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-num)">${t.byRateDesc}</span>
      </div>
      <div class="rank-card-list">
        ${top5.map((item, idx) => {
          const pct = Math.min(100, Math.round((item.rate / maxR) * 100));
          return `
            <div class="rank-card-item" data-crm-ward="${item.ward}" title="${t.backTo} ${item.ward}">
              <span class="rci-idx">0${idx + 1}</span>
              <span class="rci-name">${item.ward}</span>
              <div class="rci-bar-wrap"><div class="rci-bar-fill" style="width:${pct}%"></div></div>
              <span class="rci-val">${item.rate.toFixed(1)} ‰</span>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function metaFooterCardHtml() {
  const t = I18N[currentLang] || I18N.zh;
  const faqHtml = (t.faq || []).map(item => `
      <details class="faq-item">
        <summary>${item.q}</summary>
        <div class="faq-a">${item.a}</div>
      </details>`).join("");
  return `
    <div class="panel-card" id="crm-card-meta" style="padding:12px 14px;background:var(--surface);border:0;box-shadow:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:var(--fw-mid);color:var(--text-main);letter-spacing:0.5px">${t.metaTitle}</span>
        <span style="font-size:11px;color:var(--text-faint);font-family:var(--font-num)">NPA / CC BY 4.0</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);line-height:1.4">
        ${t.metaL1}<br>
        ${t.metaL2}
      </div>
      <div class="faq-block">
        <div class="faq-head">
          <span class="faq-title">${t.faqTitle}</span>
          <span class="faq-sub">${t.faqSub}</span>
        </div>
        ${faqHtml}
      </div>
      <div class="faq-source">${t.siteBy} · <a href="../" style="color:var(--accent)">japan.ouuut.com</a> · <a href="../quake/" style="color:var(--accent)">${t.navQuake || "quake"}</a> · <a href="../cabinet/" style="color:var(--accent)">${t.navCabinet || "cabinet"}</a></div>
    </div>`;
}

function updateHudCapsule(placeName, metricText) {
  const t = I18N[currentLang] || I18N.zh;
  const dEl = $el("crm-hud-dataset");
  const pEl = $el("crm-hud-place");
  const mEl = $el("crm-hud-metric");
  if (!dEl || !pEl || !mEl) return;
  dEl.textContent = curT === "R7" ? t.times.R7 : t.times.R8;
  if (placeName) pEl.textContent = placeName;
  if (metricText) mEl.textContent = metricText;
  else mEl.textContent = MLABEL[curMetric];
}

function renderChomeCard(f) {
  curSelected = f; try { window.__panoutCrimeSelected = f; } catch (e) {}
  syncChomeSel();
  const p = f.properties;
  const rate = chomeRateOf(p);

  if (rate != null) moveHistCursor(rate, p.name);
  updateHudCapsule(p.name, `${rate != null ? rate.toFixed(1) + ' ‰' : '—'} (${MLABEL[curMetric]})`);

  $el("crm-card").innerHTML =
    `<div class="panel-card">${chomeCardBodyHtml(f)}</div>` +
    `<div class="panel-card">${wardCardBodyHtml(p.ward)}</div>` +
    allTokyoTop5Html() +
    metaFooterCardHtml();
}

function renderWardCard(name) {
  curSelected = name; try { window.__panoutCrimeSelected = name; } catch (e) {}
  const w = MUNI.find(x => x.ward === name);
  if (!w) return;
  const rate = rateOf(w);
  if (rate != null) moveHistCursor(rate, name);
  updateHudCapsule(name, `${rate != null ? rate.toFixed(1) + ' ‰' : '—'} (${MLABEL[curMetric]})`);

  $el("crm-card").innerHTML =
    `<div class="panel-card">${wardCardBodyHtml(name)}</div>` +
    allTokyoTop5Html() +
    metaFooterCardHtml();
}

// =====================================================================
// 11. 地图初始化与 23 区全局聚焦 (东京都右侧正中央居中)
// =====================================================================
// 东京 23 区外接矩形范围 (东侧核心区)
const TOKYO_23_BOUNDS = [[35.53, 139.56], [35.83, 139.92]];

function fitTokyo23() {
  const t = I18N[currentLang] || I18N.zh;
  const vw = window.innerWidth;
  const hh = 0;
  // 桌面：给顶栏与右侧卡片留出 padding；手机：卡片在底部，左右只留 8px
  const pad = vw > 900
    ? { paddingTopLeft: [64, hh + 16], paddingBottomRight: [($el("crm-card").offsetWidth || 310) + 28, 24] }
    : { paddingTopLeft: [8, hh + 8], paddingBottomRight: [8, Math.round(window.innerHeight * 0.42)] };
  map.fitBounds(TOKYO_23_BOUNDS, { ...pad, animate: false });
  updateHudCapsule(t.hudWholeTokyo, `62 ${t.levelWard} · ${MLABEL[curMetric]}`);
}

// 环的面积加权几何质心 (避免顶点密度不均导致偏移)
function ringCentroid(ring) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0], y0 = ring[i][1];
    const x1 = ring[i + 1][0], y1 = ring[i + 1][1];
    const a = x0 * y1 - x1 * y0;
    area += a; cx += (x0 + x1) * a; cy += (y0 + y1) * a;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) return null;
  return [cy / (6 * area), cx / (6 * area)]; // [lat, lng]
}

// 取最大外环质心 (岛屿/飞地不会把字标拉偏)
function polyLabelPos(geom) {
  if (!geom) return null;
  let rings = [];
  if (geom.type === "Polygon") rings = geom.coordinates;
  else if (geom.type === "MultiPolygon") rings = geom.coordinates.map(p => p[0]);
  let best = null, bestArea = 0;
  for (const ring of rings) {
    if (!ring || ring.length < 4) continue;
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    a = Math.abs(a / 2);
    if (a > bestArea) { bestArea = a; best = ring; }
  }
  return best ? ringCentroid(best) : null;
}

// 注记由 MUNI_POLY 动态计算质心生成，覆盖全部 23 区 + 多摩 26 市 + 町村

function initMap() {
  const cfg = VARIANTS[currentVariant];
  map = L.map("crm-map", {
    zoomControl: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5
  }).setView([35.685, 139.75], 11);
  // 挂载国土地理院纯净白图（日本官方权威开放数据，纯净海岸线与水系轮廓，零微观杂字）
  baseTileLayer = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png", {
    maxZoom: 18,
    maxNativeZoom: 14,
    attribution: "© 国土地理院"
  }).addTo(map);

  // 紧凑型公制比例尺 (紧贴左下角分布仪上方)
  // 比例尺挪到左上工具条下方：左下角被图例面板整块盖住，右下角被卡片盖住
  L.control.scale({ imperial: false, position: "topleft" }).addTo(map);

  muniLayer = L.geoJSON(MUNI_POLY, {
    style: f => {
      const cfg = VARIANTS[currentVariant];
      const w = MUNI.find(x => x.ward === f.properties.ward_ja);
      const r = rateOf(w);
      const isSel = selWard === f.properties.ward_ja;
      return {
        color: isSel ? cfg.selLine : cfg.lineColor,
        weight: isSel ? (flying ? 0 : 2) : 1,
        fillColor: colorForRate(r),
        fillOpacity: isSel ? 0.95 : 0.85
      };
    },
    onEachFeature: (f, layer) => {
      layer.on("mouseover", () => {
        const w = MUNI.find(x => x.ward === f.properties.ward_ja);
        const r = rateOf(w);
        if (r != null) moveHistCursor(r, f.properties.ward_ja);
      });
      layer.on("mouseout", () => {
        if (!curSelected) hideHistCursor();
      });
      layer.on("click", (e) => {
        selWard = f.properties.ward_ja;
        renderWardCard(selWard);
        muniLayer.setStyle(muniLayer.options.style);
        lastAnchor = e.latlng;
        showToast(f.properties.ward_ja, "ward");
        flyToFeature(layer, 11.75);
      });
    }
  });

  chomeLayer = L.geoJSON(POLY, {
    // 5,234 条路径，按屏幕像素做几何简化：缩放时栅格化量显著下降，肉眼看不出差别
    smoothFactor: 2.2,
    // 选中态不再走 setStyle（5,198 条路径全量重绘 ≈65ms），改用 CSS 类：.crm-dim 压暗、.is-sel 提亮描边
    style: f => {
      const r = chomeRateOf(f.properties);
      return {
        color: currentVariant === "tactical" ? "rgba(255,244,232,0.12)" : "rgba(24,22,20,0.12)",
        weight: 0.6,
        fillColor: colorForChome(r),
        fillOpacity: 0.88,
        className: "crm-chome"
      };
    },
    onEachFeature: (f, layer) => {
      chomeByName.set(f.properties.name, layer);
      layer.on("mouseover", () => {
        const r = chomeRateOf(f.properties);
        if (r != null) moveHistCursor(r, f.properties.name);
      });
      layer.on("mouseout", () => {
        if (!curSelected) hideHistCursor();
      });
      layer.on("click", (e) => {
        renderChomeCard(f);
        highlightParentBoundary(f.properties.ward);
        lastAnchor = e.latlng;
        showToast(f.properties.name, "chome");
        flyToFeature(layer, 13.5);
      });
    }
  });

  // 渲染自带柔和地标注记层：动态覆盖全部区/市/町/村 (免外部瓦片，随主题自适应)
  labelLayer = L.layerGroup();
  for (const f of MUNI_POLY.features) {
    const nm = f.properties.ward_ja;
    if (!nm || nm === "所属未定地") continue;
    const pos = polyLabelPos(f.geometry);
    if (!pos) continue;
    const icon = L.divIcon({
      className: "map-ward-label",
      html: `<span>${nm}</span>`,
      iconSize: [80, 20],
      iconAnchor: [40, 10]
    });
    L.marker(pos, { icon, interactive: false }).addTo(labelLayer);
  }
  labelLayer.addTo(map);
  // 底图在 z13 以上自己印区名，再叠我们的标签就会重影
  const gateLabels = () => { try { const z = map.getZoom(); const want = z >= 10 && z < 13;
      if (want && !map.hasLayer(labelLayer)) labelLayer.addTo(map);
      else if (!want && map.hasLayer(labelLayer)) map.removeLayer(labelLayer); } catch (e) {} };
  map.on("zoomend", gateLabels); gateLabels();

  applyMode();
  fitTokyo23(); // 首次聚焦东京 23 区全局正中
}

// 高亮选中地块所属的整个区/市外轮廓
function highlightParentBoundary(wardName) {
  if (parentBoundaryLayer) { map.removeLayer(parentBoundaryLayer); parentBoundaryLayer = null; }
  if (!wardName) return;
  const feat = MUNI_POLY.features.find(f => f.properties.ward_ja === wardName);
  if (!feat) return;
  const stroke = getComputedStyle(rootEl||document.documentElement).getPropertyValue("--accent").trim() || "#CD5545";
  parentBoundaryLayer = L.geoJSON(feat, {
    style: {
      color: stroke, weight: 3, fill: true, fillColor: stroke,
      fillOpacity: 0.08, opacity: 0.98, lineJoin: "round",
      className: "sel-parent-glow"
    },
    interactive: false
  }).addTo(map);
}

// 点击区域后平滑飞到该区域：留出右侧卡片/底部抽屉的余量，缩放到刚好装下
function syncChomeSel() {
  const f = curSelected && curSelected.properties ? curSelected : null;
  const layer = f ? chomeByName.get(f.properties.name) : null;
  const el = layer && layer.getElement ? layer.getElement() : null;
  if (selChomeEl && selChomeEl !== el) selChomeEl.classList.remove("is-sel");
  if (el) {
    el.classList.add("is-sel");
    const g = el.parentNode;
    if (g && g.classList) g.classList.add("crm-dim");
  } else if (selChomeEl && selChomeEl.parentNode) {
    selChomeEl.parentNode.classList.remove("crm-dim");
  }
  selChomeEl = el || null;
}

function restyleSel() {
  if (muniLayer) muniLayer.setStyle(muniLayer.options.style);
  if (parentBoundaryLayer && parentBoundaryLayer.setStyle) parentBoundaryLayer.setStyle({ weight: flying ? 0 : 3 });
  const g = selChomeEl && selChomeEl.parentNode;
  if (g && g.classList) g.classList.toggle("crm-flying", flying);
}
function endFly() { if (!flying) return; flying = false; restyleSel(); }
function beginFly() {
  if (flying) return;
  flying = true;
  restyleSel();
  map.once("moveend", endFly);
  setTimeout(endFly, 1400);
}
function flyToFeature(layer, maxZoom) {
  if (!map || !layer || !layer.getBounds) return;
  userNavigated = true;
  // 飞入期间先撤掉选中描边（缩放动画会把描边放大成粗块），落定再补回
  beginFly();
  let b = null;
  try { b = layer.getBounds(); } catch (e) { return; }
  if (!b || (b.isValid && !b.isValid())) return;
  const size = map.getSize();
  const desktop = size.x >= 900;
  const opts = {
    paddingTopLeft: desktop ? [56, 84] : [20, 84],
    paddingBottomRight: desktop ? [404, 56] : [20, Math.round(size.y * 0.46)],
    maxZoom: desktop ? maxZoom : Math.max(9, maxZoom - 1),
    animate: true,
    duration: 0.65,
    easeLinearity: 0.45,
  };
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  const go = () => { if (reduce) map.fitBounds(b, opts); else map.flyToBounds(b, opts); };
  requestAnimationFrame(() => requestAnimationFrame(go));
}

// 左侧竖向缩放拖动条：拖动/点击定位，橙色填充，双向同步地图缩放
const ZMIN = 9, ZMAX = 18;
let zsDragging = false;
function initZoomSlider() {
  const track = $el("crm-zsTrack"); if (!track) return;
  const fill = $el("crm-zsFill");
  const thumb = $el("crm-zsThumb"); if (!fill || !thumb) return;
  const clamp = v => Math.max(0, Math.min(1, v));
  const frac = () => clamp((map.getZoom() - ZMIN) / (ZMAX - ZMIN));

  const render = () => {
    const f = frac();
    fill.style.height = (f * 100) + "%";
    thumb.style.bottom = (f * 100) + "%";
  };
  const fromY = clientY => {
    const r = track.getBoundingClientRect();
    return clamp(1 - (clientY - r.top) / r.height);
  };
  const applyFrac = f => map.setZoom(ZMIN + f * (ZMAX - ZMIN), { animate: false });

  track.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    track.setPointerCapture(e.pointerId);
    zsDragging = true;
    applyFrac(fromY(e.clientY)); render();
  });
  track.addEventListener("pointermove", e => {
    if (!zsDragging) return;
    e.preventDefault();
    applyFrac(fromY(e.clientY)); render();
  });
  const stop = e => {
    zsDragging = false;
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  track.addEventListener("pointerup", stop);
  track.addEventListener("pointercancel", stop);

  { const __e = $el("crm-zsPlus"); if (__e) __e.addEventListener("click", () => map.zoomIn());
 }
  { const __e = $el("crm-zsMinus"); if (__e) __e.addEventListener("click", () => map.zoomOut());
 }

  map.on("zoom zoomend", render);
  zoomSliderRender = render; try { window.__panoutCrimeZoomRender = render; } catch (e) {}
  render();
}

function applyMode() {
  if (mode === "muni") {
    if (map.hasLayer(chomeLayer)) map.removeLayer(chomeLayer);
    if (!map.hasLayer(muniLayer)) map.addLayer(muniLayer);
  } else {
    if (map.hasLayer(muniLayer)) map.removeLayer(muniLayer);
    if (!map.hasLayer(chomeLayer)) map.addLayer(chomeLayer);
  }
  // 图层重建后选中态可能已经不属于当前粒度：地图、卡片、气泡必须一起清
  const incompatible = (mode === "muni" && curSelected && typeof curSelected === "object")
    || (mode === "chome" && typeof curSelected === "string");
  if (incompatible) {
    curSelected = null;
    try { window.__panoutCrimeSelected = null; } catch (e) {}
    selChomeEl = null;
    const cap = $el("crm-lx-capsule");
    if (cap) cap.classList.remove("on");
    const card = $el("crm-card");
    if (card) card.innerHTML = allTokyoTop5Html() + metaFooterCardHtml();
  }
  // 图层被移除/重建后 path 元素会换新，选中类要重新挂一次
  syncChomeSel();
}

function selectChomeByName(name, shouldFly = false, silent = false) {
  const f = POLY.features.find(x => x.properties && x.properties.name === name);
  if (!f) return;
  mode = "chome";
  $qa("[data-crm-mode]").forEach(b => {
    b.classList.toggle("on", b.getAttribute("data-crm-mode") === "chome");
  });
  syncCrmDd("mode", (I18N[currentLang] || I18N.zh).modes.chome);
  applyMode();
  renderChomeCard(f);
  syncChomeSel();
  highlightParentBoundary(f.properties.ward);
  if (!silent && !shouldFly) showToast(name, "chome");

  // 初始载入：把选中点直接放到整个视口正中央
  if (name === "新宿区歌舞伎町2丁目" && silent && !shouldFly) {
    const pt0 = PTS.find(p => p.n === name);
    if (pt0 && pt0.lat) map.setView([pt0.lat, pt0.lng], map.getZoom(), { animate: false });
  }

  // 仅在明确搜索或点击时飞入（窄屏禁用：视口太小，飞入即丢失上下文）
  if (shouldFly && window.innerWidth > 900) {
    const pt = PTS.find(p => p.n === name);
    if (pt && pt.lat) {
      beginFly();
      map.setView([pt.lat, pt.lng], 13.5, { animate: true });
      map.once("moveend", () => { lastAnchor = L.latLng(pt.lat, pt.lng); showToast(name, "chome"); });
    } else if (f.geometry) {
      map.fitBounds(L.geoJSON(f).getBounds(), { padding: [50, 50] });
    }
  }
}

function selectWardByName(name) {
  mode = "muni";
  selWard = name;
  if (parentBoundaryLayer) { map.removeLayer(parentBoundaryLayer); parentBoundaryLayer = null; }
  $qa("[data-crm-mode]").forEach(b => {
    b.classList.toggle("on", b.getAttribute("data-crm-mode") === "muni");
  });
  syncCrmDd("mode", (I18N[currentLang] || I18N.zh).modes.muni);
  applyMode();
  renderWardCard(name);
  muniLayer.setStyle(muniLayer.options.style);
  const feat = MUNI_POLY.features.find(f => f.properties.ward_ja === name);
  if (feat) {
    const g = L.geoJSON(feat);
    lastAnchor = g.getBounds().getCenter();
  } else lastAnchor = map.getCenter();
  showToast(name, "ward");
}

// =====================================================================


/* ---- shell adapter (hand-written for single-page mount) ---- */
// 本地优先：CDN 只当兜底。此前只挂 CDN，离线/被墙时整页停在加载器上。
const CRM_LEAFLET_JS = ['/app/crime/vendor/leaflet.js', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const CRM_LEAFLET_CSS = ['/app/crime/vendor/leaflet.css', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];
const CRM_DATA_BASES = ['./app/crime/data/', '/app/crime/data/', '../app/crime/data/'];
let crmForcedBase = null; // shell opts.base wins
const CRM_DATA_FILES = ['points.json', 'muni_poly.json', 'chome_poly.json', 'muni.json'];
const CRM_THEME_MAP = { mono: 'editorial', sage: 'editorial', dark: 'tactical', editorial: 'editorial', tactical: 'tactical' };
let L = null;
let rootEl = null, controlsRoot = null, searchInputEl = null;
let docClickBound = false;
let mounted = false, bootSeq = 0, aborter = null;
function $el(id) { try { const s = '#' + id; const a = controlsRoot && controlsRoot.querySelector ? controlsRoot.querySelector(s) : null; if (a) return a; const b = rootEl && rootEl.querySelector ? rootEl.querySelector(s) : null; if (b) return b; if (typeof document !== 'undefined' && document.querySelector) return document.querySelector(s); } catch (e) {} return null; }
function $q(sel) { try { const a = controlsRoot && controlsRoot.querySelector ? controlsRoot.querySelector(sel) : null; if (a) return a; const b = rootEl && rootEl.querySelector ? rootEl.querySelector(sel) : null; if (b) return b; if (typeof document !== 'undefined' && document.querySelector) return document.querySelector(sel); } catch (e) {} return null; }
function $qa(sel) { const out = []; try { const rs = [controlsRoot, rootEl, (typeof document !== 'undefined' ? document : null)]; for (const r of rs) { if (!r || !r.querySelectorAll) continue; r.querySelectorAll(sel).forEach(e => { if (out.indexOf(e) < 0) out.push(e); }); } } catch (e) {} return out; }
function ensureCrmCss() {
  if (!document.getElementById('crm-style')) {
    const st = document.createElement('style'); st.id = 'crm-style'; st.textContent = CRM_CSS + '\n' + CRM_DD_CSS; document.head.appendChild(st);
  }
}
async function loadLeaflet() {
  const ensureLeafletCss = () => {
    if (!document.getElementById('crm-leaflet-css')) {
      const lk = document.createElement('link'); lk.id = 'crm-leaflet-css'; lk.rel = 'stylesheet';
      lk.href = CRM_LEAFLET_CSS[0];
      lk.onerror = () => { lk.href = CRM_LEAFLET_CSS[1]; };
      document.head.appendChild(lk);
    }
  };
  ensureLeafletCss();
  if (globalThis.L && globalThis.L.map) return globalThis.L;
  // Leaflet 发布的是 UMD 包：用 import() 加载时模块作用域里 this 为 undefined，
  // UMD 的 global.L = {} 会直接抛错。必须用经典 <script> 注入，才会挂到 window.L。
  const inject = (url) => new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = url; el.async = true;
    el.onload = () => res();
    el.onerror = () => rej(new Error('script load failed: ' + url));
    document.head.appendChild(el);
  });
  let lastErr = null;
  for (const u of CRM_LEAFLET_JS) {
    try { await inject(u); if (globalThis.L && globalThis.L.map) return globalThis.L; }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('leaflet load failed');
}
async function fetchCrmJson(name, signal) {
  let lastErr = null;
  const bases = crmForcedBase ? [crmForcedBase + 'app/crime/data/'] : CRM_DATA_BASES;
  for (const b of bases) { try { const r = await fetch(b + name, { signal }); if (!r.ok) throw new Error(name + ' ' + r.status); return await r.json(); } catch (e) { lastErr = e; } }
  throw lastErr || new Error('fetch failed: ' + name);
}
const CRM_CARET = '<svg class="dd-caret" viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>';

function crmDd(key, current, items, attr) {
  const label = (items.find(x => x[0] === current) || items[0])[1];
  const opts = items.map(([k, n]) =>
    '<button type="button" class="crm-dd-opt' + (k === current ? ' on' : '') + '" ' + attr + '="' + k + '" role="option" aria-selected="' + (k === current) + '">' + n + '</button>').join('');
  return '<div class="crm-dd" data-dd="' + key + '">'
    + '<button type="button" class="crm-dd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="crm-dd-label">' + label + '</span>' + CRM_CARET + '</button>'
    + '<div class="crm-dd-menu" role="listbox">' + opts + '</div></div>';
}

function crimeControlsHtml(t) {
  return crmDd('metric', curMetric, Object.entries(t.metrics), 'data-crm-metric')
    + crmDd('time', curT, Object.entries(t.times), 'data-crm-t')
    + crmDd('mode', mode, Object.entries(t.modes), 'data-crm-mode')
    + (searchInputEl ? '' : '<input id="crm-q" class="crm-q" type="search" placeholder="' + (t.searchPh || '') + '" autocomplete="off">');
}

function syncCrmDd(key, label) {
  const dd = $q('.crm-dd[data-dd="' + key + '"]');
  if (!dd) return;
  const lab = dd.querySelector('.crm-dd-label');
  if (lab && label != null) lab.textContent = label;
  const cur = key === 'metric' ? curMetric : (key === 'time' ? curT : mode);
  dd.querySelectorAll('.crm-dd-opt').forEach(o => {
    const on = o.getAttribute(key === 'metric' ? 'data-crm-metric' : (key === 'time' ? 'data-crm-t' : 'data-crm-mode')) === cur;
    o.classList.toggle('on', on);
    o.setAttribute('aria-selected', String(on));
  });
}

function closeCrmDd(except) {
  $qa('.crm-dd.open').forEach(dd => {
    if (dd === except) return;
    dd.classList.remove('open');
    const b = dd.querySelector('.crm-dd-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

function onCrimeSearchInput(ev) {
  const input = ev.target; const drop = $el('crm-drop'); if (!drop) return;
  const q = (input.value || '').trim().toLowerCase();
  if (!q || !PTS || !PTS.length) { drop.style.display = 'none'; return; }
  const hits = PTS.filter(p => (p.n || '').toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) {
    const host = rootEl || document.body;
    const rr = host.getBoundingClientRect(); const ri = input.getBoundingClientRect();
    drop.style.left = (ri.left - rr.left) + 'px'; drop.style.top = (ri.bottom - rr.top + 4) + 'px'; drop.style.width = ri.width + 'px'; drop.style.display = 'block';
    drop.innerHTML = '<div class="drop-empty">' + ((I18N[currentLang] || I18N.zh).noResults || 'No match') + '</div>';
    return;
  }
  const host = rootEl || document.body;
  const rr = host.getBoundingClientRect(); const ri = input.getBoundingClientRect();
  drop.style.left = (ri.left - rr.left) + 'px'; drop.style.top = (ri.bottom - rr.top + 4) + 'px'; drop.style.width = ri.width + 'px'; drop.style.display = 'block';
  drop.innerHTML = hits.map(h => '<div data-n="' + h.n + '">' + h.n + '</div>').join('');
  drop.querySelectorAll('div').forEach(d => { d.addEventListener('click', () => { selectChomeByName(d.getAttribute('data-n'), true); drop.style.display = 'none'; try { input.value = d.getAttribute('data-n'); } catch (e) {} }); });
}
function bindSearchInput(qI) { if (!qI || qI.__crmBound) return; qI.__crmBound = true; qI.addEventListener('input', onCrimeSearchInput); }
function onDocClick(e) { const drop = $el('crm-drop'); const qI = searchInputEl || $el('crm-q'); if (!drop) return; if (drop.contains(e.target)) return; if (qI && e.target === qI) return; drop.style.display = 'none'; }
function onCardClick(e) {
  if (!e.target || !e.target.closest) return;
  const w = e.target.closest('[data-crm-ward]');
  if (w) { selectWardByName(w.getAttribute('data-crm-ward')); return; }
  const c = e.target.closest('[data-crm-chome]');
  if (c) selectChomeByName(c.getAttribute('data-crm-chome'), true);
}
function bindControls() {
  $qa('.crm-dd').forEach(dd => {
    const btn = dd.querySelector('.crm-dd-btn');
    if (!btn || btn.__crmDdBound) return;
    btn.__crmDdBound = true;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !dd.classList.contains('open');
      closeCrmDd(dd);
      dd.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  if (!window.__crmDdBound) {
    window.__crmDdBound = true;
    document.addEventListener('click', () => closeCrmDd(null));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCrmDd(null); });
  }
  $qa('[data-crm-metric]').forEach(b => {
    if (b.__crmBound) return; b.__crmBound = true;
    b.addEventListener('click', e => {
      e.stopPropagation();
      closeCrmDd(null);
      const v = b.getAttribute('data-crm-metric');
      if (v === curMetric) return;
      curMetric = v;
      syncCrmDd('metric', I18N[currentLang].metrics[v]);
      buildScales(); updateLegendBar(); updateHistogram();
      if (mode === 'muni') { if (muniLayer) muniLayer.setStyle(muniLayer.options.style); }
      else if (chomeLayer) chomeLayer.setStyle(chomeLayer.options.style);
      if (curSelected) { if (mode === 'chome') renderChomeCard(curSelected); else renderWardCard(curSelected); }
    });
  });
  $qa('[data-crm-t]').forEach(b => {
    if (b.__crmBound) return; b.__crmBound = true;
    b.addEventListener('click', e => {
      e.stopPropagation();
      closeCrmDd(null);
      const v = b.getAttribute('data-crm-t');
      if (v === curT) return;
      $qa('[data-crm-t]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); curT = v;
      syncCrmDd('time', I18N[currentLang].times[v]);
      buildScales(); updateLegendBar(); updateHistogram();
      if (mode === 'muni') { if (muniLayer) muniLayer.setStyle(muniLayer.options.style); }
      else if (chomeLayer) chomeLayer.setStyle(chomeLayer.options.style);
    });
  });
  $qa('[data-crm-mode]').forEach(b => {
    if (b.__crmBound) return; b.__crmBound = true;
    b.addEventListener('click', e => {
      e.stopPropagation();
      closeCrmDd(null);
      if (!map || !muniLayer || !chomeLayer) return;
      const v = b.getAttribute('data-crm-mode');
      if (v === mode) return;
      $qa('[data-crm-mode]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); mode = v;
      syncCrmDd('mode', I18N[currentLang].modes[v]);
      if (mode === 'muni' && parentBoundaryLayer) { map.removeLayer(parentBoundaryLayer); parentBoundaryLayer = null; }
      applyMode();
      buildScales(); updateLegendBar(); updateHistogram();
    });
  });
  bindSearchInput(searchInputEl || $el('crm-q'));
  if (!docClickBound && document.addEventListener) { document.addEventListener('click', onDocClick); docClickBound = true; }
}
export async function mountCrime(el, opts) {
  opts = opts || {};
  if (opts.base) crmForcedBase = opts.base;
  if (mounted) unmountCrime();
  const my = ++bootSeq;
  rootEl = el;
  if (opts.controls) controlsRoot = opts.controls;
  el.classList.add('crm-mounted');
  try { el.style.position = 'relative'; el.style.minHeight = '70vh'; el.style.overflow = 'hidden'; } catch (e) {}
  el.innerHTML = '<div id="crm-root"></div>';
  rootEl = el.querySelector('#crm-root');
  try { rootEl.style.cssText = 'position:absolute;inset:0'; } catch (e) {}
  rootEl.innerHTML = CRM_SKELETON
  currentVariant = opts.theme ? (CRM_THEME_MAP[opts.theme] || 'editorial') : detectInitialTheme();
  currentAccent = opts.accent || detectInitialAccent();
  if (opts.lang && I18N[opts.lang]) { currentLang = opts.lang; try { crmStore.setItem('tokyo-crime-lang', opts.lang); } catch (e) {} }
  rootEl.setAttribute('data-crm-variant', currentVariant);
  rootEl.setAttribute('data-crm-accent', currentAccent);
  ensureCrmCss();
  // 控件栏（罪种 / R7R8 / 区市町丁 / 搜索）此前定义了却从未挂载：
  // shell 只传 base/lang/theme，这里在骨架注入后自建宿主并挂载，缺它整组筛选不可用。
  if (!controlsRoot || (controlsRoot.isConnected === false)) {
    const ctlHost = document.createElement('div');
    ctlHost.id = 'crm-ctl-host';
    rootEl.appendChild(ctlHost);
    controlsRoot = ctlHost;
  }
  mountCrimeControls(controlsRoot, {});
  // 看门狗：依赖（Leaflet/数据）挂掉时不能让雷达球永远转下去
  window.setTimeout(() => {
    if (my !== bootSeq || mounted) return;
    const l = el.querySelector('#crm-app-loader');
    if (!l) return;
    l.classList.add('fade-out');
    setTimeout(() => { try { l.remove(); } catch (e) {} }, 500);
    const st = el.closest ? el.closest('.stage') : null;
    if (st) { st.classList.add('stage-failed'); st.dataset.live = '0'; }
  }, 15000);
  const t0 = I18N[currentLang] || I18N.zh;
  const lt = $el('crm-loader-title'); if (lt) lt.textContent = t0.loadingTitle;
  const ls = $el('crm-loader-status'); if (ls) ls.textContent = t0.loadingStatus;
  const la = $el('crm-app-loader'); if (la) la.setAttribute('aria-label', t0.loaderAria);
  aborter = new AbortController();
  try {
    L = await loadLeaflet();
    if (my !== bootSeq) return false;
    const [pts, mpoly, poly, muni] = await Promise.all(CRM_DATA_FILES.map(f => fetchCrmJson(f, aborter.signal)));
    if (my !== bootSeq) return false;
    PTS = pts; MUNI_POLY = mpoly; POLY = poly; MUNI = muni;
    buildScales(); updateLegendBar(); updateHistogram();
    initMap();
    if (my !== bootSeq) { try { map.remove(); } catch (e) {} map = null; return false; }
    initZoomSlider();
    map.on('move zoom', refreshCallout);
    try { requestAnimationFrame(() => setTimeout(() => { try { if (map) { map.invalidateSize(); if (!userNavigated) fitTokyo23(); } } catch (e) {} }, 60)); } catch (e) {}
    try { setTimeout(() => { try { if (map) { map.invalidateSize(); if (!userNavigated) fitTokyo23(); } } catch (e) {} }, 1500); } catch (e) {}
    $el('crm-card').addEventListener('click', onCardClick);
    try { if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) { /* mobile: 卡片默认收起，点选才展开 */ } else selectChomeByName('新宿区歌舞伎町2丁目', false, true); } catch (e) { selectChomeByName('新宿区歌舞伎町2丁目', false, true); }
    applyThemeVariant(currentVariant);
    setLanguage(currentLang);
    applyAccentPalette(currentAccent);
    bindControls();
    const ldr = $el('crm-app-loader');
    if (ldr) { ldr.classList.add('fade-out'); setTimeout(() => { if (ldr.parentNode) ldr.remove(); }, 750); }
    mounted = true;
    return true;
  } catch (e) {
    const ldr2 = $el('crm-app-loader');
    if (ldr2) { ldr2.classList.add('fade-out'); setTimeout(() => { if (ldr2.parentNode) ldr2.remove(); }, 750); }
    throw e;
  }
}
export function unmountCrime() {
  bootSeq++;
  if (aborter) { try { aborter.abort(); } catch (e) {} aborter = null; }
  if (docClickBound) { document.removeEventListener('click', onDocClick); docClickBound = false; }
  try { if (map) { const m = map; map = null; try { m.off(); } catch (e) {} try { m.eachLayer((l) => { try { m.removeLayer(l); } catch (e) {} }); } catch (e) {} try { m.remove(); } catch (e) {} } } catch (e) {}
  map = null; muniLayer = null; chomeLayer = null; labelLayer = null; parentBoundaryLayer = null; userNavigated = false;
  curSelected = null; lastAnchor = null;
  const lk = document.getElementById('crm-leaflet-css'); if (lk) lk.remove();
  const st = document.getElementById('crm-style'); if (st) st.remove();
  const deadRoot = rootEl, deadCtl = controlsRoot;
  rootEl = null; controlsRoot = null; searchInputEl = null;
  const mySweep = ++bootSeq;
  const sweepDom = () => { if (mySweep !== bootSeq) return; try { if (deadCtl) deadCtl.innerHTML = ''; } catch (e) {} try { if (deadRoot) { deadRoot.innerHTML = ''; deadRoot.removeAttribute('data-crm-variant'); deadRoot.removeAttribute('data-crm-accent'); deadRoot.classList.remove('crm-mounted'); if (deadRoot.parentNode) deadRoot.parentNode.removeChild(deadRoot); } } catch (e) {} };
  try { requestAnimationFrame(() => setTimeout(sweepDom, 0)); } catch (e) { setTimeout(sweepDom, 50); }
  zoomSliderRender = null; L = null; mounted = false;
}
export function mountCrimeControls(box, opts) {
  opts = opts || {};
  controlsRoot = box; searchInputEl = opts.searchInput || null;
  const t = I18N[currentLang] || I18N.zh;
  const label = isZh(currentLang) ? zhx(currentLang, '筛选') : (currentLang === 'en' ? 'Filter' : '絞り込み');
  box.innerHTML = '<button type="button" class="crm-ctl-toggle" aria-expanded="false" aria-label="' + label + '">'
    + '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 4h12M4 8h8M6.5 12h3"/></svg>'
    + '<span>' + label + '</span></button>'
    + '<div class="crm-ctl">' + crimeControlsHtml(t) + '</div>';
  const tg = box.querySelector('.crm-ctl-toggle');
  if (tg) tg.addEventListener('click', () => {
    const open = box.classList.toggle('is-open');
    tg.setAttribute('aria-expanded', String(open));
  });
  if (searchInputEl) bindSearchInput(searchInputEl);
  bindControls();
  return true;
}
export function setCrimeLang(l) { if (!I18N[l]) return false; setLanguage(l); return true; }
export function setCrimeTheme(t) { const v = CRM_THEME_MAP[t] || 'editorial'; if (v !== currentVariant) applyThemeVariant(v); else if (rootEl) rootEl.setAttribute('data-crm-variant', v); return v; }
export function cycleCrimeAccent() { cycleAccentPalette(); return currentAccent; }
export function searchCrime(q) { q = (q || '').trim().toLowerCase(); if (!q || !PTS) return []; return PTS.filter(p => (p.n || '').toLowerCase().includes(q)).slice(0, 10).map(h => ({ name: h.n, ward: h.w })); }
export function selectCrimeByName(n, fly) { selectChomeByName(n, !!fly); }
export function selectCrimeWard(n) { selectWardByName(n); }
export function resetCrimeView() { if (map) fitTokyo23(); }
export function isCrimeMounted() { return mounted; }
export function getCrimeLegend() { const S = SCALES[curMetric]; if (!S) return null; const b = S.breaks; return { metric: curMetric, breaks: b.slice(), ramp: S.ramp.slice(), hi: S.hi, ticks: [b[0], b[1], b[3], b[5], b[7]] }; }

