# Fork 定制契约（逐文件回植清单）

> **产权**：本文件为 fork 本地文档（上游无此文件），存放于 `docs/fork/`。
> **回答的问题**：每个文件为什么与上游不一样、上游重写时按什么回植、哪些东西已被主动放弃勿补回。
> **分工**：合并流程与判定法见 [`merge-playbook.md`](./merge-playbook.md)；上游自身 Agent 合同收录见 [`upstream-agent-contract.md`](./upstream-agent-contract.md)；逐版本索引见 [`merge-notes.md`](./merge-notes.md)；门禁命令见根 [`AGENTS.md`](../../AGENTS.md)。本文件只描述「现在为什么长这样」，不写叙事。
> **跨仓同步标记**：§3.1 清洗器契约与 ST-MyriadKnots 对应节（`docs/fork/fork-contracts.md` §3.1）于 v4.2.0（2026-11-15）对齐；40 例金样两仓逐字节一致，任何措辞或语义改动**须双仓同步提交**。
> **最后核对**：2026-11-15（v4.2.0moon）。

## 旧编号对照表（代码注释里遗留的 `AGENTS §N` 已按此改写）

| 旧 AGENTS 编号 | 新位置 |
| :--- | :--- |
| §1 同步与版本惯例 | merge-playbook §1 / §2 |
| §2 冲突热区表 | merge-playbook §3（契约细节在本文件一） |
| §2.1 上游发布质量已知模式 | merge-playbook §4 |
| §3.1~§3.4 核心定制资产 | 本文件 §3.1~§3.4（编号不变） |
| §4 已主动放弃 | 本文件「三、已主动放弃、勿回植速查」 |
| §5 门禁 | AGENTS「门禁」；判定法/测试环境须知/差异清单在 merge-playbook §4~§7 |
| §6 底数与索引 | AGENTS「当前状态」+ merge-notes 卷首索引表 |
| 末节「上游保存与返回约定」 | [`upstream-agent-contract.md`](./upstream-agent-contract.md) |

---

## 一、逐文件回植契约（上游重写对应链路时，以本地增强为产权逐项回植并重跑对应测试全绿）

### `memory.js`

- **`stripTags` 保持由 `runtime/tag-sanitizer.js` import + re-export**，严禁退回上游内联旧正则（清洗器合同见 3.1）。
- **两处 `_callApi` 取并集**——本地提升 `signal`（`finally disposeJobSignal` 闭环，见 3.2）+ 上游 `diagnostic.sink`/`diagnostic.accepted()`，**不可取上游内联 `jobSignal()`**，否则 dispose 落空/悬空。
- 上游新特性照常吸收并逐段复核；jobSignal 闭环在 v3.7.12 重写 runL1 签名、v3.8.0 接线诊断作用域后均已重新落在新请求路径上并复核——上游再动这两个函数时必须重新套用（见 3.2）。

### `utils/tag-names.js`（本地产权文件）

**本地泛化保留**：`literalWrapperRule` 三条件与 `normalizeTagRules` 对包裹规则「原样保留、大小写敏感」的语义（自 ST-MyriadKnots P5 同步）逐字保留；仅吸收上游对标签名字符合同的改动。**v3.9.1 起上游新增命名中括号 `[name]...[/name]`（`PAIRED_BRACKET_RULE_RE`）并附带三项差异，一律不采纳**：① 规则名 lower 归一（本地原样保留）；② 定界符大小写不敏感（本地大小写敏感）；③ 要求 name 为合法标签名（本地接受任意「起始...结束」）。本地导出面是上游的严格超集、上游该正则无外部引用，故取本地不丢能力；`test/tag-sanitizer.test.mjs` 已按本地合同适配。**v3.9.5 起上游把 `normalizeTagRules` 改为 `utils/shared-body-wrappers.js` 的重导出（`normalizeWrapperRules`，含上述三项差异）——继续保本地实现，不采重导出**；上游 `utils/shared-body-wrappers.js` 文件本身照收（MK 上游 `settings-api` 测试跨仓引用本仓该文件，两仓上游 blob 逐字一致，**本仓不得改动它**）。

### 共享包裹符容器（`index.js` + `runtime/settings.js`，v3.9.5 起上游引入）

