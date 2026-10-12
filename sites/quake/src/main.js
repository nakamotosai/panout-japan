/**
 * japan-3d-earthquake — free-orbit 3D hypocenters on a real globe
 * Visual: nagix-like depth points · tactical 暖炭黑 · hollow NE coastline on sphere
 * Global USGS tiles (lazy by view); pan free over whole Earth; home = Japan
 */
import './style.css'
import * as THREE from 'three'
import { project, cameraPoseNorthUp, EARTH_RADIUS_KM } from './coords.js'
import { createGlobeNav } from './globeNav.js'
import {
  OutlineLayer,
  setOutlineResolution,
  setOutlineColor,
} from './japanOutline.js'
import {
  buildEarthGlobe,
  setEarthTheme,
  updateEarthGrid,
  fillFullEarthGrid,
} from './earth.js'
import { createMinimap, focusToLonLat } from './minimap.js'
import { filterQuakesInView } from './viewCull.js'
import {
  buildQuakeInstances,
  DEFAULT_EXAGGERATION,
  SIZE_MODE_MAG,
  SIZE_MODE_UNIFORM,
  enableQuakeDissolve,
  setQuakeDissolve,
  disableQuakeDissolve,
  canDisposeQuakeGeometry,
  setQuakeInstanceScaleMul,
} from './quakes.js'
import { setDepthPalette } from './depthColor.js'
import {
  filterQuakesByLastDays,
  LIVE_MIN_MAG_DEFAULT,
  LIVE_WINDOW_DAYS,
  startLivePoll,
} from './liveFeed.js'
import {
  QuakeTileStore,
  pickNearestQuakes,
  DEFAULT_MAX_DISPLAY,
  MIN_MAX_DISPLAY,
  MAX_MAX_DISPLAY,
  MOBILE_DEFAULT_MAX_DISPLAY,
  MOBILE_MIN_MAX_DISPLAY,
  MOBILE_MAX_MAX_DISPLAY,
} from './quakeTiles.js'
import { RippleLayer } from './ripples.js'
import {
  FAMOUS_QUAKES,
  FAMOUS_AFTERSHOCK_DAYS,
  famousToQuakeRecord,
  getFamousById,
  defaultFamousId,
  buildFamousSequence,
} from './famousQuakes.js'
import gsap from 'gsap'

/** 可贴到震源附近；单位 km（球半径 ~6371） */
const MIN_DIST = 80
/** 拉远可看见整球 */
const MAX_DIST = EARTH_RADIUS_KM * 6
/** 自动转：~1.0 ≈ 30s/圈；0.12 ≈ 更慢、好观察（与旧 Orbit 量级一致） */
const AUTO_ROTATE_SPEED = 0.12
/** 用户拖完 / 静止后多久再恢复自转 */
const RESUME_ROTATE_MS = 3000
/** 目录最早年（服务器全量仍保留，滑条可拖回） */
const YEAR_MIN = 1970
const YEAR_MAX = new Date().getUTCFullYear()
/** 默认进站只显示此年→今（更早数据在 archive 瓦片，拖年份才加载） */
const YEAR_DEFAULT_MIN = 2000

/** 唯一主题：tactical 暖炭黑（全家统一；gruvbox 仅作旧 localStorage 别名） */
const THEME = {
  tactical: {
    bg: 0x141210,
    coast: 0xf5f0e8,
    gridA: 0x3a332c,
    gridB: 0x2a251f,
  },
  gruvbox: {
    bg: 0x141210,
    coast: 0xf5f0e8,
    gridA: 0x3a332c,
    gridB: 0x2a251f,
  },
}
function normalizeThemeName(_raw) {
  return 'tactical'
}

/**
 * 复位 / 默认构图：日本列岛居中 + 正北朝上
 * tiltDeg = 相对天顶倾角（从南侧略俯视，像看地图）
 */
const HOME_VIEW = {
  lon: 138.0,
  lat: 37.0,
  distance: 2200,
  tiltDeg: 28,
  headingDeg: 0,
}

/**
 * 进站开场：太空俯视整球（再 3s 平滑落到 HOME）
 * distance 接近 max，tilt 小 ≈ 从外太空往下看
 */
const INTRO_SPACE_VIEW = {
  lon: 138.0,
  lat: 18.0,
  distance: Math.min(MAX_DIST * 0.88, 30000),
  tiltDeg: 8,
  headingDeg: 0,
}

/**
 * 名震模式默认：更拉远、仍正北朝上俯视日本列岛
 */
const FAMOUS_OVERVIEW = {
  lon: 137.5,
  lat: 37.2,
  distance: 3000,
  tiltDeg: 18,
  headingDeg: 0,
}

/** 相机飞近单场震源（秒） */
const CAM_FLY_SEC = 1.75
/** 模式切换 / 复位到构图（秒） */
const CAM_MODE_SEC = 1.1
/** 进站：太空 → 日本（秒） */
const CAM_INTRO_SEC = 3
/** 首屏点场上限（岸线出完再溶点；飞完再补满 displayCap） */
const INTRO_DISPLAY_CAP = 36000
/** 开场：日本近岸径向铺开（秒；只覆盖日本角半径，避免前半秒就「长完」后空等） */
const INTRO_OUTLINE_REVEAL_SEC = 3.4
/** 开场岸线日本角半径（°）；更大半径的远岸后台再补，不挡点场 */
const INTRO_OUTLINE_JAPAN_DEG = 42
/** 开场：点场溶解渗入（秒） */
const INTRO_POINTS_DISSOLVE_SEC = 1.85
/** 模式切换等「大换场」整场溶解时长 */
const POINTS_XFADE_SEC = 2.2
/** 拖动/瓦片：只溶增量/减量的时长 */
const POINTS_XFADE_VIEW_SEC = 0.85
/** 拖动停稳后再同步瓦片（ms） */
const TILE_SYNC_DEBOUNCE_MS = 520

/** 手机断点：仅 max-width 640px；平板=桌面（与 CSS @media 一致） */
const MENU_COMPACT_MQ = '(max-width: 640px)'

function isCompactScreen() {
  return window.matchMedia?.(MENU_COMPACT_MQ)?.matches === true
}

/** M4：手机 HOME 拉远，整列岛入画 */
function homeViewForDevice() {
  if (isCompactScreen()) {
    return { ...HOME_VIEW, distance: 3600, tiltDeg: 22 }
  }
  return HOME_VIEW
}

/** M4：手机名震总览更远 */
function famousOverviewForDevice() {
  if (isCompactScreen()) {
    return { ...FAMOUS_OVERVIEW, distance: 4200 }
  }
  return FAMOUS_OVERVIEW
}

/** M7：当前设备 displayCap 上下限 */
function displayCapLimits() {
  if (isCompactScreen()) {
    return { min: MOBILE_MIN_MAX_DISPLAY, max: MOBILE_MAX_MAX_DISPLAY }
  }
  return { min: MIN_MAX_DISPLAY, max: MAX_MAX_DISPLAY }
}

/** M7：视锥/上屏用 mobile flag */
function mobileViewOpts() {
  // 年份在 pick 前过滤，避免 cap 被窗外点占满
  return {
    ...(isCompactScreen() ? { mobile: true } : {}),
    yearMin,
    yearMax,
  }
}

/** M8 操作提示（桌面去掉滚轮；手机去掉单指平移） */
const HINT_DESKTOP = '左键平移 右键旋转'
const HINT_MOBILE = '双指可旋转和缩放'

function syncHintText() {
  const el = document.getElementById('eq-hint')
  if (!el) return
  el.textContent = isCompactScreen() ? HINT_MOBILE : HINT_DESKTOP
}

const app = document.querySelector('#app')
if (!app) throw new Error('#app missing')

const canvas = document.createElement('canvas')
canvas.id = 'eq-canvas'
app.appendChild(canvas)
/** 全家统一顶栏：站名 + 四站互链 + 三语切换器占位（真链主线收口时统一改） */
const topbar = document.createElement('header')
topbar.className = 'eq-topbar'
topbar.innerHTML = `
  <div class="eq-topbar-brand">
    <h1 class="eq-topbar-title">东亚 3D 震源</h1>
    <span class="eq-topbar-eyebrow">Quake · Tactical</span>
  </div>
  <nav class="eq-topbar-nav" aria-label="全站导航">
    <a href="#" aria-current="page">地震</a>
    <a href="#" title="犯罪率站（主线收口时改真链）">犯罪率</a>
    <a href="#" title="内阁支持率站（主线收口时改真链）">支持率</a>
    <a href="#" title="门面（主线收口时改真链）">门面</a>
  </nav>
  <div class="eq-topbar-lang" role="group" aria-label="语言切换（占位）">
    <button type="button" data-lang="ja">JA</button>
    <button type="button" data-lang="zh" class="is-active">中</button>
    <button type="button" data-lang="en">EN</button>
  </div>
`
app.appendChild(topbar)
/** 三语切换器占位：只记选择 + 高亮，不改站内文案（i18n 由主线统一做） */
try {
  const savedLang =
    new URLSearchParams(location.search).get('lang') ||
    localStorage.getItem('eq-lang') ||
    (navigator.language || '').slice(0, 2).toLowerCase()
  const initialLang = savedLang.startsWith('ja')
    ? 'ja'
    : savedLang.startsWith('en')
      ? 'en'
      : 'zh'
  const langBtns = [...topbar.querySelectorAll('.eq-topbar-lang button')]
  const paintLang = (lang) =>
    langBtns.forEach((b) =>
      b.classList.toggle('is-active', b.dataset.lang === lang),
    )
  paintLang(initialLang)
  topbar
    .querySelector('.eq-topbar-lang')
    ?.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement | null} */ (
        e.target instanceof HTMLElement ? e.target.closest('button') : null
      )
      if (!btn?.dataset.lang) return
      paintLang(btn.dataset.lang)
      try {
        localStorage.setItem('eq-lang', btn.dataset.lang)
      } catch {
        /* ignore */
      }
    })
} catch {
  /* ignore */
}
/** 左上：菜单（默认展开；平移/旋转后收起；仅工具，不含模式） */
const leftDock = document.createElement('aside')
leftDock.className = 'eq-left-dock'
leftDock.innerHTML = `
  <div class="eq-sq-row" id="eq-menu-row">
    <button type="button" class="eq-sq" id="eq-menu" title="展开/收起工具" aria-expanded="true" aria-controls="eq-menu-items">菜单</button>
    <div class="eq-menu-items" id="eq-menu-items">
      <button type="button" class="eq-sq" id="eq-size-mode" title="点大小：按震级" aria-pressed="true">震级</button>
      <div class="eq-tool">
        <button type="button" class="eq-sq" id="eq-btn-mag" title="最小震级" aria-haspopup="true" aria-expanded="false">震级筛</button>
        <div class="eq-pop" id="eq-pop-mag" hidden role="dialog" aria-label="最小震级">
          <span class="eq-pop-val" id="eq-minmag-val">M≥4.0</span>
          <span class="eq-pop-cap">7+</span>
          <input id="eq-minmag" class="eq-vrange" type="range" min="4" max="7" step="0.1" value="4" title="最小震级" />
          <span class="eq-pop-cap">4+</span>
        </div>
      </div>
      <div class="eq-tool">
        <button type="button" class="eq-sq" id="eq-btn-year" title="年份区间" aria-haspopup="true" aria-expanded="false">年份</button>
        <div class="eq-pop" id="eq-pop-year" hidden role="dialog" aria-label="年份区间">
          <span class="eq-pop-val" id="eq-year-val">${YEAR_DEFAULT_MIN}–${YEAR_MAX}</span>
          <div class="eq-dual-v">
            <div class="eq-dual-col">
              <span class="eq-pop-cap">起</span>
              <input id="eq-year-min" class="eq-vrange" type="range" min="${YEAR_MIN}" max="${YEAR_MAX}" step="1" value="${YEAR_DEFAULT_MIN}" title="起始年（默认 ${YEAR_DEFAULT_MIN}；可拖回 ${YEAR_MIN}）" />
              <span class="eq-pop-cap">${YEAR_MIN}</span>
            </div>
            <div class="eq-dual-col">
              <span class="eq-pop-cap">止</span>
              <input id="eq-year-max" class="eq-vrange" type="range" min="${YEAR_MIN}" max="${YEAR_MAX}" step="1" value="${YEAR_MAX}" title="结束年" />
              <span class="eq-pop-cap">${YEAR_MAX}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="eq-tool">
        <button type="button" class="eq-sq" id="eq-btn-depth" title="深度夸张" aria-haspopup="true" aria-expanded="false">深度</button>
        <div class="eq-pop" id="eq-pop-depth" hidden role="dialog" aria-label="深度夸张">
          <span class="eq-pop-val" id="eq-exag-val">×2.0</span>
          <span class="eq-pop-cap">3</span>
          <input id="eq-exag" class="eq-vrange" type="range" min="1" max="3" step="0.1" value="2" title="深度夸张" />
          <span class="eq-pop-cap">1</span>
        </div>
      </div>
      <button type="button" class="eq-sq" id="eq-pwa-install" title="安装到桌面 / 主屏幕" aria-label="安装到桌面">安装</button>
    </div>
  </div>
`
app.appendChild(leftDock)

/** 顶中：历史 | 实时 | 名震 | 回顾（重要模式不进设置菜单） */
const modeBar = document.createElement('div')
modeBar.className = 'eq-mode-bar'
modeBar.innerHTML = `
  <div class="eq-mode-switch eq-sq-row" role="group" aria-label="查看模式">
    <button type="button" class="eq-sq eq-mode-btn is-active" id="eq-mode-history" aria-pressed="true" title="全球历史目录（默认 ${YEAR_DEFAULT_MIN}→今，可筛回 ${YEAR_MIN}；按可见区加载）">历史</button>
    <button type="button" class="eq-sq eq-mode-btn" id="eq-mode-live" aria-pressed="false" title="最近${LIVE_WINDOW_DAYS}天 USGS 公开目录（实时）">实时</button>
    <button type="button" class="eq-sq eq-mode-btn" id="eq-mode-famous" aria-pressed="false" title="历史上的著名地震">名震</button>
    <button type="button" class="eq-sq eq-mode-btn" id="eq-mode-review" aria-pressed="false" title="从 1970 年起逐年堆叠震源（时间轴回顾）">回顾</button>
  </div>
`
app.appendChild(modeBar)

/** 名震抽屉（右侧列表） */
const famousDrawer = document.createElement('aside')
famousDrawer.className = 'eq-famous-drawer'
famousDrawer.id = 'eq-famous-drawer'
famousDrawer.setAttribute('aria-hidden', 'true')
famousDrawer.innerHTML = `
  <header class="eq-famous-drawer-head">
    <h2 class="eq-famous-drawer-title">著名地震</h2>
    <button type="button" class="eq-famous-close" id="eq-famous-drawer-close" title="关闭列表" aria-label="关闭列表">×</button>
  </header>
  <p class="eq-famous-drawer-hint">点选一场 · 只显示主震 + 后${FAMOUS_AFTERSHOCK_DAYS}日余震 · 飞近停转</p>
  <ul class="eq-famous-list" id="eq-famous-list" role="listbox" aria-label="著名地震列表"></ul>
`
app.appendChild(famousDrawer)

/** 名震详述面板（选中后自动弹出） */
const famousPanel = document.createElement('article')
famousPanel.className = 'eq-famous-panel'
famousPanel.id = 'eq-famous-panel'
famousPanel.setAttribute('aria-hidden', 'true')
famousPanel.innerHTML = `
  <header class="eq-famous-panel-head">
    <div class="eq-famous-panel-mag" id="eq-famous-panel-mag">M—</div>
    <button type="button" class="eq-famous-close" id="eq-famous-panel-close" title="关闭" aria-label="关闭详述">×</button>
  </header>
  <h3 class="eq-famous-panel-name" id="eq-famous-panel-name"></h3>
  <p class="eq-famous-panel-meta" id="eq-famous-panel-meta"></p>
  <p class="eq-famous-panel-summary" id="eq-famous-panel-summary"></p>
  <p class="eq-famous-panel-deaths" id="eq-famous-panel-deaths" hidden></p>
  <a class="eq-famous-wiki" id="eq-famous-wiki" href="#" target="_blank" rel="noopener noreferrer">维基百科 →</a>
  <p class="eq-famous-panel-note">导读仅供教育参考 · 非预报/预警</p>
`
app.appendChild(famousPanel)

/** M10：手机名震列表入口（右下「名震列表」） */
const famousReopen = document.createElement('button')
famousReopen.type = 'button'
famousReopen.className = 'eq-famous-reopen'
famousReopen.id = 'eq-famous-reopen'
famousReopen.textContent = '名震列表'
famousReopen.title = '打开著名地震列表'
famousReopen.setAttribute('aria-label', '打开著名地震列表')
app.appendChild(famousReopen)

/**
 * 手机名震：用户是否主动关掉了列表（关详述会自动开列表，不算主动全关）
 * 主动关列表后只留「名震列表」钮；否则底 1/3 必有面板或列表之一
 */
let famousMobileUserClosedList = false

/** 悬停震源信息卡 */
const hoverCard = document.createElement('div')
hoverCard.className = 'eq-hover-card'
hoverCard.id = 'eq-hover-card'
hoverCard.setAttribute('role', 'tooltip')
hoverCard.setAttribute('aria-hidden', 'true')
hoverCard.innerHTML = `
  <div class="eq-hover-card-inner">
    <div class="eq-hover-mag" id="eq-hover-mag">M—</div>
    <p class="eq-hover-place" id="eq-hover-place"></p>
    <dl class="eq-hover-meta">
      <div><dt>深度</dt><dd id="eq-hover-depth">—</dd></div>
      <div><dt>时间</dt><dd id="eq-hover-time">—</dd></div>
      <div><dt>位置</dt><dd id="eq-hover-ll">—</dd></div>
    </dl>
  </div>
`
app.appendChild(hoverCard)

/** 回顾模式 HUD：顶=年份 · 底=播放器+关闭（专用沉浸，藏其它 chrome） */
const reviewHud = document.createElement('div')
reviewHud.className = 'eq-review-hud'
reviewHud.id = 'eq-review-hud'
reviewHud.hidden = true
reviewHud.setAttribute('aria-hidden', 'true')
reviewHud.innerHTML = `
  <div class="eq-review-year" id="eq-review-year" aria-live="polite">${YEAR_MIN}</div>
  <div class="eq-review-dock">
    <div class="eq-review-player" role="group" aria-label="回顾时间轴">
      <button type="button" class="eq-review-btn" id="eq-review-restart" title="回到 ${YEAR_MIN} 重播" aria-label="重播">↻</button>
      <button type="button" class="eq-review-btn eq-review-play" id="eq-review-play" title="播放 / 暂停" aria-label="播放" aria-pressed="false">
        <svg class="eq-ico-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        <svg class="eq-ico-pause" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
      </button>
      <span class="eq-review-cap" id="eq-review-cap-min">${YEAR_MIN}</span>
      <input id="eq-review-scrub" class="eq-review-scrub" type="range" min="${YEAR_MIN}" max="${YEAR_MAX}" step="1" value="${YEAR_MIN}" title="拖到某一年" aria-label="回顾年份" />
      <span class="eq-review-cap" id="eq-review-cap-max">${YEAR_MAX}</span>
    </div>
    <button type="button" class="eq-review-close" id="eq-review-close" title="退出回顾" aria-label="退出回顾">×</button>
  </div>
`
app.appendChild(reviewHud)

/** 最底栏：左=重置|截图|播放 + 旋转条(与彩虹同行) · 中=域名 · 右=提示+署名+彩条 */
const bottomBar = document.createElement('div')
bottomBar.className = 'eq-bottom'
bottomBar.innerHTML = `
  <div class="eq-bottom-left">
    <div class="eq-bottom-tools">
      <button type="button" class="eq-bar-btn" id="eq-reset" title="回到初始视角" aria-label="回到初始视角">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7"/>
          <path d="M3 5v5h5"/>
        </svg>
      </button>
      <button type="button" class="eq-bar-btn" id="eq-shot" title="截图下载" aria-label="截图下载">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
      <button type="button" class="eq-bar-btn eq-play-pause" id="eq-toggle-rotate" title="暂停自动旋转" aria-label="暂停自动旋转" aria-pressed="true">
        <svg class="eq-ico-pause" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
        </svg>
        <svg class="eq-ico-play" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor"/>
        </svg>
      </button>
    </div>
    <div class="eq-rotate-row">
      <input id="eq-rotate" type="range" min="0" max="360" step="0.5" value="0" title="水平旋转" aria-label="水平旋转" />
    </div>
  </div>
  <div class="eq-bottom-center">
    <button type="button" class="eq-domain" id="eq-domain-reload" title="刷新网页重新开始">3d.saaaai.com</button>
  </div>
  <div class="eq-bottom-right">
    <p class="eq-hint" id="eq-hint" aria-live="polite">左键平移 右键旋转</p>
    <footer class="eq-footer" id="eq-footer">
      © Pan Out Japan · 数据来源 <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener">USGS</a>
      · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>
    </footer>
    <div class="eq-depth-range" id="eq-depth-range" title="拖两端：用这一段颜色给全部震源上色">
      <div class="eq-legend-bar" aria-hidden="true"></div>
      <div class="eq-depth-sel" id="eq-depth-sel"></div>
      <div class="eq-depth-mask eq-depth-mask-l" id="eq-depth-mask-l"></div>
      <div class="eq-depth-mask eq-depth-mask-r" id="eq-depth-mask-r"></div>
      <button type="button" class="eq-depth-thumb" id="eq-depth-lo" aria-label="浅端"></button>
      <button type="button" class="eq-depth-thumb" id="eq-depth-hi" aria-label="深端"></button>
    </div>
  </div>
`
app.appendChild(bottomBar)

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  // 截图 toDataURL 需保留缓冲；大地球深度用对数缓冲
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: true,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.setSize(app.clientWidth, app.clientHeight)

