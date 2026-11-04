/* Pan Out Japan · Weather — selected design C, map first.
   All forecasts are the official JMA snapshot in data.js. No long prose, no
   fabricated observations, no runtime API dependency. */
(function () {
  'use strict';
  var DATA = window.WEATHER_DATA;
  var GEO = window.WEATHER_GEO;
  var regions = DATA && DATA.regions || [];
  var byId = Object.fromEntries(regions.map(function (r) { return [r.id, r]; }));
  var saved = null;
  // 语言:构建期写死的 <html data-view-lang> 是权威(shell 的章节视图用同一处),zh-Hans 与
  // zh-Hant 共用 zh 词表,繁体由 app/hant.js 的 s2tw 表在运行时转出。
  // 2026-11-04 修:曾经在 DOMContentLoaded 里把原始 lang 直接写回 lang 变量,
  // T["zh-Hans"] 不存在 → /zh-Hans/ 与 /zh-Hant/ 的天气页整块回落到日语。
  var rawLang = String(document.documentElement.dataset.viewLang ||
                       document.documentElement.lang || 'ja');
  var hant = /^zh-hant/i.test(rawLang);
  var lang = (function (raw) {
    raw = String(raw || '').toLowerCase();
    if (raw.indexOf('zh') === 0) return 'zh';
    if (raw.indexOf('en') === 0) return 'en';
    return 'ja';
  })(rawLang);
  // 繁体只在「中文原文」上过转换表:日文回退串(如 nameJa)原样保留,免得把 関 之类的
  // 日本汉字当成简体字改写。
  function zh(s) {
    return hant && typeof s === 'string' && typeof window.__pjToHant === 'function'
      ? window.__pjToHant(s) : s;
  }
  var state = { selected: '130000', day: 0, pickerOpen: false, filter: '' };
  var T = {
    ja: {
      title: '日本の天気', eyebrow: '天気 / 全国47都道府県', choose: '都道府県を選ぶ', chooseHint: '地図または一覧から選べます',
      today: '今日', tomorrow: '明日', yesterday: '昨日', high: '最高', low: '最低', rain: '降水確率', issued: '発表', retrieved: '取得',
      stale: 'このお知らせは {d} の発表分です。本日({t})の分はまだ取得できていないため、「今日」はこの日を指します。',
      week: 'これから7日間', weekSub: '最高 / 最低気温と降水確率', places: '47都道府県', placesSub: '一覧から選ぶ',
      confidence: '信頼度', original: '気象庁原文', sourceLink: '発表元の予報 ↗', details: '出典と見方',
      note: '気象庁の予報を都道府県ごとに整列した天気図です。気温は予報値で、現在の観測値ではありません。',
      scope: '天気と降水確率は都道府県内の代表予報区、気温は公式に対応する代表地点の値です。今日の降水確率は表示時刻の6時間区分、明日以降は日別値です。未発表の気温は空欄にしています。',
      natural: '地形: Natural Earth（パブリックドメイン）。境界は表示用です。', official: '気象庁の天気予報',
      noData: '未発表', noResults: '一致する地名がありません。', hint: '地図を選ぶと予報が切り替わります。',
      mapTitle: '日本全国の天気予報図', mapInstruction: '都道府県を選択', regionMap: '日本全国',
      search: '地名を検索', searchPlaceholder: '東京 / Osaka / 北海道…', groupLabels: { 北海道:'北海道', 東北:'東北', 関東:'関東', 中部:'中部', 近畿:'近畿', 中国:'中国', 四国:'四国', 九州:'九州', 沖縄:'沖縄' }
    },
    zh: {
      title: '日本天气', eyebrow: '天气 / 全国 47 都道府县', choose: '选择都道府县', chooseHint: '可点地图或从列表选择',
      today: '今天', tomorrow: '明天', yesterday: '昨天', high: '最高', low: '最低', rain: '降水概率', issued: '发布', retrieved: '获取',
      stale: '本站的气象厅预报是 {d} 发布的那一份;今天({t})的预报尚未取到,所以页面里的「今天」指的是 {d}。',
      week: '未来 7 天', weekSub: '最高 / 最低气温与降水概率', places: '47 个都道府县', placesSub: '从列表选择',
      confidence: '可信度', original: '气象厅日文原文', sourceLink: '查看官方预报 ↗', details: '来源与阅读方式',
      note: '本页把日本气象厅的预报按都道府县整理成天气图。气温为预报值，不是实时观测。',
      scope: '天气与降水概率采用都道府县内的代表预报区；气温为官方对应的代表地点。今日降水概率为所标时段的6小时概率，明日及以后为日值。未发布的气温留空。',
      natural: '地形：Natural Earth（公共领域）。边界仅用于展示。', official: '日本气象厅天气预报',
      noData: '未发布', noResults: '没有匹配的地名。', hint: '选择地图，查看当地预报。',
      mapTitle: '日本 47 都道府县天气预报图', mapInstruction: '选择都道府县', regionMap: '日本全国',
      search: '搜索地名', searchPlaceholder: '东京 / Osaka / 北海道…', groupLabels: { 北海道:'北海道', 東北:'东北', 関東:'关东', 中部:'中部', 近畿:'近畿', 中国:'中国', 四国:'四国', 九州:'九州', 沖縄:'冲绳' }
    },
    en: {
      title: 'Japan weather', eyebrow: 'WEATHER / 47 PREFECTURES', choose: 'Choose a prefecture', chooseHint: 'Select on the map or from the list',
      today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', high: 'High', low: 'Low', rain: 'Precipitation', issued: 'Issued', retrieved: 'Retrieved',
      stale: 'This page carries JMA’s {d} issue. Today’s ({t}) forecast has not been retrieved yet, so “Today” here means {d}.',
      week: 'The next seven days', weekSub: 'High / low temperatures and precipitation probability', places: 'All 47 prefectures', placesSub: 'Choose from the list',
      confidence: 'Reliability', original: 'Original Japanese from JMA', sourceLink: 'Official forecast ↗', details: 'Sources and how to read this',
      note: 'Japan Meteorological Agency forecasts, arranged by prefecture on one map. Temperatures are forecast values, not live observations.',
      scope: 'Conditions and precipitation use the representative forecast area within each prefecture; temperatures use the official associated location. Today’s precipitation covers the stated six-hour period; later days use daily values. Unissued temperatures remain blank.',
      natural: 'Geography: Natural Earth, public domain. Boundaries are for visual reference.', official: 'Japan Meteorological Agency forecast',
      noData: 'Not issued', noResults: 'No matching place.', hint: 'Select a prefecture to change the forecast.',
      mapTitle: 'Weather forecast map for Japan’s 47 prefectures', mapInstruction: 'Select a prefecture', regionMap: 'All Japan',
      search: 'Search by place', searchPlaceholder: 'Tokyo / 東京 / 北海道…', groupLabels: { 北海道:'Hokkaido', 東北:'Tohoku', 関東:'Kanto', 中部:'Chubu', 近畿:'Kansai', 中国:'Chugoku', 四国:'Shikoku', 九州:'Kyushu', 沖縄:'Okinawa' }
    }
  };
  var tr = function (k) { return zh((T[lang] || T.ja)[k] || T.ja[k] || k); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function region(r) { return zh(lang === 'zh' ? (r.nameZh || r.nameJa || r.name) : lang === 'en' ? (r.nameEn || r.name) : (r.nameJa || r.name)); }
  function area(r) { return (state.day === 0 ? (r.areaName || r.sourceAreaName || r.office) : (r.weekSourceWeatherAreaName || r.areaName || '')) + ' / ' + (state.day === 0 ? (r.todaySourceAreaName || '') : (r.weekSourceAreaName || '')); }
  // JMA weekly axis drifts with the issue time: the 17:00 product covers "tomorrow + 6",
  // but the 06:10 daily refresh still holds the previous day's 17:00 copy, so week[0] is
  // today. Align by date (not by offset) and both axes land correctly.
  function addDays(iso, n) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return null;
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10);
  }
  // 表示は常に「データの日付 vs 今日(JST)」。ここを固定の「今日/明日」にすると、古い
  // スナップショットを配った日に 11-03 の数値を「今日」として出してしまう(2026-11-04)。
  function jstDay(offset) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(Date.now() + (offset || 0) * 86400000));
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return o.year + '-' + o.month + '-' + o.day;
  }
  function relativeDay(iso) {
    if (!iso) return null;
    if (iso === jstDay(0)) return 'today';
    if (iso === jstDay(1)) return 'tomorrow';
    if (iso === jstDay(-1)) return 'yesterday';
    return null;
  }
  function dayLabel(iso) {
    var rel = relativeDay(iso);
    return rel ? tr(rel) : (iso ? dateFmt(iso, true) : tr('noData'));
  }
  function staleNote(r) {
    var date = dayDate(r, 0);
    if (!date || date === jstDay(0)) return '';
    // replace() 只换第一处,{d} 在文案里可能出现两次 —— 用 split/join 全换。
    var text = tr('stale').split('{d}').join(dateFmt(date, true)).split('{t}').join(dateFmt(jstDay(0), true));
    return '<p class="editorial-stale micro" role="status">' + esc(text) + '</p>';
  }
  function weekEntry(r, day) {
    if (day <= 0 || !r.week) return null;
    var base = r.reportDatetime ? String(r.reportDatetime).slice(0, 10) : null;
    var target = base ? addDays(base, day) : null;
    if (target) {
      for (var i = 0; i < r.week.length; i++) {
        if (r.week[i] && r.week[i].date === target) return r.week[i];
      }
    }
    return r.week[day - 1] || null;
  }
  function weatherCode(r, day) { if (day === 0) return r.weatherCodeOfficial || r.weatherCode || ''; if (day === 1 && r.tomorrowCodeOfficial) return r.tomorrowCodeOfficial; var w = weekEntry(r, day); var d = w && (w.codeOfficial || w.code); return d == null ? (r.weatherCode || '') : d; }
  function kind(code) { if (['clear','cloud','rain','snow','thunder'].indexOf(code) >= 0) return code; var n = parseInt(String(code || '0'), 10); if (!n) return 'cloud'; if (n === 350 || n === 450) return 'thunder'; if (n >= 400) return 'snow'; if (n >= 300) return 'rain'; if (n >= 200) return 'cloud'; return 'clear'; }
  function svgGlyph(code) {
    var k = kind(code), s = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    if (k === 'clear') s += '<circle cx="16" cy="16" r="6"/><path d="M16 2v4m0 20v4M2 16h4m20 0h4M6.1 6.1l2.8 2.8m14.2 14.2 2.8 2.8M6.1 25.9l2.8-2.8M23.1 8.9l2.8-2.8"/>';
    else if (k === 'cloud') s += '<path d="M8 23h16a5 5 0 0 0 .5-10 7.5 7.5 0 0 0-14-2A6 6 0 0 0 8 23Z"/>';
    else if (k === 'snow') s += '<path d="M8 20h16a5 5 0 0 0 .5-10 7.5 7.5 0 0 0-14-2A6 6 0 0 0 8 20Z"/><path d="M10 24v4m-2-2h4m5-2v4m-2-2h4m5-6v4m-2-2h4"/>';
    else s += '<path d="M8 20h16a5 5 0 0 0 .5-10 7.5 7.5 0 0 0-14-2A6 6 0 0 0 8 20Z"/>' + (k === 'thunder' ? '<path d="m17 22-4 6h4l-2 4"/>' : '<path d="m10 24-1 4m8-4-1 4m8-4-1 4"/>');
    return s + '</g>';
  }
  function icon(code) { return '<span class="weather-icon" data-kind="'+kind(code)+'"><svg viewBox="0 0 32 32" aria-hidden="true">'+svgGlyph(code)+'</svg></span>'; }
  function high(r, day) { if (day === 0) return r.today && r.today.high; if (day === 1 && r.tomorrow) return r.tomorrow.high; var w = weekEntry(r, day); return w && w.high; }
  function low(r, day) { if (day === 0) return r.today && r.today.low; if (day === 1 && r.tomorrow) return r.tomorrow.low; var w = weekEntry(r, day); return w && w.low; }
  function pop(r, day) { var v = day === 0 ? r.pop : (weekEntry(r, day) || {}).pop; return v == null || v === '' ? null : Number(v); }
  function dayDate(r, day) { if (day === 0) return r.reportDatetime ? r.reportDatetime.slice(0, 10) : (r.week[0] || {}).date; var w = weekEntry(r, day); return w && w.date; }
  function temp(v) { return v == null || v === '' ? '<span aria-label="'+esc(tr('noData'))+'">—</span>' : esc(v)+'<span>°</span>'; }
  function pct(v) { return v == null ? '—' : esc(v)+'%'; }
  function localeOf() { return hant ? 'zh-TW' : lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-GB' : 'ja-JP'; }
  function dateFmt(date, weekday) {
    var d = new Date(date + (String(date).length === 10 ? 'T12:00:00+09:00' : ''));
    return new Intl.DateTimeFormat(localeOf(), { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: weekday ? 'short' : undefined }).format(d);
  }
  function timestamp(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(localeOf(), { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) + ' JST';
  }
  function popPeriod(r) {
    if (state.day !== 0 || !r.popPeriod || !r.popPeriod.start) return '';
    return '<span class="micro">' + esc(r.popPeriod.start.slice(11, 16)) + '–' + esc(r.popPeriod.end.slice(11, 16)) + ' JST</span>';
  }
  function daySwitch(r) {
    return '<div class="day-control" role="group" aria-label="'+esc(tr('weekSub'))+'"><button type="button" data-day="0" aria-pressed="'+(state.day===0)+'">'+esc(dayLabel(dayDate(r,0)))+'</button><button type="button" data-day="1" aria-pressed="'+(state.day===1)+'">'+esc(dayLabel(dayDate(r,1)))+'</button></div>';
  }
  function groupOf(r) { return r.displayRegionJa || r.regionJa || r.region || ''; }
  function groupLabel(g) { return zh((T[lang] || T.ja).groupLabels[g] || g); }
  function geoFeatures() { return GEO && (GEO.features || GEO.prefectures || []) || []; }
  function geoCenter(f) { return f.center || f.centroid || [f.bbox[0]+f.bbox[2]/2, f.bbox[1]+f.bbox[3]/2]; }
  function geoBBox(f) { return f.bbox || f.bounds || [0,0,1,1]; }
  function pathBBox(d) {
    var nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i + 1 < nums.length; i += 2) {
      var x = Number(nums[i]), y = Number(nums[i+1]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
  }

  function mapMarkup() {
    var fs = geoFeatures();
    var main = fs.filter(function (f) { return f.id !== '471000'; });
    var points = main.map(function (f) {
      var c = geoCenter(f);
      return { id: f.id, f: f, anchor: [c[0]*1.24-125, c[1]*1.24-35], x: c[0]*1.24-125, y: c[1]*1.24-35, clip: f.id === '130000' ? 'url(#mainland-tokyo)' : f.id === '460100' ? 'url(#mainland-kagoshima)' : null };
    });
    for (var iteration = 0; iteration < 220; iteration++) {
      for (var i = 0; i < points.length; i++) {
        var a = points[i]; a.x += (a.anchor[0]-a.x)*.024; a.y += (a.anchor[1]-a.y)*.024;
        for (var j = i+1; j < points.length; j++) {
          var b = points[j], dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy), need = 42;
          if (d < need) { var angle = d ? Math.atan2(dy,dx) : (i*2.399+j), push = (need-d)*.49; dx = d ? dx : Math.cos(angle); dy = d ? dy : Math.sin(angle); var norm = Math.hypot(dx,dy)||1; a.x -= dx/norm*push; a.y -= dy/norm*push; b.x += dx/norm*push; b.y += dy/norm*push; }
        }
        a.x = Math.max(55,Math.min(625,a.x)); a.y = Math.max(58,Math.min(680,a.y));
      }
    }
    var selected = points.find(function (p) { return p.id === state.selected; });
    // Every prefecture stays selectable, but only a restrained set of anchor
    // symbols is drawn. This keeps the archipelago legible at a glance.
    var marked = new Set(['016000','020000','040000','070000','130000','150000','200000','230000','260000','270000','280000','340000','370000','400000','430000','450000','460100','471000']);
    var shapes = points.map(function (p) {
      return '<g class="map-land" data-land-id="'+p.id+'"'+(p.clip?' clip-path="'+p.clip+'"':'')+'><path class="pref-shape'+(p.id===state.selected?' selected':'')+'" d="'+esc(p.f.d)+'"/></g>';
    }).join('');
    var callouts = points.map(function (p) {
      var r = byId[p.id], shifted = Math.hypot(p.x-p.anchor[0],p.y-p.anchor[1]) > 8, show = marked.has(p.id);
      return '<g class="map-place'+(p.id===state.selected?' is-selected':'')+'" data-map-id="'+p.id+'" role="button" tabindex="0" aria-pressed="'+(p.id===state.selected)+'" aria-label="'+esc(region(r)+', '+conditionName(weatherCode(r,state.day))+', '+tr('mapInstruction'))+'"><title>'+esc(region(r)+' / '+conditionName(weatherCode(r,state.day)))+'</title>'+(show && shifted?'<path class="pin-link" d="M'+p.anchor[0]+' '+p.anchor[1]+'L'+p.x+' '+p.y+'"/>':'')+'<circle class="pin-hit" cx="'+p.x+'" cy="'+p.y+'" r="22"/>'+(show?'<circle class="pin-disc" cx="'+p.x+'" cy="'+p.y+'" r="13"/><g class="map-symbol" transform="translate('+p.x+' '+p.y+') scale(.78) translate(-16 -16)">'+svgGlyph(weatherCode(r,state.day))+'</g>':'')+'</g>';
    }).join('');
    function inset(f,x,y,scale,label,remote) {
      if (!f) return '';
      var bbox = geoBBox(f);
      return '<g class="map-inset" data-map-id="'+f.id+'" role="button" tabindex="0" aria-pressed="'+(f.id===state.selected)+'" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title><g transform="translate('+x+' '+y+') scale('+scale+') translate('+(-bbox[0])+' '+(-bbox[1])+')"'+(remote?' clip-path="url(#remote-tokyo)"':'')+'><path class="pref-shape'+(f.id===state.selected?' selected':'')+'" d="'+esc(f.d)+'"/></g><circle class="pin-hit" cx="'+x+'" cy="'+y+'" r="22"/><text class="map-inset-label" x="'+x+'" y="'+(y+44)+'">'+esc(label)+'</text></g>';
    }
    var leader = selected ? '<path class="selection-leader" d="M'+selected.anchor[0]+' '+selected.anchor[1]+'L'+selected.x+' '+selected.y+'"/><text class="map-selected-label" x="'+selected.x+'" y="'+(selected.y+34)+'">'+esc(region(byId[selected.id]))+'</text>' : '';
    var ogaLabel = lang === 'zh' ? '小笠原 / Ogasawara' : lang === 'en' ? 'Ogasawara' : '小笠原 / Ogasawara';
    return '<div class="weather-map-shell"><svg class="weather-map" viewBox="0 0 760 780" role="group" aria-label="'+esc(tr('mapTitle'))+'"><defs><clipPath id="mainland-tokyo"><rect x="360" y="340" width="90" height="60"/></clipPath><clipPath id="remote-tokyo"><rect x="0" y="390" width="780" height="390"/></clipPath><clipPath id="mainland-kagoshima"><rect x="130" y="430" width="130" height="90"/></clipPath></defs><g transform="translate(-125 -35) scale(1.24)">'+shapes+'</g><g>'+leader+callouts+'</g>'+inset(fs.find(function(f){return f.id==='130000';}),700,682,.38,ogaLabel,true)+'</svg></div>';
  }
  function okinawaCard() {
    var f = geoFeatures().find(function (x) { return x.id === '471000'; });
    if (!f) return '';
    var parts = f.d.split(/(?=M)/).filter(Boolean);
    var main = parts[0] || f.d, bestArea = 0;
    parts.forEach(function (p) {
      var pb = pathBBox(p), area = (pb[2]-pb[0]) * (pb[3]-pb[1]);
      if (area > bestArea) { bestArea = area; main = p; }
    });
    var b = pathBBox(main), pad = 2;
    var pinR = 3, pinX = b[2] + 5, pinY = b[1] + 3;
    var targetX = b[2] - (b[2]-b[0]) * .22, targetY = b[1] + (b[3]-b[1]) * .36;
    var vb = [b[0]-pad, b[1]-pad, (b[2]-b[0])+pad*2+8, (b[3]-b[1])+pad*2].join(' ');
    var r = byId['471000'];
    var label = lang === 'en' ? 'Okinawa' : lang === 'zh' ? '冲绳' : '沖縄';
    var cityLabel = lang === 'en' ? 'Naha' : lang === 'zh' ? '那霸' : '那覇';
    var selected = state.selected === '471000';
    var aria = esc(region(r)+', '+cityLabel+', '+conditionName(weatherCode(r,state.day))+', '+tr('mapInstruction'));
    return '<div class="okinawa-inset'+(selected?' is-selected':'')+'"><svg class="okinawa-map" viewBox="'+vb+'" role="group" aria-label="'+esc(region(r))+'"><path class="okinawa-land'+(selected?' selected':'')+'" d="'+esc(main)+'" aria-hidden="true"/><path class="pin-link" d="M'+pinX+' '+pinY+'L'+targetX.toFixed(1)+' '+targetY.toFixed(1)+'" aria-hidden="true"/><g class="okinawa-pin" data-map-id="471000" role="button" tabindex="0" aria-pressed="'+selected+'" aria-label="'+aria+'"><circle class="pin-hit" cx="'+pinX+'" cy="'+pinY+'" r="4"/><circle class="pin-disc" cx="'+pinX+'" cy="'+pinY+'" r="'+pinR+'"/><g class="map-symbol" transform="translate('+pinX+' '+pinY+') scale(.16) translate(-16 -16)">'+svgGlyph(weatherCode(r,state.day))+'</g></g>'+(selected?'<text class="okinawa-label" x="'+pinX+'" y="'+(pinY+7)+'" aria-hidden="true">'+esc(cityLabel)+'</text>':'')+'</svg><button type="button" class="okinawa-inset-button" data-map-id="471000" aria-pressed="'+selected+'" aria-label="'+aria+'">'+esc(label)+'</button></div>';
  }
  function conditionName(code) { var m = { ja: { clear: '晴れ', cloud: 'くもり', rain: '雨', snow: '雪', thunder: '雷雨' }, zh: { clear: '晴', cloud: '多云', rain: '雨', snow: '雪', thunder: '雷雨' }, en: { clear: 'Clear', cloud: 'Cloud', rain: 'Rain', snow: 'Snow', thunder: 'Thunder' } }; return zh((m[lang] || m.ja)[kind(code)]); }
  // 凡例的四种天气就该是同一个词源(以前在这里抄了一遍 ja/zh/en 三套词,zh-Hant 会落回英文)。
  function legend() { return '<div class="map-legend" aria-label="Weather legend">'+['100','200','300','400'].map(function (code) { return '<span>'+icon(code)+esc(conditionName(code))+'</span>'; }).join('')+'</div>'; }

  function picker(r) {
    var groups = [], seen = {};
    regions.forEach(function (x) { var g = groupOf(x); if (!seen[g]) { seen[g] = []; groups.push({ g: g, items: seen[g] }); } seen[g].push(x); });
    var options = groups.map(function (g) {
      return '<div class="picker-group-label">'+esc(groupLabel(g.g))+'</div>'+g.items.map(function (x) {
        return '<button type="button" role="option" class="picker-option" data-pick-id="'+x.id+'" aria-selected="'+(x.id===r.id)+'"><span>'+esc(region(x))+'</span><small>'+esc(high(x,state.day)==null?'—':high(x,state.day)+'°')+' / '+esc(low(x,state.day)==null?'—':low(x,state.day)+'°')+'</small></button>';
      }).join('');
    }).join('');
    return '<div class="picker"><span class="picker-label">'+esc(tr('chooseHint'))+'</span><button type="button" class="picker-trigger" data-picker-toggle aria-haspopup="listbox" aria-expanded="'+(state.pickerOpen?'true':'false')+'" aria-controls="picker-panel"><span>'+esc(tr('choose'))+' · '+esc(region(r))+'</span><span class="picker-chevron" aria-hidden="true">⌄</span></button><div class="picker-panel" id="picker-panel" role="listbox" aria-label="'+esc(tr('choose'))+'"'+(state.pickerOpen?'':' hidden')+'>'+options+'</div></div>';
  }
  function editorial(r) {
    var p = pop(r, state.day);
    var head = '<div class="editorial-head"><div class="editorial-dateline">'+esc(dateFmt(dayDate(r,state.day),true))+' · '+esc(groupLabel(groupOf(r)))+'</div>'+staleNote(r)+daySwitch(r)+'</div>';
    var identity = '<div class="editorial-identity"><h2 class="editorial-place">'+esc(region(r))+'</h2><p class="editorial-en">'+esc(r.nameEn||r.name)+'</p></div>';
    var weather = '<div class="editorial-weather"><div class="editorial-condition">'+icon(weatherCode(r,state.day))+'<span>'+esc(conditionName(weatherCode(r,state.day)))+'</span></div><div class="editorial-temps"><div class="temperature"><span>'+esc(tr('high'))+'</span><strong>'+temp(high(r,state.day))+'</strong></div><div class="temperature low"><span>'+esc(tr('low'))+'</span><strong>'+temp(low(r,state.day))+'</strong></div></div></div>';
    var details = '<div class="editorial-details"><p class="editorial-rain">'+esc(tr('rain'))+' <strong>'+pct(p)+'</strong> '+popPeriod(r)+'</p></div>';
    return '<section class="editorial-copy">'+head+identity+weather+details+picker(r)+'</section>';
  }
  function mapColumn() {
    return '<div class="editorial-map-column"><div class="map-canvas">'+mapMarkup()+'<div class="map-footer">'+legend()+'<p class="map-source"><span>気象庁 / JMA</span><span>'+esc(tr('issued'))+' '+esc(timestamp(DATA.reportDatetime || (regions[0] && regions[0].reportDatetime)))+'</span></p></div>'+okinawaCard()+'</div></div>';
  }
  function week(r) {
    return '<section class="weather-section" aria-labelledby="week-title"><div class="section-heading"><h2 id="week-title">'+esc(tr('week'))+'</h2><p>'+esc(tr('weekSub'))+'</p></div><div class="week-scroll"><div class="week-grid">'+[0,1,2,3,4,5,6].map(function (i) {
      var d = i === 0 ? { date: dayDate(r, 0) } : (weekEntry(r, i) || {});
      return '<article class="week-day'+(i===state.day?' is-selected':'')+'"><time class="week-date" datetime="'+esc(d.date)+'">'+esc(i===0?dayLabel(d.date):dateFmt(d.date,true))+'</time>'+icon(weatherCode(r,i))+'<p class="week-temp">'+esc(high(r,i)==null?'—':high(r,i)+'°')+'<span>'+esc(low(r,i)==null?'—':low(r,i)+'°')+'</span></p><p class="week-rain">'+pct(pop(r,i))+'</p>'+(i>0 && d.reliability?'<p class="week-reliability">'+esc(tr('confidence'))+' '+esc(d.reliability)+'</p>':'')+'</article>';
    }).join('')+'</div></div></section>';
  }
  function directory(r) {
    var groups = [], seen = {};
    regions.forEach(function (x) { var g = groupOf(x); if (!seen[g]) { seen[g] = []; groups.push({ g: g, items: seen[g] }); } seen[g].push(x); });
    var html = groups.map(function (g) {
      var rows = g.items.map(function (x) {
        return '<tr data-row-id="'+x.id+'" tabindex="0" aria-selected="'+(x.id===r.id)+'" aria-label="'+esc(region(x)+', '+conditionName(weatherCode(x,state.day)))+'"><td>'+x.id.slice(0,2)+'</td><td class="name">'+esc(region(x))+'</td><td class="cond">'+icon(weatherCode(x,state.day))+'</td><td class="temp"><b>'+esc(high(x,state.day)==null?'—':high(x,state.day)+'°')+'</b> / '+esc(low(x,state.day)==null?'—':low(x,state.day)+'°')+'</td></tr>';
      }).join('');
      return '<div class="directory-region"><div class="directory-region-title">'+esc(groupLabel(g.g))+'</div><table><tbody>'+rows+'</tbody></table></div>';
    }).join('');
    return '<section class="weather-section" aria-labelledby="places-title"><div class="section-heading"><h2 id="places-title">'+esc(tr('places'))+'</h2><p>'+esc(tr('placesSub'))+'</p></div><div class="directory-table">'+html+'</div></section>';
  }
  function notes() {
    return '<section class="weather-notes" aria-labelledby="notes-title"><h2 id="notes-title">'+esc(tr('details'))+'</h2><div class="weather-notes-content"><p>'+esc(tr('note'))+'</p><p>'+esc(tr('scope'))+'</p><dl><dt>'+esc(tr('issued'))+'</dt><dd>'+esc(timestamp(DATA.reportDatetime || (regions[0] && regions[0].reportDatetime)))+'</dd><dt>'+esc(tr('retrieved'))+'</dt><dd>'+esc(timestamp(DATA.generatedAt))+'</dd><dt>Source</dt><dd><a href="https://www.jma.go.jp/bosai/forecast/" target="_blank" rel="noopener">'+esc(tr('official'))+' ↗</a></dd></dl><p>'+esc(tr('natural'))+'</p></div></section>';
  }
  function view(r) { return '<h1 class="sr-only">'+esc(tr('title'))+'</h1><div class="editorial-grid">'+editorial(r)+mapColumn()+'</div>'+week(r)+directory(r)+notes(); }

  function render(focus) {
    var r = byId[state.selected] || regions[0];
    var root = document.querySelector('#weather-app');
    root.innerHTML = view(r);
    document.documentElement.dataset.weather = 'C';
    window.weatherPage = { selected: r, state: Object.assign({}, state), regions: regions.length, mapFeatures: geoFeatures().length };
    if (focus) {
      var el = root.querySelector(focus.kind === 'map' ? '[data-map-id="'+focus.id+'"]' : focus.kind === 'row' ? '[data-row-id="'+focus.id+'"]' : '[data-picker-toggle]');
      if (el) el.focus({ preventScroll: true });
    }
  }
  function choose(id, focusKind) { if (!byId[id]) return; state.selected = id; state.day = 0; state.pickerOpen = false; render(focusKind ? { kind: focusKind, id: id } : null); }
  function setDay(day) { state.day = day; render(); }
  function openPicker(open) { state.pickerOpen = open; var panel = document.querySelector('.picker-panel'), btn = document.querySelector('[data-picker-toggle]'); if (!panel || !btn) return; panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) { var first = panel.querySelector('[data-pick-id]'); if (first) first.focus(); } else if (panel.contains(document.activeElement)) btn.focus(); }

  document.addEventListener('click', function (e) {
    var land = e.target.closest('[data-land-id]'); if (land) { choose(land.dataset.landId, 'map'); return; }
    var map = e.target.closest('[data-map-id]'); if (map) { choose(map.dataset.mapId, 'map'); return; }
    var row = e.target.closest('[data-row-id]'); if (row) { choose(row.dataset.rowId, 'row'); return; }
    var pick = e.target.closest('[data-pick-id]'); if (pick) { choose(pick.dataset.pickId, 'picker'); return; }
    var day = e.target.closest('[data-day]'); if (day) { setDay(Number(day.dataset.day)); return; }
    var toggle = e.target.closest('[data-picker-toggle]'); if (toggle) { openPicker(toggle.getAttribute('aria-expanded') !== 'true'); return; }
    if (!e.target.closest('.picker')) openPicker(false);
  });
  document.addEventListener('keydown', function (e) {
    var row = e.target.closest('[data-row-id]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(row.dataset.rowId, 'row'); return; }
    var map = e.target.closest('[data-map-id]');
    if (map && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(map.dataset.mapId, 'map'); return; }
    if (e.key === 'Escape') { openPicker(false); }
  });
  window.addEventListener('DOMContentLoaded', function () { render(); });
  // 繁体表(app/hant.js)比 app.js 后到时要重画一次:首屏先按简体,表到了再换繁体。
  window.addEventListener('pj:hant', function () { if (hant) render(); });
})();
