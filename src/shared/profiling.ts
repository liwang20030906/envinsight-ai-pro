import type { DataProfile, ModelRecommendation, ProfileColumn, ProfileColumnType } from "../types";

type RowRecord = Record<string, unknown>;

function isLikelyDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value);
}

function inferColumnType(values: string[]): ProfileColumnType {
  const nonEmpty = values.filter((value) => value !== "");
  if (nonEmpty.length === 0) {
    return "unknown";
  }

  const numericCount = nonEmpty.filter((value) => Number.isFinite(Number(value))).length;
  const binaryCount = new Set(nonEmpty).size <= 2 ? nonEmpty.length : 0;
  const dateCount = nonEmpty.filter(isLikelyDate).length;
  const averageLength = nonEmpty.reduce((total, value) => total + value.length, 0) / nonEmpty.length;
  const uniqueCount = new Set(nonEmpty).size;

  if (dateCount / nonEmpty.length > 0.8) {
    return "datetime";
  }
  if (numericCount / nonEmpty.length > 0.9) {
    return uniqueCount <= 2 || binaryCount / nonEmpty.length > 0.9 ? "binary" : "numeric";
  }
  if (averageLength > 30) {
    return "text";
  }
  if (uniqueCount <= Math.max(10, nonEmpty.length * 0.3)) {
    return "categorical";
  }

  return "text";
}

function buildColumnProfile(records: RowRecord[], column: string): ProfileColumn {
  const values = records.map((record) => String(record[column] ?? "").trim());
  const missingCount = values.filter((value) => value === "").length;
  const nonEmpty = values.filter((value) => value !== "");
  const type = inferColumnType(values);
  const notes: string[] = [];

  if (missingCount > 0) {
    notes.push(`缺失率 ${(missingCount / Math.max(1, values.length) * 100).toFixed(1)}%`);
  }
  if (type === "text") {
    notes.push("文本列较长，建议先做摘要或标签化处理。");
  }
  if (type === "datetime") {
    notes.push("可用于时间趋势或时序分析。");
  }

  return {
    name: column,
    type,
    missingRate: missingCount / Math.max(1, values.length),
    uniqueCount: new Set(nonEmpty).size,
    sampleValues: [...new Set(nonEmpty)].slice(0, 3),
    notes,
  };
}

function inferDatasetShape(columns: ProfileColumn[]): DataProfile["datasetShape"] {
  const hasDate = columns.some((column) => column.type === "datetime");
  const numericColumns = columns.filter((column) => column.type === "numeric");
  const binaryColumns = columns.filter((column) => column.type === "binary");

  if (hasDate && numericColumns.length >= 1) {
    return "time-series";
  }
  if (numericColumns.length >= 2) {
    return "regression";
  }
  if (binaryColumns.length >= 1 && numericColumns.length >= 1) {
    return "classification";
  }
  return "mixed";
}

function buildModelRecommendations(shape: DataProfile["datasetShape"], columns: ProfileColumn[]): ModelRecommendation[] {
  const recommendations: ModelRecommendation[] = [];
  const numericColumns = columns.filter((column) => column.type === "numeric");
  const categoricalColumns = columns.filter((column) => column.type === "categorical");

  if (shape === "regression") {
    recommendations.push(
      {
        id: "ols",
        name: "OLS 线性回归",
        fitScore: 92,
        reason: "当前数据包含至少 2 个数值列，适合先用可解释性较强的线性模型建立基线。",
        limitations: ["对离群点敏感", "默认假设线性关系成立"],
      },
      {
        id: "spearman",
        name: "Spearman 相关分析",
        fitScore: 78,
        reason: "可作为线性回归之外的稳健对照，用于识别单调关系。",
        limitations: ["只反映相关性，不提供完整预测模型"],
      },
    );
  }

  if (shape === "classification" || categoricalColumns.length >= 1) {
    recommendations.push({
      id: "logistic",
      name: "逻辑回归",
      fitScore: 74,
      reason: "若目标变量为二分类，可进一步扩展到逻辑回归进行风险分层。",
      limitations: ["当前前端尚未开放目标变量选择", "需要明确标签列"],
    });
  }

  if (shape === "time-series") {
    recommendations.push({
      id: "trend",
      name: "时间趋势分析",
      fitScore: 81,
      reason: "检测到时间字段，适合补充趋势分解和移动平均对照。",
      limitations: ["需要稳定的时间粒度与排序字段"],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "eda",
      name: "探索性数据分析",
      fitScore: 60,
      reason: "当前数据结构较混合，建议先完成字段清洗、编码和目标变量确认。",
      limitations: ["暂不建议直接做结论性建模"],
    });
  }

  if (numericColumns.length >= 3) {
    recommendations.push({
      id: "multivariable",
      name: "多变量回归预案",
      fitScore: 70,
      reason: "数值变量较丰富，可作为后续后端多变量建模的候选方向。",
      limitations: ["当前版本尚未开放多自变量交互选择"],
    });
  }

  return recommendations.slice(0, 4);
}

export function buildDataProfile(records: RowRecord[], columns: string[]): DataProfile {
  const columnProfiles = columns.map((column) => buildColumnProfile(records, column));
  const datasetShape = inferDatasetShape(columnProfiles);
  const missingCells = columnProfiles.reduce(
    (total, column) => total + Math.round(column.missingRate * records.length),
    0,
  );
  const issues: string[] = [];

  if (missingCells > 0) {
    issues.push("数据存在缺失值，建议在建模前补全或剔除。");
  }
  if (columnProfiles.some((column) => column.type === "text")) {
    issues.push("存在长文本字段，应先做结构化或摘要处理。");
  }
  if (columnProfiles.filter((column) => column.type === "numeric").length < 2) {
    issues.push("数值字段不足，当前不适合直接进行标准回归。");
  }

  const qualityScore = Math.max(
    35,
    100 - Math.round((missingCells / Math.max(1, records.length * Math.max(1, columns.length))) * 100 * 0.6) - issues.length * 8,
  );

  return {
    rowCount: records.length,
    columnCount: columns.length,
    datasetShape,
    missingCells,
    qualityScore,
    issues,
    columns: columnProfiles,
    recommendedModels: buildModelRecommendations(datasetShape, columnProfiles),
  };
}
