import type { AnalysisResult, ImportedResearchLead, NewsItem, WorkbenchFeedbackBrief } from "../types";

function cleanSentence(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function pickDatasetShape(item: NewsItem): ImportedResearchLead["suggestedDataset"] {
  const combined = `${item.title} ${item.summary} ${item.content}`.toLowerCase();
  if (/trend|time|daily|season|longitudinal|date|heatwave|forecast/.test(combined)) {
    return "time-series";
  }
  if (/risk|probability|screen|case|admission|mortality|incidence/.test(combined)) {
    return "classification";
  }
  return "regression";
}

function buildSuggestedModels(dataset: ImportedResearchLead["suggestedDataset"]): string[] {
  if (dataset === "classification") {
    return ["Logistic Regression", "Gradient Boosting", "Calibration Curve Review"];
  }
  if (dataset === "time-series") {
    return ["Seasonal Trend Model", "Interrupted Time Series", "Rolling Window Regression"];
  }
  return ["OLS Regression", "Robust Regression", "Sensitivity Analysis"];
}

function buildDataNeeds(item: NewsItem, dataset: ImportedResearchLead["suggestedDataset"]): string[] {
  const base = [
    `围绕“${item.category}”收集至少一个暴露指标和一个健康结局指标。`,
    "补充地理、时间或人群分层字段，便于做异质性分析。",
    item.isOpenAccess ? "优先从开放获取补充材料里整理变量定义与纳入标准。" : "补充原文方法学信息，确认变量定义和样本纳入标准。",
  ];

  if (dataset === "classification") {
    base.push("准备明确的二分类结局标签，并补充阈值来源或临床定义。");
  } else if (dataset === "time-series") {
    base.push("保证数据按日期连续记录，并准备政策/天气等事件节点用于时序解释。");
  } else {
    base.push("确保核心暴露和结局变量为连续型，并准备潜在混杂因素字段。");
  }

  return base;
}

export function buildImportedResearchLead(item: NewsItem): ImportedResearchLead {
  const dataset = pickDatasetShape(item);
  const whyItMatters = cleanSentence(item.explainers?.whyItMatters, item.summary);
  const everydayMeaning = cleanSentence(item.explainers?.everydayMeaning, item.content.split("\n")[0] || item.summary);
  const keyFinding = item.explainers?.keyFindings?.[0] || item.summary;

  return {
    id: item.id,
    importedAt: new Date().toISOString(),
    title: item.title,
    category: item.category,
    summary: item.summary,
    translatedAbstract: item.translatedAbstract,
    sourceJournal: item.sourceJournal,
    sourceLink: item.sourceLink,
    authors: item.authors || [],
    citedByCount: item.citedByCount,
    isOpenAccess: item.isOpenAccess,
    publicationYear: item.publicationYear,
    researchQuestion: `基于“${item.title}”，是否能在本地或目标人群数据中复现 ${item.category} 暴露与健康结局之间的关键关联？`,
    hypothesis: `假设：${keyFinding}`,
    suggestedDataset: dataset,
    suggestedModels: buildSuggestedModels(dataset),
    dataNeeds: buildDataNeeds(item, dataset),
    collaborationTasks: [
      "研究负责人确认该论文是否可作为本轮分析假设来源。",
      "分析成员梳理论文中的暴露变量、结局变量和关键混杂因素。",
      "审稿成员复核开放获取/版权状态与引用方式。",
      "建模成员按推荐路线完成首轮模型对比并记录偏差来源。",
    ],
    readerTakeaways: [whyItMatters, everydayMeaning, ...(item.explainers?.readerActions || []).slice(0, 2)],
  };
}

export function buildWorkbenchFeedbackBrief(result: AnalysisResult, lead?: ImportedResearchLead | null): WorkbenchFeedbackBrief {
  const coefficient = result.summary.coefficients.pm25;
  const direction = coefficient >= 0 ? "同向" : "反向";
  const significance =
    result.summary.pValue != null
      ? `p=${result.summary.pValue.toFixed(3)}，${result.summary.pValue < 0.05 ? "具备统计学显著性" : "暂未达到统计学显著性"}`
      : "当前样本不足以给出稳定显著性判断";
  const bridgePrefix = lead ? `围绕论文《${lead.title}》的延伸分析显示，` : "本轮工作台分析显示，";

  return {
    headline: lead ? `从论文线索到本地验证：${lead.category} 研究跟进` : "科研工作台分析快讯",
    summary: `${bridgePrefix}${result.columns.x} 与 ${result.columns.y} 呈${direction}变化关系，模型拟合度 R²=${result.summary.rSquared.toFixed(3)}，${significance}。`,
    highlights: [
      `最优模型：${result.modelComparison?.bestModelName || "OLS / 默认路线"}`,
      `样本量：${result.summary.n}，目标变量：${result.columns.y}`,
      lead ? `研究假设：${lead.hypothesis}` : `核心系数：${coefficient.toFixed(3)}`,
    ],
    caution: lead
      ? "这是从资讯论文导入后的验证性分析摘要，适合回流到资讯侧作为“后续研究进展”，但仍需补充样本来源和局限说明。"
      : "适合转成公众资讯，但发布前仍应补充局限性、适用范围与非医疗免责声明。",
  };
}
