import type {
  CollaborationMember,
  CollaborationNote,
  CollaborationRole,
  CollaborationRoom,
  CollaborationTask,
} from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRoom(room: CollaborationRoom): CollaborationRoom {
  return JSON.parse(JSON.stringify(room)) as CollaborationRoom;
}

function createSeedRoom(roomId: string): CollaborationRoom {
  const createdAt = nowIso();
  const members: CollaborationMember[] = [
    {
      id: "member_seed_lead",
      name: "PI Chen",
      role: "lead",
      lastSeen: createdAt,
    },
    {
      id: "member_seed_analyst",
      name: "Analyst Li",
      role: "analyst",
      lastSeen: createdAt,
    },
  ];
  const tasks: CollaborationTask[] = [
    {
      id: "task_seed_1",
      title: "复核字段脱敏与来源许可",
      status: "done",
      ownerName: "PI Chen",
      createdAt,
      completedAt: createdAt,
    },
    {
      id: "task_seed_2",
      title: "确认最优模型是否适合写入论文结果段",
      status: "todo",
      ownerName: "Analyst Li",
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

  return {
    id: roomId,
    name: "EnvInsight Demo Room",
    strategy: "轻量协作策略：房间码 + 轮询同步 + 共享任务板 + 决策记录，适合科研小组快速协同。",
    objective: "围绕当前环境健康数据完成合规审查、模型选择、结果复核与论文初稿协同。",
    members,
    notes,
    tasks,
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
      name: name || `Research Room ${roomId.slice(0, 8)}`,
      datasetId,
      strategy: "轻量协作策略：房间码共享、共享任务板、研究备注流与轮询同步，避免多人直接覆盖分析结论。",
      objective: datasetId
        ? `围绕数据集 ${datasetId} 协同完成建模解释、论文整理与对外发布前复核。`
        : "围绕当前研究问题协同完成建模、审查和交付。",
      members: [],
      notes: [],
      tasks: [],
      updatedAt: nowIso(),
    };
    rooms.set(roomId, room);
    return room;
  }

  function touch(room: CollaborationRoom) {
    room.updatedAt = nowIso();
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
        content: `${member.name} 已加入协作房间，角色为 ${member.role}。`,
        createdAt: nowIso(),
        kind: "update",
      });
      touch(room);
      return { room: cloneRoom(room), member: { ...member } };
    },

    addNote(input: {
      roomId: string;
      authorId: string;
      authorName: string;
      content: string;
      kind?: CollaborationNote["kind"];
    }): CollaborationRoom {
      const room = getOrCreateRoom(input.roomId);
      room.notes.unshift({
        id: createId("note"),
        authorId: input.authorId,
        authorName: input.authorName,
        content: input.content,
        createdAt: nowIso(),
        kind: input.kind || "note",
      });
      touch(room);
      return cloneRoom(room);
    },

    addTask(input: {
      roomId: string;
      title: string;
      ownerName?: string;
    }): CollaborationRoom {
      const room = getOrCreateRoom(input.roomId);
      room.tasks.unshift({
        id: createId("task"),
        title: input.title,
        ownerName: input.ownerName,
        status: "todo",
        createdAt: nowIso(),
      });
      touch(room);
      return cloneRoom(room);
    },

    toggleTask(roomId: string, taskId: string): CollaborationRoom {
      const room = getOrCreateRoom(roomId);
      const task = room.tasks.find((item) => item.id === taskId);
      if (!task) {
        throw new Error("Task not found.");
      }

      if (task.status === "todo") {
        task.status = "done";
        task.completedAt = nowIso();
      } else {
        task.status = "todo";
        task.completedAt = undefined;
      }
      touch(room);
      return cloneRoom(room);
    },
  };
}
