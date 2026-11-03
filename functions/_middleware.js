/* 退役的 `?lang=ja|zh|en` 变体 → 301 到真语言目录。
 *
 * 四语真静态页上线后,旧客户端 i18n 的入口(`/quake/?lang=zh` 之类)仍会返回 200,
 * 内容和 `/quake/` 一样、canonical 也指回 `/quake/`——对爬虫是同一份文档的两个 URL。
 * `_redirects` 不匹配 query,所以这条规则放在 Pages Functions 的中间件里;其余请求原样放行。
 *
 * 语言前缀先剥掉再拼,避免 `/zh-Hant/quake/?lang=en` 变成 `/en/zh-Hant/quake/`;
 * `lang` 参数在跳转目标里删掉,避免第二次请求又命中本规则。
 *
 * 位置:wrangler 的 Functions 目录按 **cwd** 解析(`<cwd>/functions`),而部署命令是
 * `wrangler pages deploy site`(从仓库根跑),所以这份文件必须留在**仓库根**的
 * `functions/` 里 —— 放进 `site/` 里不会被打包。校验:`python src/build.py` 有存在性闸,
 * 本地行为用 `wrangler pages dev site` + `curl -sI 'http://127.0.0.1:<port>/quake/?lang=zh'`。
 */
const PREFIX = {
  ja: '',
  'zh-hans': '/zh-Hans',
  zh: '/zh-Hans',          // 旧 i18n.json 里的 `zh` = 简体
  'zh-hant': '/zh-Hant',
  en: '/en',
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get('lang');
  if (raw) {
    const prefix = PREFIX[raw.trim().toLowerCase()];
    if (prefix !== undefined) {
      const rest = url.pathname.replace(/^\/(zh-Hans|zh-Hant|en)(?=\/|$)/, '') || '/';
      url.pathname = prefix + rest;
      url.searchParams.delete('lang');
      return Response.redirect(url.toString(), 301);
    }
  }
  return context.next();
}
