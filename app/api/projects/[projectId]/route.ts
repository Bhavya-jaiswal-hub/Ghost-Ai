import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

interface RenameProjectBody {
  name: string;
}

interface ProjectRouteContext {
  params: Promise<{
    projectId: string;
  }>;
}

interface ProjectResponse {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: string;
  canvasJsonPath: string | null;
  createdAt: string;
  updatedAt: string;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isPrismaRecordNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

function serializeProject(project: {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: string;
  canvasJsonPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectResponse {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    status: project.status,
    canvasJsonPath: project.canvasJsonPath,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

async function parseRenameProjectBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: jsonError("Request body must be an object.", 400) };
  }

  const { name } = body as { name?: unknown };

  if (typeof name !== "string" || name.trim().length === 0) {
    return { error: jsonError("Project name is required.", 400) };
  }

  return { data: { name: name.trim() } satisfies RenameProjectBody };
}

async function authorizeOwner(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  });

  if (!project) {
    return { error: jsonError("Project not found.", 404) };
  }

  if (project.ownerId !== userId) {
    return { error: jsonError("Forbidden", 403) };
  }

  return { data: project };
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const parsedBody = await parseRenameProjectBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  const authorizedProject = await authorizeOwner(projectId, userId);

  if ("error" in authorizedProject) {
    return authorizedProject.error;
  }

  let project;

  try {
    project = await prisma.project.update({
      where: {
        id: projectId,
        ownerId: userId,
      },
      data: {
        name: parsedBody.data.name,
      },
    });
  } catch (error) {
    if (isPrismaRecordNotFoundError(error)) {
      return jsonError("Not Found", 404);
    }

    throw error;
  }

  return Response.json({
    project: serializeProject(project),
  });
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  
 const { userId } = await auth();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { projectId } = await context.params;
  const authorizedProject = await authorizeOwner(projectId, userId);

  if ("error" in authorizedProject) {
    return authorizedProject.error;
  }

  try {
    await prisma.project.delete({
      where: {
        id: projectId,
        ownerId: userId,
      },
    });
  } catch (error) {
    if (isPrismaRecordNotFoundError(error)) {
      return jsonError("Not Found", 404);
    }

    throw error;
  }

  return Response.json({
    projectId,
    deleted: true,
  });
}
