import type { Edge, Node } from "@xyflow/react"

export const NODE_COLORS = [
  { fill: "#1F1F1F", text: "#EDEDED" },
  { fill: "#10233D", text: "#52A8FF" },
  { fill: "#2E1938", text: "#BF7AF0" },
  { fill: "#331B00", text: "#FF990A" },
  { fill: "#3C1618", text: "#FF6166" },
  { fill: "#3A1726", text: "#F75F8F" },
  { fill: "#0F2E18", text: "#62C073" },
  { fill: "#062822", text: "#0AC7B4" },
] as const

export const NODE_SHAPES = [
  "rectangle",
  "diamond",
  "circle",
  "pill",
  "cylinder",
  "hexagon",
] as const

export const DEFAULT_NODE_COLOR = NODE_COLORS[0]
export const DEFAULT_NODE_SHAPE = NODE_SHAPES[0]
export const CANVAS_NODE_TYPE = "canvasNode"
export const CANVAS_EDGE_TYPE = "canvasEdge"
export const SHAPE_DRAG_MIME_TYPE = "application/vnd.ghost-ai.shape+json"

export const DEFAULT_NODE_SIZES = {
  rectangle: { width: 160, height: 80 },
  diamond: { width: 140, height: 140 },
  circle: { width: 96, height: 96 },
  pill: { width: 160, height: 64 },
  cylinder: { width: 144, height: 88 },
  hexagon: { width: 144, height: 96 },
} as const satisfies Record<
  CanvasNodeShape,
  {
    width: number
    height: number
  }
>

export type CanvasNodeColor = (typeof NODE_COLORS)[number]
export type CanvasNodeShape = (typeof NODE_SHAPES)[number]
export type CanvasNodeType = typeof CANVAS_NODE_TYPE | CanvasNodeShape
export type CanvasNodeSize = (typeof DEFAULT_NODE_SIZES)[CanvasNodeShape]

export interface ShapeDragPayload {
  shape: CanvasNodeShape
  size: CanvasNodeSize
}

export type CanvasNodeData = {
  label: string
  color: CanvasNodeColor
  shape: CanvasNodeShape
}

export type CanvasEdgeData = Record<string, never>

export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>
export type CanvasEdge = Edge<CanvasEdgeData, typeof CANVAS_EDGE_TYPE>
