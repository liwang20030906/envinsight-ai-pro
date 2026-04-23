import type { ComplianceFinding, ComplianceReview, ComplianceSeverity, ComplianceStatus } from "../types";

type RowRecord = Record<string, unknown>;

const DIRECT_IDENTIFIER_RULES: Array<{ severity: ComplianceSeverity; reason: string; keywords: string[] }> = [
  {
    severity: "high",
    reason: "字段名疑似直接身份标识，不应在未脱敏前进入分析链路。",
    keywords: ["name", "姓名", "email", "邮箱", "phone", "mobile", "手机号", "身份证", "idcard", "passport"],
  },
  {
    severity: "medium",
    reason: "字段名疑似间接身份标识，应先评估脱敏或聚合处理。",
    keywords: ["address", "地址", "hospital", "医院", "school", "学校", "zip", "postcode", "单位"],
  },
];

const COPYRIGHT_RULE = {
  severity: "medium" as ComplianceSeverity,
  reason: "字段可能包含受版权或许可限制的文本内容，需确认是否具备二次加工权限。",
  keywords: ["fulltext", "全文", "abstract", "摘要", "pdf", "doi", "source", "url", "版权"],
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d -]{7,}\d)/;
const ID_PATTERN = /(?:\d{15}|\d{17}[\dXx])/;
const DATE_PATTERN = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

function isLikelyDate(value: string): boolean {
  return DATE_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function rankSeverity(severity: ComplianceSeverity): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function dedupeFindings(findings: ComplianceFinding[]): ComplianceFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.field}:${finding.reason}:${finding.severity}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function detectHeaderFindings(columns: string[]): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const column of columns) {
    const normalized = column.toLowerCase();

    for (const rule of DIRECT_IDENTIFIER_RULES) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        findings.push({
          field: column,
          reason: rule.reason,
          severity: rule.severity,
          evidence: "column-name-match",
        });
      }
    }

    if (COPYRIGHT_RULE.keywords.some((keyword) => normalized.includes(keyword))) {
      findings.push({
        field: column,
        reason: COPYRIGHT_RULE.reason,
        severity: COPYRIGHT_RULE.severity,
        evidence: "column-name-match",
      });
    }
  }

  return findings;
}

function detectSampleValueFindings(records: RowRecord[], columns: string[]): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const column of columns) {
    const sampleValues = records
      .slice(0, 10)
      .map((record) => String(record[column] ?? "").trim())
      .filter(Boolean);
    const nonDateValues = sampleValues.filter((value) => !isLikelyDate(value));

    if (sampleValues.some((value) => EMAIL_PATTERN.test(value))) {
      findings.push({
        field: column,
        reason: "样例值中检测到邮箱格式，属于高风险直接身份标识。",
        severity: "high",
        evidence: "email-pattern",
      });
    }

    if (nonDateValues.some((value) => PHONE_PATTERN.test(value))) {
      findings.push({
        field: column,
        reason: "样例值中检测到手机号/电话格式，建议先脱敏再分析。",
        severity: "high",
        evidence: "phone-pattern",
      });
    }

    if (sampleValues.some((value) => ID_PATTERN.test(value))) {
      findings.push({
        field: column,
        reason: "样例值中检测到身份证件号格式，应先脱敏或剔除。",
        severity: "high",
        evidence: "id-pattern",
      });
    }
  }

  return findings;
}

function buildSuggestions(findings: ComplianceFinding[]): string[] {
  const suggestions = new Set<string>([
    "先删除或哈希化直接身份字段，再进入分析。",
    "保留字段级审查结论，确保后续报告可追溯。",
  ]);

  if (findings.some((finding) => finding.severity === "high")) {
    suggestions.add("当前存在高风险字段，未脱敏前不应直接进入分析或导出链路。");
  }

  if (findings.some((finding) => finding.reason.includes("版权"))) {
    suggestions.add("涉及论文摘要或全文时，请确认开放获取许可或引用范围，避免越权二次加工。");
  }

  return [...suggestions];
}

function summarize(status: ComplianceStatus, findings: ComplianceFinding[]): string {
  if (status === "passed") {
    return "未发现高风险身份字段，可进入下一步分析。";
  }

  if (status === "warning") {
    return `检测到 ${findings.length} 项需人工复核的风险点，建议先完成脱敏与版权确认。`;
  }

  return `检测到 ${findings.length} 项高风险字段，当前数据应被拦截，待脱敏后再分析。`;
}

export function reviewCompliance(columns: string[], records: RowRecord[]): ComplianceReview {
  const findings = dedupeFindings([
    ...detectHeaderFindings(columns),
    ...detectSampleValueFindings(records, columns),
  ]);

  const riskLevel = findings.reduce<ComplianceSeverity>(
    (current, finding) => (rankSeverity(finding.severity) > rankSeverity(current) ? finding.severity : current),
    "low",
  );

  let status: ComplianceStatus = "passed";
  if (riskLevel === "medium") {
    status = "warning";
  }
  if (riskLevel === "high") {
    status = "blocked";
  }

  return {
    status,
    riskLevel,
    findings,
    suggestions: buildSuggestions(findings),
    summary: summarize(status, findings),
  };
}
