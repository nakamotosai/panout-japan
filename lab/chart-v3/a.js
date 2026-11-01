/* 方案 A ——「一层画完」
   阴影 / 分割线 / 区间名全部由一个 custom series 在同一帧、同一套坐标变换里画出来。
   名字字号量化到固定档位,只在缩放停手后重算 → 拖动过程中绝不跳号。
   放不下的区间名用透明度渐隐,不缩字号、不越界。 */
window.SCHEME_A = (function () {
  var LAB = window.LAB, T = LAB.T, DAY = LAB.DAY;
  var STEPS = [96, 72, 56, 44, 32, 24, 18, 14, 11];

  function mount(stage) {
    var M = LAB.model;
    var host = LAB.el('div', 'chart-host');
    stage.appendChild(host);
    var chart = echarts.init(host, null, { renderer: 'canvas' });
    var narrow = window.innerWidth <= 720;   // 窄屏:只给放得下的区间印名字(地标式),不做渐隐
    var MINW = narrow ? 46 : 26;
    var big = 44;
    var L = 58, R = 44, TOP = 76, BOT = 84;

    function bands() {
      return M.cabs.map(function (c, i) {
        return { cab: c.id, sur: c.sur, color: c.color, d0: c.edges.d0, d1: c.edges.d1, alt: i % 2 === 0 };
      });
    }
    function plot() {
      var m = chart.getModel();
      return { rect: m.getComponent('grid', 0).coordinateSystem.getRect(), ext: m.getComponent('xAxis', 0).axis.scale.getExtent() };
    }
    function fitSize() {
      var p = plot(), span = p.ext[1] - p.ext[0];
      if (!(span > 0)) return big;
      var limit = 96;
      bands().forEach(function (b) {
        var x0 = Math.max(p.rect.x + ((Date.parse(b.d0) - p.ext[0]) / span) * p.rect.width, p.rect.x);
        var x1 = Math.min(p.rect.x + ((Date.parse(b.d1) - p.ext[0]) / span) * p.rect.width, p.rect.x + p.rect.width);
        var w = x1 - x0;
        if (w < MINW) return;
        var f = (w - 14) / Math.max(1, b.sur.length);
        if (f < limit) limit = f;
      });
      for (var i = 0; i < STEPS.length; i++) if (STEPS[i] <= limit) return STEPS[i];
      return 11;
    }

    function renderBand(param, api) {
      var b = bands()[param.dataIndex];
      var cs = param.coordSys;
      var x0 = Math.max(api.coord([b.d0, 0])[0], cs.x);
      var x1 = Math.min(api.coord([b.d1, 0])[0], cs.x + cs.width);
      if (x1 - x0 < 0.7) return null;
      var out = [];
      if (b.alt) out.push({ type: 'rect', shape: { x: x0, y: cs.y, width: x1 - x0, height: cs.height }, style: { fill: T.band } });
      var realX = api.coord([b.d0, 0])[0];
      if (realX > cs.x + 2.5 && realX < cs.x + cs.width) {
        out.push({ type: 'line', shape: { x1: realX, y1: cs.y, x2: realX, y2: cs.y + cs.height }, style: { stroke: T.bandEdge, lineWidth: 1, lineDash: [3, 5] } });
      }
      var font = '700 ' + big + 'px ' + LAB.FONT_JA;
      var tw = LAB.measure(b.sur, font);
      var w = x1 - x0;
      var a = narrow ? (w >= MINW ? 1 : 0) : LAB.clamp((w - (tw - 20)) / (28 + tw * 0.15), 0, 1);
      if (a > 0.03) {
        out.push({ type: 'text', style: { x: x0 + 12, y: cs.y + 10, text: b.sur, font: font, fill: hexA(b.color, 0.36 * a), textAlign: 'left', textBaseline: 'top' } });
      }
      return { type: 'group', children: out };
    }

    function hexA(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    var option = {
      animation: true,
      animationDuration: 900,
      animationDurationUpdate: 0,
      animationEasingUpdate: 'linear',
      backgroundColor: 'transparent',
      grid: { left: L, right: R, top: TOP, bottom: BOT },
      tooltip: {
        trigger: 'axis', confine: true,
        backgroundColor: 'rgba(18,20,19,.94)', borderColor: 'rgba(255,255,255,.14)', borderWidth: 1,
        padding: [8, 10], textStyle: { color: T.ink, fontSize: 12, fontFamily: LAB.FONT_JA },
        formatter: function (ps) {
          var keep = ps.filter(function (p) { return p.seriesId !== 'bands' && p.value; });
          if (!keep.length) return '';
          var head = '<div style="opacity:.7;font-size:11px">' + LAB.fmt(keep[0].value[0]) + '</div>';
          return head + keep.map(function (p) {
            return '<div style="margin-top:4px"><span style="display:inline-block;width:7px;height:7px;border-radius:9px;background:' + p.color + ';margin-right:6px"></span>' + p.seriesName + ' <b>' + p.value[1] + '%</b> <span style="opacity:.55">' + p.value[2] + ' 社</span></div>';
          }).join('');
        }
      },
      xAxis: {
        type: 'time', gridIndex: 0, boundaryGap: false,
        min: M.tMin - 40 * DAY, max: M.t1,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, hideOverlap: true, formatter: function (v) { return String(new Date(v).getUTCFullYear()); } }
      },
      yAxis: {
        type: 'value', gridIndex: 0, min: 0, max: 100, interval: 20,
        name: '支持率 %', nameGap: 14,
        nameTextStyle: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, align: 'left' },
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: T.grid, type: [2, 6] } },
        axisLabel: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, formatter: '{value}' }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none', start: 62, end: 100, moveOnMouseWheel: true, zoomOnMouseWheel: 'shift' },
        {
          type: 'slider', xAxisIndex: 0, filterMode: 'none', start: 62, end: 100, height: 22, bottom: 26,
          borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,.045)',
          fillerColor: 'rgba(224,134,63,.22)', handleStyle: { color: '#e0863f', borderColor: 'transparent' },
          moveHandleSize: 0, showDetail: false, brushSelect: false,
          dataBackground: { lineStyle: { color: 'rgba(255,255,255,.22)' }, areaStyle: { color: 'rgba(255,255,255,.06)' } },
          selectedDataBackground: { lineStyle: { color: 'rgba(224,134,63,.55)' }, areaStyle: { color: 'rgba(224,134,63,.10)' } }
        }
      ],
      series: [{
        id: 'bands', name: '区间', type: 'custom', coordinateSystem: 'cartesian2d',
        xAxisIndex: 0, yAxisIndex: 0, z: 1, silent: true, tooltip: { show: false },
        data: bands(), renderItem: renderBand
      }].concat(M.cabs.filter(function (c) { return c.points.length; }).map(function (c) {
        return {
          id: c.id, name: c.sur + '内閣', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
          data: c.points.map(function (p) { return [p[0], p[1], p[2]]; }),
          showSymbol: true, symbol: 'circle', symbolSize: 3.6, smooth: false,
          lineStyle: { color: c.color, width: 2.1 },
          itemStyle: { color: c.color },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: hexA(c.color, 0.16) }, { offset: 1, color: hexA(c.color, 0) }
            ])
          },
          z: 3, emphasis: { focus: 'none' }
        };
      }))
    };

    chart.setOption(option);
    // 只在「窗口或绘图区尺寸真的变了」时重算字号(签名闸):
    // 初始 dataZoom 不触发 datazoom 事件,所以这里不能只靠事件;拖动中由 timer 挡着不重算。
    var fitSig = '';
    function applyFit() {
      var p = plot();
      if (!p.rect || !p.rect.width) return;
      var sig = Math.round(p.ext[0]) + '|' + Math.round(p.ext[1]) + '|' + Math.round(p.rect.width);
      if (sig === fitSig) return;
      fitSig = sig;
      var s = fitSize();
      if (s !== big) { big = s; chart.setOption({ series: [{ id: 'bands', data: bands() }] }); }
    }
    var timer = 0;
    chart.on('datazoom', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = 0; applyFit(); }, 170);
    });
    chart.on('finished', function () { if (!timer) applyFit(); });

    var ro = new ResizeObserver(function () { chart.resize(); applyFit(); });
    ro.observe(host);
    return {
      dispose: function () { ro.disconnect(); chart.dispose(); host.remove(); },
      chart: chart,
      debug: function () { return { big: big, fit: fitSize(), bands: bands().length }; }
    };
  }
  return { mount: mount };
})();
