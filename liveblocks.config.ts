import type { LiveblocksFlow } from "@liveblocks/react-flow"

import type { CanvasEdge, CanvasNode } from "@/types/canvas"
import type { AiChatFeedMessage, AiStatusFeedMessage } from "@/types/tasks"

export type AiStatusEvent = {
  type: "ai-status"
  id: string
  status: "started" | "processing" | "complete" | "error"
  message: string
  timestamp: string
}

declare global {
  interface Liveblocks {
    Presence: {
      cursor: {
        x: number
        y: number
      } | null
      thinking: boolean
    }

    Storage: {
      flow?: LiveblocksFlow<CanvasNode, CanvasEdge>
    }

    UserMeta: {
      id: string
      info: {
        name: string
        avatar: string
        color: string
      }
    }

    RoomEvent: AiStatusEvent

    FeedMessageData: AiStatusFeedMessage | AiChatFeedMessage

    ThreadMetadata: Record<string, never>

    RoomInfo: {
      title: string
    }
  }
}

export {}
