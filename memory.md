# 构画 · Moon 定制版 — 项目记忆（供维护与 CLI 参考）

本仓库是 [`atonal519/ST-SevenDaysCal`](https://github.com/atonal519/ST-SevenDaysCal) 的 fork（作者 moon 定制版），在 `master` 分支上跟踪上游最新基线，并叠加了“moon”专属改动。`origin = moonqianqiu/ST-SevenDaysCal`，`upstream = atonal519/ST-SevenDaysCal`。

> **用途**：供后续会话/开发者在执行“合并上游”、“冲突裁决”、“代码维护”时，迅速掌握本 fork 的核心定制、版本惯例、冲突裁决规则以及架构设计决策，确保合并上游时不丢弃本地核心资产。

---

## 1. 同步与版本惯例

1. **版本号命名规范 (`manifest.json`)**：
   - 格式强制规范：`version` = 上游版本号 + `moon` 后缀（当前已同步至 **`3.7.11moon`**）；
   - 每次合并上游必然在 `manifest.json` 的 `version` 行发生冲突，直接按此惯例解决为 `X.Y.Zmoon`。
2. **分支与合并安全策略**：
   - 合并上游前先建立备份分支：`git branch backup/master-before-upstream-vX.Y.Z master`；
   - 在 `master` 分支执行 `--no-ff` 合并：`git merge --no-ff upstream/master`；
   - 本地合并与自动化测试未完全通过前，严禁向远程 force push。

---

## 2. 合并冲突热区与标准裁决表（合并上游必查）

每次合并上游发布版本时，通常仅在以下 2 个文件产生物理冲突，其余 30+ 业务文件绝大部分均由 Git 3-way 算法自动平滑合并：

| 文件路径 | 冲突性质 | 解决裁决方式与保护要点 |
| :--- | :--- | :--- |
| `manifest.json` | `version` 版本行冲突 | 直接采纳为最新 `X.Y.Zmoon`（如 `3.7.11moon`） |
| `memory.js` | 状态声明区与 `jobSignal` 注释冲突 | **必须严格保留本地资产**：<br>1. 保留 `const _jobSignalDisposes = new WeakMap();`<br>2. 保留 `disposeJobSignal` 生命周期双向清理协议说明<br>3. 维持 `stripTags` re-export 状态，严禁退回上游旧正则<br>4. 吸收上游新特性（隐藏 AI 楼纳入、确认式落盘 `persistConfirmed`、完整性分类统计） |

> **隐藏规则（易误判，合并时留意）——双中括号 `[[...]]`**：
> `LITERAL_DOUBLE_BRACKET_RULE = '[[...]]'` 定义于 `utils/tag-names.js`（上游文件）。它**不属于普通标签名正则**（`[` 非字母），但在清洗器中承担真实语义——用户填 `[[...]]` 即对双中括号包裹块做清洗（keep 剥壳取内、extra 连内容删、支持嵌套与穿透）。**不要因为其不符合 XML 标签形态就当作无效规则删改**，保持与上游一致即可。

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
  - **三分支 token 正则**：`TAG_ATTR_SOURCE`（属性引号感知，值内 `>` 不截断）+ `TAG_ATTR_FALLBACK_SOURCE`（未闭合引号宽松兜底，等价旧正则截断行为，防止思维链泄漏）+ `[[...]]`；
  - **自闭合标记**：keep 子树内自闭合 extra 标记连标记删除，非 extra 保留 `openRaw`。
- **金样锁定**：
  - 行为由 `runtime/tag-sanitizer.golden.json`（40 组金样）绝对锁定；
  - 与兄弟仓库 `ST-MyriadKnots` 保持 100% 逐字节一致（两仓对拍 0 差异）。

### 3.2 `_jobSignalDisposes` 监听器防泄漏闭环（`memory.js`）
- **上游缺陷背景**：
  上游虽然在绑定 relay 监听器时添加了 `{ once: true }`，但该参数仅在真正触发 abort 时生效；在 99% 正常成功完成的请求中，`abort` 事件永不触发，导致未触发的监听器永久残留在长生命周期的 `_jobAbortController.signal` 上，随着批量重构或长时对话产生严重的闭包累积与内存泄漏。
- **本地治本实现**：
  - 维护 `const _jobSignalDisposes = new WeakMap();` 记录双向清理函数；
  - 导出 `export function disposeJobSignal(signal)`；
  - 在 `runL0` 与 `runL1` 的 `fetchGroupSummary` / `fetchChapterSummary` 外部包裹 `try ... finally { disposeJobSignal(signal); }`，实现无论成功还是失败，零监听器残留。必须誓死保住。

### 3.3 标签清洗设置项与 UI 保存校验
- **默认值保护 (`runtime/settings.js`)**：
  - `keepTags` 默认值必须为 `''`（两栏皆空 = 不清洗，全库严禁残留 `keepTags: 'content'` 默认）。
- **设置面板与保存拦截器 (`index.js`)**：
  - 设置面板文案必须包含关键指导字符串：`两栏都留空＝不清洗`、`只配此栏即只留各 keep 块的内部内容`、`可穿透进 keep 块内部`；
  - `bindTagField` 保存校验：用户在保留/剔除两栏配置同名标签时，失焦自动求归一化交集（含 `[[...]]`），命中时**拒绝落存、输入框回退旧值**，并弹出 `showToast(..., true)` 错误提示，从源头杜绝非法配置存盘。

### 3.4 本地专属单元测试文件
- `memory.sanitizer.test.js`：清洗器 40 例金样逐字节比对 + 四模式语义探针；
- `business/space/context.test.js`：空间意图识别与结构化卡片单测（上游没有）。

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
   合并结果相对 `upstream/master` 应只差以下 **10 个本地产权文件**（`git diff --stat upstream/master`）：
   `.gitignore`、`business/space/context.test.js`、`index.js`、`manifest.json`、`memory.js`、`memory.md`、`memory.sanitizer.test.js`、`runtime/settings.js`、`runtime/tag-sanitizer.js`、`runtime/tag-sanitizer.golden.json`。
3. **全量自动化测试回归套件**：
   ```bash
   node --test memory.sanitizer.test.js business/space/context.test.js business/axis/axis.test.js business/lines/lines.test.js business/point/point.test.js business/memory/qianqianjie.test.js
   ```
   *标准*：**148/148 全部全绿（通过率 100%，0 失败）**。
4. **与 ST-MyriadKnots 跨仓终验对拍**：
   运行 40 例金样跨仓比对脚本，验证与 `ST-MyriadKnots/src/memory-content-sanitizer.js` 输出 **0 差异、100% 逐字节一致**。

---

## 6. 当前仓库状态底数（基线备忘）

- **当前分支**：`master`
- **跟踪上游基线**：已合入 `upstream/master`（Tag: `v3.7.11`，提交 `2995942`）；
- **当前版本**：`manifest.json` 版本号 **`3.7.11moon`**；
- **最近提交历史**：
  - `7ea9c4d`：`merge: integrate upstream v3.7.11`（面内讨论读取所选记忆源、收藏按钮与编辑按钮同栏直显）；
  - `2ad69f1`：`merge: integrate upstream v3.7.10`（坐标入口多选配置与自定义历法分槽防崩）；
  - `88f45b4`：`merge: integrate upstream v3.7.9`（隐藏 AI 楼纳入长期记忆、确认式落盘与中断保护、剧情倾向）；
  - `bc06be1`：清洗器三项强化与泄漏修复（三分支正则、40 例金样、同名 UI 校验）；
- **兄弟仓库同步**：`ST-MyriadKnots` 已同步至 v0.4.3，召回回执重新生成已治本修复（秒级复用），两仓清洗器保持 100% 逐字节一致。
