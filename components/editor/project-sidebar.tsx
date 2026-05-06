"use client"

import { Pencil, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useProjectDialogController } from "@/components/editor/project-dialog-provider"
import { type MockProject } from "@/components/editor/use-project-dialogs"
import { cn } from "@/lib/utils"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function EmptyProjectState({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 flex-1 items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-elevated/60 px-6 text-center">
      <p className="text-sm text-copy-muted">{label}</p>
    </div>
  )
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const {
    projects,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
  } = useProjectDialogController()

  const ownedProjects = projects.filter((project) => project.owned)
  const sharedProjects = projects.filter((project) => !project.owned)

  return (
    <>
      <button
        type="button"
        aria-label="Close projects sidebar"
        className={cn(
          "fixed inset-0 z-30 bg-base/70 backdrop-blur-xs transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        aria-hidden={!isOpen}
        className={cn(
          "fixed left-4 top-18 bottom-4 z-40 flex w-[min(20rem,calc(100vw-2rem))] flex-col rounded-2xl border border-surface-border bg-sidebar/95 p-4 shadow-2xl shadow-base/40 backdrop-blur transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-copy-primary">Projects</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close projects sidebar"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="my-projects" className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-projects">My Projects</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
          <TabsContent value="my-projects" className="mt-3 flex min-h-0">
            {ownedProjects.length > 0 ? (
              <ProjectList
                projects={ownedProjects}
                onRename={openRenameDialog}
                onDelete={openDeleteDialog}
              />
            ) : (
              <EmptyProjectState label="No projects yet." />
            )}
          </TabsContent>
          <TabsContent value="shared" className="mt-3 flex min-h-0">
            {sharedProjects.length > 0 ? (
              <ProjectList projects={sharedProjects} />
            ) : (
              <EmptyProjectState label="No shared projects yet." />
            )}
          </TabsContent>
        </Tabs>

        <Button
          type="button"
          className="mt-4 w-full"
          size="lg"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </aside>
    </>
  )
}

interface ProjectListProps {
  projects: MockProject[]
  onRename?: (project: MockProject) => void
  onDelete?: (project: MockProject) => void
}

function ProjectList({ projects, onRename, onDelete }: ProjectListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group flex items-center gap-2 rounded-xl border border-surface-border bg-elevated/70 p-3"
        >
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-copy-primary">
              {project.name}
            </h3>
            <p className="mt-1 truncate font-mono text-xs text-copy-muted">
              {project.slug}
            </p>
            <p className="mt-2 text-xs text-copy-faint">{project.updatedAt}</p>
          </div>
          {project.owned && onRename && onDelete && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${project.name}`}
                onClick={() => onRename(project)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${project.name}`}
                onClick={() => onDelete(project)}
              >
                <Trash2 className="h-4 w-4 text-state-error" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
