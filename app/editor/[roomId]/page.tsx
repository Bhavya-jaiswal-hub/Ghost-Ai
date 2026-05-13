import { redirect } from "next/navigation"

import { AccessDenied } from "@/components/editor/access-denied"
import { EditorWorkspaceShell } from "@/components/editor/editor-workspace-shell"
import {
  getAccessibleProject,
  getCurrentProjectIdentity,
} from "@/lib/project-access"
import { getEditorProjects } from "@/lib/project-data"

interface EditorWorkspacePageProps {
  params: Promise<{
    roomId: string
  }>
}

export default async function EditorWorkspacePage({
  params,
}: EditorWorkspacePageProps) {
  const { roomId } = await params
  const identity = await getCurrentProjectIdentity()

  if (!identity.userId) {
    redirect("/sign-in")
  }

  const project = await getAccessibleProject(roomId, identity)

  if (!project) {
    return <AccessDenied />
  }

  const { ownedProjects, sharedProjects } = await getEditorProjects()

  return (
    <EditorWorkspaceShell
      roomId={roomId}
      projectName={project.name}
      canManageShare={project.ownerId === identity.userId}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  )
}
