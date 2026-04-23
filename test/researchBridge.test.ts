import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportedResearchLead,
  buildWorkbenchFeedbackBrief,
  buildWorkbenchNewsPublishReview,
} from "../src/shared/researchBridge";
import type { AnalysisResult, NewsItem } from "../src/types";

const sampleNews: NewsItem = {
  id: "paper-1",
  title: "PM2.5 exposure and respiratory admissions",
  summary: "更高 PM2.5 暴露与呼吸系统住院增加相关。",
  content: "Researchers tracked daily pollution and hospital visits across multiple districts.",
  category: "空气质量",
  date: "2026-04-01",
  imageUrl: "https://example.com/demo.png",
  likesCount: 0,
  translatedAbstract: "研究追踪了每日污染变化与住院变化。",
  authors: ["Alice", "Bob"],
  citedByCount: 32,
  isOpenAccess: true,
  publicationYear: 2026,
  explainers: {
    whyItMatters: "它提示空气污染控制会直接影响门诊和住院压力。",
    howStudyWorked: "研究使用每日面板数据比较暴露与结局。",
    keyFindings: ["PM2.5 上升与住院增加同步出现。"],
    limitations: ["仍需更多地区样本验证。"],
    everydayMeaning: "普通人可以把它理解为高污染日更需要减少暴露。",
    readerActions: ["关注暴露窗口定义", "关注混杂因素控制"],
    plainLanguageSummary: "一句话理解：空气更差时，呼吸系统压力可能更大。",
    publicCautions: ["不要把单篇论文理解成最终定论。"],
  },
};

const sampleResult: AnalysisResult = {
  summary: {
    coefficients: { intercept: 0.4, pm25: 0.052 },
    rSquared: 0.91,
    pValue: 0.013,
    pValueMethod: "student-t",
    n: 24,
  },
  data: [
    { x: 20, y: 1.1 },
    { x: 28, y: 1.5 },
  ],
  columns: {
    x: "pm25",
    y: "respiratory_admission_rate",
  },
  modelComparison: {
    datasetShape: "regression",
    selectedTarget: "respiratory_admission_rate",
    selectedFeatures: ["pm25", "humidity"],
    bestModelId: "ols",
    bestModelName: "OLS Regression",
    whyRecommended: "连续型暴露与结局，且样本足以进行线性趋势解释。",
    runs: [],
  },
};

test("buildImportedResearchLead derives a workbench-ready research lead", () => {
  const lead = buildImportedResearchLead(sampleNews);

  assert.equal(lead.title, sampleNews.title);
  assert.equal(lead.suggestedDataset, "time-series");
  assert.ok(lead.suggestedModels.length >= 2);
  assert.ok(lead.dataNeeds.some((item) => item.includes("暴露指标")));
  assert.ok(lead.collaborationTasks.length >= 3);
});

test("buildWorkbenchFeedbackBrief creates a news-loop summary", () => {
  const lead = buildImportedResearchLead(sampleNews);
  const brief = buildWorkbenchFeedbackBrief(sampleResult, lead);

  assert.match(brief.headline, /本地验证|研究跟进/);
  assert.match(brief.summary, /R²=0.910/);
  assert.equal(brief.highlights.length, 3);
  assert.match(brief.caution, /资讯侧|局限/);
});

test("buildWorkbenchNewsPublishReview blocks direct publishing for exploratory results", () => {
  const lead = buildImportedResearchLead(sampleNews);
  const review = buildWorkbenchNewsPublishReview(
    {
      ...sampleResult,
      summary: {
        ...sampleResult.summary,
        n: 12,
        pValue: 0.12,
      },
      complianceReview: {
        status: "warning",
        riskLevel: "medium",
        findings: [],
        suggestions: [],
        summary: "warning",
      },
    },
    {
      ...lead,
      isOpenAccess: false,
    },
  );

  assert.equal(review.directPublishAllowed, false);
  assert.match(review.summary, /不建议|不能直接|必须/);
  assert.match(review.conclusionTitle, /值得关注的变化关系/);
  assert.ok(review.riskItems.some((item) => item.title.includes("样本量")));
  assert.ok(review.requiredActions.length >= 3);
});
