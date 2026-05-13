import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { type CurrentProjectIdentity } from "@/lib/project-access"

export interface ProjectShareAccess {
  projectExists: boolean
  canAccess: boolean
  canManage: boolean
}

export interface ProjectCollaboratorView {
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface ProjectSharePersonView {
  key: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  role: "owner" | "collaborator"
}

export interface ProjectSharePeopleView {
  owner: ProjectSharePersonView
  collaborators: ProjectSharePersonView[]
  people: ProjectSharePersonView[]
}

interface CollaboratorRecord {
  email: string
  createdAt: Date
}

interface ClerkUserSummary {
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

interface ClerkUserLike {
  fullName: string | null
  username: string | null
  imageUrl: string
  primaryEmailAddress: {
    emailAddress: string
  } | null
  emailAddresses: Array<{
    emailAddress: string
  }>
}

export function normalizeCollaboratorEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidCollaboratorEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function getProjectShareAccess(
  projectId: string,
  identity: CurrentProjectIdentity
): Promise<ProjectShareAccess> {
  if (!identity.userId) {
    return {
      projectExists: false,
      canAccess: false,
      canManage: false,
    }
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  })

  if (!project) {
    return {
      projectExists: false,
      canAccess: false,
      canManage: false,
    }
  }

  const canManage = project.ownerId === identity.userId

  if (canManage) {
    return {
      projectExists: true,
      canAccess: true,
      canManage: true,
    }
  }

  const normalizedPrimaryEmail = identity.primaryEmail
    ? normalizeCollaboratorEmail(identity.primaryEmail)
     
      :null

  const collaboratorCount = normalizedPrimaryEmail
    ? await prisma.projectCollaborator.count({
        where: {
          projectId,
           email: normalizedPrimaryEmail,
        },
      })
    : 0

  return {
    projectExists: true,
    canAccess: collaboratorCount > 0,
    canManage: false,
  }
}

export async function listProjectCollaborators(projectId: string) {
  const collaborators = await prisma.projectCollaborator.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      email: true,
      createdAt: true,
    },
  })

  return enrichCollaborators(collaborators)
}

export async function getProjectSharePeople(
  projectId: string
): Promise<ProjectSharePeopleView | null> {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
      collaborators: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          email: true,
          createdAt: true,
        },
      },
    },
  })

  if (!project) {
    return null
  }

  const client = await clerkClient()
  const ownerSummary = await getClerkUserById(project.ownerId, client)
  const collaboratorEmails = project.collaborators.map(
    (collaborator) => collaborator.email
  )
  const clerkUsersByEmail = await getClerkUsersByEmail(
    collaboratorEmails,
    client
  )

  const owner = {
    key: `owner:${project.ownerId}`,
    email: ownerSummary.email,
    displayName: ownerSummary.displayName ?? "Project owner",
    avatarUrl: ownerSummary.avatarUrl,
    role: "owner",
  } satisfies ProjectSharePersonView

  const collaborators = project.collaborators
    .filter(
      (collaborator) =>
        owner.email === null || collaborator.email !== owner.email
    )
    .map((collaborator) => {
      const clerkUser = clerkUsersByEmail.get(collaborator.email) ?? null

      return {
        key: `collaborator:${collaborator.email}`,
        email: collaborator.email,
        displayName: clerkUser?.displayName ?? null,
        avatarUrl: clerkUser?.avatarUrl ?? null,
        role: "collaborator",
      } satisfies ProjectSharePersonView
    })

  return {
    owner,
    collaborators,
    people: [owner, ...collaborators],
  }
}

export async function addProjectCollaborator(projectId: string, email: string) {
  const normalizedEmail = normalizeCollaboratorEmail(email)

  await prisma.projectCollaborator.create({
    data: {
      projectId,
      email: normalizedEmail,
    },
  })
}

export async function removeProjectCollaborator(
  projectId: string,
  email: string
) {
  const normalizedEmail = normalizeCollaboratorEmail(email)

  await prisma.projectCollaborator.delete({
    where: {
      projectId_email: {
        projectId,
        email: normalizedEmail,
      },
    },
  })
}

async function enrichCollaborators(
  collaborators: CollaboratorRecord[]
): Promise<ProjectCollaboratorView[]> {
  const emails = collaborators.map((collaborator) => collaborator.email)
  const client = await clerkClient()
  const clerkUsersByEmail = await getClerkUsersByEmail(emails, client)

  return collaborators.map((collaborator) => {
    const clerkUser = clerkUsersByEmail.get(collaborator.email) ?? null

    return {
      email: collaborator.email,
      displayName: clerkUser?.displayName ?? null,
      avatarUrl: clerkUser?.avatarUrl ?? null,
      createdAt: collaborator.createdAt.toISOString(),
    }
  })
}

async function getClerkUserById(
  userId: string,
  client: Awaited<ReturnType<typeof clerkClient>>
) {
  try {
    const user = await client.users.getUser(userId)

    return createClerkUserSummary(user)
  } catch {
    return {
      email: null,
      displayName: null,
      avatarUrl: null,
    } satisfies ClerkUserSummary
  }
}

async function getClerkUsersByEmail(
  emails: string[],
  client: Awaited<ReturnType<typeof clerkClient>>
) {
  const usersByEmail = new Map<string, ClerkUserSummary>()

  if (emails.length === 0) {
    return usersByEmail
  }

  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100)
    const response = await client.users.getUserList({
      emailAddress: batch,
      limit: 100,
    })

    for (const user of response.data) {
      const summary = createClerkUserSummary(user)

      for (const emailAddress of user.emailAddresses) {
        const normalizedEmail = normalizeCollaboratorEmail(
          emailAddress.emailAddress
        )

        if (
          batch.includes(normalizedEmail) &&
          !usersByEmail.has(normalizedEmail)
        ) {
          usersByEmail.set(normalizedEmail, summary)
        }
      }
    }
  }

  return usersByEmail
}

function createClerkUserSummary(user: ClerkUserLike) {
  return {
    email: user.primaryEmailAddress?.emailAddress
      ? normalizeCollaboratorEmail(user.primaryEmailAddress.emailAddress)
      : null,
    displayName: user.fullName ?? user.username ?? null,
    avatarUrl: user.imageUrl ?? null,
  } satisfies ClerkUserSummary
}
