"use client"

import { useState, type PointerEvent } from "react"
import { X } from "lucide-react"

import { CanvasWorkspace } from "@/components/editor/canvas-workspace"
import { EditorLayout } from "@/components/editor/editor-layout"
import { ShareDialog } from "@/components/editor/share-dialog"
import {
  StarterTemplatesModal,
} from "@/components/editor/starter-templates-modal"
import { Button } from "@/components/ui/button"
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
          <aside
            data-overlay-panel
            aria-hidden={!isAiSidebarOpen}
            inert={!isAiSidebarOpen}
            className={
              isAiSidebarOpen
                ? "fixed right-4 top-18 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl border border-surface-border bg-sidebar/95 p-5 shadow-2xl shadow-base/40 backdrop-blur transition-transform duration-200 ease-out"
                : "fixed right-4 top-18 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] translate-x-[calc(100%+2rem)] flex-col rounded-2xl border border-surface-border bg-sidebar/95 p-5 shadow-2xl shadow-base/40 backdrop-blur transition-transform duration-200 ease-out"
            }
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-copy-primary">
                AI assistant
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close AI sidebar"
                onClick={() => setIsAiSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-elevated/50 px-5 text-center">
              <p className="text-sm leading-6 text-copy-muted">
                AI chat will appear here later.
              </p>
            </div>
          </aside>
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