const scene = new THREE.Scene()

/** @type {'tactical'} */
let themeName = normalizeThemeName(
  (() => {
    try {
      return localStorage.getItem('eq-theme')
    } catch {
      return 'tactical'
    }
  })(),
)
document.documentElement.setAttribute('data-theme', themeName)
setDepthPalette(themeName)

const initialTheme = THEME[themeName]
renderer.setClearColor(initialTheme.bg, 1)
scene.background = new THREE.Color(initialTheme.bg)

const camera = new THREE.PerspectiveCamera(
  50,
  app.clientWidth / Math.max(app.clientHeight, 1),
  1,
  120000,
)

// 谷歌地球式：左键抓住地表拖、右键转视角、滚轮缩放（见 globeNav.js）
const controls = createGlobeNav(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.panSpeed = 1.1
controls.rotateSpeed = 0.9
controls.zoomSpeed = 1.05
controls.minDistance = MIN_DIST
controls.maxDistance = MAX_DIST
// 相对当地天顶：限制俯仰，保持从陆地上空往下看
// 俯仰：接近正俯视 ~ 约 75° 斜视，禁止翻到球背面
controls.minPolarAngle = 0.05
controls.maxPolarAngle = Math.PI * 0.42
controls.autoRotate = true
controls.autoRotateSpeed = AUTO_ROTATE_SPEED

/** 右上角迷你地球：完整圆球 · 水平旋转 · 三角箭头标位置+航向 · 点击转正北 */
const minimap = createMinimap(app, {
  theme: initialTheme,
  onReNorth: () => {
    // 钉住当前位置与倾角，只把航向拧回正北
    const vs = controls.getViewState?.()
    const { lon, lat } = focusToLonLat(getFocusPoint())
    const dist = Math.max(
      MIN_DIST,
      Math.min(
        MAX_DIST,
        vs && Number.isFinite(vs.radius) ? vs.radius : camDistance(),
      ),
    )
    const tiltDeg =
      vs && Number.isFinite(vs.phi)
        ? THREE.MathUtils.radToDeg(vs.phi)
        : HOME_VIEW.tiltDeg
    applyPoseCamera(
      {
        lon,
        lat,
        distance: dist,
        tiltDeg,
        headingDeg: 0,
      },
      { animate: true, duration: Math.min(0.75, CAM_MODE_SEC) },
    )
  },
})

/** @type {THREE.Group | null} */
let earthGlobe = null
/** 岸线/国界：CPU 索引全量，GPU 只建当前浏览器画面内瓦片 */
/** @type {OutlineLayer | null} */
let outlineLayer = null

/**
 * 历史目录：全球瓦片懒加载（服务器全量；客户端只驻留可见区）
 * historyQuakes = 当前已加载瓦片合并（切名震余震 / 30天离线回落也用）
 */
/** @type {Array<{lon:number,lat:number,depthKm:number,mag:number,time?:string,id?:string,place?:string}>} */
let historyQuakes = []
const quakeTiles = new QuakeTileStore()
/** 近30天在线/缓存数据 */
/** @type {Array<{lon:number,lat:number,depthKm:number,mag:number,time?:string,id?:string,place?:string}>} */
let liveQuakes = []
/** 当前 rebuild 用的列表（随模式切换） */
/** @type {Array<{lon:number,lat:number,depthKm:number,mag:number,time?:string,id?:string,place?:string}>} */
let allQuakes = []
/** @type {THREE.Object3D | null} */
let quakeMesh = null
/** 减量溶解层（仅被移出视野的点） */
let quakeMeshOutgoing = null
/** 增量溶解层（仅新进视野的点） */
let quakeMeshIncoming = null
/** @type {gsap.core.Tween | gsap.core.Timeline | null} */
let quakeXfadeTween = null
/** 上次已上屏点列表（做增量差集） */
/** @type {Array<{lon:number,lat:number,depthKm:number,mag:number,time?:string,id?:string}>} */
let lastGpuQuakes = []
let exaggeration = DEFAULT_EXAGGERATION
let minMag = LIVE_MIN_MAG_DEFAULT
let yearMin = YEAR_DEFAULT_MIN
let yearMax = YEAR_MAX
/** 瓦片 sync 进行中，避免重叠 rebuild 风暴 */
let quakeTileSyncing = false
/** 点大小：mag=按震级（默认）· uniform=全部等大（看断层带） */
let sizeMode = loadSizeMode()
/** 色条窗 0..1：默认拉满（两端靠边） */
let depthTLo = 0
let depthTHi = 1

/** @type {'history' | 'live' | 'famous' | 'review'} */
let viewMode = loadViewMode()
/** 名震选中 id（进名震默认 3·11；只显示该场主震+余震） */
/** @type {string | null} */
let selectedFamousId = null
/** 回顾模式：当前播放到的年份（yearMin 锁 YEAR_MIN，yearMax = reviewYear） */
let reviewYear = YEAR_MIN
let reviewPlaying = false
/** @type {ReturnType<typeof setTimeout> | 0} */
let reviewTimer = 0
/** 每年推进间隔（ms）；略长于增量溶入，避免连环 rebuild 抢帧 */
const REVIEW_MS_PER_YEAR = 520
/** 离开回顾时还原用户年份窗 */
let reviewSavedYearMin = YEAR_DEFAULT_MIN
let reviewSavedYearMax = YEAR_MAX
/**
 * 回顾固定点池：进模式时按 1970→今 抽一次，之后只按 yearMax 切片堆叠。
 * 禁止每年 re-pickNearest（会整批换点 → 全场溶出再溶入闪烁）。
 * @type {object[]}
 */
let reviewPool = []
/** @type {null | (() => void)} */
let stopLivePoll = null
/** 'live' | 'cache' | 'error' | '' */
let liveSource = ''
let liveFetchedAt = 0
/**
 * 进 30 天模式时：先 cache 溶解动画，期间网络 onData 不得 rebuild（否则会硬切掐掉溶解）
 * 动画结束后再静默套上最新 live 数据
 */
let liveEnterXfadeLock = false
/** @type {object[] | null} */
let pendingLiveQuakes = null
/** 无 cache 垫底时：首包 live 数据要用溶解（而不是空场硬切） */
let liveFirstPaintAnimate = false
let liveErrorMsg = ''
const rippleLayer = new RippleLayer(scene, renderer, camera)
let animClock = 0
let lastFrameMs = performance.now()

/** 刷新始终进历史；不读 localStorage 记忆上次模式 */
function loadViewMode() {
  return 'history'
}

/**
 * 点径档案：三模式统一用历史曲线（magScale / UNIFORM_RADIUS）。
 * 曾仅 30 天走 magScaleLive 放大，观感不一致，已取消。
 */
function usesLivePointSize() {
  return false
}

/** 是否显示涟漪（近30天 / 名震） */
function usesRipples() {
  return viewMode === 'live' || viewMode === 'famous'
}

/** 模式不落盘：刷新必回历史（保留函数避免改 setViewMode 调用点） */
function persistViewMode(_mode) {
  try {
    localStorage.removeItem('eq-view-mode')
  } catch {
    /* ignore */
  }
}

function loadSizeMode() {
  try {
    const v = localStorage.getItem('eq-size-mode')
    if (v === SIZE_MODE_UNIFORM || v === SIZE_MODE_MAG) return v
  } catch {
    /* ignore */
  }
  return SIZE_MODE_MAG
}

function persistSizeMode(mode) {
  try {
    localStorage.setItem('eq-size-mode', mode)
  } catch {
    /* ignore */
  }
}

/** 构图参考：默认钉日本地表；半径≈地球便于缩放上下限 */
const frameCenter = new THREE.Vector3(0, 0, EARTH_RADIUS_KM)
let frameRadius = EARTH_RADIUS_KM
let resumeTimer = 0
let userWantsAutoRotate = true

/**
 * 球场景框：中心钉日本（或可见震源重心），半径取地球尺度。
 * @param {Array<{lon:number,lat:number,depthKm:number,mag:number}>} quakes
 * @param {number} exag
 */
function computeFrame(quakes, exag) {
  const home = project(HOME_VIEW.lon, HOME_VIEW.lat, 0, 1)
  frameCenter.set(home.x, home.y, home.z)
  frameRadius = EARTH_RADIUS_KM

  // 若有可见点，略向震源云重心靠（仍以日本为默认主锚）
  let sx = 0
  let sy = 0
  let sz = 0
  let n = 0
  for (const q of quakes || []) {
    if ((q.mag ?? 0) < minMag && viewMode !== 'famous') continue
    const p = project(q.lon, q.lat, q.depthKm ?? 0, exag)
    sx += p.x
    sy += p.y
    sz += p.z
    n++
  }
  if (n > 20) {
    // 日本 70% + 震源云 30%，避免太平洋点把中心拽飞
    const cx = sx / n
    const cy = sy / n
    const cz = sz / n
    frameCenter.set(
      home.x * 0.7 + cx * 0.3,
      home.y * 0.7 + cy * 0.3,
      home.z * 0.7 + cz * 0.3,
    )
  }
}

function ensureEarthGlobe() {
  const t = THEME[themeName]
  if (!earthGlobe) {
    earthGlobe = buildEarthGlobe(t)
    scene.add(earthGlobe)
    updateEarthGrid(earthGlobe, camera, { force: true })
  } else {
    setEarthTheme(earthGlobe, t)
  }
}

function placeHelpers() {
  // 只保地球；历史 depthAxis（日本径向 Z 参考线）已废弃，勿再画
  ensureEarthGlobe()
}

function camDistance() {
  return controls.getDistance()
}

/** 按当前 min/max 距离，把相机推到指定距离（保持朝向） */
function setCamDistance(dist) {
  controls.setDistance(dist)
}

/** 水平方位角 0–360°（绕焦点当地天顶） */
function getAzimuthDeg() {
  return controls.getAzimuthDeg()
}

function setAzimuthDeg(deg) {
  controls.setAzimuthDeg(deg)
}

function syncRotateSlider() {
  const el = document.getElementById('eq-rotate')
  if (!el) return
  const deg = getAzimuthDeg()
  if (document.activeElement !== el) {
    el.value = String(deg.toFixed(1))
  }
  el.title = `水平旋转 ${Math.round(deg)}°`
}

function syncViewSliders() {
  syncRotateSlider()
}

/** 主题国境线色 → #rrggbb（域名字色 / 截图文字） */
function coastCssHex() {
  const n = THEME[themeName]?.coast ?? 0xf5f0e8
  return `#${n.toString(16).padStart(6, '0')}`
}

/**
 * 截图：只含 WebGL 画面 + 底部域名文字（不含任何 DOM 控件）
 */
function captureScreenshot() {
  try {
    renderer.render(scene, camera)
  } catch (e) {
    console.warn('screenshot render failed', e)
    return
  }
  const src = renderer.domElement
  const w = src.width
  const h = src.height
  if (w < 2 || h < 2) return

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return
  ctx.drawImage(src, 0, 0)

  const label = '3d.saaaai.com'
  const fontPx = Math.max(14, Math.round(h * 0.018))
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const pad = Math.max(14, Math.round(h * 0.028))
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 1
  ctx.fillStyle = coastCssHex()
  ctx.fillText(label, w / 2, h - pad)

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  out.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `3d-saaaai-${stamp}.png`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, 'image/png')
}

/**
 * 套用经纬构图（复位 / 太空开场 / 名震俯视共用）。
 * @param {{ lon:number, lat:number, distance:number, tiltDeg?:number, headingDeg?:number }} view
 * @param {{ animate?: boolean, duration?: number, onComplete?: () => void }} [opts]
 * @returns {Promise<void>}
 */
function applyPoseCamera(view, opts = {}) {
  const animate = !!opts.animate
  const pose = cameraPoseNorthUp(view.lon, view.lat, view.distance, {
    tiltDeg: view.tiltDeg ?? 28,
    headingDeg: view.headingDeg ?? 0,
  })
  const endTarget = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z)
  const endPos = new THREE.Vector3(
    pose.position.x,
    pose.position.y,
    pose.position.z,
  )
  const endUp = new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z)
  controls.minDistance = MIN_DIST
  controls.maxDistance = MAX_DIST
  return tweenCameraTo(endTarget, endPos, {
    animate,
    duration: opts.duration ?? CAM_MODE_SEC,
    endUp,
    northUp: true,
    onComplete: opts.onComplete,
  })
}

/**
 * 复位视角：日本居中 + 正北朝上（手机 distance 更大，见 homeViewForDevice）。
 * @param {{ animate?: boolean, duration?: number, onComplete?: () => void }} [opts]
 * @returns {Promise<void>}
 */
function applyCameraFrame(opts = {}) {
  return applyPoseCamera(homeViewForDevice(), {
    animate: !!opts.animate,
    duration: opts.duration ?? CAM_MODE_SEC,
    onComplete: opts.onComplete,
  })
}

function showError(msg) {
  const el = document.createElement('div')
  el.className = 'eq-error'
  el.innerHTML = msg
  app.appendChild(el)
}

async function loadJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json()
}

/** @param {{time?: string}} q */
function yearOf(q) {
  if (typeof q.time === 'string' && q.time.length >= 4) {
    const y = Number(q.time.slice(0, 4))
    return Number.isFinite(y) ? y : null
  }
  return null
}

/** 历史系：历史 + 回顾（都吃年份窗 / 瓦片 sync） */
function isHistoryLike() {
  return viewMode === 'history' || viewMode === 'review'
}

function filterQuakes() {
  return allQuakes.filter((q) => {
    // 名震序列：主震始终保留；余震仍可吃最小震级
    if (viewMode === 'famous') {
      if (q._famousMain) return true
      if ((q.mag ?? 0) < minMag) return false
      return true
    }
    if ((q.mag ?? 0) < minMag) return false
    // 近30天本身已是时间窗；不再套年份
    if (isHistoryLike()) {
      const y = yearOf(q)
      if (y != null && (y < yearMin || y > yearMax)) return false
    }
    return true
  })
}

function updateModeButtons() {
  const hist = document.getElementById('eq-mode-history')
  const live = document.getElementById('eq-mode-live')
  const famous = document.getElementById('eq-mode-famous')
  const review = document.getElementById('eq-mode-review')
  if (hist) {
    hist.classList.toggle('is-active', viewMode === 'history')
    hist.setAttribute('aria-pressed', viewMode === 'history' ? 'true' : 'false')
  }
  if (live) {
    live.classList.toggle('is-active', viewMode === 'live')
    live.setAttribute('aria-pressed', viewMode === 'live' ? 'true' : 'false')
  }
  if (famous) {
    famous.classList.toggle('is-active', viewMode === 'famous')
    famous.setAttribute('aria-pressed', viewMode === 'famous' ? 'true' : 'false')
  }
  if (review) {
    review.classList.toggle('is-active', viewMode === 'review')
    review.setAttribute('aria-pressed', viewMode === 'review' ? 'true' : 'false')
  }
  const yearBtn = document.getElementById('eq-btn-year')
  const yearMinEl = document.getElementById('eq-year-min')
  const yearMaxEl = document.getElementById('eq-year-max')
  const yearDisabled =
    viewMode === 'live' || viewMode === 'famous' || viewMode === 'review'
  if (yearBtn) {
    yearBtn.disabled = yearDisabled
    yearBtn.title = yearDisabled
      ? viewMode === 'famous'
        ? '名震模式使用固定精选事件'
        : viewMode === 'review'
          ? '回顾模式由时间轴控制年份'
          : `近${LIVE_WINDOW_DAYS}天模式已固定时间窗`
      : `年份区间 ${yearMin}–${yearMax}`
    yearBtn.classList.toggle('is-disabled', yearDisabled)
  }
  if (yearMinEl) yearMinEl.disabled = yearDisabled
  if (yearMaxEl) yearMaxEl.disabled = yearDisabled
  if (yearDisabled) {
    document.getElementById('eq-pop-year')?.setAttribute('hidden', '')
    yearBtn?.setAttribute('aria-expanded', 'false')
  }
  syncReviewHud()
}

function syncRipplesFromFiltered() {
  if (!usesRipples()) {
    rippleLayer.setEnabled(false)
    return
  }
  rippleLayer.setEnabled(true)
  let events = filterQuakes()
  // 名震：只给主震涟漪（余震只画球）
  if (viewMode === 'famous') {
    events = events.filter((q) => q._famousMain || q.id === selectedFamousId)
    if (!events.length && selectedFamousId) {
      const fq = getFamousById(selectedFamousId)
      if (fq) events = [famousToQuakeRecord(fq)]
    }
  }
  rippleLayer.setEvents(events, exaggeration, {
    paletteLo: Math.min(depthTLo, depthTHi),
    paletteHi: Math.max(depthTLo, depthTHi),
    sizeMode,
    // 三模式同径 → 涟漪也跟历史球半径
    sizeProfile: usesLivePointSize() ? 'live' : 'history',
    // 30 天：只给稍大点涟漪（小点看不清还费 draw call）
    // 名震：主震列表本身已筛，上限 20
    maxRipples: viewMode === 'live' ? 48 : 20,
    // M≥5.0 才配涟漪；更小的只留实心球
    minMag: viewMode === 'live' ? 5.0 : 0,
    // 出现方式：整组放大+淡入 ~1.5s，脉冲等出现完再开
    fadeIn: viewMode === 'live' ? 1.55 : 1.25,
  })
}

/**
 * @param {{ reframe?: boolean, animate?: boolean }} [opts]
 */
/** 当前 look-at 地表点（导航 target） */
function getFocusPoint() {
  try {
    const s = controls.getViewState?.()
    if (s && Number.isFinite(s.tx)) {
      return { x: s.tx, y: s.ty, z: s.tz }
    }
  } catch {
    /* ignore */
  }
  // 回落：相机下方地表
  const p = camera.position
  const len = Math.hypot(p.x, p.y, p.z) || 1
  return {
    x: (p.x / len) * EARTH_RADIUS_KM,
    y: (p.y / len) * EARTH_RADIUS_KM,
    z: (p.z / len) * EARTH_RADIUS_KM,
  }
}

function applyHistoryDataset(opts = {}) {
  const focus = getFocusPoint()
  // 模式/降 cap 等主动刷新：保证 sticky 已吸满当前 wanted
  quakeTiles.expandStickyFromWanted()
  historyQuakes = quakeTiles.getDisplayQuakes(
    camera,
    focus,
    quakeTiles.maxDisplay,
    mobileViewOpts(),
  )
  lastGpuStickySig = gpuDisplaySig()
  lastGpuFocusKey = focusDisplayKey()
  allQuakes = historyQuakes
  const cSig = gpuContentSig(historyQuakes)
  // 内容没变（含仅 sticky 顺序抖）：绝不重画，否则会全场「微光」
  if (!opts.force && cSig === lastGpuContentSig && quakeMesh) {
    return
  }
  const doAnim = !!opts.animate
  // 模式切换 reframe=true 用长溶解；纯视野刷新用短
  const dur = doAnim
    ? opts.reframe !== false
      ? POINTS_XFADE_SEC
      : POINTS_XFADE_VIEW_SEC
    : undefined
  rebuildQuakes({
    reframe: opts.reframe !== false,
    animate: doAnim,
    // 模式钮 force；滑条/降 cap 非动画也 force
    force: !!opts.force || !doAnim,
    duration: dur,
  })
}

/** 瓦片同步防抖：拖动中不狂拉；停稳后再同步 */
let tileSyncTimer = 0
let lastAnimCamKey = ''
let lastSyncedCamKey = ''

/** 自适应点数上限（手机默认盖满日本全锥 ~55k；卡顿再由 adapt 降） */
let displayCap = isCompactScreen()
  ? MOBILE_DEFAULT_MAX_DISPLAY
  : DEFAULT_MAX_DISPLAY
