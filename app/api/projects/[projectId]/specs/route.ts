import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access"
import { prisma } from "@/lib/prisma"

interface ProjectSpecsRouteContext {
  params: Promise<{
    projectId: string
  }>
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

function isPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  )
}

function createAttachmentFilename(projectName: string, specId: string) {
  const safeProjectName = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return `${safeProjectName || "project"}-${specId}.md`
}

export async function GET(
  _request: Request,
  context: ProjectSpecsRouteContext
) {
  const { projectId } = await context.params
  const identity = await getCurrentProjectIdentity()

  if (!identity.userId) {
    return jsonError("Unauthorized", 401)
  }

  const project = await getAccessibleProject(projectId, identity)

  if (!project) {
    return jsonError("Forbidden", 403)
  }

  let specs

  try {
    specs = await prisma.projectSpec.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        createdAt: true,
      },
    })
  } catch (error) {
    if (isPrismaError(error, "P2021")) {
      return jsonError("Project spec storage is not ready.", 503)
    }

    throw error
  }

  return Response.json({
    specs: specs.map((spec) => ({
      id: spec.id,
      createdAt: spec.createdAt.toISOString(),
      filename: createAttachmentFilename(project.name, spec.id),
      downloadPath: `/api/projects/${projectId}/specs/${spec.id}/download`,
    })),
  })
}
