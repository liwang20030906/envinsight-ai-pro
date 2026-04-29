import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKBENCH_FLOW_GUIDE, WORKBENCH_SECTIONS } from '../src/shared/workbenchLayout';
import { getRoleOnboardingGuide, ROLE_ONBOARDING_GUIDES } from '../src/shared/userPermissions';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const uxDoc = readFileSync(new URL('../docs/workbench-flow-and-collaboration-ux.md', import.meta.url), 'utf8');

test('workbench flow guide documents the four-stage research path', () => {
  assert.deepEqual(
    WORKBENCH_FLOW_GUIDE.map((section) => section.id),
    WORKBENCH_SECTIONS.map((section) => section.id),
  );

  for (const section of WORKBENCH_FLOW_GUIDE) {
    assert.ok(section.goal.length > 10);
    assert.ok(section.doneWhen.length > 10);
    assert.ok(section.primaryAction.length > 6);
    assert.ok(section.riskControl.length > 10);
  }
});

test('role onboarding guide covers all scheme B roles', () => {
  assert.deepEqual(Object.keys(ROLE_ONBOARDING_GUIDES).sort(), ['auditor', 'public-user', 'researcher', 'team-admin']);
  assert.match(getRoleOnboardingGuide('researcher').startWith, /数据准备/);
  assert.ok(getRoleOnboardingGuide('team-admin').canDoNow.includes('创建协作任务'));
  assert.ok(getRoleOnboardingGuide('auditor').watchOut.some((item) => item.includes('审核结论')));
});

test('workbench page renders clear flow and collaboration guidance in the main area', () => {
  const asideEnd = appSource.indexOf('</aside>');
  const flowIndex = appSource.indexOf('本轮工作路径');
  const collaborationIndex = appSource.indexOf('协作台从');

  assert.ok(flowIndex > asideEnd, 'flow guide should render after the menu-only sidebar');
  assert.match(appSource, /按“准备 → 分析 → 产出 → 留痕”推进/);
  assert.match(appSource, /方案 B 角色上手指引/);
  assert.match(appSource, /当前身份不能直接创建任务/);
  assert.match(appSource, /当前身份可以发送备注/);
  assert.equal(collaborationIndex, -1, 'documentation copy should stay in docs, not clutter the page');
});

test('workbench UX document records flow, roles and test coverage', () => {
  for (const phrase of [
    '数据准备 → 模型分析 → 报告产出 → 协作留痕',
    '协作台体验优化',
    '角色引导说明',
    '测试覆盖',
  ]) {
    assert.match(uxDoc, new RegExp(phrase));
  }
});
