import { z } from "zod"

export const AI_STATUS_FEED_ID = "ai-status-feed"
export const AI_CHAT_FEED_ID = "ai-chat"

export const AI_STATUS_VALUES = [
  "started",
  "processing",
  "complete",
  "error",
] as const

export type AiStatus = (typeof AI_STATUS_VALUES)[number]

export const aiChatFeedMessageSchema = z.object({
  type: z.literal("ai-chat"),
  sender: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    avatar: z.string(),
  }),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
  timestamp: z.string().datetime(),
})

export type AiChatFeedMessage = z.infer<typeof aiChatFeedMessageSchema>

export type AiStatusFeedMessage = {
  type: "ai-status"
  status: AiStatus
  source: "design" | "spec" | "system"
  text?: string
}

export function isAiStatus(value: unknown): value is AiStatus {
  return (
    typeof value === "string" &&
    (AI_STATUS_VALUES as readonly string[]).includes(value)
  )
}

export function isAiStatusFeedMessage(
  value: unknown
): value is AiStatusFeedMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const message = value as Partial<AiStatusFeedMessage>
  const hasValidText =
    message.text === undefined || typeof message.text === "string"

  return (
    message.type === "ai-status" &&
    isAiStatus(message.status) &&
    (message.source === "design" ||
      message.source === "spec" ||
      message.source === "system") &&
    hasValidText
  )
}

export function isAiChatFeedMessage(
  value: unknown
): value is AiChatFeedMessage {
  return aiChatFeedMessageSchema.safeParse(value).success
}

export function isAiGenerationActive(status: AiStatus | null | undefined) {
  return status === "started" || status === "processing"
}
