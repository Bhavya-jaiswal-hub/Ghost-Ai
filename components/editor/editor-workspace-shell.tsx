"use client"

import { useState, type PointerEvent } from "react"

import { AiSidebar } from "@/components/editor/ai-sidebar"
import { CanvasWorkspace } from "@/components/editor/canvas-workspace"
import { EditorLayout } from "@/components/editor/editor-layout"
import { ShareDialog } from "@/components/editor/share-dialog"
import {
  StarterTemplatesModal,
} from "@/components/editor/starter-templates-modal"
import { type EditorProject } from "@/lib/project-data"
import { type CanvasTemplate } from "@/components/editor/starter-templates"

interface EditorWorkspaceShellProps {
  roomId: string
  projectName: string
  canManageShare: boolean
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
}

interface TemplateImportRequest {
  template: CanvasTemplate
  requestId: number
}

export function EditorWorkspaceShell({
  roomId,
  projectName,
  canManageShare,
  ownedProjects,
  sharedProjects,
}: EditorWorkspaceShellProps) {
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false)
  const [templateImportRequest, setTemplateImportRequest] =
    useState<TemplateImportRequest | null>(null)

  function handleWorkspacePointerDown(
    event: PointerEvent<HTMLElement>,
    closeProjectSidebar: () => void
  ) {
    const target = event.target

    if (!(target instanceof Element)) {
      return
    }

    if (!target.closest("[data-overlay-panel]")) {
      closeProjectSidebar()
      setIsAiSidebarOpen(false)
    }
  }

  function handleTemplateImport(template: CanvasTemplate) {
    setTemplateImportRequest((currentRequest) => ({
      template,
      requestId: (currentRequest?.requestId ?? 0) + 1,
    }))
  }

  return (
    <EditorLayout
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
      activeProjectId={roomId}
      projectName={projectName}
      showWorkspaceActions
      isAiSidebarOpen={isAiSidebarOpen}
      onOpenTemplatesDialog={() => setIsTemplatesModalOpen(true)}
      onOpenShareDialog={() => setIsShareDialogOpen(true)}
      onToggleAiSidebar={() => setIsAiSidebarOpen((current) => !current)}
    >
      {({ closeProjectSidebar }) => (
        <section
          className="absolute inset-0 min-w-0 bg-base"
          onPointerDownCapture={(event) =>
            handleWorkspacePointerDown(event, closeProjectSidebar)
          }
        >
          <div className="absolute inset-0 min-w-0 bg-base">
            <div className="h-full min-w-0">
              <CanvasWorkspace
                roomId={roomId}
                templateImportRequest={templateImportRequest}
              />
            </div>
          </div>
          <AiSidebar
            isOpen={isAiSidebarOpen}
            onClose={() => setIsAiSidebarOpen(false)}
          />
          <ShareDialog
            open={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
            projectId={roomId}
            projectName={projectName}
            initialCanManage={canManageShare}
          />
          <StarterTemplatesModal
            open={isTemplatesModalOpen}
            onOpenChange={setIsTemplatesModalOpen}
            onImport={handleTemplateImport}
          />
        </section>
      )}
    </EditorLayout>
  )
}
