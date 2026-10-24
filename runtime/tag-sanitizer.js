// 四模式标签清洗器 — 树形实现
// 合同（金样 runtime/tag-sanitizer.golden.json 锁定，源自合并 v3.7.6 前的本地 stripTags）：
//   M0 两栏皆空 = 不清洗：配对块逐字节保留，仅删注释/孤立标记/折空行；
//   M1 仅 extra：extra 配对块连内容删（未闭合走 dropUnclosed：吞至最后同名闭合或 EOF，噪音不泄漏），
//                其余配对块原样、裸文本保留；
//   M2 仅 keep：keep 配对块剥壳、内部逐字保留（不再二次清洗；嵌套 keep 继续剥壳），
//               keep 块之外的一切丢弃，多个 keep 块以空行连接；
//   M3 混合：M2 基础上 extra 恒优先——extra 块（含字面量包裹块）无论处于根层、包裹 keep 块还是
//            嵌在 keep 子树内，一律连内容删；keep 与 extra 配置了同名标签时同样按 extra 优先
//            （设置面板保存时会拒绝此类配置，此处是历史脏数据的兜底语义）。
// 字面量包裹规则：两栏都接受任意 `起始...结束` 形式（如 `[[...]]`、`{{...}}`），
//   在 keep 栏 = 剥壳取内层，在 extra 栏 = 连同定界符整块删除（`[[...]]` 只是其特例）。
//   2026-09-30 自兄弟仓库 ST-MyriadKnots 的 P5 改动同步，四模式函数体与其逐字一致。
// 实现：吸收上游 v3.7.6 的单遍 token 树（parseSanitizerTree 思路），
//   节点额外记录 openRaw/closeRaw 以支持 M0/M1 的逐字节复现；渲染层完全按上表合同重写。
//   token 正则引号感知（属性值内允许 `>`），未闭合引号由宽松兜底分支接管（与旧正则一致，
//   噪音不泄漏）；keep 子树内自闭合标记：extra 删、其余原样保留。
import { literalWrapperRule, normalizeTagRules, TAG_NAME_SOURCE } from '../utils/tag-names.js';

const OPEN_NAME_RX = new RegExp(`^<\\/?(?:(${TAG_NAME_SOURCE}))`, 'u');
const SELF_CLOSING_RX = /\/\s*>$/u;
const COMMENT_RX = /<!--[\s\S]*?-->/g;

// 属性段引号感知（双/单引号值内允许 `>`），避免 <div title="a>b"> 在首个 `>` 截断。
// 交替顺序安全：兜底分支 [^>]* 永不跨过 `>`，引号感知分支可跨过引号内 `>`，
// 两者同时命中时后者不长于前者，故兜底仅在引号感知整体失配（未闭合引号 + 后续 `>`）时接管，
// 等价于回退旧正则行为（token 止于首个 `>`，extra 仍被吞、噪音不泄漏）。
const TAG_ATTR_SOURCE = String.raw`(?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*`;
const TAG_ATTR_FALLBACK_SOURCE = String.raw`(?:\s[^>]*)?`;

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 标签仍优先识别；字面量定界符独立成 token，最长定界符优先，避免短前缀抢占。
// 仅字面量分支有捕获组，且大小写敏感。
function freshTokenRx(wrapperRules = []) {
    const delimiters = [...new Set(wrapperRules.flatMap(rule => [rule.start, rule.end]))]
        .sort((a, b) => b.length - a.length);
    const wrapperPart = delimiters.length ? `|(${delimiters.map(escapeRegExp).join('|')})` : '';
    return new RegExp(
        `<\\/?${TAG_NAME_SOURCE}${TAG_ATTR_SOURCE}\\s*\\/?>`
        + `|<\\/?${TAG_NAME_SOURCE}${TAG_ATTR_FALLBACK_SOURCE}\\/?>`
        + wrapperPart, 'gu');
}

// 先配平字面量包裹，再建树：未闭合的开/闭定界符保持文本，不能吞至 EOF。
// 相同开/闭定界符优先关闭当前包裹；同开定界符规则沿用 collectWrapperRules 的优先级。
function pairWrapperTokens(tokens, wrapperRules) {
    const starts = new Map();
    for (const rule of wrapperRules) if (!starts.has(rule.start)) starts.set(rule.start, rule);
    const stack = [], openings = new Map(), closings = new Map();
    tokens.forEach((match, index) => {
        if (match[1] === undefined) return;
        const token = match[0];
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].rule.end !== token) continue;
            const opening = stack[i];
            openings.set(opening.index, { rule: opening.rule, closeIndex: index });
            closings.set(index, opening.index);
            stack.length = i;
            return;
        }
        const rule = starts.get(token);
        if (rule) stack.push({ rule, index });
    });
    return { openings, closings };
}