let fpsEma = 60
let badFrameStreak = 0
let goodFrameStreak = 0
let lastCapAdjustMs = 0
/** 降 cap 后冷却：禁止立刻回升，避免「降→溶解/卡→升→双 mesh 再卡」1s 闪烁环 */
let capRaiseBlockedUntilMs = 0
/** 上次真正画到 GPU 的点场内容指纹（内容不变绝不 rebuild） */
let lastGpuContentSig = ''

/**
 * M7：按设备设 displayCap 默认并同步瓦片 store 钳位
 * @param {{ resetDefault?: boolean }} [opts] resetDefault=true 时强制回到设备默认
 */
function applyDisplayCapForDevice(opts = {}) {
  const lim = displayCapLimits()
  if (opts.resetDefault) {
    displayCap = isCompactScreen()
      ? MOBILE_DEFAULT_MAX_DISPLAY
      : DEFAULT_MAX_DISPLAY
  } else if (!isCompactScreen() && displayCap < MIN_MAX_DISPLAY) {
    // 从手机切回宽屏时，若仍卡在手机区间则抬回桌面默认
    displayCap = DEFAULT_MAX_DISPLAY
  }
  displayCap = Math.min(lim.max, Math.max(lim.min, displayCap))
  quakeTiles.setMaxDisplay(displayCap, lim)
}

function facingCamKey() {
  const f = getFocusPoint()
  const fl = Math.hypot(f.x, f.y, f.z) || 1
  const p = camera.position
  const dist = Math.hypot(p.x - f.x, p.y - f.y, p.z - f.z)
  // 只跟焦点 + 距离：绕焦点自转不改 key → 不狂刷瓦片/岸线
  return `${((f.x / fl) * 28) | 0},${((f.y / fl) * 28) | 0},${((f.z / fl) * 28) | 0},${(dist / 450) | 0}`
}

/**
 * 点场内容指纹：同内容 → 禁止 dissolve/rebuild（防 ~1s 全场微光）
 * @param {Array<{ lon?: number, lat?: number, mag?: number, depthKm?: number, time?: string, id?: string }>} quakes
 */
function gpuContentSig(quakes) {
  const n = quakes?.length ?? 0
  if (!n) {
    return `0|${displayCap}|${yearMin}|${yearMax}|${minMag}|${sizeMode}|${themeName}|${exaggeration}`
  }
  let h = n * 2654435761
  const step = Math.max(1, (n / 48) | 0)
  for (let i = 0; i < n; i += step) {
    const q = quakes[i]
    h =
      (h +
        (((q.lon ?? 0) * 100) | 0) * 73856093 +
        (((q.lat ?? 0) * 100) | 0) * 19349663 +
        (((q.mag ?? 0) * 10) | 0) * 83492791 +
        (((q.depthKm ?? 0) * 2) | 0)) |
      0
  }
  const a = quakes[0]
  const b = quakes[n - 1]
  const mid = quakes[n >> 1]
  return `${h}|${n}|${a.lon},${a.lat},${a.mag}|${mid.lon},${mid.lat}|${b.lon},${b.lat},${b.time || b.id || ''}|${displayCap}|${yearMin}|${yearMax}|${minMag}|${sizeMode}|${themeName}|${exaggeration}`
}

/**
 * 根据帧时自动降/升屏幕点上限
 * 铁律：调 cap **禁止 dissolve**；降后冷却再升，杜绝 1Hz 全场闪
 * @param {number} dtSec
 */
function adaptDisplayCap(dtSec) {
  if (!(dtSec > 0) || dtSec > 0.5) return
  // 溶解中采样的 fps 是假卡，一律忽略
  if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) return
  // 首屏锁定期：禁 cap 硬切 rebuild（会突然冒/灭一批点）
  if (isPostIntroGpuLocked() || introPlaying) return
  const fps = 1 / dtSec
  fpsEma = fpsEma * 0.92 + fps * 0.08
  const now = performance.now()
  // 至少 2.5s 调一次，避免抖
  if (now - lastCapAdjustMs < 2500) return

  const lim = displayCapLimits()
  // 只有真卡（~22fps 以下）才降；底线随设备（手机 8k / 桌面 2 万）
  if (fpsEma < 22 || dtSec > 0.055) {
    badFrameStreak++
    goodFrameStreak = 0
    if (badFrameStreak >= 18 && displayCap > lim.min) {
      displayCap = Math.max(lim.min, displayCap - 5000)
      quakeTiles.setMaxDisplay(displayCap, lim)
      lastCapAdjustMs = now
      // 降后 8s 内不准回升（溶解/重建尖刺会假性「又丝滑了」）
      capRaiseBlockedUntilMs = now + 8000
      badFrameStreak = 0
      // 回顾点池已冻：降 cap 只影响 store 上限，不重抽上屏（防闪）
      if (viewMode === 'history') {
        // 手机：降 cap 也走短溶解，避免突然少一批
        applyHistoryDataset({
          reframe: false,
          animate: isCompactScreen(),
          force: !isCompactScreen(),
        })
      }
      console.info(`[quakes] lag → maxDisplay=${displayCap} (fps~${fpsEma.toFixed(0)})`)
    }
  } else if (
    fpsEma > 52 &&
    dtSec < 0.02 &&
    now >= capRaiseBlockedUntilMs
  ) {
    goodFrameStreak++
    badFrameStreak = 0
    // ~3s 持续丝滑才升；手机升 cap 走溶解，桌面硬切（原行为）
    if (goodFrameStreak >= 180 && displayCap < lim.max) {
      displayCap = Math.min(lim.max, displayCap + 3000)
      quakeTiles.setMaxDisplay(displayCap, lim)
      lastCapAdjustMs = now
      goodFrameStreak = 0
      if (viewMode === 'history') {
        applyHistoryDataset({
          reframe: false,
          animate: isCompactScreen(),
          force: !isCompactScreen(),
        })
      }
      console.info(`[quakes] smooth → maxDisplay=${displayCap}`)
    }
  } else {
    badFrameStreak = 0
    // 中间带不立刻清 good streak，保留一点惯性
    if (fpsEma < 45) goodFrameStreak = 0
  }
}

/**
 * @param {{ force?: boolean, immediate?: boolean }} [opts]
 */
function scheduleHistoryTileSync(opts = {}) {
  if (viewMode !== 'history' && viewMode !== 'famous' && viewMode !== 'review')
    return
  // 回顾固定点池建好后禁止 re-pick（否则每年/拖镜重抽 → 整场闪烁）
  if (viewMode === 'review' && reviewPool.length > 0) return
  // 开场镜头飞行中不跟焦点换瓦片，避免抢点场
  if (introPlaying && !opts.force) return
  // 首屏点场刚溶完：禁止 tile sync 再灌一批硬冒（手机尤甚）
  if (isPostIntroGpuLocked() && !opts.force) return
  // 点场溶解进行中：禁止再排队视野 sync（否则 onComplete 连环 dissolve → 约 1s 闪一次）
  if (!opts.force && (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming))
    return
  if (opts.immediate || opts.force) {
    if (tileSyncTimer) {
      clearTimeout(tileSyncTimer)
      tileSyncTimer = 0
    }
    lastSyncedCamKey = facingCamKey()
    lastAnimCamKey = lastSyncedCamKey
    void syncHistoryTiles({
      force: !!opts.force,
      reframe: false,
      // 点场内容变 → 默认顺序溶解（先出后进，不叠亮）
      animate: opts.animate !== false,
    })
    return
  }
  const key = facingCamKey()
  if (key === lastSyncedCamKey && !tileSyncTimer) return
  if (key === lastAnimCamKey && tileSyncTimer) return
  lastAnimCamKey = key
  if (tileSyncTimer) clearTimeout(tileSyncTimer)
  tileSyncTimer = window.setTimeout(() => {
    tileSyncTimer = 0
    // 溶解/锁中：不盖 lastSyncedCamKey（盖了会以为已 sync，拖图不再补点）
    if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) {
      // 再排一次，等溶解结束
      tileSyncTimer = window.setTimeout(() => {
        tileSyncTimer = 0
        if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) {
          // 仍在溶：松手标志，允许下一帧 facing 变化再进 debounce
          lastAnimCamKey = ''
          return
        }
        if (isPostIntroGpuLocked() || introPlaying) return
        lastSyncedCamKey = facingCamKey()
        void syncHistoryTiles({ reframe: false, animate: true })
      }, TILE_SYNC_DEBOUNCE_MS)
      return
    }
    if (isPostIntroGpuLocked() || introPlaying) return
    lastSyncedCamKey = lastAnimCamKey
    // 视野补点：顺序溶解（单层先出后进）
    void syncHistoryTiles({ reframe: false, animate: true })
  }, TILE_SYNC_DEBOUNCE_MS)
}

/**
 * 上次已画到 GPU 的 sticky 签名 + cap
 * 规则：纯拖动（无新瓦片进 sticky）→ 不 rebuild；数据在内存/IDB，镜头只动相机
 */
let lastGpuStickySig = ''
/** 上次上屏时的焦点粗键；焦点大挪但 sticky 不变也要重算 pickNearest */
let lastGpuFocusKey = ''
/** sync 进行中又来请求 → 结束后补一次最新 */
let tileSyncQueued = false
/** @type {{ force?: boolean, reframe?: boolean, animate?: boolean } | null} */
let tileSyncQueuedOpts = null

function gpuDisplaySig() {
  return `${quakeTiles.stickySig()}|${displayCap}|${yearMin}|${yearMax}`
}

/** 焦点粗 discretize：与 facingCamKey 同量级，专供「要不要重挑上屏点」 */
function focusDisplayKey() {
  const f = getFocusPoint()
  const fl = Math.hypot(f.x, f.y, f.z) || 1
  return `${((f.x / fl) * 20) | 0},${((f.y / fl) * 20) | 0},${((f.z / fl) * 20) | 0}`
}

/**
 * @param {{ force?: boolean, reframe?: boolean, animate?: boolean }} [opts]
 */
async function syncHistoryTiles(opts = {}) {
  if (quakeTileSyncing) {
    tileSyncQueued = true
    // 合并排队意图：force/reframe 只升不降，避免后到的软 sync 冲掉硬切
    const prev = tileSyncQueuedOpts || {}
    tileSyncQueuedOpts = {
      force: !!(prev.force || opts.force),
      reframe: !!(prev.reframe || opts.reframe),
      animate:
        opts.animate === false || prev.animate === false
          ? false
          : opts.animate !== false,
    }
    return
  }
  quakeTileSyncing = true
  try {
    const focus = getFocusPoint()
    if (opts.force) {
      // 年份等硬切：清 sticky，按新范围重吸
      quakeTiles.clearSticky()
      lastGpuStickySig = ''
      lastGpuFocusKey = ''
    }
    const fetched = await quakeTiles.sync(camera, focus, {
      yearMin,
      yearMax,
      force: !!opts.force,
      // 开场太空：只日本 bootstrap，禁止整球灌入
      spaceLock: !!introPlaying,
      mobile: isCompactScreen(),
    })
    // 新 wanted 且已在内存 → 并入 sticky（首次展示这些瓦片才算「要画」）
    const expanded = quakeTiles.expandStickyFromWanted()
    const sig = gpuDisplaySig()
    const fKey = focusDisplayKey()
    // sticky 不变但焦点大挪时 pickNearest 会整批换点；旧逻辑只看 sticky → 复位后仍显示「反面点」
    const needGpu =
      !!opts.force ||
      fetched ||
      expanded ||
      sig !== lastGpuStickySig ||
      fKey !== lastGpuFocusKey

    if (viewMode === 'review') {
      // 回顾：只吸瓦片进内存；上屏点永远来自固定 reviewPool（切片 yearMax）
      lastGpuStickySig = sig
      lastGpuFocusKey = fKey
      if (reviewPool.length > 0) {
        allQuakes = reviewPool
        historyQuakes = reviewPool
      }
      // GPU 由 setReviewYear / enter boot 驱动，这里绝不 getDisplayQuakes 重抽
      return
    }

    if (viewMode === 'history') {
      if (!needGpu) {
        // 纯拖动：焦点格未变、瓦片未变 → 零重画
        return
      }
      historyQuakes = quakeTiles.getDisplayQuakes(
        camera,
        focus,
        displayCap,
        { ...mobileViewOpts(), yearMin, yearMax },
      )
      lastGpuStickySig = sig
      lastGpuFocusKey = fKey
      allQuakes = historyQuakes
      const cSig = gpuContentSig(historyQuakes)
      // sticky/cap 签名变了但挑点结果一样 → 仍零重画（防全场微光）
      if (!opts.force && cSig === lastGpuContentSig && quakeMesh) {
        return
      }
      rebuildQuakes({
        reframe: !!opts.reframe,
        // 内容变：默认溶解；显式 animate:false 才硬切（cap 自适应等）
        animate: opts.animate !== false,
        force: opts.animate === false || !!opts.force,
        duration: POINTS_XFADE_VIEW_SEC,
      })
    } else if (viewMode === 'famous') {
      // 名震仍按选场刷新；不跟历史 sticky 抢
      applyFamousDataset({
        reframe: false,
        animate: opts.animate === true,
      })
    }
  } finally {
    quakeTileSyncing = false
    if (tileSyncQueued) {
      const next = tileSyncQueuedOpts || {}
      tileSyncQueued = false
      tileSyncQueuedOpts = null
      void syncHistoryTiles(next)
    }
  }
}

/**
 * @param {unknown} quakes
 * @param {string} source
 * @param {{ reframe?: boolean, animate?: boolean }} [opts]
 * 轮询刷新默认不 reframe，避免每 5 分钟硬切视角
 */
function applyLiveDataset(quakes, source, opts = {}) {
  liveQuakes = Array.isArray(quakes) ? quakes : []
  liveSource = source
  const focus = getFocusPoint()
  const fl = Math.hypot(focus.x, focus.y, focus.z) || 1
  const inView = filterQuakesInView(liveQuakes, camera, focus, mobileViewOpts())
  allQuakes = pickNearestQuakes(
    inView,
    { x: focus.x / fl, y: focus.y / fl, z: focus.z / fl },
    Math.min(displayCap, 6000),
  )
  rebuildQuakes({
    reframe: !!opts.reframe,
    animate: !!opts.animate,
    force: !!opts.force || !opts.animate,
    duration: opts.animate ? POINTS_XFADE_SEC : undefined,
  })
  updateLiveStatusChip()
}

/** 实时模式状态：写在模式钮 title，错误时不静默顶着历史点 */
function updateLiveStatusChip() {
  const live = document.getElementById('eq-mode-live')
  if (!live) return
  if (viewMode !== 'live') {
    live.title = '实时 · 最近30天 USGS'
    live.removeAttribute('data-live-status')
    return
  }
  let tip = '实时'
  if (liveSource === 'loading') tip = '实时 · 加载中…'
  else if (liveSource === 'live') tip = '实时 · USGS 在线'
  else if (liveSource === 'cache') {
    tip = liveErrorMsg
      ? `实时 · 离线垫底（${liveErrorMsg}）`
      : '实时 · 本地垫底'
  } else if (liveSource === 'error') {
    tip = `实时 · 失败：${liveErrorMsg || '网络错误'}`
  }
  live.title = tip
  live.setAttribute('data-live-status', liveSource || '')
}

/** 30 天：拖图/缩放后按新焦点重裁上屏点（否则只在进模式/轮询时 cull） */
let liveCullTimer = 0
let lastLiveCullKey = ''
function scheduleLiveViewCull() {
  if (viewMode !== 'live') return
  if (liveEnterXfadeLock) return
  if (introPlaying || isPostIntroGpuLocked()) return
  if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) return
  if (!liveQuakes.length) return
  const key = facingCamKey()
  if (key === lastLiveCullKey && !liveCullTimer) return
  if (liveCullTimer) clearTimeout(liveCullTimer)
  liveCullTimer = window.setTimeout(() => {
    liveCullTimer = 0
    if (viewMode !== 'live') return
    if (liveEnterXfadeLock) return
    if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) return
    if (!liveQuakes.length) return
    lastLiveCullKey = facingCamKey()
    // 静默重裁，不抢镜头、不溶解闪
    applyLiveDataset(liveQuakes, liveSource || 'live', {
      reframe: false,
      animate: false,
      force: true,
    })
  }, TILE_SYNC_DEBOUNCE_MS)
}

function stopLiveIfAny() {
  if (stopLivePoll) {
    stopLivePoll()
    stopLivePoll = null
  }
}

/**
 * @param {'history' | 'live' | 'famous' | 'review'} mode
 * @param {{ persist?: boolean, animate?: boolean }} [opts]
 *   animate 默认 true：模式钮切换时相机平滑过渡；首屏恢复用 false
 */
function setViewMode(mode, opts = {}) {
  const next =
    mode === 'live'
      ? 'live'
      : mode === 'famous'
        ? 'famous'
        : mode === 'review'
          ? 'review'
          : 'history'
  const prev = viewMode
  // 离开回顾：停表 + 还原年份窗 + 丢固定点池
  if (prev === 'review' && next !== 'review') {
    stopReviewPlayback()
    yearMin = reviewSavedYearMin
    yearMax = reviewSavedYearMax
    reviewPool = []
    setReviewHudVisible(false)
  }
  viewMode = next
  if (opts.persist !== false) persistViewMode(viewMode)
  updateModeButtons()
  // 真切换才飞镜头；同模式重入（极少）不强制
  const animateCam = opts.animate !== false && prev !== next
  if (prev !== next) clearLiveHoverScale()

  if (viewMode === 'history') {
    stopLiveIfAny()
    liveSource = ''
    liveErrorMsg = ''
    liveEnterXfadeLock = false
    pendingLiveQuakes = null
    liveFirstPaintAnimate = false
    selectedFamousId = null
    famousMobileUserClosedList = false
    setFamousDrawerOpen(false)
    hideFamousPanel({ openListAfter: false })
    // 历史不因悬停停转；切回时清掉他模式可能留下的锁
    setHoverFreezeRotate(false)
    // 回历史默认斜俯视构图（从名震俯视切回来也要平滑）
    applyHistoryDataset({
      reframe: true,
      animate: animateCam,
      force: true,
    })
    return
  }

  if (viewMode === 'review') {
    stopLiveIfAny()
    liveSource = ''
    liveErrorMsg = ''
    liveEnterXfadeLock = false
    pendingLiveQuakes = null
    liveFirstPaintAnimate = false
    selectedFamousId = null
    famousMobileUserClosedList = false
    setFamousDrawerOpen(false)
    hideFamousPanel({ openListAfter: false })
    setHoverFreezeRotate(false)
    hideMapHint()
    enterReviewMode({ animate: animateCam, fromMode: prev })
    return
  }

  if (viewMode === 'famous') {
    stopLiveIfAny()
    liveSource = ''
    liveErrorMsg = ''
    liveEnterXfadeLock = false
    pendingLiveQuakes = null
    liveFirstPaintAnimate = false
    // 进名震默认 3·11；桌面/手机都近距离飞主震（桌面视角正中，手机 viewOffset 上移）
    if (!selectedFamousId || !getFamousById(selectedFamousId)) {
      selectedFamousId = defaultFamousId()
    }
    applyFamousDataset({
      reframe: false,
      animate: animateCam,
      force: true,
    })
    renderFamousList()
    const fq = selectedFamousId ? getFamousById(selectedFamousId) : null
    famousMobileUserClosedList = false
    // 名震模式不闪操作提示（会跟「名震列表」叠）
    hideMapHint()
    if (isCompactScreen()) {
      // 手机：只开详述在底 1/3；列表收成「名震列表」钮；镜头近距离怼主震
      famousDrawer.classList.remove('is-open')
      famousDrawer.setAttribute('aria-hidden', 'true')
      if (fq) {
        showFamousPanel(fq)
        // 先锁 viewOffset（焦点落在上 1/3），再飞近主震
        updateCameraViewOffset()
        flyCameraToQuake(famousToQuakeRecord(fq), { animate: animateCam })
      } else {
        hideFamousPanel({ openListAfter: true })
        applyFamousOverviewCamera({ animate: animateCam })
      }
      syncFamousMobileChrome()
    } else {
      // 桌面：列表可同开；详述左对齐菜单；飞近主震且画面正中（无 viewOffset）
      setFamousDrawerOpen(true)
      if (fq) {
        showFamousPanel(fq)
        updateCameraViewOffset()
        flyCameraToQuake(famousToQuakeRecord(fq), { animate: animateCam })
      } else {
        hideFamousPanel()
        applyFamousOverviewCamera({ animate: animateCam })
      }
    }
    return
  }

  // live
  selectedFamousId = null
  famousMobileUserClosedList = false
  setFamousDrawerOpen(false)
  hideFamousPanel({ openListAfter: false })
  if (prev !== 'live' || !stopLivePoll) {
    stopLiveIfAny()
    liveSource = ''
    liveErrorMsg = ''
    pendingLiveQuakes = null
    liveFirstPaintAnimate = false
    // 先尝试本地滤近30天垫底，再等网络
    const cached = filterQuakesByLastDays(historyQuakes)
    if (cached.length) {
      // 有垫底：先溶解到 cache；动画期间锁住 onData，结束再静默换 live
      liveEnterXfadeLock = !!animateCam
      applyLiveDataset(cached, 'cache', {
        reframe: true,
        animate: animateCam,
        force: true,
      })
      if (!animateCam) liveEnterXfadeLock = false
    } else {
      // 无垫底：立刻清掉历史点场，禁止「多十年历史」顶着 30 天模式名；镜头可并行飞
      liveEnterXfadeLock = false
      liveFirstPaintAnimate = !!animateCam
      liveSource = 'loading'
      liveQuakes = []
      allQuakes = []
      rebuildQuakes({
        reframe: false,
        animate: !!animateCam,
        force: !animateCam,
        duration: animateCam ? POINTS_XFADE_SEC : undefined,
      })
      if (animateCam) {
        applyCameraFrame({ animate: true })
      } else {
        applyCameraFrame({ animate: false })
      }
      updateLiveStatusChip()
    }
    stopLivePoll = startLivePoll({
      minMag: LIVE_MIN_MAG_DEFAULT,
      onData: ({ quakes, fetchedAt }) => {
        liveFetchedAt = fetchedAt
        liveErrorMsg = ''
        if (viewMode !== 'live') return
        // 进模式溶解进行中：只暂存，禁止 rebuild 硬切
        if (liveEnterXfadeLock) {
          pendingLiveQuakes = quakes
          return
        }
        // 无 cache 时首包：带溶解；之后轮询静默
        const paintAnim = liveFirstPaintAnimate
        liveFirstPaintAnimate = false
        applyLiveDataset(quakes, 'live', {
          reframe: paintAnim,
          animate: paintAnim,
        })
      },
      onError: (err) => {
        liveErrorMsg = err?.message?.slice?.(0, 40) || '网络错误'
        // 保留已有 live/cache；若全空再滤历史
        if (!liveQuakes.length) {
          const fallback = filterQuakesByLastDays(historyQuakes)
          if (fallback.length) {
            if (liveEnterXfadeLock) {
              pendingLiveQuakes = fallback
              updateLiveStatusChip()
              return
            }
            const paintAnim = liveFirstPaintAnimate
            liveFirstPaintAnimate = false
            applyLiveDataset(fallback, 'cache', {
              reframe: paintAnim,
              animate: paintAnim,
            })
          } else {
            liveSource = 'error'
            // 无任何垫底：保持空点场，别让历史多十年点顶名
            allQuakes = []
            rebuildQuakes({ reframe: false, animate: false, force: true })
            updateLiveStatusChip()
          }
        } else if (liveSource !== 'live') {
          liveSource = 'cache'
          updateLiveStatusChip()
        } else {
          updateLiveStatusChip()
        }
      },
    })
  }
}

