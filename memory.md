# 构画 · Moon 定制版 — 项目记忆（供 CLI 参考）

本仓库是 [`atonal519/ST-SevenDaysCal`](https://github.com/atonal519/ST-SevenDaysCal) 的 fork（作者 moon 定制版），
在 `master` 上叠加了"moon"专属改动。`origin = moonqianqiu`，`upstream = atonal519/ST-SevenDaysCal`。

> 用途：让其它 CLI / 会话在执行"合并上游""检查合并""改代码"等任务时，知道哪些本地改动是 **fork 存在的意义**、
> 哪里会冲突、以及怎么确认合并没有吞掉本地改动。

---

## 1. 同步与版本惯例

- 合并上游前：`git branch backup/master-before-upstream-vX.Y.Z master` 备份，再在
  `integrate/upstream-vX.Y.Z` 上 `git merge --no-ff vX.Y.Z`，最后快进合回 `master`。
- 版本号：`manifest.json` 的 `version` = 上游版本号 + `moon` 后缀
  （如 `3.6.9.1moon` / `3.7.0moon` / `3.7.2moon`）。**每次合并必然在 `manifest.json` 上冲突**，按此惯例解决为 `X.Y.Zmoon`。
- 当前已合并到的上游版本会体现在 `manifest.json` 与 git tag，可用 `git describe --tags upstream/master` 查看上游最新。

## 2. 合并冲突热区（仅这两个文件会冲突）

| 文件 | 冲突点 | 解决方式 |
|---|---|---|
| `manifest.json` | `version` 行 | 取 `X.Y.Zmoon` |
| `memory.js` State 声明区 | 本地新增 `_jobSignalDisposes`；上游删除了 `_isRebuilding`（改用 `_activeRebuild` / `_aiFloorSnapshot`） | **保留 `_jobSignalDisposes`，不要补回 `_isRebuilding`**（本地无任何依赖，上游已整体移除） |
| `memory.js` `runL0` 的 catch | 上游 `recordFailure(..., 'request', m)`（上游给 `recordFailure` 新增 `memory` 形参）vs 本地旧写法 | 取上游那行 |
| `memory.js` stripTags 区 | v3.7.6 起上游重写为树形 `parseSanitizerTree`，与本地实现冲突；v3.7.6 合并后本地已把清洗器整体抽出 | **取本地（现为 re-export 态）**，不要把上游 stripTags 实现搬回 `memory.js`；清洗行为归 `runtime/tag-sanitizer.js` 管 |

其余文件 git 都能自动合并，无需手动解决。

> **隐藏规则（易误判，合并时留意）——双中括号 `[[...]]`**：
> `LITERAL_DOUBLE_BRACKET_RULE = '[[...]]'` 定义于 `utils/tag-names.js`（上游文件，不在下方 9 个本地产权清单内），
> 是一个特殊配置字面量：它**不属于普通标签名正则 `TAG_NAME_SOURCE`**（`[` 非字母），却在清洗器里承担真实语义——
> 用户在 keepTags / extraTags 填 `[[...]]` 即对 `[[...]]` 包裹块做清洗（keep 剥壳取内、extra 连内容删、内部递归解析支持嵌套与 extra 穿透）。
> 本地 `runtime/tag-sanitizer.js` 的 token 解析与 `[[...]]` 行为都依赖 `utils/tag-names.js` 的 `TAG_NAME_SOURCE` / `LITERAL_DOUBLE_BRACKET_RULE` / `normalizeTagRules`。
> **不要因为 `[[...]]` 不像标签名就当它无效/多余而删改**；`utils/tag-names.js` 是上游文件，保持与上游一致即可。

## 3. 必须保住的本地定制（合并时逐项复核）

- **`runtime/tag-sanitizer.js`**：四模式标签清洗器（M0 直通 / M1 仅 extra / M2 仅 keep / M3 混合），
  树形实现（吸收上游 v3.7.6 单遍解析，节点存 raw token 支持逐字节复现）；行为由
  `runtime/tag-sanitizer.golden.json`（重构前旧栈式实现的 29 例金样 + 2026-09 新增 11 例 = 40 例）锁定。
  - 本地增强（上游/千千结都没有或不同，合并时勿"对齐"掉）：
    ① token 正则引号感知 + 未闭合引号宽松兜底（三分支交替，`TAG_ATTR_SOURCE` / `TAG_ATTR_FALLBACK_SOURCE`；
       千千结只有引号感知无兜底，未闭合引号会泄漏——待其 hotfix 合回 main 后同步）；
    ② keep 子树内自闭合一律原样保留、extra 同名自闭合删除；
    ③ collectKept / renderKeptInner 的 extra 恒优先结构（闭合/未闭合/`[[...]]` extra 包裹 keep 整块删；
       keep 与 extra 同名时按 extra 优先——新配置由 index.js 保存校验拒绝，此处为历史脏数据兜底）。
  - **未闭合 extra 的围堵语义（金样锁定，有意设计，勿当 bug 改）**：规则 = 吞到最后一个同名闭合、
    仅保留其后残段；全程无同名闭合才吞到文末（`residueAfterLastSameNameClose`）。设计依据（2026-09-22 与
    作者确认）：孤立开标记与被截断的思维链在字节上不可分、意图不可判定；泄漏是系统性污染（进上下文后
    影响后续每次生成/摘要），误伤是局部且**可恢复**的（清洗只读、楼层原文未动，编辑楼层补一个闭合标签
    即救回正文）——故选围堵。误伤窗口仅限"残缺开标记之后直到文末再无任何同名闭合"这一种情形。
    对照：`[[...]]` 未闭合反而**保留原文不吞**（金样 m1-bracket-unclosed）——`[[` 在正文里常见、误吞风险高，
    按"哪种错误更伤"逐规则定策略，两者都是有意选择。"吞到文末时输出诊断提示"（方案 D）已评估、用户暂未要求，未实现；
    合并时勿把围堵"对齐"成剥壳留内容（那是 M0 对未闭合块的处理，语义不同：M0 剥壳留内容、M1/M3 围堵）。
  - 验证：`node --test memory.sanitizer.test.js` 全绿（金样 40 例逐字节比对 + 四模式语义探针）。
  - `memory.js` 仅剩 re-export：`grep -c 'export { stripTags }' memory.js` 应为 1。
- **`memory.js`**：`disposeJobSignal` + `_jobSignalDisposes` 修复 jobSignal 监听器泄漏。
- **`memory.sanitizer.test.js`**：本地独有测试文件，`node --test memory.sanitizer.test.js` 直接跑。
- **`runtime/settings.js`**：`keepTags` 默认值由上游 `'content'` 改为 `''`（两栏皆空 = 不清洗）。全库不应残留 `keepTags: 'content'`。
- **`index.js`**：设置面板「标签清洗」四模式说明文案 + 默认值回填 `''`。关键字符串：`两栏都留空＝不清洗`、
  `只配此栏即只留各 keep 块的内部内容`、`可穿透进 keep 块内部`。
  另有 `bindTagField` 保存校验：keep/extra 两栏含同名标签（含 `[[...]]`）时拒绝落存、回退旧值并
  `showToast(..., true)` 报错——上游没有，勿"对齐"掉。
- **`business/space/context.test.js`**：本地独有文件（上游没有），`node --test business/space/context.test.js` 直接跑。

## 4. 已主动放弃、不要当成"丢失"补回的改动

- 间·意图识别中"解释性提问判为 discuss"的早期本地实现，在合并上游 v3.6.5 时**整体取上游版本**放弃
  （上游已实现同题规则 `PURE_EXPLANATION_RX` / `EXPLICIT_EXPLANATION_RX` / `EXPLICIT_GREETING_RX`）。
  `business/space/context.js` 应保持**与上游逐字节一致**，不要为对齐本地早期逻辑而改它。

## 5. 合并验证清单（不污染工作区）

1. `git fetch --all`，`git rev-list --left-right --count HEAD...upstream/master` 看领先/落后，`git merge-base` 找基准。
2. `git merge-tree --write-tree HEAD upstream/master` 复算冲突与合并树（输出 tree 可用于后续比对，不碰工作区）。
3. 逐文件核对本地资产：见第 3 节（stripTags 逐字节一致、keepTags `''`、文案、context.test.js 仍在）。
4. **无静默吞改动**的两道反向校验：
   - 合并结果相对 `upstream/master` 应只差 10 个本地产权文件：`.gitignore` / `business/space/context.test.js` /
     `index.js` / `manifest.json` / `memory.js` / `memory.md` / `memory.sanitizer.test.js` / `runtime/settings.js` /
     `runtime/tag-sanitizer.js` / `runtime/tag-sanitizer.golden.json`
     （`git diff --stat upstream/master <tree>`）。
   - 合并结果相对本地 `HEAD` **新增**的每一行都应能在 `upstream/master` 找到来源（逐行 `sort -u` + `comm -13`，排除 `<<<<<<<` 标记行）。
   - 本地相对 merge-base（上次合并版本）**新增**且被合并掉落的行应为 0（`comm -23` 比对"本地新增行集合"与"合并结果"）。
5. 在合并树上跑测试：`git archive <tree> | tar -x -C /tmp/merged`，再 `node --test` 6 个文件
   （`memory.sanitizer.test.js` / `business/axis/axis.test.js` / `business/lines/lines.test.js` /
   `business/point/point.test.js` / `business/space/context.test.js` / `business/memory/qianqianjie.test.js`）。
   落地后于 `master` 再跑一遍确认（v3.7.8moon 基线 148 用例全绿；`qianqianjie.test.js` 是上游 3.7.7 带入的
   上游文件，非本地产权，仅用于回归）。
6. 解冲突后 `git grep '^<<<<<<<'` 确认零标记残留；`git diff --stat vX.Y.Z` 应只剩那 10 个本地产权文件。

> **千千结侧备忘**：`ST-MyriadKnots/src/memory-content-sanitizer.js` 已同步三分支兜底正则（`bc06be1` 后两边清洗器逐字节一致，已跑两仓对拍全绿）；其 hotfix 分支 `hotfix/regenerate-receipt-reuse` 上有部分相关实现，合并回 main 时注意序号冲突处理。

## 6. 当前状态（执行合并任务时以 `git status` / `git log` 为准）

- 本地 `master` 已合并上游至 `3.7.8moon`
  （合并提交 `a085c37`，上游 lightweight qqj recall）。
- 2026-09-22 完成清洗器三项强化 + 泄漏修复：引号感知属性正则（含未闭合引号兜底）、
  keep 子树内 self-closing extra 删除、extra 恒优先结构（修闭合/`[[...]]` extra 包裹 keep 的泄漏）、
  同名 keep/extra 走 extra 优先 + index.js 设置保存校验；金样 29→40 例。
