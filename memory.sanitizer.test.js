// runtime/tag-sanitizer.js 四模式清洗器测试
// 1) 金样比对：runtime/tag-sanitizer.golden.json 由重构前的本地 stripTags（栈式实现，
//    memory.js @ merge dde98d9）生成 29 例锁定行为不变；2026-09 引号感知/extra 恒优先/
//    自闭合 extra 修复新增 11 例（29→40），旧 29 例一字未动。
// 2) 语义探针：四模式合同的关键行为显式断言（dropUnclosed 噪音围堵、keep 顺序无关、
//    keep 内部逐字保留、extra 穿透、双中括号规则、引号属性、extra 恒优先）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripTags } from './runtime/tag-sanitizer.js';

const here = dirname(fileURLToPath(import.meta.url));

test('golden baseline: 40 cases byte-identical (29 pre-refactor + 11 quote/extra-priority)', () => {
    const golden = JSON.parse(readFileSync(join(here, 'runtime', 'tag-sanitizer.golden.json'), 'utf8'));
    assert.ok(golden.cases.length >= 40);
    for (const c of golden.cases) {
        const got = stripTags(c.input, { ...c.opts });
        assert.equal(got, c.oldOutput, `case ${c.id}: input=${JSON.stringify(c.input)} opts=${JSON.stringify(c.opts)}`);
    }
});

test('M0 both empty: paired blocks preserved verbatim, hygiene only', () => {
    const opts = { keepTags: '', extraTags: '' };
    assert.equal(stripTags('前文<content>正文</content>后文', opts), '前文<content>正文</content>后文');
    assert.equal(stripTags('前<!--注释--><br/>文<content>正文</content>', opts), '前文<content>正文</content>');
    assert.equal(stripTags('前言<div class="a" data-x="1">正文</div>尾', opts), '前言<div class="a" data-x="1">正文</div>尾');
    assert.equal(stripTags('前</content>文中', opts), '前文中'); // 根层孤立闭合标记吞掉
});

test('M1 extra only: paired extra removed with content, others kept', () => {
    const opts = { keepTags: '', extraTags: 'think' };
    const paired = ['开头', '的一道', '中<content>正文</content>尾'].map(part => part);
    const extra1 = ['<', 'think', '>', '链', '</', 'think', '>'];
    assert.equal(stripTags(paired[0] + extra1[0] + extra1[1] + extra1[2] + extra1[3] + extra1[4] + extra1[5] + extra1[6] + paired[2], opts), paired[0] + paired[2]);
    // 未闭合 extra：吞至 EOF，噪音不泄漏
    const unclosed = ['guard ', '<', 'think', '>', 'abc tail'];
    assert.equal(stripTags(unclosed[0] + unclosed[1] + unclosed[2] + unclosed[3] + unclosed[4], opts), 'guard'); // 末尾 trim
    // 嵌套同名 extra 全部删除
    const nested = ['<', 'think', '>', 'a', '<', 'think', '>', 'b', '</', 'think', '>', 'c', '</', 'think', '>', '后文'];
    assert.equal(stripTags(nested.join(''), opts), '后文');
});

test('M2 keep only: peel wrapper, inner verbatim, outside discarded', () => {
    const opts = { keepTags: 'content', extraTags: '' };
    assert.equal(stripTags('裸文本<content><data>d</data>正文</content>尾巴', opts), '<data>d</data>正文');
    // keep 顺序无关：data,content 与 content,data 同结果
    assert.equal(stripTags('<content><data>dd</data>正文</content>', { keepTags: 'data,content', extraTags: '' }), 'dd正文');
    // 未闭合 keep：内容随外层丢弃
    assert.equal(stripTags('前<content>正文', opts), '');
    // 双中括号 keep：剥壳取内层
    assert.equal(stripTags('x [[a b]] y', { keepTags: '[[...]]', extraTags: '' }), 'a b');
});

