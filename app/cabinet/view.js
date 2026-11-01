/* japan.ouuut.com · Cabinet view (single-page mount)
 * Source: sites/cabinet/index.html
 * Redesigned layout: bottom merged zoom segment + right editorial profile panel + markLine inside labels.
 */
'use strict';

const DATA_CANDIDATES = ["./app/cabinet/data.json","../app/cabinet/data.json"];
let cabForcedBase = null;
const ECHARTS_URLS = [
  "/app/cabinet/vendor/echarts.min.js",
  "./app/cabinet/vendor/echarts.min.js",
  "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
  "https://unpkg.com/echarts@5.5.1/dist/echarts.min.js"
];
const THEME_MAP = { mono: "editorial", sage: "editorial", dark: "tactical", tactical: "tactical", editorial: "editorial" };


// ECharts 画在 canvas 上，不认识 CSS 变量：直接塞 'var(--ja-sans)' 会静默回落到浏览器默认衬线。
// 这里把计算值取出来再交给 ECharts。
function cssFont(varName, fallback) {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  } catch (e) { return fallback; }
}

const CAB_CSS = `
#v-cabinet-viewport, .cab-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.cab-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
#cab-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}
/* 底部标签条：左侧按钮组，右侧对齐 slider */
.cab-bottom-bar {
  position: absolute;
  bottom: 8px;
  left: 36px;
  z-index: 8;
  display: flex;
  align-items: center;
  pointer-events: none;
}
.cab-bottom-bar > * {
  pointer-events: auto;
}
.cab-zoom {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--bg);
  padding: 2px;
  border-radius: var(--radius, 4px);
  border: 0;
}
.cab-zoom button {
  height: 26px;
  padding: 0 10px;
  border-radius: var(--btn-radius, 2px);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans, system-ui);
  font-size: 12px;
  font-weight: 350;
  border: none;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.cab-zoom button:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  transform: translateY(-1px);
}
.cab-zoom button.on {
  background: var(--accent);
  color: var(--bg);
  font-weight: 350;
}

/* 右侧深度信息面板（类似犯罪率右侧面板） */
.cab-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 352px;
  height: calc(100% - 44px);
  max-height: calc(100% - 44px);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
  pointer-events: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  font-family: var(--font-sans, system-ui, sans-serif);
}
.cab-panel::-webkit-scrollbar { width: 0; height: 0; display: none; }

.cab-panel .panel-card {
  flex-shrink: 0;
  background: var(--bg-card, #E9EDE3);
  border: 0;
  border-radius: var(--radius, 4px);
  padding: 16px 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  color: var(--ink);
  transition: all 0.2s ease;
}
.cab-panel .card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.cab-panel .card-title {
  margin: 0;
  font-size: 22px;
  font-weight: 250;
  line-height: 1.25;
  color: var(--ink);
  letter-spacing: -0.3px;
  font-family: var(--font-sans, system-ui, sans-serif);
}
.cab-panel .card-subtitle {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 350;
  margin-top: 4px;
  line-height: 1.45;
}
.cab-panel .card-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}
.cab-panel .stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0 10px 0;
}
.cab-panel .stat-box {
  background: var(--bg-subcard, rgba(0, 0, 0, 0.035));
  padding: 12px 14px;
  border-radius: var(--btn-radius, 2px);
  border: 0;
}
.cab-panel .stat-num {
  font-size: 32px;
  font-weight: 200;
  line-height: 1.05;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  font-family: var(--font-sans, system-ui, sans-serif);
}
.cab-panel .stat-label {
  font-size: 11px;
  color: var(--muted);
  margin-top: 5px;
  font-weight: 350;
}
.cab-panel .policy-item {
  margin-bottom: 11px;
  padding-left: 10px;
  border-left: 2.5px solid var(--accent, #FF6A3D);
}
.cab-panel .policy-item:last-child {
  margin-bottom: 0;
}
.cab-panel .policy-title {
  font-size: 14.5px;
  font-weight: 300;
  color: var(--ink);
  margin-bottom: 2px;
}
.cab-panel .policy-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  font-weight: 350;
}
.cab-panel .back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  padding: 7px 14px;
  border-radius: 4px;
  border: 1px solid var(--line-main, rgba(20, 26, 21, 0.15));
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;
}
.cab-panel .back-btn:hover {
  background: var(--accent, #FF6A3D);
  color: #fff;
  border-color: var(--accent, #FF6A3D);
}
@media (max-width: 960px) {
  /* 竖屏：图表 58% / 档案面板 42% 上下分栏，面板不再被 display:none 整块砍掉 */
  .cab-viewport { display: flex; flex-direction: column; }
  #cab-chart { flex: 0 0 56%; height: 56% !important; }
  .cab-panel {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    width: 100%;
    height: 44%;
    max-height: 44%;
    padding: 8px 12px 16px;
    border-radius: 0;
  }
  .cab-panel .panel-card { border-radius: 6px; padding: 12px 14px; }
  .cab-bottom-bar {
    top: calc(56% - 34px) !important;
    bottom: auto !important;
    left: 12px !important;
    right: 12px !important;
  }
}

/* 任期内支持率曲线 + 分享按钮 */
.cab-panel .tenure-block { margin: 14px 0 0 0; }
.cab-panel .tenure-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.cab-panel .tenure-svg {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 4px;
  overflow: visible;
}
.cab-panel .tenure-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}
.cab-panel .tenure-note {
  font-size: 11px;
  font-weight: 350;
  color: var(--muted);
  line-height: 1.4;
}
.cab-panel .cab-share {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 12px;
  font-weight: 400;
  padding: 7px 12px;
  border-radius: var(--btn-radius, 2px);
  border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.cab-panel .cab-share:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
.cab-panel .cab-share:active { transform: scale(0.98); }
.cab-panel .cab-share.is-done { background: var(--accent); border-color: var(--accent); color: #fff; }
@media (max-width: 960px) {
  .cab-panel .tenure-svg { max-height: 120px; }
}
`;

