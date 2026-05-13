import { auth, currentUser } from "@clerk/nextjs/server"

import { getLiveblocksClient, getUserCursorColor } from "@/lib/liveblocks"
import {
  getAccessibleProject,
  type CurrentProjectIdentity,
} from "@/lib/project-access"

interface LiveblocksAuthBody {
  room: string
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

async function parseLiveblocksAuthBody(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) }
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { error: jsonError("Request body must be an object.", 400) }
  }

  const { room, projectId } = body as {
    room?: unknown
    projectId?: unknown
  }
  const roomId = room ?? projectId

  if (typeof roomId !== "string" || roomId.trim().length === 0) {
    return { error: jsonError("Liveblocks room id is required.", 400) }
  }

  return {
    data: {
      room: roomId.trim(),
    } satisfies LiveblocksAuthBody,
  }
}

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    return jsonError("Unauthorized", 401)
  }

  const parsedBody = await parseLiveblocksAuthBody(request)

  if ("error" in parsedBody) {
    return parsedBody.error
  }

  const user = await currentUser()
  const identity = {
    userId,
    primaryEmail:
      user?.primaryEmailAddress?.emailAddress.toLowerCase() ?? null,
  } satisfies CurrentProjectIdentity
  const project = await getAccessibleProject(parsedBody.data.room, identity)

  if (!project) {
    return jsonError("Forbidden", 403)
  }

  const liveblocks = getLiveblocksClient()

  await liveblocks.getOrCreateRoom(project.id, {
    defaultAccesses: [],
    metadata: {
      title: project.name.slice(0, 256),
    },
  })

  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "Workspace member"
  const cursorColor = getUserCursorColor(userId)
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: displayName,
      avatar: user?.imageUrl ?? "",
      color: cursorColor,
    },
  })

  session.allow(project.id, session.FULL_ACCESS)

  const { body, status } = await session.authorize()

  return new Response(body, { status })
}