test('M3 mixed: extra pierces keep, always wins', () => {
    const opts = { keepTags: 'content', extraTags: 'think' };
    assert.equal(stripTags('裸<content><data>d</data>正文</content>尾', { keepTags: 'content,data', extraTags: 'think' }), 'd正文');
    // extra 穿透 keep 子树
    const pierce = ['<content>', '<', 'think', '>', '链', '</', 'think', '>', '正文', '</content>', '外'];
    assert.equal(stripTags(pierce.join(''), opts), '正文');
    // keep 内未闭合 extra：dropUnclosed 吞掉，keep 块整体为空则不产出
    const unclosedInKeep = ['<content>', '<', 'think', '>', 'abc tail'];
    assert.equal(stripTags(unclosedInKeep.join(''), opts), '');
});

test('case-insensitive and CJK tag names', () => {
    assert.equal(stripTags('<Content>x</Content>', { keepTags: 'content', extraTags: '' }), 'x');
    assert.equal(stripTags('前言<设定>世界观</设定>后文', { keepTags: '', extraTags: '' }), '前言<设定>世界观</设定>后文');
});

test('quote-aware attrs: `>` inside quoted values does not truncate tokens', () => {
    // M0 逐字节复现（旧实现在首个 `>` 截断，残片泄漏）
    assert.equal(stripTags('前<div title="a>b">正文</div>尾', { keepTags: '', extraTags: '' }), '前<div title="a>b">正文</div>尾');
    // M2 keep 剥壳取内，属性完整消费
    assert.equal(stripTags('<content data-x="1>2">真正文</content>', { keepTags: 'content', extraTags: '' }), '真正文');
    // M1 extra 连内容删
    assert.equal(stripTags('前<think data-x="1>2">链条</think>后', { keepTags: '', extraTags: 'think' }), '前后');
});

test('unterminated quote falls back to legacy `>`-stop behavior (noise contained)', () => {
    // 引号未闭合 + 后续 `>`：宽松兜底分支接管（等价旧正则），extra 吞至该 `>`，噪音不泄漏
    assert.equal(stripTags('前<think data-x="oops>噪音尾巴', { keepTags: '', extraTags: 'think' }), '前');
    assert.equal(stripTags('<content><think data-x="a>b噪音</content>正文', { keepTags: 'content', extraTags: 'think' }), '');
    // 无后续 `>`（EOF）：不成 token、按原文保留（新旧一致）
    assert.equal(stripTags('eguard habit<think data-x="oops tail', { keepTags: '', extraTags: 'think' }), 'eguard habit<think data-x="oops tail');
});

test('self-closing tags inside keep subtree: extra removed, others verbatim', () => {
    // 自闭合 extra 标记删除（旧实现无条件保留 openRaw）
    assert.equal(stripTags('<content>正文<img src="x"/>尾</content>', { keepTags: 'content', extraTags: 'img' }), '正文尾');
    // keep 同名的自闭合标记原样保留（不按 keep 剥壳吞掉）
    assert.equal(stripTags('<content>正文<content/>尾巴</content>', { keepTags: 'content', extraTags: '' }), '正文<content/>尾巴');
});

test('M3 extra priority: closed/bracket extra wrapping keep is removed wholesale', () => {
    // 闭合 extra 块包裹 keep：整块删（不因下探搜寻 keep 而捞回噪音内的内容）
    assert.equal(stripTags('<think>思维链噪音<content>秘密</content>更多噪音</think>', { keepTags: 'content', extraTags: 'think' }), '');
    // 根层双中括号 extra 包裹 keep：同样整块删
    assert.equal(stripTags('[[<content>状态栏内容</content>]]', { keepTags: 'content', extraTags: '[[...]]' }), '');
    // 普通非 extra 标签包裹 keep：照常下探搜寻，不受 extra 拦截影响
    assert.equal(stripTags('<div>普通<content>正文</content>包裹</div>', { keepTags: 'content', extraTags: 'think' }), '正文');
});

test('same-name keep/extra: extra wins, other keeps unaffected', () => {
    // 同名冲突按 extra 优先（设置面板保存校验拒绝新配置，此为历史脏数据兜底语义）
    assert.equal(stripTags('前<content>秘密</content>后', { keepTags: 'content', extraTags: 'content' }), '');
    // 部分遮蔽：content 被 extra 遮蔽，data 不受影响
    assert.equal(stripTags('<data>d</data><content>c</content>', { keepTags: 'content,data', extraTags: 'think,content' }), 'd');
});
