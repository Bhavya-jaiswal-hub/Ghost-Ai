import { EditorLayout } from "@/components/editor/editor-layout"
import { EditorHome } from "@/components/editor/editor-home"
import { getEditorProjects } from "@/lib/project-data"

export default async function EditorPage() {
  const { ownedProjects, sharedProjects } = await getEditorProjects()

  return (
    <EditorLayout ownedProjects={ownedProjects} sharedProjects={sharedProjects}>
      <EditorHome />
    </EditorLayout>
  )
}
