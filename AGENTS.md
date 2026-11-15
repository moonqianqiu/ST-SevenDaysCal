# 构画 · Moon 定制版 — Agent 手册

本仓库是 [`atonal519/ST-SevenDaysCal`](https://github.com/atonal519/ST-SevenDaysCal) 的 fork（moon 定制版），在 `master` 分支上跟踪上游最新基线，并叠加 moon 专属改动；`origin = moonqianqiu/ST-SevenDaysCal`，`upstream = atonal519/ST-SevenDaysCal`。本文件只保留**红线、资产清单、文档地图、门禁与当前状态**——细节按下方地图查对应文档，**不要往本文件堆积内容**（保持 <10KB，超限即外移）。

> **注意**：上游自带 `AGENTS.md`（随发布重写）——合并时本文件冲突**保留 fork 侧骨架**，上游 Agent 合同内容收录进 [`docs/fork/upstream-agent-contract.md`](docs/fork/upstream-agent-contract.md)。

## 红线（违反即返工）

1. **清洗器缺省行为一字不改**：`runtime/tag-sanitizer.js` 四模式合同（M0 直通等）由 40 例金样 + MK 跨仓对拍锁定；`memory.js` 的 `stripTags` 保持对该模块的 re-export，严禁退回上游内联旧正则。
2. **jobSignal 防泄漏闭环不可丢**：`memory.js` 的 `_jobSignalDisposes` WeakMap + `finally disposeJobSignal` 双向清理——上游重写 `runL0`/`runL1` 时必须重新套用；`_callApi` 取并集，**不可取上游内联 `jobSignal()`**。
3. **共享容器 M0 顺序**：`getSettings()` 的 `getWrapperSettings()` 初始化必须在本地默认回填（`keepTags:''`）之后；写入用本仓 `normalizeTagRules`（大小写敏感），不得用 `updateSharedBodyWrappers`。
4. **测试红先归因**：先查 [`docs/fork/merge-playbook.md`](docs/fork/merge-playbook.md) §4（上游发布质量已知模式）+ §6（自动合并静默保留过时适配判据），确认非上游原生红再动本地；全量必须 `--test-isolation=none`（沙箱 EPERM 伪红）。
5. **改源码必须 `npm run build`**（manifest `js` 指向 Rolldown 产物 `gouhua-app.js`）；验证完全通过前严禁向远程 force push。
6. **单一事实源（防复胖）**：合并事实只写 merge-notes；定制契约只写 fork-contracts；上游 Agent 合同只写 upstream-agent-contract；本文件状态块只更新当前值、不追加历史叙述。下方资产清单是导航索引——增删资产须与 fork-contracts 同步。

## 本地核心定制资产清单（Fork 存在的价值——每次合并/维护逐项复核；细节见 fork-contracts 对应节）

| 资产 | 核心文件 | 一句话不变式 |
| :--- | :--- | :--- |
| 四模式标签清洗器 | `runtime/tag-sanitizer.js` + 金样 | 缺省 M0 直通；缺省行为一字不改（40 例金样 + MK 对拍） |
| jobSignal 防泄漏闭环 | `memory.js` | `_jobSignalDisposes` 双向清理，成功失败零监听器残留 |
| 清洗设置 M0 与校验 | `runtime/settings.js`、`index.js` | keepTags 默认 `''`；两栏同名冲突拒绝落存；moon 三句文案 |
| 共享容器本地挂接 | `runtime/settings.js`、`utils/tag-names.js` | 初始化后置 + 大小写敏感归一化写入；tag-names 泛化为上游严格超集 |
| Windows loader 适配测试 | `runtime/store-local-applied.test.js`、`runtime/menu-image-store.test.js`、`runtime/quick-reply-shortcuts-host.test.js` | `pathToFileURL`/`fileURLToPath` 代修不可回退 |
| 本地产权差异清单 | `git diff --name-only upstream/master` | 恰为 merge-playbook §7 所列 16 文件，其余差异逐项解释 |

## 文档地图

| 要做什么 | 读哪里 |
| :--- | :--- |
| 合并上游（流程、版本命名、冲突热区速查、上游已知模式、差异清单、发版注意） | [`docs/fork/merge-playbook.md`](docs/fork/merge-playbook.md) |
| 查某文件为什么与上游不同 / 上游重写后怎么回植 / 勿回植清单 | [`docs/fork/fork-contracts.md`](docs/fork/fork-contracts.md)（卷首含旧 `AGENTS §N` 对照表） |
| 上游自身 Agent 合同（随发布收录） | [`docs/fork/upstream-agent-contract.md`](docs/fork/upstream-agent-contract.md) |
| 查某次合并改了什么 | [`docs/fork/merge-notes.md`](docs/fork/merge-notes.md)（卷首全历史索引表；旧版细节 `git log -p AGENTS.md`） |

**产权规则**：`docs/fork/` 下为本仓本地文档；其余 `docs/**`（axis-point audit、handoffs、superpowers）与根 `debug-sessions/` 均为**上游产权**——勿改名、勿搬动、勿按本地习惯改写。

## 门禁

```bash
# 1) 冲突标记零残留
git grep -n '^<<<<<<<'            # 匹配数必须为 0
# 2) 本地产权差异清单核对（恰为 merge-playbook §7 所列 16 文件）
git diff --name-only upstream/master
# 3) 全量测试（必须 isolation=none——默认隔离 spawn 子进程在沙箱报 EPERM 伪红）
node --test --test-isolation=none '**/*.test.js' 'test/*.test.mjs'   # 当前 642/640 + 1 上游原生红 + 1 skip
# 4) 与 ST-MyriadKnots 跨仓终验对拍
#    40 例金样与 MK src/tag-sanitizer.golden.json 逐字节一致，双实现输出 0 差异
```

测试红先查 merge-playbook §4 归因；发布前按 merge-playbook §8「发版必读」核对发布说明义务（v4.0.0 导入备份提醒 / v3.10.2 白鳥迁回说明）。

## 当前状态（合并/发布后原地更新本节，旧值删除不保留）

- **分支** `master`；**上游基线** v4.2.0（上游提交 `a04995d`）；**当前版本** `manifest.json` = `4.2.0moon`。
- **全量基线**：642/640 + 1 上游原生红（`ledger/ui-refresh` 刻度刷新，单跑 2/2 绿）+ 1 skip（缺宿主源码的 Quick Reply loader 用例）。
- **兄弟仓库**：`ST-MyriadKnots` 已同步至 v1.2.1（含地点标签证据闸门修复）；两仓清洗器金样对拍保持逐字节一致。