const CAB_PROFILES = {
  "obuchi": {
    "id": "obuchi",
    "nameZh": "小渊惠三",
    "nameJa": "小渕恵三",
    "nameEn": "Keizo Obuchi",
    "eraNumberZh": "第84任内阁总理大臣",
    "eraNumberJa": "第84代内閣総理大臣",
    "eraNumberEn": "84th Prime Minister of Japan",
    "partyZh": "自由民主党（平成研究会 / 竹下派）",
    "partyJa": "自由民主党（平成研究会・竹下派）",
    "partyEn": "Liberal Democratic Party (Heisei Kenkyukai)",
    "period": "1998-07-30 — 2000-04-05",
    "months": 20,
    "days": 616,
    "trendBadgeZh": "稳步回升 · 突发脑梗",
    "trendBadgeJa": "支持率回復・病に倒れる",
    "trendBadgeEn": "Gradual Recovery · Sudden Collapse",
    "originZh": "群马县吾妻郡中之条町 · 早稻田大学大学院政治学研究科",
    "originJa": "群馬県中之条町出身・早稲田大学大学院政治学研究科",
    "originEn": "Gunma Pref. · Waseda University Graduate School",
    "bioZh": "早年作为官房长官公布“平成”年号，被民众亲切称为“平成大叔”。就任初期因缺乏领袖光芒被外媒嘲弄为“冷披萨”、“凡人首相”，但凭借极度诚恳的人格魅力与勤勉作风，广泛打电话联络各界人士（“电话魔”），支持率逆势大幅反弹。",
    "bioJa": "官房長官時代に「平成」の新元号を発表し「平成おじさん」として親しまれる。就任当初は「冷めたピザ」「凡人」と揶揄されるも、「ブッチホン」と呼ばれる電話攻勢と誠実な人柄で世論を味方につけ、支持率を大きく押し上げた。",
    "bioEn": "Announced the 'Heisei' era as Chief Cabinet Secretary ('Heisei Uncle'). Mocked as 'cold pizza' and an 'ordinary man' upon taking office, he reversed public skepticism through tireless telephone outreach and sincere pragmatism.",
    "policiesZh": [
      {
        "title": "自自公联合政权",
        "desc": "打破参议院捻转困局，先后联合自由党与公明党组建稳固的联合执政构架，奠定此后自公联盟长达数十年的合作基础。"
      },
      {
        "title": "发行地域振兴券",
        "desc": "面对亚洲金融危机与通缩压力，向全国特定家庭发放每人2万日元消费券刺激内需，开创日本消费券刺激经济先河。"
      },
      {
        "title": "金融再生与减税对策",
        "desc": "通过金融再生两法，成立金融再生委员会，全力处置泡沫破裂后的巨额不良债权；实施超10万亿日元规模的减税与公共事业投入。"
      }
    ],
    "crisisZh": "2000年4月2日凌晨，因连日繁重政务在首相官邸突发脑梗塞紧急送医，陷入昏迷。4月5日内阁总辞职，同年5月14日逝世，享年62岁。",
    "policiesJa": [
      {
        "title": "自自公連立政権",
        "desc": "参議院のねじれを打開するため、自由党、続いて公明党と連立を組み、安定的な連立政権の枠組みを構築した。その後の自公連立が数十年続く基礎を築いた。"
      },
      {
        "title": "地域振興券を発行",
        "desc": "アジア通貨危機とデフレ圧力を受け、全国の特定世帯に1人2万円分の地域振興券を交付して内需を刺激した。日本の消費券による景気刺激策の先駆けとなった。"
      },
      {
        "title": "金融再生と減税策",
        "desc": "金融再生2法を成立させ金融再生委員会を設置し、バブル崩壊後の巨額不良債権の処理に全力を挙げた。10兆円超規模の減税と公共事業投入も実施した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Three-Party Coalition",
        "desc": "Broke the deadlock in the House of Councillors by forming coalitions first with the Liberal Party and then with Komeito, building a stable governing framework that laid the foundation for the LDP-Komeito alliance lasting decades."
      },
      {
        "title": "Regional Stimulus Vouchers",
        "desc": "Faced with the Asian financial crisis and deflationary pressure, distributed 20,000-yen consumption vouchers per person to designated households nationwide to stimulate domestic demand, pioneering consumption-voucher stimulus in Japan."
      },
      {
        "title": "Bank Cleanup and Tax Cuts",
        "desc": "Enacted the two financial revitalization laws and established the Financial Reconstruction Commission to clear the massive bad loans left by the bubble's collapse, and implemented more than 10 trillion yen in tax cuts and public works spending."
      }
    ],
    "crisisJa": "2000年4月2日未明、連日の激務により首相官邸で脳梗塞を発症して緊急搬送され、昏睡状態に陥った。4月5日に内閣は総辞職、同年5月14日に死去。享年62。",
    "crisisEn": "In the early hours of April 2, 2000, he suffered a cerebral infarction at the Prime Minister's Office after days of heavy official duties and was rushed to hospital in a coma. The cabinet resigned on April 5, and he died on May 14 that year at the age of 62."
  },
  "mori": {
    "id": "mori",
    "nameZh": "森喜朗",
    "nameJa": "森喜朗",
    "nameEn": "Yoshiro Mori",
    "eraNumberZh": "第85·86任内阁总理大臣",
    "eraNumberJa": "第85・86代内閣総理大臣",
    "eraNumberEn": "85th–86th Prime Minister of Japan",
    "partyZh": "自由民主党（清和政策研究会 / 森派）",
    "partyJa": "自由民主党（清和政策研究会・森派）",
    "partyEn": "Liberal Democratic Party (Seiwa Seisaku Kenkyukai)",
    "period": "2000-04-05 — 2001-04-26",
    "months": 13,
    "days": 387,
    "trendBadgeZh": "失言风波 · 暴跌至7%",
    "trendBadgeJa": "失言連発・支持率7%急落",
    "trendBadgeEn": "Gaffes & Historical Low 7%",
    "originZh": "石川县能美市 · 早稻田大学商学部 · 日本橄榄球协会长年会长",
    "originJa": "石川県能美市出身・早稲田大学商学部",
    "originEn": "Ishikawa Pref. · Waseda University",
    "bioZh": "小渊突发脑梗后，由自民党干事长野中广务等五位实力派大佬在东京酒店闭门密室选定继任。执政期间虽大力推动信息技术立国，但因屡次发表不慎失言引发舆论强烈反弹，内阁支持率一路坠跌至日本宪政历史最低点 7.0%。",
    "bioJa": "小渕首相の急病に伴い「自民党五人組」の密室協議により就任。「IT基本法」制定などIT立国を掲げ成果を上げたが、「神の国発言」やえひめ丸事故時のゴルフ継続など度重なる舌禍事件で支持率は憲政史上最低水準の7%台まで暴落した。",
    "bioEn": "Selected in a backroom deal by five party heavyweights after Obuchi's sudden illness. Despite pushing the IT Basic Act, serial gaffes (calling Japan a 'divine nation') and golfing during the Ehime Maru submarine disaster plunged his support to an all-time low of 7.0%.",
    "policiesZh": [
      {
        "title": "中央省厅重大统合再编",
        "desc": "完成战后最大规模的中央行政机构改革，将原有的1府22省厅精简整合为现在的1府12省厅，于2001年1月正式启动运作。"
      },
      {
        "title": "IT基本法与信息革命",
        "desc": "主导制定《高度信息通信网络社会形成基本法》（IT基本法），设立IT战略本部，推进光纤普及与日本高速宽带网络飞跃发展。"
      },
      {
        "title": "主办冲绳八国峰会",
        "desc": "顺利举行2000年九州·冲绳 G8 首脑峰会，并在日本发行面值两千日元的纪念纸币。"
      }
    ],
    "crisisZh": "2001年2月美军核潜艇撞沉爱媛县立水产高中练习船“爱媛丸号”，森喜朗接报后仍继续打高尔夫球，招致全国愤怒舆论，党内“倒森”声浪汹涌，被迫宣布提前举行总裁大选引咎退职。",
    "policiesJa": [
      {
        "title": "中央省庁の再編",
        "desc": "戦後最大規模の中央行政機構改革を完遂し、1府22省庁を1府12省庁に統合・整理した。2001年1月に新体制を発足させた。"
      },
      {
        "title": "IT基本法の制定",
        "desc": "「高度情報通信ネットワーク社会形成基本法」（IT基本法）の制定を主導し、IT戦略本部を設置した。光ファイバーの普及と高速ブロードバンド網の飛躍的な整備を推進した。"
      },
      {
        "title": "九州・沖縄サミット",
        "desc": "2000年の九州・沖縄G8首脳会議を成功裏に開催し、あわせて2,000円の記念紙幣を発行した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Central Ministry Restructuring",
        "desc": "Completed the largest post-war reform of central government, consolidating 1 cabinet office and 22 ministries and agencies into today's 1 cabinet office and 12 ministries, which began operating in January 2001."
      },
      {
        "title": "IT Basic Act",
        "desc": "Led enactment of the Basic Act on the Formation of an Advanced Information and Telecommunications Network Society (IT Basic Act), set up an IT Strategy Headquarters, and drove fiber-optic rollout and the rapid build-out of high-speed broadband."
      },
      {
        "title": "Kyushu-Okinawa G8 Summit",
        "desc": "Hosted the 2000 Kyushu-Okinawa G8 summit successfully and issued a commemorative 2,000-yen banknote in Japan."
      }
    ],
    "crisisJa": "2001年2月、米原子力潜水艦が愛媛県立水産高校の練習船「えひめ丸」を沈没させた事故で、森喜朗は一報を受けた後もゴルフを続け、全国的な怒りを招いた。党内で「森降ろし」の声が高まり、総裁選の前倒しを余儀なくされ引責辞任した。",
    "crisisEn": "In February 2001 a US nuclear submarine sank the Ehime Maru, a training vessel of a prefectural fisheries high school; Mori kept playing golf after being told, provoking nationwide outrage. With party calls to oust him swelling, he was forced to call an early leadership election and resigned to take responsibility."
  },
  "koizumi": {
    "id": "koizumi",
    "nameZh": "小泉纯一郎",
    "nameJa": "小泉純一郎",
    "nameEn": "Junichiro Koizumi",
    "eraNumberZh": "第87·88·89任内阁总理大臣",
    "eraNumberJa": "第87〜89代内閣総理大臣",
    "eraNumberEn": "87th–89th Prime Minister of Japan",
    "partyZh": "自由民主党（清和政策研究会）",
    "partyJa": "自由民主党（清和政策研究会）",
    "partyEn": "Liberal Democratic Party (Seiwa Kenkyukai)",
    "period": "2001-04-26 — 2006-09-26",
    "months": 65,
    "days": 1980,
    "trendBadgeZh": "破格长命 · 邮政旋风",
    "trendBadgeJa": "小泉旋風・郵政解散・長期政権",
    "trendBadgeEn": "Koizumi Theater · 1980 Days",
    "originZh": "神奈川县横须贺市 · 庆应义塾大学经济学部 · 伦敦大学留学生",
    "originJa": "神奈川県横須賀市出身・慶應義塾大学経済学部",
    "originEn": "Kanagawa Pref. · Keio University",
    "bioZh": "打出“打破自民党”、“没有圣域的结构改革”口号，凭借超凡的演讲感染力与剧场型政治手法，首创 85.2% 的内阁支持率历史纪录。在位长达 5 年 5 个月，带领自民党摆脱派阀垄断，开创日本政治新格局，任期届满主动潇洒隐退。",
    "bioJa": "「自民党をぶっ壊す」「聖域なき構造改革」を掲げ、歴代最高の85.2%という驚異的な支持率で発足。ワンフレーズ・ポリティクスと劇場型政治で圧倒的な国民的人気を誇り、1,980日に及ぶ長期政権を築いた後、任期満了に伴い自ら退陣した。",
    "bioEn": "Took power with an all-time record 85.2% approval promising to 'destroy the old LDP' without sanctuary. Master of theatre politics and punchy slogans, he served 1,980 days—one of Japan's longest post-war tenures—and stepped down voluntarily at peak popularity.",
    "policiesZh": [
      {
        "title": "不良债权最终清理",
        "desc": "任用竹中平藏推行金融再生计划，强力督促各大都市银行处置巨额呆账坏账，彻底拆除日本平成金融危机的核心定时炸弹。"
      },
      {
        "title": "邮政民营化与道路公团改革",
        "desc": "把庞大的日本邮政储蓄与简保资金由国家手中推向市场；解散重组道路公团，遏制地方无度基建财政赤字。"
      },
      {
        "title": "2005年“邮政解散”大选",
        "desc": "参议院否决邮政法案后毅然解散众院，取消反对法案党内议员的公认资格并派遣“刺客候选人”，率自民党赢得296席历史性压倒性狂胜。"
      }
    ],
    "crisisZh": "靖国神社参拜引发邻国外交僵局，改革带来的城乡贫富差距扩大受到在野党抨击，但他坚守自民党总裁任期上限规定，2006年9月光荣引退。",
    "policiesJa": [
      {
        "title": "不良債権の最終処理",
        "desc": "竹中平蔵を登用して金融再生プログラムを推進し、都市銀行に巨額の不良債権処理を強く促した。平成金融危機の核心となる時限爆弾を完全に取り除いた。"
      },
      {
        "title": "郵政・道路公団改革",
        "desc": "巨額の郵便貯金・簡易保険資金を国の手から市場へ移し、道路公団を解散・再編して、地方の無秩序なインフラ投資による財政赤字を抑制した。"
      },
      {
        "title": "2005年郵政解散",
        "desc": "参議院が郵政法案を否決した後、衆議院を解散した。造反議員の公認を取り消して「刺客候補」を擁立し、自民党を296議席の歴史的圧勝に導いた。"
      }
    ],
    "policiesEn": [
      {
        "title": "Final Bad-Loan Cleanup",
        "desc": "Appointed Heizo Takenaka to push the Financial Revival Program, pressing major city banks to dispose of huge volumes of non-performing loans and defusing the core time bomb of Japan's Heisei financial crisis."
      },
      {
        "title": "Postal and Road Reform",
        "desc": "Moved the vast postal savings and life insurance funds from state control into the market, and dissolved and reorganized the road public corporations to curb runaway local infrastructure spending and deficits."
      },
      {
        "title": "2005 Postal Snap Election",
        "desc": "After the Upper House rejected the postal bills, he dissolved the Lower House, stripped rebel LDP members of endorsement and fielded 'assassin' candidates, leading the LDP to a historic landslide of 296 seats."
      }
    ],
    "crisisJa": "靖国神社参拝が近隣諸国との外交停滞を招き、改革に伴う都市と地方の格差拡大が野党の批判を浴びた。しかし自民党総裁の任期上限を守り、2006年9月に花道を飾って退陣した。",
    "crisisEn": "His visits to Yasukuni Shrine froze diplomacy with neighboring countries, and the urban-rural wealth gap widened by his reforms drew opposition criticism, but he honored the LDP's term limit for its president and retired in glory in September 2006."
  },
  "abe1": {
    "id": "abe1",
    "nameZh": "安倍晋三 (第一次)",
    "nameJa": "安倍晋三(1次)",
    "nameEn": "Shinzo Abe (1st)",
    "eraNumberZh": "第90任内阁总理大臣",
    "eraNumberJa": "第90代内閣総理大臣",
    "eraNumberEn": "90th Prime Minister of Japan",
    "partyZh": "自由民主党（清和政策研究会）",
    "partyJa": "自由民主党（清和政策研究会）",
    "partyEn": "Liberal Democratic Party (Seiwa Kenkyukai)",
    "period": "2006-09-26 — 2007-09-26",
    "months": 12,
    "days": 366,
    "trendBadgeZh": "高开低走 · 肠炎猝辞",
    "trendBadgeJa": "消えた年金・参院選大敗・辞任",
    "trendBadgeEn": "Pension Crisis · Sudden Resignation",
    "originZh": "东京都（山口县长门市选区）· 成蹊大学法学部",
    "originJa": "東京都出身・成蹊大学法学部",
    "originEn": "Tokyo · Seikei University",
    "bioZh": "战后出生的第一位首相，提出“建设美丽的日本”口号，受到保守派与年轻一代寄予厚望。但上任后阁僚丑闻不断，叠加社会保险厅“消失的5000万份养老金记录”爆发，2007年参议院大选遭遇历史性惨败，陷入参众两院对立的“捻转国会”。",
    "bioJa": "戦後生まれ初の首相として「美しい国、日本」を掲げて若々しく登場。しかし閣僚の不祥事・自殺が相次ぎ、「消えた年金問題」で国民の怒りが爆発。2007年参院選で大敗し、所信表明演説直後に潰瘍性大腸炎の悪化で突如辞任を発表した。",
    "bioEn": "First prime minister born after WWII, championing 'a beautiful Japan'. Crippled by cabinet scandals, minister suicides, and the '50 million missing pensions' scandal, the LDP was routed in the 2007 Upper House election; he resigned abruptly due to ulcerative colitis.",
    "policiesZh": [
      {
        "title": "防卫厅升格为防卫省",
        "desc": "实现了防卫厅自1954年设立以来的长年夙愿，将其升格为正式的国家省厅，提升自卫队的国际地位与法制完备性。"
      },
      {
        "title": "通过国民投票法",
        "desc": "制定确立宪法修改手续的《国民投票法》，为日后修宪辩论奠定首个法定程序基石；修改时隔60年的《教育基本法》。"
      },
      {
        "title": "构想日美澳印四边机制",
        "desc": "在印度国会发表“两洋交汇”著名演讲，首次提出印太四边安全合作（QUAD）雏形。"
      }
    ],
    "crisisZh": "参院大选惨败后，在国会发表施政演说仅两天后，因溃疡性大肠炎剧烈恶化无法正常履职，于2007年9月12日突然在记者会宣布辞职，引发政坛震荡。",
    "policiesJa": [
      {
        "title": "防衛庁の省昇格",
        "desc": "1954年の防衛庁設置以来の長年の悲願を実現し、正式な国の省へと昇格させて、自衛隊の国際的地位と法整備を高めた。"
      },
      {
        "title": "国民投票法の成立",
        "desc": "憲法改正の手続きを定める国民投票法を制定し、後の改憲論議の最初の法的基礎を築いた。あわせて60年ぶりに教育基本法を改正した。"
      },
      {
        "title": "日米豪印の枠組み構想",
        "desc": "インド国会で「二つの大洋の交わり」と題する演説を行い、インド太平洋における4か国安全保障協力（QUAD）の原型を初めて提唱した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Defense Agency Upgrade",
        "desc": "Fulfilled the long-standing goal since the agency's 1954 founding by upgrading it to a full ministry, raising the Self-Defense Forces' international standing and legal footing."
      },
      {
        "title": "Referendum Law",
        "desc": "Enacted the National Referendum Act setting out constitutional amendment procedures, laying the first legal foundation for later debate on revising the charter, and amended the 60-year-old Fundamental Law of Education."
      },
      {
        "title": "Quad Concept",
        "desc": "In a landmark 'Confluence of the Two Seas' address to the Indian parliament, he first proposed what became the four-nation Indo-Pacific security grouping (Quad)."
      }
    ],
    "crisisJa": "参院選で大敗した後、国会での所信表明演説からわずか2日後、潰瘍性大腸炎の急激な悪化で職務遂行が困難となり、2007年9月12日に記者会見で突然辞任を表明し、政界に衝撃を与えた。",
    "crisisEn": "After a crushing Upper House election defeat, only two days after delivering his policy speech to the Diet he suddenly announced his resignation at a press conference on September 12, 2007, as acute worsening of ulcerative colitis left him unable to perform his duties, shaking the political world."
  },
  "fukuda": {
    "id": "fukuda",
    "nameZh": "福田康夫",
    "nameJa": "福田康夫",
    "nameEn": "Yasuo Fukuda",
    "eraNumberZh": "第91任内阁总理大臣",
    "eraNumberJa": "第91代内閣総理大臣",
    "eraNumberEn": "91st Prime Minister of Japan",
    "partyZh": "自由民主党（清和政策研究会）",
    "partyJa": "自由民主党（清和政策研究会）",
    "partyEn": "Liberal Democratic Party (Seiwa Kenkyukai)",
    "period": "2007-09-26 — 2008-09-24",
    "months": 12,
    "days": 365,
    "trendBadgeZh": "捻转国会 · 客观看待自己",
    "trendBadgeJa": "ねじれ国会・消費者庁創設",
    "trendBadgeEn": "Twisted Diet · Resignation",
    "originZh": "群马县高崎市 · 早稻田大学第一政治经济学部 · 宪政史上首对父子首相",
    "originJa": "群馬県高崎市出身・早稲田大学政治経済学部",
    "originEn": "Gunma Pref. · Waseda University",
    "bioZh": "其父福田赳夫曾任首相，两人成为日本宪政史上首对父子宰相。性格稳健低调、擅长调和，提出“消费者行政”新理念。但面临民主党掌控参议院的“捻转国会”，政权运营举步维艰，日银总长人事案屡遭参院否决长达数月。",
    "bioJa": "父・福田赳夫に続く憲政史上初の「父子2代首相」。安定した調整力で消費者庁の創設や洞爺湖サミットを成功させるも、民主党が多数を握る「ねじれ国会」の泥沼に苦悶。辞任会見で「あなたとは違うんです」の流行語を残し退陣した。",
    "bioEn": "Son of Takeo Fukuda, marking Japan's first father-son prime minister dynasty. Despite creating the Consumer Affairs Agency and hosting the Toyako G8 summit, a Diet deadlock led him to resign after one year, uttering the famous retort: 'I can see myself objectively; I'm not like you.'",
    "policiesZh": [
      {
        "title": "创设消费者厅",
        "desc": "鉴于毒饺子事件等食品与产品安全隐患，大刀阔斧冲破各省厅行政壁垒，创设统筹全国消费者权益保护的专门行政机关“消费者厅”。"
      },
      {
        "title": "提出“福田愿景”",
        "desc": "在洞爷湖 G8 峰会前提倡温室气体减排60%-80%的长远环境愿景，树立日本低碳发展国家标杆。"
      },
      {
        "title": "积极改善中日关系",
        "desc": "主张重视亚洲外交，实现中日首脑互访并签署第四个政治文件，使中日关系重新步入春暖花开轨道。"
      }
    ],
    "crisisZh": "参议院在野党多数频繁否决关键人事与法案，2008年9月1日因自民党支持率持续低迷且政权停滞，宣布内阁总辞职以打破国会僵局。",
    "policiesJa": [
      {
        "title": "消費者庁の創設",
        "desc": "毒入り餃子事件など食品・製品の安全問題を踏まえ、省庁の縦割りを打破して消費者保護を一元化する「消費者庁」を創設した。"
      },
      {
        "title": "福田ビジョン",
        "desc": "洞爺湖サミットを前に、温室効果ガスを60〜80%削減する長期的な環境ビジョンを提唱し、低炭素社会に向けた国家の指針を示した。"
      },
      {
        "title": "日中関係の改善",
        "desc": "アジア外交を重視する立場から、日中首脳の相互訪問と4つ目の政治文書の署名を実現し、日中関係を再び改善の軌道に乗せた。"
      }
    ],
    "policiesEn": [
      {
        "title": "Consumer Affairs Agency",
        "desc": "Amid food and product safety scares such as the tainted dumpling incident, he cut through bureaucratic silos to create the Consumer Affairs Agency as a dedicated body coordinating nationwide consumer protection."
      },
      {
        "title": "Fukuda Vision",
        "desc": "Ahead of the Toyako G8 summit, he proposed a long-term environmental vision of cutting greenhouse gas emissions by 60–80%, setting a national benchmark for low-carbon development."
      },
      {
        "title": "China Rapprochement",
        "desc": "Championing diplomacy that values Asia, he realized reciprocal prime ministerial visits and signed a fourth political document, putting Japan-China ties back on a thawing track."
      }
    ],
    "crisisJa": "参議院では野党が多数を占め、重要人事や法案が相次いで否決された。2008年9月1日、自民党支持率の低迷と政権の停滞を受け、国会の膠着を打破するため内閣総辞職を表明した。",
    "crisisEn": "With opposition parties commanding the Upper House and repeatedly blocking key appointments and bills, on September 1, 2008, citing persistently low LDP support and a stalled government, he announced the cabinet's resignation to break the Diet deadlock."
  },
  "aso": {
    "id": "aso",
    "nameZh": "麻生太郎",
    "nameJa": "麻生太郎",
    "nameEn": "Taro Aso",
    "eraNumberZh": "第92任内阁总理大臣",
    "eraNumberJa": "第92代内閣総理大臣",
    "eraNumberEn": "92nd Prime Minister of Japan",
    "partyZh": "自由民主党（为公会 / 麻生派）",
    "partyJa": "自由民主党（為公会・麻生派）",
    "partyEn": "Liberal Democratic Party (Shikokai)",
    "period": "2008-09-24 — 2009-09-16",
    "months": 12,
    "days": 358,
    "trendBadgeZh": "金融海啸 · 自民党野党陷落",
    "trendBadgeJa": "リーマンショック・定額給付金・下野",
    "trendBadgeEn": "Lehman Shock · Historic Defeat",
    "originZh": "福冈县饭冢市 · 学习院大学政经学部 · 吉田茂外孙 · 蒙特利尔奥运飞碟射击国手",
    "originJa": "福岡県飯塚市出身・学習院大学政経学部",
    "originEn": "Fukuoka Pref. · Gakushuin University",
    "bioZh": "日本前首相吉田茂的外孙，酷爱漫画且心直口快。刚就任便迎头撞上雷曼兄弟倒闭引发的百年一遇全球金融危机。尽管全力出台了超大规模的经济刺激对策，但因口误读错汉字风波与自民党内部内讧，最终在 2009 年众院大选彻底失去半个世纪的政权。",
    "bioJa": "名門政治家一族出身で吉田茂元首相の孫。就任直後にリーマン・ショックが直撃し、4次にわたる総額75兆円規模の経済対策と全世帯への定額給付金を断行。しかし漢字誤読や自民党内の足の引っ張り合いで求心力を失い、歴史的下野を迎えた。",
    "bioEn": "Grandson of Shigeru Yoshida. Hit by the Lehman Brothers collapse weeks after taking office, he rolled out massive stimulus packages and nationwide cash handouts, but was undermined by gaffes and party infighting, culminating in the LDP's catastrophic 2009 election loss.",
    "policiesZh": [
      {
        "title": "雷曼危机应对与定额给付金",
        "desc": "先后出台四波总规模达 75 万亿日元的巨额经济刺激方案，向全国全体国民发放每人 1.2 万日元（老人儿童 2 万日元）的定额给付金。"
      },
      {
        "title": "扩大 IMF 紧急融资",
        "desc": "在华盛顿首届 G20 金融峰会上承诺向国际货币基金组织（IMF）出资高达 1000 亿美元外汇储备，稳定全球外汇金融体系。"
      },
      {
        "title": "推动动漫文化外交",
        "desc": "积极提倡“动漫外交”与流行文化外宣（Cool Japan 构想），规划设立国立媒体艺术综合中心。"
      }
    ],
    "crisisZh": "2009年8月30日第45届众议院大选，民主党赢得308席历史性大胜，自民党仅获119席惨败，自1955年自民党建党以来首度真正丢掉第一大党执政权。",
    "policiesJa": [
      {
        "title": "リーマン対策と給付金",
        "desc": "総額75兆円規模の経済対策を4次にわたって打ち出し、全国民に1人1万2,000円（高齢者・子どもは2万円）の定額給付金を支給した。"
      },
      {
        "title": "IMFへの緊急融資拡大",
        "desc": "ワシントンでの初回G20金融サミットで、国際通貨基金（IMF）に最大1,000億ドルの外貨準備を拠出すると表明し、世界の為替・金融システムの安定を図った。"
      },
      {
        "title": "アニメ文化外交の推進",
        "desc": "「アニメ外交」やポップカルチャーの対外発信（クールジャパン構想）を積極的に提唱し、国立メディア芸術総合センターの設置を構想した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Lehman Stimulus and Handouts",
        "desc": "Rolled out four stimulus packages totaling 75 trillion yen and distributed 12,000-yen cash handouts to every citizen (20,000 yen for the elderly and children)."
      },
      {
        "title": "Expanded IMF Lending",
        "desc": "At the first G20 financial summit in Washington, he pledged up to 100 billion dollars of foreign reserves to the International Monetary Fund to stabilize the global financial and currency system."
      },
      {
        "title": "Anime Cultural Diplomacy",
        "desc": "Actively promoted 'anime diplomacy' and pop-culture outreach (the Cool Japan concept) and planned a national center for media arts."
      }
    ],
    "crisisJa": "2009年8月30日の第45回衆議院選挙で、民主党が308議席を獲得して歴史的勝利を収め、自民党は119議席にとどまった。1955年の結党以来、初めて第一党の座と政権を本格的に失った。",
    "crisisEn": "In the 45th general election on August 30, 2009, the DPJ won a historic landslide with 308 seats while the LDP was reduced to 119, marking the first time since the party's founding in 1955 that it genuinely lost both its leading-party status and control of government."
  },
  "hatoyama": {
    "id": "hatoyama",
    "nameZh": "鸠山由纪夫",
    "nameJa": "鳩山由紀夫",
    "nameEn": "Yukio Hatoyama",
    "eraNumberZh": "第93任内阁总理大臣",
    "eraNumberJa": "第93代内閣総理大臣",
    "eraNumberEn": "93rd Prime Minister of Japan",
    "partyZh": "民主党",
    "partyJa": "民主党",
    "partyEn": "Democratic Party of Japan (DPJ)",
    "period": "2009-09-16 — 2010-06-08",
    "months": 9,
    "days": 266,
    "trendBadgeZh": "政权轮替 · 普天间辞职",
    "trendBadgeJa": "歴史的政権交代・友愛・普天間混迷",
    "trendBadgeEn": "Historic Power Shift · Futenma Crisis",
    "originZh": "东京都 · 东京大学工学部 · 斯坦福大学工学博士 · 鸠山四代政治名门",
    "originJa": "東京都出身・東京大学工学部・スタンフォード大Ph.D.",
    "originEn": "Tokyo · University of Tokyo · Stanford Ph.D.",
    "bioZh": "民主党创始人之一，以“友爱”理念与“国民生活第一”的竞选纲领，终结自民党半世纪独大，以 72.0% 的极高民调华丽组阁。但其宣称美军普天间基地“至少移至冲绳县外”的承诺在日美交涉中彻底碰壁，引发外交与执政联盟全面瓦解。",
    "bioJa": "「友愛」と「生活が第一」を掲げ、戦後初となる本格的な政権交代を成し遂げ72%の高支持率で船出。「子ども手当」や「事業仕分け」を進めたが、普天間基地移設の「最低でも県外」発言が迷走して日米関係を悪化させ、わずか8ヶ月余りで辞任した。",
    "bioEn": "Spearheaded the DPJ's historic 2009 electoral triumph with 72% initial support under the banner of 'Fraternity' and 'People's Lives First'. His unrealistic pledge to move the US Futenma air base out of Okinawa collapsed in diplomatic gridlock, forcing his resignation after eight months.",
    "policiesZh": [
      {
        "title": "推行儿童津贴与学费全免",
        "desc": "贯彻“从水泥到人”的政策转向，向全国家庭发放每月儿童津贴，全面免除公立高中学费，重塑家庭福利政策。"
      },
      {
        "title": "行政刷新会议“事业甄别”",
        "desc": "在公众和媒体众目睽睽之下对各省厅预算进行公开质询与审查削减，创造莲舫“做世界第二难道不行吗”的名场面。"
      },
      {
        "title": "倡导“东亚共同体”",
        "desc": "提出构建紧密的东亚共同体构想，承诺日本到2020年温室气体排放比1990年削减25%的雄心目标。"
      }
    ],
    "crisisZh": "普天间基地迁移案被迫回归美日原案引发冲绳民众抗议，社民党党首福岛瑞穗被罢免导致执政联盟破裂，加之个人母亲伪造政治献金丑闻，于2010年6月与小泽一郎双双辞职。",
    "policiesJa": [
      {
        "title": "子ども手当と高校無償化",
        "desc": "「コンクリートから人へ」の政策転換を掲げ、全国の世帯に月額の子ども手当を支給し、公立高校の授業料を全面無償化して家族政策を再構築した。"
      },
      {
        "title": "事業仕分けの実施",
        "desc": "行政刷新会議のもと、各省庁の予算を国民とメディアの面前で公開審査し削減した。蓮舫氏の「2位じゃダメなんでしょうか」が名場面となった。"
      },
      {
        "title": "東アジア共同体の提唱",
        "desc": "緊密な東アジア共同体の構想を掲げ、2020年までに温室効果ガスを1990年比25%削減する目標を表明した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Child Allowance and Free Tuition",
        "desc": "Pursuing a shift 'from concrete to people', his government paid monthly child allowances to households nationwide and made public high school tuition free, reshaping family welfare policy."
      },
      {
        "title": "Budget Screening",
        "desc": "Opened ministry budgets to public questioning and cuts in front of citizens and the media, producing the memorable exchange in which Renho asked whether being second in the world was not good enough."
      },
      {
        "title": "East Asian Community",
        "desc": "Proposed building a close East Asian community and pledged to cut Japan's greenhouse gas emissions 25% below 1990 levels by 2020."
      }
    ],
    "crisisJa": "普天間基地移設問題が日米原案への回帰を余儀なくされて沖縄県民の抗議を招き、社民党の福島瑞穂党首の罷免で連立政権が崩壊した。さらに母の政治資金偽装問題も重なり、2010年6月に小沢一郎とともに辞任した。",
    "crisisEn": "The Futenma base relocation was forced back to the original US-Japan plan, triggering protests in Okinawa, while the dismissal of Social Democratic Party leader Mizuho Fukushima broke the ruling coalition. Coupled with the scandal over his mother's falsified political funding, he resigned together with Ichiro Ozawa in June 2010."
  },
  "kan": {
    "id": "kan",
    "nameZh": "菅直人",
    "nameJa": "菅直人",
    "nameEn": "Naoto Kan",
    "eraNumberZh": "第94任内阁总理大臣",
    "eraNumberJa": "第94代内閣総理大臣",
    "eraNumberEn": "94th Prime Minister of Japan",
    "partyZh": "民主党",
    "partyJa": "民主党",
    "partyEn": "Democratic Party of Japan (DPJ)",
    "period": "2010-06-08 — 2011-09-02",
    "months": 15,
    "days": 452,
    "trendBadgeZh": "311东日本大震灾 · 去核电",
    "trendBadgeJa": "東日本大震災・福島原発・脱原発",
    "trendBadgeEn": "3.11 Triple Disaster · FIT Law",
    "originZh": "山口县宇部市 · 东京工业大学理学部 · 专利代理人 · 市民运动领袖出身",
    "originJa": "山口県宇部市出身・東京工業大学理学部",
    "originEn": "Yamaguchi Pref. · Tokyo Institute of Technology",
    "bioZh": "从草根市民运动家奋斗至国家宰相的传奇人物。执政第9个月突然遭遇 2011 年 3 月 11 日东日本大地震、海啸与福岛第一核电站特大事故的三重复合灾难，亲临第一线危机指挥，并在战后首次发布核能紧急事态宣言。",
    "bioJa": "市民運動家から首相へ上り詰めた異色のリーダー。2011年3月11日の東日本大震災および福島第一原発事故という未曾有の国難に直面。官邸主導の危機対応にあたり、事故後は再生可能エネルギー固定価格買取制度（FIT法）の成立に政治生命を賭けた。",
    "bioEn": "A former patent attorney and grassroots civic activist who rose to the premiership. He faced Japan's darkest post-war moment: the catastrophic March 11, 2011 Tohoku earthquake, tsunami, and Fukushima nuclear meltdowns. He staked his tenure on passing renewable energy legislation.",
    "policiesZh": [
      {
        "title": "311震灾应对与原子力灾害对策",
        "desc": "设立紧急灾害对策总部，出动10万自卫队员抗震救灾；果断成立福岛第一核电站事故统括官邸应急小组。"
      },
      {
        "title": "通过《再生能源特别措施法》",
        "desc": "在辞任前排除党内和电力巨头巨大阻力，强行推动通过可再生能源固定价格收购制度（FIT制度），彻底引爆日本光伏产业大爆发。"
      },
      {
        "title": "主张加入 TPP 谈判",
        "desc": "首次在亚太经合组织提出日本参与跨太平洋战略经济伙伴关系协定（TPP）谈判的构想。"
      }
    ],
    "crisisZh": "核电站事故初期的指挥沟通备受自民党与舆论指责，在野党提出不信任案后，菅直人承诺以公债发行特例法案与再生能源法案通过为辞职条件，于2011年8月底辞职。",
    "policiesJa": [
      {
        "title": "3.11震災と原発対応",
        "desc": "緊急災害対策本部を設置し、自衛隊10万人を動員して震災救援にあたった。福島第一原発事故では官邸に統括する緊急対応チームを速やかに立ち上げた。"
      },
      {
        "title": "再生エネ特措法の成立",
        "desc": "辞任前に党内や電力大手の強い抵抗を押し切り、再生可能エネルギーの固定価格買取制度（FIT制度）を成立させ、日本の太陽光産業の急拡大を引き起こした。"
      },
      {
        "title": "TPP交渉参加の提唱",
        "desc": "APECの場で初めて、日本が環太平洋パートナーシップ協定（TPP）交渉に参加する構想を打ち出した。"
      }
    ],
    "policiesEn": [
      {
        "title": "3.11 Disaster Response",
        "desc": "Set up an emergency disaster response headquarters and deployed 100,000 Self-Defense Force personnel for relief, and promptly formed a prime minister's office team to coordinate the Fukushima Daiichi nuclear accident."
      },
      {
        "title": "Feed-in Tariff Law",
        "desc": "Before stepping down, he overcame resistance from within his party and from major utilities to pass the feed-in tariff system for renewable energy, setting off a boom in Japan's solar industry."
      },
      {
        "title": "TPP Negotiations",
        "desc": "At APEC he proposed for the first time that Japan join negotiations for the Trans-Pacific Partnership."
      }
    ],
    "crisisJa": "原発事故初期の指揮と意思疎通は自民党と世論の批判を浴び、野党が不信任案を提出した。菅直人は公債発行特例法案と再生可能エネルギー法案の成立を辞任条件とし、2011年8月末に辞任した。",
    "crisisEn": "His command and communication in the early phase of the nuclear accident drew heavy criticism from the LDP and the public, and the opposition filed a no-confidence motion. Kan made passage of the special deficit-financing bond bill and the renewable energy bill conditions for his resignation, and stepped down at the end of August 2011."
  },
  "noda": {
    "id": "noda",
    "nameZh": "野田佳彦",
    "nameJa": "野田佳彦",
    "nameEn": "Yoshihiko Noda",
    "eraNumberZh": "第95任内阁总理大臣",
    "eraNumberJa": "第95代内閣総理大臣",
    "eraNumberEn": "95th Prime Minister of Japan",
    "partyZh": "民主党",
    "partyJa": "民主党",
    "partyEn": "Democratic Party of Japan (DPJ)",
    "period": "2011-09-02 — 2012-12-26",
    "months": 16,
    "days": 482,
    "trendBadgeZh": "三党合意 · 决断解散",
    "trendBadgeJa": "社会保障・税一体改革・党首討論解散",
    "trendBadgeEn": "Tax Reform · Dramatic Dissolution",
    "originZh": "千叶县船桥市 · 早稻田大学政治经济学部 · 松下政经塾第一期生",
    "originJa": "千葉県船橋市出身・早稲田大学政治経済学部",
    "originEn": "Chiba Pref. · Waseda University",
    "bioZh": "松下政经塾首位首相，以相貌朴实自谦为“泥鳅首相”。为人刚毅沉稳，深知国家财政危如累卵，宁肯民主党内部大分裂，也要联手自民党公明党达成“三党合意”通过消费税增税法案；最终在党首辩论中当场决断解散众议院。",
    "bioJa": "松下政経塾出身者として初の首相。「ドジョウ宰相」を自認し実直な政治を貫く。民主党分裂の危機を冒して自民・公明との「三党合意」を結び、消費税率10%引き上げを可決。国会党首討論で安倍晋三氏に突如解散を宣言し、自公へ政権を明け渡した。",
    "bioEn": "First prime minister educated at the Matsushita Institute of Government and Management. Styling himself as a humble 'loach fish', he sacrificed party unity to pass a consumption tax hike with LDP-Komeito support. In a dramatic live Diet debate, he challenged Shinzo Abe and dissolved parliament.",
    "policiesZh": [
      {
        "title": "社会保障与税制一体化改革",
        "desc": "跨越朝野党派分歧，与自民党总裁谷垣祯一、公明党达成历史性三党协议，确立消费税分两阶段上调至10%以充实社会保障金。"
      },
      {
        "title": "正式推动灾后复兴厅成立",
        "desc": "设立统辖东日本大地震灾后重建的内阁复兴厅，投入25万亿日元实施为期10年的集中复兴重构项目。"
      },
      {
        "title": "推进钓鱼岛国有化",
        "desc": "为防止东京都知事石原慎太郎民间购岛激化矛盾，采取由国家直接出资买断国有化方针，导致中日关系陷入严峻冰点。"
      }
    ],
    "crisisZh": "消费税法案导致小泽一郎带数十名议员脱党出走；2012年11月14日在与安倍晋三党首辩论中当场提出解散众院，12月大选民主党仅剩57席惨败，政权彻底终结。",
    "policiesJa": [
      {
        "title": "社会保障と税の一体改革",
        "desc": "与野党の隔たりを越え、自民党総裁谷垣禎一、公明党と歴史的な三党合意を結び、消費税率を2段階で10%に引き上げて社会保障の財源を確保した。"
      },
      {
        "title": "復興庁の設置",
        "desc": "東日本大震災からの復興を統括する内閣復興庁を設置し、25兆円を投じ10年間の集中復興期間を定めた。"
      },
      {
        "title": "尖閣諸島の国有化",
        "desc": "東京都知事石原慎太郎の民間による購入で対立が激化するのを防ぐため、国が直接買い取る国有化の方針を採り、日中関係は厳しい冷え込みに陥った。"
      }
    ],
    "policiesEn": [
      {
        "title": "Tax and Social Security Reform",
        "desc": "Bridging ruling and opposition lines, he reached a historic three-party agreement with LDP leader Sadakazu Tanigaki and Komeito to raise the consumption tax to 10% in two stages and secure social security funding."
      },
      {
        "title": "Reconstruction Agency",
        "desc": "Established the Reconstruction Agency under the cabinet to oversee recovery from the Great East Japan Earthquake and committed 25 trillion yen to a ten-year intensive reconstruction program."
      },
      {
        "title": "Senkaku Nationalization",
        "desc": "To prevent Tokyo Governor Shintaro Ishihara's private purchase plan from inflaming tensions, he chose a state buyout and nationalization, plunging Japan-China relations into a severe chill."
      }
    ],
    "crisisJa": "消費税法案により小沢一郎が数十名の議員を率いて離党した。2012年11月14日、安倍晋三との党首討論でその場で衆議院解散を表明し、12月の総選挙で民主党は57議席まで落ち込んで惨敗、政権は完全に終焉した。",
    "crisisEn": "The consumption tax bill drove Ichiro Ozawa to leave the party with dozens of lawmakers. In a party-leader debate with Shinzo Abe on November 14, 2012, Noda called a snap election on the spot; the DPJ was crushed down to 57 seats in December, ending its hold on power."
  },
  "abe2": {
    "id": "abe2",
    "nameZh": "安倍晋三 (第二次)",
    "nameJa": "安倍晋三(2次)",
    "nameEn": "Shinzo Abe (2nd–4th)",
    "eraNumberZh": "第96·97·98任内阁总理大臣",
    "eraNumberJa": "第96〜98代内閣総理大臣",
    "eraNumberEn": "96th–98th Prime Minister of Japan",
    "partyZh": "自由民主党（清和政策研究会）",
    "partyJa": "自由民主党（清和政策研究会）",
    "partyEn": "Liberal Democratic Party (Seiwa Kenkyukai)",
    "period": "2012-12-26 — 2020-09-16",
    "months": 93,
    "days": 2822,
    "trendBadgeZh": "宪政史上最长 · 安倍经济学",
    "trendBadgeJa": "憲政史上最長2822日・アベノミクス",
    "trendBadgeEn": "Record 2822 Days · Abenomics",
    "originZh": "东京都（山口县第4区）· 成蹊大学法学部 · 通算在任3188天战后第一",
    "originJa": "東京都出身・成蹊大学法学部",
    "originEn": "Tokyo · Seikei University",
    "bioZh": "日本宪政史上连续在任时间最长（2,822天）、通算在位时间最长（3,188天）的首相。推行“安倍经济学”三支箭打破通缩魔咒，连续赢下 6 次全国大选打造“安倍独大”政局；通过和平安全法制解禁集体自卫权，提出“印太构想”深刻重塑全球地缘格局。",
    "bioJa": "通算在職3,188日、連続在職2,822日で憲政史上最長記録を樹立。「三本の矢」からなるアベノミクスで株高と雇用改善を達成。国政選挙で6連勝して強固な政治基盤を誇り、集団的自衛権の行使容認や「自由で開かれたインド太平洋（FOIP）」を提唱した。",
    "bioEn": "Japan's longest-serving prime minister in constitutional history (3,188 total days, 2,822 consecutive). His signature 'Abenomics' revitalized stock markets and employment, while security legislation and the 'Free and Open Indo-Pacific' strategy redefined global diplomacy.",
    "policiesZh": [
      {
        "title": "“安倍经济学”三支箭",
        "desc": "黑田东彦央行推行超宽松量化质化货币宽松（异次元金融缓和）、机动财政扩张及规制缓和成长战略，日经指数从8000点飙升至23000点。"
      },
      {
        "title": "成立国家安全保障会议 (NSC)",
        "desc": "打破省厅藩篱设立统辖外交国防的日本版 NSC，主导通过《和平安全法制》，自战后首次有限解禁集体自卫权。"
      },
      {
        "title": "签署 CPTPP 与引领 FOIP",
        "desc": "在美国退出 TPP 后毅然主导完成 11 国 CPTPP 协议生效，签署日欧 EPA，确立自由开放印太愿景。"
      }
    ],
    "crisisZh": "遭遇森友学园、加计学园及“赏樱会”公金私用丑闻反复审查；2020年新冠疫情应对受挫，叠加溃疡性大肠炎旧疾复发，于2020年8月28日正式辞职。（注：2022年7月8日在奈良街头演说时遭枪击不幸遇刺身亡）。",
    "policiesJa": [
      {
        "title": "アベノミクスの三本の矢",
        "desc": "黒田東彦の日銀による異次元の量的・質的金融緩和、機動的な財政出動、規制緩和の成長戦略を進め、日経平均は8,000円台から23,000円台へと急騰した。"
      },
      {
        "title": "国家安全保障会議の設置",
        "desc": "省庁の縦割りを打破し、外交・防衛を統括する日本版NSCを設けた。平和安全法制の成立を主導し、戦後初めて集団的自衛権の限定的な行使を可能にした。"
      },
      {
        "title": "CPTPPとFOIPの推進",
        "desc": "米国離脱後に11か国でのCPTPP発効を主導し、日EU・EPAに署名。「自由で開かれたインド太平洋」のビジョンを掲げた。"
      }
    ],
    "policiesEn": [
      {
        "title": "Three Arrows of Abenomics",
        "desc": "With Bank of Japan Governor Haruhiko Kuroda he launched massive quantitative and qualitative easing, flexible fiscal spending and a deregulation growth strategy, driving the Nikkei from about 8,000 to 23,000."
      },
      {
        "title": "National Security Council",
        "desc": "Cutting across ministerial silos, he established a Japanese-style NSC to coordinate diplomacy and defense, and led passage of the peace and security legislation that allowed the limited exercise of collective self-defense for the first time since the war."
      },
      {
        "title": "CPTPP and FOIP",
        "desc": "After the US withdrawal from the TPP he led the 11-nation CPTPP into force, signed the Japan-EU EPA, and set out the Free and Open Indo-Pacific vision."
      }
    ],
    "crisisJa": "森友学園・加計学園問題や「桜を見る会」の公私混同疑惑が繰り返し追及された。2020年の新型コロナ対応で失速し、潰瘍性大腸炎の再発も重なり、2020年8月28日に正式に辞任した。（注：2022年7月8日、奈良市の街頭演説中に銃撃を受け死去）",
    "crisisEn": "He faced repeated scrutiny over the Moritomo Gakuen and Kake Gakuen affairs and the alleged misuse of public funds for the cherry-blossom viewing party. With his COVID-19 response faltering and ulcerative colitis returning, he formally resigned on August 28, 2020. (Note: he was assassinated by gunfire during a street speech in Nara on July 8, 2022.)"
  },
  "suga": {
    "id": "suga",
    "nameZh": "菅义伟",
    "nameJa": "菅義偉",
    "nameEn": "Yoshihide Suga",
    "eraNumberZh": "第99任内阁总理大臣",
    "eraNumberJa": "第99代内閣総理大臣",
    "eraNumberEn": "99th Prime Minister of Japan",
    "partyZh": "自由民主党（无派阀）",
    "partyJa": "自由民主党（無派閥）",
    "partyEn": "Liberal Democratic Party (Independent)",
    "period": "2020-09-16 — 2021-10-04",
    "months": 13,
    "days": 384,
    "trendBadgeZh": "手机降价 · 举办东京奥运",
    "trendBadgeJa": "デジタル庁・携帯値下げ・五輪開催",
    "trendBadgeEn": "Digital Agency · Tokyo 2020",
    "originZh": "秋田县雄胜町 · 法政大学第二法学部 · 长期担任内阁官房长官（任期战后最长）",
    "originJa": "秋田県湯沢市出身・法政大学法学部",
    "originEn": "Akita Pref. · Hosei University",
    "bioZh": "秋田县草莓农家之子，无世家背景白手起家。长年担任安倍内阁不可或缺的“大管家”官房长官。上任后展现雷厉风行的务实行政效率，强推手机话费暴降七成并设立数字厅。顶住疫情空前重压成功举办 2020 东京夏季奥运会与残奥会。",
    "bioJa": "秋田の農家出身の「叩き上げ」リーダー。官房長官として安倍政権を黒子で支え続け就任。携帯電話料金の大幅引き下げ、デジタル庁の新設、不妊治療の保険適用など生活密着の改革を次々と実現。コロナ禍の猛威の中、東京2020五輪・パラリンピックを完遂した。",
    "bioEn": "A self-made politician from a strawberry farming family in Akita. As Abe's long-serving Chief Cabinet Secretary, he slashed cell phone bills by up to 70%, launched the Digital Agency, expanded fertility treatment insurance coverage, and successfully delivered the Tokyo 2020 Olympics amid COVID.",
    "policiesZh": [
      {
        "title": "创设数字厅 (Digital Agency)",
        "desc": "克服省厅数字化条块分割恶习，仅用一年时间火速组建国家数字厅，统筹国家系统公共云与个人番号卡（My Number Card）普及。"
      },
      {
        "title": "手机资费强制下调",
        "desc": "打破三大电信运营商价格同盟，迫使各大电信巨头推出每月 20GB/2980 日元廉价方案，惠及全国千家万户。"
      },
      {
        "title": "2050 碳中和国家宣言",
        "desc": "在国会施政演说中正式向全世界宣布日本将于 2050 年实现温室气体净零排放目标，制定绿色成长战略。"
      }
    ],
    "crisisZh": "疫情反复导致医疗资源紧张，支持率随疫苗接种初期的混乱下滑；2021年9月在面临自民党总裁换届前夕，出人意料宣布专注防疫不谋求连任，执政一年功成退居二线。",
    "policiesJa": [
      {
        "title": "デジタル庁の創設",
        "desc": "省庁のデジタル化における縦割りを打破し、わずか1年でデジタル庁を発足させた。政府システムのクラウド化とマイナンバーカードの普及を統括した。"
      },
      {
        "title": "携帯料金の引き下げ",
        "desc": "大手3社の価格同盟を崩し、各社に月額20GB／2,980円の低価格プランを出させて、全国の家計の負担を軽くした。"
      },
      {
        "title": "2050年脱炭素宣言",
        "desc": "国会の所信表明演説で、2050年に温室効果ガスを実質ゼロにする目標を世界に向けて正式に宣言し、グリーン成長戦略を策定した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Digital Agency",
        "desc": "Breaking the compartmentalized approach to government digitization, he stood up the Digital Agency in just one year to coordinate cloud migration of national systems and wider use of the My Number Card."
      },
      {
        "title": "Mobile Rate Cuts",
        "desc": "Broke the price alignment among the three major carriers and pushed them to offer 20GB plans at 2,980 yen a month, easing household costs nationwide."
      },
      {
        "title": "2050 Carbon Neutrality",
        "desc": "In his Diet policy speech he formally declared to the world that Japan would achieve net-zero greenhouse gas emissions by 2050 and drew up a green growth strategy."
      }
    ],
    "crisisJa": "感染拡大の波で医療体制が逼迫し、ワクチン接種初期の混乱で支持率が低下した。2021年9月、自民党総裁選を前に、防疫に専念するとして異例の不出馬を表明し、1年の任期で退いた。",
    "crisisEn": "Repeated pandemic waves strained medical capacity and his support fell amid the chaotic early vaccination rollout. In September 2021, on the eve of the LDP leadership race, he unexpectedly announced he would not run in order to focus on pandemic response, leaving after one year in office."
  },
  "kishida": {
    "id": "kishida",
    "nameZh": "岸田文雄",
    "nameJa": "岸田文雄",
    "nameEn": "Fumio Kishida",
    "eraNumberZh": "第100·101任内阁总理大臣",
    "eraNumberJa": "第100・101代内閣総理大臣",
    "eraNumberEn": "100th–101st Prime Minister of Japan",
    "partyZh": "自由民主党（宏池会 / 岸田派）",
    "partyJa": "自由民主党（宏池会・岸田派）",
    "partyEn": "Liberal Democratic Party (Kōchikai)",
    "period": "2021-10-04 — 2024-10-01",
    "months": 36,
    "days": 1094,
    "trendBadgeZh": "新资本主义 · 防卫费翻倍",
    "trendBadgeJa": "新しい資本主義・防衛費増額・G7広島",
    "trendBadgeEn": "New Capitalism · Defense Boost",
    "originZh": "东京都（广岛县第1区）· 早稻田大学法学部 · 外务大臣长年连续任期战后第二",
    "originJa": "東京都出身・早稲田大学法学部",
    "originEn": "Tokyo · Waseda University",
    "bioZh": "自民党名门宏池会领袖，外表温文尔雅但作风果断。提出“新资本主义”以期实现分配与增长双循环；在俄乌战争与地缘危机下，历史性决定将防卫预算翻倍增至 GDP 2% 并保有对敌基地反击能力；主场圆满承办广岛 G7 首脑峰会。",
    "bioJa": "名門・宏池会会長。穏健な「聞く力」を掲げつつ、防衛費GDP比2%への増額や反撃能力の保有、原発再稼働への大転換など歴代政権が避けてきた重要課題で決断を下した。G7広島サミットを成功させ、ウクライナのゼレンスキー大統領来日を実現させた。",
    "bioEn": "Leader of the dovish Kochikai faction who governed with surprising decisiveness. Enacted a historic doubling of Japan's defense budget to 2% of GDP, welcomed Volodymyr Zelenskyy to the Hiroshima G7 Summit, and spearheaded domestic wage-growth and green nuclear policy transitions.",
    "policiesZh": [
      {
        "title": "防卫力量历史性根本强化",
        "desc": "修订国家安保战略等安保三文件，将防卫预算大幅提高至 GDP 2%，拥有远程打击能力的对敌基地反击能力。"
      },
      {
        "title": "主办 G7 广岛峰会与改善日韩关系",
        "desc": "在被爆地广岛成功凝聚七国首脑发布无核愿景，乌克兰总统泽连斯基亲临；与韩国总统尹锡悦重启穿梭外交恢复军情协定。"
      },
      {
        "title": "推行新 NISA 与结构性大幅加薪",
        "desc": "全面扩容个人免税投资账户（新 NISA）促进“储蓄向投资”转化；春斗实现 30 余年来最大幅度工资增长（超5%）。"
      }
    ],
    "crisisZh": "自民党派阀政治资金“黑金”宴会丑闻全面暴发，民调长期跌至20%危险水域，岸田毅然带头解散自民党宏池会并处分多名骨干，2024年8月宣布不参选自民党总裁，主动承担政治责任让位。",
    "policiesJa": [
      {
        "title": "防衛力の抜本的強化",
        "desc": "国家安全保障戦略など安保3文書を改定し、防衛予算をGDP比2%へ大幅に増額した。遠距離攻撃が可能な反撃能力の保有も決めた。"
      },
      {
        "title": "G7広島と日韓関係改善",
        "desc": "被爆地広島でG7首脳とともに核兵器のない世界に向けたビジョンを打ち出し、ゼレンスキー大統領が来日した。韓国の尹錫悦大統領とのシャトル外交を再開し、軍事情報協定を回復した。"
      },
      {
        "title": "新NISAと賃上げの推進",
        "desc": "少額投資非課税制度（新NISA）を大幅に拡充して「貯蓄から投資へ」を促し、春闘では30年余りで最大となる5%超の賃上げを実現した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Historic Defense Buildup",
        "desc": "Revised the three national security documents, including the National Security Strategy, to raise defense spending to 2% of GDP, and decided to acquire counterstrike capabilities with long-range strike potential."
      },
      {
        "title": "Hiroshima G7 and Seoul Thaw",
        "desc": "At the G7 summit in bombed Hiroshima he rallied leaders around a vision of a world without nuclear weapons, with President Zelenskyy attending in person, and restarted shuttle diplomacy with South Korean President Yoon Suk Yeol, restoring the military intelligence pact."
      },
      {
        "title": "New NISA and Wage Growth",
        "desc": "Expanded the tax-free individual investment account (new NISA) to shift savings into investment, while annual spring wage talks delivered the largest pay increase in more than 30 years, above 5%."
      }
    ],
    "crisisJa": "自民党派閥の政治資金をめぐる「裏金」パーティー問題が全面化し、内閣支持率は長く20%台の危険水域に沈んだ。岸田は自ら宏池会の解散を主導して幹部らを処分し、2024年8月に総裁選不出馬を表明、政治責任を取って退陣した。",
    "crisisEn": "The LDP factions' unreported political-fund 'slush fund' party scandal erupted and his approval ratings lingered in the dangerous 20% range. Kishida took the lead in dissolving his own Kochikai faction and disciplined senior members, then announced in August 2024 that he would not run in the leadership race, stepping down to take political responsibility."
  },
  "ishiba": {
    "id": "ishiba",
    "nameZh": "石破茂",
    "nameJa": "石破茂",
    "nameEn": "Shigeru Ishiba",
    "eraNumberZh": "第102任内阁总理大臣",
    "eraNumberJa": "第102代内閣総理大臣",
    "eraNumberEn": "102nd Prime Minister of Japan",
    "partyZh": "自由民主党（水月会 / 石破派）",
    "partyJa": "自由民主党（水月会・石破派）",
    "partyEn": "Liberal Democratic Party (Suigetsukai)",
    "period": "2024-10-02 — 2025-10-21",
    "months": 13,
    "days": 384,
    "trendBadgeZh": "地方创生 · 少数派执政",
    "trendBadgeJa": "地方創生・防災庁構想・少数与党運営",
    "trendBadgeEn": "Regional Revitalization · Minority Govt",
    "originZh": "鸟取县八头郡八头町 · 庆应义塾大学法学部 · 防卫相·农水相·地方创生相",
    "originJa": "鳥取県八頭町出身・慶應義塾大学法学部",
    "originEn": "Tottori Pref. · Keio University",
    "bioZh": "自民党内著名的军武与防卫通、铁道迷，五度挑战自民党总裁大位终获登顶。就任后火速解散众议院，面对执政联盟未过半的少见政局，展现出极强的韧性与跨党派谈判耐心，推进地方振兴与防灾体制改革。",
    "bioJa": "防衛・農政の政策通で、5回目の挑戦で自民党総裁に就任。就任直後の衆院選で与党過半数割れの逆風に直面するも、野党各党との丁寧な政策協議による少数与党運営を展開。「防災庁」創設や地方経済再生に注力した。",
    "bioEn": "Noted security specialist and policy heavyweight who won the LDP leadership on his fifth attempt. Faced with a hung parliament after snap elections, he demonstrated seasoned pragmatism navigating minority government coalition compromises.",
    "policiesZh": [
      {
        "title": "创设专门“防灾厅”",
        "desc": "针对能登半岛地震等重大自然灾害教训，力推整合跨省厅应急响应体制，加快设立独立的防灾厅组织法案审议。"
      },
      {
        "title": "地方创生 2.0 战略",
        "desc": "将地方振兴交付金规模倍增，重点支持农林水产业、地方中小型制造业与数字游民下沉地方。"
      },
      {
        "title": "推进安全保障法制细化",
        "desc": "审慎研究日美地位协定修订，强化日本本土及西南诸岛自卫队防卫设施与军工产能基础。"
      }
    ],
    "crisisZh": "国会执政党席位未过半，面临在野党提出的国民所得门槛调整及预算博弈，政权运作如履薄冰，2025年自民党迎来新一轮激荡重组。",
    "policiesJa": [
      {
        "title": "防災庁の創設",
        "desc": "能登半島地震など大規模災害の教訓を踏まえ、省庁横断の災害対応体制の統合を進め、独立した防災庁を設置する法案の審議を急いだ。"
      },
      {
        "title": "地方創生2.0戦略",
        "desc": "地方創生交付金を倍増し、農林水産業、地域の中小製造業、地方へ移住するデジタルノマドへの支援に重点を置いた。"
      },
      {
        "title": "安全保障法制の細部整備",
        "desc": "日米地位協定の改定を慎重に検討し、本土および南西諸島における自衛隊の防衛施設と防衛産業の生産基盤を強化した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Disaster Management Agency",
        "desc": "Drawing lessons from the Noto Peninsula earthquake and other major disasters, he pushed to integrate cross-ministerial emergency response and expedited deliberation of a bill to create a stand-alone disaster management agency."
      },
      {
        "title": "Regional Revitalization 2.0",
        "desc": "Doubled the regional revitalization grants, focusing support on agriculture, forestry and fisheries, local small manufacturers, and digital nomads relocating to the regions."
      },
      {
        "title": "Security Legislation Refinement",
        "desc": "He carefully examined revisions to the US-Japan Status of Forces Agreement and strengthened SDF defense facilities and the defense industrial base on the mainland and the Nansei Islands."
      }
    ],
    "crisisJa": "国会で与党が過半数を割り込み、野党が求める国民所得の壁の見直しや予算をめぐる攻防に直面した。政権運営は薄氷を踏む思いであり、2025年に自民党は新たな激動の再編を迎えた。",
    "crisisEn": "With the ruling party short of a Diet majority, he faced opposition demands to adjust the income threshold and battled over the budget. Governing on thin ice, he saw the LDP enter a new round of turbulent realignment in 2025."
  },
  "takaichi": {
    "id": "takaichi",
    "nameZh": "高市早苗",
    "nameJa": "高市早苗",
    "nameEn": "Sanae Takaichi",
    "eraNumberZh": "第103任内阁总理大臣",
    "eraNumberJa": "第103代内閣総理大臣",
    "eraNumberEn": "103rd Prime Minister of Japan",
    "partyZh": "自由民主党（保守派）",
    "partyJa": "自由民主党（保守派）",
    "partyEn": "Liberal Democratic Party (Conservative)",
    "period": "2025-10-21 — 2030-12-31",
    "months": 12,
    "days": 365,
    "trendBadgeZh": "首位女首相 · 危机管理投资",
    "trendBadgeJa": "憲政史上初の女性首相・危機管理投資",
    "trendBadgeEn": "First Female PM · Economic Security",
    "originZh": "奈良县奈良市 · 神户大学经营学部 · 松下政经塾五期生",
    "originJa": "奈良県奈良市出身・神戸大学経営学部",
    "originEn": "Nara Pref. · Kobe University",
    "bioZh": "日本宪政史上首位女性内阁总理大臣，继承保守派正统精神。主张“危机管理投资”，将国家防务、粮食安全、前沿尖端科技与防灾基础设施视为驱动经济增长的综合国力发动机，推行强硬的经济安保法规。",
    "bioJa": "日本憲政史上初の女性内閣総理大臣。強固な国家観と明晰な安全保障論を持ち、サプライチェーン強靭化や先端AI・量子技術への国家戦略投資を主導。「サナエノミクス」による積極財政と技術立国を推進する。",
    "bioEn": "Historic first female prime minister of Japan. A staunch conservative and protege of Shinzo Abe, she champions 'crisis management investment', aggressive fiscal policy, supply chain security, and advanced technology R&D.",
    "policiesZh": [
      {
        "title": "“危机管理投资”新战略",
        "desc": "将国家安全危机转化为投资动能，针对半导体制造、人工智能、量子计算及空间技术实施国家级资本补贴。"
      },
      {
        "title": "国家经济安全保障法制升级",
        "desc": "完善关键基础设施安全审查体制，建立完备的机密涉密人员安全许可资格（Security Clearance）法治化落地。"
      },
      {
        "title": "强化网络防御与太空自卫力量",
        "desc": "组建统合网络防卫指挥部，赋予自卫队主动网络防御（Active Cyber Defense）职能。"
      }
    ],
    "crisisZh": "在极化复杂的国会中力主积极财政引发央行加息抗通胀博弈，直面老龄化加深与财政纪律两难抉择。",
    "policiesJa": [
      {
        "title": "危機管理投資戦略",
        "desc": "国家安全保障上の危機を投資の原動力に変え、半導体製造、人工知能、量子計算、宇宙技術に国家的な資本補助を実施した。"
      },
      {
        "title": "経済安全保障法制の強化",
        "desc": "重要インフラの安全審査体制を整え、機密情報を扱う人材のセキュリティ・クリアランス制度を法制度化して確実に運用に移した。"
      },
      {
        "title": "サイバー・宇宙防衛の強化",
        "desc": "統合サイバー防衛指揮部を編成し、自衛隊に能動的サイバー防御（アクティブ・サイバー・ディフェンス）の機能を付与した。"
      }
    ],
    "policiesEn": [
      {
        "title": "Crisis-Management Investment",
        "desc": "Turning national security crises into investment momentum, she directed state capital subsidies into semiconductor manufacturing, artificial intelligence, quantum computing and space technology."
      },
      {
        "title": "Economic Security Legislation",
        "desc": "She strengthened security reviews of critical infrastructure and put in place a legal security clearance system for personnel handling classified information."
      },
      {
        "title": "Cyber and Space Defense",
        "desc": "She formed an integrated cyber defense command and gave the Self-Defense Forces an active cyber defense mandate."
      }
    ],
    "crisisJa": "分極化した複雑な国会で積極財政を主張し、中央銀行の利上げによるインフレ抑制策とのせめぎ合いに直面した。高齢化の深刻化と財政規律という二律背反の選択を迫られている。",
    "crisisEn": "In a polarized and complex parliament she championed expansionary fiscal policy, running into conflict with the central bank's rate hikes to contain inflation, and faces the dilemma between deepening aging and fiscal discipline."
  }
};

