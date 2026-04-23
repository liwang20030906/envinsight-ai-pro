import * as ss from "simple-statistics";
import type { DataProfile, ModelComparison, ModelRunResult, ProfileColumn } from "../types";

type RowRecord = Record<string, unknown>;

function toNumericSeries(records: RowRecord[], column: string): number[] {
  return records
    .map((record) => Number(record[column]))
    .filter((value) => Number.isFinite(value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function rank(values: number[]): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length).fill(0);

  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      j += 1;
    }
    const averageRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k += 1) {
      ranks[sorted[k].index] = averageRank;
    }
    i = j;
  }

  return ranks;
}

function spearmanCorrelation(xValues: number[], yValues: number[]): number {
  const xRanks = rank(xValues);
  const yRanks = rank(yValues);
  return ss.sampleCorrelation(xRanks, yRanks);
}

function meanAbsoluteError(actual: number[], predicted: number[]): number {
  if (actual.length === 0 || actual.length !== predicted.length) {
    return Number.POSITIVE_INFINITY;
  }
  return average(actual.map((value, index) => Math.abs(value - predicted[index])));
}

function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function normalizedScoreFromError(error: number, actual: number[]): number {
  const denominator = Math.max(1e-6, range(actual) || Math.abs(average(actual)) || 1);
  const normalized = error / denominator;
  return Math.max(5, Math.min(99, Math.round((1 - normalized) * 100)));
}

function buildRun(
  id: string,
  name: string,
  family: ModelRunResult["family"],
  score: number,
  summary: string,
  metrics: Record<string, number | string>,
  rationale: string,
  limitations: string[],
): ModelRunResult {
  return { id, name, family, score, summary, metrics, rationale, limitations };
}

function chooseBestRun(runs: ModelRunResult[]): ModelRunResult {
  return [...runs].sort((a, b) => b.score - a.score)[0];
}

function buildRegressionComparison(records: RowRecord[], columns: ProfileColumn[]): ModelComparison | null {
  const numericColumns = columns.filter((column) => column.type === "numeric");
  if (numericColumns.length < 2) {
    return null;
  }

  let bestPair: { x: string; y: string; correlation: number } | null = null;
  for (let i = 0; i < numericColumns.length; i += 1) {
    for (let j = i + 1; j < numericColumns.length; j += 1) {
      const xName = numericColumns[i].name;
      const yName = numericColumns[j].name;
      const pairs = records
        .map((record) => [Number(record[xName]), Number(record[yName])] as [number, number])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

      if (pairs.length < 5) {
        continue;
      }

      try {
        const correlation = Math.abs(ss.sampleCorrelation(pairs.map(([x]) => x), pairs.map(([, y]) => y)));
        if (!bestPair || correlation > bestPair.correlation) {
          bestPair = { x: xName, y: yName, correlation };
        }
      } catch {
        // Ignore invalid pairs.
      }
    }
  }

  if (!bestPair) {
    return null;
  }

  const pairs = records
    .map((record) => [Number(record[bestPair.x]), Number(record[bestPair.y])] as [number, number])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  const xValues = pairs.map(([x]) => x);
  const yValues = pairs.map(([, y]) => y);
  const regression = ss.linearRegression(pairs);
  const predicted = xValues.map((x) => regression.m * x + regression.b);
  const mae = meanAbsoluteError(yValues, predicted);
  const meanValue = average(yValues);
  const baselinePredicted = yValues.map(() => meanValue);
  const baselineMae = meanAbsoluteError(yValues, baselinePredicted);
  const rho = spearmanCorrelation(xValues, yValues);
  const r = ss.sampleCorrelation(xValues, yValues);
  const rSquared = Number.isFinite(r) ? r * r : 0;

  const runs: ModelRunResult[] = [
    buildRun(
      "ols",
      "OLS 线性回归",
      "regression",
      Math.max(10, Math.min(99, Math.round(rSquared * 100 * 0.8 + normalizedScoreFromError(mae, yValues) * 0.2))),
      `基于 ${bestPair.x} -> ${bestPair.y} 建立线性基线，R²=${rSquared.toFixed(3)}。`,
      { rSquared: Number(rSquared.toFixed(3)), mae: Number(mae.toFixed(3)), samples: pairs.length },
      "适合作为解释性基线模型，便于后续报告和论文撰写。",
      ["默认假设线性关系成立", "对异常值较敏感"],
    ),
    buildRun(
      "spearman",
      "Spearman 单调相关",
      "regression",
      Math.round(Math.abs(rho) * 100),
      `Spearman 相关系数为 ${rho.toFixed(3)}，适合验证单调关系是否稳定。`,
      { spearmanRho: Number(rho.toFixed(3)), samples: pairs.length },
      "可作为线性回归之外的稳健对照，避免只看线性趋势。",
      ["不直接输出预测方程", "更偏向关系检验而非完整建模"],
    ),
    buildRun(
      "baseline_mean",
      "均值基线模型",
      "regression",
      normalizedScoreFromError(baselineMae, yValues),
      `若仅使用均值作为预测，MAE=${baselineMae.toFixed(3)}。`,
      { mae: Number(baselineMae.toFixed(3)), samples: pairs.length },
      "用于衡量更复杂模型相较于无模型基线的增益。",
      ["不具备解释力", "无法支持真实研究结论"],
    ),
  ];

  const bestRun = chooseBestRun(runs);
  return {
    datasetShape: "regression",
    selectedTarget: bestPair.y,
    selectedFeatures: [bestPair.x],
    bestModelId: bestRun.id,
    bestModelName: bestRun.name,
    whyRecommended: `${bestRun.name} 在当前数据上综合得分最高，且 ${bestPair.x} 与 ${bestPair.y} 的相关性最稳定。`,
    runs,
  };
}

