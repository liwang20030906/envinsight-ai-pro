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
