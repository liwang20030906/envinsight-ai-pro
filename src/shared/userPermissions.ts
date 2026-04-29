import type { CollaborationRole, TeamUserRole } from "../types";

export type UserPermissionAction =
  | "browse-news"
  | "import-research-lead"
  | "use-sample-data"
  | "upload-data"
  | "run-compliance-review"
  | "review-compliance"
  | "view-raw-data"
  | "view-model-analysis"
  | "generate-report"
  | "export-report"
  | "generate-paper-draft"
  | "enter-collaboration-room"
  | "manage-collaboration-room"
  | "create-collaboration-task"
  | "update-collaboration-task"
  | "record-collaboration-decision"
  | "review-content-publish"
  | "view-audit-trail"
  | "manage-team-members";

export type DataOwnershipScope = "public" | "personal" | "team" | "project";
export type PermissionRiskLevel = "low" | "medium" | "high";

export interface PermissionContext {
  dataScope?: DataOwnershipScope;
  isOwner?: boolean;
  isTeamMember?: boolean;
  isProjectMember?: boolean;
  invitedToRoom?: boolean;
  riskLevel?: PermissionRiskLevel;
  auditPurpose?: boolean;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
  guardrail?: string;
}

export interface RoleDefinition {
  role: TeamUserRole;
  label: string;
  summary: string;
  responsibilities: string[];
  restrictions: string[];
}

export interface RoleOnboardingGuide {
  role: TeamUserRole;
  startWith: string;
  canDoNow: string[];
  watchOut: string[];
  nextGrowth: string;
}

export const TEAM_USER_ROLE_DEFINITIONS: Record<TeamUserRole, RoleDefinition> = {
  "public-user": {
    role: "public-user",
    label: "普通用户",
    summary: "浏览大众资讯和体验示例数据的轻量用户。",
    responsibilities: ["浏览环境健康资讯", "导入论文线索到个人草稿", "使用示例数据体验分析流程"],
    restrictions: ["不能上传真实项目数据", "不能查看团队原始数据", "不能审核内容发布"],
  },
  researcher: {
    role: "researcher",
    label: "研究员",
    summary: "科研工作台的主要分析和研究执行者。",
    responsibilities: ["上传数据", "发起合规审查", "查看模型分析", "生成报告和论文初稿", "参与协作研究室"],
    restrictions: ["高风险数据需要审核", "公开发布前必须提交审核", "只能查看授权范围内的原始数据"],
  },
  "team-admin": {
    role: "team-admin",
    label: "团队管理员",
    summary: "团队空间、项目成员、团队数据和协作房间的管理者。",
    responsibilities: ["管理团队成员", "管理项目数据", "维护协作房间", "查看团队审计轨迹"],
    restrictions: ["不能绕过合规审查", "对外发布仍需审核员确认"],
  },
  auditor: {
    role: "auditor",
    label: "审核员",
    summary: "负责合规复核、报告导出复核和公开内容发布审核。",
    responsibilities: ["复核合规审查", "审核报告导出", "审核内容发布", "查看审核相关审计记录"],
    restrictions: ["不负责日常建模操作", "审核结论必须留痕"],
  },
};

const BASE_ROLE_PERMISSIONS: Record<TeamUserRole, ReadonlySet<UserPermissionAction>> = {
  "public-user": new Set(["browse-news", "import-research-lead", "use-sample-data", "enter-collaboration-room"]),
  researcher: new Set([
    "browse-news",
    "import-research-lead",
    "use-sample-data",
    "upload-data",
    "run-compliance-review",
    "view-raw-data",
    "view-model-analysis",
    "generate-report",
    "export-report",
    "generate-paper-draft",
    "enter-collaboration-room",
  ]),
  "team-admin": new Set([
    "browse-news",
    "import-research-lead",
    "use-sample-data",
    "upload-data",
    "run-compliance-review",
    "view-raw-data",
    "view-model-analysis",
    "generate-report",
    "export-report",
    "generate-paper-draft",
    "enter-collaboration-room",
    "manage-collaboration-room",
    "create-collaboration-task",
    "update-collaboration-task",
    "record-collaboration-decision",
    "view-audit-trail",
    "manage-team-members",
  ]),
  auditor: new Set([
    "browse-news",
    "import-research-lead",
    "review-compliance",
    "view-raw-data",
    "view-model-analysis",
    "export-report",
    "enter-collaboration-room",
    "update-collaboration-task",
    "record-collaboration-decision",
    "review-content-publish",
    "view-audit-trail",
  ]),
};

