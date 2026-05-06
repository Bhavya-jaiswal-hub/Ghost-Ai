"use client"

import { useMemo, useState } from "react"

export interface MockProject {
  id: string
  name: string
  slug: string
  owned: boolean
  updatedAt: string
}

export type ProjectDialogMode = "create" | "rename" | "delete" | null

export function createProjectSlug(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "untitled-project"
}

export function useProjectDialogs(initialProjects: MockProject[]) {
  const [projects, setProjects] = useState<MockProject[]>(initialProjects)
  const [dialogMode, setDialogMode] = useState<ProjectDialogMode>(null)
  const [projectName, setProjectName] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )

  const slugPreview = useMemo(
    () => createProjectSlug(projectName),
    [projectName]
  )

  function closeDialog() {
    if (isLoading) {
      return
    }

    setDialogMode(null)
    setSelectedProjectId(null)
    setProjectName("")
  }

  function openCreateDialog() {
    setSelectedProjectId(null)
    setProjectName("")
    setDialogMode("create")
  }

  function openRenameDialog(project: MockProject) {
    if (!project.owned) {
      return
    }

    setSelectedProjectId(project.id)
    setProjectName(project.name)
    setDialogMode("rename")
  }

  function openDeleteDialog(project: MockProject) {
    if (!project.owned) {
      return
    }

    setSelectedProjectId(project.id)
    setProjectName(project.name)
    setDialogMode("delete")
  }

  function submitCreateProject() {
    setIsLoading(true)

    const name = projectName.trim() || "Untitled Project"
    const slug = createProjectSlug(name)

    setProjects((currentProjects) => [
      {
        id: `project-${Date.now()}`,
        name,
        slug,
        owned: true,
        updatedAt: "Just now",
      },
      ...currentProjects,
    ])

    setIsLoading(false)
    closeDialog()
  }

  function submitRenameProject() {
    if (!selectedProject?.owned) {
      return
    }

    setIsLoading(true)

    const name = projectName.trim() || selectedProject.name
    const slug = createProjectSlug(name)

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProject.id
          ? { ...project, name, slug, updatedAt: "Just now" }
          : project
      )
    )

    setIsLoading(false)
    closeDialog()
  }

  function submitDeleteProject() {
    if (!selectedProject?.owned) {
      return
    }

    setIsLoading(true)
    setProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== selectedProject.id)
    )
    setIsLoading(false)
    closeDialog()
  }

  return {
    projects,
    dialogMode,
    projectName,
    selectedProject,
    slugPreview,
    isLoading,
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