const VARIANT_CHART = {
  tactical: {
    chart: {
      gridBorder: 'rgba(237,235,228,0.08)',
      pointBorder: '#0E0E0C',
      tooltipBg: 'rgba(20,20,18,0.94)',
      tooltipBorder: 'rgba(237,235,228,0.16)',
      tooltipText: '#EDEBE4',
      zoomBorder: 'rgba(237,235,228,0.14)',
      zoomFill: 'rgba(255,106,61,0.22)',
      zoomHandle: '#FF6A3D',
      zoomText: '#A09E96'
    },
    palette: [
      '#FF6A3D','#4E9B80','#E5A93C','#5B8FF9','#C27BA0',
      '#D95F4E','#2CA02C','#F28E2B','#76B7B2','#EDC948',
      '#B07AA1','#FF9DA7','#9C755F','#BAB0AC'
    ]
  },
  editorial: {
    chart: {
      gridBorder: 'rgba(20,26,21,0.08)',
      pointBorder: '#E9EDE3',
      tooltipBg: 'rgba(242,245,238,0.96)',
      tooltipBorder: 'rgba(20,26,21,0.14)',
      tooltipText: '#141A15',
      zoomBorder: 'rgba(20,26,21,0.12)',
      zoomFill: 'rgba(47,107,79,0.18)',
      zoomHandle: '#2F6B4F',
      zoomText: '#56635A'
    },
    palette: [
      '#C84B31','#2F6B4F','#D48806','#1D39C4','#722ED1',
      '#A8071A','#389E0D','#D46B08','#08979C','#096DD9',
      '#531DAB','#C41D7F','#614700','#595959'
    ]
  }
};

