import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk";

import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { designAgent } from "@/trigger/design-agent";

interface DesignRequestBody {
  prompt: string;
  roomId: string;
  projectId: string;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function parseDesignRequestBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: jsonError("Request body must be an object.", 400) };
  }

  const { prompt, roomId, projectId } = body as {
    prompt?: unknown;
    roomId?: unknown;
    projectId?: unknown;
  };

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { error: jsonError("Prompt is required.", 400) };
  }

  if (typeof roomId !== "string" || roomId.trim().length === 0) {
    return { error: jsonError("Room id is required.", 400) };
  }

  const normalizedRoomId = roomId.trim();
  const normalizedProjectId =
    typeof projectId === "string" && projectId.trim().length > 0
      ? projectId.trim()
      : normalizedRoomId;

  if (normalizedRoomId !== normalizedProjectId) {
    return { error: jsonError("Room id must match project id.", 400) };
  }

  return {
    data: {
      prompt: prompt.trim(),
      roomId: normalizedRoomId,
      projectId: normalizedProjectId,
    } satisfies DesignRequestBody,
  };
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await clerkAuth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const parsedBody = await parseDesignRequestBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  const identity = await getCurrentProjectIdentity();
  const project = await getAccessibleProject(parsedBody.data.projectId, identity);

  if (!project) {
    return jsonError("Forbidden", 403);
  }

  const handle = await tasks.trigger<typeof designAgent>("design-agent", {
    prompt: parsedBody.data.prompt,
    roomId: parsedBody.data.roomId,
  });

  await prisma.taskRun.create({
    data: {
      runId: handle.id,
      projectId: project.id,
      userId,
    },
  });

  const publicToken = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: handle.id,
      },
    },
    expirationTime: "1h",
  });

  return Response.json(
    {
      runId: handle.id,
      publicToken,
    },
    { status: 202 }
  );
}