`extension_settings['schedule-planner'].bodyWrappers`，`getWrapperSettings`/`updateWrapperSettings` API，全读链已切换。**采上游管线、挂本地语义**：① 读链 `getWrapperSettings()`（= `getSharedBodyWrappers`）全采纳；② **`updateWrapperSettings` 本地覆写**（`runtime/settings.js`）——写入用本仓 `normalizeTagRules`（大小写敏感），不得用 `updateSharedBodyWrappers`（会按上游规则 lower 归一命名对，破坏 3.1 合同）；③ **`getSettings()` 中 `getWrapperSettings()` 初始化调用必须在本地默认值回填之后**——全新安装时共享容器 merge 只认已存在的键，先初始化会落到上游回退值 `keepTags:'content'` 丢失 M0（见 3.3）；④ `index.js` 面板采上游 `refreshWrapperInputs`/blur 刷新管线 + 本地三句文案与 `bindTagField` 两栏冲突拦截（拦截读/回退走 `getWrapperSettings()`，不用面板快照）。上游 v3.9.5 新增「HTML 注释对作包裹定界符」能力**不采纳**：本仓注释属 M0 卫生清理（始终剥除、不充当定界符，与 MK 跨仓一致），期望已按本仓合同适配留痕。

### `runtime/store-local-applied.test.js`

本地 Windows 适配（`pathToFileURL(loader).href` / `fileURLToPath` 替代 POSIX 的裸路径 loader 与 `new URL(...).pathname`）**不可回退**；吸收上游新增测试代码，新代码先查 POSIX 专属写法（merge-playbook §4③）。

### `runtime/chat-storage.js` / `store.js` / `index.js`（v3.10.2 存储迁移）

上游把业务根从白鳥外置改为 `chat_metadata` 四根（`sp-store`/`sp-memory`/`sp-theater`/`sp-ledger`）。**纯上游产权，本地无交集，整体直通**（本仓从未改 `external-chat-storage` 链路）。三条红线：① `store.js` 的 `local-applied` 立即返回语义（先应用 live 内容再 `saveMetadata()`、不等 ACK）**不得**因迁回 `saveChat` 而变成等待式；② `index.js` 面板本地三处文案与三参 `bindTagField` 冲突拦截须在自动合并后复核在位；③ `prepareNormalChatStoreForSave` 只在普通保存前编码诊断，**不得**被用作普通 metadata 的保存门槛（等同旧「勿把 CAS 扩展成 metadata 门槛」）。

### `runtime/store-codec.js` / `runtime/quick-reply-shortcuts.js`

上游新增能力正常吸收；codec 不得静默覆盖损坏/未来版本 wrapper，Quick Reply 只改构画自有组，不得改用户其他组或宿主总开关。

## 二、核心定制资产（Fork 存在的价值，合并时逐项复核）

### 3.1 四模式标签清洗器（`runtime/tag-sanitizer.js`）

- **核心架构**：树形单遍解析（`parseSanitizerTree`），节点记录 `openRaw`/`closeRaw`，支持 M0/M1 逐字节保真复现；`memory.js` 仅重导出 `stripTags`。
- **核心合同**：
  - **M0（两栏皆空）**：直通不清洗，保留正文，仅做注释/孤立标记清理与折空行；
  - **M1（仅 extra）**：成对删除 extra 标签及内容；未闭合 extra 吞至最后同名闭合或 EOF（噪音不泄漏）；
  - **M2（仅 keep）**：剥壳保留 keep 块内容（内部不再二次清洗，嵌套子标签原样保留），块外裸文本丢弃；
  - **M3（混合）**：extra 恒优先，无论在外层、包裹 keep 还是嵌在 keep 子树内一律整块剔除；同名 keep/extra 按 extra 优先；
  - **三分支 token 正则**：`TAG_ATTR_SOURCE`（引号感知，值内 `>` 不截断）+ `TAG_ATTR_FALLBACK_SOURCE`（未闭合引号宽松兜底，防思维链泄漏）+ 每条配置的字面量包裹规则各一分支（`freshTokenRx(wrapperRules)` 动态生成，`[[...]]` 只是特例）；
  - **自闭合标记**：keep 子树内自闭合 extra 标记连标记删除，非 extra 保留 `openRaw`。
- **金样锁定**：`runtime/tag-sanitizer.golden.json`（40 组金样）绝对锁定；与兄弟仓库 `ST-MyriadKnots` 的 `src/tag-sanitizer.golden.json` 保持 100% 逐字节一致（两仓对拍 0 差异，每次合并后复验）。

### 3.2 `_jobSignalDisposes` 监听器防泄漏闭环（`memory.js`）

