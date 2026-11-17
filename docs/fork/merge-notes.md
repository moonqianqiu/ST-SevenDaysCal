# 合并上游实录与索引（构画 Moon 定制版）

> **产权**：本文件为 fork 本地文档（上游无此文件），存放于 `docs/fork/`。
> **用途**：本文＝**合并实录索引的唯一存放处**（卷首版本索引表全历史一览）。SDC 的逐版本裁决细节历史上沉淀于根 `AGENTS.md` 的 git 历史（`git log -p AGENTS.md` 按版本回查，`git show <合并提交>` 看上游能力摘要）——回查旧版本仍走该途径；**新合并的实录从这里开始写**（新版本节 + 索引加行）。当前契约见 [`fork-contracts.md`](./fork-contracts.md)；流程与判定法见 [`merge-playbook.md`](./merge-playbook.md)；门禁与当前状态见根 [`AGENTS.md`](../../AGENTS.md)。
> **旧编号解析**：历史材料中残留的 `AGENTS §N` 式旧编号按 [`fork-contracts.md`](./fork-contracts.md) 卷首对照表解析。

## 0. 合并索引总表（原 AGENTS.md §6.1，全历史一览）

| 上游版本 | 日期 | 合并提交 | 冲突与裁决要点 | 当期全量 |
| :--- | :--- | :--- | :--- | :--- |
| v3.7.12 | — | `7021114` | 本文件自 `memory.md` 更名 `AGENTS.md`；sourcePolicy/validL1Entries/确认式落盘等记忆语义更新 | — |
| v3.7.13 | — | `3145766` | 唯一 manifest 冲突；千千结召回语义变更 → 本地适配 4 例断言（上游自带 4 例红） | 148 |
| v3.7.14 | — | `31310a3` | 唯一 manifest 冲突；人物卡提名、移除构画自设 token 上限、面内空摘要回退最近 6 楼；资产域零字节变化 | 152 |
| v3.7.15 | — | `652fb95` | 唯一 manifest 冲突；剧情创作偏好/panel-failure/deadline/诊断链；save-transaction 引作者机器路径 → vendor fast-json-patch（产权 12→14） | 201 |
| v3.7.16 | — | `ed85bdc` | 唯一 manifest 冲突；TT metadata-only saver、Ticket 编号分类；上游仍缺 fast-json-patch，本地适配存活 | 208 |
| v3.8.0 | 10-05 | `29bc7e7` | 5 冲突；`_callApi` 并集规则沉淀；上游 Windows 红测试适配；回收 fast-json-patch shim（产权 14→13）；`spAdditionalParams` 新增修复 MK 跨仓红 | 203 |
| v3.8.2 | 10-06 | `c001d45` | 唯一 manifest 冲突，48 文件自动合并；narrativePace / 事件制门票 / daily-menu | 227 |
| v3.8.3 | 10-07 | `1739c19` | 唯一 manifest 冲突；上游改大纲合同文案未同步自带 2 红测试（纯上游树复现），断言随上游新文案适配、语义不变 | 245 |
| v3.8.5 | 10-11 | `4a7e09a` | gzip codec + Quick Reply 接入；保留四模式清洗器、通用包裹规则、标签设置校验及 jobSignal finally 清理；保留 Windows loader 适配 | 258/259（1 宿主测试跳过） |
| v3.9.0 | 10-15 | `dc05fe9` | 7 文件冲突：index.js 保本地文案；memory.js 保本地+补 normalizeTagRules import；narrative 两测试**取上游**（本地旧版 import 已删除函数）；context.test 取上游+本地 2 例；删 2 例上游过时用例（纯上游同红） | 306/308（1 EPERM 伪红）/1 skip |
| v3.9.4 | 10-20 | `b3da109` | 6 文件冲突/10 块：settings keepTags 取 M0；tag-names 取本地泛化（上游正则无外部引用）；memory.js 整体取本地；index.js 文案+DRAFT 举例；test/tag-sanitizer 9 例按 moon 合同适配；2 处自动合并静默保留过时适配（判据见 merge-playbook §6） | 353/355（1 EPERM）/1 skip |
| v3.9.5+v3.9.6 | 10-24 | `8222038` | 6 文件冲突/16 块：共享包裹符容器采纳；tag-names/memory.js/index.js 保本地并嫁接上游管线；test/tag-sanitizer 6 段按 moon 合同适配。上游原生红 1 例：narrative-preferences「semantic-route applies…」纯上游同败，保留不修 | 409/411（1 上游原生）/1 skip |
| v3.10.0+v3.10.1 | 10-25 | `fa0572f` | 3 冲突：manifest→`3.10.1moon`+js→`gouhua-app.js`；settings.js 三处并集；index.js 采上游 HTML、本仓三参 bindTagField 保留；rolldown 构建整套采纳。代修 2 处。上游原生红 3 例（纯上游同红） | 451/455（3 上游原生）/1 skip |
| v3.10.2 | 10-27 | `3449f33` | 4 冲突：bundle 重建（49 hunk）、manifest→`3.10.2moon`、store-local-applied 保 `fileURLToPath` 并删上游已移除夹具、AGENTS 采上游 3 条新契约并删 `read-local-diagnostics` 条款。存储迁移无本地产权交集，纯上游直通。上游原生红 3 例同集合（dish-CAS 用例已更名） | 458/454（3 上游原生）/1 skip |
| v4.0.0+v4.0.1 | 10-31 | `b607e24` | 7 冲突：qianqianjie/context/index-chat-boundary 三测试整取上游（本地适配被上游吸收，差异清单 18→16）；index.js 上游 sp-prompt-body 结构 + 本地三句文案；tag-sanitizer 测试上游终止标记/掩码桩 + 保本仓 stripTags 直连导入；manifest→`4.0.1moon`；bundle 重建。classifySpaceIntent 被掏空 → 本地 2 例意图断言退役；dish-CAS 代修 `pathToFileURL`；旧 3 红 → 剩 1 上游原生（刻度刷新，单跑绿） | 502/500（1 上游原生）/1 skip |
| v4.0.2 | 10-31 | `11b4358` | 2 冲突（预判全中）：manifest→`4.0.2moon`、bundle 重建；index.js 账本自动化区自动合并（上游重摇防重复计数，无本地产权交集）；新测试 20 例整取上游；旧基线红不变（单跑仍 2/2 绿） | 522/520（1 上游原生）/1 skip |
| v4.1.0+v4.1.1 | 11-01 | `dce0dfa` | 2 冲突（预判全中）：manifest→`4.1.1moon`、bundle 重建；QQJ 取材改按当前问题读已存剧情（整取上游）、story-clock 统一时间戳解析直通——均无本地产权交集，moon 三句与三参 bindTagField 核对在位 | 536/534（1 上游原生）/1 skip |
| v4.1.2+v4.1.3 | 11-03 | `8c56433` | 2 冲突（预判全中）：manifest→`4.1.3moon`、bundle 重建（34 hunk）；action-menu 新模块直通 | 542/540（1 上游原生）/1 skip |
| v4.1.4 | 11-07 | `3fec748` | 2 冲突（预判全中）：manifest→`4.1.4moon`、bundle 重建；user-name-mask 局部刷新直通 | 545/543（1 上游原生）/1 skip |
| v4.1.5 | 11-08 | `9864eac` | 2 冲突（预判全中）：manifest→`4.1.5moon`、bundle 重建；GPT 推理模型参数兼容直通 | 597/595（1 上游原生）/1 skip |
| v4.1.6+v4.1.7 | 11-09 | `30ff186` | 2 冲突（预判全中）：manifest→`4.1.7moon`、bundle 重建；RESPONSE_STYLE_GUIDE 表达规则直通、视口面板布局（新 ui/panel-window.js）与故事日期精修均无本地产权交集 | 617/615（1 上游原生）/1 skip |
| v4.1.8~v4.2.0 | 11-13 | `a04995d` | 2 冲突：manifest、bundle；移动几何/记忆上下文直通，定制资产保留 | 642/640+1上游红+1skip |
| v4.2.1~v4.2.3 | 11-17 | `48ed1e7` | 3 冲突：fork AGENTS 骨架、manifest `4.2.3moon`、bundle 重建；Shadow DOM/窗口诊断直通，jobSignal 保留 | 721/717+1时序红+2 EPERM+1skip |

