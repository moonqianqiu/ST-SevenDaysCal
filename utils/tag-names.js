// 标签名规则：纯函数，不依赖酒馆运行时，供设置 UI 与运行时清洗共同使用。
// 首字符必须是 Unicode 字母；后续主体可含字母、组合附加符号、数字、下划线、连字符。
// 可有一个「~」分隔符，允许位于末尾；非空后缀须先有字母/数字/下划线，
// 随后可含组合附加符号，且继续按保守合同拒绝后缀连字符。
export const TAG_NAME_SOURCE = String.raw`[\p{L}][\p{L}\p{M}\p{N}_-]*(?:~(?:[\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*)?)?`;
export const TAG_NAME_RE = new RegExp(`^${TAG_NAME_SOURCE}$`, 'u');

// 通用字面量包裹规则：`起始...结束`，三个点是配置占位分隔符，前面的是开定界符、后面的是闭定界符，
// 都不是字面文本。`[[...]]` 只是它的一个特例（2026-09-30 自兄弟仓库 ST-MyriadKnots 的 P5 改动同步）。
export const LITERAL_WRAPPER_SEPARATOR = '...';
export const LITERAL_DOUBLE_BRACKET_RULE = `[[${LITERAL_WRAPPER_SEPARATOR}]]`;

// 解析单条包裹规则；三个判断条件与 ST-MyriadKnots 同名函数逐字一致：
// 分隔符不能位于首尾（否则会得到空的开/闭定界符，删除范围失控），且只能出现一次（否则歧义）。
export function literalWrapperRule(value) {
    const text = String(value ?? '').trim();
    const separator = text.indexOf(LITERAL_WRAPPER_SEPARATOR);
    if (separator <= 0
        || separator !== text.lastIndexOf(LITERAL_WRAPPER_SEPARATOR)
        || separator + LITERAL_WRAPPER_SEPARATOR.length >= text.length) return null;
    return Object.freeze({
        start: text.slice(0, separator),
        end: text.slice(separator + LITERAL_WRAPPER_SEPARATOR.length),
    });
}

function unwrapTagName(value) {
    const trimmed = String(value).trim();
    const bracketed = /^<\s*([^<>]+?)\s*>$/u.exec(trimmed);
    return (bracketed ? bracketed[1] : trimmed).trim();
}

export function normalizeTagNames(csv) {
    return String(csv || '').split(',')
        .map(value => unwrapTagName(value).toLowerCase())
        .filter(value => TAG_NAME_RE.test(value));
}

// 包裹符设置沿用标签名的保守合同，并额外接受任意 `起始...结束` 字面量包裹规则。
// 包裹规则原样保留（不 lowercase，定界符大小写敏感），标签名照旧小写归一。
export function normalizeTagRules(csv) {
    return String(csv || '').split(',')
        .map(value => unwrapTagName(value))
        .filter(value => literalWrapperRule(value) !== null || TAG_NAME_RE.test(value))
        .map(value => (literalWrapperRule(value) !== null ? value : value.toLowerCase()));
}
