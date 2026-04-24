import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { parse } from "csv-parse/sync";
import {
  generateAIPaperDraft,
  generateAnalysisText,
  generateDiscussionResponse,
  generateComplianceGuidance,
  generateTranslatedPaper,
  generateWhatIfText,
} from "./src/shared/ai";
import { createCollaborationStore } from "./src/shared/collaboration";
import { reviewCompliance } from "./src/shared/compliance";
import { buildModelComparison, pickRegressionViewData } from "./src/shared/modeling";
import { dedupeNewsItems, fetchRealNews, matchesNewsFilters, type RealNewsFetchOptions } from "./src/shared/news";
import { buildDataProfile } from "./src/shared/profiling";
import { buildPaperDraft, buildReport } from "./src/shared/reporting";
import { calculateRegressionSummary } from "./src/shared/statistics";
import type { AnalysisResult, AuditLogEntry } from "./src/types";

type ParsedDataset = {
  datasetId: string;
  columns: string[];
  records: Record<string, unknown>[];
};

type SampleDatasetKind = "regression" | "classification" | "time-series" | "privacy-risk";

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseUploadedDataset(file: { buffer: Buffer }): ParsedDataset {
  const csvData = file.buffer.toString();
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
  }) as Record<string, unknown>[];

  if (records.length < 1) {
    throw new Error("Uploaded CSV is empty.");
  }

  return {
    datasetId: createId("dataset"),
    columns: Object.keys(records[0]),
    records,
  };
}

