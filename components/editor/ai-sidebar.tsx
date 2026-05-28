"use client"

import {
  Bot,
  LoaderCircle,
  MessageSquare,
  SendHorizontal,
  X,
} from "lucide-react"
import {
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
  useFeeds,
  useSelf,
} from "@liveblocks/react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import { SpecsTab } from "@/components/editor/specs-tab"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { designAgent } from "@/trigger/design-agent"
import { type CanvasSnapshot } from "@/types/canvas"
import {
  AI_CHAT_FEED_ID,
  AI_STATUS_FEED_ID,
  isAiGenerationActive,
  isAiChatFeedMessage,
  isAiStatusFeedMessage,
  type AiChatFeedMessage,
  type AiStatus,
  type AiStatusFeedMessage,
} from "@/types/tasks"

interface AiSidebarProps {
  isOpen: boolean
  roomId: string
  getCanvasSnapshot: () => CanvasSnapshot
  onClose: () => void
}

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
]

const DEFAULT_STATUS_TEXT: Record<AiStatus, string> = {
  started: "Ghost AI is getting ready.",
  processing: "Ghost AI is working.",
  complete: "Ghost AI finished.",
  error: "Ghost AI needs attention.",
}

interface ValidatedChatMessage {
  id: string
  createdAt: number
  data: AiChatFeedMessage
}

interface ActiveDesignRun {
  runId: string
  publicToken: string
}

interface DesignRunResponse {
  runId?: unknown
  publicToken?: unknown
  token?: unknown
  error?: unknown
}

const ACTIVE_TRIGGER_STATUSES = new Set([
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
])

