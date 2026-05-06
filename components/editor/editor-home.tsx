"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useProjectDialogController } from "@/components/editor/project-dialog-provider"

export function EditorHome() {
  const { openCreateDialog } = useProjectDialogController()

  return (
    <section className="absolute inset-0 flex items-center justify-center bg-base px-6">
      <div className="flex max-w-xl flex-col items-center text-center">
        <h1 className="text-3xl font-semibold leading-tight text-copy-primary">
          Create a project or open an existing one
        </h1>
        <p className="mt-4 text-base leading-7 text-copy-muted">
          Start a new architecture workspace, or choose a project from the
          sidebar.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-7"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </section>
  )
}
