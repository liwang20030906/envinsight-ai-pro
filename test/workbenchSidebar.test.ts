import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('workbench left rail behaves like a compact sticky menu', () => {
  assert.match(appSource, /<aside className="lg:col-span-3 lg:sticky lg:top-24/);
  assert.match(appSource, /lg:max-h-\[calc\(100vh-7rem\)\]/);
  assert.match(appSource, /lg:overflow-y-auto/);
  assert.match(appSource, /左侧只保留菜单入口/);
});

test('workbench menu keeps long stage copy accessible but not visible', () => {
  assert.match(appSource, /<p className="sr-only">\{section\.description\}<\/p>/);
  assert.match(appSource, /<details className="mt-3 rounded-2xl/);
});

test('workbench left rail only contains menu controls', () => {
  const asideStart = appSource.indexOf('<aside className="lg:col-span-3');
  const asideEnd = appSource.indexOf('</aside>', asideStart);
  const leftRail = appSource.slice(asideStart, asideEnd);

  assert.ok(asideStart >= 0, 'workbench left rail should exist');
  assert.ok(asideEnd > asideStart, 'workbench left rail should close before main content panels');
  assert.match(leftRail, /工作台菜单/);
  assert.match(leftRail, /历史记录/);
  assert.doesNotMatch(leftRail, /点击或拖拽上传 CSV 文件/);
  assert.doesNotMatch(leftRail, /示例数据/);
  assert.doesNotMatch(leftRail, /资讯 → 科研工作台/);
  assert.doesNotMatch(leftRail, /跑推荐示例数据/);
  assert.doesNotMatch(leftRail, /多人协作研究室/);
  assert.doesNotMatch(leftRail, /合规预审与审计/);
  assert.doesNotMatch(leftRail, /AI 合规解决方案/);
  assert.doesNotMatch(leftRail, /情景模拟/);
  assert.doesNotMatch(leftRail, /报告与论文初稿/);
});

test('collaboration workspace renders in the right main area', () => {
  const asideEnd = appSource.indexOf('</aside>');
  const anchorIndex = appSource.indexOf("id={getWorkbenchSectionAnchorId('collaborate')}");
  const collaborationIndex = appSource.indexOf('多人协作研究室');

  assert.ok(asideEnd >= 0, 'workbench left rail should exist');
  assert.ok(anchorIndex > asideEnd, 'collaboration anchor should render after the left rail');
  assert.ok(collaborationIndex > asideEnd, 'collaboration panel should render after the left rail');
  assert.ok(collaborationIndex > anchorIndex, 'collaboration title should stay inside the anchored section');
  assert.match(appSource.slice(anchorIndex - 300, anchorIndex + 300), /activeWorkbenchSection !== 'collaborate'/);
});

test('data preparation tools render in the right main area', () => {
  const asideEnd = appSource.indexOf('</aside>');
  const uploadIndex = appSource.indexOf('点击或拖拽上传 CSV 文件');
  const sampleIndex = appSource.indexOf('示例数据', asideEnd);

  assert.ok(uploadIndex > asideEnd, 'upload entry should render after the left menu');
  assert.ok(sampleIndex > asideEnd, 'sample dataset controls should render after the left menu');
});
