import { get, put } from "@vercel/blob"

import { parseCanvasSnapshot } from "@/lib/canvas-snapshot"
import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access"
import { prisma } from "@/lib/prisma"

interface CanvasRouteContext {
  params: Promise<{
    projectId: string
  }>
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

async function authorizeCanvasAccess(projectId: string) {
  const identity = await getCurrentProjectIdentity()

  if (!identity.userId) {
    return { error: jsonError("Unauthorized", 401) }
  }

  const project = await getAccessibleProject(projectId, identity)

  if (!project) {
    return { error: jsonError("Forbidden", 403) }
  }

  return { data: project }
}

async function parseCanvasBody(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return { error: jsonError("Request body must be valid JSON.", 400) }
  }

  const parsedSnapshot = parseCanvasSnapshot(body)

  if ("error" in parsedSnapshot) {
    return { error: jsonError(parsedSnapshot.error, 400) }
  }

  return { data: parsedSnapshot.data }
}

async function readBlobJson(url: string) {
  let blob

  try {
    blob = await get(url, {
      access: "private",
      useCache: false,
    })
  } catch (error) {
    console.error("Canvas blob read failed.", error)
    return { error: jsonError("Failed to load saved canvas.", 500) }
  }

  if (!blob || blob.statusCode !== 200) {
    return { error: jsonError("Saved canvas not found.", 404) }
  }

  let body: unknown

  try {
    body = await new Response(blob.stream).json()
  } catch {
    return { error: jsonError("Saved canvas payload is invalid JSON.", 502) }
  }

  const parsedSnapshot = parseCanvasSnapshot(body)

  if ("error" in parsedSnapshot) {
    return { error: jsonError("Saved canvas payload is invalid.", 502) }
  }

  return { data: parsedSnapshot.data }
}

export async function GET(_request: Request, context: CanvasRouteContext) {
  const { projectId } = await context.params
  const authorized = await authorizeCanvasAccess(projectId)

  if ("error" in authorized) {
    return authorized.error
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      canvasJsonPath: true,
    },
  })

  if (!project) {
    return jsonError("Project not found.", 404)
  }

  if (!project.canvasJsonPath) {
    return Response.json({
      canvas: null,
      canvasJsonPath: null,
    })
  }

  const savedCanvas = await readBlobJson(project.canvasJsonPath)

  if ("error" in savedCanvas) {
    return savedCanvas.error
  }

  return Response.json({
    canvas: savedCanvas.data,
    canvasJsonPath: project.canvasJsonPath,
  })
}

export async function PUT(request: Request, context: CanvasRouteContext) {
  const { projectId } = await context.params
  const authorized = await authorizeCanvasAccess(projectId)

  if ("error" in authorized) {
    return authorized.error
  }

  const parsedBody = await parseCanvasBody(request)

  if ("error" in parsedBody) {
    return parsedBody.error
  }

  try {
    const blob = await put(
      `canvas/${projectId}.json`,
      JSON.stringify(parsedBody.data),
      {
        access: "private",
        allowOverwrite: true,
        contentType: "application/json",
      }
    )

    await prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        canvasJsonPath: blob.url,
      },
    })

    return Response.json({
      saved: true,
      canvasJsonPath: blob.url,
    })
  } catch (error) {
    console.error("Canvas blob save failed.", error)
    return jsonError("Failed to save canvas.", 500)
  }
}