function buildClassificationComparison(records: RowRecord[], columns: ProfileColumn[]): ModelComparison | null {
  const binaryTargets = columns.filter((column) => column.type === "binary");
  const numericFeatures = columns.filter((column) => column.type === "numeric");
  if (binaryTargets.length < 1 || numericFeatures.length < 1) {
    return null;
  }

  const target = binaryTargets[0].name;
  const targetValues = records
    .map((record) => Number(record[target]))
    .filter((value) => Number.isFinite(value))
    .map((value) => (value > 0 ? 1 : 0));

  if (targetValues.length < 5) {
    return null;
  }

  let bestFeature = numericFeatures[0].name;
  let bestAccuracy = 0;
  let bestThreshold = 0;

  for (const feature of numericFeatures) {
    const pairs = records
      .map((record) => ({ x: Number(record[feature.name]), y: Number(record[target]) > 0 ? 1 : 0 }))
      .filter(({ x }) => Number.isFinite(x));

    const group0 = pairs.filter((pair) => pair.y === 0).map((pair) => pair.x);
    const group1 = pairs.filter((pair) => pair.y === 1).map((pair) => pair.x);
    if (group0.length === 0 || group1.length === 0) {
      continue;
    }

    const threshold = (average(group0) + average(group1)) / 2;
    const positiveOnHigher = average(group1) >= average(group0);
    const accuracy =
      pairs.filter((pair) => {
        const predicted = positiveOnHigher ? (pair.x >= threshold ? 1 : 0) : pair.x < threshold ? 1 : 0;
        return predicted === pair.y;
      }).length / pairs.length;

    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
      bestFeature = feature.name;
      bestThreshold = threshold;
    }
  }

  const majorityClass = average(targetValues) >= 0.5 ? 1 : 0;
  const majorityAccuracy = targetValues.filter((value) => value === majorityClass).length / targetValues.length;

  const runs: ModelRunResult[] = [
    buildRun(
      "decision_stump",
      "单特征阈值分类",
      "classification",
      Math.round(bestAccuracy * 100),
      `使用 ${bestFeature} 的阈值 ${bestThreshold.toFixed(3)} 做分类，准确率约 ${(bestAccuracy * 100).toFixed(1)}%。`,
      { accuracy: Number(bestAccuracy.toFixed(3)), target, feature: bestFeature },
      "对二分类结果给出最轻量、最可解释的规则模型。",
      ["仅使用一个特征", "不适合复杂非线性边界"],
    ),
    buildRun(
      "majority",
      "多数类基线",
      "classification",
      Math.round(majorityAccuracy * 100),
      `若始终预测多数类，准确率约 ${(majorityAccuracy * 100).toFixed(1)}%。`,
      { accuracy: Number(majorityAccuracy.toFixed(3)), baselineClass: majorityClass },
      "用于衡量规则模型是否明显优于无建模基线。",
      ["无法识别少数类", "不具备研究解释价值"],
    ),
    buildRun(
      "logistic_recommendation",
      "逻辑回归推荐",
      "classification",
      Math.max(55, Math.round(bestAccuracy * 100 - 5)),
      `当前数据已具备逻辑回归建模前提，可围绕目标列 ${target} 继续扩展多变量分类。`,
      { readiness: "ready", target, featureCount: numericFeatures.length },
      "适合下一阶段做多变量风险分层和系数解释。",
      ["当前版本未执行真实逻辑回归迭代", "需要人工确认标签定义"],
    ),
  ];

  const bestRun = chooseBestRun(runs);
  return {
    datasetShape: "classification",
    selectedTarget: target,
    selectedFeatures: [bestFeature],
    bestModelId: bestRun.id,
    bestModelName: bestRun.name,
    whyRecommended: `${bestRun.name} 在当前二分类结构上得分最高，并且具备较强可解释性。`,
    runs,
  };
}