export const ROLE_ONBOARDING_GUIDES: Record<TeamUserRole, RoleOnboardingGuide> = {
  "public-user": {
    role: "public-user",
    startWith: "先浏览公开资讯，再把感兴趣论文导入个人草稿。",
    canDoNow: ["浏览环境健康资讯", "导入论文线索", "使用示例数据体验流程"],
    watchOut: ["不能上传真实项目数据", "进入协作房间需要邀请", "不能审核公开发布内容"],
    nextGrowth: "如果需要做真实研究分析，升级为研究员。",
  },
  researcher: {
    role: "researcher",
    startWith: "从数据准备开始，先上传数据并完成合规预审。",
    canDoNow: ["上传数据", "查看模型分析", "生成报告和论文初稿", "参与协作研究室"],
    watchOut: ["高风险报告导出需要审核", "公开发布前必须提交复核", "只查看授权范围内原始数据"],
    nextGrowth: "如果需要管理成员和任务，交给团队管理员配置。",
  },
  "team-admin": {
    role: "team-admin",
    startWith: "先创建协作房间和任务板，明确成员分工。",
    canDoNow: ["管理团队成员", "创建协作任务", "查看团队审计轨迹", "组织报告交付"],
    watchOut: ["不能绕过合规审查", "公开发布仍需审核员确认", "角色变更要留痕"],
    nextGrowth: "下一步补齐项目空间、成员邀请和数据授权配置。",
  },
  auditor: {
    role: "auditor",
    startWith: "优先查看合规结果、报告导出和公开发布风险。",
    canDoNow: ["复核合规审查", "更新任务状态", "记录正式决策", "审核内容发布"],
    watchOut: ["原始数据只在审核目的下查看", "审核结论必须留痕", "不负责日常建模操作"],
    nextGrowth: "后续可扩展为审核队列、发布门禁和风险分级看板。",
  },
};

export const DATA_OWNERSHIP_RULES: Record<DataOwnershipScope, string[]> = {
  public: ["所有用户可浏览", "必须保留公开来源和证据链", "工作台结论公开前必须审核"],
  personal: ["默认仅上传者可见", "分享至协作房间前需要确认", "导出报告仍需合规提示"],
  team: ["归属团队空间", "由团队管理员配置访问范围", "原始数据访问必须记录审计"],
  project: ["归属具体研究项目", "仅项目成员可访问", "项目归档后建议只读保留"],
};

export const CORE_USER_JOURNEY = [
  {
    step: "浏览环境健康资讯",
    action: "browse-news" as const,
    roles: ["public-user", "researcher", "team-admin", "auditor"] as TeamUserRole[],
    guardrail: "仅展示公开来源，避免虚构资讯。",
  },
  {
    step: "导入论文线索",
    action: "import-research-lead" as const,
    roles: ["public-user", "researcher", "team-admin", "auditor"] as TeamUserRole[],
    guardrail: "线索必须标注未验证，不能直接等同研究结论。",
  },
  {
    step: "上传或选择示例数据",
    action: "upload-data" as const,
    roles: ["researcher", "team-admin"] as TeamUserRole[],
    guardrail: "真实数据上传后必须触发合规审查，示例数据默认脱敏。",
  },
  {
    step: "进行合规审查",
    action: "run-compliance-review" as const,
    roles: ["researcher", "team-admin", "auditor"] as TeamUserRole[],
    guardrail: "高风险字段需要拦截或提交审核员复核。",
  },
  {
    step: "查看模型分析",
    action: "view-model-analysis" as const,
    roles: ["researcher", "team-admin", "auditor"] as TeamUserRole[],
    guardrail: "必须提示相关性不等于因果性。",
  },
  {
    step: "生成报告和论文初稿",
    action: "generate-report" as const,
    roles: ["researcher", "team-admin"] as TeamUserRole[],
    guardrail: "AI 只能基于分析结果生成，禁止编造方法和结论。",
  },
  {
    step: "进入协作研究室",
    action: "enter-collaboration-room" as const,
    roles: ["public-user", "researcher", "team-admin", "auditor"] as TeamUserRole[],
    guardrail: "按邀请和项目成员权限展示数据。",
  },
  {
    step: "审核并沉淀分析历史",
    action: "review-content-publish" as const,
    roles: ["team-admin", "auditor"] as TeamUserRole[],
    guardrail: "审核结论、导出记录和历史快照必须留痕。",
  },
];

