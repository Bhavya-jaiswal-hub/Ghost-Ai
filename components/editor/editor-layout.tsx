"use client"

import { useState, type ReactNode } from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ProjectDialogProvider } from "@/components/editor/project-dialog-provider"
import { type EditorProject } from "@/lib/project-data"

interface EditorLayoutProps {
  children: ReactNode
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
}

export function EditorLayout({
  children,
  ownedProjects,
  sharedProjects,
}: EditorLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-base text-copy-primary">
      <ProjectDialogProvider
        ownedProjects={ownedProjects}
        sharedProjects={sharedProjects}
      >
        <EditorNavbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
        />
        <div className="relative min-h-0 flex-1">
          <ProjectSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          {children}
        </div>
      </ProjectDialogProvider>
    </main>
  )
}