/** 30 天进入溶解结束：解锁轮询，并静默套上期间到达的 live 数据 */
function releaseLiveEnterXfadeLock() {
  if (!liveEnterXfadeLock) return
  liveEnterXfadeLock = false
  if (viewMode !== 'live') {
    pendingLiveQuakes = null
    return
  }
  if (pendingLiveQuakes) {
    const q = pendingLiveQuakes
    pendingLiveQuakes = null
    // 静默更新（不再二次溶解/抢镜头）
    applyLiveDataset(q, 'live')
  }
}

/**
 * 只装入当前名震主震 + 历史包内 7 日余震，绝不铺全部名震球
 * @param {{ reframe?: boolean, animate?: boolean }} [opts]
 */
function applyFamousDataset(opts = {}) {
  const fq = selectedFamousId ? getFamousById(selectedFamousId) : null
  const doAnim = !!opts.animate
  const force = !!opts.force || !doAnim
  if (!fq) {
    allQuakes = []
    rebuildQuakes({
      reframe: !!opts.reframe,
      animate: doAnim,
      force,
      duration: doAnim ? POINTS_XFADE_SEC : undefined,
    })
    return
  }
  // 余震从已加载全球瓦片目录抽；异步补该场周边瓦片后再刷一次
  historyQuakes = quakeTiles.getQuakes()
  allQuakes = buildFamousSequence(fq, historyQuakes, {
    days: FAMOUS_AFTERSHOCK_DAYS,
    minMag: LIVE_MIN_MAG_DEFAULT,
  })
  rebuildQuakes({
    reframe: !!opts.reframe,
    animate: doAnim,
    force,
    duration: doAnim ? POINTS_XFADE_SEC : undefined,
  })
  const yMin = Math.min(
    yearMin,
    Number(String(fq.time || fq.date || '').slice(0, 4)) || yearMin,
  )
  void quakeTiles
    .ensureAround(fq.lon, fq.lat, { yearMin: yMin, yearMax: yearMax })
    .then(() => {
      if (viewMode !== 'famous' || selectedFamousId !== fq.id) return
      historyQuakes = quakeTiles.getQuakes()
      const next = buildFamousSequence(fq, historyQuakes, {
        days: FAMOUS_AFTERSHOCK_DAYS,
        minMag: LIVE_MIN_MAG_DEFAULT,
      })
      // 余震瓦片补齐：排队短溶解，不掐断当前转场
      const prevLen = allQuakes?.length || 0
      allQuakes = next
      if (next.length !== prevLen) {
        rebuildQuakes({
          reframe: false,
          animate: true,
          duration: POINTS_XFADE_VIEW_SEC,
        })
      }
    })
}

/** @type {gsap.core.Tween | null} */
let camFlyTween = null
/** 飞行前阻尼状态，中断时要还原 */
let camFlyPrevDamping = true
/** @type {(() => void) | null} */
let camFlyResolve = null
/** 进站开场中：禁止瓦片视野同步抢镜头/抢点场 */
let introPlaying = false
/**
 * 首屏点场落稳前禁止 tile sync / adaptCap 改 GPU（手机分批硬冒的主因）
 * performance.now() 时间戳；0 = 未锁
 */
let postIntroGpuLockUntil = 0

function isPostIntroGpuLocked() {
  return postIntroGpuLockUntil > 0 && performance.now() < postIntroGpuLockUntil
}

function killCamFly() {
  if (camFlyTween) {
    camFlyTween.kill()
    camFlyTween = null
  }
  // 中断飞行时恢复阻尼，避免一直飘
  if (controls && camFlyPrevDamping != null) {
    controls.enableDamping = camFlyPrevDamping
  }
  if (camFlyResolve) {
    const r = camFlyResolve
    camFlyResolve = null
    r()
  }
  // 用户拖图打断飞镜：若偏好自转，交给 controls 'end' 的 schedule；此处不强制开
}

// ── 回顾模式：日本上空固定 + 停转 + 1970→今 逐年堆叠（固定点池，只溶新点）──

function setReviewHudVisible(vis) {
  reviewHud.hidden = !vis
  reviewHud.setAttribute('aria-hidden', vis ? 'false' : 'true')
  reviewHud.classList.toggle('is-visible', !!vis)
  app.classList.toggle('is-review', !!vis)
}

function syncReviewHud() {
  const yearEl = document.getElementById('eq-review-year')
  const scrub = /** @type {HTMLInputElement | null} */ (
    document.getElementById('eq-review-scrub')
  )
  const playBtn = document.getElementById('eq-review-play')
  if (yearEl) yearEl.textContent = String(reviewYear)
  if (scrub) {
    scrub.max = String(YEAR_MAX)
    scrub.value = String(reviewYear)
  }
  if (playBtn) {
    playBtn.classList.toggle('is-playing', reviewPlaying)
    playBtn.setAttribute('aria-pressed', reviewPlaying ? 'true' : 'false')
    playBtn.setAttribute('aria-label', reviewPlaying ? '暂停' : '播放')
    playBtn.title = reviewPlaying ? '暂停' : '播放'
  }
  const yMinEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('eq-year-min')
  )
  const yMaxEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('eq-year-max')
  )
  const yVal = document.getElementById('eq-year-val')
  if (viewMode === 'review') {
    if (yMinEl) yMinEl.value = String(YEAR_MIN)
    if (yMaxEl) yMaxEl.value = String(reviewYear)
    if (yVal) yVal.textContent = `${YEAR_MIN}–${reviewYear}`
  }
}

function stopReviewPlayback() {
  reviewPlaying = false
  if (reviewTimer) {
    clearTimeout(reviewTimer)
    reviewTimer = 0
  }
  syncReviewHud()
}

/**
 * 进模式时建固定点池（1970–今全窗抽一次）。
 * 之后只靠 yearMax 切片，保证旧年点永远是新年的子集 → 只溶入不闪。
 */
function buildReviewPool() {
  const focus = getFocusPoint()
  quakeTiles.expandStickyFromWanted()
  // 回顾用满 cap，尽量一次装齐日本周边历史点
  const pool = quakeTiles.getDisplayQuakes(camera, focus, displayCap, {
    ...mobileViewOpts(),
    yearMin: YEAR_MIN,
    yearMax: YEAR_MAX,
  })
  reviewPool = Array.isArray(pool) ? pool.slice() : []
  return reviewPool
}

/**
 * 跳到指定年：在固定点池上切片；前进只溶新增，scrub 大跳硬切（不整场闪出）
 * @param {number} y
 * @param {{ animate?: boolean, force?: boolean }} [opts]
 */
function setReviewYear(y, opts = {}) {
  const target = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(y)))
  const prev = reviewYear
  reviewYear = target
  yearMin = YEAR_MIN
  yearMax = reviewYear
  syncReviewHud()
  if (viewMode !== 'review') return

  // 点源固定为 reviewPool；filterQuakes 按 yearMax 切片
  allQuakes = reviewPool
  historyQuakes = reviewPool

  const jumped =
    !!opts.force || Math.abs(target - prev) > 1 || target < prev
  // 前进一年：增量溶入新点；旧点 keep 原样 → 真·堆叠
  // 后退/大跳：硬切，禁止整场 dissolve（会闪）
  rebuildQuakes({
    reframe: false,
    animate: !jumped && opts.animate !== false,
    force: jumped,
    duration: 0.42,
    dissolve: !jumped,
    incremental: true,
  })
}

function reviewTick() {
  reviewTimer = 0
  if (!reviewPlaying || viewMode !== 'review') return
  if (reviewYear >= YEAR_MAX) {
    stopReviewPlayback()
    return
  }
  // 等上一帧增量溶解收尾再推下一年，避免 pending 连环
  if (quakeXfadeTween || quakeMeshOutgoing || quakeMeshIncoming) {
    reviewTimer = setTimeout(reviewTick, 80)
    return
  }
  setReviewYear(reviewYear + 1, { animate: true })
  reviewTimer = setTimeout(reviewTick, REVIEW_MS_PER_YEAR)
}

function startReviewPlayback() {
  if (viewMode !== 'review') return
  if (reviewYear >= YEAR_MAX) {
    setReviewYear(YEAR_MIN, { animate: false, force: true })
  }
  reviewPlaying = true
  syncReviewHud()
  if (reviewTimer) clearTimeout(reviewTimer)
  reviewTimer = setTimeout(reviewTick, REVIEW_MS_PER_YEAR)
}

function toggleReviewPlayback() {
  if (reviewPlaying) stopReviewPlayback()
  else startReviewPlayback()
}

function exitReviewMode() {
  stopReviewPlayback()
  setReviewHudVisible(false)
  reviewPool = []
  if (viewMode === 'review') setViewMode('history')
}

/**
 * 进回顾：藏 chrome → 锁日本上空 → 停转 → 建固定点池 → 从 1970 起
 * @param {{ animate?: boolean, fromMode?: string }} [opts]
 */
function enterReviewMode(opts = {}) {
  const animate = opts.animate !== false
  if (opts.fromMode !== 'review') {
    reviewSavedYearMin = yearMin
    reviewSavedYearMax = yearMax
  }
  setAutoRotateWanted(false)
  controls.autoRotate = false
  updateRotateButton()
  stopReviewPlayback()
  setReviewHudVisible(true)
  reviewYear = YEAR_MIN
  yearMin = YEAR_MIN
  yearMax = YEAR_MIN
  syncReviewHud()

  const bootPoolAndPaint = () => {
    if (viewMode !== 'review') return
    // 先把 1970–今 瓦片/点池吸满，再切片到 1970
    yearMin = YEAR_MIN
    yearMax = YEAR_MAX
    void syncHistoryTiles({ force: true, reframe: false, animate: false }).then(
      () => {
        if (viewMode !== 'review') return
        buildReviewPool()
        yearMin = YEAR_MIN
        yearMax = YEAR_MIN
        reviewYear = YEAR_MIN
        allQuakes = reviewPool
        historyQuakes = reviewPool
        syncReviewHud()
        // 起点：只 1970，硬切不闪
        rebuildQuakes({
          reframe: false,
          animate: false,
          force: true,
        })
      },
    )
  }

  applyCameraFrame({
    animate,
    onComplete: bootPoolAndPaint,
  })
  // 飞镜中先空点，避免旧历史点挡画面
  allQuakes = []
  historyQuakes = []
  rebuildQuakes({ reframe: false, animate: false, force: true })
  if (!animate) bootPoolAndPaint()
}

function wireReviewUi() {
  document.getElementById('eq-review-play')?.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleReviewPlayback()
  })
  document
    .getElementById('eq-review-restart')
    ?.addEventListener('click', (e) => {
      e.stopPropagation()
      stopReviewPlayback()
      setReviewYear(YEAR_MIN, { animate: false, force: true })
    })
  document
    .getElementById('eq-review-close')
    ?.addEventListener('click', (e) => {
      e.stopPropagation()
      exitReviewMode()
    })
  const scrub = /** @type {HTMLInputElement | null} */ (
    document.getElementById('eq-review-scrub')
  )
  scrub?.addEventListener('pointerdown', () => {
    stopReviewPlayback()
  })
  scrub?.addEventListener('input', () => {
    const y = Number(scrub.value)
    if (!Number.isFinite(y)) return
    setReviewYear(y, { animate: false, force: true })
  })
  // Esc 退出回顾（与圆形关闭同效）
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (viewMode !== 'review') return
    e.preventDefault()
    exitReviewMode()
  })
}

/**
 * 名震默认俯视：整列日本岛入画（手机 distance 更大，见 famousOverviewForDevice）
 * @param {{ animate?: boolean, onComplete?: () => void }} [opts]
 * @returns {Promise<void>}
 */
function applyFamousOverviewCamera(opts = {}) {
  const animate = !!opts.animate
  const overview = famousOverviewForDevice()
  const pose = cameraPoseNorthUp(
    overview.lon,
    overview.lat,
    overview.distance,
    {
      tiltDeg: overview.tiltDeg,
      headingDeg: overview.headingDeg,
    },
  )
  const endTarget = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z)
  const endPos = new THREE.Vector3(
    pose.position.x,
    pose.position.y,
    pose.position.z,
  )
  const endUp = new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z)
  controls.minDistance = MIN_DIST
  controls.maxDistance = MAX_DIST
  setAutoRotateWanted(false)
  return tweenCameraTo(endTarget, endPos, {
    animate,
    duration: CAM_MODE_SEC,
    endUp,
    northUp: true,
    onComplete: opts.onComplete,
  })
}

/**
 * 角度最短路径插值（弧度）
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/**
 * 球面上两点之间插目标点（大圆）
 * @param {THREE.Vector3} a
 * @param {THREE.Vector3} b
 * @param {number} t
 * @param {THREE.Vector3} out
 */
function slerpOnEarth(a, b, t, out) {
  const ra = a.length() || EARTH_RADIUS_KM
  const rb = b.length() || EARTH_RADIUS_KM
  const na = a.clone().multiplyScalar(1 / ra)
  const nb = b.clone().multiplyScalar(1 / rb)
  let dot = THREE.MathUtils.clamp(na.dot(nb), -1, 1)
  if (dot > 0.9995) {
    out.lerpVectors(a, b, t)
    const len = out.length() || 1
    out.multiplyScalar(((ra + (rb - ra) * t) || EARTH_RADIUS_KM) / len)
    return out
  }
  const omega = Math.acos(dot)
  const sinO = Math.sin(omega) || 1
  const w0 = Math.sin((1 - t) * omega) / sinO
  const w1 = Math.sin(t * omega) / sinO
  out.copy(na).multiplyScalar(w0).addScaledVector(nb, w1)
  const r = ra + (rb - ra) * t
  out.multiplyScalar(r / (out.length() || 1))
  return out
}

/**
 * 平滑/瞬移相机：在球坐标里直接插到终点（含正北），禁止终点再拧一次。
 * @param {THREE.Vector3} endTarget
 * @param {THREE.Vector3} endPos
 * @param {{ animate?: boolean, duration?: number, endUp?: THREE.Vector3, northUp?: boolean, onComplete?: () => void }} [opts]
 * @returns {Promise<void>}
 */
function tweenCameraTo(endTarget, endPos, opts = {}) {
  const animate = opts.animate !== false
  const duration = opts.duration ?? CAM_FLY_SEC
  const forceNorthUp = !!opts.northUp
  killCamFly()

  camFlyPrevDamping = controls.enableDamping
  controls.enableDamping = false

  // 起终点都换成统一机位状态；正北 = theta 钉在 π，动画全程朝它走
  const startState = controls.getViewState()
  const endState = controls.viewStateFromPose(endTarget, endPos)
  if (forceNorthUp) {
    endState.theta = Math.PI
  }
  // 目标点以传入 endTarget 为准（可略低于壳面看震源）
  endState.tx = endTarget.x
  endState.ty = endTarget.y
  endState.tz = endTarget.z

  const applyEnd = () => {
    controls.setViewState(endState)
    controls.enableDamping = camFlyPrevDamping
    syncViewSliders()
  }

  return new Promise((resolve) => {
    camFlyResolve = resolve

    if (!animate) {
      applyEnd()
      camFlyResolve = null
      opts.onComplete?.()
      resolve()
      return
    }

    const startTarget = new THREE.Vector3(
      startState.tx,
      startState.ty,
      startState.tz,
    )
    const endT = new THREE.Vector3(endState.tx, endState.ty, endState.tz)
    const midTarget = new THREE.Vector3()
    const proxy = { t: 0 }

    controls.autoRotate = false
    clearResumeTimer()
    updateRotateButton()

    camFlyTween = gsap.to(proxy, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        const s = proxy.t
        slerpOnEarth(startTarget, endT, s, midTarget)
        controls.setViewState({
          tx: midTarget.x,
          ty: midTarget.y,
          tz: midTarget.z,
          radius: startState.radius + (endState.radius - startState.radius) * s,
          phi: startState.phi + (endState.phi - startState.phi) * s,
          theta: lerpAngle(startState.theta, endState.theta, s),
        })
      },
      onComplete: () => {
        camFlyTween = null
        camFlyResolve = null
        // 只落一次终点，不再 setNorthUp / sync 二次改写
        applyEnd()
        // 偏好仍是自转时恢复（名震等已 setAutoRotateWanted(false) 的不恢复）
        if (userWantsAutoRotate) scheduleResumeAutoRotate()
        opts.onComplete?.()
        resolve()
      },
    })
  })
}

/**
 * 飞到单场震源附近并停转（默认可平滑过渡）
 * @param {{lon:number,lat:number,depthKm:number,mag?:number}} q
 * @param {{ animate?: boolean }} [opts]
 */
function flyCameraToQuake(q, opts = {}) {
  if (!q) return
  const animate = opts.animate !== false
  const hypo = project(q.lon, q.lat, q.depthKm ?? 0, exaggeration)
  const surf = project(q.lon, q.lat, 0, 1)
  // 目标在地表与震源之间，方便看见地下球
  const endTarget = new THREE.Vector3(
    hypo.x * 0.55 + surf.x * 0.45,
    hypo.y * 0.55 + surf.y * 0.45,
    hypo.z * 0.55 + surf.z * 0.45,
  )
  const mag = Number(q.mag) || 6
  const dist = THREE.MathUtils.clamp(280 + mag * 60, 360, 1400)
  // 飞近单场：仍正北朝上略俯视，便于辨认方位
  const pose = cameraPoseNorthUp(q.lon, q.lat, dist, {
    tiltDeg: 32,
    headingDeg: 0,
  })
  const endPos = new THREE.Vector3(
    pose.position.x,
    pose.position.y,
    pose.position.z,
  )
  const endUp = new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z)
  controls.minDistance = MIN_DIST
  controls.maxDistance = MAX_DIST
  setAutoRotateWanted(false)
  // 飞近时 target 可略沉到壳下看震源；机位仍正北
  tweenCameraTo(endTarget, endPos, {
    animate,
    duration: CAM_FLY_SEC,
    endUp,
    northUp: true,
  })
}