// XML 与字面量包裹共享节点树，包裹边界隔离内部 XML，避免内层闭合标签越界。
// 节点保留原始定界符；根层孤立 XML 闭合标记仍按原合同清理。
function parseSanitizerTree(text, wrapperRules = []) {
    const root = { kind: 'root', name: '', normalized: '', closed: true, selfClosing: false, openRaw: '', closeRaw: '', children: [] };
    const stack = [root];
    const tokens = [...text.matchAll(freshTokenRx(wrapperRules))];
    const { openings, closings } = pairWrapperTokens(tokens, wrapperRules);
    let cursor = 0;
    tokens.forEach((match, index) => {
        const parent = stack[stack.length - 1];
        if (match.index > cursor) parent.children.push(text.slice(cursor, match.index));
        const token = match[0];
        const opening = openings.get(index);
        if (opening) {
            const node = {
                kind: 'wrapper', name: opening.rule.raw, normalized: opening.rule.raw,
                closed: true, selfClosing: false, openRaw: token, closeRaw: opening.rule.end,
                openingIndex: index, children: [],
            };
            parent.children.push(node);
            stack.push(node);
        } else if (closings.has(index)) {
            const openingIndex = closings.get(index);
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].kind !== 'wrapper' || stack[i].openingIndex !== openingIndex) continue;
                stack.length = i;
                break;
            }
        } else if (match[1] !== undefined) {
            parent.children.push(token);
        } else if (token.startsWith('</')) {
            const norm = (OPEN_NAME_RX.exec(token)?.[1] || '').toLowerCase();
            let matched = false, scopeRoot = 0;
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].kind === 'wrapper') { scopeRoot = i; break; }
                if (stack[i].normalized === norm) {
                    stack[i].closed = true;
                    stack[i].closeRaw = token;
                    stack.length = i;
                    matched = true;
                    break;
                }
            }
            if (!matched && stack.length > scopeRoot + 1) parent.children.push(token);
        } else if (SELF_CLOSING_RX.test(token)) {
            parent.children.push({
                kind: 'xml', name: OPEN_NAME_RX.exec(token)?.[1] || '', normalized: (OPEN_NAME_RX.exec(token)?.[1] || '').toLowerCase(),
                closed: true, selfClosing: true, openRaw: token, closeRaw: '', children: [],
            });
        } else {
            const name = OPEN_NAME_RX.exec(token)?.[1] || '';
            const node = { kind: 'xml', name, normalized: name.toLowerCase(), closed: false, selfClosing: false, openRaw: token, closeRaw: '', children: [] };
            parent.children.push(node);
            stack.push(node);
        }
        cursor = match.index + token.length;
    });
    stack[stack.length - 1].children.push(text.slice(cursor));
    return root;
}

// 配置名集合：同时收录原样与小写形式，保证与本地 'giu' 正则一致的大小写不敏感匹配。
function toRuleSet(list) {
    const set = new Set();
    for (const name of list) { set.add(name); if (!literalWrapperRule(name)) set.add(name.toLowerCase()); }
    return set;
}

// 从 keep/extra 两栏收集字面量包裹规则（去重后按开定界符长度降序，防止短前缀抢走长定界符的匹配）。
function collectWrapperRules(keep, extra) {
    const rules = [];
    const seen = new Set();
    for (const item of [...keep, ...extra]) {
        const parsed = literalWrapperRule(item);
        if (!parsed || seen.has(item)) continue;
        seen.add(item);
        rules.push(Object.freeze({ ...parsed, raw: item }));
    }
    return rules.sort((a, b) => b.start.length - a.start.length);
}

// dropUnclosed（未闭合 extra 的本地语义）：子树内若存在同名闭合（取最后一个），
// 吞掉从头到该闭合为止的一切、仅保留其后残段；否则整块吞掉（吞至 EOF，噪音不泄漏）。
function residueAfterLastSameNameClose(node, render) {
    let last = -1;
    for (let i = node.children.length - 1; i >= 0; i--) {
        const c = node.children[i];
        if (typeof c !== 'string' && c.kind === 'xml' && c.closed && !c.selfClosing && c.normalized === node.normalized) { last = i; break; }
    }
    if (last < 0) return '';
    return render(node.children.slice(last + 1));
}

