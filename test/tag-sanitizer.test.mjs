import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { normalizeTagRules } from '../utils/tag-names.js';
// 本地适配：上游从此文件直接 import '../memory.js'，而 memory.js 顶部导入 SillyTavern 运行时
// （../../../extensions.js、../../../../script.js），裸检出下不可解析（纯上游树同样 ERR_MODULE_NOT_FOUND）。
// 本仓其余测试一律 import '../runtime/tag-sanitizer.js'；memory.js 的 stripTags 本就是对该模块的
// 纯 re-export（import + export，无包装），故改为直连模块语义等价，且使测试在本环境可运行。
import { stripTags } from '../runtime/tag-sanitizer.js';
import { selectVisibleChatHistory } from '../business/lines/history.js';
import { sanitizeGenerationContextText } from '../runtime/generation-context.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexSource = fs.readFileSync(path.join(repo, 'index.js'), 'utf8');

function productionRegion(startMarker, endMarker) {
    const start = indexSource.indexOf(startMarker);
    const end = indexSource.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `production source region found: ${startMarker}`);
    return indexSource.slice(start, end);
}

test('paired named wrappers are kept verbatim as literal wrapper rules', () => {
    // 本仓合同（AGENTS §2.1）：包裹规则「原样保留、大小写敏感」，不做 lower 归一，也不限定
    // 必须是 [name]...[/name] 形态——上游 v3.9.1 改为 lower + 仅接受合法标签名的成对括号。
    // 本仓是上游方案的超集（任意「起始...结束」），故命名中括号同样按字面量规则原样保留。
    assert.deepEqual(normalizeTagRules(' [DRAFT]...[/DRAFT], [状态]...[/状态], think, [[...]]'), [
        '[DRAFT]...[/DRAFT]', '[状态]...[/状态]', 'think', '[[...]]',
    ]);
    assert.deepEqual(normalizeTagRules('[draft]..[/draft], ...abc, abc..., a...b...c'), []);
    assert.deepEqual(normalizeTagRules('{{...}},<<...>>,[a.b]...[/a.b]'), ['{{...}}', '<<...>>', '[a.b]...[/a.b]']);
});

test('configured paired wrappers remove complete multiline blocks including kept content', () => {
    // 本仓合同：定界符大小写敏感（AGENTS §2.1），故配置与正文必须同大小写；
    // 上游 v3.9.1 起定界符大小写不敏感（[/dRaFt] 亦能被 [draft]...[/draft] 闭合）。
    const raw = '前[DRAFT]草稿一\n<content>重复正文</content>\n[/DRAFT]中[状态]私有\n内容[/状态]后';
    assert.equal(stripTags(raw, { extraTags: '[DRAFT]...[/DRAFT],[状态]...[/状态]' }), '前中后');
});

test('configured paired wrappers handle adjacent and nested blocks with keep-list priority', () => {
    const raw = '前[DRAFT]外层[DRAFT]内层[/draft]尾声[/DRAFT][状态]隐私[/状态]后';
    assert.equal(stripTags(raw, { extraTags: '[DRAFT]...[/DRAFT],[状态]...[/状态]' }), '前后');
    // 本仓 M3 合同：extra 恒优先、可穿透 keep 子树（AGENTS §3.1）。同名规则同时进两栏时
    // extra 胜出、整块剔除，而非上游的「keep 清单优先」救援语义。
    assert.equal(stripTags(raw, {
        keepTags: '[DRAFT]...[/DRAFT]',
        extraTags: '[DRAFT]...[/DRAFT],[状态]...[/状态]',
    }), '');
});

test('paired wrapper rules are opt in and leave unclosed wrappers intact', () => {
    // 本仓 M0 合同：两栏皆空时配对标签连标记一起保留（上游缺省 keep='content' 会剥掉 <content> 壳）。
    const raw = '前[DRAFT]<content>正文</content>[/DRAFT]后';
    assert.equal(stripTags(raw), '前[DRAFT]<content>正文</content>[/DRAFT]后');
    assert.equal(stripTags('前[DRAFT]未闭合\n后文', { extraTags: '[DRAFT]...[/DRAFT]' }), '前[DRAFT]未闭合\n后文');
});

test('XML closing tags do not close a same-named bracket wrapper', () => {
    assert.equal(stripTags('[draft]甲</draft>乙[/draft]', { extraTags: '[draft]...[/draft]' }), '');
});

