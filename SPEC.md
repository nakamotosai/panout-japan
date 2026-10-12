# SPEC · M0 聚合门面（当前 milestone）

## 目标

`japan.ouuut.com` 首版上线：一个静态聚合门面，四板块（地震 / 犯罪率 / 内阁支持率 / 新闻预告）+ 三站跳转。用户打开能一眼看到"日本本土信息在这"，点进去到各老站。

## 范围

- 首页：品牌头（Pan Out Japan + pan out 一句话解释）+ 四板块卡 + 页脚（© + 联系 + 数据来源）。
- 三语 `ja / zh-CN / en`，结构严格同步。
- 三跳转外链现有老站：`https://3d.saaaai.com/` / `https://crime.saaaai.com/` / `https://japan.saaaai.com/`。
- 新闻板块首版只放预告（"News Pan 开发中"），不做聚合。

## 非目标

- 不迁老站代码（M1 才做）；不动老站部署与域名。
- 不做新闻聚合产线（M2 才做）。
- 不做账号/订阅/搜索。

## 验收条件

1. `https://japan.ouuut.com/` 首页 200，三语可切换。
2. 三跳转点达且为老站现行 URL。
3. 桌面 1440 + 手机 390 实测：零横向溢出、控制台零 error。
4. MASTER-CHECKLIST 的 A1–A7 全过（否则阻断发布）。
