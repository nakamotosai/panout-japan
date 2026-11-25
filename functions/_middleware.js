/* japan.ouuut.com · Cloudflare Pages Edge Middleware
 * 1. 退役的 `?lang=ja|zh|en` 变体 → 301/302 到真语言目录并写 pj_lang cookie。
 * 2. 裸路径（/、/weather/、/quake/、/crime/、/cabinet/、/housing/、/population/）自适应浏览器语言：
 *    - 爬虫 / 监控探针 / 无 Accept-Language 原样放行（保护 SEO、Kuma 探针与 deploy_site.py 校验）。
 *    - 尊重用户手动切换写入的 `pj_lang` cookie（ja | zh-Hans | zh-Hant | en）。
 *    - 自动识别浏览器 Accept-Language：含 zh-Hant/TW/HK/MO → /zh-Hant；含 zh → /zh-Hans；
 *      纯 ja → 留根路径 /；纯 en → /en；其余所有语言默认回落中文 /zh-Hans。
 */
const PREFIX = {
  ja: '',
  'zh-hans': '/zh-Hans',
  zh: '/zh-Hans',
  'zh-hant': '/zh-Hant',
  en: '/en',
};

const COOKIE_PREFIX = {
  ja: '',
  'zh-Hans': '/zh-Hans',
  'zh-Hant': '/zh-Hant',
  en: '/en',
};

const AUTO_ROUTES = new Set([
  '/',
  '/weather/',
  '/quake/',
  '/crime/',
  '/cabinet/',
  '/housing/',
  '/population/',
]);

const BOT = /(bot\b|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|twitterbot|slackbot|discordbot|embedly|pinterest|vkshare|validator|google|mediapartners|adsbot|applebot|yandex|baidu|duckduck|semrush|ahrefs|screaming|petal|bytespider|chatgpt|gptbot|claudebot|perplexity|oai-searchbot|panout-japan-watch|panout-weather-watch|panoutjapan-deploy|curl|python-urllib)/i;

function readLangCookie(cookieHeader) {
  const m = /(?:^|;\s*)pj_lang=(ja|zh-Hans|zh-Hant|en)\b/.exec(cookieHeader || '');
  return m ? m[1] : null;
}

function pickLang(acceptLanguage) {
  const al = (acceptLanguage || '').toLowerCase();
  const tags = al.split(',').map(s => s.split(';')[0].trim()).filter(Boolean);
  for (const t of tags) {
    if (t.startsWith('zh')) {
      return /(hant|[-_](tw|hk|mo))/.test(t) ? 'zh-Hant' : 'zh-Hans';
    }
  }
  for (const t of tags) {
    if (t.startsWith('ja')) return 'ja';
    if (t.startsWith('en')) return 'en';
  }
  return 'zh-Hans';
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const raw = url.searchParams.get('lang');
  if (raw) {
    const key = raw.trim().toLowerCase();
    const prefix = PREFIX[key];
    if (prefix !== undefined) {
      const rest = url.pathname.replace(/^\/(zh-Hans|zh-Hant|en)(?=\/|$)/, '') || '/';
      url.pathname = prefix + rest;
      url.searchParams.delete('lang');
      return Response.redirect(url.toString(), 301);
    }
  }

  const path = url.pathname;
  const normPath = path === '/' ? '/' : (path.endsWith('/') ? path : path + '/');
  if (!AUTO_ROUTES.has(normPath)) {
    return context.next();
  }

  const dest = request.headers.get('Sec-Fetch-Dest');
  const accept = request.headers.get('Accept') || '';
  const isDoc = dest === 'document' || (!dest && accept.includes('text/html'));
  if (!isDoc) return context.next();

  const ua = request.headers.get('User-Agent') || '';
  const al = request.headers.get('Accept-Language') || '';
  if (!al || BOT.test(ua)) return context.next();

  const saved = readLangCookie(request.headers.get('Cookie'));
  const targetLang = saved || pickLang(al);
  const targetPrefix = COOKIE_PREFIX[targetLang] ?? '/zh-Hans';
  if (!targetPrefix) {
    return context.next();
  }

  const targetUrl = new URL(targetPrefix + normPath + url.search, url.origin);
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl.toString(),
      'Cache-Control': 'private, no-store',
      Vary: 'Accept-Language, Cookie',
    },
  });
}
