// 住所LOD 多边形补抓（Bun/eval 用）：Python urllib 在本机 bash 被拦截，改走 JS fetch。
// 输入 data/chome.json + data/lod_cache.json + data/lod_todo.json；输出回写 lod_cache.json（断点续跑）。
// 候选规则与 scripts/build_chome_poly.py::lod_cands 同源（郡島前缀归一/大字去字/字去字/海澤→海沢/麹→麴），命中即停。
export const CACHE_PATH = "F:/omp-data/tokyo-crime-map/data/lod_cache.json";
export const TODO_PATH = "F:/omp-data/tokyo-crime-map/data/lod_todo.json";
export const WKT_PRED = "http://www.opengis.net/ont/geosparql#asWKT";

export function lodCands(chomeName) {
  const asc = String(chomeName).normalize("NFKC");
  const c = [asc];
  for (const [pre, short] of [["西多摩郡瑞穂町", "瑞穂町"], ["西多摩郡日の出町", "日の出町"], ["西多摩郡檜原村", "檜原村"], ["西多摩郡奥多摩町", "奥多摩町"]]) {
    if (asc.startsWith(pre)) c.push(short + asc.slice(pre.length));
  }
  for (const [pre, short] of [["三宅島三宅村", "三宅村"], ["八丈島八丈町", "八丈町"]]) {
    if (asc.startsWith(pre)) c.push(short + asc.slice(pre.length));
  }
  const base = [...c];
  const PRES = ["西多摩郡瑞穂町", "瑞穂町", "西多摩郡日の出町", "日の出町", "大島町", "新島村", "小笠原村", "三宅村", "八丈町", "奥多摩町", "檜原村"];
  for (const n of base) {
    let m = null;
    for (const pre of PRES) { if (n.startsWith(pre)) { m = pre; break; } }
    if (!m) continue;
    const tail = n.slice(m.length);
    if (tail.startsWith("大字")) c.push(m + tail.slice(2));
    else if (tail.startsWith("字")) c.push(m + tail.slice(1));
    else if (tail.includes("字")) c.push(m + tail.replaceAll("字", ""));
  }
  const base2 = [...c];
  for (const n of base2) {
    if (n.includes("海澤")) c.push(n.replaceAll("海澤", "海沢"));
    if (n.includes("麹町")) c.push(n.replaceAll("麹町", "麴町"));
  }
  const seen = new Set(), out = [];
  for (const n of c) { if (!seen.has(n)) { seen.add(n); out.push("東京都" + n); } }
  return out;
}

export async function fetchTodo({ concurrency = 4, delayMs = 200 } = {}) {
  const cache = JSON.parse(await Bun.file(CACHE_PATH).text());
  const todoAll = JSON.parse(await Bun.file(TODO_PATH).text());
  const todo = todoAll.filter((n) => !(n in cache));
  console.log(`todo ${todo.length} (cache ${Object.keys(cache).length})`);
  let idx = 0, completed = 0, hits = 0, cachedNull = 0;
  const fails = [];
  let saving = Promise.resolve();
  const saveCache = () => { saving = saving.then(() => Bun.write(CACHE_PATH, JSON.stringify(cache))); return saving; };

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= todo.length) break;
      const name = todo[i];
      let hit = null, definitive = false;
      for (const ln of lodCands(name)) {
        let okCand = false;
        for (let att = 0; att < 3; att++) {
          try {
            const r = await fetch("https://uedayou.net/loa/" + encodeURIComponent(ln) + ".json");
            if (r.status === 404) { definitive = true; okCand = true; break; }
            if (!r.ok) throw new Error("HTTP " + r.status);
            const j = await r.json();
            const subj = Object.keys(j)[0];
            const wkts = j[subj]?.[WKT_PRED] ?? [];
            hit = wkts.length ? wkts[0].value : null;
            definitive = true; okCand = true;
            break;
          } catch (e) {
            if (att >= 2) break;
            await Bun.sleep(2000 + att * 2000);
          }
        }
        if (hit) break;
        if (okCand) continue;
      }
      if (hit) { cache[name] = hit; hits++; }
      else if (definitive) { cache[name] = null; cachedNull++; }
      else fails.push(name);
      completed++;
      if (completed % 25 === 0) { await saveCache(); console.log(`progress ${completed}/${todo.length} hits=${hits} null=${cachedNull} fail=${fails.length}`); }
      await Bun.sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await saveCache();
  const allHits = Object.values(cache).filter(Boolean).length;
  return `done todo=${todo.length} newHits=${hits} newNull=${cachedNull} netFail=${fails.length} cacheTotal=${Object.keys(cache).length} cacheHits=${allHits} fails=${fails.slice(0, 20).join("|")}`;
}