// M0/M1 渲染：裸文本保留；extra 配对删；其余配对块逐字节复现；孤立/自闭合标记删。
function renderFlat(children, extraSet) {
    let out = '';
    for (const child of children) {
        if (typeof child === 'string') { out += child; continue; }
        if (child.kind === 'wrapper') {
            if (extraSet.has(child.name)) continue;
            out += child.openRaw + renderFlat(child.children, extraSet) + child.closeRaw;
            continue;
        }
        if (child.selfClosing) continue;
        if (child.closed) {
            if (extraSet.has(child.normalized)) continue;
            out += child.openRaw + renderFlat(child.children, extraSet) + child.closeRaw;
        } else if (extraSet.has(child.normalized)) {
            out += residueAfterLastSameNameClose(child, rest => renderFlat(rest, extraSet));
        } else {
            out += renderFlat(child.children, extraSet);
        }
    }
    return out;
}

// keep 子树内部渲染（M2/M3）：extra 恒优先（同名 keep/extra 也按 extra 删）；嵌套 keep 剥壳；
// 其余逐字保留。自闭合标记：extra 删、其余原样保留 openRaw（合同「keep 内部不再二次清洗」，
// keep 同名的自闭合标记如 <content/> 同样原样保留，而非按 keep 剥壳吞掉）；未闭合非 extra 块保留标记与内容。
function renderKeptInner(children, keepSet, extraSet) {
    let out = '';
    for (const child of children) {
        if (typeof child === 'string') { out += child; continue; }
        if (child.kind === 'wrapper') {
            if (extraSet.has(child.name)) continue;
            if (keepSet.has(child.normalized)) { out += renderKeptInner(child.children, keepSet, extraSet); continue; }
            out += child.openRaw + renderKeptInner(child.children, keepSet, extraSet) + child.closeRaw;
            continue;
        }
        if (child.selfClosing) {
            if (!extraSet.has(child.normalized)) out += child.openRaw;
            continue;
        }
        if (child.closed) {
            if (extraSet.has(child.normalized)) continue;
            if (keepSet.has(child.normalized)) { out += renderKeptInner(child.children, keepSet, extraSet); continue; }
            out += child.openRaw + renderKeptInner(child.children, keepSet, extraSet) + child.closeRaw;
        } else if (extraSet.has(child.normalized)) {
            out += residueAfterLastSameNameClose(child, rest => renderKeptInner(rest, keepSet, extraSet));
        } else {
            out += child.openRaw + renderKeptInner(child.children, keepSet, extraSet);
        }
    }
    return out;
}

// M2/M3 根收集：只输出 keep 配对块的内部内容（裸文本丢弃）；extra 块（闭合/未闭合/字面量包裹）
// 一律整块跳过不下探——extra 恒优先，被 extra 包裹的 keep 块视同噪音删除；其余非 keep 块下探搜寻。
function collectKept(children, keepSet, extraSet, out) {
    for (const child of children) {
        if (typeof child === 'string') continue;
        if (extraSet.has(child.normalized)) continue;
        if (child.closed && keepSet.has(child.normalized)) { out.push(renderKeptInner(child.children, keepSet, extraSet)); continue; }
        collectKept(child.children, keepSet, extraSet, out);
    }
}

// 签名与旧 memory.js:stripTags 完全一致：stripTags(raw, { keepTags, extraTags })。
export function stripTags(raw, opts = {}) {
    if (!raw) return '';
    const keep  = normalizeTagRules(opts.keepTags  ?? '');
    const extra = normalizeTagRules(opts.extraTags ?? '');
    const keepSet = toRuleSet(keep);
    const extraSet = toRuleSet(extra);
    const wrapperRules = collectWrapperRules(keep, extra);
    const s = String(raw).replace(COMMENT_RX, '');
    const root = parseSanitizerTree(s, wrapperRules);
    let out;
    if (keep.length) {
        const parts = [];
        collectKept(root.children, keepSet, extraSet, parts);
        out = parts.join('\n\n');
    } else {
        out = renderFlat(root.children, extraSet);
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
}
