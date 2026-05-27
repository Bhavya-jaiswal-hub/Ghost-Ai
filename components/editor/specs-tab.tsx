"use client"

import { Download, FileText, LoaderCircle, RefreshCw } from "lucide-react"
import { useFeedMessages } from "@liveblocks/react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { generateSpec } from "@/trigger/generate-spec"
import { type CanvasSnapshot } from "@/types/canvas"
import {
  AI_CHAT_FEED_ID,
  isAiChatFeedMessage,
  type AiChatFeedMessage,
} from "@/types/tasks"

interface SpecsTabProps {
  projectId: string
  getCanvasSnapshot: () => CanvasSnapshot
}

interface ProjectSpecListItem {
  id: string
  createdAt: string
  filename: string
  downloadPath: string
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

type MarkdownBlock =
  | {
      type: "heading"
      level: number
      text: string
    }
  | {
      type: "paragraph"
      text: string
    }
  | {
      type: "list"
      items: string[]
    }
  | {
      type: "code"
      text: string
    }

const ACTIVE_TRIGGER_STATUSES = new Set([
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
])

export function SpecsTab({ projectId, getCanvasSnapshot }: SpecsTabProps) {
  const [specs, setSpecs] = useState<ProjectSpecListItem[]>([])
  const [selectedSpec, setSelectedSpec] = useState<ProjectSpecListItem | null>(
    null
  )
  const [previewContent, setPreviewContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isStartingRun, setIsStartingRun] = useState(false)
  const [activeRun, setActiveRun] = useState<ActiveSpecRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { messages: chatFeedMessages } = useFeedMessages(AI_CHAT_FEED_ID)
  const chatHistory = useMemo(
    () => getValidatedChatHistory(chatFeedMessages ?? []),
    [chatFeedMessages]
  )

  const loadSpecs = useCallback(async (showLoading = true) => {
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
  }, [projectId])

  const handleRunComplete = useCallback((run: { id: string }) => {
    setActiveRun((currentRun) =>
      currentRun?.runId === run.id ? null : currentRun
    )
    void loadSpecs(false)
  }, [loadSpecs])
  const { run: realtimeRun, error: realtimeRunError } =
    useRealtimeRun<typeof generateSpec>(activeRun?.runId, {
      accessToken: activeRun?.publicToken,
      enabled: Boolean(activeRun?.runId && activeRun.publicToken),
      onComplete: handleRunComplete,
    })
  const isRealtimeRunActive =
    activeRun && !realtimeRunError
      ? !realtimeRun ||
        realtimeRun.id !== activeRun.runId ||
        ACTIVE_TRIGGER_STATUSES.has(realtimeRun.status)
      : false
  const runStatusError =
    activeRun && realtimeRunError
      ? "Could not follow the spec generation run."
      : activeRun &&
          realtimeRun &&
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
        const response = await fetch(spec.downloadPath, {
          cache: "no-store",
        })

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

  function handleSelectSpec(spec: ProjectSpecListItem) {
    setPreviewContent("")
    setPreviewError(null)
    setIsPreviewLoading(true)
    setSelectedSpec(spec)
  }

  async function handleGenerateSpec() {
    if (isStartingRun || isRealtimeRunActive) {
      return
    }

    setIsStartingRun(true)
    setGenerationError(null)

    try {
      const snapshot = getCanvasSnapshot()
      const specRun = await triggerSpecRun(projectId, snapshot, chatHistory)
      setActiveRun(specRun)
    } catch (generateError) {
      setGenerationError(getErrorMessage(generateError))
    } finally {
      setIsStartingRun(false)
    }
  }

  const isGenerateButtonDisabled = isStartingRun || isRealtimeRunActive
  const visibleGenerationError = generationError ?? runStatusError

  return (
    <>
      <div className="flex min-h-full flex-col gap-4">
        <Button
          type="button"
          className="w-full bg-ai text-copy-primary hover:bg-ai/90"
          disabled={isGenerateButtonDisabled}
          onClick={() => {
            void handleGenerateSpec()
          }}
        >
          {isGenerateButtonDisabled ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {isGenerateButtonDisabled ? "Generating" : "Generate Spec"}
        </Button>

        {visibleGenerationError ? (
          <SpecsMessage tone="error">{visibleGenerationError}</SpecsMessage>
        ) : isGenerateButtonDisabled ? (
          <SpecsMessage>Ghost AI is drafting the spec.</SpecsMessage>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-surface-border bg-elevated">
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-3 py-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-copy-primary">
                Generated Specs
              </h3>
              <p className="mt-0.5 text-xs text-copy-muted">
                {specs.length} {specs.length === 1 ? "file" : "files"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh specs"
              onClick={() => {
                void loadSpecs()
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 p-2">
              {error ? (
                <SpecsMessage tone="error">{error}</SpecsMessage>
              ) : isLoading ? (
                <SpecsMessage>Loading specs.</SpecsMessage>
              ) : specs.length > 0 ? (
                specs.map((spec) => (
                  <SpecListItem
                    key={spec.id}
                    spec={spec}
                    onSelect={() => handleSelectSpec(spec)}
                  />
                ))
              ) : (
                <SpecsMessage>
                  Generated specs will appear here after a spec run completes.
                </SpecsMessage>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <SpecPreviewDialog
        spec={selectedSpec}
        content={previewContent}
        error={previewError}
        isLoading={isPreviewLoading}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSpec(null)
            setPreviewContent("")
            setPreviewError(null)
            setIsPreviewLoading(false)
          }
        }}
      />
    </>
  )
}

async function fetchProjectSpecs(projectId: string) {
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

async function fetchSpecRunToken(runId: string) {
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
) {
  return messages
    .filter(
      (message): message is { createdAt: number; data: AiChatFeedMessage } =>
        isAiChatFeedMessage(message.data)
    )
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((message) => message.data)
}

function SpecListItem({
  spec,
  onSelect,
}: {
  spec: ProjectSpecListItem
  onSelect: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-transparent p-2 transition-colors hover:border-surface-border hover:bg-subtle/70 focus-within:border-surface-border focus-within:bg-subtle/70">
      <button
        type="button"
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
        onClick={onSelect}
      >
        <span className="block truncate text-sm font-medium text-copy-primary">
          {spec.filename}
        </span>
        <span className="mt-1 block truncate text-xs text-copy-muted">
          {formatSpecDate(spec.createdAt)}
        </span>
      </button>
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        aria-label={`Download ${spec.filename}`}
        className="shrink-0 text-copy-muted"
      >
        <a href={spec.downloadPath}>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}

function SpecsMessage({
  children,
  tone = "muted",
}: {
  children: string
  tone?: "muted" | "error"
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs leading-5",
        tone === "error"
          ? "border-destructive/40 bg-surface/80 text-destructive"
          : "border-surface-border bg-surface/70 text-copy-muted"
      )}
    >
      {children}
    </div>
  )
}

function SpecPreviewDialog({
  spec,
  content,
  error,
  isLoading,
  onOpenChange,
}: {
  spec: ProjectSpecListItem | null
  content: string
  error: string | null
  isLoading: boolean
  onOpenChange: (open: boolean) => void
}) {
  const markdownBlocks = useMemo(() => parseMarkdown(content), [content])

  return (
    <Dialog open={!!spec} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-8">
            {spec?.filename ?? "Spec preview"}
          </DialogTitle>
          {spec ? (
            <DialogDescription>{formatSpecDate(spec.createdAt)}</DialogDescription>
          ) : null}
        </DialogHeader>

        <ScrollArea className="min-h-0 h-[min(32rem,calc(100vh-14rem))] rounded-2xl border border-surface-border bg-base/70">
          <div className="p-4">
            {error ? (
              <SpecsMessage tone="error">{error}</SpecsMessage>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-sm text-copy-muted">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading preview.
              </div>
            ) : markdownBlocks.length > 0 ? (
              <MarkdownPreview blocks={markdownBlocks} />
            ) : (
              <SpecsMessage>This spec does not have preview content.</SpecsMessage>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {spec ? (
            <Button asChild type="button" className="bg-ai text-copy-primary hover:bg-ai/90">
              <a href={spec.downloadPath}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MarkdownPreview({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="space-y-4 text-sm leading-6 text-copy-secondary">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = getHeadingTag(block.level)

          return (
            <HeadingTag
              key={`${block.type}-${index}`}
              className={cn(
                "font-semibold text-copy-primary",
                block.level === 1 ? "text-xl" : "text-base"
              )}
            >
              {block.text}
            </HeadingTag>
          )
        }

        if (block.type === "list") {
          return (
            <ul
              key={`${block.type}-${index}`}
              className="list-disc space-y-1 pl-5"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          )
        }

        if (block.type === "code") {
          return (
            <pre
              key={`${block.type}-${index}`}
              className="overflow-x-auto rounded-xl border border-surface-border bg-surface p-3 font-mono text-xs text-copy-primary"
            >
              <code>{block.text}</code>
            </pre>
          )
        }

        return (
          <p key={`${block.type}-${index}`} className="whitespace-pre-wrap">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = markdown.split(/\r?\n/)
  let paragraph: string[] = []
  let listItems: string[] = []
  let codeLines: string[] = []
  let isInCodeBlock = false

  function flushParagraph() {
    if (paragraph.length === 0) {
      return
    }

    blocks.push({
      type: "paragraph",
      text: paragraph.join("\n"),
    })
    paragraph = []
  }

  function flushList() {
    if (listItems.length === 0) {
      return
    }

    blocks.push({
      type: "list",
      items: listItems,
    })
    listItems = []
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (isInCodeBlock) {
        blocks.push({
          type: "code",
          text: codeLines.join("\n"),
        })
        codeLines = []
        isInCodeBlock = false
      } else {
        flushParagraph()
        flushList()
        isInCodeBlock = true
      }
      continue
    }

    if (isInCodeBlock) {
      codeLines.push(line)
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
    const listMatch = /^\s*[-*]\s+(.+)$/.exec(line)

    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      })
      continue
    }

    if (listMatch) {
      flushParagraph()
      listItems.push(listMatch[1])
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line)
  }

  if (isInCodeBlock && codeLines.length > 0) {
    blocks.push({
      type: "code",
      text: codeLines.join("\n"),
    })
  }

  flushParagraph()
  flushList()

  return blocks
}

function getHeadingTag(level: number) {
  if (level === 1) {
    return "h1"
  }

  if (level === 2) {
    return "h2"
  }

  return "h3"
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}

function getResponseError(body: ProjectSpecsResponse, fallback: string) {
  return typeof body.error === "string" && body.error.length > 0
    ? body.error
    : fallback
}

function formatSpecDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}
