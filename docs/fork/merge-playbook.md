# 合并手册（上游同步操作规程）

> **产权**：本文件为 fork 本地文档（上游无此文件），存放于 `docs/fork/`。
> **回答的问题**：怎么合并上游、冲突怎么裁决、红测试怎么归因、发版要注意什么。
> **分工**：逐文件定制契约见 [`fork-contracts.md`](./fork-contracts.md)；上游自身 Agent 合同收录见 [`upstream-agent-contract.md`](./upstream-agent-contract.md)；逐版本索引见 [`merge-notes.md`](./merge-notes.md)；门禁命令与当前基线见根 [`AGENTS.md`](../../AGENTS.md)。
> **最后核对**：2026-11-15（v4.2.0moon）。

## 1. 版本与产物

- **版本号命名规范 (`manifest.json`)**：`version` = 上游版本号 + `moon` 后缀（如 `4.2.0moon`）。每次合并上游必然在 `version` 行冲突，直接按此惯例解决。
- **入口产物**：已切换 Rolldown bundle `gouhua-app.js`（manifest `js` 字段改指产物）——**改源码后必须 `npm run build`**（`rolldown --config rolldown.config.mjs --configLoader native`）并一起交付产物；minify 剥非 legal 注释属正常，源码为唯一真源。

## 2. 合并流程

备份分支 `git branch backup/master-before-upstream-vX.Y.Z master` → 在 `master` 执行 `git merge --no-ff upstream/master`（先以 `git merge-tree --write-tree master upstream/master` 预判，实际冲突应与预判一致）→ 裁决（逐文件契约见 [`fork-contracts.md`](./fork-contracts.md)，冲突热区速查见本文 §3）→ 四道门禁（命令与阈值见根 `AGENTS.md`）→ 记录（merge-notes 新版本节 + 卷首索引加行；根 `AGENTS.md` 状态块原地更新）→ push origin；验证完全通过前严禁向远程 force push。**备份分支仅在本地存在，合并验证通过并推送后即可清理**（`git branch -d`，其尖端已是 master 历史内的祖先提交，删除零损失）。

**AGENTS.md 整文件冲突的固定解法**：上游自带 `AGENTS.md` 且随发布重写——冲突时**保留 fork 侧入口骨架**，把上游 `AGENTS.md` 的新增/变更契约内容**收录**进 [`upstream-agent-contract.md`](./upstream-agent-contract.md)（并更新其「最后核对」），不在 fork 入口里堆上游正文。

## 3. 冲突热区速查

`manifest.json` 必然物理冲突；`memory.js` 是否冲突取决于上游是否触碰状态声明区 / `jobSignal` / 清洗器区域（多数版本未触碰，原样保留即可）；其余 30+ 业务文件绝大部分由 Git 3-way 自动平滑合并——**自动合并成功 ≠ 资产安全，合并后仍须按根 `AGENTS.md` 资产清单逐项复核本地产权**。

| 文件路径 | 冲突性质 | 裁决要点（契约细节见 fork-contracts 对应条） |
| :--- | :--- | :--- |
| `manifest.json` | `version` 版本行冲突 | 直接裁为最新 `X.Y.Zmoon` |
| `memory.js` | 状态声明区 / `jobSignal` / 清洗器区域 | **严格保留本地资产**（fork-contracts 一、memory.js + 3.2）：stripTags re-export、jobSignal finally 闭环、`_callApi` 并集不可取上游内联 |
| `utils/tag-names.js` | 上游改 `normalizeTagRules` 或新增规则形态 | **本地泛化保留**（fork-contracts 一、tag-names 条）；v3.9.1 命名中括号三差异与 v3.9.5 重导出均不采 |
| `index.js` + `runtime/settings.js`（共享包裹符容器） | v3.9.5 起上游引入跨插件共享容器 | **采上游管线、挂本地语义**（fork-contracts 一、共享包裹符容器条）：初始化后置 + updateWrapperSettings 本地覆写 + moon 三句文案与三参 bindTagField |
| `runtime/store-local-applied.test.js` | 上游扩充 codec/诊断测试 vs 本地 Windows 适配 | 本地适配不可回退；上游新代码先查 POSIX 专属写法（fork-contracts 一、store-local-applied 条） |
| `runtime/store-codec.js` / `runtime/quick-reply-shortcuts.js` | 上游新增能力 | 正常吸收；codec 不静默覆盖损坏 wrapper，QR 只改构画自有组 |
| `runtime/chat-storage.js` / `store.js` / `index.js`（v3.10.2 存储迁移） | 业务根改 `chat_metadata` 四根 | **纯上游产权整体直通** + 三条红线（fork-contracts 一、chat-storage 条） |

> **隐藏规则（易误判）——字面量包裹规则 `起始...结束`**：`LITERAL_WRAPPER_SEPARATOR = '...'` 与 `literalWrapperRule()` 定义于 `utils/tag-names.js`，由 `runtime/tag-sanitizer.js` 消费（`memory.js` 已不直接 import）。它不属于普通标签名正则（`[` 等非字母），但承担真实清洗语义（keep 剥壳取内、extra 连定界符整块删、支持嵌套与穿透）。**不要因为其不符合 XML 标签形态就当作无效规则删改**。

## 4. 上游发布质量已知模式（红测试快速归因；均先以纯上游 worktree 复跑坐实「非合并损坏」再定适配）

