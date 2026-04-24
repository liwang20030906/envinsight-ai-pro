import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWorkbenchSectionAnchorId,
  getWorkbenchSectionState,
  WORKBENCH_PRIORITY_NOTES,
  WORKBENCH_SECTIONS,
} from '../src/shared/workbenchLayout';

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

test('workbench section anchor ids stay predictable for in-page navigation', () => {
  assert.equal(getWorkbenchSectionAnchorId('prepare'), 'workbench-section-prepare');
  assert.equal(getWorkbenchSectionAnchorId('analyze'), 'workbench-section-analyze');
  assert.equal(getWorkbenchSectionAnchorId('outputs'), 'workbench-section-outputs');
  assert.equal(getWorkbenchSectionAnchorId('collaborate'), 'workbench-section-collaborate');
});

test('workbench section state highlights current step and marks previous steps completed', () => {
  assert.equal(getWorkbenchSectionState('prepare', 'prepare'), 'current');
  assert.equal(getWorkbenchSectionState('outputs', 'prepare'), 'completed');
  assert.equal(getWorkbenchSectionState('outputs', 'analyze'), 'completed');
  assert.equal(getWorkbenchSectionState('outputs', 'outputs'), 'current');
  assert.equal(getWorkbenchSectionState('outputs', 'collaborate'), 'upcoming');
});
