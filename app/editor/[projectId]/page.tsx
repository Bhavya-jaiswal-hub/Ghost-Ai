import { EditorLayout } from "@/components/editor/editor-layout"
import { getEditorProjects } from "@/lib/project-data"

interface EditorWorkspacePageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function EditorWorkspacePage({
  params,
}: EditorWorkspacePageProps) {
  const [{ projectId }, { ownedProjects, sharedProjects }] = await Promise.all([
    params,
    getEditorProjects(),
  ])
  const activeProject = [...ownedProjects, ...sharedProjects].find(
    (project) => project.id === projectId
  )

  return (
    <EditorLayout ownedProjects={ownedProjects} sharedProjects={sharedProjects}>
      <section className="absolute inset-0 flex items-center justify-center bg-base px-6">
        <div className="flex max-w-xl flex-col items-center text-center">
          <p className="font-mono text-sm text-brand">{projectId}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-copy-primary">
            {activeProject?.name ?? "Project workspace"}
          </h1>
        </div>
      </section>
    </EditorLayout>
  )
}
