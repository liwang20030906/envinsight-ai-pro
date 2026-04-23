import type {
  AnalysisResult,
  ImportedResearchLead,
  NewsItem,
  WorkbenchFeedbackBrief,
  WorkbenchNewsPublishReview,
  PublishRiskItem,
} from "../types";

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
    return ["逻辑回归", "梯度提升模型", "校准曲线复核"];
  }
  if (dataset === "time-series") {
    return ["季节趋势模型", "中断时间序列", "滚动窗口回归"];
  }
  return ["OLS 线性回归", "稳健回归", "敏感性分析"];
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

function buildPublishRisk(title: string, severity: PublishRiskItem["severity"], issue: string, solution: string): PublishRiskItem {
  return { title, severity, issue, solution };
}

function buildPublicDraftTitle(result: AnalysisResult, lead?: ImportedResearchLead | null): string {
  if (lead) {
    return `${lead.category}新进展：本地数据对“${lead.title}”做了进一步验证`;
  }
  return `EnvInsight 研究快讯：${result.columns.x} 与 ${result.columns.y} 的最新分析`;
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

export function buildWorkbenchNewsPublishReview(
  result: AnalysisResult,
  lead?: ImportedResearchLead | null,
): WorkbenchNewsPublishReview {
  const riskItems: PublishRiskItem[] = [];
  const requiredActions: string[] = [];

  if (result.complianceReview?.status === "blocked") {
    riskItems.push(
      buildPublishRisk(
        "隐私/版权阻断",
        "high",
        "当前数据合规审查已阻断，说明结果里可能仍带有敏感字段或受限文本来源，不能直接进入大众资讯流。",
        "先完成字段脱敏、来源核验和审计记录补齐，再考虑生成公众内容。",
      ),
    );
  }

  if (!lead) {
    riskItems.push(
      buildPublishRisk(
        "来源脉络不足",
        "medium",
        "当前工作台结果没有绑定一篇明确的资讯论文线索，公众读者难以理解研究背景和来源边界。",
        "优先从资讯论文导入，或补充原始研究背景、数据来源和为什么值得关注。",
      ),
    );
  }

  if (result.summary.n < 20) {
    riskItems.push(
      buildPublishRisk(
        "样本量偏小",
        "high",
        `当前样本量仅 ${result.summary.n}，容易让公众把探索性分析误解成稳健结论。`,
        "在资讯稿中明确写成“初步观察/探索性分析”，并补充样本扩充计划。",
      ),
    );
  }

  if (result.summary.pValue == null || result.summary.pValue >= 0.05) {
    riskItems.push(
      buildPublishRisk(
        "证据强度有限",
        result.summary.pValue == null ? "high" : "medium",
        "当前结果还不足以支持强结论，若直接发布，容易把相关性或趋势写成已经被证明的事实。",
        "改用“提示/观察到/需要进一步验证”这类措辞，并突出局限性。",
      ),
    );
  }

  if (!lead?.isOpenAccess) {
    riskItems.push(
      buildPublishRisk(
        "论文版权与引用边界",
        "medium",
        "如果原论文不是开放获取或来源边界不清，资讯侧不能直接搬运原文表述或图表。",
        "只发布基于证据链的改写摘要，保留原文链接、期刊、作者，并避免复用受限内容。",
      ),
    );
  }

  riskItems.push(
    buildPublishRisk(
      "公众表达风险",
      "medium",
      "科研工作台的结论是面向研究者的，直接放到资讯流容易过度专业、因果化，甚至被理解为个体医疗建议。",
      "自动转成大众语言后，再加人工复核：去术语、加背景、加局限、加非医疗免责声明。",
    ),
  );

  requiredActions.push(
    "保留来源、期刊、样本范围与分析方法的最小必要说明。",
    "把所有“导致/证明”改成“相关/提示/观察到”，除非有足够因果设计支持。",
    "补一段局限性和适用边界，避免公众把探索性结果理解成普遍结论。",
    "增加非医疗建议声明，并由人工审核后再发布到资讯流。",
  );

  const highRiskCount = riskItems.filter((item) => item.severity === "high").length;
  const verdict: WorkbenchNewsPublishReview["verdict"] =
    highRiskCount > 0 ? "blocked" : riskItems.length > 2 ? "review_required" : "ready_with_review";
  const directPublishAllowed = verdict === "ready_with_review";
  const summary =
    verdict === "blocked"
      ? "当前不建议把科研工作台结果直接上传到资讯侧，至少需要先完成脱敏、来源补充和结论降级表述。"
      : verdict === "review_required"
        ? "可以整理成资讯草稿，但必须先经过 AI 改写 + 人工复核，不能直接自动发布。"
        : "可以进入资讯编辑流程，但仍建议保留来源说明、局限性和人工复核。";

  return {
    verdict,
    directPublishAllowed,
    headline: directPublishAllowed ? "可进入资讯编辑流程" : "不建议直接上传到资讯流",
    summary,
    publicDraftTitle: buildPublicDraftTitle(result, lead),
    publicDraftSummary:
      lead
        ? `围绕《${lead.title}》的后续分析显示，${result.columns.x} 与 ${result.columns.y} 存在值得继续关注的关系，但目前仍应把它视为验证性或探索性结果。`
        : `工作台分析观察到 ${result.columns.x} 与 ${result.columns.y} 存在一定关联，不过发布到大众资讯前还需要补充来源、局限性和风险说明。`,
    publicDraftBody: [
      lead
        ? `我们基于资讯论文《${lead.title}》提出的研究线索，用本地数据做了进一步分析。结果显示，${result.columns.x} 与 ${result.columns.y} 之间存在值得关注的变化关系。`
        : `我们在科研工作台中完成了一轮环境健康数据分析，发现 ${result.columns.x} 与 ${result.columns.y} 之间存在一定变化趋势。`,
      `但这类结果更适合被理解为“研究进展”而不是“最终定论”。样本量、研究设计、统计显著性和适用人群都会影响公众如何解读这条资讯。`,
      `因此，真正发布到资讯流前，应该先把专业结论翻译成大众语言，同时写清楚：研究针对谁、结果有多稳、不能据此做什么个人医疗判断。`,
    ].join("\n\n"),
    riskItems,
    requiredActions,
  };
}
