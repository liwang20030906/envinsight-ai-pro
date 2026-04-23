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
    authorId: joined.member.id,
    authorName: "Bob",
    content: "需要补充对最优模型的局限说明。",
    kind: "note",
  });
  assert.equal(withNote.notes[0].authorName, "Bob");

  const withTask = store.addTask({
    roomId: "room-b",
    title: "更新局限性段落",
    ownerName: "Bob",
  });
  const taskId = withTask.tasks[0].id;
  const toggled = store.toggleTask("room-b", taskId);

  assert.equal(toggled.tasks[0].status, "done");
  assert.ok(toggled.tasks[0].completedAt);
});
