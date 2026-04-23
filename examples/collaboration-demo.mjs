const BASE_URL = process.env.APP_URL || "http://127.0.0.1:3000";
const roomId = `demo-room-${Date.now()}`;

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

async function main() {
  console.log(`Running collaboration demo against ${BASE_URL}`);

  const alice = await request(`/api/collaboration/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify({
      roomId,
      name: "Alice",
      role: "lead",
      roomName: "Demo Collaboration Room",
    }),
  });

  const bob = await request(`/api/collaboration/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify({
      roomId,
      name: "Bob",
      role: "analyst",
    }),
  });

  await request(`/api/collaboration/${roomId}/notes`, {
    method: "POST",
    body: JSON.stringify({
      roomId,
      authorId: alice.member.id,
      authorName: "Alice",
      kind: "decision",
      content: "先完成合规复核，再把最优模型写进论文结果段。",
    }),
  });

  const withTask = await request(`/api/collaboration/${roomId}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      roomId,
      title: "补充局限性说明与免责声明",
      ownerName: "Bob",
    }),
  });

  const newTask = withTask.room.tasks[0];
  await request(`/api/collaboration/${roomId}/tasks/${newTask.id}/toggle`, {
    method: "POST",
  });

  const snapshot = await request(`/api/collaboration/${roomId}`);

  console.log("\n=== Collaboration Snapshot ===");
  console.log(`Room: ${snapshot.room.name} (${snapshot.room.id})`);
  console.log(`Strategy: ${snapshot.room.strategy}`);
  console.log(`Members: ${snapshot.room.members.map((member) => `${member.name}/${member.role}`).join(", ")}`);
  console.log(`Top note: ${snapshot.room.notes[0]?.content || "N/A"}`);
  console.log(
    `Tasks: ${snapshot.room.tasks.map((task) => `${task.title} [${task.status}]`).join(" | ")}`,
  );
  console.log("\nDemo finished successfully.");
  console.log(`Alice joined as ${alice.member.role}; Bob joined as ${bob.member.role}.`);
}

main().catch((error) => {
  console.error("Collaboration demo failed:", error.message);
  process.exitCode = 1;
});
