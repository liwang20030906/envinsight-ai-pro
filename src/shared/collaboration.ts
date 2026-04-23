import type {
  CollaborationActivity,
  CollaborationMember,
  CollaborationNote,
  CollaborationRole,
  CollaborationRoom,
  CollaborationTask,
} from "../types";

type ActorRef = {
  memberId: string;
  actorName?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRoom(room: CollaborationRoom): CollaborationRoom {
  return JSON.parse(JSON.stringify(room)) as CollaborationRoom;
}

function createActivity(
  actorName: string,
  actorRole: CollaborationRole | undefined,
  action: string,
  detail: string,
): CollaborationActivity {
  return {
    id: createId("activity"),
    actorName,
    actorRole,
    action,
    detail,
    createdAt: nowIso(),
  };
}

function canCreateDecision(role: CollaborationRole): boolean {
  return role === "lead" || role === "reviewer";
}

function canCreateTask(role: CollaborationRole): boolean {
  return role === "lead";
}

function canToggleTask(role: CollaborationRole): boolean {
  return role === "lead" || role === "reviewer";
}

function roleLabel(role: CollaborationRole): string {
  if (role === "lead") return "负责人";
  if (role === "reviewer") return "复核人";
  return "分析师";
}

function createSeedRoom(roomId: string): CollaborationRoom {
  const createdAt = nowIso();
  const members: CollaborationMember[] = [
    {
      id: "member_seed_lead",
      name: "项目负责人陈老师",
      role: "lead",
      lastSeen: createdAt,
    },
    {
      id: "member_seed_analyst",
      name: "分析师李同学",
      role: "analyst",
      lastSeen: createdAt,
    },
    {
      id: "member_seed_reviewer",
      name: "审稿人孙老师",
      role: "reviewer",
      lastSeen: createdAt,
    },
  ];
  const tasks: CollaborationTask[] = [
    {
      id: "task_seed_1",
      title: "复核字段脱敏与来源许可",
      status: "done",
      statusLabel: "已完成",
      ownerName: "项目负责人陈老师",
      createdAt,
      completedAt: createdAt,
    },
    {
      id: "task_seed_2",
      title: "确认最优模型是否适合写入论文结果段",
      status: "todo",
      statusLabel: "待处理",
      ownerName: "分析师李同学",
      createdAt,
    },
  ];
  const notes: CollaborationNote[] = [
    {
      id: "note_seed_1",
      authorId: members[0].id,
      authorName: members[0].name,
      content: "先做合规与建模建议，再决定是否进入论文初稿。",
      createdAt,
      kind: "decision",
    },
    {
      id: "note_seed_2",
      authorId: members[1].id,
      authorName: members[1].name,
      content: "建议围绕当前推荐模型补一轮结果解释，避免直接下因果结论。",
      createdAt,
      kind: "update",
    },
  ];
  const activities: CollaborationActivity[] = [
    createActivity("项目负责人陈老师", "lead", "加入房间", "创建并初始化了示例协作房间。"),
    createActivity("审稿人孙老师", "reviewer", "审查复核", "补充了对外发布前的审稿要求。"),
  ];

  return {
    id: roomId,
    name: "EnvInsight 示例研究室",
    strategy:
      "轻量协作策略：房间码 + 邀请链接 + 共享任务板 + 决策记录 + 历史轨迹，适合科研小组快速协同。",
    objective: "围绕当前环境健康数据完成合规审查、模型选择、结果复核与论文初稿协同。",
    members,
    notes,
    tasks,
    activities,
    updatedAt: createdAt,
  };
}

export function createCollaborationStore() {
  const rooms = new Map<string, CollaborationRoom>();
  const demoRoom = createSeedRoom("envinsight-demo-room");
  rooms.set(demoRoom.id, demoRoom);

  function getOrCreateRoom(roomId: string, name?: string, datasetId?: string): CollaborationRoom {
    const existing = rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const room: CollaborationRoom = {
      id: roomId,
      name: name || `研究协作室 ${roomId.slice(0, 8)}`,
      datasetId,
      strategy:
        "轻量协作策略：邀请链接共享、共享任务板、研究备注流和轮询同步，避免多人直接覆盖分析结论。",
      objective: datasetId
        ? `围绕数据集 ${datasetId} 协同完成建模解释、论文整理与对外发布前复核。`
        : "围绕当前研究问题协同完成建模、审查和交付。",
      members: [],
      notes: [],
      tasks: [],
      activities: [],
      updatedAt: nowIso(),
    };
    rooms.set(roomId, room);
    return room;
  }

  function touch(room: CollaborationRoom) {
    room.updatedAt = nowIso();
  }

  function addActivity(room: CollaborationRoom, activity: CollaborationActivity) {
    room.activities.unshift(activity);
    if (room.activities.length > 120) {
      room.activities.length = 120;
    }
  }

  function requireMember(room: CollaborationRoom, actor: ActorRef): CollaborationMember {
    const member = room.members.find((item) => item.id === actor.memberId);
    if (!member) {
      throw new Error("未找到协作成员，请重新加入房间。");
    }
    member.lastSeen = nowIso();
    return member;
  }

  return {
    getRoom(roomId: string): CollaborationRoom {
      return cloneRoom(getOrCreateRoom(roomId));
    },

    joinRoom(input: {
      roomId: string;
      name: string;
      role: CollaborationRole;
      datasetId?: string;
      roomName?: string;
    }): { room: CollaborationRoom; member: CollaborationMember } {
      const room = getOrCreateRoom(input.roomId, input.roomName, input.datasetId);
      let member = room.members.find((item) => item.name === input.name);
      if (!member) {
        member = {
          id: createId("member"),
          name: input.name,
          role: input.role,
          lastSeen: nowIso(),
        };
        room.members.unshift(member);
      } else {
        member.role = input.role;
        member.lastSeen = nowIso();
      }

      room.notes.unshift({
        id: createId("note"),
        authorId: member.id,
        authorName: member.name,
        content: `${member.name} 已加入协作房间，角色为 ${roleLabel(member.role)}。`,
        createdAt: nowIso(),
        kind: "update",
      });
      addActivity(room, createActivity(member.name, member.role, "加入房间", `加入房间并选择角色 ${roleLabel(member.role)}。`));
      touch(room);
      return { room: cloneRoom(room), member: { ...member } };
    },

    addNote(input: {
      roomId: string;
      memberId: string;
      authorName?: string;
      content: string;
      kind?: CollaborationNote["kind"];
    }): CollaborationRoom {
      const room = getOrCreateRoom(input.roomId);
      const member = requireMember(room, { memberId: input.memberId, actorName: input.authorName });
      const kind = input.kind || "note";

      if (kind === "decision" && !canCreateDecision(member.role)) {
        throw new Error("只有负责人或复核人可以记录正式决策。");
      }

      room.notes.unshift({
        id: createId("note"),
        authorId: member.id,
        authorName: member.name,
        content: input.content,
        createdAt: nowIso(),
        kind,
      });
      addActivity(
        room,
        createActivity(member.name, member.role, kind === "decision" ? "记录决策" : "添加备注", kind === "decision" ? "记录了一条协作决策。" : "添加了一条研究备注。"),
      );
      touch(room);
      return cloneRoom(room);
    },

    addTask(input: {
      roomId: string;
      memberId: string;
      title: string;
      ownerName?: string;
    }): CollaborationRoom {
      const room = getOrCreateRoom(input.roomId);
      const member = requireMember(room, { memberId: input.memberId });
      if (!canCreateTask(member.role)) {
        throw new Error("只有负责人可以创建协作任务。");
      }

      room.tasks.unshift({
        id: createId("task"),
        title: input.title,
        ownerName: input.ownerName,
        status: "todo",
        statusLabel: "待处理",
        createdAt: nowIso(),
      });
      addActivity(room, createActivity(member.name, member.role, "创建任务", `创建任务：${input.title}`));
      touch(room);
      return cloneRoom(room);
    },

    toggleTask(input: { roomId: string; taskId: string; memberId: string }): CollaborationRoom {
      const room = getOrCreateRoom(input.roomId);
      const member = requireMember(room, { memberId: input.memberId });
      if (!canToggleTask(member.role)) {
        throw new Error("只有负责人或复核人可以修改任务状态。");
      }

      const task = room.tasks.find((item) => item.id === input.taskId);
      if (!task) {
        throw new Error("未找到对应任务。");
      }

      if (task.status === "todo") {
        task.status = "done";
        task.statusLabel = "已完成";
        task.completedAt = nowIso();
      } else {
        task.status = "todo";
        task.statusLabel = "待处理";
        task.completedAt = undefined;
      }

      addActivity(room, createActivity(member.name, member.role, "更新任务", `更新任务状态：${task.title} -> ${task.statusLabel}`));
      touch(room);
      return cloneRoom(room);
    },
  };
}
