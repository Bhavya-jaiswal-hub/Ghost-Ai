import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"
import { revalidateTag, unstable_cache } from "next/cache"

import { type Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export interface EditorProject {
  id: string
  name: string
  owned: boolean
  updatedAt: string
}

export interface EditorProjectsResult {
  ownedProjects: EditorProject[]
  sharedProjects: EditorProject[]
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function serializeEditorProject(
  project: {
    id: string
    ownerId: string
    name: string
    updatedAt: Date
  },
  userId: string
): EditorProject {
  return {
    id: project.id,
    name: project.name,
    owned: project.ownerId === userId,
    updatedAt: `Updated ${formatUpdatedAt(project.updatedAt)}`,
  }
}

export async function fetchUserProjects(
  userId: string,
  emailAddresses: string[]
): Promise<EditorProjectsResult> {
  const collaboratorFilter: Prisma.ProjectWhereInput[] =
    emailAddresses.length > 0
      ? [
          {
            collaborators: {
              some: {
                OR: emailAddresses.map((email) => ({
                  email: {
                    equals: email,
                    mode: "insensitive",
                  },
                })),
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

export function invalidateUserProjectsCache(userId: string): void {
  revalidateTag(`projects-${userId}`, "max")
}

export async function getEditorProjects(): Promise<EditorProjectsResult> {
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

  const getCachedProjects = unstable_cache(
    () => fetchUserProjects(userId, emailAddresses),
    ["editor-projects", userId],
    {
      revalidate: 60,
      tags: [`projects-${userId}`],
    }
  )

  return getCachedProjects()
}
