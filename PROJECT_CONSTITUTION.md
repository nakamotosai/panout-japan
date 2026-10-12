# Pan Out Japan Constitution

## Core Principles

### P1. Reader / User Reality

- 所有对外可见内容先服务真实读者或真实用户，不服务编辑过程
- 前台文案禁止出现系统指令腔、结构腔、流程腔
- 不懂日本文化的读者也能一眼看懂：pan 出梗处必须配一句人话解释

### P2. Spec Before Implementation

- 任何中等及以上改动先落到当前 milestone 的 `SPEC.md / PLAN.md`
- 没有当前 milestone execution bundle，不进入实现

### P3. README As Current Truth

- 根 `README.md` 是唯一当前执行状态真相源
- 不得让 README、TRACK_TREE、当前任务页同时维护同一类状态

### P4. Verification Before Completion

- 没有验证，不算完成（线上实测为准：三语 × 桌面/手机 + 零 console error）
- 老站（3d/crime/japan.saaaai.com）保持在线做回滚锚，不提前摘线

### P5. Version / Cutover Discipline

- 新站建独立 CF Pages 项目验收，并跑后再切 `japan.ouuut.com` CNAME
- 老站保留到新站稳定，不删数据、不改老部署

## Project Constraints

- 静态站优先（聚合门面 + 三站跳转，首版零后端）
- 三语 `ja / zh-CN / en`（ouuut 家族惯例，复用 ouuut-v2 的 i18n 做法）
- 设计跟 ouuut 品牌走（Tokyo Expedition Magazine Editorial，改前先读 design-lock.json）
- 数据口径以各老站为准，本项目不重算、不编造

## Workflow Rules

- 默认顺序：`spec -> plan -> implement -> verify`
- 默认一次只推进一个 active milestone
- 并发只允许在当前 milestone 内写入范围不冲突的任务发生

## Governance

- 本文件高于项目内临时做法
- 修改本文件时，必须同时更新受影响的 milestone 或 README 口径
- 版本信息：
  - `Version: 1.0`
  - `Ratified: 2026-10-12`
  - `Last Amended: 2026-10-12`
