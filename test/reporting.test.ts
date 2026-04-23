import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperDraft, buildReport } from "../src/shared/reporting";
import type { AnalysisResult } from "../src/types";

const baseResult: AnalysisResult = {
  summary: {
    coefficients: { intercept: 0.5, pm25: 0.056 },
    rSquared: 0.9954,
    pValue: 0.001,
    pValueMethod: "student-t",
    n: 6,
  },
  data: [
    { x: 10, y: 1.0 },
    { x: 20, y: 1.4 },
  ],
  columns: {
    x: "pm25",
    y: "disease_rate",
  },
  profile: {
    rowCount: 6,
    columnCount: 2,
    datasetShape: "regression",
    missingCells: 0,
    qualityScore: 93,
    issues: [],
    columns: [],
    recommendedModels: [],
  },
  complianceReview: {
    status: "passed",
    riskLevel: "low",
    findings: [],
    suggestions: [],
    summary: "passed",
  },
  trace: {
    datasetId: "dataset_1",
    auditTrail: [],
  },
};

test("buildReport includes evidence and disclaimer", () => {
  const report = buildReport(baseResult, "AI summary");
  assert.match(report.title, /EnvInsight/);
  assert.ok(report.evidence.length >= 3);
  assert.match(report.disclaimer, /不构成医疗诊断|科研探索/);
});

test("buildPaperDraft returns IMRaD style sections", () => {
  const draft = buildPaperDraft(baseResult, "AI summary");
  assert.match(draft.abstract, /本研究/);
  assert.match(draft.methods, /线性回归模型/);
  assert.ok(draft.evidenceMap.length >= 3);
});
