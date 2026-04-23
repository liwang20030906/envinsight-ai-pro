import test from "node:test";
import assert from "node:assert/strict";
import { createCollaborationStore } from "../src/shared/collaboration";

test("collaboration store creates room and joins members", () => {
  const store = createCollaborationStore();
  const joined = store.joinRoom({
    roomId: "room-a",
    name: "Alice",
    role: "lead",
    roomName: "Team Room",
  });

  assert.equal(joined.room.name, "Team Room");
  assert.equal(joined.room.members[0].name, "Alice");
  assert.equal(joined.member.role, "lead");
  assert.ok(joined.room.activities.length > 0);
});

test("collaboration store appends notes and toggles tasks", () => {
  const store = createCollaborationStore();
  const joined = store.joinRoom({
    roomId: "room-b",
    name: "Bob",
    role: "analyst",
  });

  const withNote = store.addNote({
    roomId: "room-b",
    memberId: joined.member.id,
    content: "需要补充对最优模型的局限说明。",
    kind: "note",
  });
  assert.equal(withNote.notes[0].authorName, "Bob");

  const lead = store.joinRoom({
    roomId: "room-b",
    name: "Alice",
    role: "lead",
  });

  const withTask = store.addTask({
    roomId: "room-b",
    memberId: lead.member.id,
    title: "更新局限性段落",
    ownerName: "Bob",
  });
  const taskId = withTask.tasks[0].id;
  const toggled = store.toggleTask({ roomId: "room-b", taskId, memberId: lead.member.id });

  assert.equal(toggled.tasks[0].status, "done");
  assert.ok(toggled.tasks[0].completedAt);
  assert.equal(toggled.tasks[0].statusLabel, "已完成");
});

test("collaboration store enforces role permissions", () => {
  const store = createCollaborationStore();
  const analyst = store.joinRoom({
    roomId: "room-c",
    name: "Charlie",
    role: "analyst",
  });

  assert.throws(
    () =>
      store.addTask({
        roomId: "room-c",
        memberId: analyst.member.id,
        title: "不应该创建成功",
      }),
    /Only lead can create collaboration tasks/,
  );

  assert.throws(
    () =>
      store.addNote({
        roomId: "room-c",
        memberId: analyst.member.id,
        content: "直接写成正式决策",
        kind: "decision",
      }),
    /Only lead or reviewer can record a decision/,
  );
});
