import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKBENCH_PRIORITY_NOTES, WORKBENCH_SECTIONS } from '../src/shared/workbenchLayout';

test('workbench layout keeps a compact four-step structure', () => {
  assert.equal(WORKBENCH_SECTIONS.length, 4);
  assert.deepEqual(
    WORKBENCH_SECTIONS.map((section) => section.id),
    ['prepare', 'analyze', 'outputs', 'collaborate'],
  );
  for (const section of WORKBENCH_SECTIONS) {
    assert.ok(section.shortTitle.length <= 6);
    assert.ok(section.compactHint.includes(' / '));
  }
});

test('workbench priority notes stay lightweight and action oriented', () => {
  assert.equal(WORKBENCH_PRIORITY_NOTES.length, 3);
  assert.match(WORKBENCH_PRIORITY_NOTES[0], /先确认输入/);
  assert.match(WORKBENCH_PRIORITY_NOTES[2], /页面拉太长/);
});
