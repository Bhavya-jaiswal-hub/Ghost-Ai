"use client"

import { useState, type ReactNode } from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ProjectDialogProvider } from "@/components/editor/project-dialog-provider"
import { type EditorProject } from "@/lib/project-data"

interface EditorLayoutProps {
  children:
    | ReactNode
    | ((state: { isProjectSidebarOpen: boolean }) => ReactNode)
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
  activeProjectId?: string
  projectName?: string
  showWorkspaceActions?: boolean
  isAiSidebarOpen?: boolean
  onOpenShareDialog?: () => void
  onToggleAiSidebar?: () => void
}

export function EditorLayout({
  children,
  ownedProjects,
  sharedProjects,
  activeProjectId,
  projectName,
  showWorkspaceActions,
  isAiSidebarOpen,
  onOpenShareDialog,
  onToggleAiSidebar,
}: EditorLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const content =
    typeof children === "function"
      ? children({ isProjectSidebarOpen: isSidebarOpen })
      : children

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-base text-copy-primary">
      <ProjectDialogProvider
        ownedProjects={ownedProjects}
        sharedProjects={sharedProjects}
      >
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
          projectName={projectName}
          showWorkspaceActions={showWorkspaceActions}
          isAiSidebarOpen={isAiSidebarOpen}
          onOpenShareDialog={onOpenShareDialog}
          onToggleAiSidebar={onToggleAiSidebar}
        />
        <div className="relative min-h-0 flex-1">
          <ProjectSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            activeProjectId={activeProjectId}
          />
          {content}
        </div>
      </ProjectDialogProvider>
    </main>
  )
}
