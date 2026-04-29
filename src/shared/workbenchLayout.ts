export type WorkbenchSection = 'prepare' | 'analyze' | 'outputs' | 'collaborate';

export type WorkbenchSectionMeta = {
  id: WorkbenchSection;
  title: string;
  shortTitle: string;
  description: string;
  compactHint: string;
};

export type WorkbenchFlowGuide = WorkbenchSectionMeta & {
  goal: string;
  doneWhen: string;
  primaryAction: string;
  riskControl: string;
};

export type WorkbenchSectionState = 'completed' | 'current' | 'upcoming';

export function getWorkbenchSectionAnchorId(section: WorkbenchSection): string {
  return `workbench-section-${section}`;
}

export function getWorkbenchSectionState(
  activeSection: WorkbenchSection,
  targetSection: WorkbenchSection,
): WorkbenchSectionState {
  const order = WORKBENCH_SECTIONS.map((section) => section.id);
  const activeIndex = order.indexOf(activeSection);
  const targetIndex = order.indexOf(targetSection);

  if (activeIndex === targetIndex) {
    return 'current';
  }

  if (targetIndex < activeIndex) {
    return 'completed';
  }

  return 'upcoming';
}

export const WORKBENCH_FLOW_GUIDE: WorkbenchFlowGuide[] = [
  {
    id: 'prepare',
    title: '1. 数据准备',
    shortTitle: '数据准备',
    description: '上传数据、检查合规和确认研究问题。',
    compactHint: '上传 / 导入 / 预审',
    goal: '把研究问题、数据来源和合规状态先说明白。',
    doneWhen: '已有 CSV 或示例数据，并完成合规预审。',
    primaryAction: '上传数据或跑推荐示例数据',
    riskControl: '真实数据先审查字段风险，公开线索保留来源。',
  },
  {
    id: 'analyze',
    title: '2. 模型分析',
    shortTitle: '模型分析',
    description: '先看关键指标，再看模型对比和 AI 解读。',
    compactHint: '指标 / 图表 / 解读',
    goal: '判断当前数据适合什么模型，结论是否足够稳健。',
    doneWhen: '已生成模型对比、可视化和 AI 解读。',
    primaryAction: '查看模型对比并运行情景模拟',
    riskControl: '提示相关性不等于因果性，样本不足时不强行下结论。',
  },
  {
    id: 'outputs',
    title: '3. 报告产出',
    shortTitle: '报告产出',
    description: '生成报告、论文草稿和公众编辑稿。',
    compactHint: '报告 / 初稿 / 编辑稿',
    goal: '把分析结果沉淀成可复核、可导出的研究材料。',
    doneWhen: '已有结构化报告、论文初稿或资讯编辑草稿。',
    primaryAction: '生成结构化报告或论文初稿',
    riskControl: '输出必须包含证据链、局限说明和免责声明。',
  },
  {
    id: 'collaborate',
    title: '4. 协作留痕',
    shortTitle: '协作留痕',
    description: '多人协作、分工推进和审计复盘。',
    compactHint: '协作 / 任务 / 复盘',
    goal: '让团队成员明确分工，把关键决策和复核动作留下来。',
    doneWhen: '已加入协作房间，任务、备注、决策和审计轨迹可追溯。',
    primaryAction: '创建房间、分配任务并记录决策',
    riskControl: '按角色限制任务、决策和审核动作，避免越权操作。',
  },
];

export const WORKBENCH_SECTIONS: WorkbenchSectionMeta[] = WORKBENCH_FLOW_GUIDE.map(
  ({ id, title, shortTitle, description, compactHint }) => ({ id, title, shortTitle, description, compactHint }),
);

export const WORKBENCH_PRIORITY_NOTES = [
  '先确认输入，再开始分析。',
  '结果页默认只保留当前阶段最需要看的模块。',
  '报告和协作放到后面，避免一开始就把页面拉太长。',
] as const;
