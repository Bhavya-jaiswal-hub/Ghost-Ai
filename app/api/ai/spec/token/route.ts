import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const specTokenRequestSchema = z.object({
  runId: z.string().trim().min(1, "Run id is required."),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function parseSpecTokenRequestBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }

  const parsedBody = specTokenRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return {
      error: jsonError(
        parsedBody.error.issues[0]?.message ?? "Invalid token request body.",
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

  const parsedBody = await parseSpecTokenRequestBody(request);

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
