# MASTER-CHECKLIST · panout-japan（网站类：部署上线阶段按 website-launch-checklist 展开）

> 正本：`sai-long-project/references/website-launch-checklist.md`（10 组 59 项）。M0 为纯静态聚合门面，
> 无后端/账号/支付项标 N/A；`A1–A7` 任一不过即阻断发布。

## A. 抓取与索引（阻断级）

- [ ] **A1** robots.txt 生产放行 + Sitemap 声明 + AI 爬虫策略
- [ ] **A2** sitemap.xml 只收 canonical、lastmod 真实
- [ ] **A3** canonical 自指 + 全站统一
- [ ] **A4** hreflang 多语言闭环（ja / zh-CN / en + x-default，三语站必须做）
- [ ] **A5** title / description 全站唯一可点击（三语各一套）
- [ ] **A6** H1 每页唯一、层级不断
- [ ] **A7** noindex 残留清零

## B. GEO / AI 搜索（高权 B1/B2）

- [ ] **B1** llms.txt（低成本做、不神化）
- [ ] **B2** JSON-LD Organization + WebSite
- [ ] **B3** JSON-LD 内容型按模板挂载（M0 门面无文章，N/A 或只挂 WebSite）
- [ ] **B4** 站内 FAQ 内容块（"这是什么数据/多久更新/口径是什么"）

## C. 社交传播（高权 C1/C2）

- [ ] **C1** OG 标签完整（服务端直出，1200×630）
- [ ] **C2** Twitter/X Card
- [ ] **C3** 全平台预览实测（M0 首发做一遍）
- [ ] **C4** 分享文案 + UTM 绑定（M0 可 N/A，有分享按钮才做）

## D. 数据统计与增长

- [ ] **D1** 访问统计选型落地（Plausible/Umami 优先）
- [ ] **D2** 事件埋点与追踪计划（M0 三跳转各埋一个）
- [ ] **D3** Search Console + Bing 验证
- [ ] **D4** PWA 可安装性（M0 纯静态门面：N/A，M1 再议）
- [ ] **D5** 订阅/留存触点（RSS：M0 N/A，M2 新闻聚合时做）

## E. 性能（高权 E8）

- [ ] **E1** 图片现代格式 + 响应式 + 显式尺寸
- [ ] **E2** CJK 字库子集化（禁整包 Noto 上线）
- [ ] **E3** JS 体积与长任务（M0 极简 JS，核对即可）
- [ ] **E4** LCP 元素可被预扫描器发现
- [ ] **E5** CLS 预留空间
- [ ] **E6** 缓存策略（哈希产物 immutable + HTML 短 TTL）
- [ ] **E7** 发布必 purge CDN、校验必 cache-bust
- [ ] **E8** 发布前跑 Lighthouse（移动端）记基线

## F. 安全

- [ ] **F1** 全站 HTTPS + 强制跳转 + HSTS（子域全 HTTPS 后再加 includeSubDomains）
- [ ] **F2** 混合内容清零
- [ ] **F3** 安全响应头基线
- [ ] **F4** CSP 先 Report-Only 再强制（M0 静态站可直接收紧）
- [ ] **F5** 依赖漏洞与供应链（lockfile + audit）
- [ ] **F6** 泄漏面自查（.env/secrets 未进仓、关 source map）

## G. 可靠性（高权 G3）

- [ ] **G1** 备份 3-2-1（静态站：仓 + .deploy 快照，RPO/RTO 写下）
- [ ] **G2** 恢复演练（M0：从仓重建一次即算）
- [ ] **G3** 外部可用性监控（首页探针 + TLS 告警，进看门狗）
- [ ] **G4** 错误日志与轮转（静态站：CDN 日志 + 前端 Sentry 视需要）
- [ ] **G5** 上线前彩排 + 回滚路径（staging 走一遍 + DNS 降 TTL + 回滚<5min）
- [ ] **G6** 域名/证书/账号续费（ouuut.com 到期日查一次写下）

## H. 合规 / 无障碍（高权 H1–H4）

- [ ] **H1** 键盘完全可达、无陷阱
- [ ] **H2** 焦点指示清晰
- [ ] **H3** 对比度达标（正文 ≥4.5:1）
- [ ] **H4** 动效可减弱、无闪光风险
- [ ] **H5** 隐私政策与条款（M0 无统计无表单可简化，但有用统计就必须有）
- [ ] **H6** 数据来源与许可可查（地震 USGS / 犯罪率警视庁 / 支持率 NHK + 各许可）
- [ ] **H7** 敏感内容免责与时效（数据标更新日期）
- [ ] **H8** 联系方式可用（页脚 + 404 回首页）

## I. 多语言 / 移动端

- [ ] **I1** 语言探测优先级固定（?lang= > localStorage > navigator > 默认）
- [ ] **I2** hreflang 双向回链 + x-default（同 A4）
- [ ] **I3** 字典完整性与残留门禁（缺键阻断）
- [ ] **I4** 移动端视口与断点（360/390/768/桌面，overflow=0）
- [ ] **I5** 触摸目标 ≥44px 与抽屉导航

## J. 发布流程与发布后

- [ ] **J1** 发布前快照备份（发布命令落 AGENTS.md 发布节）
- [ ] **J2** 一键回滚与灰度（<5 分钟，演练计时）
- [ ] **J3** URL 与状态码（404 真 404 + 回首页）
- [ ] **J4** 发布后冒烟验证（固化成脚本，结果贴 progress）
- [ ] **J5** 变更日志落盘
- [ ] **J6** 发布后监控（24h + 首周）
