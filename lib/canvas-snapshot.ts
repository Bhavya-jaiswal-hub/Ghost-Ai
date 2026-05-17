import {
  NODE_SHAPES,
  type CanvasNodeColor,
  type CanvasSnapshot,
} from "@/types/canvas"

type ParseCanvasSnapshotResult =
  | {
      data: CanvasSnapshot
    }
  | {
      error: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isCanvasNodeColor(value: unknown): value is CanvasNodeColor {
  return (
    isRecord(value) &&
    typeof value.fill === "string" &&
    value.fill.length > 0 &&
    typeof value.text === "string" &&
    value.text.length > 0
  )
}

function isCanvasNode(value: unknown) {
  if (!isRecord(value)) {
    return false
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    return false
  }

  if (!isRecord(value.position)) {
    return false
  }

  if (!isFiniteNumber(value.position.x) || !isFiniteNumber(value.position.y)) {
    return false
  }

  if (!isRecord(value.data)) {
    return false
  }

  return (
    typeof value.data.label === "string" &&
    typeof value.data.shape === "string" &&
    (NODE_SHAPES as readonly string[]).includes(value.data.shape) &&
    isCanvasNodeColor(value.data.color)
  )
}

function isCanvasEdge(value: unknown) {
  if (!isRecord(value)) {
    return false
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    return false
  }

  if (typeof value.source !== "string" || value.source.trim().length === 0) {
    return false
  }

  if (typeof value.target !== "string" || value.target.trim().length === 0) {
    return false
  }

  if (value.data === undefined) {
    return true
  }

  return isRecord(value.data) && typeof value.data.label === "string"
}

export function parseCanvasSnapshot(
  value: unknown
): ParseCanvasSnapshotResult {
  if (!isRecord(value)) {
    return { error: "Canvas payload must be an object." }
  }

  if (!Array.isArray(value.nodes)) {
    return { error: "Canvas payload nodes must be an array." }
  }

  if (!Array.isArray(value.edges)) {
    return { error: "Canvas payload edges must be an array." }
  }

  if (!value.nodes.every(isCanvasNode)) {
    return { error: "Canvas payload contains an invalid node." }
  }

  if (!value.edges.every(isCanvasEdge)) {
    return { error: "Canvas payload contains an invalid edge." }
  }

  return {
    data: {
      nodes: value.nodes,
      edges: value.edges,
    } as CanvasSnapshot,
  }
}
