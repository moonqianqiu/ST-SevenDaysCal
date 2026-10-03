// 本地最小 RFC 6902 JSON Patch 实现（compare + applyPatch），仅服务于单元测试。
// 背景：上游 v3.7.15 的 business/lines/save-transaction.test.js 以
// '../../../../../util/fast-json-patch.js' 引用作者机器本地工作区文件，该路径越出仓库根、
// 上游仓库亦未携带此文件，导致该测试在纯上游检出中即无法运行（红测试归因经 worktree 复跑坐实）。
// 本文件为本地补齐，测试侧引用路径已本地适配为 '../../util/fast-json-patch.js'；
// 后续合并若上游自带 util/fast-json-patch.js，以上游版本为准并回收本文件。

const MISSING = Symbol('json-pointer-missing');

function escapeToken(token) {
    return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapeToken(token) {
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function parsePointer(pointer) {
    if (pointer === '') return [];
    if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
        throw new Error(`Invalid JSON pointer: ${String(pointer)}`);
    }
    return pointer.slice(1).split('/').map(unescapeToken);
}

function isObject(value) {
    return value !== null && typeof value === 'object';
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (!isObject(a) || !isObject(b)) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((value, index) => deepEqual(value, b[index]));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

function getAt(document, pointer) {
    let current = document;
    for (const token of parsePointer(pointer)) {
        if (!isObject(current)) return MISSING;
        if (Array.isArray(current)) {
            const index = Number(token);
            if (!Number.isInteger(index) || index < 0 || index >= current.length) return MISSING;
            current = current[index];
        } else if (!Object.hasOwn(current, token)) {
            return MISSING;
        } else {
            current = current[token];
        }
    }
    return current;
}

function parentAndToken(document, pointer) {
    const tokens = parsePointer(pointer);
    if (tokens.length === 0) throw new Error(`Cannot apply patch to document root: ${pointer}`);
    const parentPointer = tokens.slice(0, -1).map(token => `/${escapeToken(token)}`).join('');
    const parent = getAt(document, parentPointer);
    if (!isObject(parent)) throw new Error(`Patch path not found: ${pointer}`);
    return { parent, token: tokens[tokens.length - 1] };
}

function applyOperation(document, operation) {
    if (!isObject(operation) || typeof operation.op !== 'string' || typeof operation.path !== 'string') {
        throw new Error(`Invalid patch operation: ${JSON.stringify(operation)}`);
    }
    const { parent, token } = parentAndToken(document, operation.path);
    if (Array.isArray(parent)) {
        const isAppend = token === '-';
        const index = isAppend ? parent.length : Number(token);
        if (!Number.isInteger(index) || index < 0 || index > parent.length) {
            throw new Error(`Array index out of bounds: ${operation.path}`);
        }
        switch (operation.op) {
            case 'add':
                if (isAppend) parent.push(structuredClone(operation.value));
                else parent.splice(index, 0, structuredClone(operation.value));
                return;
            case 'replace':
                if (index >= parent.length) throw new Error(`Array index not found: ${operation.path}`);
                parent[index] = structuredClone(operation.value);
                return;
            case 'remove':
                if (index >= parent.length) throw new Error(`Array index not found: ${operation.path}`);
                parent.splice(index, 1);
                return;
        }
    } else {
        switch (operation.op) {
            case 'add':
            case 'replace':
                if (operation.op === 'replace' && !Object.hasOwn(parent, token)) {
                    throw new Error(`Replace target not found: ${operation.path}`);
                }
                parent[token] = structuredClone(operation.value);
                return;
            case 'remove':
                if (!Object.hasOwn(parent, token)) throw new Error(`Remove target not found: ${operation.path}`);
                delete parent[token];
                return;
        }
    }
    switch (operation.op) {
        case 'move': {
            if (typeof operation.from !== 'string') throw new Error('Move requires "from"');
            const value = getAt(document, operation.from);
            if (value === MISSING) throw new Error(`Move source not found: ${operation.from}`);
            applyOperation(document, { op: 'remove', path: operation.from });
            applyOperation(document, { op: 'add', path: operation.path, value });
            return;
        }
        case 'copy': {
            if (typeof operation.from !== 'string') throw new Error('Copy requires "from"');
            const value = getAt(document, operation.from);
            if (value === MISSING) throw new Error(`Copy source not found: ${operation.from}`);
            applyOperation(document, { op: 'add', path: operation.path, value });
            return;
        }
        case 'test': {
            const actual = getAt(document, operation.path);
            if (actual === MISSING || !deepEqual(actual, operation.value)) {
                throw new Error(`Test operation failed: ${operation.path}`);
            }
            return;
        }
        default:
            throw new Error(`Unsupported patch operation: ${operation.op}`);
    }
}

export function applyPatch(document, patch) {
    const newDocument = structuredClone(document);
    if (!Array.isArray(patch)) throw new Error('Patch must be an array of operations');
    for (const operation of patch) applyOperation(newDocument, operation);
    return { newDocument };
}

function diff(pointer, a, b, operations) {
    if (deepEqual(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
        operations.push({ op: 'replace', path: pointer, value: structuredClone(b) });
        return;
    }
    if (isObject(a) && isObject(b)) {
        for (const key of Object.keys(a)) {
            if (!Object.hasOwn(b, key)) operations.push({ op: 'remove', path: `${pointer}/${escapeToken(key)}` });
        }
        for (const key of Object.keys(a)) {
            if (Object.hasOwn(b, key)) diff(`${pointer}/${escapeToken(key)}`, a[key], b[key], operations);
        }
        for (const key of Object.keys(b)) {
            if (!Object.hasOwn(a, key)) operations.push({ op: 'add', path: `${pointer}/${escapeToken(key)}`, value: structuredClone(b[key]) });
        }
        return;
    }
    operations.push({ op: 'replace', path: pointer, value: b === undefined ? null : structuredClone(b) });
}

export function compare(a, b) {
    const operations = [];
    diff('', a, b, operations);
    return operations;
}
