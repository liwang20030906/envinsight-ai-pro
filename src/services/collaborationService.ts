import type { CollaborationRole, CollaborationRoom } from "../types";

async function parseJSONResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export async function fetchCollaborationRoom(roomId: string): Promise<{ room: CollaborationRoom }> {
  const response = await fetch(`/api/collaboration/${encodeURIComponent(roomId)}`);
  return parseJSONResponse(response);
}

export async function joinCollaborationRoom(input: {
  roomId: string;
  name: string;
  role: CollaborationRole;
  datasetId?: string;
  roomName?: string;
}): Promise<{ room: CollaborationRoom; member: { id: string; name: string; role: CollaborationRole } }> {
  const response = await fetch(`/api/collaboration/${encodeURIComponent(input.roomId)}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJSONResponse(response);
}

export async function addCollaborationNote(input: {
  roomId: string;
  memberId: string;
  authorName?: string;
  content: string;
  kind?: "note" | "decision" | "update";
}): Promise<{ room: CollaborationRoom }> {
  const response = await fetch(`/api/collaboration/${encodeURIComponent(input.roomId)}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJSONResponse(response);
}

export async function addCollaborationTask(input: {
  roomId: string;
  memberId: string;
  title: string;
  ownerName?: string;
}): Promise<{ room: CollaborationRoom }> {
  const response = await fetch(`/api/collaboration/${encodeURIComponent(input.roomId)}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJSONResponse(response);
}

export async function toggleCollaborationTask(
  roomId: string,
  taskId: string,
  memberId: string,
): Promise<{ room: CollaborationRoom }> {
  const response = await fetch(
    `/api/collaboration/${encodeURIComponent(roomId)}/tasks/${encodeURIComponent(taskId)}/toggle`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ memberId }),
    },
  );
  return parseJSONResponse(response);
}
