"use client"

import {
  Bot,
  Download,
  FileText,
  SendHorizontal,
  X,
} from "lucide-react"
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
]

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [prompt])

  function handleStarterPrompt(starterPrompt: string) {
    setPrompt(starterPrompt)
    textareaRef.current?.focus()
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt) {
      return
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedPrompt,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "I can help turn that into a canvas-ready architecture once generation is connected.",
      },
    ])
    setPrompt("")
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }

    event.preventDefault()
    handleSubmit()
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
        <TabsList className="grid w-full grid-cols-2 border border-surface-border bg-subtle p-1">
          <TabsTrigger
            value="architect"
            className="text-copy-muted data-active:bg-accent data-active:text-accent-foreground dark:data-active:bg-accent dark:data-active:text-accent-foreground"
          >
            AI Architect
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
            {messages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <ArchitectEmptyState onSelectPrompt={handleStarterPrompt} />
            )}
          </div>

          <form
            className="mt-4 rounded-2xl border border-surface-border bg-elevated/70 p-3"
            onSubmit={handleSubmit}
          >
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Ask Ghost AI to design, extend, or explain..."
              className="max-h-40 min-h-[72px] resize-none overflow-y-auto border-surface-border bg-base/70 px-3 py-2 text-sm text-copy-primary placeholder:text-copy-faint focus-visible:border-brand focus-visible:ring-ring/40"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                className="bg-ai text-copy-primary hover:bg-ai/90"
                disabled={!prompt.trim()}
              >
                <SendHorizontal className="h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="specs" className="mt-4 min-h-0 flex-1">
          <SpecsTab />
        </TabsContent>
      </Tabs>
    </aside>
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

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
          isUser
            ? "border-2 border-brand/50 bg-accent-dim text-copy-primary"
            : "border border-surface-border bg-elevated text-ai-text"
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

function SpecsTab() {
  return (
    <div className="flex min-h-full flex-col gap-4">
      <Button type="button" className="w-full bg-ai text-copy-primary hover:bg-ai/90">
        <FileText className="h-4 w-4" />
        Generate Spec
      </Button>

      <div className="rounded-2xl border border-surface-border bg-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-subtle text-ai-text">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-copy-primary">
              Architecture Spec Draft
            </h3>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              A generated technical specification preview will appear here once
              spec generation is connected.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-4 w-full justify-center text-copy-faint"
          disabled
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  )
}
