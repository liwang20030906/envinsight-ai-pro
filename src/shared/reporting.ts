import type { AnalysisResult, GeneratedReport, PaperDraft, EvidenceItem } from "../types";

function buildEvidence(result: AnalysisResult): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      label: "样本量",
      value: String(result.summary.n),
      source: "analysis.summary.n",
    },
    {
      label: "R²",
      value: result.summary.rSquared.toFixed(3),
      source: "analysis.summary.rSquared",
    },
    {
      label: "PM2.5 系数",
      value: result.summary.coefficients.pm25.toFixed(4),
      source: "analysis.summary.coefficients.pm25",
    },
  ];

  if (result.summary.pValue != null) {
    evidence.push({
      label: "P 值",
      value: result.summary.pValue.toFixed(4),
      source: "analysis.summary.pValue",
    });
  }

  if (result.profile) {
    evidence.push(
      {
        label: "数据结构",
        value: result.profile.datasetShape,
        source: "analysis.profile.datasetShape",
      },
      {
        label: "质量评分",
        value: String(result.profile.qualityScore),
        source: "analysis.profile.qualityScore",
      },
    );
  }

  if (result.modelComparison) {
    evidence.push(
      {
        label: "推荐模型",
        value: result.modelComparison.bestModelName,
        source: "analysis.modelComparison.bestModelName",
      },
      {
        label: "目标变量",
        value: result.modelComparison.selectedTarget || "未指定",
        source: "analysis.modelComparison.selectedTarget",
      },
    );
  }

  return evidence;
}

export function buildReport(result: AnalysisResult, aiResponse?: string): GeneratedReport {
  const evidence = buildEvidence(result);
  const significance =
    result.summary.pValue == null
      ? "当前样本暂不足以稳定判断显著性。"
      : result.summary.pValue < 0.05
        ? "当前结果达到常用显著性阈值。"
        : "当前结果尚未达到常用显著性阈值。";

  return {
    title: "EnvInsight 分析报告",
    executiveSummary: `本次分析基于 ${result.summary.n} 条样本完成，${significance} 回归系数为 ${result.summary.coefficients.pm25.toFixed(
      4,
    )}，模型拟合度 R² 为 ${result.summary.rSquared.toFixed(3)}。`,
    keyFindings: [
      `数据结构判定为 ${result.profile?.datasetShape || "regression"}，建议优先采用可解释性较强的基线模型。`,
      `质量评分为 ${result.profile?.qualityScore ?? "N/A"}，${result.profile?.issues[0] || "当前未发现明显数据质量阻断项。"} `,
      result.modelComparison
        ? `当前自动推荐的最优模型为 ${result.modelComparison.bestModelName}：${result.modelComparison.whyRecommended}`
        : "当前尚未生成模型对比结果。",
      aiResponse ? "AI 解读已纳入报告，可作为科研讨论参考。" : "当前报告基于规则与统计摘要生成。",
    ],
    limitations: [
      "当前版本仍以单变量线性分析为主，尚未覆盖多变量控制。",
      "统计相关性不能直接视为因果结论。",
      result.complianceReview?.status === "warning"
        ? "数据存在需人工复核的合规提示，引用前应完成脱敏确认。"
        : "如需对外发布，请先完成合规与来源复核。",
      result.complianceGuidance ? "系统已生成 AI 合规工作流，建议逐项执行后再进入公开发布。" : "建议补充 AI 合规工作流与人工审核记录。",
    ],
    nextSteps: [
      "补充协变量，开展多变量分析或分层分析。",
      "对关键字段执行缺失值处理和异常值复核。",
      "结合领域知识与原始研究问题复核当前结论的业务含义。",
      result.modelComparison ? `优先围绕 ${result.modelComparison.bestModelName} 补充更完整的建模与验证。` : "明确目标变量与特征选择策略后再进入正式建模。",
    ],
    evidence,
    disclaimer:
      "本报告仅用于科研探索与决策讨论，不构成医疗诊断或正式政策结论。所有关键判断均应结合合规审查与人工复核。",
  };
}

export function buildPaperDraft(result: AnalysisResult, aiResponse?: string): PaperDraft {
  const evidenceMap = buildEvidence(result);
  const pValueSentence =
    result.summary.pValue == null
      ? "显著性尚不可稳定判断。"
      : `P 值为 ${result.summary.pValue.toFixed(4)}。`;

  return {
    title: "环境暴露与健康结果的探索性分析初稿",
    abstract: `本研究基于 ${result.summary.n} 条样本，对环境暴露指标与健康结果之间的关系进行了探索性分析。结果显示回归系数为 ${result.summary.coefficients.pm25.toFixed(
      4,
    )}，R² 为 ${result.summary.rSquared.toFixed(3)}，${pValueSentence}`,
    introduction:
      "环境暴露与公共健康结局之间的关联是环境流行病学的重要议题。为快速验证数据中是否存在可解释的趋势，本研究以当前上传数据为基础完成基线分析。",
    methods: `研究首先进行了字段级合规审查与数据体检，然后围绕 ${result.columns.x} 与 ${result.columns.y} 构建基线线性回归模型。系统同时对候选模型进行了比较，推荐模型为 ${result.modelComparison?.bestModelName || "当前默认基线模型"}。`,
    results: aiResponse
      ? `系统生成的 AI 解读指出：${aiResponse.replace(/\s+/g, " ").slice(0, 220)}...`
      : `回归结果提示 ${result.columns.x} 与 ${result.columns.y} 存在线性趋势，R² 为 ${result.summary.rSquared.toFixed(3)}，${pValueSentence}`,
    discussion:
      `当前结果可作为论文初稿中的探索性证据。${result.modelComparison ? `模型对比进一步支持以 ${result.modelComparison.bestModelName} 作为默认分析路线。` : ""} 但仍需补充混杂因素控制、异常值诊断和更多样本验证，避免将相关性过度外推为因果性解释。`,
    limitations:
      "本初稿由模板化规则、统计摘要与模型对比结果生成，未自动补充真实文献综述，也未替代正式科研写作与同行评议流程。",
    evidenceMap,
    disclaimer:
      "本文稿为结构化初稿，不代表最终论文版本。引用前请逐段完成人工校验、来源补证与合规复核。",
  };
}
