"use client"

import { startTransition, useMemo, useOptimistic, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { type EditorProject } from "@/lib/project-data"

export type ProjectDialogMode = "create" | "rename" | "delete" | null

export type OptimisticProjectAction =
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string }
  | { type: "create"; project: EditorProject }

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
  const body = (await response.json().catch((err) => {
    console.error("Failed to parse project response:", err)
    return {}
  })) as ProjectApiResponse

  if (!response.ok) {
    throw new Error(body.error ?? `Project request failed with status ${response.status}.`)
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

  const [optimisticOwnedProjects, setOptimisticOwnedProjects] = useOptimistic(
    ownedProjects,
    (state: EditorProject[], action: OptimisticProjectAction) => {
      switch (action.type) {
        case "rename":
          return state.map((p) =>
            p.id === action.id ? { ...p, name: action.name } : p
          )
        case "delete":
          return state.filter((p) => p.id !== action.id)
        case "create":
          return [action.project, ...state]
        default:
          return state
      }
    }
  )

  const roomIdPreview = useMemo(() => {
    return `${createProjectSlug(projectName)}-${createSuffix}`
  }, [createSuffix, projectName])

  function closeDialog(force = false) {
    if (isLoading && !force) {
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
    if (isLoading) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const name = projectName.trim() || "Untitled Project"
      const roomId = roomIdPreview
      const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: roomId, name }),
         signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const body = await readProjectResponse(response)
      closeDialog(true)  

      router.push(`/editor/${body.project?.id ?? roomId}`)
    } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
     setErrorMessage("Request timed out. Please try again.")
   } else {
       setErrorMessage(
         error instanceof Error ? error.message : "Project request failed."
       )
    }
   }finally {
      setIsLoading(false)
    }
  }

  function submitRenameProject() {
    if (isLoading) return
    if (!selectedProject?.owned) {
      return
    }

    const targetProject = selectedProject
    const name = projectName.trim() || targetProject.name

    startTransition(async () => {
      setOptimisticOwnedProjects({
        type: "rename",
        id: targetProject.id,
        name,
      })
      closeDialog(true)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        const response = await fetch(`/api/projects/${targetProject.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        await readProjectResponse(response)
        router.refresh()
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setErrorMessage("Request timed out. Please try again.")
        } else {
          setErrorMessage(
            error instanceof Error ? error.message : "Project request failed."
          )
        }
      }
    })
  }

  function submitDeleteProject() {
    if (isLoading) return
    if (!selectedProject?.owned) {
      return
    }

    const targetProject = selectedProject
    const activeWorkspacePath = `/editor/${targetProject.id}`

    startTransition(async () => {
      setOptimisticOwnedProjects({
        type: "delete",
        id: targetProject.id,
      })
      closeDialog(true)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        const response = await fetch(`/api/projects/${targetProject.id}`, {
          method: "DELETE",
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        await readProjectResponse(response)

        if (pathname === activeWorkspacePath) {
          router.replace("/editor")
        } else {
          router.refresh()
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setErrorMessage("Request timed out. Please try again.")
        } else {
          setErrorMessage(
            error instanceof Error ? error.message : "Project request failed."
          )
        }
      }
    })
  }

  return {
    ownedProjects: optimisticOwnedProjects,
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