export function getTeamUserRoleLabel(role: TeamUserRole): string {
  return TEAM_USER_ROLE_DEFINITIONS[role].label;
}

export function getTeamUserRoleCapabilities(role: TeamUserRole): UserPermissionAction[] {
  return Array.from(BASE_ROLE_PERMISSIONS[role]);
}

export function getRoleOnboardingGuide(role: TeamUserRole): RoleOnboardingGuide {
  return ROLE_ONBOARDING_GUIDES[role];
}

export function mapCollaborationRoleToTeamUserRole(role: CollaborationRole): TeamUserRole {
  if (role === "lead") return "team-admin";
  if (role === "reviewer") return "auditor";
  return "researcher";
}

export function getCollaborationRolePermissionSummary(role: CollaborationRole): {
  collaborationRole: CollaborationRole;
  teamRole: TeamUserRole;
  label: string;
  summary: string;
  highlights: string[];
} {
  const teamRole = mapCollaborationRoleToTeamUserRole(role);
  const definition = TEAM_USER_ROLE_DEFINITIONS[teamRole];
  return {
    collaborationRole: role,
    teamRole,
    label: definition.label,
    summary: definition.summary,
    highlights: definition.responsibilities.slice(0, 3),
  };
}

export function canUserPerform(
  role: TeamUserRole,
  action: UserPermissionAction,
  context: PermissionContext = {},
): PermissionDecision {
  if (!BASE_ROLE_PERMISSIONS[role].has(action)) {
    return {
      allowed: false,
      reason: `${getTeamUserRoleLabel(role)}没有“${action}”权限。`,
    };
  }

  if (action === "enter-collaboration-room" && role === "public-user" && !context.invitedToRoom) {
    return {
      allowed: false,
      reason: "普通用户需要受邀后才能进入协作房间。",
      guardrail: "协作房间应按邀请和项目成员权限展示数据。",
    };
  }

  if (action === "view-raw-data") {
    const scope = context.dataScope || "personal";
    if (scope === "public") {
      return { allowed: true, reason: "公开资讯不包含受限原始数据。" };
    }
    if (role === "researcher" && !(context.isOwner || context.isProjectMember)) {
      return {
        allowed: false,
        reason: "研究员只能查看自己或授权项目内的原始数据。",
        guardrail: "原始数据访问必须记录审计。",
      };
    }
    if (role === "team-admin" && !(context.isTeamMember || context.isProjectMember)) {
      return {
        allowed: false,
        reason: "团队管理员只能查看团队或项目授权范围内的原始数据。",
        guardrail: "团队数据访问需要绑定 teamId 或 projectId。",
      };
    }
    if (role === "auditor" && !context.auditPurpose) {
      return {
        allowed: false,
        reason: "审核员只有在审核目的下才能查看原始数据。",
        guardrail: "审核查看范围应最小化并留下审计记录。",
      };
    }
  }

  if (action === "export-report" && context.riskLevel === "high" && role !== "auditor") {
    return {
      allowed: false,
      reason: "高风险报告导出需要审核员复核。",
      guardrail: "报告必须带证据链、局限说明和免责声明。",
    };
  }

  if (action === "review-content-publish" && role !== "auditor") {
    return {
      allowed: false,
      reason: "公开内容发布必须由审核员确认。",
      guardrail: "工作台结论只能先进入编辑草稿，不能直接发布到资讯流。",
    };
  }

  return {
    allowed: true,
    reason: `${getTeamUserRoleLabel(role)}可以执行该操作。`,
  };
}
