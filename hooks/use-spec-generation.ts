"use client"

import { useFeedMessages } from "@liveblocks/react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useToast } from "@/components/ui/toast"
import type { generateSpec as generateSpecTask } from "@/trigger/generate-spec"
import { type CanvasSnapshot } from "@/types/canvas"
import {
  AI_CHAT_FEED_ID,
  isAiChatFeedMessage,
  type AiChatFeedMessage,
} from "@/types/tasks"

export interface ProjectSpecListItem {
  id: string
  createdAt: string
  filename: string
  downloadPath: string
}

export interface UseSpecGenerationOptions {
  projectId: string
  getCanvasSnapshot: () => CanvasSnapshot
}

export interface UseSpecGenerationReturn {
  specs: ProjectSpecListItem[]
  selectedSpec: ProjectSpecListItem | null
  previewContent: string
  isLoading: boolean
  isPreviewLoading: boolean
  isStartingRun: boolean
  isRealtimeRunActive: boolean
  error: string | null
  previewError: string | null
  generationError: string | null
  runStatusError: string | null
  generateSpec: () => Promise<void>
  selectSpec: (spec: ProjectSpecListItem | null) => void
  closePreview: () => void
  refreshSpecs: () => Promise<void>
}

interface ProjectSpecsResponse {
  specs?: unknown
  error?: unknown
}

interface SpecRunResponse {
  runId?: unknown
  token?: unknown
  error?: unknown
}

interface ActiveSpecRun {
  runId: string
  publicToken: string
}

const ACTIVE_TRIGGER_STATUSES = new Set([
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
])

