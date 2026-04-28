import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const design = readFileSync(new URL('../docs/user-system-design.md', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('user system design documents all candidate schemes and chosen approach', () => {
  assert.match(design, /^# EnvInsight AI Pro 用户体系设计/m);
  assert.match(design, /方案 A：轻量 MVP 方案/);
  assert.match(design, /方案 B：团队协作方案/);
  assert.match(design, /方案 C：平台化完整方案/);
  assert.match(design, /当前阶段建议采用 \*\*方案 B：团队协作方案\*\*/);
  assert.match(design, /选择理由/);
});

test('user system design includes role definitions and permission matrix', () => {
  for (const role of ['普通用户', '研究员', '团队管理员', '审核员']) {
    assert.match(design, new RegExp(role));
  }

  for (const permission of ['上传数据', '查看原始数据', '导出报告', '进入协作房间', '审核内容发布']) {
    assert.match(design, new RegExp(permission));
  }

  assert.match(design, /## 5\. 权限矩阵/);
});

test('user system design covers data ownership and core user journey', () => {
  for (const ownership of ['个人数据', '团队数据', '项目数据', '公开资讯']) {
    assert.match(design, new RegExp(ownership));
  }

  for (const journeyStep of ['浏览环境健康资讯', '导入论文线索', '进行合规审查', '查看模型分析', '生成报告和论文初稿', '审核并沉淀分析历史']) {
    assert.match(design, new RegExp(journeyStep));
  }

  assert.match(design, /后续扩展方向/);
});

test('README links to the user system design document', () => {
  assert.match(readme, /docs\/user-system-design\.md/);
  assert.match(readme, /角色权限矩阵/);
});

import {
  canUserPerform,
  CORE_USER_JOURNEY,
  DATA_OWNERSHIP_RULES,
  getTeamUserRoleCapabilities,
  getTeamUserRoleLabel,
  mapCollaborationRoleToTeamUserRole,
} from '../src/shared/userPermissions';

test('team collaboration role model exposes the four scheme B roles', () => {
  assert.equal(getTeamUserRoleLabel('public-user'), '普通用户');
  assert.equal(getTeamUserRoleLabel('researcher'), '研究员');
  assert.equal(getTeamUserRoleLabel('team-admin'), '团队管理员');
  assert.equal(getTeamUserRoleLabel('auditor'), '审核员');

  assert.deepEqual(mapCollaborationRoleToTeamUserRole('lead'), 'team-admin');
  assert.deepEqual(mapCollaborationRoleToTeamUserRole('analyst'), 'researcher');
  assert.deepEqual(mapCollaborationRoleToTeamUserRole('reviewer'), 'auditor');
});

test('team collaboration permissions enforce upload, raw data, export and publish guardrails', () => {
  assert.equal(canUserPerform('public-user', 'upload-data').allowed, false);
  assert.equal(canUserPerform('researcher', 'upload-data').allowed, true);

  assert.equal(canUserPerform('researcher', 'view-raw-data', { dataScope: 'project' }).allowed, false);
  assert.equal(canUserPerform('researcher', 'view-raw-data', { dataScope: 'project', isProjectMember: true }).allowed, true);
  assert.equal(canUserPerform('auditor', 'view-raw-data', { dataScope: 'team' }).allowed, false);
  assert.equal(canUserPerform('auditor', 'view-raw-data', { dataScope: 'team', auditPurpose: true }).allowed, true);

  const highRiskExport = canUserPerform('researcher', 'export-report', { riskLevel: 'high' });
  assert.equal(highRiskExport.allowed, false);
  assert.match(highRiskExport.reason, /审核员/);
  assert.equal(canUserPerform('auditor', 'export-report', { riskLevel: 'high' }).allowed, true);

  assert.equal(canUserPerform('team-admin', 'review-content-publish').allowed, false);
  assert.equal(canUserPerform('auditor', 'review-content-publish').allowed, true);
});

test('team collaboration model documents ownership rules and journey permissions as executable data', () => {
  assert.deepEqual(Object.keys(DATA_OWNERSHIP_RULES).sort(), ['personal', 'project', 'public', 'team']);
  assert.ok(DATA_OWNERSHIP_RULES.team.some((rule) => rule.includes('审计')));

  const journeySteps = CORE_USER_JOURNEY.map((item) => item.step);
  assert.ok(journeySteps.includes('浏览环境健康资讯'));
  assert.ok(journeySteps.includes('进入协作研究室'));
  assert.ok(journeySteps.includes('审核并沉淀分析历史'));

  const researcherCapabilities = getTeamUserRoleCapabilities('researcher');
  assert.ok(researcherCapabilities.includes('upload-data'));
  assert.ok(researcherCapabilities.includes('generate-report'));
  assert.equal(researcherCapabilities.includes('review-content-publish'), false);
});
