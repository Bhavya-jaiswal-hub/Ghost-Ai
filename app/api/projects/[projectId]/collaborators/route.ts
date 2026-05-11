import { getCurrentProjectIdentity } from "@/lib/project-access"
import {
  addProjectCollaborator,
  isValidCollaboratorEmail,
  normalizeCollaboratorEmail,
  removeProjectCollaborator,
  getProjectShareAccess,
  getProjectSharePeople,
} from "@/lib/project-collaborators"

interface ProjectCollaboratorsRouteContext {
  params: Promise<{
    projectId: string
  }>
}

interface CollaboratorEmailBody {
  email: string
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

async function parseCollaboratorEmailBody(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) }
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: jsonError("Request body must be an object.", 400) }
  }

  const { email } = body as { email?: unknown }

  if (typeof email !== "string" || email.trim().length === 0) {
    return { error: jsonError("Collaborator email is required.", 400) }
  }

  const normalizedEmail = normalizeCollaboratorEmail(email)

  if (!isValidCollaboratorEmail(normalizedEmail)) {
    return { error: jsonError("Collaborator email must be valid.", 400) }
  }

  return { data: { email: normalizedEmail } satisfies CollaboratorEmailBody }
}

async function authorizeShareAccess(projectId: string, requireOwner: boolean) {
  const identity = await getCurrentProjectIdentity()

  if (!identity.userId) {
    return { error: jsonError("Unauthorized", 401) }
  }

  const access = await getProjectShareAccess(projectId, identity)

  if (!access.projectExists) {
    return { error: jsonError("Project not found.", 404) }
  }

  if (!access.canAccess) {
    return { error: jsonError("Forbidden", 403) }
  }

  if (requireOwner && !access.canManage) {
    return { error: jsonError("Forbidden", 403) }
  }

  return { data: access }
}

async function collaboratorsResponse(projectId: string, canManage: boolean) {
  const sharePeople = await getProjectSharePeople(projectId)

  if (!sharePeople) {
    return jsonError("Project not found.", 404)
  }

  return Response.json({
    access: {
      canManage,
    },
    owner: sharePeople.owner,
    collaborators: sharePeople.collaborators,
    people: sharePeople.people,
  })
}

export async function GET(
  _request: Request,
  context: ProjectCollaboratorsRouteContext
) {
  const { projectId } = await context.params
  const authorized = await authorizeShareAccess(projectId, false)

  if ("error" in authorized) {
    return authorized.error
  }

  return collaboratorsResponse(projectId, authorized.data.canManage)
}

export async function POST(
  request: Request,
  context: ProjectCollaboratorsRouteContext
) {
  const { projectId } = await context.params
  const authorized = await authorizeShareAccess(projectId, true)

  if ("error" in authorized) {
    return authorized.error
  }

  const parsedBody = await parseCollaboratorEmailBody(request)

  if ("error" in parsedBody) {
    return parsedBody.error
  }

  try {
    await addProjectCollaborator(projectId, parsedBody.data.email)
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return jsonError("Collaborator already has access.", 409)
    }

    throw error
  }

  return collaboratorsResponse(projectId, true)
}

export async function DELETE(
  request: Request,
  context: ProjectCollaboratorsRouteContext
) {
  const { projectId } = await context.params
  const authorized = await authorizeShareAccess(projectId, true)

  if ("error" in authorized) {
    return authorized.error
  }

  const parsedBody = await parseCollaboratorEmailBody(request)

  if ("error" in parsedBody) {
    return parsedBody.error
  }

  try {
    await removeProjectCollaborator(projectId, parsedBody.data.email)
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      return jsonError("Collaborator not found.", 404)
    }

    throw error
  }

  return collaboratorsResponse(projectId, true)
}