export function useSpecGeneration({
  projectId,
  getCanvasSnapshot,
}: UseSpecGenerationOptions): UseSpecGenerationReturn {
  const [specs, setSpecs] = useState<ProjectSpecListItem[]>([])
  const [selectedSpec, setSelectedSpec] = useState<ProjectSpecListItem | null>(
    null
  )
  const [previewContent, setPreviewContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isStartingRun, setIsStartingRun] = useState(false)
  const [activeRun, setActiveRun] = useState<ActiveSpecRun | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const { messages: chatFeedMessages } = useFeedMessages(AI_CHAT_FEED_ID)
  const chatHistory = useMemo(
    () => getValidatedChatHistory(chatFeedMessages ?? []),
    [chatFeedMessages]
  )

  const loadSpecs = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true)
      }

      setError(null)

      try {
        setSpecs(await fetchProjectSpecs(projectId))
      } catch (loadError) {
        setError(getErrorMessage(loadError))
        setSpecs([])
      } finally {
        setIsLoading(false)
      }
    },
    [projectId]
  )

  const handleRunComplete = useCallback(
    (run: { id: string }) => {
      setActiveRun((currentRun) =>
        currentRun?.runId === run.id ? null : currentRun
      )
      setRetryCount(0)
      void loadSpecs(false)
    },
    [loadSpecs]
  )

  const { run: realtimeRun, error: realtimeRunError } =
    useRealtimeRun<typeof generateSpecTask>(activeRun?.runId, {
      id: activeRun ? `${activeRun.runId}-attempt-${retryCount}` : undefined,
      accessToken: activeRun?.publicToken,
      enabled: Boolean(activeRun?.runId && activeRun.publicToken),
      onComplete: handleRunComplete,
    })

  useEffect(() => {
    if (!activeRun || !realtimeRunError) {
      return
    }

    const RETRY_DELAYS_MS = [1000, 2000, 4000]

    if (retryCount < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[retryCount]
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1)
      }, delay)

      return () => clearTimeout(timer)
    }

    // All 3 attempts failed
    const failureTimer = setTimeout(() => {
      setActiveRun(null)
      setRetryCount(0)
      toast({
        title: "Task Polling Failed",
        description: "Could not follow AI run. Please check your network.",
        variant: "destructive",
      })
    }, 0)

    return () => clearTimeout(failureTimer)
  }, [activeRun, realtimeRunError, retryCount, toast])

  const isRealtimeRunActive = activeRun
    ? !realtimeRun ||
      realtimeRun.id !== activeRun.runId ||
      ACTIVE_TRIGGER_STATUSES.has(realtimeRun.status)
    : false

  const runStatusError =
    !activeRun
      ? null
      : realtimeRun &&
        realtimeRun.id === activeRun.runId &&
        !ACTIVE_TRIGGER_STATUSES.has(realtimeRun.status) &&
        realtimeRun.status !== "COMPLETED"
      ? "Spec generation did not complete."
      : null

  useEffect(() => {
    let isCurrentRequest = true

    void fetchProjectSpecs(projectId)
      .then((loadedSpecs) => {
        if (isCurrentRequest) {
          setSpecs(loadedSpecs)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (isCurrentRequest) {
          setError(getErrorMessage(loadError))
          setSpecs([])
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrentRequest = false
    }
  }, [projectId])

  useEffect(() => {
    if (!selectedSpec) {
      return
    }

    let isCurrentRequest = true
    const spec = selectedSpec

    async function loadPreview() {
      try {
        const response = await fetch(spec.downloadPath)

        if (!response.ok) {
          throw new Error("Could not load the spec preview.")
        }

        const content = await response.text()

        if (isCurrentRequest) {
          setPreviewContent(content)
        }
      } catch (loadError) {
        if (isCurrentRequest) {
          setPreviewError(getErrorMessage(loadError))
        }
      } finally {
        if (isCurrentRequest) {
          setIsPreviewLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      isCurrentRequest = false
    }
  }, [selectedSpec])

  const closePreview = useCallback(() => {
    setSelectedSpec(null)
    setPreviewContent("")
    setPreviewError(null)
    setIsPreviewLoading(false)
  }, [])

  const selectSpec = useCallback(
    (spec: ProjectSpecListItem | null) => {
      if (!spec) {
        closePreview()
        return
      }

      setPreviewContent("")
      setPreviewError(null)
      setIsPreviewLoading(true)
      setSelectedSpec(spec)
    },
    [closePreview]
  )

  const generateSpec = useCallback(async () => {
    if (isStartingRun || isRealtimeRunActive) {
      return
    }

    setIsStartingRun(true)
    setGenerationError(null)

    try {
      const snapshot = getCanvasSnapshot()
      const specRun = await triggerSpecRun(projectId, snapshot, chatHistory)
      setRetryCount(0)
      setActiveRun(specRun)
    } catch (generateError) {
      setGenerationError(getErrorMessage(generateError))
    } finally {
      setIsStartingRun(false)
    }
  }, [
    chatHistory,
    getCanvasSnapshot,
    isRealtimeRunActive,
    isStartingRun,
    projectId,
  ])

  const refreshSpecs = useCallback(async () => {
    await loadSpecs(true)
  }, [loadSpecs])

  return {
    specs,
    selectedSpec,
    previewContent,
    isLoading,
    isPreviewLoading,
    isStartingRun,
    isRealtimeRunActive,
    error,
    previewError,
    generationError,
    runStatusError,
    generateSpec,
    selectSpec,
    closePreview,
    refreshSpecs,
  }
}

async function fetchProjectSpecs(
  projectId: string
): Promise<ProjectSpecListItem[]> {
  const response = await fetch(`/api/projects/${projectId}/specs`, {
    cache: "no-store",
  })
  const body = (await response.json().catch(() => ({}))) as ProjectSpecsResponse

  if (!response.ok) {
    throw new Error(getResponseError(body, "Could not load specs."))
  }

  if (!Array.isArray(body.specs)) {
    throw new Error("The specs response was invalid.")
  }

  return body.specs.filter(isProjectSpecListItem)
}

async function triggerSpecRun(
  projectId: string,
  snapshot: CanvasSnapshot,
  chatHistory: AiChatFeedMessage[]
): Promise<ActiveSpecRun> {
  const response = await fetch("/api/ai/spec", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roomId: projectId,
      chatHistory,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as SpecRunResponse

  if (!response.ok) {
    throw new Error(getResponseError(body, "Could not start spec generation."))
  }

  if (typeof body.runId !== "string" || body.runId.length === 0) {
    throw new Error("Spec generation did not return a run id.")
  }

  const publicToken =
    typeof body.token === "string" && body.token.length > 0
      ? body.token
      : await fetchSpecRunToken(body.runId)

  return {
    runId: body.runId,
    publicToken,
  }
}

async function fetchSpecRunToken(runId: string): Promise<string> {
  const response = await fetch("/api/ai/spec/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runId }),
  })
  const body = (await response.json().catch(() => ({}))) as SpecRunResponse

  if (!response.ok) {
    throw new Error(getResponseError(body, "Could not connect to the spec run."))
  }

  if (typeof body.token !== "string" || body.token.length === 0) {
    throw new Error("The spec run did not return a public token.")
  }

  return body.token
}

function getValidatedChatHistory(
  messages: Array<{ createdAt: number; data: unknown }>
): AiChatFeedMessage[] {
  return messages
    .filter(
      (message): message is { createdAt: number; data: AiChatFeedMessage } =>
        isAiChatFeedMessage(message.data)
    )
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((message) => message.data)
}

function isProjectSpecListItem(value: unknown): value is ProjectSpecListItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const spec = value as Partial<ProjectSpecListItem>

  return (
    typeof spec.id === "string" &&
    typeof spec.createdAt === "string" &&
    typeof spec.filename === "string" &&
    typeof spec.downloadPath === "string"
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong."
}

function getResponseError(body: ProjectSpecsResponse, fallback: string): string {
  return typeof body.error === "string" && body.error.length > 0
    ? body.error
    : fallback
}

