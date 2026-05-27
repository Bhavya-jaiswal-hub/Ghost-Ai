import { get } from "@vercel/blob";

import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

interface SpecDownloadRouteContext {
  params: Promise<{
    projectId: string;
    specId: string;
  }>;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function createAttachmentFilename(projectName: string, specId: string) {
  const safeProjectName = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeProjectName || "project"}-${specId}.md`;
}

export async function GET(
  _request: Request,
  context: SpecDownloadRouteContext
) {
  const { projectId, specId } = await context.params;
  const identity = await getCurrentProjectIdentity();

  if (!identity.userId) {
    return jsonError("Unauthorized", 401);
  }

  const project = await getAccessibleProject(projectId, identity);

  if (!project) {
    return jsonError("Forbidden", 403);
  }

  const spec = await prisma.projectSpec.findFirst({
    where: {
      id: specId,
      projectId,
    },
    select: {
      filePath: true,
    },
  });

  if (!spec) {
    return jsonError("Spec not found.", 404);
  }

  let blob;

  try {
    blob = await get(spec.filePath, {
      access: "private",
      useCache: false,
    });
  } catch (error) {
    console.error("Spec blob read failed.", error);
    return jsonError("Failed to load spec.", 500);
  }

  if (!blob || blob.statusCode !== 200) {
    return jsonError("Spec file not found.", 404);
  }

  return new Response(blob.stream, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${createAttachmentFilename(
        project.name,
        specId
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
