"use client"

import { useState } from "react"

import { EditorLayout } from "@/components/editor/editor-layout"
import { ShareDialog } from "@/components/editor/share-dialog"
import { type EditorProject } from "@/lib/project-data"
import { cn } from "@/lib/utils"

interface EditorWorkspaceShellProps {
  roomId: string
  projectName: string
  canManageShare: boolean
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
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

  return (
    <EditorLayout
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
      activeProjectId={roomId}
      projectName={projectName}
      showWorkspaceActions
      isAiSidebarOpen={isAiSidebarOpen}
      onOpenShareDialog={() => setIsShareDialogOpen(true)}
      onToggleAiSidebar={() => setIsAiSidebarOpen((current) => !current)}
    >
      {({ isProjectSidebarOpen }) => (
        <section className="absolute inset-0 flex min-w-0 bg-base">
          <div
            className={cn(
              "flex min-w-0 flex-1 bg-base transition-[padding] duration-200 ease-out",
              isProjectSidebarOpen && "md:pl-88"
            )}
          >
            <div className="flex min-w-0 flex-1 items-center justify-center px-6">
              <div className="text-center">
                <p className="font-mono text-sm text-brand">{roomId}</p>
                <h1 className="mt-3 text-2xl font-semibold leading-tight text-copy-primary">
                  Canvas workspace
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-copy-muted">
                  Collaborative canvas will render here in the next feature.
                </p>
              </div>
            </div>
          </div>
          <aside
            className={
              isAiSidebarOpen
                ? "flex w-[min(24rem,40vw)] shrink-0 flex-col border-l border-surface-border bg-sidebar/95 p-5 backdrop-blur"
                : "hidden"
            }
          >
            <h2 className="text-sm font-medium text-copy-primary">
              AI assistant
            </h2>
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
        </section>
      )}
    </EditorLayout>
  )
}
