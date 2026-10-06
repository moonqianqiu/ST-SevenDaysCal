# 构画 · Moon 定制版 — Agent 项目指南

本仓库是 [`atonal519/ST-SevenDaysCal`](https://github.com/atonal519/ST-SevenDaysCal) 的 fork（作者 moon 定制版），在 `master` 分支上跟踪上游最新基线，并叠加了“moon”专属改动。`origin = moonqianqiu/ST-SevenDaysCal`，`upstream = atonal519/ST-SevenDaysCal`。

> **用途**：供后续会话/开发者在执行“合并上游”、“冲突裁决”、“代码维护”时，迅速掌握本 fork 的核心定制、版本惯例、冲突裁决规则以及架构设计决策，确保合并上游时不丢弃本地核心资产。
> **更名说明**：本文件原名 `memory.md`，自 `3.7.12moon` 起更名为 `AGENTS.md`（曾短暂命名 `AGENT.md`），内容定位不变。

---

## 1. 同步与版本惯例

1. **版本号命名规范 (`manifest.json`)**：
   - 格式强制规范：`version` = 上游版本号 + `moon` 后缀（当前已同步至 **`3.8.0moon`**）；
   - 每次合并上游必然在 `manifest.json` 的 `version` 行发生冲突，直接按此惯例解决为 `X.Y.Zmoon`。
2. **分支与合并安全策略**：
   - 合并上游前先建立备份分支：`git branch backup/master-before-upstream-vX.Y.Z master`；
   - 在 `master` 分支执行 `--no-ff` 合并：`git merge --no-ff upstream/master`；
   - 本地合并与自动化测试未完全通过前，严禁向远程 force push。

---

## 2. 合并冲突热区与标准裁决表（合并上游必查）

每次合并上游发布版本时，`manifest.json` 必然物理冲突；`memory.js` 是否物理冲突取决于上游是否触碰状态声明区 / `jobSignal` / 清洗器区域（v3.7.12 合并时自动合并成功、人工逐段复核通过；v3.7.13、v3.7.15 与 v3.7.16 上游未触碰 `memory.js`，原样保留；v3.7.14 同样未触碰），其余 30+ 业务文件绝大部分由 Git 3-way 算法自动平滑合并（v3.7.15 的 `index.js` 与 `qianqianjie.test.js` 亦自动合并，本地资产与适配断言全部幸存，逐项复核通过；v3.7.16 的 `index.js` 与 `save-transaction.test.js` 同样自动合并，上游新 import 与本地适配注释干净共存，逐项复核通过）：

| 文件路径 | 冲突性质 | 解决裁决方式与保护要点 |
| :--- | :--- | :--- |
| `manifest.json` | `version` 版本行冲突 | 直接采纳为最新 `X.Y.Zmoon`（如 `3.7.13moon`） |
| `memory.js` | 状态声明区 / `jobSignal` / 清洗器区域冲突 | **必须严格保留本地资产**：<br>1. 保留 `const _jobSignalDisposes = new WeakMap();` 与 `disposeJobSignal` 生命周期双向清理协议<br>2. 维持 `stripTags` 由 `runtime/tag-sanitizer.js` import + re-export 的状态，严禁退回上游内联旧正则<br>3. 吸收上游新特性并逐段复核（v3.7.12：`sourcePolicy` 来源核验、`validL0`/`validL1Entries`、`ledgerHistoricalNarrativeMessage` 楼层判定、`shortGroups` 短楼组、确认式落盘 `persistConfirmed`、完整性分类统计） |
| `utils/tag-names.js` | 上游若改动 `normalizeTagRules` 或新增规则形态 | **本地泛化保留**（2026-09-30 起为本地产权文件）：`literalWrapperRule` 三条件与 `normalizeTagRules` 对包裹规则「原样保留、大小写敏感」的语义（自 ST-MyriadKnots P5 同步）须逐字保留；仅吸收上游对标签名字符合同的改动 |

> **隐藏规则（易误判，合并时留意）——字面量包裹规则 `起始...结束`**：
> `LITERAL_WRAPPER_SEPARATOR = '...'` 与 `literalWrapperRule()` 定义于 `utils/tag-names.js`（2026-09-30 起为本地增强文件），由 `runtime/tag-sanitizer.js` 消费（`memory.js` 已不再直接 import）。它**不属于普通标签名正则**（`[` 等非字母），但在清洗器中承担真实语义——用户填任意「起始...结束」（如 `[[...]]`、`{{...}}`）即对该包裹块做清洗（keep 剥壳取内、extra 连定界符整块删、支持嵌套与穿透）。**不要因为其不符合 XML 标签形态就当作无效规则删改**。

---

## 3. 必须保住的本地核心定制资产清单（Fork 存在的价值，合并时逐项复核）

合并上游或重构时，以下 4 大定制模块为本地产权核心，**严禁被上游旧代码覆盖或对齐掉**：

### 3.1 四模式标签清洗器（`runtime/tag-sanitizer.js`）
- **核心架构**：
  - 树形单遍解析（`parseSanitizerTree`），节点记录 `openRaw`/`closeRaw`，支持 M0/M1 的逐字节保真复现；
  - `memory.js` 仅保留重导出：`import { stripTags } from './runtime/tag-sanitizer.js'; export { stripTags };`。
- **核心合同**：
  - **M0（两栏皆空）**：直通不清洗，保留正文，仅做注释/孤立标记清理与折空行；
  - **M1（仅 extra）**：成对删除 extra 标签及内容；未闭合 extra 吞至最后同名闭合或 EOF（噪音不泄漏）；
  - **M2（仅 keep）**：剥壳保留 keep 块内容（内部不再二次清洗，嵌套子标签原样保留），块外裸文本丢弃；
  - **M3（混合）**：extra 恒优先，无论在外层、包裹 keep 还是嵌在 keep 子树内一律整块剔除；同名 keep/extra 按 extra 优先；
  - **三分支 token 正则**：`TAG_ATTR_SOURCE`（属性引号感知，值内 `>` 不截断）+ `TAG_ATTR_FALLBACK_SOURCE`（未闭合引号宽松兜底，等价旧正则截断行为，防止思维链泄漏）+ 每条配置的字面量包裹规则各一分支（`freshTokenRx(wrapperRules)` 动态生成，`[[...]]` 只是特例）；
  - **自闭合标记**：keep 子树内自闭合 extra 标记连标记删除，非 extra 保留 `openRaw`。
- **金样锁定**：
  - 行为由 `runtime/tag-sanitizer.golden.json`（40 组金样）绝对锁定；
  - 与兄弟仓库 `ST-MyriadKnots` 保持 100% 逐字节一致（两仓对拍 0 差异）。

### 3.2 `_jobSignalDisposes` 监听器防泄漏闭环（`memory.js`）
- **上游缺陷背景**：
  上游虽然在绑定 relay 监听器时添加了 `{ once: true }`，但该参数仅在真正触发 abort 时生效；在 99% 正常成功完成的请求中，`abort` 事件永不触发，导致未触发的监听器永久残留在长生命周期的 `_jobAbortController.signal` 上，随着批量重构或长时对话产生严重的闭包累积与内存泄漏。
- **本地治本实现**：
  - 维护 `const _jobSignalDisposes = new WeakMap();` 记录双向清理函数；
  - 定义 `disposeJobSignal(signal)`；
  - 在 `runL0` 与 `runL1` 的 `_callApi(...)` 请求外包裹 `try ... finally { disposeJobSignal(signal); }`，实现无论成功还是失败，零监听器残留。必须誓死保住。
- **v3.7.12 合并注意**：上游重写了 `runL1`（签名从 `range` 改为 `groupKeys`，新增 `sourcesStillCurrent` 守卫）并扩展了 `runL0`，合并后 finally 清理已重新落在新的请求路径上并复核通过；后续合并若上游再动这两个函数，必须重新套用本修复。

### 3.3 标签清洗设置项与 UI 保存校验
- **默认值保护 (`runtime/settings.js`)**：
  - `keepTags` 默认值必须为 `''`（两栏皆空 = 不清洗，全库严禁残留 `keepTags: 'content'` 默认）。
- **设置面板与保存拦截器 (`index.js`)**：
  - 设置面板文案必须包含关键指导字符串：`两栏都留空＝不清洗`、`只配此栏即只留各 keep 块的内部内容`、`可穿透进 keep 块内部`；
  - `bindTagField` 保存校验：用户在保留/剔除两栏配置同名标签时，失焦自动求归一化交集（标签名与字面量包裹规则一并参与，含 `[[...]]`、`{{...}}`），命中时**拒绝落存、输入框回退旧值**，并弹出 `showToast(..., true)` 错误提示，从源头杜绝非法配置存盘。

### 3.4 本地专属单元测试文件
- `memory.sanitizer.test.js`：清洗器 40 例金样逐字节比对 + 四模式语义探针（含通用包裹规则 4 例，自 ST-MyriadKnots P5 同步）；
- `business/space/context.test.js`：空间意图识别与结构化卡片单测（上游没有）；
- `business/memory/qianqianjie.test.js`（**上游文件的本地适配版**，自 v3.7.13 起）：上游 v3.7.13 更改千千结语义（仅 recall 作材料、前情单独存在不作材料、读取失败消息加「千千结记忆读取失败：」前缀）但**未同步更新自己的测试**（纯上游 worktree 实测 4/12 失败），本地按新语义适配了 4 例断言并恢复全绿。后续合并若上游触碰此测试文件：先核对 `qianqianjie.js` 当前语义再裁决，勿盲目任取一侧；若上游日后自己补齐了测试更新，应以适配面最小的一方为准并删除本地适配注释。
  - **v3.7.15 复核**：上游再次触碰此测试文件——harness 注入 `writeCache`/`readCache` 并新增 1 例缓存旁路测试（召回先返回、缓存持久化限时旁路确认）——但仍未修复同 4 例红断言（纯上游 worktree 实测 9/13）。合并裁决：吸收上游 harness 与新测试，保留本地 4 例适配断言，全绿。
- `business/lines/save-transaction.test.js` + `util/fast-json-patch.js`（**上游测试的本地适配版 + 本地补齐依赖**，自 v3.7.15 起）：上游 v3.7.15 新增的保存事务测试以 `../../../../../util/fast-json-patch.js` 引用作者机器本地工作区文件，路径越出仓库根且上游仓库未携带该文件，纯上游检出即无法运行（worktree 复报 `ERR_MODULE_NOT_FOUND` 坐实）。本地补齐最小 RFC 6902 实现 `util/fast-json-patch.js`（`compare` + `applyPatch`），测试内引用适配为 `../../util/fast-json-patch.js`。后续合并若上游自带 `util/fast-json-patch.js`：**以上游版本为准**，回收本地实现、恢复上游引用路径并删除适配注释。
  - **v3.7.16 复核**：上游扩充此测试（+124 行，新增 7 例 TT 保存器测试并 import 新模块 `diagnosticMessage`/`createTauriTavernMetadataSaver`），**仍引用作者机器路径且仍未自带该文件**（连续第二个版本带红引用发布）。合并裁决：3-way 自动合并已干净落地——吸收上游新 import 与新测试，保留本地适配注释与 `../../util/fast-json-patch.js` 引用，新 TT 测试不依赖 JSON Patch 新操作、现有 shim 足以支撑（208 全绿坐实）。

---

## 4. 已主动放弃、不要当成“丢失”补回的改动

- **间·意图识别**：“解释性提问判为 discuss”的早期本地实现已在合并上游 v3.6.5 时**整体取上游版本放弃**（上游已实现更完善的 `PURE_EXPLANATION_RX` / `EXPLICIT_EXPLANATION_RX`）。`business/space/context.js` 应保持**与上游逐字节一致**，切勿为了对齐本地早期逻辑而反向修改。

---

## 5. 合并验证清单与验收标准（4 道硬性门禁）

每次完成代码合并后，必须逐项核实以下 4 道放行门禁：

1. **冲突标记零残留**：
   ```bash
   git grep -n '^<<<<<<<'
   ```
   *标准*：匹配数为 0。
2. **本地资产文件清单校验**：
   合并结果相对 `upstream/master` 应只差以下 **13 个本地产权文件**（`git diff --stat upstream/master`；v3.8.0 起 14 → 13：上游删除 `business/lines/save-transaction.test.js` 故连锁回收 `util/fast-json-patch.js`，新增 `runtime/store-local-applied.test.js` 本地 Windows 适配）：
   `AGENTS.md`、`.gitignore`、`business/memory/qianqianjie.test.js`、`business/space/context.test.js`、`index.js`、`manifest.json`、`memory.js`、`memory.sanitizer.test.js`、`runtime/settings.js`、`runtime/store-local-applied.test.js`（v3.8.0 起本地 Windows 适配）、`runtime/tag-sanitizer.js`、`runtime/tag-sanitizer.golden.json`、`utils/tag-names.js`。
3. **全量自动化测试回归套件**：
   ```bash
   node --test memory.sanitizer.test.js business/space/context.test.js business/axis/axis.test.js business/lines/lines.test.js business/lines/dashed-failure.test.js business/point/point.test.js business/memory/qianqianjie.test.js business/narrative-preferences.test.js business/outline/chat.test.js business/outline/judge-failure.test.js business/ui/panel-failure.test.js business/ledger/repository.test.js business/space/chat.test.js business/theater/repository.test.js runtime/external-chat-storage-diagnostics.test.js runtime/local-diagnostics.test.js runtime/store-local-applied.test.js test/index-chat-boundary.test.mjs
   ```
   *标准*：**203/203 全部全绿（通过率 100%，0 失败）**（v3.8.0 起基线由 208 改为 203：上游删除 save-transaction 套件 −27、新增 8 个测试文件 +22；现为 18 个测试文件口径）。
4. **与 ST-MyriadKnots 跨仓终验对拍**：
   运行 40 例金样跨仓比对脚本，验证与 `ST-MyriadKnots/src/memory-content-sanitizer.js` 输出 **0 差异、100% 逐字节一致**。

---

## 6. 当前仓库状态底数（基线备忘）

- **当前分支**：`master`
- **跟踪上游基线**：已合入 `upstream/master`（Tag: `v3.8.2`，提交 `b57cc0a`；合并前备份分支 `backup/master-before-upstream-v3.8.2`）；
- **当前版本**：`manifest.json` 版本号 **`3.8.2moon`**；
- **最近提交历史**：
  - `c001d45`：`merge: integrate upstream v3.8.2`（叙事推进幅度 narrativePace、事件制门票选择、每日赏乐卡 daily-menu、线迭代细化，见下方验证记录）；
  - `ed85bdc`：`merge: integrate upstream v3.7.16`（线保存兼容 TT metadata-only saver、Ticket 编号分类，见下方验证记录）；
  - `dc5efc0`：`test: vendor RFC6902 shim and fix save-transaction test import (upstream v3.7.15 red test)`（上游红测试本地适配，见 §3.4 与下方验证记录）；
  - `652fb95`：`merge: integrate upstream v3.7.15`（剧情创作偏好、操作失败提示、线生成与保存事务/期限）；
  - `4b194e6`：`docs: update AGENTS.md for v3.7.14moon merge`；
  - `31310a3`：`merge: integrate upstream v3.7.14`（间/面内讨论人物卡提名、移除构画自设 token 上限、面内讨论空摘要回退）；
  - `e910c59`：`feat: 通用字面量包裹规则同步自 ST-MyriadKnots P5`（清洗器接受任意「起始...结束」字面量包裹规则，金样新增 4 例 → 152/152）；
  - `61cb0cb`：`test: adapt qianqianjie tests to upstream v3.7.13 semantics`（上游带红测试发布，本地按新语义适配千千结 4 例断言）；
  - `3145766`：`merge: integrate upstream v3.7.13`（历法时间戳名称 `title`、千千结召回缓存 v2「上次成功召回保留至新召回成功」、间/面世界书按当前问题触发、面板拖拽失焦即止）；
  - `7021114`：`merge: integrate upstream v3.7.12`（记忆来源核验 sourcePolicy/validL1Entries、千千结空记忆确认后改读最近 6 楼、故事时间戳完整年份要求、完整性检查反馈改按钮下方显示）；
- **v3.7.13 合并验证记录**：唯一冲突 `manifest.json`（裁为 `3.7.13moon`）；本地 4 块 index.js 资产与 `_jobSignalDisposes` 闭环逐项断言在位；`business/space/context.js` 与上游逐字节一致；`node --check` 13 个合并涉及 JS 文件通过；千千结测试适配后全量 148/148 全绿；跨仓金样对拍 40/40 例 0 差异。**特别记录：上游 v3.7.13 发布时自带 4 个红测试（千千结套件），归因经纯上游 worktree 复跑坐实，非合并损坏。**
- **v3.7.14 合并验证记录**：唯一冲突 `manifest.json`（裁为 `3.7.14moon`）；`index.js` 自动合并（本地改动在设置 UI/清洗器绑定区，与上游世界书/记忆函数区不相交）。上游变更：①间/面内讨论人物卡提名——`titleSupplementText`（本轮实际投喂材料）经新增 `worldInfoPersonTitleMatches` 按人物类标题提名主卡，`worldInfoTitleMatches` 人物分支放宽为正文出现人名即命中；②移除构画自设 token 上限——世界书注入 60000 裁剪循环、记忆 `_capMemText`/`MEMORY_TOKEN_BUDGET`、API 请求 `max_tokens: 30000` 全链路删除（`WORLD_INFO_TOKEN_BUDGET` 改名 `WORLD_INFO_SCAN_BUDGET` 仅作扫描预算）；③面内讨论 Anima/柏宝书空摘要时 `recentFallback` 改读最近 6 条可见 AI 楼层（`buildRecentChatContext(ctx, 6, Infinity)`），也无正文则报错停止。**语义收紧**：`worldInfoTitleSupplementAllows` 改为概率 ≠100 一律拒绝（标题补充不再掷骰，概率命中只由宿主 dry-run 决定；概率 100 的确定性条目被宿主预算挤掉时可经标题路径救回）。验证：`node --check` 10 个合并涉及 JS 文件 + `manifest.json` JSON 解析通过；合并前基线 152/152 全绿，合并后全量 152/152 全绿；清洗器资产域（`memory.js`/`runtime/`/`utils/`）合并前后零字节变化；跨仓金样对拍 40/40 例 0 差异。上游自带千千结红测试仍为同 4 例（v3.7.13 已知问题，上游未修，本地适配版不受影响）。
- **v3.7.15 合并验证记录**：唯一冲突 `manifest.json`（裁为 `3.7.15moon`）；`index.js` 与 `qianqianjie.test.js` 自动合并。51 文件 +2553/-269，上游变更三大主题：①**剧情创作偏好**——新增 `business/narrative-preferences.js`（`narrativePreferenceContract`），点/面/间创作入口参考剧情倾向与叙事尺度设置，`business/space/context.js` 载荷键 `lineDirection` 改为 `preferences`（本地 `context.test.js` 不引用该键，实测不受影响）；普通讨论与解释不受偏好强制引导；②**操作失败提示**——新增 `business/ui/panel-failure.js`（`createPanelFailureStore`/`createPanelFailureRecency`），点/线/轴/日期/刻度/面/间/棱/坐标/虚线面板在当前页面运行期、正文上方保留最近一次操作失败原因（普通关闭重开仍可查），悬浮入口工作期忙碌态，各 `feature.js` 以 `Object.create(chat)` 包装控制器注入失败记录；③**线生成与保存**——新增 `runtime/deadline.js`（`createDeadlineSignal`/`LINES_TIME_LIMITS`/`waitForSignal`：单次任务 4 分钟、准备 1 分钟、确认保存 30 秒，超时按失败处理不自动重发），后台推进不再阻塞正文聊天，当前界面不发布未确认新线；新增 `runtime/diagnostic-trace.js`（轻量安全诊断记录，外置存储模式不再逐条后台落盘）；`runtime/external-chat-storage.js` 大改（+221）：外置存储确认保存只在确认后更新当前数据，过期/排队旧写入不覆盖较新内容；`runtime/target-metadata-save.js` 大改（+174）：`captureMetadataIntentBefore`/`createTargetSnapshotRefresher` 意图基线与快照刷新。**红测试归因（两次复跑坐实，均非合并损坏）**：上游新增 `business/lines/save-transaction.test.js` 引用 `../../../../../util/fast-json-patch.js`（作者机器本地路径，越出仓库根、上游未携带），纯上游 worktree 复报 `ERR_MODULE_NOT_FOUND`；本地按千千结先例适配——补齐最小 RFC 6902 实现 `util/fast-json-patch.js` + 引用路径改为 `../../util/fast-json-patch.js`，21/21 全绿（**本地产权清单 12 → 14**）。上游千千结 4 例红测试依旧未修（纯上游 worktree 9/13），本地适配版不受影响。验证：`node --check` 48 个合并涉及 JS 文件通过；合并后全量 **201/201 全绿**（15 个测试文件，含上游新增 dashed-failure/save-transaction/narrative-preferences/judge-failure/panel-failure 五文件；原 6 文件子集 165/165）；清洗器资产域（`memory.js`/`runtime/tag-sanitizer.js`/`golden.json`/`runtime/settings.js`/`utils/tag-names.js`/`memory.sanitizer.test.js`）合并前后零字节变化；本地资产逐项在位（index.js 5 处：`keepTags: ''` 默认 ×2、加长提示文案、双向 `bindTagField` 接线；`_jobSignalDisposes`/`disposeJobSignal` 闭环）；跨仓金样对拍 40/40 例 0 差异。
- **v3.7.16 合并验证记录**：唯一冲突 `manifest.json`（裁为 `3.7.16moon`）；`index.js` 与 `save-transaction.test.js` 自动合并。11 文件 +396/-10，上游变更两大主题：①**线保存兼容**——新增 `runtime/tauritavern-metadata-save.js`（+168，TT 专用 metadata-only 保存器：经宿主 `enqueueChatSave` 队列提交，排队期间取消/切换聊天/同键接管均不派发过期候选；IPC 限期只结束构画等待、结果待核实不自动重试），`index.js` 惰性接线（仅宿主存在 `__TAURITAVERN__` 时启用，`loadTransport` 动态 import 宿主模块 `../../../chat-payload-transport.js`，标准 ST 环境永不加载），`store.js` 的 `writeDataConfirmed` 向 `persistConfirmed` 传 `intentOwnerGuard`（保留同键交接边界至派发），`runtime/diagnostic-trace.js` 白名单新增 `unsupported-core-contract`/`tt-*` 七个保存原因，`api/diagnostics.js` 的 `diagnosticMessage` 新增未发出/待核实/冲突三态保存文案；②**Ticket 编号分类**——`business/lines/schema.js` 新增 `normalizeTicketId`（接受完整 SFW/NSFW 括注后缀、剥为纯编号，拒绝重复 Ticket 字段），`business/lines/prompt.js` 提示词将编号与分类分开展示（Ticket 字段只写纯编号），`business/lines/lines.test.js` +42 行新测试。**红测试复核**：上游扩充的 `save-transaction.test.js` 仍引用作者机器路径 `../../../../../util/fast-json-patch.js` 且仍未自带该文件（连续第二个版本），本地适配经 3-way 自动合并干净存活（上游新 import `diagnosticMessage`/`createTauriTavernMetadataSaver` 与本地适配注释共存）；上游千千结 4 例红测试依旧未修，本地适配版不受影响。验证：`node --check` 8 个变更运行时文件 + `manifest.json` JSON 解析通过；合并后全量 **208/208 全绿**（15 个测试文件；基线 201 → 208，上游新增 7 例测试全通过）；清洗器资产域（`memory.js`/`runtime/tag-sanitizer.js`/`golden.json`/`runtime/settings.js`/`utils/tag-names.js`/`memory.sanitizer.test.js`/`util/fast-json-patch.js`）合并前后零字节变化；本地资产逐项在位（index.js 5 处：`keepTags: ''` 默认 ×2、加长提示文案、双向 `bindTagField` 接线，上游 `'content'` 默认零残留；`_jobSignalDisposes`/`disposeJobSignal` 闭环，`disposeJobSignal` 定义于 `memory.js:82`、runL0/runL1 finally 调用在位）；合并结果相对 `upstream/master` 恰好收敛为 14 个本地产权文件；跨仓金样对拍 40/40 例 0 差异。
- **v3.8.0 合并验证记录（2026-10-05，合并提交 `29bc7e7`）**：merge-tree 试合并预判与实际冲突完全一致，5 处——`.gitignore`（并集 `.zcode`/`.atomcode` + 上游 `.pi/` 与 diagnostics.local.json 路径）、`manifest.json`（裁为 `3.8.0moon`）、`AGENTS.md`（**add/add**：本地 Moon 指南为基座，上游 7 行保存/返回约定全文收录为「上游保存与返回约定」小节）、`business/lines/save-transaction.test.js`（**modify/delete**：采纳上游删除，连锁回收 `util/fast-json-patch.js`——另一引用方 `runtime/target-metadata-save.js` 同被上游删除，全仓 grep 确认零引用；本地产权 14 → 13）、`memory.js`（3 块：import 区采上游 `createGenerationDiagnosticScope` 展开并**丢弃 `'./utils/tag-names.js'` 直引**——合并树正文对 tag-names 符号零引用无悬空，`stripTags` import+re-export 保持；两处 `_callApi` 并集为本地提升 `signal`（`finally disposeJobSignal` 闭环）+ 上游 `diagnostic.sink`/`diagnostic.accepted()`——**不可取上游内联 `jobSignal()`**，否则 dispose 落空/悬空）。上游变更主体：保存合同改 local-applied 即返回（`runtime/target-metadata-save.js`/`runtime/tauritavern-metadata-save.js` 删除；合并树 `index.js` 对两模块及 `chat-payload-transport` **0 残留引用**，剩余 `__TAURITAVERN__` 3 处为基线既有宿主 UI 探测）、`runtime/local-diagnostics` 全套（默认关闭，`diagnostics.local.json` 开启）、线生成 8 候选规则、`runL0/runL1/fillMissing/rebuildAll` 诊断作用域接线（`diagnosticScope` 形参与 `rejected()` 均自动合并到位）。**上游自带 1 个 Windows 红测试本地适配**（纯上游 worktree 复跑坐实，非合并损坏）：`runtime/store-local-applied.test.js` 两处 POSIX 专属写法——① `--experimental-loader` 直接收绝对路径，Windows 下 `D:\Temp\...` 被解析为 URL scheme `d:` 在 loader 注册阶段即崩（栈帧 `AsyncLoaderHooksOnLoaderHookWorker.register`，任何 hook 不执行）；② `path.resolve(new URL('..', import.meta.url).pathname)` 带 `/D:/` 前缀；改用 `pathToFileURL(loader).href` 与 `fileURLToPath`。另 fixture `keepTags:'content'`（上游语义下无标签正文不受影响）在本地 M2 合同下会清空无标签正文致摘要无法生成，按千千结先例适配为 `''`（实测：`stripTags('第一段剧情…', {keepTags:'content'})` → `''`）。验证：门禁 1 冲突标记 0；`node --check` 16 个变更运行时文件通过；门禁 3 全量 **203/203 全绿**（18 个测试文件：-save-transaction +8 上游新文件；基线 208 → 203）；门禁 2 产权 13 文件与 `git diff --name-only upstream/master` 一致；清洗器资产域（`runtime/tag-sanitizer.js`/`golden.json`/`utils/tag-names.js`/`memory.sanitizer.test.js`）规范化 diff **零字节变化**，`memory.js` 清洗器区域零 hunk 触碰，`runtime/settings.js` 变化纯为上游 `spAdditionalParams`/`apiAdditionalParams` 跨插件预设配线（本地 keepTags M0/M2 块原样在位——**本轮记录例外**）；index.js 本地 5 资产逐项在位（`keepTags: ''` ×2 于 L1974/L8092、keeptags 输入 L3426、双向 `bindTagField` L8343-8366）；跨仓金样对拍 40/40 例 0 差异；**兄弟仓 MK v0.6.8 的跨仓红测试**（`settings-api.test.mjs:288` 期望 `loadCfg()` 含 `spAdditionalParams`）由本合并的 `runtime/settings.js:153` 自然修复（对方仓复跑 37/37 确认）。
- **v3.8.2 合并验证记录（2026-10-06，合并提交 `c001d45`；合并 v3.8.1+v3.8.2，上游 4 提交 `21906d5..b57cc0a`）**：merge-tree 试合并预判与实际冲突完全一致，**唯一冲突 `manifest.json`（裁为 `3.8.2moon`）**，其余 48 文件全部自动合并。上游变更主体：①**叙事推进幅度**——`runtime/settings.js` 默认值新增 `narrativePace: 'free'`（独立于按角色保存的观察焦点），新增 `business/narrative-pace.test.js`；②**事件制门票选择**——`business/ledger/events.js` 重构（+78）、`business/point/controller.js`/`daily-menu.js`（新文件，独立赏乐卡，`store.js` KINDS 与 `runtime/portable-chat-data.js` 键匹配器新增 `daily-menu-user`）；③**线迭代细化**——`business/lines/prompt.js`（首次生成 8 条上限收紧为仅约束真正首次，AGENTS.md「上游保存与返回约定」末段同步更新）、`business/lines/adult.js`/`lines.test.js`；④轴生成、小剧场仓库、`index.js`（+252，pointController/ledger/axis/injectModal 区，与本地资产区不相交）。**暗雷排查全部排除**（合并前预审）：上游 121 行新增测试代码无 POSIX 专属写法（v3.8.0 Windows 适配模式未复发）；新文件 import 目标逐一核对全部存在（v3.7.15 fast-json-patch 模式未复发）；`memory.js` 与清洗器资产域零触碰；`index.js` diff 无 `runL0`/`runL1`/`stripTags` 管线变更；上游对 `invalidate` 无新增调用方言。验证：门禁 1 冲突标记 0；`node --check` 46 个合并涉及 JS 文件通过；门禁 3 全量 **227/227 全绿**（22 个测试文件：基线 203 → 227，上游新增 generation/events/ui-refresh/narrative-pace 四文件 +24 例）；门禁 2 产权 13 文件与 `git diff --name-only upstream/master` 恰好一致；清洗器资产域（`memory.js`/`runtime/tag-sanitizer.js`/`golden.json`/`utils/tag-names.js`/`memory.sanitizer.test.js`）对备份分支逐字节一致；index.js 本地 5 资产逐项在位；跨仓终验：40 例金样双仓 case 数组逐字节一致 0 差异、本仓 `memory.sanitizer.test.js` 复跑 15/15、对方仓 `tests/settings-api.test.mjs` 复跑 37/37（含本仓 `spAdditionalParams` 断言）。
- **兄弟仓库同步**：`ST-MyriadKnots` 已同步至 v0.6.11（2026-10-06，`c916304`；v0.6.9 召回实证选择与千事恢复 + v0.6.10 语义召回支持手动摘要 + v0.6.11 原始向量索引维护，合并后全量 1545/1545），召回回执重新生成已治本修复（秒级复用），两仓清洗器保持输出 100% 逐字节一致；2026-09-30 通用字面量包裹规则（P5）自该仓同步至本仓后，40 例金样 + 新增包裹规则用例跨仓对拍仍 0 差异；v3.7.14~v3.7.16、v3.8.0 与 v3.8.2 合并后复验金样 cases 数组仍 40/40 例 0 差异。

---

## 上游保存与返回约定（v3.8.0 起，upstream AGENTS.md 收录）

- 插件开启期间，合法生成结果持续应用到当前聊天；不要新增仅因 chatId、聊天 revision、楼层/参与者同一性而拒绝返回或保存的防御。仍保留用户主动取消、同通道新任务替代、真实输入/同键人工编辑冲突和格式校验。
- 普通 `chat_metadata` 写入（包括点、线、面、轴、间、记忆、刻度、导入和棱永久保存）先一次性应用完整 live 内容，再调用标准 `saveMetadata()` 并立即返回 `local-applied`。不等待宿主 Promise/ACK/readback，不据此回滚或重试。导入仍保留预览、用户确认、模块选择和真实冲突检查。
- 独立外置 record/file 的真实版本 CAS 与冲突处理继续保留；不要把它扩展为普通聊天 metadata 的保存门槛。
- 本机诊断仅由 gitignored 的 `diagnostics.local.json` 中 `{"enabled":true}` 启用，默认及其他安装关闭。读取本机记录使用 `node tools/read-local-diagnostics.mjs <absolute-user-root>`；不得把聊天正文、API 配置或凭证写入配置/文档。
- 提示词必须明确要求完整返回所需字段与结构。字段内部若有明确含义且可按现有规则归一的格式差异，应复用既有归一与合法部分处理；不要因可收敛的局部差异拒绝整批结果，也不要伪造缺失的身份或语义。事件线仅真正首次生成最多 8 条未锁模型候选；以当前线存档是否存在和合法既有来源区分首次，已有合法空存档与手动重新生成均属后续。首次模型超量时按原始顺序只取前 8 个 Line 块再校验，第 9 条起不参与首次业务判断；后续按剧情自然增加或减少，不截第 9 条、不设持续八条上限、不凑数。只审实际返回的旧/新身份和真实唯一 Ticket，不新增旧活线全返门槛、不回填省略旧线或伪造其终态；人工锁线完整保留。合法闭合空 widget 可以归零，空响应、散文和坏结构不冒充合法空结果。普通保存与真实外置 CAS 沿上方合同。
