import { auth as clerkAuth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";

import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { generateSpec } from "@/trigger/generate-spec";
import { NODE_SHAPES } from "@/types/canvas";
import { aiChatFeedMessageSchema } from "@/types/tasks";

const specNodeSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    data: z
      .object({
        label: z.string(),
        shape: z.enum(NODE_SHAPES).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const specEdgeSchema = z
  .object({
    id: z.string().trim().min(1),
    source: z.string().trim().min(1),
    target: z.string().trim().min(1),
    data: z
      .object({
        label: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const specRequestSchema = z.object({
  roomId: z.string().trim().min(1, "Room id is required."),
  chatHistory: z.array(aiChatFeedMessageSchema).max(100),
  nodes: z.array(specNodeSchema).max(250),
  edges: z.array(specEdgeSchema).max(500),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function parseSpecRequestBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }

  const parsedBody = specRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return {
      error: jsonError(
        parsedBody.error.issues[0]?.message ?? "Invalid spec request body.",
        400
      ),
    };
  }

  return {
    data: parsedBody.data,
  };
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await clerkAuth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const parsedBody = await parseSpecRequestBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  const identity = await getCurrentProjectIdentity();
  const project = await getAccessibleProject(parsedBody.data.roomId, identity);

  if (!project) {
    return jsonError("Forbidden", 403);
  }

  const handle = await tasks.trigger<typeof generateSpec>("generate-spec", {
    projectId: project.id,
    roomId: parsedBody.data.roomId,
    chatHistory: parsedBody.data.chatHistory,
    nodes: parsedBody.data.nodes,
    edges: parsedBody.data.edges,
  });

  await prisma.taskRun.create({
    data: {
      runId: handle.id,
      projectId: project.id,
      userId,
    },
  });

  return Response.json(
    {
      runId: handle.id,
    },
    { status: 202 }
  );
}
