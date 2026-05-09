import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"

export interface EditorProject {
  id: string
  name: string
  owned: boolean
  updatedAt: string
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function serializeEditorProject(project: {
  id: string
  ownerId: string
  name: string
  updatedAt: Date
}, userId: string): EditorProject {
  return {
    id: project.id,
    name: project.name,
    owned: project.ownerId === userId,
    updatedAt: `Updated ${formatUpdatedAt(project.updatedAt)}`,
  }
}

export async function getEditorProjects() {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    return {
      ownedProjects: [],
      sharedProjects: [],
    }
  }

  const user = await currentUser()
  const emailAddresses =
    user?.emailAddresses.map((email) => email.emailAddress.toLowerCase()) ?? []
  const collaboratorFilter =
    emailAddresses.length > 0
      ? [
          {
            collaborators: {
              some: {
                email: {
                  in: emailAddresses,
                },
              },
            },
          },
        ]
      : []

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        ...collaboratorFilter,
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  const serializedProjects = projects.map((project) =>
    serializeEditorProject(project, userId)
  )

  return {
    ownedProjects: serializedProjects.filter((project) => project.owned),
    sharedProjects: serializedProjects.filter((project) => !project.owned),
  }
}
