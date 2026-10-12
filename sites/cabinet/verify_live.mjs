import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const userData = mkdtempSync(join(tmpdir(), 'cabinet-live-'));
const port = 9390;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${port}`,`--user-data-dir=${userData}`,'about:blank'
], { stdio: 'ignore' });
let tabs;
for (let i=0;i<30;i++){ try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch(e){ await new Promise(r=>setTimeout(r,300)); } }
const page = tabs.find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let msgId = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params={}) => new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({id, method, params})); });
await send('Page.enable'); await send('Runtime.enable');
const errors = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); };
await send('Page.navigate', { url });
await new Promise(r=>setTimeout(r, 6000));
const run = expr => send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(r => r.result?.result?.value);
const res = await run(`(() => {
  const chart = document.getElementById('chart');
  if (!chart) return { ok:false, err:'no #chart' };
  const inst = echarts.getInstanceByDom(chart);
  if (!inst) return { ok:false, err:'no echarts instance' };
  const data = inst.getOption();
  return {
    ok: true,
    seriesCount: data.series.length,
    firstPoint: data.series[0].data[0],
    lastPoint: data.series[0].data[data.series[0].data.length-1],
    pointCount: data.series[0].data.length,
    zoom: data.dataZoom[0].start + '-' + data.dataZoom[0].end,
    title: data.title[0].text,
    legendCount: data.legend[0].data.length
  };
})()`);
console.log('PAGE:', JSON.stringify(res));
console.log('JS ERRORS:', errors.length ? errors : 'none');
ws.close(); chrome.kill();