1. **千千结 4 例红断言**：上游 v3.7.13 更改千千结召回语义但未同步自己的测试（纯上游实测 4/12 失败），后续版本一直未修；本地已按新语义适配（fork-contracts 3.4），不受影响。
2. **作者机器路径引用（模式已终结，教训保留）**：v3.7.15/16 上游测试曾越根引用 `../../../../../util/fast-json-patch.js`（本地 vendor shim 已随 v3.8.0 上游删除该测试一并回收）。**新上游测试文件先扫越根 import**。
3. **POSIX 专属写法**：v3.8.0 上游 `store-local-applied.test.js` 用裸路径 `--experimental-loader` 与 `new URL(...).pathname`，Windows 下在 loader 注册阶段即崩；本地已适配为 `pathToFileURL`/`fileURLToPath`。**上游新增测试代码先查同款写法**。v4.0.1 实录：上游 `runtime/menu-image-store.test.js` 子进程 spawn 仍以裸 temp 路径作 `--experimental-loader`（上游自修的 writeSync 同步输出未涵盖此点），本地补 `pathToFileURL(loader).href` 后转绿，该文件自此进入 §7 差异清单。
4. **跨仓 settings 断言**：兄弟仓 MK 的 `tests/settings-api.test.mjs` 期望本仓 `loadCfg()` 含 `spAdditionalParams`（本仓 v3.8.0 起已提供，持续保持）。

## 5. 测试环境须知

- **必须带 `--test-isolation=none`**：默认隔离会 spawn 子进程，在 DSH 沙箱下 `runtime/store-local-applied.test.js` 等用例报 `spawn EPERM` 伪红，属环境边界而非代码缺陷。
- **上游自带测试导入裸运行时**：上游 v3.9.1 新增的 `test/tag-sanitizer.test.mjs` 直接 `import '../memory.js'`，而 `memory.js` 顶部导入 SillyTavern 运行时（`../../../extensions.js`、`../../../../script.js`），裸检出下 `ERR_MODULE_NOT_FOUND`（纯上游树同样挂）。本地改为直连 `../runtime/tag-sanitizer.js`——`memory.js` 的 `stripTags` 本就是对该模块的纯 re-export，语义等价，且使测试在本环境可运行。

## 6. 自动合并静默保留过时适配的判据（v3.9.4 起）

**凡本地改写过某个测试文件、而上游后续又修改同一区域时，必须核对源码当前语义，不能因"自动合并无冲突"就认为正确**。实录：`business/memory/qianqianjie.test.js` 的前情提要断言在 v3.7.13 按「前情不计入材料」本地适配，上游 v3.9.3 又改回「计入材料」——因上游该处回到基线值，3-way 自动合并只看到本地单侧改动而静默保留本地旧断言，合并后 3 例红。同理 `business/space/context.test.js` 的 `classifySpaceIntent` 返回值域在 v3.9.1 由 `'semantic-route'` 改为 `'write'`+`kind`（后被上游掏空，见 fork-contracts 3.4）。

## 7. 本地产权差异清单（门禁 2 校验基准）

合并结果相对 `upstream/master` 应只差以下核心本地产权文件（`git diff --name-only upstream/master`，共 16 个）；**其余差异须逐项解释**：

`AGENTS.md`、`.gitattributes`（`* text=auto eol=lf`）、`.gitignore`、`gouhua-app.js`（产物随源重建）、`index.js`（moon 三句文案 + 三参 bindTagField）、`manifest.json`（版本 moon 后缀）、`memory.js`、`memory.sanitizer.test.js`、`runtime/menu-image-store.test.js`（v4.0.1 起本地 `pathToFileURL` 代修）、`runtime/quick-reply-shortcuts-host.test.js`（Windows loader 适配 + 无宿主源码时 `t.skip`）、`runtime/settings.js`（M0 三件套）、`runtime/store-local-applied.test.js`（Windows 适配）、`runtime/tag-sanitizer.js`、`runtime/tag-sanitizer.golden.json`、`test/tag-sanitizer.test.mjs`（moon 合同适配）、`utils/tag-names.js`。

历史适配文件退役记录：`business/memory/qianqianjie.test.js`、`business/space/context.test.js`、`test/index-chat-boundary.test.mjs`、`test/memory-source-production.test.mjs`、`business/narrative-pace.test.js`、`business/narrative-preferences.test.js` 已与上游一致或一律取上游（见 fork-contracts「三、勿回植速查」）；`runtime/local-diagnostics.js`、`runtime/local-diagnostics.test.js`、`tools/read-local-diagnostics.mjs`、`runtime/external-chat-storage.js`、`runtime/external-chat-host-bridge.js` 已随上游 v3.10.2 删除。

## 8. 发布注意（发版必读）

- **v4.0.0 导入语义**：导入「点」会**连菜单与衣橱一起替换**所选聊天的对应数据、旧包缺失内容也会清空——发布说明必须提醒先备份。
- **v3.10.2 存储架构迁移**：构画业务根与楼层快照改为**随聊天 `chat_metadata` 保存**（`sp-store`/`sp-memory`/`sp-theater`/`sp-ledger` 四个根，见 `runtime/chat-storage.js`）。**存量用户数据在白鳥，插件不会自动迁移**：`hasLegacyChatStorage()` 为真时 `normalRoot()` 返回 `null` → 必须由用户在「设置 → 存储管理 → 迁回聊天」触发一次性只读迁回（只 GET 原集合 → 就地应用 → 一次 `saveChat`）。发布说明必须写明该动作，否则用户会误判数据丢失；普通聊天不再探测白鳥，只在迁回入口可用时访问。

## 9. 合并记录的写法（防回胀）

1. 合并详情只写 [`merge-notes.md`](./merge-notes.md) 新版本节 + 卷首索引加一行（≤120 字符）；根 `AGENTS.md` 状态块只原地更新当前值，**不追加历史叙述**。
2. 若合并触到某文件的定制契约，同步修订 [`fork-contracts.md`](./fork-contracts.md) 对应条目；上游 AGENTS.md 有新契约时更新 [`upstream-agent-contract.md`](./upstream-agent-contract.md)。
