"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  Check,
  Copy,
  LinkIcon,
  MailPlus,
  Trash2,
  Users,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  initialCanManage: boolean
}

interface SharePerson {
  key: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  role: "owner" | "collaborator"
}

interface CollaboratorsApiResponse {
  access?: {
    canManage: boolean
  }
  owner?: SharePerson
  collaborators?: SharePerson[]
  people?: SharePerson[]
  error?: string
}

async function readCollaboratorsResponse(response: Response) {
  const body = (await response
    .json()
    .catch(() => ({}))) as CollaboratorsApiResponse

  if (!response.ok) {
    throw new Error(body.error ?? "Share request failed.")
  }

  return {
    access: {
      canManage: body.access?.canManage ?? false,
    },
    people: body.people ?? [
      ...(body.owner ? [body.owner] : []),
      ...(body.collaborators ?? []),
    ],
  }
}

function personLabel(person: SharePerson) {
  return person.displayName ?? person.email ?? "Project owner"
}

function personInitial(person: SharePerson) {
  return personLabel(person).slice(0, 1).toUpperCase()
}

function isRemovablePerson(
  person: SharePerson
): person is SharePerson & { email: string; role: "collaborator" } {
  return person.role === "collaborator" && typeof person.email === "string"
}

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  initialCanManage,
}: ShareDialogProps) {
  const [people, setPeople] = useState<SharePerson[]>([])
  const [canManage, setCanManage] = useState(initialCanManage)
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectPath = `/editor/${projectId}`

  useEffect(() => {
    if (!open) {
      return
    }

    let ignore = false

    async function loadCollaborators() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(
          `/api/projects/${projectId}/collaborators`
        )
        const body = await readCollaboratorsResponse(response)

        if (!ignore) {
          setPeople(body.people)
          setCanManage(body.access.canManage)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(
            error instanceof Error ? error.message : "Share request failed."
          )
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadCollaborators()

    return () => {
      ignore = true
    }
  }, [open, projectId])

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
    }
  }, [])

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManage || isSaving) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })
      const body = await readCollaboratorsResponse(response)

      setPeople(body.people)
      setCanManage(body.access.canManage)
      setEmail("")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Share request failed."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function removeCollaborator(collaboratorEmail: string) {
    if (!canManage || removingEmail) {
      return
    }

    setRemovingEmail(collaboratorEmail)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: collaboratorEmail }),
      })
      const body = await readCollaboratorsResponse(response)

      setPeople(body.people)
      setCanManage(body.access.canManage)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Share request failed."
      )
    } finally {
      setRemovingEmail(null)
    }
  }

  async function copyProjectLink() {
    const projectLink = `${window.location.origin}${projectPath}`

    try {
      await navigator.clipboard.writeText(projectLink)
      setCopied(true)
    } catch {
      setErrorMessage("Could not copy the project link.")
      return
    }

    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current)
    }

    copiedTimeoutRef.current = setTimeout(() => {
      setCopied(false)
    }, 1600)
  }  

  function isSafeAvatarUrl(url: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.protocol === 'https:' || parsed.protocol === 'data:'  } catch {
    return false
  }
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] gap-5 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {canManage && (
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-normal text-copy-faint">
                Project link
              </p>
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-surface-border bg-surface p-2">
                <LinkIcon className="h-4 w-4 shrink-0 text-copy-muted" />
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-copy-secondary">
                  {projectPath}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyProjectLink}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {canManage && (
            <form onSubmit={submitInvite} className="grid gap-2">
              <label className="grid gap-2 text-sm font-medium text-copy-secondary">
                Invite collaborator
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teammate@example.com"
                    disabled={isSaving}
                  />
                  <Button type="submit" disabled={isSaving}>
                    <MailPlus className="h-4 w-4" />
                    Invite
                  </Button>
                </div>
              </label>
            </form>
          )}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-normal text-copy-faint">
                People with access
              </p>
              <span className="text-xs text-copy-muted">
                {people.length} total
              </span>
            </div>
            <ScrollArea className="max-h-64 rounded-2xl border border-surface-border bg-surface">
              {isLoading ? (
                <div className="flex min-h-32 items-center justify-center px-4 py-8 text-sm text-copy-muted">
                  Loading collaborators...
                </div>
              ) : people.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center px-4 py-8 text-center">
                  <Users className="h-8 w-8 text-copy-faint" />
                  <p className="mt-3 text-sm text-copy-muted">
                    No access records found.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {people.map((person) => (
                    <div
                      key={person.key}
                      className="flex min-w-0 items-center gap-3 px-3 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-subtle text-sm font-medium text-copy-secondary">
                        {isSafeAvatarUrl(person.avatarUrl) ? (
                          <span
                            aria-hidden="true"
                            className="block h-full w-full"
                            style={{
                              backgroundImage: `url(${person.avatarUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                          />
                        ) : (
                          personInitial(person)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-copy-primary">
                            {personLabel(person)}
                          </p>
                          <span className="shrink-0 rounded-lg border border-surface-border bg-accent-dim px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-normal text-brand">
                            {person.role}
                          </span>
                        </div>
                        {person.email && (
                          <p className="truncate text-xs text-copy-muted">
                            {person.email}
                          </p>
                        )}
                      </div>
                      {canManage && isRemovablePerson(person) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${person.email}`}
                          disabled={removingEmail === person.email}
                          onClick={() => removeCollaborator(person.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {errorMessage && (
            <p className="text-sm text-state-error">{errorMessage}</p>
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