/**
 * 手机名震 UI 状态机：
 * - 详述开 → 列表关 + 显示「名震列表」钮
 * - 详述关 → 自动开列表（除非用户主动关了列表）
 * - 列表开 → 藏钮；列表关且无详述 → 显钮
 * - 底栏开时相机 setViewOffset，视觉中心上移到面板上方区域
 */
function syncFamousMobileChrome() {
  if (!isCompactScreen() || viewMode !== 'famous') {
    famousReopen.classList.remove('is-visible')
    updateCameraViewOffset()
    return
  }
  const panelOn = famousPanel.classList.contains('is-visible')
  const listOn = famousDrawer.classList.contains('is-open')
  // 列表开则藏钮；否则（详述 alone 或双关）显示「名震列表」
  famousReopen.classList.toggle('is-visible', !listOn)
  updateCameraViewOffset()
  void panelOn
}

/**
 * 底 1/3 有抽屉/详述时：光学中心落到「上 2/3 自由区」的中心
 * = 全屏从上往下约 1/3 处（不是底 1/3）
 *
 * three.js PerspectiveCamera：offsetY 为正 → top 减小 → 注视点在屏上偏上
 * （旧版用了负 offset，焦点会落到下半屏）
 */
function updateCameraViewOffset() {
  const w = Math.max(1, app.clientWidth || 1)
  const h = Math.max(1, app.clientHeight || 1)
  if (!isCompactScreen()) {
    camera.clearViewOffset?.()
    camera.updateProjectionMatrix?.()
    return
  }
  const sheetOpen =
    famousDrawer.classList.contains('is-open') ||
    famousPanel.classList.contains('is-visible')
  if (!sheetOpen) {
    camera.clearViewOffset?.()
    camera.updateProjectionMatrix?.()
    return
  }
  // 底栏 1/3 → 自由区中心 = 全高 1/3 处；相对几何中心上移 h/6
  const offsetY = Math.round(h / 6)
  camera.setViewOffset(w, h, 0, offsetY, w, h)
  camera.updateProjectionMatrix()
}

function setFamousDrawerOpen(open) {
  const next = !!open
  famousDrawer.classList.toggle('is-open', next)
  famousDrawer.setAttribute('aria-hidden', next ? 'false' : 'true')
  if (isCompactScreen() && viewMode === 'famous') {
    if (next) famousMobileUserClosedList = false
    // 开列表时收起详述，避免双层叠底
    if (next && famousPanel.classList.contains('is-visible')) {
      famousPanel.classList.remove('is-visible', 'is-dragging')
      famousPanel.setAttribute('aria-hidden', 'true')
      famousPanelUserMoved = false
      famousPanel.style.left = ''
      famousPanel.style.top = ''
      famousPanel.style.right = ''
      famousPanel.style.bottom = ''
      famousPanel.style.transform = ''
    }
  } else if (!isCompactScreen()) {
    famousReopen.classList.remove('is-visible')
  }
  syncFamousMobileChrome()
}

function setFamousReopenVisible(vis) {
  famousReopen.classList.toggle(
    'is-visible',
    !!vis && isCompactScreen() && viewMode === 'famous',
  )
}

/** 用户是否拖走过详述面板（拖过则换场时不重置位置）；手机锁底不拖 */
let famousPanelUserMoved = false

function hideFamousPanel(opts = {}) {
  const { openListAfter = true } = opts
  famousPanel.classList.remove('is-visible', 'is-dragging')
  famousPanel.setAttribute('aria-hidden', 'true')
  // 关掉后清拖动状态，下次打开回到默认位
  famousPanelUserMoved = false
  famousPanel.style.left = ''
  famousPanel.style.top = ''
  famousPanel.style.right = ''
  famousPanel.style.bottom = ''
  famousPanel.style.transform = ''
  // 手机：关详述 → 自动弹出列表（除非调用方禁止）
  if (
    openListAfter &&
    isCompactScreen() &&
    viewMode === 'famous' &&
    !famousMobileUserClosedList
  ) {
    famousDrawer.classList.add('is-open')
    famousDrawer.setAttribute('aria-hidden', 'false')
  }
  syncFamousMobileChrome()
}

/**
 * 默认位置：桌面 = 左缘对齐顶部菜单钮 + 垂直居中；手机 = CSS 锁底 1/3（清内联）
 */
function placeFamousPanelDefault() {
  if (famousPanelUserMoved) return
  if (!famousPanel.classList.contains('is-visible')) return
  if (isCompactScreen()) {
    // 交给 CSS 底栏；清掉可能残留的桌面 left/top
    famousPanel.style.left = ''
    famousPanel.style.top = ''
    famousPanel.style.right = ''
    famousPanel.style.bottom = ''
    famousPanel.style.transform = ''
    updateCameraViewOffset()
    return
  }
  const ar = app.getBoundingClientRect()
  // 与 .eq-left-dock / 菜单钮同左缘（CSS left: 12px）
  const dockLeft = leftDock?.offsetLeft ?? 12
  const edge = Number.isFinite(dockLeft) ? dockLeft : 12
  const pw = famousPanel.offsetWidth || 360
  const ph = famousPanel.offsetHeight || 280
  let left = edge
  let top = (ar.height - ph) / 2
  left = Math.max(4, Math.min(left, ar.width - pw - 4))
  top = Math.max(4, Math.min(top, ar.height - ph - 4))
  famousPanel.style.left = `${left}px`
  famousPanel.style.top = `${top}px`
  famousPanel.style.right = 'auto'
  famousPanel.style.bottom = 'auto'
  famousPanel.style.transform = 'none'
}

/**
 * @param {import('./famousQuakes.js').FamousQuake} fq
 */
function showFamousPanel(fq) {
  if (!fq) {
    hideFamousPanel()
    return
  }
  const magEl = document.getElementById('eq-famous-panel-mag')
  const nameEl = document.getElementById('eq-famous-panel-name')
  const metaEl = document.getElementById('eq-famous-panel-meta')
  const sumEl = document.getElementById('eq-famous-panel-summary')
  const deathsEl = document.getElementById('eq-famous-panel-deaths')
  const wikiEl = document.getElementById('eq-famous-wiki')
  if (magEl) {
    magEl.textContent =
      fq.mag != null ? `M ${Number(fq.mag).toFixed(1)}` : 'M—'
  }
  if (nameEl) nameEl.textContent = fq.name || fq.shortName
  if (metaEl) {
    const bits = [
      fq.date,
      fq.magNote || (fq.mag != null ? `M${fq.mag}` : null),
      fq.place,
      fq.depthKm != null ? `深度约 ${fq.depthKm} km` : null,
    ].filter(Boolean)
    metaEl.textContent = bits.join(' · ')
  }
  if (sumEl) sumEl.textContent = fq.summary || ''
  if (deathsEl) {
    if (fq.deaths) {
      deathsEl.hidden = false
      deathsEl.textContent = `伤亡（公开资料口径）：${fq.deaths}`
    } else {
      deathsEl.hidden = true
      deathsEl.textContent = ''
    }
  }
  if (wikiEl) {
    wikiEl.href = fq.wikiUrl || '#'
    wikiEl.style.display = fq.wikiUrl ? '' : 'none'
  }
  famousPanel.classList.add('is-visible')
  famousPanel.setAttribute('aria-hidden', 'false')
  // 手机：开详述时收列表，留「名震列表」钮
  if (isCompactScreen()) {
    famousDrawer.classList.remove('is-open')
    famousDrawer.setAttribute('aria-hidden', 'true')
    famousMobileUserClosedList = false
  }
  // 等一帧拿到真实高度再定位
  requestAnimationFrame(() => {
    placeFamousPanelDefault()
    syncFamousMobileChrome()
  })
}

/**
 * 名震详述面板：按住标题区可拖动（只改 left/top，不碰 transform）
 */
function wireFamousPanelDrag() {
  const head = famousPanel.querySelector('.eq-famous-panel-head')
  if (!head) return
  let dragging = false
  /** 指针起点（视口） */
  let originX = 0
  let originY = 0
  /** 面板起点（相对 #app） */
  let originLeft = 0
  let originTop = 0

  const onMove = (e) => {
    if (!dragging) return
    e.preventDefault()
    const ar = app.getBoundingClientRect()
    const pw = famousPanel.offsetWidth
    const ph = famousPanel.offsetHeight
    let left = originLeft + (e.clientX - originX)
    let top = originTop + (e.clientY - originY)
    left = Math.max(4, Math.min(left, ar.width - pw - 4))
    top = Math.max(4, Math.min(top, ar.height - ph - 4))
    famousPanel.style.left = `${left}px`
    famousPanel.style.top = `${top}px`
  }

  const onUp = () => {
    if (!dragging) return
    dragging = false
    famousPanel.classList.remove('is-dragging')
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    // 手机底栏锁位，禁止拖到画面中间
    if (isCompactScreen()) return
    if (e.target instanceof Element && e.target.closest('.eq-famous-close')) {
      return
    }
    e.preventDefault()
    // 先关掉过渡，再读位置，避免和动画打架
    famousPanel.classList.add('is-dragging')
    famousPanelUserMoved = true

    // 若还在默认 CSS 流，先冻成像素坐标
    const r = famousPanel.getBoundingClientRect()
    const ar = app.getBoundingClientRect()
    originLeft = r.left - ar.left
    originTop = r.top - ar.top
    famousPanel.style.left = `${originLeft}px`
    famousPanel.style.top = `${originTop}px`
    famousPanel.style.right = 'auto'
    famousPanel.style.bottom = 'auto'
    famousPanel.style.transform = 'none'

    originX = e.clientX
    originY = e.clientY
    dragging = true
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  })
}

/**
 * 点选名震：飞近 + 停转 + 涟漪 + 详述
 * @param {string} id
 * @param {{ animate?: boolean }} [opts]
 */
function selectFamous(id, opts = {}) {
  const fq = getFamousById(id)
  if (!fq) return
  const animate = opts.animate !== false
  selectedFamousId = id
  if (viewMode !== 'famous') {
    // 进模式：setViewMode 会装数据 + 点场/俯视过渡；再飞近本场
    setViewMode('famous')
    renderFamousList()
    flyCameraToQuake(famousToQuakeRecord(fq), { animate })
    showFamousPanel(fq)
    return
  }
  // 换一场：点场吸入/绽放 + 平滑飞近
  applyFamousDataset({ reframe: false, animate })
  renderFamousList()
  flyCameraToQuake(famousToQuakeRecord(fq), { animate })
  showFamousPanel(fq)
  // 桌面：列表可同开；手机：showFamousPanel 已收列表留钮
  if (!isCompactScreen()) setFamousDrawerOpen(true)
}

function renderFamousList() {
  const list = document.getElementById('eq-famous-list')
  if (!list) return
  list.innerHTML = ''
  for (const fq of FAMOUS_QUAKES) {
    const li = document.createElement('li')
    li.className = 'eq-famous-item'
    li.setAttribute('role', 'option')
    li.dataset.id = fq.id
    const active = selectedFamousId === fq.id
    li.classList.toggle('is-active', active)
    li.setAttribute('aria-selected', active ? 'true' : 'false')
    li.innerHTML = `
      <span class="eq-famous-item-mag">M${Number(fq.mag).toFixed(1)}</span>
      <span class="eq-famous-item-body">
        <span class="eq-famous-item-name">${fq.shortName}</span>
        <span class="eq-famous-item-date">${fq.date}</span>
      </span>
    `
    li.addEventListener('click', () => selectFamous(fq.id))
    list.appendChild(li)
  }
}

/**
 * 署名与彩虹像素级同宽；旋转条与彩虹等长
 * 量署名内容真实宽（scrollWidth），禁止 stretch 撑开
 */
function syncBottomRightWidth() {
  const hint = document.getElementById('eq-hint')
  const foot = document.getElementById('eq-footer') || document.querySelector('.eq-footer')
  const bar = document.getElementById('eq-depth-range')
  const box = document.querySelector('.eq-bottom-right')
  if (!foot || !bar) return

  if (hint) hint.style.width = 'auto'
  foot.style.width = 'max-content'
  foot.style.minWidth = '0'
  bar.style.width = 'auto'
  bar.style.minWidth = '0'
  if (box) {
    box.style.width = 'max-content'
    box.style.alignItems = 'flex-end'
  }

  // 强制 reflow 后量署名内容宽
  void foot.offsetWidth
  const wFoot = Math.ceil(Math.max(foot.scrollWidth, foot.getBoundingClientRect().width))
  const wHint = hint ? Math.ceil(hint.getBoundingClientRect().width) : 0
  const wBar = Math.max(wFoot, 1)
  const pxBar = `${wBar}px`

  foot.style.width = pxBar
  bar.style.width = pxBar
  bar.style.flex = '0 0 auto'
  bar.style.alignSelf = 'flex-end'
  if (hint) hint.style.width = wHint > wBar ? 'auto' : pxBar
  if (box) box.style.width = `${Math.max(wBar, wHint)}px`

  document.documentElement.style.setProperty('--eq-rotate-len', pxBar)
  document.documentElement.style.setProperty('--eq-legend-len', pxBar)
}

function syncDepthRangeUi() {
  const lo = Math.min(depthTLo, depthTHi)
  const hi = Math.max(depthTLo, depthTHi)
  const sel = document.getElementById('eq-depth-sel')
  const maskL = document.getElementById('eq-depth-mask-l')
  const maskR = document.getElementById('eq-depth-mask-r')
  const thumbLo = document.getElementById('eq-depth-lo')
  const thumbHi = document.getElementById('eq-depth-hi')
  if (sel) {
    sel.style.left = `${lo * 100}%`
    sel.style.width = `${(hi - lo) * 100}%`
  }
  if (maskL) maskL.style.width = `${lo * 100}%`
  if (maskR) {
    maskR.style.left = `${hi * 100}%`
    maskR.style.width = `${(1 - hi) * 100}%`
  }
  if (thumbLo) thumbLo.style.left = `${lo * 100}%`
  if (thumbHi) thumbHi.style.left = `${hi * 100}%`
  const track = document.getElementById('eq-depth-range')
  if (track) {
    track.title = '拖两端：用这一段颜色给全部震源上色（浅端→深端）'
  }
  syncBottomRightWidth()
}

/**
 * 色条双端拖动：隐藏式圆点
 */
function wireDepthRange() {
  const track = document.getElementById('eq-depth-range')
  const thumbLo = document.getElementById('eq-depth-lo')
  const thumbHi = document.getElementById('eq-depth-hi')
  if (!track || !thumbLo || !thumbHi) return

  const tFromClientX = (clientX) => {
    const r = track.getBoundingClientRect()
    if (r.width <= 0) return 0
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }

  /** @type {'lo' | 'hi' | null} */
  let drag = null

  const applyDrag = (clientX) => {
    if (!drag) return
    const t = tFromClientX(clientX)
    if (drag === 'lo') {
      depthTLo = Math.min(t, depthTHi - 0.02)
    } else {
      depthTHi = Math.max(t, depthTLo + 0.02)
    }
    syncDepthRangeUi()
    rebuildQuakes({ reframe: false, force: true })
  }

  const onMove = (e) => {
    if (!drag) return
    e.preventDefault()
    applyDrag(e.clientX)
  }
  const onUp = () => {
    if (!drag) return
    drag = null
    track.classList.remove('is-dragging')
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  const start = (which, e) => {
    e.preventDefault()
    e.stopPropagation()
    drag = which
    track.classList.add('is-dragging')
    thumbLo.setPointerCapture?.(e.pointerId)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    applyDrag(e.clientX)
  }

  thumbLo.addEventListener('pointerdown', (e) => start('lo', e))
  thumbHi.addEventListener('pointerdown', (e) => start('hi', e))

  // 点在色条上：靠近哪端动哪端
  track.addEventListener('pointerdown', (e) => {
    if (e.target === thumbLo || e.target === thumbHi) return
    const t = tFromClientX(e.clientX)
    const mid = (depthTLo + depthTHi) / 2
    start(t < mid ? 'lo' : 'hi', e)
  })

  syncDepthRangeUi()
}

/**
 * 释放震源 InstancedMesh
 * @param {THREE.InstancedMesh | null | undefined} mesh
 */
function disposeQuakeMesh(mesh) {
  if (!mesh) return
  scene.remove(mesh)
  // 共享 SphereGeometry 禁止 dispose（见 quakes.js sharedSphereGeo）
  if (canDisposeQuakeGeometry(mesh.geometry)) {
    mesh.geometry?.dispose?.()
  }
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => m.dispose?.())
  } else {
    mesh.material?.dispose?.()
  }
  // InstancedMesh 自带 instanceMatrix/Color 缓冲；不调 dispose 会 GPU 泄漏
  try {
    mesh.dispose?.()
  } catch {
    /* older three */
  }
}

/**
 * 待播的点场重建：溶解进行中不打断（打断 = 旧层瞬间全显 =「生硬冒出」）
 * @type {{ reframe?: boolean, animate?: boolean, duration?: number } | null}
 */
let pendingRebuild = null

/** 中断点场溶解并清掉增减量层；当前 quakeMesh 恢复常显 */
function killQuakeXfade() {
  if (quakeXfadeTween) {
    quakeXfadeTween.kill()
    quakeXfadeTween = null
  }
  if (quakeMeshOutgoing) {
    disposeQuakeMesh(quakeMeshOutgoing)
    quakeMeshOutgoing = null
  }
  if (quakeMeshIncoming) {
    disposeQuakeMesh(quakeMeshIncoming)
    quakeMeshIncoming = null
  }
  if (quakeMesh) {
    disableQuakeDissolve(quakeMesh)
  }
  // 强制打断时也放 live 进场锁（含仍在 live 模式），否则 onData 一直被吞、点场假死
  if (liveEnterXfadeLock) {
    releaseLiveEnterXfadeLock()
  }
}

/** @param {{ lon?: number, lat?: number, mag?: number, time?: string, id?: string }} q */
function quakeKey(q) {
  if (q?.id != null && q.id !== '') return `id:${q.id}`
  const lon = Number(q?.lon)
  const lat = Number(q?.lat)
  const mag = Number(q?.mag)
  const t = typeof q?.time === 'string' ? q.time : ''
  return `${lon.toFixed(3)}|${lat.toFixed(3)}|${mag.toFixed(1)}|${t}`
}

/**
 * 旧/新点场差集：稳定保留 · 减量溶出 · 增量溶入
 * @param {Array} oldList
 * @param {Array} newList
 */
function diffQuakeLists(oldList, newList) {
  const oldMap = new Map()
  for (const q of oldList || []) oldMap.set(quakeKey(q), q)
  const newMap = new Map()
  for (const q of newList || []) newMap.set(quakeKey(q), q)
  /** @type {Array} */
  const keep = []
  /** @type {Array} */
  const removed = []
  /** @type {Array} */
  const added = []
  for (const [k, q] of oldMap) {
    if (newMap.has(k)) keep.push(newMap.get(k))
    else removed.push(q)
  }
  for (const [k, q] of newMap) {
    if (!oldMap.has(k)) added.push(q)
  }
  return { keep, removed, added }
}

/**
 * 建一层点场 mesh（与 rebuild 同参数）
 * @param {Array} list
 */
function makeQuakeMesh(list) {
  return buildQuakeInstances(
    list,
    exaggeration,
    viewMode === 'famous' ? 0 : minMag,
    Math.min(depthTLo, depthTHi),
    Math.max(depthTLo, depthTHi),
    sizeMode,
    usesLivePointSize() ? 'live' : 'history',
  )
}

/**
 * 点场转场
 *
 * - incremental（平移默认）：稳定点硬切保留；减量溶出 + 增量溶入并行（不同位置，不叠亮）
 * - 大换场/首屏：整场溶入或先出后进
 * @param {THREE.InstancedMesh | null} oldMesh
 * @param {THREE.InstancedMesh | null} newMesh  全量新 mesh（大换场用）；增量路径可传 null
 * @param {number} [durationSec]
 * @param {{ dissolve?: boolean, incremental?: boolean, oldQuakes?: Array, newQuakes?: Array }} [opts]
 */
