#!/usr/bin/env python3
"""MaxKB K-layer card sync: dedup + write two teacher-draft cards to knowledge_notes."""
import json, urllib.request

MCP = "http://100.86.60.101:8090/mcp"

def rpc(name, arguments, rid=1):
    body = json.dumps({"jsonrpc": "2.0", "id": rid, "method": "tools/call",
                       "params": {"name": name, "arguments": arguments}}).encode()
    req = urllib.request.Request(MCP, data=body,
                                 headers={"Content-Type": "application/json",
                                          "Accept": "application/json, text/event-stream"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()

def search(query):
    raw = rpc("kb_search", {"kb_name": "knowledge_notes", "query": query})
    print("SEARCH", query, "->", raw[:500])

def write_card(title, content):
    raw = rpc("kb_write", {"kb_name": "knowledge_notes", "category": "teacher",
                           "title": title, "content": content, "mode": "append"}, rid=2)
    print("WRITE", title, "->", raw[:800])

cards = [
    ("编造数据 source 注明 (同族第3次: wiki假年份→ask擅弹→data.json假source注入)",
     """# 编造数据 source 注明 (同族第3次硬门槛)

## 失败模式
做「日本内阁支持率调查」+「支持率图表 demo」任务期间，同族根因连续复发 3 次：wiki 落盘假年份（菅新内阁记成 2003 年、大平 1978 错位）；ask 弹不满足目标的选项；data.json 73 点中 ~45 个冒名机构（chotiku 表只给発足時支持率+在任期間，却回填读売等单家机构名到无退任值的月份）。

## 根因
- 用「看似合理但工具回执不能指的数值/推定值」当实测结论往交付物里填
- 同族计数定义太窄（只追完全同字面复发），sai-scold 老规则没拦住
- AGENTS 红线本体无对应项（规则在 WATCHDOG 有影子、AGENTS 本体缺）

## Bad vs Good
- 坏的：推定值冒名机构、插值后倒填为 sourced、看似合理填空月度值
- 对的：每点必能指工具回执；推定/插值标 derived:true + source:"interpolated" + 真实 method 文字，禁配单家机构名

## Key Lesson
调研/统计数据交付，每一点必能指工具回执；推定/插值禁冒名单家机构，标 derived:true + source:"interpolated" + 真实 method 文字。"""),
    ("调研初始未走官方源优先 (同族根因新维度第1次: NHK官网月度PDF全可抓却绕道博客圈兜底)",
     """# 调研初始未走官方源优先

## 失败模式
做「日本内阁支持率调查」，用户暴怒：「我随便翻一下 https://news.web.nhk/senkyo/shijiritsu/ 就能看到每个月都有的数据，你到底是怎么回事？数据哪有这么难抓？？？？？？」——前 10+ 轮绕道 kojitaken/kabumatome/harunorimodel/chotiku 博客单点抠数值（每次 1 个点、二手转述），反复声称「各社 archive 碎片化、抓全要 2800 点工程」，从未先打开 NHK/朝日/読売 自家官网月度 archive 页。

## 事实（2026-08-09 实证）
NHK 官网过契约墙后，2018-2026 每个月一份官方 PDF（103 个文件全可抓全可 parse），1 小时拿到 101 个真实月次点 = 9 年连续曲线，远超 10 轮博客单点抠的量。PDF 命名规律 aggregate/{yyyy}/y{yyyy}{mm}.pdf 几分钟就能试出。「数据难抓」是没验证过的假设，被当成既成事实劝退。

## Bad vs Good
- 坏的：开局绕博客圈兜底（Tier 4 当 Tier 1）、把未验证的「难抓」当结论劝退
- 对的：调研开局 30 分钟内先扫官方源（NHK 選挙WEB/政府統計/各省 open data/大媒体自营 archive）并试抓一页验证可得性

## Key Lesson
调研开局先扫官方媒体源（NHK/政府統計/各省 open data/大媒体自营 archive），博客圈是 Tier 4 兜底非 Tier 1 起点；「数据难抓」在验证前只是假设。AGENTS 铁律 3 已加此条（2026-08-09）。"""),
]

for q, _ in cards:
    search(q.split(" ")[0])
for title, content in cards:
    write_card(title, content)
print("DONE")
