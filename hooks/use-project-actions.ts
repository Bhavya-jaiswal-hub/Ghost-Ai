"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { type EditorProject } from "@/lib/project-data"

export type ProjectDialogMode = "create" | "rename" | "delete" | null

interface UseProjectActionsOptions {
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
}

interface ProjectApiResponse {
  project?: {
    id: string
  }
  error?: string
}

export function createProjectSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "untitled-project"
}

function createShortSuffix() {
  const bytes = new Uint8Array(3)
  const browserCrypto = globalThis.crypto

  if (browserCrypto) {
    browserCrypto.getRandomValues(bytes)

    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 6)
  }

  return Math.random().toString(36).slice(2, 8)
}

async function readProjectResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ProjectApiResponse

  if (!response.ok) {
    throw new Error(body.error ?? "Project request failed.")
  }

  return body
}

export function useProjectActions({
  ownedProjects,
  sharedProjects,
}: UseProjectActionsOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const [dialogMode, setDialogMode] = useState<ProjectDialogMode>(null)
  const [projectName, setProjectName] = useState("")
  const [selectedProject, setSelectedProject] = useState<EditorProject | null>(
    null
  )
  const [createSuffix, setCreateSuffix] = useState(createShortSuffix)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const roomIdPreview = useMemo(() => {
    return `${createProjectSlug(projectName)}-${createSuffix}`
  }, [createSuffix, projectName])

  function closeDialog() {
    if (isLoading) {
      return
    }

    setDialogMode(null)
    setSelectedProject(null)
    setProjectName("")
    setErrorMessage(null)
  }

  function openCreateDialog() {
    setSelectedProject(null)
    setProjectName("")
    setCreateSuffix(createShortSuffix())
    setErrorMessage(null)
    setDialogMode("create")
  }

  function openRenameDialog(project: EditorProject) {
    if (!project.owned) {
      return
    }

    setSelectedProject(project)
    setProjectName(project.name)
    setErrorMessage(null)
    setDialogMode("rename")
  }

  function openDeleteDialog(project: EditorProject) {
    if (!project.owned) {
      return
    }

    setSelectedProject(project)
    setProjectName(project.name)
    setErrorMessage(null)
    setDialogMode("delete")
  }

  async function submitCreateProject() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const name = projectName.trim() || "Untitled Project"
      const roomId = roomIdPreview
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: roomId, name }),
      })
      const body = await readProjectResponse(response)

      router.push(`/editor/${body.project?.id ?? roomId}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Project request failed."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function submitRenameProject() {
    if (!selectedProject?.owned) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const name = projectName.trim() || selectedProject.name
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })

      await readProjectResponse(response)
      closeDialog()
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Project request failed."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function submitDeleteProject() {
    if (!selectedProject?.owned) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "DELETE",
      })

      await readProjectResponse(response)
      const activeWorkspacePath = `/editor/${selectedProject.id}`
      closeDialog()

      if (pathname === activeWorkspacePath) {
        router.replace("/editor")
      } else {
        router.refresh()
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Project request failed."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return {
    ownedProjects,
    sharedProjects,
    dialogMode,
    projectName,
    selectedProject,
    roomIdPreview,
    isLoading,
    errorMessage,
    setProjectName,
    closeDialog,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    submitCreateProject,
    submitRenameProject,
    submitDeleteProject,
  }
}
