// runtime/tag-sanitizer.js 四模式清洗器测试
// 1) 金样比对：runtime/tag-sanitizer.golden.json 由重构前的本地 stripTags（栈式实现，
//    memory.js @ merge dde98d9）生成，29 例逐条锁定行为不变。
// 2) 语义探针：四模式合同的关键行为显式断言（dropUnclosed 噪音围堵、keep 顺序无关、
//    keep 内部逐字保留、extra 穿透、双中括号规则）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripTags } from './runtime/tag-sanitizer.js';

const here = dirname(fileURLToPath(import.meta.url));

test('golden baseline: 29 cases byte-identical to pre-refactor implementation', () => {
    const golden = JSON.parse(readFileSync(join(here, 'runtime', 'tag-sanitizer.golden.json'), 'utf8'));
    assert.ok(golden.cases.length >= 29);
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