- **上游缺陷背景**：绑定 relay 监听器的 `{ once: true }` 仅在 abort 时生效；正常成功完成的请求 abort 永不触发，监听器永久残留在长生命周期的 `_jobAbortController.signal` 上，批量重构/长对话下内存持续泄漏。
- **本地治本实现**：`const _jobSignalDisposes = new WeakMap();` 记录双向清理函数；`disposeJobSignal(signal)` 定义后，在 `runL0` 与 `runL1` 的 `_callApi(...)` 外包裹 `try ... finally { disposeJobSignal(signal); }`，无论成功失败零监听器残留。**必须誓死保住；上游再动这两个函数时必须重新套用**（v3.7.12 重写 runL1 签名、v3.8.0 接线诊断作用域后均已重新落在新请求路径上并复核）。

### 3.3 标签清洗设置项与 UI 保存校验

- **默认值保护 (`runtime/settings.js`)**：`keepTags` 默认值必须为 `''`（两栏皆空 = 不清洗；全库严禁残留 `keepTags: 'content'` 默认）。
- **设置面板与保存拦截器 (`index.js`)**：面板文案必须包含 `两栏都留空＝不清洗`、`只配此栏即只留各 keep 块的内部内容`、`可穿透进 keep 块内部`；`bindTagField` 保存校验——两栏配置同名标签时失焦自动求归一化交集（标签名与字面量包裹规则一并参与，含 `[[...]]`、`{{...}}`），命中时**拒绝落存、输入框回退旧值**并 `showToast(..., true)` 报错，从源头杜绝非法配置存盘。

### 3.4 本地专属 / 适配测试文件

- `memory.sanitizer.test.js`：清洗器 40 例金样逐字节比对 + 四模式语义探针（含通用包裹规则 4 例，自 ST-MyriadKnots P5 同步）；
- `business/space/context.test.js`：**v4.0.1 起与上游逐字一致**。本地 2 例意图断言（问候→discuss、显式生成→write+kind/clarify）已随 v4.0.0 退役——上游把 `classifySpaceIntent` 掏空为无参常量桩（恒返 `semantic-route`），意图路由整体移交 LLM 语义路由，v3.9.x 时代「签名与语义持续兼容」前提失效；「问候不触发生成」的测试意图由上游语义路由承接，**勿按旧例回植**；
- `business/memory/qianqianjie.test.js`：**v4.0.1 起与上游逐字一致**——「千千结记忆读取失败：」前缀断言已获上游原生采纳（并新增 `qianQianJieMemoryDiagnostic` 导出），本地适配版被吸收退场。后续合并若上游再触碰该文件，仍先核对 `qianqianjie.js` 实现语义再吸收，勿盲目任取一侧。

## 三、已主动放弃、勿回植速查

> 以下能力已**有意**采上游设计或删除；再见到相关 diff 属预期，勿当「本地资产丢失」补回。

| 放弃项 | 裁决 | 详情 |
| :--- | :--- | :--- |
| 间·意图识别（解释性提问判 discuss 的早期本地实现） | v3.6.5 整体取上游版本放弃（上游已有更完善正则）；`business/space/context.js` 保持与上游逐字节一致，切勿反向修改 | 3.4 |
| v4.0.1 三个历史适配测试退出差异清单 | `qianqianjie.test.js`（前缀断言获上游采纳）、`context.test.js`（2 例意图断言随 classifySpaceIntent 掏空退役）、`test/index-chat-memory.test.mjs`（上游重写为 readMemory 端口用例并自带桩，本地删例与 M0 stub 均被吸收）；`test/memory-source-production.test.mjs` 同类删除已由上游 v3.10.2 完成 | 3.4；merge-playbook §7 |
| v3.10.2 随上游删除的外置存储链路 | `runtime/local-diagnostics.js`、`runtime/local-diagnostics.test.js`、`tools/read-local-diagnostics.mjs`、`runtime/external-chat-storage.js`、`runtime/external-chat-host-bridge.js` 已随上游存储迁移删除，勿当成本地丢失补回 | 一、chat-storage 条 |
| narrative 两测试本地旧版 | `business/narrative-pace.test.js`、`business/narrative-preferences.test.js` 一律取上游（上游删除了 `import { buildCreativeChatSystemPrompt } from '../state.js'`，该函数在 v3.9.0 树中已不存在，保留本地旧版必 import 失败） | merge-playbook §7 |
| 上游命名中括号 `[name]...[/name]` 三项差异 | 一律不采纳（本地导出面为上游严格超集） | 一、tag-names 条 |
| 上游「HTML 注释对作包裹定界符」 | 不采纳（本仓注释属 M0 卫生清理） | 一、共享包裹符容器条 |
| 上游 `normalizeTagRules` 重导出（v3.9.5） | 继续保本地实现，不采重导出 | 一、tag-names 条 |