function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const num = parseInt(hex, 16);
  return 'rgba(' + [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha].join(',') + ')';
}

function fmtMonth(lang, y, m) {
  const mm = (m < 10 ? '0' : '') + m;
  if (lang === 'en') return y + '-' + mm;
  return y + '年' + m + '月';
}

function detectInitialLang() {
  const q = new URLSearchParams(window.location.search).get('lang');
  if (q && I18N[q.toLowerCase()]) return q.toLowerCase();
  const saved = localStorage.getItem('cabinet-lang');
  if (saved && I18N[saved]) return saved;
  const navs = navigator.languages || [navigator.language || ''];
  for (const l of navs) {
    const s = (l || '').toLowerCase();
    if (s.startsWith('ja')) return 'ja';
    if (s.startsWith('zh')) return 'zh';
    if (s.startsWith('en')) return 'en';
  }
  return 'ja';
}

function detectInitialVariant() {
  const q = new URLSearchParams(window.location.search).get('theme');
  if (q && THEME_MAP[q]) return THEME_MAP[q];
  const dt = document.documentElement.dataset.theme;
  if (dt && THEME_MAP[dt]) return THEME_MAP[dt];
  return 'tactical';
}

const I18N = {
  ja: {
    htmlLang: 'ja',
    loadFailed: '世論調査データを読み込めませんでした。再読み込みしてください。',
    reload: '再読み込み',
    ranges: { '3m': '3ヶ月', '1y': '1年', '2y': '2年', '5y': '5年', '10y': '10年', 'all': '全期間' },
    yName: '支持率 (%)',
    months: 'か月',
    polls: '回調査',
    meanLabel: '平均支持率',
    highLabel: '最高支持率',
    lowLabel: '最低支持率',
    pollsLabel: '世論調査回数',
    tenureTitle: '任期中の支持率',
    shareLabel: '画像で保存',
    shareDone: '保存しました',
    shareFail: '保存できませんでした',
    overviewTitle: '14の内閣 · 331か月',
    overviewDesc: '1998年から2026年までのNHK放送文化研究所、選挙WEB、各社世論調査を月平均で集計。',
    overviewHint: '首相の区間や折線にマウスを合わせると、詳細な内閣データと経歴が表示されます。',
    unpin: '✕ 全首相の表示に戻す',
    chartFail: 'グラフライブラリの読み込みに失敗しました。'
  },
  zh: {
    htmlLang: 'zh-CN',
    loadFailed: '民调数据加载失败，请刷新重试。',
    reload: '刷新',
    ranges: { '3m': '3个月', '1y': '1年', '2y': '2年', '5y': '5年', '10y': '10年', 'all': '全期间' },
    yName: '支持率 (%)',
    months: '个月',
    polls: '次民调',
    meanLabel: '平均支持率',
    highLabel: '最高支持率',
    lowLabel: '最低支持率',
    pollsLabel: '民调统计数',
    tenureTitle: '任期内支持率曲线',
    shareLabel: '保存图片',
    shareDone: '已保存',
    shareFail: '保存失败',
    overviewTitle: '14届内阁 · 331个月',
    overviewDesc: '1998年至2026年间NHK放送文化研究所、选举WEB及各主要媒体舆论调查月均汇总。',
    overviewHint: '鼠标悬停于首相任期或折线上，可查看该内阁的完整数据指标与执政档案。',
    unpin: '✕ 恢复全景概览',
    chartFail: '图表库加载失败，请检查网络链路。'
  },
  en: {
    htmlLang: 'en',
    loadFailed: 'Could not load the polling data. Please reload.',
    reload: 'Reload',
    ranges: { '3m': '3M', '1y': '1Y', '2y': '2Y', '5y': '5Y', '10y': '10Y', 'all': 'ALL' },
    yName: 'Approval (%)',
    months: 'months',
    polls: 'polls',
    meanLabel: 'Mean Approval',
    highLabel: 'Highest Approval',
    lowLabel: 'Lowest Approval',
    pollsLabel: 'Recorded Polls',
    tenureTitle: 'Approval in office',
    shareLabel: 'Save image',
    shareDone: 'Saved',
    shareFail: 'Could not save',
    overviewTitle: '14 Cabinets · 331 Mos',
    overviewDesc: 'Monthly aggregate of cabinet polls from NHK, Nikkei, Asahi, Yomiuri and Kyodo (1998–2026).',
    overviewHint: 'Hover over any cabinet segment or curve to inspect historical data and editorial profile.',
    unpin: '✕ Reset View',
    chartFail: 'Failed to load chart library.'
  }
};

