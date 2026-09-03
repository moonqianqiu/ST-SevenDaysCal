import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySpaceIntent } from './context.js';

test('space intent keeps explanatory card mentions as discussion', () => {
    for (const message of ['请解释点卡片是什么', '什么是线卡片', '何为历法卡片', '介绍一下点卡片']) {
        assert.equal(classifySpaceIntent(message, []).action, 'discuss', message);
    }
});

test('space intent routes explicit card generation and clarifies mixed requests', () => {
    assert.equal(classifySpaceIntent('给我写一条线', []).action, 'semantic-route');
    assert.equal(classifySpaceIntent('把这句话输出成点卡片', []).action, 'semantic-route');
    assert.equal(classifySpaceIntent('给我一个点和一条线', []).action, 'clarify');
});