function transitionQuakeMeshes(
  oldMesh,
  newMesh,
  durationSec = POINTS_XFADE_SEC,
  opts = {},
) {
  if (quakeMeshOutgoing && quakeMeshOutgoing !== oldMesh) {
    disposeQuakeMesh(quakeMeshOutgoing)
    quakeMeshOutgoing = null
  }
  if (quakeMeshIncoming) {
    disposeQuakeMesh(quakeMeshIncoming)
    quakeMeshIncoming = null
  }
  rippleLayer.setEnabled(false)

  const finishActive = (mesh) => {
    if (mesh) disableQuakeDissolve(mesh)
    quakeXfadeTween = null
    if (usesRipples()) syncRipplesFromFiltered()
    else rippleLayer.setEnabled(false)
    releaseLiveEnterXfadeLock()
    flushPendingRebuild()
  }

  /** @param {THREE.InstancedMesh} mesh @param {number} dur @param {() => void} [done] */
  const dissolveIn = (mesh, dur, done) => {
    if (!mesh.parent) scene.add(mesh)
    enableQuakeDissolve(mesh, 'in')
    setQuakeDissolve(mesh, 0, 'in')
    const proxy = { t: 0 }
    return gsap.to(proxy, {
      t: 1,
      duration: Math.max(0.28, dur),
      ease: 'power2.out',
      onUpdate: () => setQuakeDissolve(mesh, proxy.t, 'in'),
      onComplete: () => {
        disableQuakeDissolve(mesh)
        done?.()
      },
    })
  }

  /** @param {THREE.InstancedMesh} mesh @param {number} dur @param {() => void} [done] */
  const dissolveOut = (mesh, dur, done) => {
    mesh.raycast = () => {}
    enableQuakeDissolve(mesh, 'out')
    setQuakeDissolve(mesh, 0, 'out')
    const proxy = { t: 0 }
    return gsap.to(proxy, {
      t: 1,
      duration: Math.max(0.22, dur),
      ease: 'power2.in',
      onUpdate: () => setQuakeDissolve(mesh, proxy.t, 'out'),
      onComplete: () => {
        disposeQuakeMesh(mesh)
        done?.()
      },
    })
  }

  // —— 增量路径：只溶加减量，稳定点硬切保留 ——
  if (
    opts.incremental &&
    Array.isArray(opts.oldQuakes) &&
    Array.isArray(opts.newQuakes)
  ) {
    const { keep, removed, added } = diffQuakeLists(
      opts.oldQuakes,
      opts.newQuakes,
    )
    const base = Math.max(opts.oldQuakes.length, opts.newQuakes.length, 1)
    // 纯新增（回顾逐年堆叠）：永远增量溶入，禁止因「新增占比大」掉进整场溶解
    const pureAdd = removed.length === 0 && added.length > 0 && keep.length > 0
    // 重叠够多才走增量；否则 fall through 整场（补建全量 mesh）
    if (!pureAdd && keep.length < base * 0.2) {
      if (!newMesh) newMesh = makeQuakeMesh(opts.newQuakes)
      // fall through
    } else {
      if (oldMesh) disposeQuakeMesh(oldMesh)
      if (newMesh) disposeQuakeMesh(newMesh)

      if (!removed.length && !added.length) {
        const full = makeQuakeMesh(opts.newQuakes)
        quakeMesh = full
        scene.add(full)
        finishActive(full)
        return
      }

      // 稳定点立刻常显（平移时主体不断层）；勿 disable 触发 needsUpdate
      const mainMesh = keep.length ? makeQuakeMesh(keep) : null
      quakeMesh = mainMesh
      if (mainMesh) scene.add(mainMesh)

      const dur = Math.max(0.35, durationSec)
      /** @type {THREE.InstancedMesh | null} */
      let outM = null
      /** @type {THREE.InstancedMesh | null} */
      let inM = null
      if (removed.length) {
        outM = makeQuakeMesh(removed)
        quakeMeshOutgoing = outM
        scene.add(outM)
        outM.raycast = () => {}
        enableQuakeDissolve(outM, 'out')
        setQuakeDissolve(outM, 0, 'out')
      }
      if (added.length) {
        inM = makeQuakeMesh(added)
        quakeMeshIncoming = inM
        scene.add(inM)
        enableQuakeDissolve(inM, 'in')
        setQuakeDissolve(inM, 0, 'in')
      }

      // 单一 proxy + timeline：并行驱动增减量，kill 一处即可
      const proxy = { outT: 0, inT: 0 }
      quakeXfadeTween = gsap
        .timeline({
          onComplete: () => {
            // 先建全量（同帧内替换，避免「先空一帧」）
            const full = makeQuakeMesh(opts.newQuakes)
            if (outM) {
              disposeQuakeMesh(outM)
              if (quakeMeshOutgoing === outM) quakeMeshOutgoing = null
            }
            if (inM) {
              // 只关 uniform，不改材质标志，再丢弃
              disableQuakeDissolve(inM)
              disposeQuakeMesh(inM)
              if (quakeMeshIncoming === inM) quakeMeshIncoming = null
            }
            if (quakeMesh) disposeQuakeMesh(quakeMesh)
            quakeMesh = full
            scene.add(full)
            // full 未开溶解，finish 里 disable 也只是 no-op 安全路径
            finishActive(full)
          },
        })
        .to(
          proxy,
          {
            outT: 1,
            inT: 1,
            duration: dur,
            ease: 'none',
            onUpdate: () => {
              if (outM) setQuakeDissolve(outM, proxy.outT, 'out')
              if (inM) setQuakeDissolve(inM, proxy.inT, 'in')
            },
          },
          0,
        )
      return
    }
  }

  // —— 整场：仅新溶入 ——
  if (newMesh && !oldMesh) {
    quakeMesh = newMesh
    if (!newMesh.parent) scene.add(newMesh)
    quakeXfadeTween = dissolveIn(newMesh, Math.max(0.4, durationSec), () =>
      finishActive(newMesh),
    )
    return
  }

  // —— 整场：仅旧溶出 ——
  if (oldMesh && !newMesh) {
    quakeMesh = null
    quakeMeshOutgoing = oldMesh
    quakeXfadeTween = dissolveOut(oldMesh, Math.max(0.28, durationSec * 0.7), () => {
      if (quakeMeshOutgoing === oldMesh) quakeMeshOutgoing = null
      finishActive(null)
    })
    return
  }

  // —— 整场旧+新：先出后进（模式切换等重叠少的场景）——
  if (oldMesh && newMesh) {
    quakeMesh = null
    quakeMeshOutgoing = oldMesh
    // 出阶段就挂住 newMesh，kill 时能 dispose，避免泄漏/离屏漂点
    quakeMeshIncoming = newMesh
    const outDur = Math.max(0.22, durationSec * 0.42)
    const inDur = Math.max(0.28, durationSec * 0.58)
    quakeXfadeTween = dissolveOut(oldMesh, outDur, () => {
      if (quakeMeshOutgoing === oldMesh) quakeMeshOutgoing = null
      if (quakeMeshIncoming === newMesh) quakeMeshIncoming = null
      quakeMesh = newMesh
      quakeXfadeTween = dissolveIn(newMesh, inDur, () => finishActive(newMesh))
    })
  }
}

function flushPendingRebuild() {
  if (!pendingRebuild) return
  const p = pendingRebuild
  pendingRebuild = null
  // 排队期间内容可能已与当前 GPU 一致（例如仅 cap 签名抖）→ 直接丢弃
  const filtered = filterQuakes()
  if (!p.force && !p.reframe && gpuContentSig(filtered) === lastGpuContentSig && quakeMesh) {
    return
  }
  rebuildQuakes(p)
}

/**
 * @param {{ reframe?: boolean, animate?: boolean, force?: boolean, duration?: number, dissolve?: boolean, incremental?: boolean }} [opts]
 *   animate=true：点场溶解
 *   incremental（平移默认）：只溶增减量；reframe/force 大换场走整场
 *   force=true 才允许掐断进行中的溶解
 */
function rebuildQuakes({
  reframe = false,
  animate = false,
  force = false,
  duration,
  dissolve = true,
  incremental,
} = {}) {
  const dissolving =
    !!quakeXfadeTween || !!quakeMeshOutgoing || !!quakeMeshIncoming
  // 溶解进行中：动画请求排队，不 kill（kill = 半透明瞬间变满 = 生硬冒点）
  if (animate && !force && dissolving) {
    pendingRebuild = {
      reframe: !!reframe,
      animate: true,
      force: false,
      duration: duration ?? POINTS_XFADE_VIEW_SEC,
      dissolve: dissolve !== false,
      incremental: incremental !== false && !reframe,
    }
    return
  }

  const filtered = filterQuakes()
  const cSig = gpuContentSig(filtered)
  // 内容完全一致：禁止再 dissolve/硬切（用户感知的「每秒微光」主因）
  if (!force && !reframe && cSig === lastGpuContentSig && quakeMesh) {
    pendingRebuild = null
    return
  }

  const oldMesh = quakeMesh
  const prevList = lastGpuQuakes
  if (dissolving) {
    killQuakeXfade()
  }
  // 非队列路径清掉过期 pending，避免 onComplete 又播旧意图
  if (force) pendingRebuild = null

  const xfadeDur =
    duration ?? (animate ? POINTS_XFADE_SEC : POINTS_XFADE_VIEW_SEC)
  // 平移/补瓦片：增量；模式 reframe / force 整场
  const useIncremental =
    animate &&
    incremental !== false &&
    !reframe &&
    !force &&
    !!oldMesh &&
    prevList.length > 0 &&
    filtered.length > 0

  if (filtered.length === 0) {
    lastGpuContentSig = cSig
    lastGpuQuakes = []
    if (animate && oldMesh) {
      quakeMesh = null
      transitionQuakeMeshes(oldMesh, null, xfadeDur)
    } else {
      disposeQuakeMesh(oldMesh)
      quakeMesh = null
      rippleLayer.setEnabled(false)
    }
    syncFilterLabels()
    if (!animate) {
      if (usesRipples()) syncRipplesFromFiltered()
      else rippleLayer.setEnabled(false)
    }
    if (reframe) applyCameraFrame({ animate })
    return
  }

  const nextMesh = useIncremental
    ? null
    : buildQuakeInstances(
        filtered,
        exaggeration,
        viewMode === 'famous' ? 0 : minMag,
        Math.min(depthTLo, depthTHi),
        Math.max(depthTLo, depthTHi),
        sizeMode,
        usesLivePointSize() ? 'live' : 'history',
      )

  computeFrame(filtered, exaggeration)
  placeHelpers()
  lastGpuContentSig = cSig
  lastGpuQuakes = filtered.slice()

  if (animate) {
    transitionQuakeMeshes(oldMesh, nextMesh, xfadeDur, {
      dissolve: dissolve !== false,
      incremental: useIncremental,
      oldQuakes: prevList,
      newQuakes: filtered,
    })
  } else {
    disposeQuakeMesh(oldMesh)
    const mesh =
      nextMesh ||
      buildQuakeInstances(
        filtered,
        exaggeration,
        viewMode === 'famous' ? 0 : minMag,
        Math.min(depthTLo, depthTHi),
        Math.max(depthTLo, depthTHi),
        sizeMode,
        usesLivePointSize() ? 'live' : 'history',
      )
    quakeMesh = mesh
    scene.add(quakeMesh)
    if (usesRipples()) syncRipplesFromFiltered()
    else rippleLayer.setEnabled(false)
  }

  if (reframe) applyCameraFrame({ animate })
  syncFilterLabels()
}

function resetCamera() {
  const filtered = filterQuakes()
  computeFrame(filtered.length ? filtered : allQuakes, exaggeration)
  placeHelpers()
  // 飞回后强制按新焦点重挑上屏点（防乱飞后 GPU 仍钉在反面那批）
  const redisplayAfterHome = () => {
    lastGpuFocusKey = ''
    if (viewMode === 'review') {
      // 固定点池：只重画当前 year 切片，不 re-pick
      if (reviewPool.length) {
        allQuakes = reviewPool
        historyQuakes = reviewPool
        rebuildQuakes({ reframe: false, animate: false, force: true })
      }
    } else if (viewMode === 'history') {
      applyHistoryDataset({ force: true, animate: true, reframe: false })
    } else if (viewMode === 'famous') {
      applyFamousDataset({ reframe: false, animate: true, force: true })
    }
  }
  // 名震复位到俯视总览，其它模式回默认斜俯视
  if (viewMode === 'famous') {
    applyFamousOverviewCamera({
      animate: true,
      onComplete: redisplayAfterHome,
    })
  } else {
    applyCameraFrame({ animate: true, onComplete: redisplayAfterHome })
  }
}

function syncFilterLabels() {
  const magVal = document.getElementById('eq-minmag-val')
  if (magVal) magVal.textContent = `M≥${minMag.toFixed(1)}`
  const magBtn = document.getElementById('eq-btn-mag')
  if (magBtn) {
    magBtn.title = `最小震级 M≥${minMag.toFixed(1)}`
    magBtn.classList.toggle('is-active', minMag > 4.05)
  }
  const yearVal = document.getElementById('eq-year-val')
  if (yearVal) yearVal.textContent = `${yearMin}–${yearMax}`
  const yearBtn = document.getElementById('eq-btn-year')
  if (yearBtn) {
    if (viewMode === 'live' || viewMode === 'famous') {
      yearBtn.title =
        viewMode === 'famous'
          ? '名震模式使用固定精选事件'
          : `近${LIVE_WINDOW_DAYS}天模式已固定时间窗`
      yearBtn.classList.remove('is-active')
      yearBtn.classList.add('is-disabled')
    } else {
      yearBtn.title = `年份 ${yearMin}–${yearMax}`
      yearBtn.classList.remove('is-disabled')
      yearBtn.classList.toggle(
        'is-active',
        yearMin !== YEAR_DEFAULT_MIN || yearMax !== YEAR_MAX,
      )
    }
  }
  const exagVal = document.getElementById('eq-exag-val')
  if (exagVal) exagVal.textContent = `×${exaggeration.toFixed(1)}`
  const depthBtn = document.getElementById('eq-btn-depth')
  if (depthBtn) {
    depthBtn.title = `深度夸张 ×${exaggeration.toFixed(1)}`
    depthBtn.classList.toggle('is-active', Math.abs(exaggeration - 2) > 0.05)
  }
}

function updateSizeModeButton() {
  const btn = document.getElementById('eq-size-mode')
  if (!btn) return
  const byMag = sizeMode === SIZE_MODE_MAG
  // 钮上写「当前模式」：震级 / 等大
  btn.textContent = byMag ? '震级' : '等大'
  btn.title = byMag
    ? '点大小：按震级（点此改为全部等大，方便看断层）'
    : '点大小：全部等大（点此改回按震级）'
  btn.setAttribute('aria-pressed', byMag ? 'true' : 'false')
  btn.classList.toggle('is-active', !byMag)
}

function setSizeMode(mode) {
  sizeMode =
    mode === SIZE_MODE_UNIFORM ? SIZE_MODE_UNIFORM : SIZE_MODE_MAG
  persistSizeMode(sizeMode)
  updateSizeModeButton()
  rebuildQuakes({ reframe: false, force: true })
}

function applyTheme(name) {
  themeName = normalizeThemeName(name)
  const t = THEME[themeName]
  document.documentElement.setAttribute('data-theme', themeName)
  try {
    localStorage.setItem('eq-theme', themeName)
  } catch {
    /* ignore */
  }
  setDepthPalette(themeName)
  renderer.setClearColor(t.bg, 1)
  scene.background = new THREE.Color(t.bg)
  setOutlineColor(t.coast)
  // 域名字色 = 国境线色
  document.documentElement.style.setProperty('--eq-coast', coastCssHex())
  minimap.setTheme(t)
  if (frameRadius > 0) placeHelpers()
  // 深度色条换了，震源点要重画
  if (allQuakes.length) rebuildQuakes({ reframe: false, force: true })
  if (usesRipples()) {
    rippleLayer.setPaletteWindow(
      Math.min(depthTLo, depthTHi),
      Math.max(depthTLo, depthTHi),
    )
  }
}

function closeAllPops(exceptId = null) {
  for (const id of ['eq-pop-mag', 'eq-pop-year', 'eq-pop-depth']) {
    if (exceptId && id === exceptId) continue
    const pop = document.getElementById(id)
    if (!pop) continue
    pop.hidden = true
    const btn = document.getElementById(
      id === 'eq-pop-mag'
        ? 'eq-btn-mag'
        : id === 'eq-pop-year'
          ? 'eq-btn-year'
          : 'eq-btn-depth',
    )
    if (btn) {
      btn.classList.remove('is-open')
      btn.setAttribute('aria-expanded', 'false')
    }
  }
}

function togglePop(popId, btnId) {
  const pop = document.getElementById(popId)
  const btn = document.getElementById(btnId)
  if (!pop || !btn) return
  const willOpen = pop.hidden
  closeAllPops(willOpen ? popId : null)
  pop.hidden = !willOpen
  btn.classList.toggle('is-open', willOpen)
  btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false')
}

function clearResumeTimer() {
  if (resumeTimer) {
    clearTimeout(resumeTimer)
    resumeTimer = 0
  }
}

function scheduleResumeAutoRotate() {
  clearResumeTimer()
  resumeTimer = window.setTimeout(() => {
    resumeTimer = 0
    if (userWantsAutoRotate) {
      controls.autoRotate = true
      updateRotateButton()
    }
  }, RESUME_ROTATE_MS)
}

/** 按钮跟真实 spinning 一致：转=暂停图标，停=播放三角（含拖动临时停） */
let _lastSpinningUi = null
function updateRotateButton() {
  const btn = document.getElementById('eq-toggle-rotate')
  if (!btn) return
  const spinning = !!controls.autoRotate
  if (_lastSpinningUi === spinning) return
  _lastSpinningUi = spinning
  btn.classList.toggle('is-spinning', spinning)
  btn.title = spinning ? '暂停自动旋转' : '开始自动旋转'
  btn.setAttribute('aria-label', spinning ? '暂停自动旋转' : '开始自动旋转')
  // aria-pressed = 是否正在自动转
  btn.setAttribute('aria-pressed', spinning ? 'true' : 'false')
}

function setAutoRotateWanted(on) {
  userWantsAutoRotate = on
  clearResumeTimer()
  controls.autoRotate = on
  _lastSpinningUi = null
  updateRotateButton()
}

/** 菜单闲置 1 分钟无操作才收起；小屏不默认展开 */
const MENU_IDLE_MS = 60_000
let menuOpen = false
let menuIdleTimer = 0
let mapHintTimer = 0

/** M3：手机小地球折叠 idle */
const MINIMAP_IDLE_MS = 3000
let minimapExpanded = false
let minimapIdleTimer = 0

function clearMinimapIdleTimer() {
  if (minimapIdleTimer) {
    clearTimeout(minimapIdleTimer)
    minimapIdleTimer = 0
  }
}

/**
 * 小地球展开/收起（桌面+手机同一套：默认收，拖/转展开，idle 收回）
 * @param {boolean} on
 */
function setMinimapExpanded(on) {
  clearMinimapIdleTimer()
  minimapExpanded = !!on
  minimap.setExpanded?.(minimapExpanded)
  // 尺寸 CSS transition 后再对齐一次 WebGL 缓冲
  if (minimapExpanded) {
    window.setTimeout(() => minimap.resize?.(), 380)
    minimapIdleTimer = window.setTimeout(() => {
      minimapIdleTimer = 0
      setMinimapExpanded(false)
    }, MINIMAP_IDLE_MS)
  }
}

function clearMenuIdleTimer() {
  if (menuIdleTimer) {
    clearTimeout(menuIdleTimer)
    menuIdleTimer = 0
  }
}

/**
 * 菜单不再靠 idle 自动收（默认常开；仅平移/旋转时收）
 * 保留函数名给工具交互调用处，改为 no-op 清计时
 */
function bumpMenuIdleTimer() {
  clearMenuIdleTimer()
}

function setMenuOpen(open) {
  menuOpen = !!open
  const row = document.getElementById('eq-menu-row')
  const btn = document.getElementById('eq-menu')
  row?.classList.toggle('is-open', menuOpen)
  if (btn) {
    btn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false')
    btn.title = menuOpen ? '收起工具' : '展开工具'
  }
  if (!menuOpen) {
    clearMenuIdleTimer()
    closeAllPops()
  } else {
    bumpMenuIdleTimer()
  }
}

/** 立刻藏操作提示并清计时 */
function hideMapHint() {
  const el = document.getElementById('eq-hint')
  if (mapHintTimer) {
    clearTimeout(mapHintTimer)
    mapHintTimer = 0
  }
  el?.classList.remove('is-visible')
}

/**
 * 用户手动挪过地图后：操作提示渐显，约 3s 后渐隐
 * 名震模式不闪（会被「名震列表」挡住）
 */
function flashMapHint() {
  if (viewMode === 'famous') {
    hideMapHint()
    return
  }
  const el = document.getElementById('eq-hint')
  if (!el) return
  // 强制重启动画：先卸再加
  el.classList.remove('is-visible')
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth
  el.classList.add('is-visible')
  if (mapHintTimer) clearTimeout(mapHintTimer)
  mapHintTimer = window.setTimeout(() => {
    mapHintTimer = 0
    el.classList.remove('is-visible')
  }, 3000)
}