---

## 维护约定

- 新合并详情写本文件新版本节（§0 之后按版本追加）+ 卷首索引表加一行（≤120 字符）；逐版本裁决细节历史仍可 `git log -p AGENTS.md` 回查。
- 契约改动写 [`fork-contracts.md`](./fork-contracts.md) 对应条目；上游 AGENTS.md 新内容更新 [`upstream-agent-contract.md`](./upstream-agent-contract.md)；根 `AGENTS.md` 状态块只原地更新当前值，**禁止追加历史叙述**。

## v4.2.1~v4.2.3（2026-11-17，合并提交 `48ed1e7`）

上游 `3d1406b` 汇总 v4.2.1 至 v4.2.3。三处冲突按既有规则处理：根 `AGENTS.md` 保留 moon 治理骨架并补 BUILD/Shadow DOM 导航；manifest 版本改为 `4.2.3moon`，JS 使用本地源码重建后的真实哈希；`gouhua-app.js` 不手解压缩冲突，直接由 Rolldown 1.2.6 重建。

上游改动主要覆盖楼内内容、魔杖与收藏入口的 Shadow DOM 隔离，iPhone Safari/Fx 文本编辑几何修正，窗口诊断工具，以及轴、点、间、坐标和便携聊天数据的增量修复。旧调试会话与交接文档按上游清理，新的 `docs/shadow-dom.md` 成为状态入口。

`memory.js` 上游未触碰，本地 `_jobSignalDisposes` WeakMap、`runL0`/`runL1` 提升 signal 与 `finally disposeJobSignal` 闭环完整保留，并已进入重建 bundle。清洗器金样与千千结逐字节同 SHA。全量 721 项：717 通过；`ledger/ui-refresh` 首轮时序失败但单跑 2/2 通过；`menu-image-store` 与 `store-local-applied` 的测试内部显式 spawn 被沙箱 `EPERM` 拒绝；另 1 项宿主依赖 skip。bundle SHA-256 `ca4a7c2eeb63224af30966e4c45f3a3dbceffc551bcffb41ea9cf21c9ac7e556`，CSS SHA 与上游一致。