function buildSampleDataset(kind: SampleDatasetKind): Record<string, unknown>[] {
  if (kind === "classification") {
    return [
      { biomarker: 1.1, exposure_score: 3.2, admitted: 0 },
      { biomarker: 1.4, exposure_score: 3.8, admitted: 0 },
      { biomarker: 1.8, exposure_score: 4.5, admitted: 0 },
      { biomarker: 2.2, exposure_score: 5.2, admitted: 1 },
      { biomarker: 2.6, exposure_score: 5.9, admitted: 1 },
      { biomarker: 2.9, exposure_score: 6.4, admitted: 1 },
      { biomarker: 3.1, exposure_score: 6.8, admitted: 1 },
    ];
  }

  if (kind === "time-series") {
    return [
      { date: "2026-01-01", pm25: 28, clinic_visits: 13 },
      { date: "2026-01-02", pm25: 31, clinic_visits: 15 },
      { date: "2026-01-03", pm25: 35, clinic_visits: 16 },
      { date: "2026-01-04", pm25: 30, clinic_visits: 14 },
      { date: "2026-01-05", pm25: 38, clinic_visits: 18 },
      { date: "2026-01-06", pm25: 41, clinic_visits: 20 },
      { date: "2026-01-07", pm25: 37, clinic_visits: 17 },
    ];
  }

  if (kind === "privacy-risk") {
    return [
      { name: "Alice", email: "alice@example.com", pm25: 24, disease_rate: 1.2, abstract: "Restricted abstract text" },
      { name: "Bob", email: "bob@example.com", pm25: 28, disease_rate: 1.4, abstract: "Restricted abstract text" },
      { name: "Chris", email: "chris@example.com", pm25: 35, disease_rate: 1.8, abstract: "Restricted abstract text" },
      { name: "Dana", email: "dana@example.com", pm25: 38, disease_rate: 2.0, abstract: "Restricted abstract text" },
      { name: "Evan", email: "evan@example.com", pm25: 41, disease_rate: 2.3, abstract: "Restricted abstract text" },
    ];
  }

  const data = [];
  for (let i = 0; i < 12; i += 1) {
    const pm25 = 10 + i * 6;
    const diseaseRate = 0.6 + 0.055 * pm25 + (i % 2 === 0 ? 0.18 : -0.14);
    data.push({
      pm25,
      disease_rate: Number(diseaseRate.toFixed(3)),
      humidity: 40 + i * 2,
    });
  }
  return data;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });
  const datasets = new Map<string, ParsedDataset>();
  const auditLogs: AuditLogEntry[] = [];
  const collaborationStore = createCollaborationStore();
  const newsRefreshTimestamps = new Map<string, number>();
  const NEWS_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

  function appendAudit(action: string, status: AuditLogEntry["status"], summary: string, datasetId?: string) {
    const entry: AuditLogEntry = {
      id: createId("audit"),
      timestamp: new Date().toISOString(),
      action,
      status,
      datasetId,
      summary,
    };
    auditLogs.unshift(entry);
    if (auditLogs.length > 500) {
      auditLogs.length = 500;
    }
    return entry;
  }

  function mergeNewsItems(currentItems: any[], incomingItems: any[]) {
    return dedupeNewsItems([...incomingItems, ...currentItems]).sort((a, b) =>
      String(b.publishDate || "").localeCompare(String(a.publishDate || "")),
    );
  }

  let hasHydratedRealNews = false;
  let newsRefreshInFlight: Promise<void> | null = null;

  function shouldRefreshCategory(category: string, force = false) {
    if (force) {
      return true;
    }
    const lastRefresh = newsRefreshTimestamps.get(category) || 0;
    return Date.now() - lastRefresh > NEWS_REFRESH_INTERVAL_MS;
  }

  async function refreshNews(options: string | RealNewsFetchOptions = "全部", force = false) {
    const normalizedOptions: RealNewsFetchOptions =
      typeof options === "string"
        ? { category: options, limit: options === "全部" ? 10 : 6 }
        : options;
    const category = normalizedOptions.category || "全部";

    if (newsRefreshInFlight && !force) {
      return newsRefreshInFlight;
    }
    if (!shouldRefreshCategory(category, force)) {
      return Promise.resolve();
    }

    newsRefreshInFlight = (async () => {
      try {
        const fetched = await fetchRealNews({
          category,
          limit: normalizedOptions.limit || (category === "全部" ? 10 : 6),
          openAccessOnly: normalizedOptions.openAccessOnly,
          minCitations: normalizedOptions.minCitations,
          publishedWithinDays: normalizedOptions.publishedWithinDays,
          sort: normalizedOptions.sort,
        });
        if (fetched.length > 0) {
          newsItems = mergeNewsItems(newsItems, fetched);
          hasHydratedRealNews = true;
        }
        newsRefreshTimestamps.set(category, Date.now());
      } catch (error) {
        console.error("[News] Failed to refresh real papers, keeping cached items.", error);
      } finally {
        newsRefreshInFlight = null;
      }
    })();

    return newsRefreshInFlight;
  }

  // Public news feed is populated only from real paper sources.
  let newsItems: any[] = [];

  app.get("/api/news", async (req, res) => {
    const { q, category, oa, minCitations, publishedWithinDays, sort } = req.query;
    const categoryValue = typeof category === "string" ? category : "全部";
    const filterOptions: RealNewsFetchOptions = {
      category: categoryValue,
      limit: categoryValue === "全部" ? 10 : 6,
      openAccessOnly: oa === "true",
      minCitations: typeof minCitations === "string" ? Number(minCitations) || 0 : 0,
      publishedWithinDays: typeof publishedWithinDays === "string" ? Number(publishedWithinDays) || 0 : 0,
      sort: sort === "cited" ? "cited" : "latest",
    };
    if (!hasHydratedRealNews) {
      await refreshNews(filterOptions, true);
    } else if (shouldRefreshCategory(categoryValue)) {
      await refreshNews(filterOptions);
    }
    let filtered = dedupeNewsItems([...newsItems]);

    filtered = filtered.filter((item) => matchesNewsFilters(item, filterOptions));

    if (
      filtered.length === 0 &&
      (filterOptions.openAccessOnly || (filterOptions.minCitations || 0) > 0 || (filterOptions.publishedWithinDays || 0) > 0)
    ) {
      await refreshNews(filterOptions, true);
      filtered = dedupeNewsItems([...newsItems]).filter((item) => matchesNewsFilters(item, filterOptions));
    }

    if (q) {
      const query = (q as string).toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.oneSentenceSummary.toLowerCase().includes(query) ||
        item.plainTextContent.toLowerCase().includes(query) ||
        (item.translatedAbstract && item.translatedAbstract.toLowerCase().includes(query))
      );
    }

    if (filterOptions.sort === "cited") {
      filtered.sort((a, b) => (b.citedByCount || 0) - (a.citedByCount || 0));
    } else {
      filtered.sort((a, b) => String(b.publishDate || "").localeCompare(String(a.publishDate || "")));
    }

    res.json(filtered);
  });

  app.post("/api/news/:id/like", (req, res) => {
    const { id } = req.params;
    const item = newsItems.find(n => n.id === id);
    if (item) {
      item.likes = (item.likes || 0) + 1;
      res.json({ likes: item.likes });
    } else {
      res.status(404).json({ error: "News not found" });
    }
  });

  app.post("/api/news/:id/comment", (req, res) => {
    const { id } = req.params;
    const { user, text } = req.body;
    const item = newsItems.find(n => n.id === id);
    if (item) {
      const newComment = {
        id: Date.now().toString(),
        user: user || "匿名用户",
        text,
        date: new Date().toISOString().split('T')[0]
      };
      item.comments = [...(item.comments || []), newComment];
      res.json(newComment);
    } else {
      res.status(404).json({ error: "News not found" });
    }
  });

  app.post("/api/news/crawl", async (req, res) => {
    const category = typeof req.body?.category === "string" ? req.body.category : "全部";
    const crawlOptions: RealNewsFetchOptions = {
      category,
      limit: category === "全部" ? 10 : 6,
      openAccessOnly: Boolean(req.body?.oa),
      minCitations: Number(req.body?.minCitations) || 0,
      publishedWithinDays: Number(req.body?.publishedWithinDays) || 0,
      sort: req.body?.minCitations ? "cited" : "latest",
    };
    try {
      const newItems = await fetchRealNews(crawlOptions);
      if (newItems.length > 0) {
        newsItems = mergeNewsItems(newsItems, newItems);
        hasHydratedRealNews = true;
      }
      newsRefreshTimestamps.set(category, Date.now());
      res.json(newItems);
    } catch (error: any) {
      res.status(502).json({ error: error.message || "Real paper crawl failed." });
    }
  });

  app.post("/api/news/publish-workbench", (req, res) => {
    res.status(409).json({
      error: "大众资讯流现在只允许发布真实论文解读，科研工作台结论不能作为独立资讯直接进入 feed。",
      solution: "请先从真实论文导入研究线索，工作台结论只能作为该论文详情页的后续验证说明或编辑草稿。",
    });
  });

  // Sample Data Generation
  app.get("/api/sample-data", (req, res) => {
    const requestedType = typeof req.query.type === "string" ? req.query.type : "regression";
    const type: SampleDatasetKind =
      requestedType === "classification" ||
      requestedType === "time-series" ||
      requestedType === "privacy-risk"
        ? requestedType
        : "regression";
    res.json({ type, data: buildSampleDataset(type) });
  });

  app.post("/api/compliance/review", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const dataset = parseUploadedDataset(req.file);
      datasets.set(dataset.datasetId, dataset);
      const review = reviewCompliance(dataset.columns, dataset.records);
      const profile = buildDataProfile(dataset.records, dataset.columns);
      appendAudit(
        "compliance_review",
        review.status === "blocked" ? "blocked" : review.status === "warning" ? "warning" : "success",
        review.summary,
        dataset.datasetId,
      );

      const pseudoResult: AnalysisResult = {
        summary: {
          coefficients: { intercept: 0, pm25: 0 },
          rSquared: 0,
          pValue: null,
          pValueMethod: "unavailable",
          n: dataset.records.length,
        },
        data: [],
        columns: { x: "N/A", y: "N/A" },
        complianceReview: review,
        profile,
        trace: {
          datasetId: dataset.datasetId,
          auditTrail: [],
        },
      };
      let guidance;
      try {
        guidance = await generateComplianceGuidance(pseudoResult);
      } catch {
        guidance = undefined;
      }

      res.json({
        datasetId: dataset.datasetId,
        review,
        profile,
        guidance,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/audit-logs", (req, res) => {
    const datasetId = typeof req.query.datasetId === "string" ? req.query.datasetId : undefined;
    const logs = datasetId ? auditLogs.filter((log) => log.datasetId === datasetId) : auditLogs.slice(0, 100);
    res.json({ logs });
  });

  app.get("/api/collaboration/:roomId", (req, res) => {
    try {
      const room = collaborationStore.getRoom(req.params.roomId);
      res.json({ room });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch collaboration room." });
    }
  });

  app.post("/api/collaboration/:roomId/join", (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { name, role, datasetId, roomName } = req.body || {};
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Name is required." });
      }
      if (role !== "lead" && role !== "analyst" && role !== "reviewer") {
        return res.status(400).json({ error: "Invalid role." });
      }

      const payload = collaborationStore.joinRoom({
        roomId,
        name: name.trim(),
        role,
        datasetId: typeof datasetId === "string" ? datasetId : undefined,
        roomName: typeof roomName === "string" ? roomName : undefined,
      });
      appendAudit("collaboration_join", "success", `${name.trim()} 加入协作房间 ${roomId}。`, datasetId);
      res.json(payload);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to join collaboration room." });
    }
  });

  app.post("/api/collaboration/:roomId/notes", (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { memberId, authorName, content, kind } = req.body || {};
      if (typeof memberId !== "string" || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Member and content are required." });
      }

      const room = collaborationStore.addNote({
        roomId,
        memberId,
        authorName: typeof authorName === "string" ? authorName : undefined,
        content: content.trim(),
        kind: kind === "decision" || kind === "update" ? kind : "note",
      });
      appendAudit("collaboration_note", "success", `${authorName || memberId} 添加了协作备注。`, room.datasetId);
      res.json({ room });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to add collaboration note." });
    }
  });

  app.post("/api/collaboration/:roomId/tasks", (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { memberId, title, ownerName } = req.body || {};
      if (typeof memberId !== "string" || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Task title is required." });
      }

      const room = collaborationStore.addTask({
        roomId,
        memberId,
        title: title.trim(),
        ownerName: typeof ownerName === "string" ? ownerName : undefined,
      });
      appendAudit("collaboration_task", "success", `协作任务已创建：${title.trim()}`, room.datasetId);
      res.json({ room });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to add collaboration task." });
    }
  });

  app.post("/api/collaboration/:roomId/tasks/:taskId/toggle", (req, res) => {
    try {
      const { memberId } = req.body || {};
      if (typeof memberId !== "string") {
        return res.status(400).json({ error: "Member is required." });
      }
      const room = collaborationStore.toggleTask({
        roomId: req.params.roomId,
        taskId: req.params.taskId,
        memberId,
      });
      appendAudit("collaboration_task_toggle", "success", `协作任务状态已切换：${req.params.taskId}`, room.datasetId);
      res.json({ room });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to toggle collaboration task." });
    }
  });

  // API Routes
  app.post("/api/analyze", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const dataset = parseUploadedDataset(req.file);
      datasets.set(dataset.datasetId, dataset);

      if (dataset.records.length < 5) {
        appendAudit("analysis_blocked", "blocked", "样本量少于 5 行，拒绝分析。", dataset.datasetId);
        return res.status(400).json({ error: "Insufficient data. Need at least 5 rows." });
      }

      const review = reviewCompliance(dataset.columns, dataset.records);
      appendAudit(
        "compliance_review",
        review.status === "blocked" ? "blocked" : review.status === "warning" ? "warning" : "success",
        review.summary,
        dataset.datasetId,
      );

      const profile = buildDataProfile(dataset.records, dataset.columns);
      const modelComparison = buildModelComparison(dataset.records, profile);

      if (review.status === "blocked") {
        const guidance = await generateComplianceGuidance({
          summary: {
            coefficients: { intercept: 0, pm25: 0 },
            rSquared: 0,
            pValue: null,
            pValueMethod: "unavailable",
            n: dataset.records.length,
          },
          data: [],
          columns: { x: "N/A", y: "N/A" },
          complianceReview: review,
          profile,
          modelComparison,
          trace: {
            datasetId: dataset.datasetId,
            auditTrail: [],
          },
        });

        return res.status(403).json({
          error: "High-risk fields detected. Complete desensitization before analysis.",
          datasetId: dataset.datasetId,
          review,
          profile,
          modelComparison,
          complianceGuidance: guidance,
        });
      }

      const regressionView = pickRegressionViewData(dataset.records, profile, modelComparison);
      if (!regressionView) {
        appendAudit("analysis_blocked", "warning", "缺少默认分析所需列。", dataset.datasetId);
        return res.status(400).json({
          error: "Missing required numeric columns for the default regression view.",
          detectedColumns: dataset.columns,
          required: ["at least 2 numeric columns"],
          datasetId: dataset.datasetId,
          review,
          profile,
          modelComparison,
        });
      }

      const numericRows = regressionView.numericRows;

      if (numericRows.length < 5) {
        appendAudit("analysis_blocked", "warning", "有效数值行少于 5 行。", dataset.datasetId);
        return res.status(400).json({
          error: "Insufficient numeric data. Need at least 5 valid rows.",
          datasetId: dataset.datasetId,
          review,
          profile,
          modelComparison,
        });
      }

      const dataPoints = numericRows.map(({ x, y }) => [x, y] as [number, number]);
      const summary = calculateRegressionSummary(dataPoints);
      const preliminaryResult: AnalysisResult = {
        summary,
        data: numericRows,
        columns: {
          x: regressionView.xKey,
          y: regressionView.yKey,
        },
        complianceReview: review,
        profile,
        modelComparison,
        trace: {
          datasetId: dataset.datasetId,
          auditTrail: [],
        },
      };
      const complianceGuidance = await generateComplianceGuidance(preliminaryResult);
      const auditTrail = [
        appendAudit("profile_dataset", "success", `完成数据体检，质量评分 ${profile.qualityScore}。`, dataset.datasetId),
        appendAudit(
          "compare_models",
          "success",
          `完成多模型对比，推荐 ${modelComparison.bestModelName}。`,
          dataset.datasetId,
        ),
        appendAudit("run_analysis", "success", `完成基线回归分析，R²=${summary.rSquared.toFixed(3)}。`, dataset.datasetId),
        appendAudit("generate_compliance_guidance", "success", "已生成 AI 合规解决方案。", dataset.datasetId),
      ];

      res.json({
        summary,
        data: numericRows,
        columns: {
          x: regressionView.xKey,
          y: regressionView.yKey
        },
        complianceReview: review,
        complianceGuidance,
        profile,
        modelComparison,
        trace: {
          datasetId: dataset.datasetId,
          auditTrail,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/report", (req, res) => {
    try {
      const { result, aiResponse } = req.body || {};
      if (!result) {
        return res.status(400).json({ error: "Analysis result is required." });
      }

      const report = buildReport(result as AnalysisResult, aiResponse);
      appendAudit("generate_report", "success", "已生成结构化分析报告。", result.trace?.datasetId);
      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Report generation failed." });
    }
  });

  app.post("/api/paper-draft", (req, res) => {
    try {
      const { result, aiResponse } = req.body || {};
      if (!result) {
        return res.status(400).json({ error: "Analysis result is required." });
      }

      generateAIPaperDraft(result as AnalysisResult, aiResponse)
        .then((aiDraft) => {
          const fallbackDraft = buildPaperDraft(result as AnalysisResult, aiResponse);
          const paperDraft = aiDraft.paperDraft
            ? {
                ...fallbackDraft,
                ...aiDraft.paperDraft,
                evidenceMap: fallbackDraft.evidenceMap,
              }
            : fallbackDraft;

          appendAudit(
            "generate_paper_draft",
            "success",
            `已生成论文初稿（${aiDraft.provider === "openai" ? "AI" : "模板"}）。`,
            result.trace?.datasetId,
          );
          res.json({ paperDraft, provider: aiDraft.provider });
        })
        .catch((error: any) => {
          res.status(500).json({ error: error.message || "Paper draft generation failed." });
        });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Paper draft generation failed." });
    }
  });

  app.post("/api/ai/compliance-guidance", async (req, res) => {
    try {
      const { result } = req.body || {};
      if (!result) {
        return res.status(400).json({ error: "Analysis result is required." });
      }

      const guidance = await generateComplianceGuidance(result as AnalysisResult);
      res.json(guidance);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Compliance guidance failed." });
    }
  });

  app.post("/api/ai/analysis", async (req, res) => {
    try {
      const { summary, dataSample, mode, query, labels } = req.body || {};

      if (!summary || !Array.isArray(dataSample) || (mode !== "researcher" && mode !== "public")) {
        return res.status(400).json({ error: "Invalid AI analysis payload." });
      }

      const result = await generateAnalysisText(
        summary,
        dataSample,
        mode,
        labels && typeof labels.x === "string" && typeof labels.y === "string"
          ? { x: labels.x, y: labels.y }
          : undefined,
        query,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "AI analysis failed." });
    }
  });

  app.post("/api/ai/what-if", async (req, res) => {
    try {
      const { data, coefficient, label } = req.body || {};

      if (!data || typeof coefficient !== "number") {
        return res.status(400).json({ error: "Invalid What-If payload." });
      }

      const result = await generateWhatIfText(data, coefficient, typeof label === "string" ? label : undefined);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "What-If analysis failed." });
    }
  });

  app.post("/api/ai/translate-paper", async (req, res) => {
    try {
      const { abstract } = req.body || {};

      if (typeof abstract !== "string" || !abstract.trim()) {
        return res.status(400).json({ error: "Abstract is required." });
      }

      const result = await generateTranslatedPaper(abstract);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Paper translation failed." });
    }
  });

  app.post("/api/ai/discuss", async (req, res) => {
    try {
      const { page, question, result } = req.body || {};
      if (typeof page !== "string" || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Page and question are required." });
      }

      const response = await generateDiscussionResponse(page, question, result as AnalysisResult | undefined);
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "AI discussion failed." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setInterval(() => {
      refreshNews({ category: "全部", limit: 10 }).catch((error) => {
        console.error("[News] Scheduled refresh failed.", error);
      });
    }, NEWS_REFRESH_INTERVAL_MS);
    refreshNews({ category: "全部", limit: 10 }, true).catch((error) => {
      console.error("[News] Initial scheduled refresh failed.", error);
    });
  });
}

startServer();