let currentLang = 'ja';
let currentVariant = 'tactical';
let rawData = null;
let chart = null;
let hostEl = null;
let panelEl = null;
let zoomEl = null;
let activeRange = '10y';
let focusCabinet = null;
let activeHoverCab = null;
let cabStats = {};
let bootToken = 0;
let mounted = false;
let isInitialAnimating = true;
let resizeRaf = null;

const RANGES = [
  { id: '3m' }, { id: '1y' }, { id: '2y' },
  { id: '5y' }, { id: '10y' }, { id: 'all' }
];
const RANGE_WINDOW_MONTHS = { '3m': 3, '1y': 12, '2y': 24, '5y': 60, '10y': 120, 'all': 0 };

function tchart() { return VARIANT_CHART[currentVariant].chart; }
function cabColors() { return VARIANT_CHART[currentVariant].palette; }

function injectCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cab-style')) return;
  const st = document.createElement('style');
  st.id = 'cab-style';
  st.textContent = CAB_CSS;
  document.head.appendChild(st);
}

let lastBoxW = 0, lastBoxH = 0;
function onCabResize() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    if (!chart) return;
    if (isInitialAnimating) return;
    // 尺寸没变就不 resize：更新面板会触发布局，反复 resize 会和 ResizeObserver 互相喂事件
    const box = hostEl ? hostEl.querySelector('#cab-chart') : null;
    if (box) {
      const w = Math.round(box.clientWidth), h = Math.round(box.clientHeight);
      if (w === lastBoxW && h === lastBoxH) return;
      lastBoxW = w; lastBoxH = h;
    }
    try { chart.resize(); } catch (e) {}
  });
}

function dismissVeil() {
  try {
    const stage = hostEl ? hostEl.closest('.stage-cabinet') : document.querySelector('.stage-cabinet');
    const veil = (stage && stage.querySelector('#cab-app-veil')) || document.getElementById('cab-app-veil');
    if (veil) {
      veil.classList.add('fade-out');
      setTimeout(() => {
        try { if (veil.parentNode) veil.parentNode.removeChild(veil); } catch (e) {}
      }, 750);
    }
  } catch (e) {}
}

function computeStats() {
  if (!rawData) return;
  const polls = rawData.polls;
  const cabinets = rawData.cabinets;
  const buckets = {};
  polls.forEach(p => {
    if (p.derived) return;
    const cab = pmByDate(p.date);
    const ym = p.date.slice(0, 7);
    const key = cab.id + '|' + ym;
    if (!buckets[key]) buckets[key] = { cab, ym, sums: 0, n: 0 };
    buckets[key].sums += p.value;
    buckets[key].n += 1;
  });

  cabStats = {};
  cabinets.forEach((c, idx) => {
    const cBuckets = Object.keys(buckets).map(k => buckets[k]).filter(b => b.cab.id === c.id);
    if (cBuckets.length > 0) {
      let high = -1, highYM = '';
      let low = 999, lowYM = '';
      let sum = 0, totalPolls = 0;
      cBuckets.forEach(b => {
        const v = b.sums / b.n;
        sum += v;
        totalPolls += b.n;
        if (v > high) { high = v; highYM = b.ym; }
        if (v < low) { low = v; lowYM = b.ym; }
      });
      cabStats[c.id] = {
        pm: c.pm,
        idx,
        color: cabColors()[idx % cabColors().length],
        start: c.start,
        end: c.end,
        months: cBuckets.length,
        mean: Math.round((sum / cBuckets.length) * 10) / 10,
        high: Math.round(high * 10) / 10,
        highYM,
        low: Math.round(low * 10) / 10,
        lowYM,
        polls: totalPolls,
        // 任期曲线与分享卡片都按这条月次序列画
        points: cBuckets.slice().sort(function (a, b) { return a.ym < b.ym ? -1 : 1; })
          .map(function (b) { return { ym: b.ym, v: Math.round((b.sums / b.n) * 10) / 10, n: b.n }; })
      };
    }
  });
}

function renderZoomSeg() {
  if (!zoomEl) return;
  const t = I18N[currentLang] || I18N.ja;
  zoomEl.innerHTML = '';
  RANGES.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.ranges[r.id];
    b.classList.toggle('on', r.id === activeRange);
    b.addEventListener('click', () => {
      activeRange = r.id;
      focusCabinet = null;
      renderZoomSeg();
      renderPanel(null);
      renderChart();
    });
    zoomEl.appendChild(b);
  });
}

function pmDisplayName(id) {
  const p = CAB_PROFILES[id] || {};
  if (currentLang === 'zh') return p.nameZh || id;
  if (currentLang === 'en') return p.nameEn || id;
  return p.nameJa || id;
}
function overviewName(id) { return pmDisplayName(id); }

