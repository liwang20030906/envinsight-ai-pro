export type WorkbenchSection = 'prepare' | 'analyze' | 'outputs' | 'collaborate';

export type WorkbenchSectionMeta = {
  id: WorkbenchSection;
  title: string;
  shortTitle: string;
  description: string;
  compactHint: string;
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

export const WORKBENCH_SECTIONS: WorkbenchSectionMeta[] = [
  {
    id: 'prepare',
    title: '1. 数据准备',
    shortTitle: '数据准备',
    description: '上传数据、检查合规和确认研究问题。',
    compactHint: '上传 / 导入 / 预审',
  },
  {
    id: 'analyze',
    title: '2. 模型分析',
    shortTitle: '模型分析',
    description: '先看关键指标，再看模型对比和 AI 解读。',
    compactHint: '指标 / 图表 / 解读',
  },
  {
    id: 'outputs',
    title: '3. 报告产出',
    shortTitle: '报告产出',
    description: '生成报告、论文草稿和公众编辑稿。',
    compactHint: '报告 / 初稿 / 编辑稿',
  },
  {
    id: 'collaborate',
    title: '4. 协作留痕',
    shortTitle: '协作留痕',
    description: '多人协作、分工推进和审计复盘。',
    compactHint: '协作 / 任务 / 复盘',
  },
];

export const WORKBENCH_PRIORITY_NOTES = [
  '先确认输入，再开始分析。',
  '结果页默认只保留当前阶段最需要看的模块。',
  '报告和协作放到后面，避免一开始就把页面拉太长。',
] as const;
