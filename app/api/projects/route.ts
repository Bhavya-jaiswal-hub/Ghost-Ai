import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

const DEFAULT_PROJECT_NAME = "Untitled Project";

interface CreateProjectBody {
  id?: string;
  name?: string;
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

async function parseCreateProjectBody(request: Request) {
  const rawBody = await request.text();

  if (rawBody.trim().length === 0) {
    return { data: { name: DEFAULT_PROJECT_NAME } satisfies CreateProjectBody };
  }

  try {
    const body: unknown = JSON.parse(rawBody);

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return { error: jsonError("Request body must be an object.", 400) };
    }

    const { id, name } = body as { id?: unknown; name?: unknown };

    if (id !== undefined && typeof id !== "string") {
      return { error: jsonError("Project id must be a string.", 400) };
    }

    if (
      typeof id === "string" &&
      !/^[a-z0-9][a-z0-9-]{2,80}$/.test(id.trim())
    ) {
      return { error: jsonError("Project id must be a valid room id.", 400) };
    }

    if (name !== undefined && typeof name !== "string") {
      return { error: jsonError("Project name must be a string.", 400) };
    }

    const normalizedName = name?.trim() || DEFAULT_PROJECT_NAME;
    const normalizedId = id?.trim();

    return {
      data: { id: normalizedId, name: normalizedName } satisfies CreateProjectBody,
    };
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) };
  }
}

export async function GET() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json({
    projects: projects.map(serializeProject),
  });
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401);
  }

  const parsedBody = await parseCreateProjectBody(request);

  if ("error" in parsedBody) {
    return parsedBody.error;
  }

  try {
    const project = await prisma.project.create({
      data: {
        id: parsedBody.data.id,
        ownerId: userId,
        name: parsedBody.data.name ?? DEFAULT_PROJECT_NAME,
      },
    });

    return Response.json(
      {
        project: serializeProject(project),
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError("Project id already exists.", 409);
    }

    throw error;
  }
}
