import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";

import { prisma } from "@/lib/prisma";

interface DesignTokenRequestBody {
  runId: string;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function parseDesignTokenRequestBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: jsonError("Request body must be an object.", 400) };
  }

  const { runId } = body as { runId?: unknown };

  if (typeof runId !== "string" || runId.trim().length === 0) {
    return { error: jsonError("Run id is required.", 400) };
  }

  return {
    data: {
      runId: runId.trim(),
    } satisfies DesignTokenRequestBody,
  };
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await clerkAuth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const parsedBody = await parseDesignTokenRequestBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  const taskRun = await prisma.taskRun.findFirst({
    where: {
      runId: parsedBody.data.runId,
      userId,
    },
    select: {
      runId: true,
    },
  });

  if (!taskRun) {
    return jsonError("Not Found", 404);
  }

  const token = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: taskRun.runId,
      },
    },
    expirationTime: "1h",
  });

  return Response.json({
    token,
  });
}