/** @type {BeforeInstallPromptEvent | null} */
let deferredPwaPrompt = null

function isPwaStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    /** @type {{ standalone?: boolean }} */ (window.navigator).standalone === true
  )
}

function syncPwaInstallButton() {
  const btn = document.getElementById('eq-pwa-install')
  if (!btn) return
  if (isPwaStandalone()) {
    btn.textContent = '已安装'
    btn.title = '已以应用模式打开'
    btn.setAttribute('aria-disabled', 'true')
    btn.classList.add('is-disabled')
  } else if (deferredPwaPrompt) {
    btn.textContent = '安装'
    btn.title = '安装到桌面 / 主屏幕'
    btn.removeAttribute('aria-disabled')
    btn.classList.remove('is-disabled')
  } else {
    btn.textContent = '安装'
    btn.title = '安装到桌面：浏览器菜单 → 安装应用 / 添加到主屏幕'
    btn.removeAttribute('aria-disabled')
    btn.classList.remove('is-disabled')
  }
}

/**
 * PWA：捕获 beforeinstallprompt + 菜单「安装」；注册 SW（按需缓存）
 */
function wirePwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPwaPrompt = /** @type {BeforeInstallPromptEvent} */ (e)
    syncPwaInstallButton()
  })
  window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null
    syncPwaInstallButton()
  })

  const btn = document.getElementById('eq-pwa-install')
  btn?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (menuOpen) bumpMenuIdleTimer()
    if (isPwaStandalone()) {
      console.info('[pwa] already installed / standalone')
      return
    }
    if (deferredPwaPrompt) {
      try {
        deferredPwaPrompt.prompt()
        const choice = await deferredPwaPrompt.userChoice
        console.info('[pwa] install choice', choice?.outcome)
      } catch (err) {
        console.warn('[pwa] prompt failed', err)
      }
      deferredPwaPrompt = null
      syncPwaInstallButton()
      return
    }
    // 无原生 prompt（如 iOS Safari / 已拒绝）：给可操作说明
    const isiOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const tip = isiOS
      ? 'iPhone/iPad：点底部分享 →「添加到主屏幕」'
      : '请用浏览器菜单 →「安装应用」或「添加到主屏幕」\n（Chrome/Edge 地址栏右侧也可能有安装图标）'
    try {
      window.alert(tip)
    } catch {
      console.info('[pwa]', tip)
    }
  })

  syncPwaInstallButton()

  if ('serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.info('[pwa] sw registered', reg.scope),
        (err) => console.warn('[pwa] sw register failed', err),
      )
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }
}

function wireUi() {
  const exag = document.getElementById('eq-exag')
  const min = document.getElementById('eq-minmag')
  const yearMinEl = document.getElementById('eq-year-min')
  const yearMaxEl = document.getElementById('eq-year-max')
  const reset = document.getElementById('eq-reset')
  const shot = document.getElementById('eq-shot')
  const domainReload = document.getElementById('eq-domain-reload')
  const toggleRotate = document.getElementById('eq-toggle-rotate')
  const sizeModeBtn = document.getElementById('eq-size-mode')
  const menuBtn = document.getElementById('eq-menu')
  const rotate = document.getElementById('eq-rotate')
  const modeHist = document.getElementById('eq-mode-history')
  const modeLive = document.getElementById('eq-mode-live')
  const modeFamous = document.getElementById('eq-mode-famous')
  const modeReview = document.getElementById('eq-mode-review')

  modeHist?.addEventListener('click', () => {
    hideHoverCard()
    if (viewMode !== 'history') setViewMode('history')
  })
  modeLive?.addEventListener('click', () => {
    hideHoverCard()
    if (viewMode !== 'live') setViewMode('live')
  })
  modeFamous?.addEventListener('click', () => {
    hideHoverCard()
    hideMapHint()
    if (viewMode !== 'famous') setViewMode('famous')
    else if (isCompactScreen()) {
      // 再点名震：在「详述 / 列表」间切换；都关时开列表
      const panelOn = famousPanel.classList.contains('is-visible')
      const listOn = famousDrawer.classList.contains('is-open')
      if (panelOn) {
        hideFamousPanel({ openListAfter: true })
      } else if (listOn) {
        famousMobileUserClosedList = true
        setFamousDrawerOpen(false)
      } else {
        famousMobileUserClosedList = false
        setFamousDrawerOpen(true)
      }
    } else {
      setFamousDrawerOpen(!famousDrawer.classList.contains('is-open'))
    }
  })
  modeReview?.addEventListener('click', () => {
    hideHoverCard()
    hideMapHint()
    if (viewMode !== 'review') setViewMode('review')
    else toggleReviewPlayback()
  })
  wireReviewUi()

  document
    .getElementById('eq-famous-drawer-close')
    ?.addEventListener('click', () => {
      if (isCompactScreen()) famousMobileUserClosedList = true
      setFamousDrawerOpen(false)
    })
  document
    .getElementById('eq-famous-panel-close')
    ?.addEventListener('click', () => {
      // 手机关详述 → 自动开列表
      hideFamousPanel({ openListAfter: true })
    })

  // 「名震列表」：只开列表（收详述）
  famousReopen.addEventListener('click', (e) => {
    e.stopPropagation()
    if (viewMode !== 'famous') return
    famousMobileUserClosedList = false
    setFamousDrawerOpen(true)
  })

  renderFamousList()
  wireFamousPanelDrag()

  // 悬停菜单钮 → 展开（仅桌面）；手机仅 click 切换
  menuBtn?.addEventListener('pointerenter', () => {
    if (isCompactScreen()) return
    if (!menuOpen) setMenuOpen(true)
  })
  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (menuOpen) setMenuOpen(false)
    else setMenuOpen(true)
  })
  // 展开后：点/拖右侧工具才重置 5s（悬停菜单本身只负责打开）
  leftDock.addEventListener(
    'pointerdown',
    (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.id === 'eq-menu' || t.closest('#eq-menu')) return
      if (menuOpen) bumpMenuIdleTimer()
    },
    true,
  )
  leftDock.addEventListener(
    'input',
    () => {
      if (menuOpen) bumpMenuIdleTimer()
    },
    true,
  )

  const bindPop = (btnId, popId) => {
    document.getElementById(btnId)?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!menuOpen) setMenuOpen(true)
      else bumpMenuIdleTimer()
      togglePop(popId, btnId)
    })
    document.getElementById(popId)?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (menuOpen) bumpMenuIdleTimer()
    })
  }
  bindPop('eq-btn-mag', 'eq-pop-mag')
  bindPop('eq-btn-year', 'eq-pop-year')
  bindPop('eq-btn-depth', 'eq-pop-depth')

  wirePwaInstall()

  document.addEventListener('pointerdown', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    // 点菜单区外 → 收起展开的 5 个工具钮（含地图空白 / 模式钮）
    if (menuOpen && !t.closest('.eq-left-dock') && !t.closest('.eq-pop')) {
      setMenuOpen(false)
    }
    if (t.closest('.eq-tool') || t.closest('.eq-pop')) return
    closeAllPops()
    // 点信息卡外（含模式钮/菜单/地图空白）→ 关震源卡
    if (
      hoverCard.classList.contains('is-visible') &&
      !t.closest('#eq-hover-card')
    ) {
      // 点在画布上且即将拾取另一点：留给 tap/pointer 处理；模式钮等立刻关
      if (
        t.closest('.eq-mode-bar') ||
        t.closest('.eq-left-dock') ||
        t.closest('.eq-famous-drawer') ||
        t.closest('.eq-famous-panel') ||
        t.closest('.eq-famous-reopen') ||
        t.closest('.eq-bottom') ||
        t.closest('.eq-minimap') ||
        t.id === 'eq-canvas' ||
        t === canvas
      ) {
        // 画布：若是 tap 选点由 up 处理；这里对非画布外区立即关
        if (t.id !== 'eq-canvas' && t !== canvas) hideHoverCard()
      } else {
        hideHoverCard()
      }
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllPops()
      if (menuOpen) setMenuOpen(false)
      if (viewMode === 'famous') {
        hideFamousPanel()
        if (famousDrawer.classList.contains('is-open')) {
          setFamousDrawerOpen(false)
        }
      }
    }
  })

  exag?.addEventListener('input', () => {
    exaggeration = Number(exag.value)
    rebuildQuakes({ reframe: true, force: true })
    rippleLayer.setExaggeration(exaggeration)
    if (menuOpen) bumpMenuIdleTimer()
  })
  min?.addEventListener('input', () => {
    minMag = Number(min.value)
    rebuildQuakes({ reframe: true, force: true })
    if (menuOpen) bumpMenuIdleTimer()
  })
  let yearInputTimer = 0
  const onYearInput = () => {
    let a = Number(yearMinEl.value)
    let b = Number(yearMaxEl.value)
    if (a > b) {
      if (document.activeElement === yearMinEl) b = a
      else a = b
      yearMinEl.value = String(a)
      yearMaxEl.value = String(b)
    }
    yearMin = a
    yearMax = b
    syncFilterLabels()
    if (menuOpen) bumpMenuIdleTimer()
    // 拖滑条每 tick force 清 sticky 会狂闪；debounce 后再硬切
    if (yearInputTimer) clearTimeout(yearInputTimer)
    yearInputTimer = window.setTimeout(() => {
      yearInputTimer = 0
      scheduleHistoryTileSync({ force: true, immediate: true })
    }, 180)
  }
  yearMinEl?.addEventListener('input', onYearInput)
  yearMaxEl?.addEventListener('input', onYearInput)
  yearMinEl?.addEventListener('change', () => {
    if (yearInputTimer) clearTimeout(yearInputTimer)
    yearInputTimer = 0
    scheduleHistoryTileSync({ force: true, immediate: true })
  })
  yearMaxEl?.addEventListener('change', () => {
    if (yearInputTimer) clearTimeout(yearInputTimer)
    yearInputTimer = 0
    scheduleHistoryTileSync({ force: true, immediate: true })
  })

  reset?.addEventListener('click', () => {
    clearResumeTimer()
    closeAllPops()
    resetCamera()
    controls.autoRotate = userWantsAutoRotate
    _lastSpinningUi = null
    updateRotateButton()
    syncViewSliders()
  })
  // 播放/暂停：跟当前是否在转对齐（不是只翻偏好）
  toggleRotate?.addEventListener('click', () => {
    if (controls.autoRotate) {
      // 正在转 → 用户要停
      setAutoRotateWanted(false)
    } else {
      // 已停（含拖动临时停）→ 立刻开转并记偏好
      setAutoRotateWanted(true)
    }
  })
  sizeModeBtn?.addEventListener('click', () => {
    setSizeMode(
      sizeMode === SIZE_MODE_MAG ? SIZE_MODE_UNIFORM : SIZE_MODE_MAG,
    )
    if (menuOpen) bumpMenuIdleTimer()
  })
  shot?.addEventListener('click', () => {
    captureScreenshot()
  })
  domainReload?.addEventListener('click', () => {
    window.location.reload()
  })
  rotate?.addEventListener('pointerdown', () => {
    killCamFly()
    controls.autoRotate = false
    clearResumeTimer()
    updateRotateButton()
  })
  rotate?.addEventListener('input', () => {
    killCamFly()
    setAzimuthDeg(rotate.value)
    rotate.title = `水平旋转 ${Math.round(Number(rotate.value))}°`
  })
  rotate?.addEventListener('change', () => {
    if (userWantsAutoRotate) scheduleResumeAutoRotate()
    updateRotateButton()
  })

  controls.addEventListener('start', () => {
    controls.autoRotate = false
    clearResumeTimer()
    updateRotateButton()
    // 画布上手动平移/旋转 → 闪提示 + 展开小地球 + 收起菜单
    flashMapHint()
    setMinimapExpanded(true)
    if (menuOpen) setMenuOpen(false)
  })
  controls.addEventListener('end', () => {
    syncViewSliders()
    if (userWantsAutoRotate) scheduleResumeAutoRotate()
    updateRotateButton()
  })
  canvas.addEventListener(
    'wheel',
    () => {
      requestAnimationFrame(syncViewSliders)
      flashMapHint()
      setMinimapExpanded(true)
    },
    { passive: true },
  )

  // 迷你地球默认收起；触/悬停/拖图展开，闲置 3s 收回（桌面+手机同逻辑）
  setMinimapExpanded(false)
  const minimapRoot = minimap.root
  if (minimapRoot) {
    const bumpMinimap = () => {
      setMinimapExpanded(true)
    }
    minimapRoot.addEventListener('pointerdown', bumpMinimap, { passive: true })
    minimapRoot.addEventListener('pointerenter', bumpMinimap)
    minimapRoot.addEventListener('focus', bumpMinimap)
  }

  // 菜单默认展开（桌面+手机）；平移/旋转时再收
  setMenuOpen(true)
  const compactMq = window.matchMedia?.(MENU_COMPACT_MQ)
  const onCompactChange = () => {
    setMenuOpen(true)
    setMinimapExpanded(false)
    applyDisplayCapForDevice({ resetDefault: true })
    if (!isCompactScreen()) {
      famousReopen.classList.remove('is-visible')
    }
    syncHintText()
    syncBottomRightWidth()
  }
  if (compactMq?.addEventListener) {
    compactMq.addEventListener('change', onCompactChange)
  } else if (compactMq?.addListener) {
    compactMq.addListener(onCompactChange)
  }
  applyDisplayCapForDevice({ resetDefault: true })
  syncHintText()
  requestAnimationFrame(syncBottomRightWidth)

  updateRotateButton()
  updateSizeModeButton()
  updateModeButtons()
  syncFilterLabels()
  wireDepthRange()
  // 岸线可能尚未加载；主题底已设。加载后再 setOutlineColor
  applyTheme('tactical')
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms))
  })
}

/**
 * 日本地表焦点（开场时相机还在太空，不能用 getFocusPoint 裁瓦片）
 * @returns {{ x:number, y:number, z:number }}
 */
function japanHomeFocus() {
  return project(HOME_VIEW.lon, HOME_VIEW.lat, 0, 1)
}

/**
 * 岸线材质整体透明度（开场淡入用；不改颜色）
 * @param {number} opacity 0..1 乘在材质基础不透明度上
 */
function setOutlineGroupOpacity(opacity) {
  const o = Math.min(1, Math.max(0, opacity))
  const layer = outlineLayer
  if (!layer) return
  if (layer.matJapan) {
    layer.matJapan.opacity = 0.95 * o
    layer.matJapan.transparent = true
  }
  if (layer.matContext) {
    layer.matContext.opacity = 0.78 * o
    layer.matContext.transparent = true
  }
  if (layer.group) layer.group.visible = o > 0.01
}

/**
 * 岸线从焦点中心往外径向铺开。
 * Promise 在「日本近岸」铺完后立刻 resolve（点场可马上开溶）；远岸后台再补，不挡点场。
 * @param {{ duration?: number, focus?: {x:number,y:number,z:number} }} [opts]
 * @returns {Promise<void>}
 */
function revealOutlineRadial(opts = {}) {
  return new Promise((resolve) => {
    if (!outlineLayer) {
      resolve()
      return
    }
    const focus = opts.focus || getFocusPoint() || japanHomeFocus()
    // 先建满当前半球段（全部 hidden），再按角距往外露出
    outlineLayer.update(camera, {
      force: true,
      focus,
      hemisphere: true,
    })
    fillFullEarthGrid(earthGlobe)
    setOutlineGroupOpacity(1)
    if (outlineLayer.group) outlineLayer.group.visible = true
    outlineLayer.applyRadialReveal(focus, 0)

    // 日本角半径：整段时长花在这里（线性），避免 90° 里日本前 0.3s 就长完
    const japanRad = (INTRO_OUTLINE_JAPAN_DEG * Math.PI) / 180
    const fullRad = (95 * Math.PI) / 180
    const proxy = { r: 0 }
    const dur = Math.max(2.4, opts.duration ?? INTRO_OUTLINE_REVEAL_SEC)
    gsap.to(proxy, {
      r: japanRad,
      duration: dur,
      ease: 'none',
      onUpdate: () => outlineLayer?.applyRadialReveal(focus, proxy.r),
      onComplete: () => {
        // 日本近岸到位 → 立刻放行点场
        resolve()
        // 远岸后台再铺，不 await
        gsap.to(proxy, {
          r: fullRad,
          duration: 0.75,
          ease: 'power1.out',
          onUpdate: () => outlineLayer?.applyRadialReveal(focus, proxy.r),
          onComplete: () => outlineLayer?.showAllBuilt(),
        })
      },
    })
  })
}

async function init() {
  wireUi()

  // —— t0：整球 + 满经纬网立刻可见（无点、无岸线）——
  ensureEarthGlobe()
  fillFullEarthGrid(earthGlobe)
  placeHelpers()
  introPlaying = true
  controls.autoRotate = false
  updateRotateButton()
  await applyPoseCamera(INTRO_SPACE_VIEW, { animate: false })
  fillFullEarthGrid(earthGlobe)

  // 岸线数据 + 日本瓦片并行；飞镜中不显示岸线/点
  const outlineP = (async () => {
    try {
      const outline = await loadJson('/data/japan-outline.json')
      outlineLayer = new OutlineLayer()
      outlineLayer.load(outline, {
        width: app.clientWidth,
        height: app.clientHeight,
      })
      scene.add(outlineLayer.group)
      setOutlineResolution(app.clientWidth, app.clientHeight)
      setOutlineColor(THEME[themeName].coast)
      setOutlineGroupOpacity(0)
      if (outlineLayer.group) outlineLayer.group.visible = false
      // 迷你地球：同一套全球岸线抽稀后画上去（日本在东亚可辨）
      try {
        minimap.setCoasts(outline)
      } catch (e2) {
        console.warn('minimap coasts failed', e2)
      }
    } catch (e) {
      console.warn('japan outline failed', e)
    }
  })()

  const dataP = (async () => {
    try {
      applyDisplayCapForDevice({ resetDefault: true })
      await quakeTiles.loadManifest()
      await quakeTiles.ensureBootstrap({ yearMin, yearMax })
      const focus0 = japanHomeFocus()
      await quakeTiles.sync(camera, focus0, {
        yearMin,
        yearMax,
        force: true,
        spaceLock: true,
        mobile: isCompactScreen(),
      })
      quakeTiles.expandStickyFromWanted()
      const quakes = quakeTiles.getDisplayQuakes(
        camera,
        focus0,
        displayCap,
        mobileViewOpts(),
      )
      const st = quakeTiles.stats(camera, focus0)
      console.info(
        `[quakes] display=${st.display}/${st.maxDisplay} memTiles=${st.tilesInMem} memPts=${st.quakesInMem} wanted=${st.tilesWanted} coverage=${st.coverageEnd}`,
      )
      return { ok: true, quakes }
    } catch (e) {
      console.error(e)
      try {
        const quakes = await loadJson('/data/quakes.json')
        console.warn('using legacy quakes.json fallback')
        return { ok: true, quakes, legacy: true }
      } catch {
        return { ok: false }
      }
    }
  })()

  // 先让太空满网帧画出来，再飞向日本（期间仍无岸线/点）
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  )
  const flyP = applyCameraFrame({
    animate: true,
    duration: CAM_INTRO_SEC,
  })

  const [, dataRes] = await Promise.all([outlineP, dataP, flyP])

  if (!dataRes?.ok || !Array.isArray(dataRes.quakes) || !dataRes.quakes.length) {
    introPlaying = false
    showError(
      '无法加载震源数据。<br/>请运行 <code>npm run fetch-data</code> 后刷新。',
    )
    return
  }

  historyQuakes = dataRes.quakes
  // 岸线/点场落稳前保持 introPlaying：禁 tile sync / adaptCap / outline 狂刷
  lastSyncedCamKey = facingCamKey()
  lastAnimCamKey = lastSyncedCamKey
  fillFullEarthGrid(earthGlobe)

  // ① 岸线：从日本中心往外径向铺开（introPlaying 仍 true）
  await revealOutlineRadial({
    duration: INTRO_OUTLINE_REVEAL_SEC,
    focus: getFocusPoint() || japanHomeFocus(),
  })

  // 非历史模式：岸线后直接切模式
  if (viewMode === 'live' || viewMode === 'famous') {
    introPlaying = false
    setViewMode(viewMode, { persist: false, animate: true })
    if (userWantsAutoRotate) {
      controls.autoRotate = true
      updateRotateButton()
    }
    return
  }

  // ② 点场：仍处 introPlaying，禁止 sync/cap 在溶解期间/刚结束后灌第二批
  // 手机：一次用满 displayCap；桌面：introCap → 补满（第二段也溶解）
  const focusJp = getFocusPoint() || japanHomeFocus()
  // 再 sync 一次日本近景（非 spaceLock），把可见锥内瓦片一次灌进 cache
  try {
    await quakeTiles.sync(camera, focusJp, {
      yearMin,
      yearMax,
      force: true,
      spaceLock: false,
      mobile: isCompactScreen(),
    })
  } catch (e) {
    console.warn('[intro] pre-paint sync failed', e)
  }
  quakeTiles.expandStickyFromWanted()
  const introCapLimit = isCompactScreen() ? displayCap : INTRO_DISPLAY_CAP
  const introCap = Math.min(displayCap, introCapLimit)
  historyQuakes = quakeTiles.getDisplayQuakes(
    camera,
    focusJp,
    introCap,
    mobileViewOpts(),
  )
  if (!historyQuakes.length) {
    historyQuakes = (dataRes.quakes || []).slice(0, introCap)
  }
  allQuakes = historyQuakes
  lastGpuStickySig = `${quakeTiles.stickySig()}|${introCap}|${yearMin}|${yearMax}`
  lastGpuContentSig = ''
  rebuildQuakes({
    reframe: false,
    animate: true,
    dissolve: true,
    force: true,
    duration: INTRO_POINTS_DISSOLVE_SEC,
  })
  updateModeButtons()

  // 等溶解播完；桌面可补满 cap（仍溶解）
  await sleep(INTRO_POINTS_DISSOLVE_SEC * 1000 + 120)
  if (!isCompactScreen() && displayCap > introCap) {
    const full = quakeTiles.getDisplayQuakes(
      camera,
      getFocusPoint() || focusJp,
      displayCap,
      mobileViewOpts(),
    )
    if (full.length > historyQuakes.length) {
      historyQuakes = full
      allQuakes = full
      lastGpuStickySig = gpuDisplaySig()
      rebuildQuakes({
        reframe: false,
        animate: true,
        force: false,
        incremental: true,
        duration: POINTS_XFADE_VIEW_SEC,
      })
      await sleep(POINTS_XFADE_VIEW_SEC * 1000 + 100)
    } else {
      lastGpuStickySig = gpuDisplaySig()
    }
  } else {
    lastGpuStickySig = gpuDisplaySig()
  }

  // 点场落稳：解锁 intro，但手机再锁 GPU 若干秒，挡住首波 tile sync 硬冒
  lastSyncedCamKey = facingCamKey()
  lastAnimCamKey = lastSyncedCamKey
  lastGpuStickySig = gpuDisplaySig()
  introPlaying = false
  if (isCompactScreen()) {
    // 工作流复核：6s 偏短，锁到 12s 盖过首波 cap/sync
    postIntroGpuLockUntil = performance.now() + 12000
  } else {
    postIntroGpuLockUntil = 0
  }

  await sleep(180)
  if (userWantsAutoRotate) {
    controls.autoRotate = true
    updateRotateButton()
  }
  console.info(
    `[intro] space→japan ${CAM_INTRO_SEC}s · outline ${INTRO_OUTLINE_REVEAL_SEC}s · points dissolve ${INTRO_POINTS_DISSOLVE_SEC}s · n=${historyQuakes.length} · gpuLockMs=${isCompactScreen() ? 12000 : 0}`,
  )
}

