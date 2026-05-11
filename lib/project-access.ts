import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"

export interface CurrentProjectIdentity {
  userId: string | null
  primaryEmail: string | null
}

export interface AccessibleProject {
  id: string
  name: string
  ownerId: string
}

export async function getCurrentProjectIdentity(): Promise<CurrentProjectIdentity> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    return {
      userId: null,
      primaryEmail: null,
    }
  }

  const user = await currentUser()

  return {
    userId,
    primaryEmail: user?.primaryEmailAddress?.emailAddress.toLowerCase() ?? null,
  }
}

export async function getAccessibleProject(
  projectId: string,
  identity: CurrentProjectIdentity
): Promise<AccessibleProject | null> {
  if (!identity.userId) {
    return null
  }

  const collaboratorFilter = identity.primaryEmail
    ? [
        {
          collaborators: {
            some: {
              email: {
                equals: identity.primaryEmail,
                mode: 'insensitive' as const,
              },
            },
          },
        },
      ]
    : []

  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ ownerId: identity.userId }, ...collaboratorFilter],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
    },
  })
}