function buildTimeSeriesComparison(records: RowRecord[], columns: ProfileColumn[]): ModelComparison | null {
  const dateColumn = columns.find((column) => column.type === "datetime");
  const numericColumn = columns.find((column) => column.type === "numeric");
  if (!dateColumn || !numericColumn) {
    return null;
  }

  const sorted = records
    .map((record) => ({
      date: new Date(String(record[dateColumn.name] ?? "")).getTime(),
      value: Number(record[numericColumn.name]),
    }))
    .filter(({ date, value }) => Number.isFinite(date) && Number.isFinite(value))
    .sort((a, b) => a.date - b.date);

  if (sorted.length < 5) {
    return null;
  }

  const indexPairs = sorted.map((item, index) => [index, item.value] as [number, number]);
  const regression = ss.linearRegression(indexPairs);
  const trendPredicted = indexPairs.map(([index]) => regression.m * index + regression.b);
  const actual = sorted.map((item) => item.value);
  const trendMae = meanAbsoluteError(actual, trendPredicted);

  const movingAveragePredicted = actual.map((value, index) => {
    if (index < 3) {
      return value;
    }
    return average(actual.slice(index - 3, index));
  });
  const movingAverageMae = meanAbsoluteError(actual.slice(3), movingAveragePredicted.slice(3));

  const naivePredicted = actual.map((value, index) => (index === 0 ? value : actual[index - 1]));
  const naiveMae = meanAbsoluteError(actual.slice(1), naivePredicted.slice(1));

  const runs: ModelRunResult[] = [
    buildRun(
      "trend_regression",
      "时间趋势回归",
      "time-series",
      normalizedScoreFromError(trendMae, actual),
      `基于时间索引的线性趋势模型，MAE=${trendMae.toFixed(3)}。`,
      { mae: Number(trendMae.toFixed(3)), slope: Number(regression.m.toFixed(4)) },
      "适合快速判断整体趋势方向，便于写入摘要和结果段。",
      ["难以捕捉短期波动", "默认趋势近似线性"],
    ),
    buildRun(
      "moving_average",
      "移动平均预测",
      "time-series",
      normalizedScoreFromError(movingAverageMae, actual.slice(3)),
      `3 步移动平均的 MAE=${movingAverageMae.toFixed(3)}。`,
      { mae: Number(movingAverageMae.toFixed(3)), window: 3 },
      "适合平滑短期波动，作为趋势回归的对照模型。",
      ["对突发变化反应较慢"],
    ),
    buildRun(
      "naive_last_value",
      "前值延续基线",
      "time-series",
      normalizedScoreFromError(naiveMae, actual.slice(1)),
      `以前一时点作为预测基线，MAE=${naiveMae.toFixed(3)}。`,
      { mae: Number(naiveMae.toFixed(3)) },
      "用于检验更复杂时序模型是否优于朴素基线。",
      ["无法解释长期趋势"],
    ),
  ];

  const bestRun = chooseBestRun(runs);
  return {
    datasetShape: "time-series",
    selectedTarget: numericColumn.name,
    selectedFeatures: [dateColumn.name],
    bestModelId: bestRun.id,
    bestModelName: bestRun.name,
    whyRecommended: `${bestRun.name} 在当前时序样本上的误差最小，适合作为默认分析路线。`,
    runs,
  };
}

export function buildModelComparison(records: RowRecord[], profile: DataProfile): ModelComparison {
  const runs =
    buildTimeSeriesComparison(records, profile.columns) ||
    buildClassificationComparison(records, profile.columns) ||
    buildRegressionComparison(records, profile.columns);

  if (runs) {
    return runs;
  }

  return {
    datasetShape: profile.datasetShape,
    selectedFeatures: [],
    bestModelId: "eda",
    bestModelName: "探索性数据分析",
    whyRecommended: "当前数据结构暂不适合直接运行标准模型，建议先完成字段清洗、标签确认与变量选择。",
    runs: [
      buildRun(
        "eda",
        "探索性数据分析",
        "eda",
        60,
        "当前以字段体检、分布分析和规则审查为主。",
        { qualityScore: profile.qualityScore },
        "适合作为复杂混合数据的第一步。",
        ["尚未形成正式预测模型"],
      ),
    ],
  };
}

export function pickRegressionViewData(records: RowRecord[], profile: DataProfile, comparison: ModelComparison): {
  xKey: string;
  yKey: string;
  numericRows: Array<{ x: number; y: number }>;
} | null {
  const numericColumns = profile.columns.filter((column) => column.type === "numeric").map((column) => column.name);
  const xKey = comparison.selectedFeatures.find((name) => numericColumns.includes(name)) || numericColumns[0];
  const yKey = comparison.selectedTarget && numericColumns.includes(comparison.selectedTarget)
    ? comparison.selectedTarget
    : numericColumns.find((name) => name !== xKey);

  if (!xKey || !yKey) {
    return null;
  }

  const numericRows = records
    .map((record) => ({
      x: Number(record[xKey]),
      y: Number(record[yKey]),
    }))
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));

  if (numericRows.length < 5) {
    return null;
  }

  return { xKey, yKey, numericRows };
}