function onResize() {
  const w = app.clientWidth
  const h = Math.max(app.clientHeight, 1)
  camera.aspect = w / h
  // 先设 aspect，再按底栏重算 viewOffset
  updateCameraViewOffset()
  if (!camera.view?.enabled) camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  setOutlineResolution(w, h)
  outlineLayer?.setResolution(w, h)
  minimap.resize()
  syncBottomRightWidth()
  // 未拖过的详述面板：窗口变了再居中一次
  placeFamousPanelDefault()
}

window.addEventListener('resize', onResize)

// —— 悬停震源：射线拾取 + 信息卡（指哪显哪，移开立刻没）——
const quakeRaycaster = new THREE.Raycaster()
const quakePointer = new THREE.Vector2()
let hoverActiveId = null
/** 悬停时锁死自转，离开后再按偏好恢复 */
let hoverFreezingRotate = false
/** 30 天：磁吸放大（屏幕像素半径；小点靠磁吸才能点到） */
const LIVE_HOVER_MAGNET_PX = 42
/** 悬停目标半径倍数（小震会显得更明显） */
const LIVE_HOVER_SCALE_MAX = 3.1
/** @type {number} 当前放大的 instanceId，-1=无 */
let hoverScaleInstanceId = -1
/** 当前平滑后的放大倍数 */
let hoverScaleMul = 1
/** 目标放大倍数 */
let hoverScaleTarget = 1
const _hoverNdc = new THREE.Vector3()
const _hoverProj = new THREE.Vector3()

function formatHoverTime(iso) {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return String(iso).slice(0, 19)
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(t))
  } catch {
    return new Date(t).toISOString().slice(0, 19).replace('T', ' ')
  }
}

function placeLabel(q) {
  const p = (q?.place || '').trim()
  if (p) return p
  if (q?.lon != null && q?.lat != null) {
    return `${Number(q.lat).toFixed(2)}°N, ${Number(q.lon).toFixed(2)}°E`
  }
  return '位置未知'
}

/**
 * 悬停锁转：仅 30天 / 名震（球少，读卡片时停转合理）。
 * 历史球极多，扫过就停转 = bug，历史模式一律不因悬停停转。
 */
function setHoverFreezeRotate(on) {
  if (on) {
    if (viewMode === 'history' || viewMode === 'review') {
      // 若从其它模式带着锁转切进来，松开
      if (hoverFreezingRotate) setHoverFreezeRotate(false)
      return
    }
    if (hoverFreezingRotate) return
    hoverFreezingRotate = true
    clearResumeTimer()
    controls.autoRotate = false
    _lastSpinningUi = null
    updateRotateButton()
    return
  }
  if (!hoverFreezingRotate) return
  hoverFreezingRotate = false
  if (userWantsAutoRotate) scheduleResumeAutoRotate()
  else {
    controls.autoRotate = false
    _lastSpinningUi = null
    updateRotateButton()
  }
}

/**
 * 卡片贴在光标旁，钳在视口内（不先跳 0,0）。
 * M9 手机：清内联定位，交给 CSS 底部 1/4 底栏。
 * @param {number} clientX
 * @param {number} clientY
 */
function positionHoverCard(clientX, clientY) {
  if (isCompactScreen()) {
    hoverCard.style.left = ''
    hoverCard.style.top = ''
    hoverCard.style.right = ''
    hoverCard.style.bottom = ''
    hoverCard.style.transform = ''
    return
  }
  const pad = 12
  const gap = 14
  const rect = app.getBoundingClientRect()
  const w = hoverCard.offsetWidth || 220
  const h = hoverCard.offsetHeight || 140
  let x = clientX - rect.left + gap
  let y = clientY - rect.top + gap
  if (x + w > rect.width - pad) x = clientX - rect.left - w - gap
  if (y + h > rect.height - pad) y = clientY - rect.top - h - gap
  x = Math.max(pad, Math.min(x, rect.width - w - pad))
  y = Math.max(pad, Math.min(y, rect.height - h - pad))
  hoverCard.style.left = `${x}px`
  hoverCard.style.top = `${y}px`
}

/**
 * @param {object} q
 * @param {number} clientX
 * @param {number} clientY
 * @param {string|number|null} idKey
 * @param {boolean} [contentChanged]
 */
function showHoverCard(q, clientX, clientY, idKey, contentChanged = true) {
  // 名震只用详述面板，禁止简版卡（双层叠）
  if (viewMode === 'famous') {
    hideHoverCard()
    return
  }
  if (contentChanged) {
    const magEl = document.getElementById('eq-hover-mag')
    const placeEl = document.getElementById('eq-hover-place')
    const depthEl = document.getElementById('eq-hover-depth')
    const timeEl = document.getElementById('eq-hover-time')
    const llEl = document.getElementById('eq-hover-ll')
    const mag = q.mag != null && Number.isFinite(Number(q.mag)) ? Number(q.mag) : null
    if (magEl) magEl.textContent = mag != null ? `M ${mag.toFixed(1)}` : 'M—'
    if (placeEl) placeEl.textContent = placeLabel(q)
    if (depthEl) {
      const d = q.depthKm
      depthEl.textContent =
        d != null && Number.isFinite(Number(d)) ? `${Number(d).toFixed(1)} km` : '—'
    }
    if (timeEl) timeEl.textContent = formatHoverTime(q.time)
    if (llEl) {
      llEl.textContent =
        q.lon != null && q.lat != null
          ? `${Number(q.lat).toFixed(2)}°N · ${Number(q.lon).toFixed(2)}°E`
          : '—'
    }
  }
  hoverActiveId = idKey ?? null
  hoverCard.setAttribute('aria-hidden', 'false')
  positionHoverCard(clientX, clientY)
  hoverCard.classList.add('is-visible')
  canvas.style.cursor = 'pointer'
  setHoverFreezeRotate(true)
  updateCameraViewOffset()
}

function hideHoverCard() {
  if (!hoverActiveId && !hoverCard.classList.contains('is-visible') && !hoverFreezingRotate) {
    clearLiveHoverScale()
    return
  }
  hoverCard.classList.remove('is-visible')
  hoverCard.setAttribute('aria-hidden', 'true')
  hoverActiveId = null
  canvas.style.cursor = ''
  setHoverFreezeRotate(false)
  clearLiveHoverScale()
  updateCameraViewOffset()
}

/** 30 天磁吸放大：离开 / 换模式时还原 */
function clearLiveHoverScale() {
  if (hoverScaleInstanceId >= 0 && quakeMesh) {
    setQuakeInstanceScaleMul(quakeMesh, hoverScaleInstanceId, 1)
  }
  hoverScaleInstanceId = -1
  hoverScaleMul = 1
  hoverScaleTarget = 1
}

/**
 * 射线命中；30 天模式下未命中则屏幕空间磁吸最近球
 * @returns {{ quake: object, instanceId: number } | null}
 */
function pickQuakeAt(clientX, clientY) {
  if (!quakeMesh) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  quakePointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
  quakePointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
  quakeRaycaster.setFromCamera(quakePointer, camera)
  // 略放大拾取阈值，小点更好点
  quakeRaycaster.params.Mesh = quakeRaycaster.params.Mesh || {}
  const hits = quakeRaycaster.intersectObject(quakeMesh, false)
  if (hits.length) {
    const hit = hits[0]
    const idx = hit.instanceId
    if (idx != null && idx >= 0) {
      const list = quakeMesh.userData?.quakes
      if (Array.isArray(list) && list[idx]) {
        return { quake: list[idx], instanceId: idx }
      }
    }
  }
  // 30 天：磁吸——指针附近优先吸最近的球（小点靠它）
  if (viewMode === 'live') {
    return pickQuakeMagnetic(clientX, clientY, rect)
  }
  return null
}

/**
 * 屏幕空间磁吸最近震源
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} rect
 */
function pickQuakeMagnetic(clientX, clientY, rect) {
  if (!quakeMesh) return null
  const list = quakeMesh.userData?.quakes
  if (!Array.isArray(list) || !list.length) return null
  const exag = quakeMesh.userData?.exaggeration ?? exaggeration
  const cx = clientX - rect.left
  const cy = clientY - rect.top
  let bestIdx = -1
  let bestScore = Infinity
  const maxR = LIVE_HOVER_MAGNET_PX
  const maxR2 = maxR * maxR
  // 点数通常 ≤ 数千（30 天），全扫可接受
  for (let i = 0; i < list.length; i++) {
    const q = list[i]
    const p = project(q.lon, q.lat, q.depthKm ?? 0, exag)
    _hoverProj.set(p.x, p.y, p.z)
    _hoverProj.project(camera)
    if (_hoverProj.z > 1) continue // 相机后
    const sx = (_hoverProj.x * 0.5 + 0.5) * rect.width
    const sy = (-_hoverProj.y * 0.5 + 0.5) * rect.height
    const dx = sx - cx
    const dy = sy - cy
    const d2 = dx * dx + dy * dy
    if (d2 > maxR2) continue
    // 越近分越高；小震略优先（半径小更需要磁吸）
    const mag = Number(q.mag) || 4.5
    const sizeBias = 1 + Math.max(0, 6.5 - mag) * 0.08
    const score = d2 / sizeBias
    if (score < bestScore) {
      bestScore = score
      bestIdx = i
    }
  }
  if (bestIdx < 0) return null
  return { quake: list[bestIdx], instanceId: bestIdx }
}

/**
 * 设定 30 天悬停放大目标（animate 里丝滑插值）
 * @param {number} instanceId
 */
function setLiveHoverScaleTarget(instanceId) {
  if (viewMode !== 'live') {
    clearLiveHoverScale()
    return
  }
  if (instanceId !== hoverScaleInstanceId && hoverScaleInstanceId >= 0 && quakeMesh) {
    // 换目标：先还原旧点
    setQuakeInstanceScaleMul(quakeMesh, hoverScaleInstanceId, 1)
    hoverScaleMul = 1
  }
  hoverScaleInstanceId = instanceId
  // 小震放得更大一点
  const q = quakeMesh?.userData?.quakes?.[instanceId]
  const mag = Number(q?.mag) || 5
  const boost = mag < 5 ? LIVE_HOVER_SCALE_MAX : mag < 6 ? 2.4 : 1.9
  hoverScaleTarget = boost
}

/** 每帧平滑放大 / 还原 */
function tickLiveHoverScale(dt) {
  if (viewMode !== 'live' || !quakeMesh) {
    if (hoverScaleInstanceId >= 0) clearLiveHoverScale()
    return
  }
  if (hoverScaleInstanceId < 0 && hoverScaleMul <= 1.01) return
  // 指数平滑 ~12Hz 到目标
  const k = 1 - Math.exp(-(dt || 0.016) * 12)
  const target = hoverScaleInstanceId >= 0 ? hoverScaleTarget : 1
  hoverScaleMul += (target - hoverScaleMul) * k
  if (hoverScaleInstanceId >= 0) {
    setQuakeInstanceScaleMul(quakeMesh, hoverScaleInstanceId, hoverScaleMul)
  }
  if (hoverScaleInstanceId < 0 && hoverScaleMul < 1.02) {
    hoverScaleMul = 1
  }
}

function onCanvasPointerMove(e) {
  // 手机无 hover：走 tap；桌面鼠标仍跟手
  if (isCompactScreen() && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
    return
  }
  // 按着拖：立刻收卡并解除锁转（交给 controls 的 start 逻辑）
  if (e.buttons !== 0) {
    hideHoverCard()
    return
  }
  // 名震模式：只用详述面板，禁止简版 hover 卡
  if (viewMode === 'famous') {
    hideHoverCard()
    return
  }
  const hit = pickQuakeAt(e.clientX, e.clientY)
  if (!hit) {
    hideHoverCard()
    return
  }
  if (viewMode === 'live') {
    setLiveHoverScaleTarget(hit.instanceId)
  }
  const key = hit.quake.id ?? `${hit.instanceId}:${hit.quake.time}:${hit.quake.mag}`
  if (key === hoverActiveId && hoverCard.classList.contains('is-visible')) {
    // 同一点：只跟手挪卡片，不重填
    positionHoverCard(e.clientX, e.clientY)
    setHoverFreezeRotate(true)
    return
  }
  showHoverCard(hit.quake, e.clientX, e.clientY, key, true)
}

/** M9：触控 tap 拾取（位移 <12px 且 <400ms） */
const TAP_MAX_MS = 400
const TAP_MAX_DIST = 12
/** @type {{ x:number, y:number, t:number, id:number, pointerType:string } | null} */
let tapStart = null
/** 多指触控取消 tap */
const activePointers = new Set()

function onCanvasPointerDownTap(e) {
  activePointers.add(e.pointerId)
  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    if (activePointers.size === 1) {
      tapStart = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        id: e.pointerId,
        pointerType: e.pointerType,
      }
    } else {
      tapStart = null
    }
  } else {
    tapStart = null
  }
}

function onCanvasPointerUpTap(e) {
  activePointers.delete(e.pointerId)
  if (!tapStart || tapStart.id !== e.pointerId) {
    if (activePointers.size === 0) tapStart = null
    return
  }
  const start = tapStart
  tapStart = null
  if (!isCompactScreen()) return
  const dt = performance.now() - start.t
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (dt > TAP_MAX_MS || dx * dx + dy * dy > TAP_MAX_DIST * TAP_MAX_DIST) {
    return
  }
  const hit = pickQuakeAt(e.clientX, e.clientY)
  if (!hit) {
    hideHoverCard()
    return
  }
  // 名震：只走详述/飞近，绝不弹简版信息卡（避免与详述叠两层）
  if (viewMode === 'famous') {
    hideHoverCard()
    const q = hit.quake
    if (q._famousMain || (q.id && getFamousById(q.id))) {
      selectFamous(q.id || selectedFamousId, { animate: true })
    } else {
      flyCameraToQuake(q, { animate: true })
    }
    return
  }
  if (viewMode === 'live') {
    setLiveHoverScaleTarget(hit.instanceId)
  }
  const key =
    hit.quake.id ?? `${hit.instanceId}:${hit.quake.time}:${hit.quake.mag}`
  showHoverCard(hit.quake, e.clientX, e.clientY, key, true)
}

function onCanvasPointerCancelTap(e) {
  activePointers.delete(e.pointerId)
  if (tapStart && tapStart.id === e.pointerId) tapStart = null
  if (activePointers.size === 0) tapStart = null
}

/** 名震模式：点主震=换场+平滑飞近；点余震=平滑飞到该球（手机走 tap，避免与 click 双飞） */
function onCanvasClick(e) {
  if (viewMode !== 'famous') return
  if (e.button !== 0) return
  // 手机：onCanvasPointerUpTap 已处理，合成 click 不再重复
  if (isCompactScreen()) return
  const hit = pickQuakeAt(e.clientX, e.clientY)
  if (!hit?.quake) return
  hideHoverCard()
  const q = hit.quake
  if (q._famousMain || (q.id && getFamousById(q.id))) {
    selectFamous(q.id || selectedFamousId, { animate: true })
    return
  }
  // 余震：只平滑飞近，不换主震列表
  flyCameraToQuake(q, { animate: true })
}
canvas.addEventListener('click', onCanvasClick)

// 用户拖地图时中断相机飞行动画，避免抢手
controls.addEventListener('start', () => {
  killCamFly()
})

function onCanvasPointerLeave() {
  // 触控离开不强制收卡（点空白由 tap 处理）
  if (isCompactScreen()) return
  hideHoverCard()
}

canvas.addEventListener('pointermove', onCanvasPointerMove)
canvas.addEventListener('pointerleave', onCanvasPointerLeave)
canvas.addEventListener('pointerdown', onCanvasPointerDownTap, { passive: true })
canvas.addEventListener('pointerup', onCanvasPointerUpTap)
canvas.addEventListener('pointercancel', onCanvasPointerCancelTap)
// 拖动开始：立刻收卡
controls.addEventListener('start', () => {
  hideHoverCard()
})

/** 岸线重建节流：飞镜/开场中密集 update 会狂建 Line2 卡顿 */
let lastOutlineUpdateMs = 0

function animate() {
  requestAnimationFrame(animate)
  const now = performance.now()
  const dt = Math.min(0.05, (now - lastFrameMs) / 1000)
  lastFrameMs = now
  animClock += dt
  // 飞镜头期间 gsap 接管姿态，不跑 nav.update（避免抢）
  if (!camFlyTween) controls.update()
  // 岸线 + 经纬网：开场飞镜中完全冻结（防截断乱闪）；落地后再跟焦点
  if (!introPlaying) {
    const spinning = !!controls.autoRotate && !camFlyTween
    const outlineGap = camFlyTween ? 500 : spinning ? 900 : 140
    if (now - lastOutlineUpdateMs >= outlineGap) {
      lastOutlineUpdateMs = now
      const focus = getFocusPoint()
      outlineLayer?.update(camera, { focus })
      updateEarthGrid(earthGlobe, camera)
    }
  }
  // 震源：焦点变了才排队；自转同焦点不触发
  if (
    viewMode === 'history' ||
    viewMode === 'famous' ||
    viewMode === 'review'
  ) {
    scheduleHistoryTileSync()
  } else if (viewMode === 'live') {
    scheduleLiveViewCull()
  }
  // 溶解双 mesh 期间别再自适应改 cap（会连环 rebuild）
  if (!quakeXfadeTween && !quakeMeshIncoming && !introPlaying) adaptDisplayCap(dt)
  rippleLayer.tick(animClock)
  tickLiveHoverScale(dt)
  // 自转/拖动改写 autoRotate 时，按钮图标跟真值
  updateRotateButton()
  renderer.render(scene, camera)
  // 迷你地球：完整圆球 + 水平转经度 + 三角箭头（位置+航向）
  minimap.sync(camera, getFocusPoint(), dt, getAzimuthDeg())
}

init()
animate()
