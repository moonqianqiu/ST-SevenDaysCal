# 构画 · Moon 定制版 — Agent 项目指南

本仓库是 [`atonal519/ST-SevenDaysCal`](https://github.com/atonal519/ST-SevenDaysCal) 的 fork（作者 moon 定制版），在 `master` 分支上跟踪上游最新基线，并叠加了"moon"专属改动。`origin = moonqianqiu/ST-SevenDaysCal`，`upstream = atonal519/ST-SevenDaysCal`。

> **用途**：供后续会话/开发者在执行"合并上游"、"冲突裁决"、"代码维护"时，迅速掌握本 fork 的核心定制、版本惯例、冲突裁决规则以及架构设计决策，确保合并上游时不丢弃本地核心资产。
> **更名说明**：本文件原名 `memory.md`，自 `3.7.12moon` 起更名为 `AGENTS.md`（曾短暂命名 `AGENT.md`），内容定位不变。
> **体例**：本文件只维护**当前契约**与**索引**；历次合并的逐版本实录与验证数据随 git 历史沉淀（`git log -p AGENTS.md` 按版本回查，`git show <合并提交>` 看合并能力摘要）。每次合并后仅在 §6.1 索引表追加一行，并把新的持久性裁决沉淀进 §2/§3 相应契约。

---

## 1. 同步与版本惯例

1. **版本号命名规范 (`manifest.json`)**：`version` = 上游版本号 + `moon` 后缀（当前已同步至 **`3.9.0moon`**）。每次合并上游必然在 `version` 行冲突，直接按此惯例解决。
2. **分支与合并安全策略**：合并前先建备份分支 `git branch backup/master-before-upstream-vX.Y.Z master` → 在 `master` 执行 `git merge --no-ff upstream/master`（先以 `git merge-tree --write-tree master upstream/master` 预判，实际冲突应与预判一致）→ 裁决（§2）→ 四道门禁（§5）→ AGENTS.md 索引表追加记录 → push origin；验证完全通过前严禁向远程 force push。**备份分支仅在本地存在，合并验证通过并推送后即可清理**（`git branch -d`，其尖端已是 master 历史内的祖先提交，即合并提交的第一父状态，删除零损失）。

---

## 2. 合并冲突热区与标准裁决表（合并上游必查）

`manifest.json` 必然物理冲突；`memory.js` 是否冲突取决于上游是否触碰状态声明区 / `jobSignal` / 清洗器区域（多数版本未触碰，原样保留即可）；其余 30+ 业务文件绝大部分由 Git 3-way 自动平滑合并——**自动合并成功 ≠ 资产安全，合并后仍须按 §3 逐项复核本地产权**。

| 文件路径 | 冲突性质 | 解决裁决方式与保护要点 |
| :--- | :--- | :--- |
| `manifest.json` | `version` 版本行冲突 | 直接裁为最新 `X.Y.Zmoon` |
| `memory.js` | 状态声明区 / `jobSignal` / 清洗器区域 | **严格保留本地资产**：① `const _jobSignalDisposes = new WeakMap();` 与 `disposeJobSignal` 双向清理协议（§3.2）；② `stripTags` 保持由 `runtime/tag-sanitizer.js` import + re-export，**严禁退回上游内联旧正则**；③ 两处 `_callApi` 取并集——本地提升 `signal`（`finally disposeJobSignal` 闭环）+ 上游 `diagnostic.sink`/`diagnostic.accepted()`，**不可取上游内联 `jobSignal()`**，否则 dispose 落空/悬空；④ 上游新特性照常吸收并逐段复核 |
| `utils/tag-names.js` | 上游若改 `normalizeTagRules` 或新增规则形态 | **本地泛化保留**（本地产权文件）：`literalWrapperRule` 三条件与 `normalizeTagRules` 对包裹规则「原样保留、大小写敏感」的语义（自 ST-MyriadKnots P5 同步）逐字保留；仅吸收上游对标签名字符合同的改动 |
| `runtime/store-local-applied.test.js` | 上游扩充 codec/诊断测试 vs 本地 Windows 适配 | 本地适配（`pathToFileURL(loader).href` / `fileURLToPath` 替代 POSIX 的裸路径 loader 与 `new URL(...).pathname`）**不可回退**；吸收上游新增测试代码，新代码先查 POSIX 专属写法（§2.1③） |
| `runtime/store-codec.js` / `runtime/quick-reply-shortcuts.js` | 上游新增能力 | 正常吸收；codec 不得静默覆盖损坏/未来版本 wrapper，Quick Reply 只改构画自有组，不得改用户其他组或宿主总开关 |

> **隐藏规则（易误判）——字面量包裹规则 `起始...结束`**：`LITERAL_WRAPPER_SEPARATOR = '...'` 与 `literalWrapperRule()` 定义于 `utils/tag-names.js`，由 `runtime/tag-sanitizer.js` 消费（`memory.js` 已不直接 import）。它不属于普通标签名正则（`[` 等非字母），但承担真实清洗语义（keep 剥壳取内、extra 连定界符整块删、支持嵌套与穿透）。**不要因为其不符合 XML 标签形态就当作无效规则删改**。

### 2.1 上游发布质量已知模式（红测试快速归因；均先以纯上游 worktree 复跑坐实「非合并损坏」再定适配）

1. **千千结 4 例红断言**：上游 v3.7.13 更改千千结召回语义但未同步自己的测试（纯上游实测 4/12 失败），后续版本一直未修；本地已按新语义适配（§3.4），不受影响。
2. **作者机器路径引用**：v3.7.15/16 上游测试引用 `../../../../../util/fast-json-patch.js`（越出仓库根、上游未携带）；本地曾 vendor 最小 RFC 6902 shim，v3.8.0 上游删除该测试后 shim 一并回收，模式终结。**新上游测试文件先扫越根 import**。
3. **POSIX 专属写法**：v3.8.0 上游 `store-local-applied.test.js` 用裸路径 `--experimental-loader` 与 `new URL(...).pathname`，Windows 下在 loader 注册阶段即崩；本地已适配为 `pathToFileURL`/`fileURLToPath`（§2 表）。**上游新增测试代码先查同款写法**。
4. **跨仓 settings 断言**：兄弟仓 MK 的 `tests/settings-api.test.mjs` 期望本仓 `loadCfg()` 含 `spAdditionalParams`（本仓 v3.8.0 起已提供，持续保持）。

---

## 3. 必须保住的本地核心定制资产清单（Fork 存在的价值，合并时逐项复核）

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
- `business/space/context.test.js`：**上游文件 + 本地 2 例意图断言**（v3.9.0 起；上游版不含「你好 / 请解释点卡片是什么 → discuss」与「给我写一条线 / 输出成点卡片 → semantic-route、给我一个点和一条线 → clarify」两组；合并时取上游全文并追加本地两组，勿整体回退——上游 `classifySpaceIntent` 签名与语义持续兼容）；
- `business/memory/qianqianjie.test.js`（**上游文件的本地适配版**）：当前 `qianqianjie.js` 只以 recall 作材料，前情单独存在视为空，读取失败消息带「千千结记忆读取失败：」前缀；测试保留这些与实现一致的断言。后续合并裁决仍先核对实现语义，再吸收上游 harness/新测试，勿盲目任取一侧。

---

## 4. 已主动放弃、不要当成"丢失"补回的改动

- **间·意图识别**："解释性提问判为 discuss"的早期本地实现已在合并上游 v3.6.5 时整体取上游版本放弃（上游已实现更完善的 `PURE_EXPLANATION_RX` / `EXPLICIT_EXPLANATION_RX`）。`business/space/context.js` 应保持**与上游逐字节一致**，切勿反向修改。

---

## 5. 合并验证清单与验收标准（4 道硬性门禁）

1. **冲突标记零残留**：`git grep -n '^<<<<<<<'` 匹配数为 0。
2. **本地资产文件清单校验**：合并结果相对 `upstream/master` 应只差以下核心本地产权文件（`git diff --name-only upstream/master`）：
   `AGENTS.md`、`.gitignore`、`business/memory/qianqianjie.test.js`、`business/space/context.test.js`、`index.js`、`manifest.json`、`memory.js`、`memory.sanitizer.test.js`、`runtime/settings.js`、`runtime/store-local-applied.test.js`、`runtime/tag-sanitizer.js`、`runtime/tag-sanitizer.golden.json`、`utils/tag-names.js`、`.gitattributes`（v3.9.0 起新增，`* text=auto eol=lf`，共 16 个文件）。本次（v3.9.0）另有适配差异：`runtime/quick-reply-shortcuts-host.test.js` 保留 Windows loader 适配（§2.1③）并在无 SillyTavern 宿主源码时 `t.skip`；`test/index-chat-boundary.test.mjs`、`test/memory-source-production.test.mjs` 各删除 1 例上游过时用例（其 grep 的 `outlineChatMemoryError` / `readCreativeChatMemory` / `composeCreativeChatMessages` 已被 v3.9.0 从 `index.js` 移除，纯上游树复现同款红）；**`business/narrative-pace.test.js`、`business/narrative-preferences.test.js` 一律取上游**（上游删除了 `import { buildCreativeChatSystemPrompt } from '../state.js'`，该函数在 v3.9.0 树中已不存在，保留本地旧版必 import 失败）。其余差异须逐项解释。
3. **全量自动化测试回归套件**（`node --test` 全量 glob；**必须加 `--test-isolation=none`**——默认隔离会 spawn 子进程，在 DSH 沙箱下恒报 `spawn EPERM`，属沙箱边界而非代码缺陷）：
   ```bash
   node --test --test-isolation=none '**/*.test.js' 'test/*.test.mjs'
   ```
   *标准*：除已知沙箱伪红外全绿。`runtime/store-local-applied.test.js` 中 1 例 spawn 用例在沙箱内恒红（纯上游树同样红，非合并引入），真实终端下应为 pass/skip。v3.9.0 合并当期实测 **306 tests / 304 pass / 1 fail(沙箱 EPERM) / 1 skip**，以 §6.1 最近一行记录为准。
4. **与 ST-MyriadKnots 跨仓终验对拍**：40 例金样 case 数组与 `ST-MyriadKnots/src/tag-sanitizer.golden.json` 逐字节一致，双实现输出 **0 差异**。

---

## 6. 当前仓库状态底数（基线备忘）

- **当前分支**：`master`；已合入上游 **v3.9.0**（上游提交 `4f2dc62`，内容提交 `61a0774`「refactor: unify module workflows and reduce redundant work」），本次合并提交 `dc05fe9`，备份分支 `backup/master-before-upstream-v3.9.0` 保留至推送完成；v3.9.0 主要变更：面讨论整体迁入「间」（删除 `business/outline/chat.js` 及 `index.js` 内 `outlineChatMemoryError`/`readCreativeChatMemory`/`composeCreativeChatMessages` 三个内联函数，改走 `business/space/context.js` 的 `buildMessages` 注入路径）、新增 `business/memory/summary-schema.js` 与 `business/ledger/settings.js`、`state.js` 删除 `buildCreativeChatSystemPrompt` 等面讨论提示函（迁至 `business/space/prompts.js`）；
- **当前版本**：`manifest.json` 版本号 **`3.9.0moon`**；
- **最近提交历史**（更早见 `git log`）：
  - `1739c19`：`merge: integrate upstream v3.8.3`（线 schema 重写、外部聊天存储、记忆上下文窗口化；上游自带 2 红测试本地适配）；
  - `c001d45`：`merge: integrate upstream v3.8.2`（叙事推进幅度 narrativePace、事件制门票选择、每日赏乐卡 daily-menu、线迭代细化）；
  - `ed85bdc`：`merge: integrate upstream v3.7.16`（线保存兼容 TT metadata-only saver、Ticket 编号分类）；
- **兄弟仓库同步**：`ST-MyriadKnots` 已同步至 v0.6.12（2026-10-07，`b422e28`；空档案初始化 + 召回来源核验，`recall-selector` 去重键 cseDuplicateKey，预算循环热点零触碰，合并后全量 1564/1564），召回回执重新生成已治本修复（秒级复用），两仓清洗器保持输出 100% 逐字节一致；2026-09-30 通用字面量包裹规则（P5）自该仓同步至本仓，本次合并后复验金样 cases 数组仍 40/40 例 0 差异。

### 6.1 合并历史索引（逐版本实录与验证数据：`git log -p AGENTS.md`；上游能力摘要：`git show <合并提交>`）

| 上游版本 | 日期 | 合并提交 | 冲突与裁决要点 | 当期全量 |
| :--- | :--- | :--- | :--- | :--- |
| v3.7.12 | — | `7021114` | 本文件自 `memory.md` 更名 `AGENTS.md`；sourcePolicy/validL1Entries/确认式落盘等记忆语义更新 | — |
| v3.7.13 | — | `3145766` | 唯一 manifest 冲突；千千结召回语义变更 → 本地适配 4 例断言（上游自带 4 例红，§2.1①） | 148 |
| v3.7.14 | — | `31310a3` | 唯一 manifest 冲突；人物卡提名、移除构画自设 token 上限、面内空摘要回退最近 6 楼；资产域零字节变化 | 152 |
| v3.7.15 | — | `652fb95` | 唯一 manifest 冲突；剧情创作偏好/panel-failure/deadline/诊断链；save-transaction 引作者机器路径 → vendor fast-json-patch（产权 12→14） | 201 |
| v3.7.16 | — | `ed85bdc` | 唯一 manifest 冲突；TT metadata-only saver、Ticket 编号分类；上游仍缺 fast-json-patch，本地适配存活 | 208 |
| v3.8.0 | 10-05 | `29bc7e7` | 5 冲突（.gitignore / manifest / AGENTS.md add-add / save-transaction modify-delete：采纳上游删除并回收 shim，产权 14→13 / memory.js 三块：`_callApi` 并集规则沉淀 §2）；上游 Windows 红测试本地适配（§2.1③）；保存合同改 local-applied 即返回；`spAdditionalParams` 新增修复 MK 跨仓红 | 203 |
| v3.8.2 | 10-06 | `c001d45` | 唯一 manifest 冲突（`3.8.2moon`），其余 48 文件自动合并；narrativePace / 事件制门票 / daily-menu / 线首次生成合同收紧；合并前暗雷预审全排除 | 227 |
| v3.8.3 | 10-07 | `1739c19` | 唯一 manifest 冲突（`3.8.2moon`→`3.8.3moon`），index.js/memory.js 自动合并双向无损（merged-vs-master 纯上游、merged-vs-upstream 纯本地）；上游改大纲创作合同文案与 Line 字段说明但未同步自带 2 红测试（narrative-preferences:36 / narrative-pace:88，纯上游树复现实证），断言随上游新文案本地适配、语义不变；上游新增测试全数 Windows 兼容 | 245 |
| v3.8.5 | 10-11 | `4a7e09a` | v3.8.4 接入普通存档 gzip codec、诊断 TTL 保留及保存前压缩；v3.8.5 接入 Quick Reply 快捷入口；保留四模式清洗器、通用包裹规则、标签设置校验及 jobSignal finally 清理；合并 codec/Quick Reply 测试并保留 Windows loader 适配 | 245/245 核心；扩展 258/259（1 宿主测试跳过） |
| v3.9.0 | 10-15 | `dc05fe9` | 7 文件冲突：`manifest.json`→`3.9.0moon`；`index.js` 保留本地 §3.3 面板文案；`memory.js` 2 处（状态声明区保本地、清洗器区并集 + 补 `import { normalizeTagRules } from './utils/tag-names.js'` 以保住上游 `normalizeTagList`/`parseTagList` 导出面）；`runtime/quick-reply-shortcuts-host.test.js` 保本地 Windows loader 适配；`business/narrative-pace.test.js`、`business/narrative-preferences.test.js` **取上游**（本地旧版 import 的 `buildCreativeChatSystemPrompt` 已被删除）；`business/space/context.test.js` 取上游全文 + 追加本地 2 例意图断言。另删 2 例上游过时用例（`test/index-chat-boundary.test.mjs`、`test/memory-source-production.test.mjs`），均为 v3.9.0 删除 `index.js` 内联记忆函数后未同步的上游自带红 | 306 tests / 304 pass（1 例沙箱 EPERM 伪红）/ 1 skip |

---

## 上游保存与返回约定（v3.8.0 起，upstream AGENTS.md 收录）

- 正常使用中，合法生成结果应用到开始时确定的业务目标和数据来源。切换聊天仅允许复用已有切聊事件与完整停止接口、且只需一两行时直接停止全部工作；如果超出此范围则不处理切聊。不要仅因切聊拒绝保存、丢弃合法结果或改投后来打开的聊天，也不要新增任务登记、补偿恢复、重试或停止后的保护。仍保留用户主动取消、同通道新任务替代、真实输入/同键人工编辑冲突和格式校验。
- 普通 `chat_metadata` 写入（包括点、线、面、轴、间、记忆、刻度、导入和棱永久保存）先一次性应用完整 live 内容，再调用标准 `saveMetadata()` 并立即返回 `local-applied`。不等待宿主 Promise/ACK/readback，不据此回滚或重试。导入仍保留预览、用户确认、模块选择和真实冲突检查。
- 独立外置 record/file 的真实版本 CAS 与冲突处理继续保留；不要把它扩展为普通聊天 metadata 的保存门槛。
- 本机诊断仅由 gitignored 的 `diagnostics.local.json` 中 `{"enabled":true}` 启用，默认及其他安装关闭。读取本机记录使用 `node tools/read-local-diagnostics.mjs <absolute-user-root>`；不得把聊天正文、API 配置或凭证写入配置/文档。
- 提示词必须明确要求完整返回所需字段与结构。字段内部若有明确含义且可按现有规则归一的格式差异，应复用既有归一与合法部分处理；不要因可收敛的局部差异拒绝整批结果，也不要伪造缺失的身份或语义。事件线仅真正首次生成最多 8 条未锁模型候选；以当前线存档是否存在和合法既有来源区分首次，已有合法空存档与手动重新生成均属后续。首次模型超量时按原始顺序只取前 8 个 Line 块再校验，第 9 条起不参与首次业务判断；后续按剧情自然增加或减少，不截第 9 条、不设持续八条上限、不凑数。只审实际返回的旧/新身份和真实唯一 Ticket，不新增旧活线全返门槛、不回填省略旧线或伪造其终态；人工锁线完整保留。合法闭合空 widget 可以归零，空响应、散文和坏结构不冒充合法空结果。普通保存与真实外置 CAS 沿上方合同。