function renderPanel(targetCabId) {
  if (!panelEl || !rawData) return;
  const t = I18N[currentLang] || I18N.ja;
  const langKey = currentLang;

  const cabId = targetCabId || focusCabinet;
  if (!cabId || !cabStats[cabId]) {
    const totalPolls = rawData.polls.length;
    const allMeans = Object.values(cabStats).map(s => s.mean);
    const avgAll = allMeans.length ? (Math.round((allMeans.reduce((a, b) => a + b, 0) / allMeans.length) * 10) / 10) : 41.2;
    
    panelEl.innerHTML = `
      <!-- 卡片 1: 全景大盘核心数据卡 -->
      <div class="panel-card">
        <div class="card-head">
          <span class="card-badge" style="background:var(--accent-soft, rgba(47,107,79,0.12));color:var(--accent);border:1px solid var(--accent-soft, rgba(47,107,79,0.25))">${langKey==='zh'?'大盘总览':langKey==='en'?'OVERVIEW':'政権全体'}</span>
          <span class="card-badge" style="background:rgba(0,0,0,0.05);color:var(--muted)">1998 — 2026</span>
        </div>
        <h2 class="card-title" style="margin-top:6px">${t.overviewTitle}</h2>
        <div class="card-subtitle">14${langKey==='zh'?'届内阁 · 331个月民调脉搏':langKey==='en'?' Cabinets · 331 Months of Polls':'内閣・331ヶ月の世論推移'}</div>

        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-num">${avgAll}<span style="font-size:16px;font-weight:300">%</span></div>
            <div class="stat-label">${t.meanLabel} (14${langKey==='zh'?' 内阁总均值':langKey==='en'?'-Cabinet Mean':'内閣平均'})</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${totalPolls}</div>
            <div class="stat-label">${t.pollsLabel} (${langKey === 'en' ? 'NHK / Nikkei / Asahi' : 'NHK / 日経 / 朝日'})</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">85.2<span style="font-size:16px;font-weight:300">%</span></div>
            <div class="stat-label">${t.highLabel} (${overviewName("koizumi")} 2001)</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">7.0<span style="font-size:16px;font-weight:300">%</span></div>
            <div class="stat-label">${t.lowLabel} (${overviewName("mori")} 2001)</div>
          </div>
        </div>

        <div style="font-size:12.5px;line-height:1.65;color:var(--muted);margin-top:10px">
          ${langKey==='zh'?'从平成金融危机到后疫情时代，记录日本政权更迭、派阀盛衰与国民信任度起伏的28年一手连续调查轨迹。':langKey==='en'?'28 years of continuous first-hand poll tracking across post-bubble Japan, documenting regime shifts, faction dynamics, and public sentiment.':'平成の金融危機からポストコロナまで、政権交代・派閥抗争・国民の信認を記録した28年間の連続世論調査データ。'}
        </div>
      </div>

      <!-- 卡片 2: 执政时长排行榜 -->
      <div class="panel-card">
        <div style="font-size:15px;font-weight:250;letter-spacing:-0.2px;color:var(--ink);margin-bottom:12px;display:flex;align-items:center;gap:6px">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 13h12v1H2zm2-3h2v2H4zm3-4h2v6H7zm3-2h2v8h-2z"/></svg>
          ${langKey==='zh'?'政权稳定性与在任天数记录':langKey==='en'?'Tenure & Stability Records':'歴代内閣 在職日数記録'}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line-main, rgba(0,0,0,0.08))">
            <span>${langKey==='zh'?'最长政权 · 安倍晋三 (2次)':langKey==='en'?'Longest: Shinzo Abe (2nd)':'最長政権：安倍晋三(2次)'}</span>
            <span style="font-size:14px;font-weight:250;color:var(--accent)">2,822 ${langKey==='zh'?'天':langKey==='en'?'days':'日'} (93${langKey==='zh'?'个月':langKey==='en'?'mo':'ヶ月'})</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line-main, rgba(0,0,0,0.08))">
            <span>${langKey==='zh'?'结构改革 · 小泉纯一郎':langKey==='en'?'Structure: Junichiro Koizumi':'構造改革：小泉純一郎'}</span>
            <span style="font-size:14px;font-weight:250;color:var(--ink)">1,980 ${langKey==='zh'?'天':langKey==='en'?'days':'日'} (65${langKey==='zh'?'个月':langKey==='en'?'mo':'ヶ月'})</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dashed var(--line-main, rgba(0,0,0,0.08))">
            <span>${langKey==='zh'?'最短短命 · 鸠山由纪夫':langKey==='en'?'Shortest: Yukio Hatoyama':'最短退任：鳩山由紀夫'}</span>
            <span style="font-size:14px;font-weight:250;color:#A83A24">266 ${langKey==='zh'?'天':langKey==='en'?'days':'日'} (9${langKey==='zh'?'个月':langKey==='en'?'mo':'ヶ月'})</span>
          </div>
        </div>
      </div>

      <!-- 卡片 3: 操作引导与数据源 -->
      <div class="panel-card" style="background:transparent;border:1px dashed var(--line-main, rgba(0,0,0,0.15));box-shadow:none">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);line-height:1.5">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" style="flex-shrink:0"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4M8 4.5h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>${langKey==='zh'?'鼠标在左侧图表移动可查看每位首相的详尽生平、政绩与支持率档案；点击可固定锁定。':langKey==='en'?'Hover over the chart to inspect any Prime Minister profile and historical milestones. Click to pin.':'グラフ上にマウスを移動すると、各首相の経歴・主要政策・危機詳細が閲覧できます。クリックで固定。'}</span>
        </div>
      </div>
    `;
    return;
  }

  const s = cabStats[cabId];
  const p = CAB_PROFILES[cabId] || {
    id: cabId,
    nameZh: s.pm, nameJa: s.pm, nameEn: s.pm,
    eraNumberZh: "内阁总理大臣", eraNumberJa: "内閣総理大臣", eraNumberEn: "Prime Minister",
    partyZh: "自由民主党", partyJa: "自由民主党", partyEn: "LDP",
    originZh: "", originJa: "", originEn: "",
    bioZh: "", bioJa: "", bioEn: "",
    policiesZh: [],
    trendBadgeZh: "", trendBadgeJa: "", trendBadgeEn: "",
    crisisZh: ""
  };
  const color = s.color || '#FF6A3D';
  const isPinned = focusCabinet === cabId;

  const pmTitle = langKey === 'zh' ? (p.nameZh || s.pm) : (langKey === 'en' ? (p.nameEn || s.pm) : (p.nameJa || s.pm));
  const eraTitle = langKey === 'zh' ? p.eraNumberZh : (langKey === 'en' ? p.eraNumberEn : p.eraNumberJa);
  const partyTitle = langKey === 'zh' ? p.partyZh : (langKey === 'en' ? p.partyEn : p.partyJa);
  const trendTitle = langKey === 'zh' ? p.trendBadgeZh : (langKey === 'en' ? p.trendBadgeEn : p.trendBadgeJa);
  const originTitle = langKey === 'zh' ? p.originZh : (langKey === 'en' ? p.originEn : p.originJa);
  const bioTitle = langKey === 'zh' ? p.bioZh : (langKey === 'en' ? p.bioEn : (p.bioJa || p.bioZh));
  // 档案正文只有中文（bio 已有三语，政策与危机暂无 Ja/En）。
  // 日/英界面里宁可不显示，也不要把中文段落冒充成日文/英文。
  const policies = langKey === 'zh'
    ? (p.policiesZh || [])
    : (langKey === 'en' ? (p.policiesEn || []) : (p.policiesJa || []));
  const crisisTitle = langKey === 'zh' ? (p.crisisZh || '') : (langKey === 'en' ? (p.crisisEn || '') : (p.crisisJa || ''));

  panelEl.innerHTML = `
    <!-- 卡片 1: 领导人抬头与支持率四宫格 -->
    <div class="panel-card">
      <div class="card-head">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="card-badge" style="background:${hexToRgba(color, 0.12)};color:${color};border:1px solid ${hexToRgba(color, 0.3)}">${partyTitle.split('（')[0]}</span>
          ${trendTitle ? `<span class="card-badge" style="background:rgba(0,0,0,0.04);color:var(--muted)">${trendTitle}</span>` : ''}
        </div>
        <span class="card-badge" style="background:${isPinned ? 'var(--accent)' : 'rgba(0,0,0,0.05)'};color:${isPinned ? '#fff' : 'var(--muted)'};border:1px solid ${isPinned ? 'var(--accent)' : 'var(--line-main, rgba(0,0,0,0.1))'}">
          ${isPinned ? (langKey==='zh'?'已锁定':langKey==='en'?'PINNED':'固定中') : (langKey==='zh'?'内阁档案':langKey==='en'?'CABINET':'内閣')}
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <span style="display:inline-block;width:4px;height:22px;border-radius:2px;background:${color}"></span>
        <h2 class="card-title">${pmTitle}</h2>
      </div>
      <div class="card-subtitle">${eraTitle} · ${partyTitle}</div>
      <div style="font-size:12px;color:var(--muted);font-family:var(--font-sans);margin-top:4px">
        ${s.start.slice(0, 7)} — ${s.end.slice(0, 7)} (${s.months}${langKey==='zh'?'个月':langKey==='en'?' months':'ヶ月'} / ${p.days || (s.months * 30)}${langKey==='zh'?'天':langKey==='en'?' days':'日'})
      </div>

      <!-- 任期内支持率曲线 + 分享按钮(在四个指标上方) -->
      <div class="tenure-block">
        <div class="tenure-head">
          <span>${t.tenureTitle}</span>
          <span>${s.points && s.points.length ? s.points[0].ym + ' — ' + s.points[s.points.length - 1].ym : ''}</span>
        </div>
        ${tenureSparkline(s.points || [], color, cabId)}
        <div class="tenure-foot">
          <span class="tenure-note">${langKey==='zh'?'月度均值 · 各社民调按月平均':langKey==='en'?'Monthly means across the term':'月次平均・各社調査を月ごとに平均'}</span>
          <button type="button" class="cab-share" id="cab-btn-share" aria-label="${t.shareLabel}">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11.2V2.8M8 2.8 5.2 5.6M8 2.8l2.8 2.8"></path><path d="M2.8 9.6v3.6h10.4V9.6"></path></svg>
            <span class="cab-share-label">${t.shareLabel}</span>
          </button>
        </div>
      </div>

      <!-- 四宫格数据块 -->
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-num">${s.mean}<span style="font-size:16px;font-weight:300">%</span></div>
          <div class="stat-label">${t.meanLabel} (${s.polls}${langKey==='zh'?'次民调':langKey==='en'?' polls':'回'})</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${s.high}<span style="font-size:16px;font-weight:300">%</span></div>
          <div class="stat-label">${t.highLabel} (${s.highYM})</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${s.low}<span style="font-size:16px;font-weight:300">%</span></div>
          <div class="stat-label">${t.lowLabel} (${s.lowYM})</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${s.polls}</div>
          <div class="stat-label">${t.pollsLabel} (一次世論)</div>
        </div>
      </div>
    </div>

    <!-- 卡片 2: 领导人生平档案与政治出身 -->
    <div class="panel-card">
      <div style="font-size:13.5px;font-weight:300;letter-spacing:0.3px;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2 1H6a4 4 0 00-4 4v1h12v-1a4 4 0 00-4-4z"/></svg>
        ${langKey==='zh'?'生平档案与政治派阀':langKey==='en'?'BIOGRAPHY & BACKGROUND':'経歴・政治的出自'}
      </div>
      ${originTitle ? `<div style="font-size:13px;color:var(--ink);font-weight:300;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed var(--line-main, rgba(0,0,0,0.08))">${originTitle}</div>` : ''}
      <div style="font-size:13px;line-height:1.7;color:var(--ink);font-weight:350">
        ${bioTitle}
      </div>
    </div>

    <!-- 卡片 3: 核心政策与关键历史战役 -->
    ${policies.length > 0 ? `
      <div class="panel-card">
        <div style="font-size:13.5px;font-weight:300;letter-spacing:0.3px;color:var(--accent);margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M3 2h10v2H3zm0 4h10v2H3zm0 4h7v2H3z"/></svg>
          ${langKey==='zh'?'核心政策举措与重大战役':langKey==='en'?'SIGNATURE POLICIES':'主要政策と歴史的改革'}
        </div>
        <div>
          ${policies.map(pol => `
            <div class="policy-item" style="border-left-color:${color}">
              <div class="policy-title">${pol.title}</div>
              <div class="policy-desc">${pol.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 卡片 4: 辞职转折危机与操作栏 -->
    <div class="panel-card" style="padding:14px 16px">
      ${crisisTitle ? `
        <div style="font-size:13.5px;font-weight:300;color:#A83A24;margin-bottom:4px;display:flex;align-items:center;gap:6px">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 2l6 12H2L8 2zm0 3.5a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 008 5.5zm0 6a.75.75 0 100-1.5.75.75 0 000 1.5z"/></svg>
          ${langKey==='zh'?'政权转折与辞任危机':langKey==='en'?'TURNING POINT & EXIT':'退陣・政権交代の契機'}
        </div>
        <div style="font-size:12.5px;line-height:1.6;color:var(--muted);margin-bottom:12px">
          ${crisisTitle}
        </div>
      ` : ''}
      <button type="button" class="back-btn" id="cab-btn-back">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${langKey==='zh'?'返回大盘总览':langKey==='en'?'Back to Overview':'大盤全体に戻る'}
      </button>
    </div>
  `;

  const shareBtn = panelEl.querySelector('#cab-btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveShareCard(cabId, shareBtn);
    });
  }

  const backBtn = panelEl.querySelector('#cab-btn-back');
  if (backBtn) {
    backBtn.onclick = (e) => {
      e.stopPropagation();
      focusCabinet = null;
      renderPanel(null);
      if (chart) {
        chart.dispatchAction({ type: 'downplay' });
      }
    };
  }
}

function pmByDate(dateStr) {
  if (!rawData || !rawData.cabinets) return null;
  const d = new Date(dateStr);
  for (let i = rawData.cabinets.length - 1; i >= 0; i--) {
    if (d >= new Date(rawData.cabinets[i].start)) return rawData.cabinets[i];
  }
  return rawData.cabinets[0];
}

// 图上名签只写姓氏，日/中/英各一套；两任「菅」用名首字区分
const PM_SURNAME = {
  obuchi: ['小渕', '小渊', 'Obuchi'],
  mori: ['森', '森', 'Mori'],
  koizumi: ['小泉', '小泉', 'Koizumi'],
  abe1: ['安倍', '安倍', 'Abe'],
  abe2: ['安倍', '安倍', 'Abe'],
  fukuda: ['福田', '福田', 'Fukuda'],
  aso: ['麻生', '麻生', 'Aso'],
  hatoyama: ['鳩山', '鸠山', 'Hatoyama'],
  kan: ['菅(直)', '菅(直)', 'Kan'],
  noda: ['野田', '野田', 'Noda'],
  suga: ['菅(義)', '菅(义)', 'Suga'],
  kishida: ['岸田', '岸田', 'Kishida'],
  ishiba: ['石破', '石破', 'Ishiba'],
  takaichi: ['高市', '高市', 'Takaichi']
};

let lastSeries = null, labelTimer = 0;

// 拖动滑块换窗口后，顶部名签必须按新窗口重算，否则名字会全部消失
function refreshWindowLabels(startPct, endStartPct) {
  if (!chart || !lastSeries || !rawData) return;
  const ds = rawData.polls.map(p => p.date).sort();
  const t0 = new Date(ds[0]).getTime();
  const t1 = new Date(ds[ds.length - 1]).getTime();
  const pct = Math.max(0, Math.min(100, startPct || 0));
  const win = new Date(t0 + (t1 - t0) * pct / 100).toISOString().slice(0, 10);
  const endPct = Math.max(pct, Math.min(100, endStartPct || 100));
  const winEnd = new Date(t0 + (t1 - t0) * endPct / 100).toISOString().slice(0, 10);
  lastSeries.forEach((sr) => {
    const c = rawData.cabinets.find(x => x.id === sr.__cabId);
    // markLine.data 是「一组两点」的数组：data[0] = [起点, 终点]
    const pair = sr.markLine && sr.markLine.data && sr.markLine.data[0];
    if (!c || !pair || pair.length < 2) return;
    // 窗口右侧之外的任期内阁也一并藏掉，免得 markLine 被裁到图外还留着状态
    const out = c.end <= win || c.start > winEnd;
    const clamped = c.start < win && !out;
    // 数据点落在每月 15 号:分隔线与名签跟着第一条数据点走,才和折线的换色点对齐
    const firstPt = (sr.data && sr.data.length) ? sr.data[0][0] : c.start;
    // 第一个数据点贴到/越过绘图区左沿时同样按"贴左沿"处理:窗口起点是估算值,
    // 数据点可能刚好落在它左边一点点,整条 markLine 会被裁到绘图区外、名字跟着消失。
    let clampedNow = clamped;
    try {
      const pxFirst = chart.convertToPixel({ xAxisIndex: 0 }, firstPt);
      if (isFinite(pxFirst) && pxFirst <= 3) clampedNow = true;
    } catch (err) {}
    const x = clampedNow ? win : firstPt;
    pair[0].coord = [x, 0];
    pair[1].coord = [x, 96];
    const tail = sr.markLine.data[1];
    if (tail && tail.length > 1) {
      tail[0].coord = [x, 97];
      tail[1].coord = [x, 100];
    }
    sr.markLine.lineStyle = sr.markLine.lineStyle || {};
    // 跨窗口左沿的只留一条很淡的影子(完全透明会把整条 markLine 一起吞掉)
    sr.markLine.lineStyle.opacity = out ? 0 : (clampedNow ? 0.16 : 0.65);
  });
  chart.setOption({ series: lastSeries }, { lazyUpdate: true });
  // 区间名水印按新的窗口重排(位置/字号都按像素算,不走 markLine 的 endLabel)
  relayoutWatermarks();
}

/* ── 区间名水印 / 任期曲线 / 分享卡片 ───────────────────────────── */

// 区间水印字号:由区间实际像素宽度反推,放不下就不印(窄屏与"全期間"自动消失)
function watermarkFor(text, spanPx, isNarrow) {
  const txt = String(text || '');
  const cjk = /[^\x00-\xff]/.test(txt);
  const unit = cjk ? 1.0 : 0.6;
  const avail = spanPx * 0.94 - 8;
  const size = Math.max(0, Math.min(96, Math.floor(avail / Math.max(1, txt.length * unit))));
  return { text: txt, size: size, show: !isNarrow && size >= 20 };
}

// 绘图区左右边距:面板占右边 384px,水印与 ECharts 的 grid 必须用同一套数字
function cabGridL() { return window.innerWidth <= 960 ? 36 : 48; }
function cabGridR() { return window.innerWidth <= 960 ? 20 : 384; }

// 区间名水印:用 graphic 文本画,位置与字号都在这里算死。
// 不用 markLine 的 endLabel —— 它贴到绘图区左沿时整条 markLine 会被裁掉,名字跟着消失。
function relayoutWatermarks() {
  if (!chart || !lastSeries || !rawData) return;
  const narrow = window.innerWidth <= 960;
  const left = cabGridL();
  const right = cabGridR();
  const W = chart.getWidth() || 0;
  const items = [];
  lastSeries.forEach(function (sr) {
    if (!sr.__wm || !sr.data || !sr.data.length) return;
    let x0, x1;
    try {
      x0 = chart.convertToPixel({ xAxisIndex: 0 }, sr.data[0][0]);
      x1 = chart.convertToPixel({ xAxisIndex: 0 }, sr.data[sr.data.length - 1][0]);
    } catch (e) { return; }
    if (!isFinite(x0) || !isFinite(x1)) return;
    const vis0 = Math.max(x0, left);
    const vis1 = Math.min(x1, W - right);
    const wpx = vis1 - vis0;
    if (wpx < 24) return;
    const wm = watermarkFor(sr.__wm, wpx, narrow);
    if (!wm.show) return;
    items.push({
      type: 'text',
      left: Math.round(vis0 + 10),
      top: 34,
      silent: true,
      z: 8,
      style: {
        text: wm.text,
        font: '700 ' + wm.size + 'px ' + cssFont('--ja-sans', 'system-ui, sans-serif'),
        fill: hexToRgba(sr.__color || '#595959', currentVariant === 'editorial' ? 0.26 : 0.20)
      }
    });
  });
  chart.setOption({ graphic: items }, { replaceMerge: ['graphic'] });
}

// 任期支持率曲线:内联 SVG,不另起 ECharts 实例
function tenureSparkline(points, color, id) {
  const W = 316, H = 112, padT = 14, padB = 20;
  const n = points.length;
  if (!n) return '';
  const vs = points.map(function (q) { return q.v; });
  let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  if (hi - lo < 12) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; }
  const span = Math.max(1, hi - lo);
  const px = function (i) { return n === 1 ? W / 2 : (i / (n - 1)) * W; };
  const py = function (v) { return padT + (1 - (v - lo) / span) * (H - padT - padB); };
  const line = points.map(function (q, i) {
    return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(q.v).toFixed(1);
  }).join(' ');
  const hiI = vs.indexOf(Math.max.apply(null, vs));
  const loI = vs.indexOf(Math.min.apply(null, vs));
  const gid = 'cabspark-' + String(id).replace(/[^a-z0-9]/gi, '');
  let out = '<svg class="tenure-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-hidden="true">';
  out += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="' + hexToRgba(color, 0.34) + '"></stop>'
    + '<stop offset="1" stop-color="' + hexToRgba(color, 0.02) + '"></stop></linearGradient></defs>';
  [0, 0.5, 1].forEach(function (f) {
    const gy = (padT + f * (H - padT - padB)).toFixed(1);
    out += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy
      + '" stroke="var(--line-main, rgba(0,0,0,0.12))" stroke-width="1" stroke-dasharray="2 5"></line>';
  });
  out += '<path d="' + line + ' L' + W + ' ' + (H - padB) + ' L0 ' + (H - padB) + ' Z" fill="url(#' + gid + ')"></path>';
  out += '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>';
  [{ i: hiI, up: 1 }, { i: loI, up: 0 }].forEach(function (m) {
    if (m.i < 0) return;
    const cx = px(m.i), cy = py(vs[m.i]);
    out += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.2" fill="var(--bg, #141412)" stroke="' + color + '" stroke-width="1.6"></circle>';
    out += '<text x="' + cx.toFixed(1) + '" y="' + (m.up ? cy - 9 : cy + 16).toFixed(1)
      + '" text-anchor="middle" font-size="11" font-weight="400" fill="' + color + '">' + vs[m.i].toFixed(1) + '</text>';
  });
  out += '</svg>';
  return out;
}

