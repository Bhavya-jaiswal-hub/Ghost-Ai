"use client"

import {
  createContext,
  useContext,
  type FormEvent,
  type ReactNode,
} from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  type MockProject,
  useProjectDialogs,
} from "@/components/editor/use-project-dialogs"

const MOCK_PROJECTS: MockProject[] = [
  {
    id: "owned-payments",
    name: "Payments Platform",
    slug: "payments-platform",
    owned: true,
    updatedAt: "Updated 2h ago",
  },
  {
    id: "owned-observability",
    name: "Observability Mesh",
    slug: "observability-mesh",
    owned: true,
    updatedAt: "Updated yesterday",
  },
  {
    id: "shared-inventory",
    name: "Inventory Sync",
    slug: "inventory-sync",
    owned: false,
    updatedAt: "Shared 3d ago",
  },
]

type ProjectDialogController = ReturnType<typeof useProjectDialogs>

const ProjectDialogContext = createContext<ProjectDialogController | null>(null)

export function useProjectDialogController() {
  const controller = useContext(ProjectDialogContext)

  if (!controller) {
    throw new Error(
      "useProjectDialogController must be used inside ProjectDialogProvider"
    )
  }

  return controller
}

interface ProjectDialogProviderProps {
  children: ReactNode
}

export function ProjectDialogProvider({
  children,
}: ProjectDialogProviderProps) {
  const controller = useProjectDialogs(MOCK_PROJECTS)

  return (
    <ProjectDialogContext.Provider value={controller}>
      {children}
      <ProjectDialogs />
    </ProjectDialogContext.Provider>
  )
}

function ProjectDialogs() {
  const {
    dialogMode,
    projectName,
    selectedProject,
    slugPreview,
    isLoading,
    setProjectName,
    closeDialog,
    submitCreateProject,
    submitRenameProject,
    submitDeleteProject,
  } = useProjectDialogController()

  const isOpen = dialogMode !== null

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeDialog()
    }
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitCreateProject()
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitRenameProject()
  }

  function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitDeleteProject()
  }

  return (
    <>
      <Dialog open={isOpen && dialogMode === "create"} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form onSubmit={handleCreateSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>
                Name a new architecture workspace.
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-2 text-sm font-medium text-copy-secondary">
              Project name
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="API Gateway Redesign"
                autoFocus
              />
            </label>
            <div className="rounded-xl border border-surface-border bg-surface px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-normal text-copy-faint">
                Slug preview
              </p>
              <p className="mt-1 font-mono text-sm text-brand">{slugPreview}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen && dialogMode === "rename"} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form onSubmit={handleRenameSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
              <DialogDescription>
                Current project: {selectedProject?.name ?? "Unknown project"}
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-2 text-sm font-medium text-copy-secondary">
              Project name
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                autoFocus
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                Rename Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen && dialogMode === "delete"} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form onSubmit={handleDeleteSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Delete {selectedProject?.name ?? "this project"} from your mock
                project list.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                Delete Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
