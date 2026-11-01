/* 方案 D ——「书脊 + 引擎」(B × C 融合)
   取 B 的信息设计:顶部政权书脊(姓恒 13px、永远放得下)、分界从书脊贯穿到绘图区、
   顶部明朝体大字显示当前政权 + 最新支持率。
   取 C 的引擎:手写 Canvas、窗口是唯一真相源;惯性拖拽、以光标为锚的缩放、越界橡皮筋回弹、
   双击复位、底部总览条(拖窗口 / 拉手柄 / 点击跳转)、十字线磁吸最近调查点、按 f 看帧率。
   费一点选择:书脊段可直接点,点了就把那一任的任期铺满视窗。 */
window.SCHEME_D = (function () {
  var LAB = window.LAB, T = LAB.T, DAY = LAB.DAY;
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function mount(stage) {
    var M = LAB.model;
    var wrap = LAB.el('div', 'd-wrap');
    stage.appendChild(wrap);
    var box = LAB.el('div', 'd-canvas-box');
    wrap.appendChild(box);
    var cv = document.createElement('canvas');
    cv.className = 'd-canvas';
    box.appendChild(cv);
    var readout = LAB.el('div', 'c-readout');
    readout.hidden = true;
    box.appendChild(readout);
    var ctx = cv.getContext('2d');

    var MINSPAN = 92 * DAY;
    var PAD = { l: 58, r: 44, t: 14, b: 88 };
    var RIB = { h: 30, gap: 22 };
    var plot = { x: 0, y: 0, w: 0, h: 0 };
    var rib = { x: 0, y: 0, w: 0, h: RIB.h };
    var MINI = { x: 0, y: 0, w: 0, h: 40 };
    var full = { t0: M.tMin - 40 * DAY, t1: M.t1 };
    var fullSpan = full.t1 - full.t0;
    var win = { t0: full.t0 + fullSpan * 0.62, t1: full.t1 };
    var W = 0, H = 0, dpr = 1;
    var dragging = null, inertia = 0, velocity = 0, hover = null, needDraw = true, raf = 0;
    var fps = { on: false, last: 0, acc: 0, n: 0, v: 0 };
    var anim = null;

    M.cabs.forEach(function (c) {
      c.e0 = Date.parse(c.edges.d0 + 'T00:00:00Z');
      c.e1 = Date.parse(c.edges.d1 + 'T00:00:00Z');
      if (!(c.e1 > c.e0)) c.e1 = c.e0 + 30 * DAY;
    });

    function layout() {
      var r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(320, Math.round(r.width));
      H = Math.max(320, Math.round(r.height));
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      plot.x = PAD.l; plot.w = Math.max(80, W - PAD.l - PAD.r);
      rib.x = plot.x; rib.w = plot.w; rib.y = PAD.t; rib.h = RIB.h;
      plot.y = PAD.t + RIB.h + RIB.gap;
      plot.h = Math.max(80, H - plot.y - PAD.b);
      MINI.x = plot.x; MINI.w = plot.w; MINI.y = plot.y + plot.h + 40; MINI.h = 40;
      needDraw = true;
    }
    function xOf(t) { return plot.x + (t - win.t0) / (win.t1 - win.t0) * plot.w; }
    function yOf(v) { return plot.y + (1 - v / 100) * plot.h; }
    function tOf(x) { return win.t0 + (x - plot.x) / plot.w * (win.t1 - win.t0); }
    function span() { return win.t1 - win.t0; }
    function clampWin(dt) {
      var s = win.t1 - win.t0;
      if (dt) { win.t0 += dt; win.t1 += dt; }
      if (s >= fullSpan) { win.t0 = full.t0; win.t1 = full.t1; return; }   // 放到头就是整段,贴死不动
      if (win.t0 < full.t0) { win.t1 += full.t0 - win.t0; win.t0 = full.t0; }
      if (win.t1 > full.t1) { win.t0 -= win.t1 - full.t1; win.t1 = full.t1; }
      if (win.t0 < full.t0) win.t0 = full.t0;
      if (win.t1 > full.t1) win.t1 = full.t1;
    }
    function zoomAt(px, factor) {
      var anchor = tOf(px), s = span(), ns = Math.max(MINSPAN, Math.min(fullSpan, s * factor));
      var k = ns / s;
      win.t0 = anchor - (anchor - win.t0) * k;
      win.t1 = win.t0 + ns;
      clampWin(0);
      needDraw = true;
    }
    function animateTo(t0, t1) { anim = { f: [win.t0, win.t1], g: [t0, t1], t: performance.now(), d: 360 }; }

    function rr(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, h / 2, w / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
    function drawRibbon() {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var font = '400 12.5px ' + LAB.FONT_JA;          // 不加粗
      ctx.font = font;
      M.cabs.forEach(function (c) {
        var x0 = Math.max(xOf(c.e0) + 2, rib.x), x1 = Math.min(xOf(c.e1) - 2, rib.x + rib.w);
        var w = x1 - x0;
        if (w < 4) return;
        var r = Math.min(9, w / 2);
        rr(x0, rib.y, w, rib.h, r);
        ctx.fillStyle = 'rgba(255,255,255,.055)';      // 所有胶囊同一底色,避免深浅看着像高低不一
        ctx.fill();
        ctx.strokeStyle = hexA(c.color, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
        var tw = LAB.measure(c.sur, font);
        var a = LAB.clamp((w - (tw + 10)) / 16, 0, 1);
        if (a > 0.05) {
          ctx.fillStyle = 'rgba(234,231,223,' + (0.9 * a).toFixed(3) + ')';
          ctx.save();
          rr(x0 + 2, rib.y, w - 4, rib.h, Math.max(0, r - 2));
          ctx.clip();
          ctx.fillText(c.sur, x0 + w / 2, rib.y + rib.h / 2 + 1);   // 居中
          ctx.restore();
        }
      });
      ctx.restore();
    }
    function drawBands() {
      M.cabs.forEach(function (c, i) {
        var x0 = Math.max(xOf(c.e0), plot.x), x1 = Math.min(xOf(c.e1), plot.x + plot.w);
        if (x1 - x0 >= 0.6 && i % 2 === 0) { ctx.fillStyle = T.band; ctx.fillRect(x0, plot.y, x1 - x0, plot.h); }
      });
    }
    function drawGrid() {
      ctx.save();
      ctx.font = '11px ' + LAB.FONT_JA; ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var v = 0; v <= 100; v += 20) {
        var y = Math.round(yOf(v)) + 0.5;
        ctx.setLineDash([2, 6]); ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); ctx.stroke();
        ctx.fillText(v + '%', plot.x - 12, y);
      }
      ctx.setLineDash([]);
      var y0 = new Date(win.t0).getUTCFullYear(), y1 = new Date(win.t1).getUTCFullYear();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var last = -1e9;
      for (var yy = y0 - 1; yy <= y1 + 1; yy++) {
        var t = Date.UTC(yy, 0, 1), x = xOf(t);
        if (x < plot.x - 20 || x > plot.x + plot.w + 20) continue;
        if (x - last < 62) continue;
        last = x;
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, plot.y + plot.h); ctx.lineTo(Math.round(x) + 0.5, plot.y + plot.h + 5); ctx.stroke();
        ctx.fillStyle = T.muted; ctx.fillText(String(yy), x, plot.y + plot.h + 9);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plot.x, Math.round(plot.y + plot.h) + 0.5); ctx.lineTo(plot.x + plot.w, Math.round(plot.y + plot.h) + 0.5); ctx.stroke();
      ctx.restore();
    }
    function drawLines() {
      ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
      var dots = plot.w / Math.max(1, span() / (30.44 * DAY)) > 6.5;
      M.cabs.forEach(function (c) {
        var pts = c.points; if (!pts.length) return;
        ctx.strokeStyle = hexA(c.color, 0.95); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        var started = false, j;
        for (j = 0; j < pts.length; j++) {
          var x = xOf(pts[j][0]);
          if (x < plot.x - 30) continue;
          if (x > plot.x + plot.w + 30) break;
          var y = yOf(pts[j][1]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        if (started) ctx.stroke();
        if (dots && started) {
          ctx.fillStyle = hexA(c.color, 0.95);
          for (j = 0; j < pts.length; j++) {
            var px = xOf(pts[j][0]);
            if (px < plot.x - 4 || px > plot.x + plot.w + 4) continue;
            ctx.beginPath(); ctx.arc(px, yOf(pts[j][1]), 2.4, 0, 6.2832); ctx.fill();
          }
        }
      });
      ctx.restore();
    }
    function drawMini() {
      var s = full.t1 - full.t0;
      var mx = function (t) { return MINI.x + (t - full.t0) / s * MINI.w; };
      var my = function (v) { return MINI.y + MINI.h - (v / 100) * MINI.h; };
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fillRect(MINI.x, MINI.y, MINI.w, MINI.h);
      ctx.save(); ctx.beginPath(); ctx.rect(MINI.x, MINI.y, MINI.w, MINI.h); ctx.clip();
      M.cabs.forEach(function (c) {
        if (!c.points.length) return;
        ctx.beginPath();
        c.points.forEach(function (p, i) { var x = mx(p[0]), y = my(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = hexA(c.color, 0.55); ctx.lineWidth = 1; ctx.stroke();
        ctx.lineTo(mx(c.points[c.points.length - 1][0]), MINI.y + MINI.h);
        ctx.lineTo(mx(c.points[0][0]), MINI.y + MINI.h);
        ctx.closePath(); ctx.fillStyle = hexA(c.color, 0.09); ctx.fill();
      });
      ctx.restore();
      var a = mx(win.t0), b = mx(win.t1);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.fillRect(a, MINI.y, Math.max(2, b - a), MINI.h);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(a) + 0.5, MINI.y + 0.5, Math.max(2, Math.round(b - a) - 1), MINI.h - 1);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(Math.round(a) - 1, MINI.y + MINI.h / 2 - 7, 3, 14);
      ctx.fillRect(Math.round(b) - 2, MINI.y + MINI.h / 2 - 7, 3, 14);
    }
    function drawCross() {
      if (!hover) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(hover.x) + 0.5, plot.y); ctx.lineTo(Math.round(hover.x) + 0.5, plot.y + plot.h); ctx.stroke();
      ctx.fillStyle = '#0e100f'; ctx.strokeStyle = hexA(hover.color, 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hover.x, hover.y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.restore();
      readout.hidden = false;
      readout.style.left = Math.min(Math.max(plot.x + 4, hover.x - 76), Math.max(plot.x + 4, W - PAD.r - 176)) + 'px';
      readout.style.top = '56px';
      readout.innerHTML = '<b>' + LAB.fmt(hover.t) + '</b><span>' + hover.sur + '内閣 ' + hover.v + '% ・ ' + hover.n + ' 社</span>';
    }
    function draw() {
      needDraw = false;
      ctx.clearRect(0, 0, W, H);
      drawBands(); drawGrid(); drawLines(); drawRibbon(); drawMini(); drawCross();
      if (fps.on) {
        ctx.save(); ctx.font = '11px ui-monospace,monospace'; ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(fps.v.toFixed(0) + ' fps', W - PAD.r, rib.y - 12); ctx.restore();
      }
    }
    function nearest(mx) {
      var t = tOf(mx), best = null, bd = Infinity;
      M.cabs.forEach(function (c) {
        for (var i = 0; i < c.points.length; i++) {
          var p = c.points[i], d = Math.abs(p[0] - t);
          if (d < bd) { bd = d; best = { p: p, c: c }; }
        }
      });
      if (!best) return null;
      var x = xOf(best.p[0]);
      if (Math.abs(x - mx) > 26) return null;
      return { x: x, y: yOf(best.p[1]), t: best.p[0], v: best.p[1], n: best.p[2], sur: best.c.sur, color: best.c.color };
    }
    function ribHit(x, y) {
      if (y < rib.y - 4 || y > rib.y + rib.h + 4) return null;
      var t = tOf(x), hit = null;
      M.cabs.forEach(function (c) { if (t >= c.e0 && t < c.e1) hit = c; });
      return hit;
    }
    function focusCab(c) {
      var pad = Math.max((c.e1 - c.e0) * 0.12, 60 * DAY);
      animateTo(c.e0 - pad, c.e1 + pad);
    }
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      var busy = false;
      if (anim) {
        var p = Math.min(1, (ts - anim.t) / anim.d), e = 1 - Math.pow(1 - p, 3);
        win.t0 = anim.f[0] + (anim.g[0] - anim.f[0]) * e;
        win.t1 = anim.f[1] + (anim.g[1] - anim.f[1]) * e;
        if (p >= 1) anim = null;
        busy = true;
      }
      if (inertia && !dragging) {
        clampWin(inertia);
        inertia *= 0.93;
        if (Math.abs(inertia) < span() * 0.0004) inertia = 0;
        busy = true;
      }
      if (fps.on) {
        if (fps.last) { fps.acc += ts - fps.last; fps.n++; if (fps.n >= 20) { fps.v = 1000 / (fps.acc / fps.n); fps.acc = 0; fps.n = 0; busy = true; } }
        fps.last = ts;
      }
      if (needDraw || busy || dragging) draw();
    }
    function at(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onDown(e) {
      var p = at(e);
      if (p.y >= MINI.y - 8 && p.y <= MINI.y + MINI.h + 8) {
        var a = MINI.x + (win.t0 - full.t0) / fullSpan * MINI.w;
        var b = MINI.x + (win.t1 - full.t0) / fullSpan * MINI.w;
        dragging = { mini: Math.abs(p.x - a) < 9 ? 'l' : Math.abs(p.x - b) < 9 ? 'r' : (p.x > a && p.x < b ? 'm' : 'j'), x0: p.x, w0: [win.t0, win.t1], lastX: p.x, lastT: performance.now() };
        inertia = 0; anim = null; velocity = 0;
        cv.setPointerCapture(e.pointerId); e.preventDefault(); needDraw = true; return;
      }
      var hitCab = ribHit(p.x, p.y);
      if (hitCab) { focusCab(hitCab); e.preventDefault(); return; }
      dragging = { pan: true, x0: p.x, w0: [win.t0, win.t1], lastX: p.x, lastT: performance.now() };
      inertia = 0; anim = null; velocity = 0;
      cv.setPointerCapture(e.pointerId); e.preventDefault();
    }
    function onMove(e) {
      var p = at(e), now = performance.now();
      if (!dragging) {
        var overRib = !!ribHit(p.x, p.y);
        cv.style.cursor = overRib ? 'pointer' : 'grab';
        var h = (!overRib && p.x >= plot.x && p.x <= plot.x + plot.w && p.y >= plot.y && p.y <= plot.y + plot.h) ? nearest(p.x) : null;
        var changed = (!!h !== !!hover) || (h && hover && h.t !== hover.t) || overRib;
        hover = h;
        if (!h) readout.hidden = true;
        if (changed) needDraw = true;
        return;
      }
      var sp = dragging.w0[1] - dragging.w0[0];
      if (dragging.pan) {
        var dt = (p.x - dragging.x0) / plot.w * sp;
        win.t0 = dragging.w0[0] - dt; win.t1 = dragging.w0[1] - dt;
        clampWin(0);
        velocity = -(p.x - dragging.lastX) / plot.w * sp / Math.max(8, now - dragging.lastT) * 16;
      } else if (dragging.mini === 'm') {
        var sd = (p.x - dragging.x0) / MINI.w * fullSpan;
        win.t0 = dragging.w0[0] + sd; win.t1 = dragging.w0[1] + sd; clampWin(0);
        velocity = (p.x - dragging.lastX) / MINI.w * fullSpan / Math.max(8, now - dragging.lastT) * 16;
      } else if (dragging.mini === 'l') {
        var nl = Math.min(full.t0 + (p.x - MINI.x) / MINI.w * fullSpan, win.t1 - MINSPAN);
        win.t0 = Math.max(full.t0, nl);
      } else if (dragging.mini === 'r') {
        var nr = Math.max(full.t0 + (p.x - MINI.x) / MINI.w * fullSpan, win.t0 + MINSPAN);
        win.t1 = Math.min(full.t1, nr);
      } else {
        var c = full.t0 + (p.x - MINI.x) / MINI.w * fullSpan, half = sp / 2;
        win.t0 = c - half; win.t1 = c + half; clampWin(0);
      }
      dragging.lastX = p.x; dragging.lastT = now;
      needDraw = true;
    }
    function onUp() {
      if (dragging && dragging.pan) inertia = velocity * 0.85;
      dragging = null;
    }
    function onWheel(e) {
      e.preventDefault();
      var p = at(e), dx = e.deltaX || 0, dy = e.deltaY || 0;
      if (e.shiftKey || e.ctrlKey) { zoomAt(p.x, Math.exp(dy * 0.0016)); return; }
      var d = Math.abs(dx) > Math.abs(dy) ? dx : dy;      // 默认:滚轮左右移动时间轴
      var dt = d / plot.w * span();
      win.t0 += dt; win.t1 += dt; clampWin(0); needDraw = true;
    }
    function onKey(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      var step = span() * 0.12;
      if (e.key === 'ArrowLeft') { win.t0 -= step; win.t1 -= step; clampWin(0); needDraw = true; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { win.t0 += step; win.t1 += step; clampWin(0); needDraw = true; e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { zoomAt(plot.x + plot.w / 2, 0.82); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoomAt(plot.x + plot.w / 2, 1.22); e.preventDefault(); }
      else if (e.key === '0') { animateTo(full.t0, full.t1); e.preventDefault(); }
      else if (e.key === 'f') { fps.on = !fps.on; needDraw = true; }
    }
    function onDbl() { animateTo(full.t0, full.t1); }

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('dblclick', onDbl);
    window.addEventListener('keydown', onKey);
    var ro = new ResizeObserver(function () { layout(); });
    ro.observe(box);
    layout();
    raf = requestAnimationFrame(loop);
    return {
      debug: function () { return { t0: win.t0, t1: win.t1, spanDays: (win.t1 - win.t0) / DAY, hover: hover && hover.v, ribbon: rib.h }; },
      focus: function (id) { var c = M.cabs.filter(function (x) { return x.id === id; })[0]; if (c) focusCab(c); },
      dispose: function () {
        cancelAnimationFrame(raf); ro.disconnect();
        cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
        cv.removeEventListener('wheel', onWheel); cv.removeEventListener('dblclick', onDbl);
        window.removeEventListener('keydown', onKey);
        wrap.remove();
      }
    };
  }

  return { mount: mount };
})();