export function AiSidebar({
  isOpen,
  roomId,
  getCanvasSnapshot,
  onClose,
}: AiSidebarProps) {
  const [prompt, setPrompt] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [activeRun, setActiveRun] = useState<ActiveDesignRun | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const failedRealtimeRunIdRef = useRef<string | null>(null)
  const currentUser = useSelf((user) => ({
    id: user.id,
    name: user.info.name,
    avatar: user.info.avatar,
  }))
  const createFeed = useCreateFeed()
  const createFeedMessage = useCreateFeedMessage()
  const {
    feeds,
    error: feedsError,
    isLoading: areFeedsLoading,
  } = useFeeds()
  const {
    messages: feedMessages,
    error: feedMessagesError,
    isLoading: areFeedMessagesLoading,
  } = useFeedMessages(AI_STATUS_FEED_ID)
  const {
    messages: chatFeedMessages,
    error: chatFeedMessagesError,
    isLoading: areChatFeedMessagesLoading,
  } = useFeedMessages(AI_CHAT_FEED_ID)
  const handleRunComplete = useCallback((run: { id: string }) => {
    setActiveRun((currentRun) =>
      currentRun?.runId === run.id ? null : currentRun
    )
  }, [])
  const {
    run: realtimeRun,
    error: realtimeRunError,
  } = useRealtimeRun<typeof designAgent>(activeRun?.runId, {
    accessToken: activeRun?.publicToken,
    enabled: Boolean(activeRun?.runId && activeRun.publicToken),
    onComplete: handleRunComplete,
  })
  const hasStatusFeed = (feeds ?? []).some(
    (feed) => feed.feedId === AI_STATUS_FEED_ID
  )
  const hasChatFeed = (feeds ?? []).some(
    (feed) => feed.feedId === AI_CHAT_FEED_ID
  )
  const latestStatus = useMemo(
    () => getLatestStatusMessage(feedMessages ?? []),
    [feedMessages]
  )
  const chatMessages = useMemo(
    () => getValidatedChatMessages(chatFeedMessages ?? []),
    [chatFeedMessages]
  )
  const isRealtimeRunActive = activeRun
    ? !realtimeRun ||
      realtimeRun.id !== activeRun.runId ||
      ACTIVE_TRIGGER_STATUSES.has(realtimeRun.status)
    : false
  const isGenerationActive =
    isRealtimeRunActive || isAiGenerationActive(latestStatus?.status)
  const isInputDisabled = isSubmitting || isRealtimeRunActive
  const statusText =
    isRealtimeRunActive && !isAiGenerationActive(latestStatus?.status)
      ? DEFAULT_STATUS_TEXT.processing
      : latestStatus
        ? latestStatus.text ?? DEFAULT_STATUS_TEXT[latestStatus.status]
        : null
  const ensureAiStatusFeed = useCallback(async () => {
    await createFeed(AI_STATUS_FEED_ID, {
      metadata: {
        name: "AI status feed",
      },
    }).catch(() => {
      // Another client may have created the shared feed first.
    })
  }, [createFeed])
  const ensureAiChatFeed = useCallback(async () => {
    await createFeed(AI_CHAT_FEED_ID, {
      metadata: {
        name: "AI chat feed",
      },
    }).catch(() => {
      // Another client may have created the shared feed first.
    })
  }, [createFeed])
  const pushChatMessage = useCallback(
    async (message: AiChatFeedMessage) => {
      await ensureAiChatFeed()
      await createFeedMessage(AI_CHAT_FEED_ID, message, {
        id: crypto.randomUUID(),
      })
    },
    [createFeedMessage, ensureAiChatFeed]
  )
  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [prompt])

  useEffect(() => {
    const textarea = chatTextareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [chatInput])

  useEffect(() => {
    if (areFeedsLoading || feedsError || hasStatusFeed) {
      return
    }

    void ensureAiStatusFeed()
  }, [areFeedsLoading, ensureAiStatusFeed, feedsError, hasStatusFeed])

  useEffect(() => {
    if (areFeedsLoading || feedsError || hasChatFeed) {
      return
    }

    void ensureAiChatFeed()
  }, [areFeedsLoading, ensureAiChatFeed, feedsError, hasChatFeed])

  useEffect(() => {
    if (!activeRun || !realtimeRunError) {
      return
    }

    if (failedRealtimeRunIdRef.current === activeRun.runId) {
      return
    }

    failedRealtimeRunIdRef.current = activeRun.runId

    setActiveRun(null)
  }, [activeRun, realtimeRunError])

  function handleStarterPrompt(starterPrompt: string) {
    setPrompt(starterPrompt)
    textareaRef.current?.focus()
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || isInputDisabled) {
      return
    }

    setIsSubmitting(true)

    try {
      await pushChatMessage({
        type: "ai-chat",
        sender: {
          id: currentUser?.id ?? "unknown-user",
          name: currentUser?.name || "Collaborator",
          avatar: currentUser?.avatar ?? "",
        },
        role: "user",
        content: trimmedPrompt,
        timestamp: new Date().toISOString(),
      })
      setPrompt("")

      const designRun = await triggerDesignRun(trimmedPrompt, roomId)
      failedRealtimeRunIdRef.current = null
      setActiveRun(designRun)
    } catch {
      // Startup failures should not be persisted as room chat output.
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleChatSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const trimmedMessage = chatInput.trim()

    if (!trimmedMessage || isSendingChat) {
      return
    }

    setIsSendingChat(true)

    try {
      await pushChatMessage({
        type: "ai-chat",
        sender: {
          id: currentUser?.id ?? "unknown-user",
          name: currentUser?.name || "Collaborator",
          avatar: currentUser?.avatar ?? "",
        },
        role: "user",
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
      })
      setChatInput("")
    } finally {
      setIsSendingChat(false)
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    event.preventDefault()
    void handleSubmit()
  }

  function handleChatTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    event.preventDefault()
    void handleChatSubmit()
  }

  return (
    <aside
      data-overlay-panel
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "fixed right-4 top-18 bottom-4 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl border border-surface-border bg-base/95 p-5 shadow-2xl shadow-base/40 backdrop-blur transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-elevated text-ai-text">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-copy-primary">
              AI Workspace
            </h2>
            <p className="mt-0.5 truncate text-xs text-copy-muted">
              Collaborate with Ghost AI
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close AI sidebar"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="architect" className="mt-5 min-h-0 flex-1">
        <TabsList className="grid w-full grid-cols-3 border border-surface-border bg-subtle p-1">
          <TabsTrigger
            value="architect"
            className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground dark:data-active:bg-accent dark:data-active:text-accent-foreground"
          >
            AI Architect
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground dark:data-active:bg-accent dark:data-active:text-accent-foreground"
          >
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="specs"
            className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground dark:data-active:bg-accent dark:data-active:text-accent-foreground"
          >
            Specs
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="architect"
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ArchitectEmptyState onSelectPrompt={handleStarterPrompt} />
          </div>

          <AiStatusIndicator
            isActive={isGenerationActive}
            text={statusText}
            hasError={!!feedMessagesError}
            isLoading={areFeedMessagesLoading}
          />

          <form
            className="mt-4 rounded-2xl border border-surface-border bg-elevated/70 p-3"
            onSubmit={(event) => {
              void handleSubmit(event)
            }}
          >
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              disabled={isInputDisabled}
              placeholder="Describe a design change..."
              className="max-h-40 min-h-[72px] resize-none overflow-y-auto border-surface-border bg-base/70 px-3 py-2 text-sm text-copy-primary placeholder:text-copy-faint disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-brand focus-visible:ring-ring/40"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                className="bg-state-success text-base hover:bg-state-success/90 disabled:opacity-45"
                disabled={!prompt.trim() || isInputDisabled}
              >
                {isInputDisabled ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
                {isInputDisabled ? "Running" : "Send"}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="chat" className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {chatFeedMessagesError ? (
              <ChatErrorState />
            ) : areChatFeedMessagesLoading ? (
              <ChatLoadingState />
            ) : chatMessages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {chatMessages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <ChatEmptyState />
            )}
          </div>

          <form
            className="mt-4 rounded-2xl border border-surface-border bg-elevated/70 p-3"
            onSubmit={(event) => {
              void handleChatSubmit(event)
            }}
          >
            <Textarea
              ref={chatTextareaRef}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleChatTextareaKeyDown}
              disabled={isSendingChat}
              placeholder="Message the room..."
              className="max-h-40 min-h-[72px] resize-none overflow-y-auto border-surface-border bg-base/70 px-3 py-2 text-sm text-copy-primary placeholder:text-copy-faint disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-brand focus-visible:ring-ring/40"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                className="bg-state-success text-base hover:bg-state-success/90 disabled:opacity-45"
                disabled={!chatInput.trim() || isSendingChat}
              >
                {isSendingChat ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
                {isSendingChat ? "Sending" : "Send"}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="specs" className="mt-4 min-h-0 flex-1">
          <SpecsTab projectId={roomId} getCanvasSnapshot={getCanvasSnapshot} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}

async function triggerDesignRun(
  prompt: string,
  roomId: string
): Promise<ActiveDesignRun> {
  const response = await fetch("/api/ai/design", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      roomId,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as DesignRunResponse

  if (!response.ok) {
    throw new Error(getResponseError(body, "Could not start the design agent."))
  }

  if (typeof body.runId !== "string" || body.runId.length === 0) {
    throw new Error("The design agent did not return a run id.")
  }

  const publicToken =
    typeof body.publicToken === "string" && body.publicToken.length > 0
      ? body.publicToken
      : typeof body.token === "string" && body.token.length > 0
        ? body.token
        : await fetchDesignRunToken(body.runId)

  return {
    runId: body.runId,
    publicToken,
  }
}

async function fetchDesignRunToken(runId: string) {
  const response = await fetch("/api/ai/design/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runId }),
  })
  const body = (await response.json().catch(() => ({}))) as DesignRunResponse

  if (!response.ok) {
    throw new Error(
      getResponseError(body, "Could not connect to the design run.")
    )
  }

  if (typeof body.token !== "string" || body.token.length === 0) {
    throw new Error("The design run did not return a public token.")
  }

  return body.token
}

function getResponseError(body: DesignRunResponse, fallback: string) {
  return typeof body.error === "string" && body.error.length > 0
    ? body.error
    : fallback
}

function getLatestStatusMessage(
  messages: Array<{ createdAt: number; data: unknown }>
): AiStatusFeedMessage | undefined {
  const latestMessage = messages
    .filter((message) => isAiStatusFeedMessage(message.data))
    .sort((left, right) => right.createdAt - left.createdAt)[0]?.data

  return isAiStatusFeedMessage(latestMessage) ? latestMessage : undefined
}

function getValidatedChatMessages(
  messages: Array<{ id: string; createdAt: number; data: unknown }>
): ValidatedChatMessage[] {
  return messages
    .filter((message): message is ValidatedChatMessage =>
      isAiChatFeedMessage(message.data)
    )
    .sort((left, right) => left.createdAt - right.createdAt)
}

function AiStatusIndicator({
  isActive,
  text,
  hasError,
  isLoading,
}: {
  isActive: boolean
  text: string | null
  hasError: boolean
  isLoading: boolean
}) {
  if (!isActive) {
    return null
  }

  return (
    <div
      className={cn(
        "mt-4 rounded-2xl border bg-surface/80 px-3 py-2 text-xs shadow-sm",
        hasError
          ? "border-destructive/40 text-destructive"
          : "border-state-success/40 text-state-success"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isActive || isLoading ? (
          <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
        )}
        <span className="truncate font-medium">
          {hasError
            ? "AI status is temporarily unavailable."
            : text ?? "Ghost AI is working."}
        </span>
      </div>
    </div>
  )
}

function ArchitectEmptyState({
  onSelectPrompt,
}: {
  onSelectPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-elevated/50 px-5 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-surface-border bg-subtle text-ai-text">
        <Bot className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm leading-6 text-copy-muted">
        Describe the system you want to shape, or start with a common
        architecture prompt.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {STARTER_PROMPTS.map((starterPrompt) => (
          <button
            key={starterPrompt}
            type="button"
            className="rounded-full bg-subtle px-3 py-1.5 text-xs font-medium text-ai-text transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => onSelectPrompt(starterPrompt)}
          >
            {starterPrompt}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatLoadingState() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-elevated/60 px-3 py-2 text-xs text-copy-muted">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      Loading room chat.
    </div>
  )
}

function ChatErrorState() {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-surface/80 px-3 py-2 text-xs text-destructive">
      Room chat is temporarily unavailable.
    </div>
  )
}

function ChatEmptyState() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-elevated/50 px-5 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-surface-border bg-subtle text-ai-text">
        <MessageSquare className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm leading-6 text-copy-muted">
        Room messages will appear here as collaborators chat.
      </p>
    </div>
  )
}

function formatMessageTime(timestamp: string) {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function ChatBubble({ message }: { message: ValidatedChatMessage }) {
  const isUser = message.data.role === "user"
  const timestamp = formatMessageTime(message.data.timestamp)

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
          isUser
            ? "border border-state-success/50 bg-state-success text-base"
            : "border border-surface-border bg-elevated text-copy-primary"
        )}
      >
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px] leading-none",
            isUser ? "text-base/70" : "text-copy-muted"
          )}
        >
          <span className="truncate font-medium">
            {message.data.sender.name}
          </span>
          {timestamp ? <span className="shrink-0">{timestamp}</span> : null}
        </div>
        <p className="whitespace-pre-wrap break-words">
          {message.data.content}
        </p>
      </div>
    </div>
  )
}
