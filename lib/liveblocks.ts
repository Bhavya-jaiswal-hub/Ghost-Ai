import "server-only"

import { Liveblocks } from "@liveblocks/node"

const CURSOR_COLORS = [
  "#00c8d4",
  "#6457f9",
  "#34d399",
  "#fbbf24",
  "#ff4d4f",
  "#8b82ff",
  "#0AC7B4",
  "#52A8FF",
] as const

type LiveblocksClientSingleton = Liveblocks

function createLiveblocksClient() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY

  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is required to initialize Liveblocks.")
  }

  return new Liveblocks({
    secret,
  })
}

const globalForLiveblocks = globalThis as typeof globalThis & {
  liveblocks?: LiveblocksClientSingleton
}

export function getLiveblocksClient() {
  const liveblocks = globalForLiveblocks.liveblocks ?? createLiveblocksClient()

  if (process.env.NODE_ENV !== "production") {
    globalForLiveblocks.liveblocks = liveblocks
  }

  return liveblocks
}

export function getUserCursorColor(userId: string) {
  let hash = 0

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0
  }

  return CURSOR_COLORS[hash % CURSOR_COLORS.length]
}
