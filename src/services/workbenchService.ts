import type {
  AnalysisResult,
  AuditLogEntry,
  ComplianceGuidance,
  ComplianceReview,
  DataProfile,
  GeneratedReport,
  PaperDraft,
} from "../types";

type SampleDatasetType = "regression" | "classification" | "time-series" | "privacy-risk";

async function parseJSONResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export async function reviewDataset(file: File): Promise<{
  review: ComplianceReview;
  guidance?: ComplianceGuidance;
  profile?: DataProfile;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/compliance/review", {
    method: "POST",
    body: formData,
  });

  return parseJSONResponse(response);
}

export async function analyzeDataset(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze", {
    method: "POST",
    body: formData,
  });

  return parseJSONResponse(response);
}

export async function generateReport(result: AnalysisResult, aiResponse: string): Promise<{ report: GeneratedReport }> {
  const response = await fetch("/api/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ result, aiResponse }),
  });

  return parseJSONResponse(response);
}

export async function generatePaperDraft(result: AnalysisResult, aiResponse: string): Promise<{ paperDraft: PaperDraft }> {
  const response = await fetch("/api/paper-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ result, aiResponse }),
  });

  return parseJSONResponse(response);
}

export async function fetchAuditTrail(datasetId: string): Promise<{ logs: AuditLogEntry[] }> {
  const response = await fetch(`/api/audit-logs?datasetId=${encodeURIComponent(datasetId)}`);
  return parseJSONResponse(response);
}

export async function fetchSampleDataset(type: SampleDatasetType): Promise<Record<string, unknown>[]> {
  const response = await fetch(`/api/sample-data?type=${encodeURIComponent(type)}`);
  const data = await parseJSONResponse<{ data: Record<string, unknown>[] }>(response);
  return data.data;
}