test('unclosed bracket wrappers inside stripped XML follow rescue-only rendering', () => {
    // 本仓 M1 合同：extra 块连同内部内容一并删除，不做「保留子标签救援」（AGENTS §3.1）；
    // 上游对 XML/[[...]] 内明确保留的子标签执行 rescue-only 渲染。
    assert.equal(stripTags('<thinking>普通噪音[draft]更多噪音</thinking>', {
        extraTags: 'thinking,[draft]...[/draft]',
    }), '');
    assert.equal(stripTags('<thinking>[draft]普通噪音<content>保留正文</content></thinking>', {
        extraTags: 'thinking,[draft]...[/draft]',
    }), '');
});

test('paired wrapper rule keeps legacy XML rescue and double bracket contracts', () => {
    assert.equal(stripTags('<thinking><content>旧正文</content></thinking>', { extraTags: 'thinking' }), '');
    // 本仓 M2 合同：keep 块之外的裸文本全部剔除（上游保留块外正文）。
    assert.equal(stripTags('前[[旧正文]]后', { keepTags: '[[...]]' }), '旧正文');
    assert.equal(stripTags('前[[隐藏]]后', { extraTags: '[[...]]' }), '前后');
    // 本仓 M3 合同：extra 恒优先，[[...]] 整块剔除，不救援内部 <content>。
    assert.equal(stripTags('前[[噪音<content>救回</content>]]后', {
        keepTags: 'content', extraTags: '[[...]]',
    }), '');
});

test('settings input and change persist normalized wrapper syntax and refill the field', () => {
    const region = productionRegion('function sanitizeTagList(raw) {', "$in('#sp-custom-prompt')");
    const handlers = {};
    const settings = { extraTags: '' };
    let saves = 0;
    const input = {
        on: (event, handler) => { handlers[`#sp-mem-extratags:${event}`] = handler; return input; },
    };
    const bind = vm.runInNewContext(`${region}\nbindTagField`, {
        $in: () => input,
        getSettings: () => settings,
        normalizeTagRules,
        saveSettingsDebounced: () => { saves++; },
        stSaveSettings() {},
    });
    bind('#sp-mem-extratags', 'extraTags');
    const field = { value: ' [DRAFT]...[/DRAFT], think ' };
    handlers['#sp-mem-extratags:input'].call(field);
    // 本仓合同：包裹规则原样保留、大小写敏感（AGENTS §2.1）；上游会 lower 归一为 [draft]...[/draft]。
    assert.equal(settings.extraTags, '[DRAFT]...[/DRAFT],think');
    handlers['#sp-mem-extratags:change'].call(field);
    assert.equal(field.value, '[DRAFT]...[/DRAFT],think');
    assert.equal(settings.extraTags, field.value);
    assert.equal(saves, 2);

    const readback = productionRegion("$in('#sp-mem-keeptags').val(typeof s.keepTags", "$in('#sp-custom-prompt')");
    const rendered = {};
    vm.runInNewContext(`const s = getSettings();\n${readback}`, {
        getSettings: () => settings,
        $in: selector => ({ val: value => { rendered[selector] = value; } }),
    });
    assert.equal(rendered['#sp-mem-extratags'], '[DRAFT]...[/DRAFT],think');
});

test('production recent generation history excludes configured draft blocks from AI material', () => {
    const region = productionRegion('function buildRecentGenerationHistory(ctx, historyLimit, opts = {}) {', 'function outlineWorldInfoTriggerText(history) {');
    const build = vm.runInNewContext(`${region}\nbuildGenerationHistoryContext`, {
        // 本仓默认 keepTags 为 ''（M0，AGENTS §3.3）；上游缺省 'content'。
        // 该生产链路走 sanitizeGenerationContextText（非裸 stripTags）；定界符大小写敏感，故与正文同大小写。
        getSettings: () => ({ keepTags: '', extraTags: '[DRAFT]...[/DRAFT]' }),
        selectVisibleChatHistory,
        substituteParams: value => String(value ?? ''),
        sanitizeGenerationContextText,
        memory: { stripTags },
    });
    const history = build({ chat: [{ mes: '开头[DRAFT]草稿<content>重复材料</content>[/DRAFT]结尾' }] }, 6).history;
    assert.deepEqual(JSON.parse(JSON.stringify(history)), [{ role: 'assistant', content: '开头结尾' }]);
});
