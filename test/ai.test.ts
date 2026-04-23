import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalAnalysis,
  generatePaperNewsDigest,
  buildLocalWhatIfAnalysis,
  generateComplianceGuidance,
  generateAnalysisText,
  generateAIPaperDraft,
  generateDiscussionResponse,
  generateTranslatedPaper,
} from "../src/shared/ai";
import type { AnalysisResult, StatsSummary } from "../src/types";

const significantSummary: StatsSummary = {
  coefficients: {
    intercept: 0.5,
    pm25: 0.056,
  },
  rSquared: 0.9954,
  pValue: 0.001,
  pValueMethod: "student-t",
  n: 6,
};

test("buildLocalAnalysis keeps the UI section markers for researcher mode", () => {
  const text = buildLocalAnalysis(
    significantSummary,
    [
      { x: 10, y: 1.0 },
      { x: 20, y: 1.4 },
      { x: 30, y: 2.1 },
    ],
    "researcher",
  );

  assert.match(text, /\[思考过程\]/);
  assert.match(text, /\[正式回答\]/);
  assert.match(text, /统计学显著/);
});

test("buildLocalAnalysis explains when significance is unavailable", () => {
  const text = buildLocalAnalysis(
    {
      ...significantSummary,
      pValue: null,
      pValueMethod: "unavailable",
    },
    [{ x: 10, y: 1.0 }],
    "public",
  );

  assert.match(text, /还需要更多数据|暂时/);
  assert.match(text, /\[正式回答\]/);
});

test("buildLocalAnalysis respects custom variable labels", () => {
  const text = buildLocalAnalysis(
    significantSummary,
    [{ x: 10, y: 1.0 }],
    "researcher",
    { x: "biomarker", y: "admission_rate" },
  );

  assert.match(text, /biomarker/);
  assert.match(text, /admission_rate/);
});

test("buildLocalWhatIfAnalysis stays concise and mentions the simulated impact", () => {
  const text = buildLocalWhatIfAnalysis(
    {
      pm25Change: 20,
      predictedDiseaseChange: 1.12,
    },
    0.056,
    "PM2.5",
  );

  assert.match(text, /PM2\.5/);
  assert.ok(text.length < 220);
});

test("generateAnalysisText falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generateAnalysisText(
      significantSummary,
      [
        { x: 10, y: 1.0 },
        { x: 20, y: 1.4 },
      ],
      "researcher",
    );

    assert.equal(result.provider, "local-fallback");
    assert.match(result.text, /\[正式回答\]/);
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

test("generateTranslatedPaper falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generateTranslatedPaper("Sample abstract");
    assert.equal(result.provider, "local-fallback");
    assert.equal(result.result.translatedAbstract, "Sample abstract");
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }
});

test("generateComplianceGuidance falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const result: AnalysisResult = {
    summary: significantSummary,
    data: [{ x: 10, y: 1.0 }],
    columns: { x: "pm25", y: "disease_rate" },
    complianceReview: {
      status: "warning",
      riskLevel: "medium",
      findings: [{ field: "abstract", reason: "版权风险", severity: "medium" }],
      suggestions: ["check"],
      summary: "warning",
    },
    profile: {
      rowCount: 6,
      columnCount: 2,
      datasetShape: "regression",
      missingCells: 0,
      qualityScore: 90,
      issues: [],
      columns: [],
      recommendedModels: [],
    },
    trace: { datasetId: "demo", auditTrail: [] },
  };

  try {
    const guidance = await generateComplianceGuidance(result);
    assert.equal(guidance.provider, "local-fallback");
    assert.ok(guidance.desensitizationPlan.length > 0);
    assert.ok(guidance.reviewWorkflow.length > 0);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("generateAIPaperDraft falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generateAIPaperDraft(
      {
        summary: significantSummary,
        data: [{ x: 10, y: 1.0 }],
        columns: { x: "pm25", y: "disease_rate" },
      } as AnalysisResult,
      "demo",
    );
    assert.equal(result.provider, "local-fallback");
    assert.equal(result.paperDraft, undefined);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("generateDiscussionResponse falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generateDiscussionResponse("workbench", "这个数据怎么脱敏？");
    assert.equal(result.provider, "local-fallback");
    assert.equal(result.message.role, "assistant");
    assert.match(result.message.content, /脱敏|风险/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("generatePaperNewsDigest falls back locally when OPENAI_API_KEY is missing", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await generatePaperNewsDigest({
      title: "PM2.5 exposure and hospital admissions",
      abstract:
        "This study examined short-term PM2.5 exposure and hospital admissions in a large cohort. Higher PM2.5 levels were associated with more respiratory visits.",
      journal: "Environmental Health",
      publicationDate: "2026-01-01",
      citedByCount: 12,
      category: "空气质量",
    });
    assert.equal(result.provider, "local-fallback");
    assert.ok(result.result.keyFindings.length >= 3);
    assert.match(result.result.whyItMatters, /环境健康|值得关注/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