// canvas 只认它自己支持的颜色写法:token 用了 color-mix/新语法时回退到兜底色
function paintableColor(raw, fallback) {
  const v = String(raw || '').trim();
  if (!v) return fallback;
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000000';
    c.fillStyle = v;
    if (c.fillStyle === '#000000' && !/^#0{6}$|^black$|^rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(v)) return fallback;
    return v;
  } catch (e) { return fallback; }
}

function shareSourcesLine(langKey) {
  if (langKey === 'zh') return '来源:NHK・日经・朝日・时事・读卖・JNN・共同 各社民调(月度均值)';
  if (langKey === 'en') return 'Sources: NHK, Nikkei, Asahi, Jiji, Yomiuri, JNN and Kyodo polls (monthly means)';
  return '出典:NHK・日経・朝日・時事・読売・JNN・共同 各社世論調査(月次平均)';
}

// 分享卡片:把这一任的首相名 + 任期支持率曲线 + 四个指标画成一张 1200×675 PNG
function shareCardCanvas(cabId) {
  const s = cabStats[cabId];
  if (!s || !s.points || !s.points.length) return null;
  const p = CAB_PROFILES[cabId] || {};
  const langKey = currentLang;
  const t = I18N[langKey] || I18N.ja;
  const dpr = 2, W = 1200, H = 675;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.scale(dpr, dpr);
  const rs = getComputedStyle(document.documentElement);
  const pick = function (name, fb) { return paintableColor(rs.getPropertyValue(name), fb); };
  const bg = pick('--bg', '#141412');
  const ink = pick('--ink', '#EDEBE4');
  const muted = pick('--muted', '#A09E96');
  const accent = pick('--accent', '#FF6A3D');
  const fSans = cssFont('--font-sans', 'system-ui, sans-serif');
  const fJa = cssFont('--ja-sans', fSans);
  const pad = 64;

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = accent;
  g.font = '400 20px ' + fSans;
  g.fillText('japan.ouuut.com/cabinet/', pad, 60);
  g.textAlign = 'right';
  g.fillStyle = muted;
  g.fillText(langKey === 'zh' ? '内阁支持率 · 月度均值' : (langKey === 'en' ? 'Cabinet approval · monthly means' : '内閣支持率・月次平均'), W - pad, 60);

  const pmTitle = langKey === 'zh' ? (p.nameZh || s.pm) : (langKey === 'en' ? (p.nameEn || s.pm) : (p.nameJa || s.pm));
  const eraTitle = langKey === 'zh' ? p.eraNumberZh : (langKey === 'en' ? p.eraNumberEn : p.eraNumberJa);
  const partyTitle = langKey === 'zh' ? p.partyZh : (langKey === 'en' ? p.partyEn : p.partyJa);
  const firstYM = s.points[0].ym, lastYM = s.points[s.points.length - 1].ym;
  g.textAlign = 'left';
  g.fillStyle = ink;
  g.font = '300 58px ' + fJa;
  g.fillText(pmTitle, pad, 152);
  g.fillStyle = muted;
  g.font = '400 19px ' + fSans;
  g.fillText([eraTitle, String(partyTitle || '').split('(')[0], firstYM + ' — ' + lastYM].filter(Boolean).join('   ·   '), pad, 190);

  // 曲线区
  const plotX0 = pad + 54, plotX1 = W - pad, plotY0 = 246, plotY1 = H - 178;
  const vs = s.points.map(function (q) { return q.v; });
  let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  if (hi - lo < 10) { const mid = (hi + lo) / 2; lo = mid - 5; hi = mid + 5; }
  const span = Math.max(1, hi - lo);
  const n = vs.length;
  const px = function (i) { return n === 1 ? (plotX0 + plotX1) / 2 : plotX0 + (i / (n - 1)) * (plotX1 - plotX0); };
  const py = function (v) { return plotY0 + (1 - (v - lo) / span) * (plotY1 - plotY0); };

  g.font = '400 15px ' + fSans;
  [0, 0.5, 1].forEach(function (f) {
    const v = hi - f * span;
    const yy = plotY0 + f * (plotY1 - plotY0);
    g.save();
    g.strokeStyle = muted;
    g.globalAlpha = 0.35;
    g.setLineDash([3, 6]);
    g.beginPath();
    g.moveTo(plotX0, yy);
    g.lineTo(plotX1, yy);
    g.stroke();
    g.restore();
    g.fillStyle = muted;
    g.textAlign = 'right';
    const tickText = function (x) { return Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1); };
    g.fillText(tickText(v), plotX0 - 12, yy + 5);
  });
  g.textAlign = 'center';
  g.fillStyle = muted;
  const tickIdx = [];
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step) tickIdx.push(i);
  if (tickIdx[tickIdx.length - 1] !== n - 1) tickIdx.push(n - 1);
  tickIdx.forEach(function (i) {
    g.fillText(s.points[i].ym, px(i), plotY1 + 24);
  });

  const d = s.points.map(function (q, i) {
    return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(q.v).toFixed(1);
  }).join(' ');
  const grad = g.createLinearGradient(0, plotY0, 0, plotY1);
  grad.addColorStop(0, hexToRgba(s.color, 0.34));
  grad.addColorStop(1, hexToRgba(s.color, 0.02));
  g.beginPath();
  g.moveTo(px(0), py(vs[0]));
  for (let i = 1; i < n; i++) g.lineTo(px(i), py(vs[i]));
  g.lineTo(px(n - 1), plotY1);
  g.lineTo(px(0), plotY1);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.beginPath();
  g.moveTo(px(0), py(vs[0]));
  for (let i = 1; i < n; i++) g.lineTo(px(i), py(vs[i]));
  g.strokeStyle = s.color;
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
  const hiI = vs.indexOf(hi), loI = vs.indexOf(lo);
  g.font = '400 16px ' + fSans;
  [hiI, loI].forEach(function (i, k) {
    if (i < 0) return;
    const cx = px(i), cy = py(vs[i]);
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fillStyle = bg;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = s.color;
    g.stroke();
    g.fillStyle = s.color;
    g.textAlign = 'center';
    // 最低点贴着底轴时标签改放点上方,否则会和月份刻度叠在一起
    g.fillText(vs[i].toFixed(1) + '%', cx, (k === 0 || cy > plotY1 - 30) ? cy - 12 : cy + 22);
  });

  // 四个指标
  const cells = [
    [s.mean + '%', t.meanLabel],
    [s.high + '%', t.highLabel],
    [s.low + '%', t.lowLabel],
    [String(s.polls), t.pollsLabel]
  ];
  const colW = (plotX1 - pad) / cells.length;
  g.textAlign = 'left';
  cells.forEach(function (c, i) {
    const x = pad + i * colW;
    g.fillStyle = ink;
    g.font = '200 40px ' + fSans;
    g.fillText(c[0], x, H - 108);
    g.fillStyle = muted;
    g.font = '400 15px ' + fSans;
    g.fillText(c[1], x, H - 82);
  });

  g.fillStyle = muted;
  g.font = '400 15px ' + fSans;
  g.fillText(shareSourcesLine(langKey), pad, H - 36);
  return cv;
}

function shareFilename(cabId, langKey) {
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return 'japan-ouuut-cabinet-' + cabId + '-' + (langKey || currentLang) + '-' + stamp + '.png';
}

function downloadBlob(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  } catch (e) {}
}

function flashShareButton(btn, key) {
  if (!btn) return;
  const t = I18N[currentLang] || I18N.ja;
  const label = btn.querySelector('.cab-share-label');
  if (label && !label.dataset.cabIdle) label.dataset.cabIdle = label.textContent;
  if (label) label.textContent = t[key] || label.dataset.cabIdle;
  btn.classList.toggle('is-done', key === 'shareDone');
  clearTimeout(btn.__cabT);
  btn.__cabT = setTimeout(function () {
    if (label && label.dataset.cabIdle) label.textContent = label.dataset.cabIdle;
    btn.classList.remove('is-done');
  }, 2400);
}

function saveShareCard(cabId, btn) {
  const cv = shareCardCanvas(cabId);
  if (!cv) { flashShareButton(btn, 'shareFail'); return; }
  const name = shareFilename(cabId);
  cv.toBlob(function (blob) {
    if (!blob) { flashShareButton(btn, 'shareFail'); return; }
    try {
      const file = (typeof File !== 'undefined') ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: 'japan.ouuut.com/cabinet', text: name }).then(function () {
          flashShareButton(btn, 'shareDone');
        }).catch(function (err) {
          // 用户主动取消不算失败;其它错误(桌面浏览器不支持文件分享等)退回下载
          if (err && err.name === 'AbortError') { flashShareButton(btn, 'shareDone'); return; }
          downloadBlob(blob, name);
          flashShareButton(btn, 'shareDone');
        });
        return;
      }
    } catch (e) {}
    downloadBlob(blob, name);
    flashShareButton(btn, 'shareDone');
  }, 'image/png');
}
// 每像素对应多少个月：用来判断相邻首相挨得太近、标签必然互相压字
function plotPxPerMonth(winStartISO) {
  const ds = rawData.polls.map(p => p.date).sort();
  const t0 = new Date(winStartISO).getTime();
  const t1 = new Date(ds[ds.length - 1]).getTime();
  const box = hostEl && hostEl.querySelector('#cab-chart');
  // 绘图区宽度要扣掉固定右边距(那是右侧面板的地盘),否则每像素月数会被高估
  const w = Math.max(200, (box ? box.clientWidth : 1000) - cabGridL() - cabGridR());
  return w / Math.max(1, (t1 - t0) / 86400000 / 30.44);
}

let zoomingUntil = 0;
let panelRaf = 0;

