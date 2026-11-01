/* 方案 B ——「政权书脊」
   顶部一条政权色带(ribbon)当书脊:段内永远印得下姓(固定 13px,不随窗口变),
   段边界用细线贯穿到绘图区 —— 书脊、分界、折线是同一套坐标,不可能错位。
   主图只留折线与极淡区间底色;顶部大字用明朝体,窗口变化时切换当前政权。 */
window.SCHEME_B = (function () {
  var LAB = window.LAB, T = LAB.T, DAY = LAB.DAY;

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function mount(stage) {
    var M = LAB.model;
    var head = LAB.el('div', 'b-head');
    head.innerHTML = '<div class="b-name"></div><div class="b-sub"></div><div class="b-stat"></div>';
    stage.appendChild(head);
    var host = LAB.el('div', 'chart-host');
    stage.appendChild(host);
    var chart = echarts.init(host, null, { renderer: 'canvas' });
    var L = 58, R = 44, RT = 30, RP = 0.06;

    function bands() {
      return M.cabs.map(function (c, i) { return { cab: c.id, sur: c.sur, color: c.color, d0: c.edges.d0, d1: c.edges.d1, idx: i }; });
    }
    function renderRibbon(param, api) {
      var b = bands()[param.dataIndex];
      var cs = param.coordSys;
      var x0 = Math.max(api.coord([b.d0, 0])[0], cs.x), x1 = Math.min(api.coord([b.d1, 0])[0], cs.x + cs.width);
      var w = x1 - x0;
      if (w < 1) return null;
      var out = [{ type: 'rect', shape: { x: x0, y: cs.y, width: w, height: cs.height }, style: { fill: hexA(b.color, 0.16) } }];
      out.push({ type: 'line', shape: { x1: x0, y1: cs.y + 0.5, x2: x0 + w, y2: cs.y + 0.5 }, style: { stroke: hexA(b.color, 0.85), lineWidth: 2.5 } });
      out.push({ type: 'line', shape: { x1: x0, y1: cs.y, x2: x0, y2: cs.y + cs.height }, style: { stroke: 'rgba(11,13,12,.9)', lineWidth: 1 } });
      var font = '700 13px ' + LAB.FONT_JA;
      var tw = LAB.measure(b.sur, font);
      var a = LAB.clamp((w - (tw + 12)) / 24, 0, 1);
      if (a > 0.05) out.push({ type: 'text', style: { x: x0 + 7, y: cs.y + 15, text: b.sur, font: font, fill: hexA(b.color, a), textAlign: 'left', textBaseline: 'middle' } });
      return { type: 'group', children: out };
    }
    function renderRules(param, api) {
      var b = bands()[param.dataIndex];
      if (b.idx === 0) return null;
      var cs = param.coordSys;
      var x = api.coord([b.d0, 0])[0];
      if (x < cs.x - 0.5 || x > cs.x + cs.width + 0.5) return null;
      return { type: 'line', shape: { x1: x, y1: cs.y, x2: x, y2: cs.y + cs.height }, style: { stroke: 'rgba(255,255,255,.085)', lineWidth: 1 } };
    }

    var option = {
      animation: true, animationDuration: 800, animationDurationUpdate: 0,
      grid: [
        { left: L, right: R, top: 82, height: 30 },
        { left: L, right: R, top: 82 + 30 + 24, bottom: 96 }
      ],
      tooltip: {
        trigger: 'axis', confine: true,
        backgroundColor: 'rgba(18,20,19,.95)', borderColor: 'rgba(255,255,255,.14)', borderWidth: 1,
        padding: [8, 10], textStyle: { color: T.ink, fontSize: 12, fontFamily: LAB.FONT_JA },
        axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,255,255,.28)', width: 1, type: [3, 4] } },
        formatter: function (ps) {
          var keep = ps.filter(function (p) { return p.value && p.value[1] != null; });
          if (!keep.length) return '';
          return '<div style="opacity:.7;font-size:11px">' + LAB.fmt(keep[0].value[0]) + '</div>' +
            keep.map(function (p) { return '<div style="margin-top:4px"><span style="display:inline-block;width:7px;height:7px;border-radius:9px;background:' + p.color + ';margin-right:6px"></span>' + p.seriesName + ' <b>' + p.value[1] + '%</b></div>'; }).join('');
        }
      },
      xAxis: [
        { type: 'time', gridIndex: 0, min: M.tMin - 40 * DAY, max: M.t1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        {
          type: 'time', gridIndex: 1, min: M.tMin - 40 * DAY, max: M.t1,
          axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } }, axisTick: { show: false }, splitLine: { show: false },
          axisLabel: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, hideOverlap: true, formatter: function (v) { return String(new Date(v).getUTCFullYear()); } }
        }
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        {
          type: 'value', gridIndex: 1, min: 0, max: 100, interval: 20,
          name: window.innerWidth <= 900 ? '' : '支持率 %', nameGap: 14,
          nameTextStyle: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, align: 'left' },
          axisLine: { show: false }, axisTick: { show: false },
          splitLine: { lineStyle: { color: T.grid, type: [2, 6] } },
          axisLabel: { color: T.muted, fontSize: 11, fontFamily: LAB.FONT_JA, formatter: window.innerWidth <= 900 ? '{value}%' : '{value}' }
        }
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], filterMode: 'none', start: 62, end: 100, moveOnMouseWheel: true, zoomOnMouseWheel: 'shift' },
        {
          type: 'slider', xAxisIndex: [0, 1], filterMode: 'none', start: 62, end: 100, height: 20, bottom: 34,
          borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,.045)',
          fillerColor: 'rgba(224,134,63,.20)', handleStyle: { color: '#e0863f', borderColor: 'transparent' },
          moveHandleSize: 0, showDetail: false, brushSelect: false,
          dataBackground: { lineStyle: { color: 'rgba(255,255,255,.20)' }, areaStyle: { color: 'rgba(255,255,255,.055)' } },
          selectedDataBackground: { lineStyle: { color: 'rgba(224,134,63,.5)' }, areaStyle: { color: 'rgba(224,134,63,.09)' } }
        }
      ],
      series: [
        { id: 'ribbon', type: 'custom', coordinateSystem: 'cartesian2d', xAxisIndex: 0, yAxisIndex: 0, z: 5, silent: true, tooltip: { show: false }, data: bands(), renderItem: renderRibbon },
        { id: 'rules', type: 'custom', coordinateSystem: 'cartesian2d', xAxisIndex: 1, yAxisIndex: 1, z: 1, silent: true, tooltip: { show: false }, data: bands(), renderItem: renderRules }
      ].concat(M.cabs.filter(function (c) { return c.points.length; }).map(function (c) {
        return {
          id: c.id, name: c.sur + '内閣', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
          data: c.points.map(function (p) { return [p[0], p[1], p[2]]; }),
          showSymbol: true, symbol: 'circle', symbolSize: 2.6, smooth: false,
          lineStyle: { color: c.color, width: 1.9 }, itemStyle: { color: c.color },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hexA(c.color, 0.10) }, { offset: 1, color: hexA(c.color, 0) }]) },
          z: 3, emphasis: { focus: 'none' }
        };
      }))
    };
    chart.setOption(option);

    var nameEl = head.querySelector('.b-name'), subEl = head.querySelector('.b-sub'), statEl = head.querySelector('.b-stat');
    function updateHead() {
      var m = chart.getModel();
      var ext = m.getComponent('xAxis', 1).axis.scale.getExtent();
      if (!(ext[1] > ext[0])) return;
      var best = null, bestOv = 0;
      M.cabs.forEach(function (c) {
        var a = Math.max(c.t0, ext[0]), b = Math.min(c.t1, ext[1]);
        var ov = Math.max(0, b - a);
        if (ov > bestOv) { bestOv = ov; best = c; }
      });
      if (!best) return;
      nameEl.textContent = best.pm;
      nameEl.style.color = best.color;
      subEl.textContent = best.start.replace(/-/g, '.') + ' — ' + best.end.replace(/-/g, '.') + ' / 在任 ' + best.points.length + ' か月';
      statEl.innerHTML = '<span class="k">最新</span><span class="v">' + M.latest[1].toFixed(1) + '<i>%</i></span>';
    }
    updateHead();
    var timer = 0;
    chart.on('datazoom', function () { if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = 0; updateHead(); }, 160); });
    chart.on('finished', function () { if (!timer) updateHead(); });

    var ro = new ResizeObserver(function () { chart.resize(); });
    ro.observe(host);
    return { dispose: function () { ro.disconnect(); chart.dispose(); host.remove(); head.remove(); }, chart: chart };
  }
  return { mount: mount };
})();
