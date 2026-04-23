export interface StatsSummary {
  coefficients: {
    intercept: number;
    pm25: number;
  };
  rSquared: number;
  pValue: number | null;
  pValueMethod: "student-t" | "unavailable";
  n: number;
}

export interface DataPoint {
  x: number;
  y: number;
}

export type AnalysisMode = 'researcher' | 'public';
export type ComplianceSeverity = "low" | "medium" | "high";
export type ComplianceStatus = "passed" | "warning" | "blocked";
export type ProfileColumnType = "numeric" | "binary" | "categorical" | "datetime" | "text" | "unknown";

export interface ComplianceFinding {
  field: string;
  reason: string;
  severity: ComplianceSeverity;
  evidence?: string;
}

export interface ComplianceReview {
  status: ComplianceStatus;
  riskLevel: ComplianceSeverity;
  findings: ComplianceFinding[];
  suggestions: string[];
  summary: string;
}

export interface ComplianceGuidance {
  provider: "openai" | "local-fallback";
  summary: string;
  desensitizationPlan: string[];
  reviewWorkflow: string[];
  copyrightChecklist: string[];
  publishGuardrails: string[];
}

export interface ProfileColumn {
  name: string;
  type: ProfileColumnType;
  missingRate: number;
  uniqueCount: number;
  sampleValues: string[];
  notes: string[];
}

export interface ModelRecommendation {
  id: string;
  name: string;
  fitScore: number;
  reason: string;
  limitations: string[];
}

export interface ModelRunResult {
  id: string;
  name: string;
  family: "regression" | "classification" | "time-series" | "eda";
  score: number;
  summary: string;
  metrics: Record<string, number | string>;
  rationale: string;
  limitations: string[];
}

export interface ModelComparison {
  datasetShape: "regression" | "classification" | "time-series" | "mixed";
  selectedTarget?: string;
  selectedFeatures: string[];
  bestModelId: string;
  bestModelName: string;
  whyRecommended: string;
  runs: ModelRunResult[];
}

export interface DataProfile {
  rowCount: number;
  columnCount: number;
  datasetShape: "regression" | "classification" | "time-series" | "mixed";
  missingCells: number;
  qualityScore: number;
  issues: string[];
  columns: ProfileColumn[];
  recommendedModels: ModelRecommendation[];
}

export interface EvidenceItem {
  label: string;
  value: string;
  source: string;
}

export interface GeneratedReport {
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  limitations: string[];
  nextSteps: string[];
  evidence: EvidenceItem[];
  disclaimer: string;
}

export interface PaperDraft {
  title: string;
  abstract: string;
  introduction: string;
  methods: string;
  results: string;
  discussion: string;
  limitations: string;
  evidenceMap: EvidenceItem[];
  disclaimer: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: "success" | "warning" | "blocked";
  datasetId?: string;
  summary: string;
}

export interface AnalysisTrace {
  datasetId: string;
  auditTrail: AuditLogEntry[];
}

export type CollaborationRole = "lead" | "analyst" | "reviewer";

export interface CollaborationMember {
  id: string;
  name: string;
  role: CollaborationRole;
  lastSeen: string;
}

export interface CollaborationNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  kind: "note" | "decision" | "update";
}

export interface CollaborationTask {
  id: string;
  title: string;
  status: "todo" | "done";
  statusLabel?: string;
  ownerName?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CollaborationActivity {
  id: string;
  actorName: string;
  actorRole?: CollaborationRole;
  action: string;
  detail: string;
  createdAt: string;
}

export interface CollaborationRoom {
  id: string;
  name: string;
  strategy: string;
  objective: string;
  datasetId?: string;
  members: CollaborationMember[];
  notes: CollaborationNote[];
  tasks: CollaborationTask[];
  activities: CollaborationActivity[];
  updatedAt: string;
}

export interface DiscussionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface DiscussionResponse {
  provider: "openai" | "local-fallback";
  message: DiscussionMessage;
}

export interface Comment {
  id: string;
  userName: string;
  content: string;
  timestamp: string;
}

export interface NewsExplainers {
  whyItMatters: string;
  howStudyWorked: string;
  keyFindings: string[];
  limitations: string[];
  everydayMeaning: string;
  readerActions: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  date: string;
  imageUrl: string;
  likesCount: number;
  translatedAbstract?: string;
  authors?: string[];
  citedByCount?: number;
  doi?: string;
  explainers?: NewsExplainers;
  sourceLink?: string;
  sourceJournal?: string;
  comments?: Comment[];
  isOpenAccess?: boolean;
  publicationYear?: number;
}

export interface NewsFilters {
  openAccessOnly: boolean;
  highlyCitedOnly: boolean;
  recentOnly: boolean;
}

export interface ImportedResearchLead {
  id: string;
  importedAt: string;
  title: string;
  category: string;
  summary: string;
  translatedAbstract?: string;
  sourceJournal?: string;
  sourceLink?: string;
  authors: string[];
  citedByCount?: number;
  isOpenAccess?: boolean;
  publicationYear?: number;
  researchQuestion: string;
  hypothesis: string;
  suggestedDataset: "regression" | "classification" | "time-series";
  suggestedModels: string[];
  dataNeeds: string[];
  collaborationTasks: string[];
  readerTakeaways: string[];
}

export interface WorkbenchFeedbackBrief {
  headline: string;
  summary: string;
  highlights: string[];
  caution: string;
}

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  elementId: string;
  timestamp: string;
  userId?: string;
  metadata?: any;
}

export interface AnalysisResult {
  summary: StatsSummary;
  data: DataPoint[];
  columns: {
    x: string;
    y: string;
  };
  complianceReview?: ComplianceReview;
  complianceGuidance?: ComplianceGuidance;
  profile?: DataProfile;
  modelComparison?: ModelComparison;
  trace?: AnalysisTrace;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
}
