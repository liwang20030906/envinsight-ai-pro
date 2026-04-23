import type { AnalysisMode, AnalysisResult, DiscussionResponse, StatsSummary } from "../types";

type WhatIfInput = {
  pm25Change: number;
  predictedDiseaseChange: number;
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "AI request failed");
  }

  return data as T;
}

export async function getAIAnalysisStream(
  summary: StatsSummary,
  dataSample: Array<{ x: number; y: number }>,
  mode: AnalysisMode,
  labels: { x: string; y: string },
  onChunk: (chunk: string) => void,
  query?: string,
) {
  const result = await postJSON<{ text: string }>("/api/ai/analysis", {
    summary,
    dataSample,
    mode,
    labels,
    query,
  });

  onChunk(result.text);
}

export async function getAIAnalysis(
  summary: StatsSummary,
  dataSample: Array<{ x: number; y: number }>,
  mode: AnalysisMode,
  labels: { x: string; y: string },
  query?: string,
) {
  const result = await postJSON<{ text: string }>("/api/ai/analysis", {
    summary,
    dataSample,
    mode,
    labels,
    query,
  });

  return result.text;
}

export async function translatePaperToNews(abstract: string) {
  const result = await postJSON<{ result: Record<string, string> }>("/api/ai/translate-paper", {
    abstract,
  });

  return result.result;
}

export async function getWhatIfAnalysis(data: WhatIfInput, coefficient: number, label: string) {
  const result = await postJSON<{ text: string }>("/api/ai/what-if", {
    data,
    coefficient,
    label,
  });

  return result.text;
}

export async function discussWithAI(page: string, question: string, result?: AnalysisResult | null) {
  return postJSON<DiscussionResponse>("/api/ai/discuss", {
    page,
    question,
    result,
  });
}

export async function generateConceptImage(prompt: string) {
  console.log("[Image Generation] No image API available. Prompt was:", prompt);
  return `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 20))}/800/450`;
}