function renderChart() {
  if (!window.echarts || !rawData) return;
  const t = I18N[currentLang] || I18N.ja;
  const chartBox = hostEl ? hostEl.querySelector('#cab-chart') : document.getElementById('cab-chart');
  if (!chartBox) return;
  if (!chart) chart = echarts.init(chartBox, null, { renderer: 'canvas' });

  const polls = rawData.polls;
  const cabinets = rawData.cabinets;
  const C = cabColors();
  const T = tchart();
  const isNarrow = window.innerWidth <= 960;
  const gridL = cabGridL();
  // 右侧面板 352px + 16px 边距 + 16px 呼吸:早先只留 344,最新一任的折线正好被面板压住
  const gridR = cabGridR();

  const buckets = {};
  polls.forEach(p => {
    if (p.derived) return;
    const cab = pmByDate(p.date);
    const ym = p.date.slice(0, 7);
    const key = cab.id + '|' + ym;
    if (!buckets[key]) buckets[key] = { cab, ym, sums: 0, n: 0, sources: [] };
    buckets[key].sums += p.value;
    buckets[key].n += 1;
    buckets[key].sources.push({ src: p.source, v: p.value, kind: p.kind || '' });
  });

  // 每个内阁实际占用的月次区间(数据点落在每月 15 号)。背景条、分隔线、名签都以它为准:
  // 用任期起始日期(可能落在某月 20 号之后)会和折线的换色点错开几像素到几十像素。
  const cabSpan = {};
  Object.keys(buckets).forEach(function (key) {
    const r = buckets[key];
    const d = r.ym + '-15';
    const cur = cabSpan[r.cab.id];
    if (!cur) { cabSpan[r.cab.id] = { first: d, last: d }; }
    else {
      if (d < cur.first) cur.first = d;
      if (d > cur.last) cur.last = d;
    }
  });
  const spanOf = function (c) {
    const sp = cabSpan[c.id];
    return { first: sp ? sp.first : c.start, last: sp ? sp.last : c.end };
  };

  const markAreaData = cabinets.map((c, idx) => {
    const isEven = idx % 2 === 0;
    const bg = isEven
      ? (currentVariant === 'editorial' ? 'rgba(0,0,0,0.026)' : 'rgba(255,255,255,0.026)')
      : 'transparent';
    const sp = spanOf(c);
    return [
      { xAxis: sp.first, itemStyle: { color: bg } },
      { xAxis: sp.last }
    ];
  });

  // 当前可见窗口的左沿：起点落在窗口外的首相，名字贴到左沿，否则那条线就没有名字。
  // 必须放在序列循环之前——这里直接从 polls 推算，不依赖后面才声明的 startDate。
  const winStartISO = (function () {
    const ds = polls.map(p => p.date).sort();
    const t0 = new Date(ds[0]).getTime();
    const t1 = new Date(ds[ds.length - 1]).getTime();
    const wm = RANGE_WINDOW_MONTHS[activeRange];
    if (!(wm > 0) || !(t1 > t0)) return ds[0];
    const pct = Math.max(0, 1 - (wm * 30.44 * 86400000) / (t1 - t0));
    return new Date(t0 + (t1 - t0) * pct).toISOString().slice(0, 10);
  })();

  const series = [];
  cabinets.forEach((c, i) => {
    // 每一任给独立色：只留一色时 14 段折线在深色底上糊成一片灰线，读不出政权更替。
    const isActive = focusCabinet ? focusCabinet === c.id : i === cabinets.length - 1;
    const color = C[i % C.length];
    // 起点在窗口外时，名字与竖线都贴到窗口左沿（竖线不画，只留名字）
    const outOfWindow = c.end <= winStartISO;      // 整段都在窗口左侧：不标名字
    const clamped = c.start < winStartISO && !outOfWindow; // 跨窗口左沿：名字贴左沿
    const _prof = CAB_PROFILES[c.id] || {};
    const pmName = currentLang === 'zh' ? (_prof.nameZh || c.pm)
      : currentLang === 'en' ? (_prof.nameEn || c.pm)
      : (_prof.nameJa || c.pm);
    // 图上只放姓氏（同一高度、等宽短标签），全名放 tooltip / 右侧面板，避免名签高低不齐
    const _tagM = String(c.pm).match(/\((.*?)\)/);
    const _tag = _tagM ? '(' + _tagM[1].replace(/次/, '') + ')' : '';
    const _full = pmName.replace(/\(.*\)$/, '');
    const _sn = PM_SURNAME[c.id];
    const _pmBase = _sn ? _sn[currentLang === 'zh' ? 1 : currentLang === 'en' ? 2 : 0]
      : (currentLang === 'en' ? _full.split(' ').pop() : _full);
    const _span = spanOf(c);
    // 窗口左沿判定:任期起点落在窗口外、或该内阁第一个数据点已经贴着/越过窗口左沿
    // (窗口起点是按月数估的,可能刚好落在第一个数据点之后),两种都按"贴左沿"处理:
    // 名字钉在左沿、竖线只留淡影 —— 否则 markLine 整条落在绘图区外会被裁掉,水印一起消失。
    const clampedEff = clamped || (new Date(_span.first) < new Date(winStartISO));
    const _visFirst = clampedEff ? winStartISO : _span.first;
    const labelX = _visFirst;
    // 区间名:字号按区间宽度反推,做成"大水印"印在区间左上角
    const _pPM = plotPxPerMonth(winStartISO);
    // 宽度按「实际有数据、且在当前窗口里可见的月份跨度」算:
    // 任期终点是名义值(高市标到 2030),跨窗口左沿的只算露出来的那截,
    // 否则水印会按整段任期放大,压出画布盖到邻居身上。
    const _visMonths = Math.max(0, (new Date(_span.last) - new Date(_visFirst)) / 86400000 / 30.44);
    const _spanPx = _visMonths * _pPM;
    // 任期不到 4 个月的宽度就别带 (1)/(2) 尾巴,否则一定压到邻居
    const _crowded = _spanPx < 44;
    const pmShort = _crowded ? _pmBase : _pmBase + _tag;
    const wm = watermarkFor(pmShort, _spanPx, isNarrow);
    const wmShow = wm.show && !outOfWindow;
    const points = [];
    Object.keys(buckets).sort().forEach(key => {
      const rec = buckets[key];
      if (rec.cab.id !== c.id) return;
      const d = rec.ym + '-15';
      const avg = Math.round((rec.sums / rec.n) * 10) / 10;
      points.push([d, avg, rec.n, rec.sources]);
    });

    if (points.length > 0) {
      const focused = focusCabinet === c.id;
      series.push({
        __cabId: c.id,
        __color: color,
        __wm: wmShow ? wm.text : '',
        name: pmName,
        type: 'line',
        data: points,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: focused ? 8 : 5,
        smooth: 0.15,
        connectNulls: false,
        lineStyle: {
          color: color,
          width: focused ? 3.5 : (isActive ? 2.6 : 2.0),
          type: 'solid',
          opacity: 0.9,
          shadowBlur: currentVariant === 'tactical' ? (focused ? 10 : 4) : 0,
          shadowColor: currentVariant === 'tactical' ? hexToRgba(color, 0.45) : 'transparent'
        },
        itemStyle: {
          color: color,
          borderColor: T.pointBorder,
          borderWidth: 1.5,
          opacity: 1
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(color, currentVariant === 'editorial' ? 0.20 : 0.24) },
            { offset: 0.85, color: hexToRgba(color, 0.02) },
            { offset: 1, color: hexToRgba(color, 0.0) }
          ]),
          opacity: focused ? 0.9 : (isActive ? 0.72 : 0.34)
        },
        emphasis: { focus: 'none', scale: 1.25 },
        z: focused ? 6 : 3,
        markArea: i === 0 ? {
          silent: true,
          data: markAreaData
        } : undefined,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: {
            color: currentVariant === 'editorial' ? 'rgba(23,33,26,0.18)' : 'rgba(237,235,228,0.16)',
            type: 'dashed',
            width: focused ? 2.5 : 1.2,
            // 贴到窗口左沿的名字不应该凭空多出一条更替竖线,只留一条淡影
            opacity: clampedEff ? 0.16 : (outOfWindow ? 0 : 0.65)
          },
          data: [
            [
              { coord: [labelX, 0], symbol: 'none' },
              { coord: [labelX, 96], symbol: 'none' }
            ],
            [
              { coord: [labelX, 97], symbol: 'none' },
              { coord: [labelX, 100], symbol: 'none' }
            ]
          ]
        }
      });
    }
  });

  const allDates = polls.map(p => p.date).sort();
  const startDate = allDates[0];
  const endDate = allDates[allDates.length - 1];
  const bucketDates = Object.values(buckets).map(r => r.ym + '-15').sort();
  const lastBucket = bucketDates[bucketDates.length - 1];
  const axisMaxTime = Math.max(new Date(endDate).getTime(), new Date(lastBucket).getTime()) + 18 * 86400000;
  const axisMaxISO = new Date(axisMaxTime).toISOString().slice(0, 10);

  const wMonths = RANGE_WINDOW_MONTHS[activeRange];
  let zoomStart = 0;
  if (wMonths > 0) {
    const spanMs = new Date(endDate) - new Date(startDate);
    const winMs = wMonths * 30.44 * 86400000;
    zoomStart = Math.max(0, Math.round((1 - winMs / spanMs) * 1000) / 10);
  }

  const focusCab = focusCabinet ? rawData.cabinets.find(c => c.id === focusCabinet) : null;
  let focusWindow = null;
  if (focusCab && wMonths > 0) {
    const winMs = wMonths * 30.44 * 86400000;
    const tMin = new Date(startDate).getTime();
    const tMax = new Date(endDate).getTime();
    const cStart = new Date(focusCab.start).getTime();
    const cEnd = new Date(focusCab.end).getTime();
    const center = (cStart + cEnd) / 2;
    let ws = center - winMs / 2;
    let we = center + winMs / 2;
    if (ws < tMin) { ws = tMin; we = tMin + winMs; }
    if (we > tMax) { we = tMax; ws = tMax - winMs; }
    focusWindow = { startValue: new Date(ws), endValue: new Date(we) };
  }

  // 底部长条 slider：左侧留出标签按钮空间 (366px)，右侧留出面板空间 (344px)！
  const sliderDZ = {
    type: 'slider', xAxisIndex: 0,
    show: !isNarrow,
    left: isNarrow ? 36 : 366,
    right: gridR,
    height: 24, bottom: 8,
    borderRadius: 6,
    borderColor: T.zoomBorder,
    backgroundColor: T.zoomFill,
    fillerColor: T.zoomFill,
    handleSize: 14,
    brushSelect: false,
    dataBackground: { lineStyle: { color: 'rgba(0,0,0,0)' }, areaStyle: { color: 'rgba(0,0,0,0)' } },
    selectedDataBackground: { lineStyle: { color: 'rgba(0,0,0,0)' }, areaStyle: { color: 'rgba(0,0,0,0)' } },
    moveHandleSize: 0,
    handleIcon: 'path://M-8,-9h16a4,4 0 0 1 4,4v10a4,4 0 0 1 -4,4h-16a4,4 0 0 1 -4,-4v-10a4,4 0 0 1 4,-4z',
    handleStyle: {
      color: T.zoomHandle, borderColor: 'rgba(0,0,0,0.28)', borderWidth: 1,
      shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.35)', shadowOffsetY: 1.5
    },
    emphasis: { handleStyle: { color: T.zoomHandle, borderColor: T.zoomHandle, shadowBlur: 7 } },
    textStyle: { color: T.zoomText, fontSize: 10 }
  };
  if (focusWindow) {
    sliderDZ.startValue = focusWindow.startValue;
    sliderDZ.endValue = focusWindow.endValue;
  } else {
    sliderDZ.start = zoomStart;
    sliderDZ.end = 100;
  }

  const lang = currentLang;
  const option = {
    backgroundColor: 'transparent',
    grid: { left: gridL, right: gridR, top: 28, bottom: 54, borderColor: T.gridBorder },
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      backgroundColor: currentVariant === 'editorial' ? 'rgba(250, 252, 246, 0.96)' : 'rgba(20, 20, 18, 0.96)',
      borderColor: currentVariant === 'editorial' ? 'rgba(20, 26, 21, 0.12)' : 'rgba(237, 235, 228, 0.14)',
      borderWidth: 1,
      padding: [12, 16],
      // 右侧 384px 是档案面板的地盘:悬浮面板压到面板上会两边都看不清。
      // 这里自己算落点(越过面板左沿就翻到光标左侧),不用 confine —— 它只保证不出浏览器窗口。
      position: function (point, params, dom, rect, size) {
        const w = size.contentSize[0], h = size.contentSize[1];
        const W = size.viewSize[0], H = size.viewSize[1];
        const limit = W - cabGridR() - 8;
        let x = point[0] + 16;
        if (x + w > limit) x = point[0] - 16 - w;
        if (x < 8) x = 8;
        let y = point[1] - h - 14;
        if (y < 8) y = point[1] + 18;
        if (y + h > H - 8) y = Math.max(8, H - 8 - h);
        return [x, y];
      },
      extraCssText: 'border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.12);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);pointer-events:none;',
      textStyle: { color: T.tooltipText, fontSize: 13, fontFamily: cssFont('--font-sans', 'system-ui, sans-serif') },
      formatter: function(params) {
        if (!params || params.length === 0) return '';
        const d = new Date(params[0].axisValue);
        const cab = pmByDate(params[0].axisValue);
        const ymStr = fmtMonth(lang, d.getFullYear(), d.getMonth() + 1);
        const p = params[0];
        const avg = p.data ? p.data[1] : null;
        const n = p.data ? p.data[2] : 0;
        const sources = p.data ? (p.data[3] || []) : [];
        const cabIdx = cab ? cabinets.findIndex(x => x.id === cab.id) : 0;
        const col = C[cabIdx % C.length] || '#FF6A3D';
        const pmName = cab ? cab.pm : '';
        const fontSans = 'var(--font-sans, system-ui, sans-serif)';

        const dim = currentVariant === 'editorial' ? '#56635A' : '#A09E96';
        const hair = currentVariant === 'editorial' ? 'rgba(20,26,21,0.10)' : 'rgba(237,235,228,0.12)';

        // 固定宽度 + 两列来源网格:面板不再随来源数量横向无限延伸
        let html = '<div style="width:330px;max-width:min(330px,74vw);font-family:' + fontSans + ';color:' + T.tooltipText + '">';

        // 顶栏:彩标 + 首相大名 + 发生年月
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:10px">';
        html += '<div style="display:flex;align-items:center;gap:8px;min-width:0">';
        html += '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;background:' + col + ';box-shadow:0 0 8px ' + hexToRgba(col, 0.6) + '"></span>';
        html += '<span style="font-weight:300;font-size:15px;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + pmName + '</span>';
        html += '</div>';
        html += '<span style="color:' + dim + ';font-size:11.5px;font-weight:350;white-space:nowrap">' + ymStr + '</span>';
        html += '</div>';

        // 核心支持率:超大极细数字
        if (avg !== null) {
          html += '<div style="display:flex;align-items:baseline;gap:6px;margin:2px 0 8px 0">';
          html += '<span style="font-size:26px;font-weight:200;line-height:1;color:' + col + ';font-family:' + fontSans + ';letter-spacing:-0.5px">' + avg.toFixed(1) + '<span style="font-size:14px;font-weight:300">%</span></span>';
          html += '<span style="font-size:11.5px;font-weight:350;color:' + dim + '">' + n + (lang==='en'?' polls':lang==='zh'?' 家平均':'社平均') + '</span>';
          html += '</div>';
        }

        // 各社明细:两列网格,信息密度取代横向长条
        if (sources.length > 0) {
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 12px;border-top:1px solid ' + hair + ';padding-top:7px">';
          sources.forEach(function(s) {
            html += '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;min-width:0">';
            html += '<span style="font-size:11.5px;font-weight:350;color:' + dim + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.src + '</span>';
            html += '<span style="font-size:12px;font-weight:400;color:' + col + ';font-variant-numeric:tabular-nums">' + s.v.toFixed(1) + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
        return html;
      }
    },
    xAxis: {
      type: 'time', min: startDate, max: axisMaxISO,
      axisLine: { lineStyle: { color: T.gridBorder } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: currentVariant === 'editorial' ? '#56635A' : '#A09E96',
        fontSize: 10.5,
        formatter: function(val) {
          const d = new Date(val);
          return String(d.getFullYear());
        }
      }
    },
    yAxis: {
      type: 'value', min: 0, max: 100, interval: 20,
      name: t.yName,
      nameTextStyle: { color: currentVariant === 'editorial' ? '#56635A' : '#A09E96', fontSize: 10.5, padding: [0, 0, 4, 0] },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: T.gridBorder, type: 'dashed' } },
      axisLabel: {
        color: currentVariant === 'editorial' ? '#56635A' : '#A09E96',
        fontSize: 10.5,
        formatter: function(val) { return val + '%'; }
      }
    },
    dataZoom: [
      sliderDZ,
      {
        type: 'inside', xAxisIndex: 0,
        start: focusWindow ? undefined : zoomStart,
        end: focusWindow ? undefined : 100,
        startValue: focusWindow ? focusWindow.startValue : undefined,
        endValue: focusWindow ? focusWindow.endValue : undefined,
        zoomOnMouseWheel: 'shift', moveOnMouseWheel: true
      }
    ],
    animation: true,
    animationDuration: 1100,
    animationDurationUpdate: 650,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    series: series
  };

  chart.setOption(option, true);
  lastSeries = series;
  try { refreshWindowLabels(zoomStart, 100); } catch (err) {}

  // 拖动底部滑块时：面板重建会让每一帧都重排，先压住，松手后再恢复
  chart.off('datazoom');
  chart.on('datazoom', (e) => {
    const dz = (e && e.batch && e.batch[0]) || e || {};
    if (typeof dz.start !== 'number') return;
    zoomStart = dz.start;
    zoomingUntil = Date.now() + 260;
    if (labelTimer) clearTimeout(labelTimer);
    // 松手后再刷：拖动过程中每帧重排名签反而卡
    labelTimer = setTimeout(() => {
      labelTimer = 0;
      try { refreshWindowLabels(dz.start, dz.end); } catch (err) {}
    }, 240);
  });

  // 鼠标交互：更新右侧深度面板
  chart.off('updateAxisPointer');
  chart.on('updateAxisPointer', (event) => {
    if (Date.now() < zoomingUntil) return;      // 拖动中不重建面板
    if (!event.axesInfo || !event.axesInfo[0]) return;
    const val = event.axesInfo[0].value;
    const cab = pmByDate(val);
    if (cab && cab.id !== activeHoverCab) {
      activeHoverCab = cab.id;
      if (panelRaf) return;
      panelRaf = requestAnimationFrame(() => {
        panelRaf = 0;
        if (activeHoverCab && Date.now() >= zoomingUntil) renderPanel(activeHoverCab);
      });
    }
  });

  chart.getZr().off('globalout');
  chart.getZr().on('globalout', () => {
    activeHoverCab = null;
    try { chart.dispatchAction({ type: 'hideTip' }); } catch (e) {}
    renderPanel(focusCabinet || null);
  });

  chart.off('click');
  chart.on('click', (params) => {
    if (params.seriesName) {
      const cab = rawData.cabinets.find(c => c.pm === params.seriesName);
      if (cab) {
        focusCabinet = (focusCabinet === cab.id) ? null : cab.id;
        renderPanel(focusCabinet);
        renderChart();
      }
    }
  });
}

async function boot(token) {
  try {
    await ensureEcharts();
  } catch (e) {
    const t = I18N[currentLang] || I18N.ja;
    console.error('echarts load failed', e);
    return null;
  }
  if (!rawData) {
    let lastErr = null;
    const dataList = cabForcedBase ? [cabForcedBase + 'app/cabinet/data.json'] : DATA_CANDIDATES;
    for (const u of dataList) {
      try {
        const resp = await fetch(u);
        if (!resp.ok) throw new Error('http ' + resp.status);
        rawData = await resp.json();
        lastErr = null;
        break;
      } catch (e) { lastErr = e; }
    }
    if (!rawData) {
      console.error('data.json load failed', lastErr);
      // hostEl 是 .stage-live，遮罩是它的兄弟节点：必须取 .stage 才能恢复 poster
      const stageEl = (hostEl && hostEl.closest ? hostEl.closest('.stage') : null) || document.querySelector('.stage');
      const tt = I18N[currentLang] || I18N.ja;
      try { if (window.pjStageFailed) window.pjStageFailed(stageEl, tt.loadFailed || 'Data failed to load. Please reload.', tt.reload || 'Reload'); } catch (e) {}
      return null;
    }
  }
  if (token !== bootToken || !mounted) return null;
  computeStats();
  renderZoomSeg();
  renderPanel(focusCabinet || null);
  renderChart();

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (hostEl) hostEl.classList.remove('cab-init-hidden');
        dismissVeil();
        setTimeout(() => {
          isInitialAnimating = false;
          if (chart) try { chart.resize(); } catch (e) {}
        }, 1250);
      });
    });
  } else {
    if (hostEl) hostEl.classList.remove('cab-init-hidden');
    dismissVeil();
  }
  return true;
}

function ensureEcharts() {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  if (g.echarts) return Promise.resolve(g.echarts);
  const viaImport = async () => {
    for (const u of ECHARTS_URLS) {
      try { await import(/* @vite-ignore */u); if (g.echarts) return g.echarts; } catch (e) {}
    }
    throw new Error('echarts import failed');
  };
  const viaScript = () => new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('echarts: no dom'));
    const libs = ECHARTS_URLS.slice();
    const next = () => {
      const u = libs.shift();
      if (!u) return reject(new Error('echarts CDN failed'));
      const s = document.createElement('script');
      s.src = u; s.async = true;
      s.onload = () => { if (g.echarts) resolve(g.echarts); else { try { s.remove(); } catch (e) {} next(); } };
      s.onerror = () => { try { s.remove(); } catch (e) {} next(); };
      document.head.appendChild(s);
    };
    next();
  });
  return viaImport().catch(viaScript);
}

function mountCabinet(root, opts) {
  opts = opts || {};
  if (opts.base) cabForcedBase = opts.base;
  if (mounted) unmountCabinet();
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  if (!host) throw new Error('cab: mount root missing');
  hostEl = host;
  host.classList.add('cab-host');
  host.classList.add('cab-init-hidden');
  isInitialAnimating = true;
  injectCss();

  const viewport = host.querySelector('#v-cabinet-viewport') || host.querySelector('.stage') || host;
  viewport.innerHTML = '';
  viewport.classList.add('cab-viewport');

  // 1. 图表容器
  const box = document.createElement('div');
  box.id = 'cab-chart';
  viewport.appendChild(box);

  // 2. 右侧深度信息面板（类似犯罪率右侧面板）
  const panel = document.createElement('div');
  panel.className = 'cab-panel';
  panel.id = 'cab-panel';
  viewport.appendChild(panel);
  panelEl = panel;

  // 3. 底部工具栏（左侧标签按钮，右侧 ECharts slider 自然贴合）
  const bottomBar = document.createElement('div');
  bottomBar.className = 'cab-bottom-bar';
  const zoom = document.createElement('div');
  zoom.className = 'cab-zoom';
  zoom.id = 'cab-zoom';
  bottomBar.appendChild(zoom);
  viewport.appendChild(bottomBar);
  zoomEl = zoom;

  currentLang = (opts.lang && I18N[opts.lang]) ? opts.lang : detectInitialLang();
  currentVariant = (opts.theme && THEME_MAP[opts.theme]) ? THEME_MAP[opts.theme] : detectInitialVariant();

  mounted = true;
  const token = ++bootToken;
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', onCabResize);
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => onCabResize());
    try { ro.observe(box); } catch (e) {}
  }
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => onCabResize());
  return boot(token);
}

let ro = null;

function unmountCabinet() {
  bootToken++;
  mounted = false;
  if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('resize', onCabResize);
  if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
  if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = null; }
  isInitialAnimating = false;
  if (chart) { try { chart.dispose(); } catch (e) {} chart = null; }
  if (hostEl) {
    try {
      const vp = hostEl.querySelector('.cab-viewport');
      if (vp) vp.innerHTML = '';
    } catch (e) {}
  }
  panelEl = null;
  zoomEl = null;
}

function setCabinetLang(lang) {
  if (!I18N[lang]) return false;
  currentLang = lang;
  if (!rawData) return true;
  renderZoomSeg();
  renderPanel(focusCabinet || null);
  renderChart();
  return true;
}

function setCabinetTheme(t) {
  const id = THEME_MAP[t] || 'tactical';
  currentVariant = id;
  if (chart && rawData) {
    computeStats();
    renderPanel(focusCabinet || null);
    renderChart();
  }
  return id;
}

function setCabinetRange(id) {
  if (!RANGE_WINDOW_MONTHS.hasOwnProperty(id)) return false;
  activeRange = id;
  focusCabinet = null;
  if (!rawData) return true;
  renderZoomSeg();
  renderPanel(null);
  renderChart();
  return true;
}

function getCabinetSummary() {
  return rawData ? { cabinets: rawData.cabinets.length, polls: rawData.polls.length } : null;
}

export { mountCabinet, unmountCabinet, setCabinetLang, setCabinetTheme, setCabinetRange, getCabinetSummary };
