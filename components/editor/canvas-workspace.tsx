"use client"

import {
  Component,
  useState,
  type DragEvent,
  type ErrorInfo,
  type MouseEvent,
  type ReactNode,
} from "react"
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense"
import { ClientSideSuspense } from "@liveblocks/react/suspense"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Pill,
  RectangleHorizontal,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CANVAS_NODE_TYPE,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZES,
  DEFAULT_NODE_SHAPE,
  NODE_SHAPES,
  SHAPE_DRAG_MIME_TYPE,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeShape,
  type ShapeDragPayload,
} from "@/types/canvas"

interface CanvasWorkspaceProps {
  roomId: string
}

interface ShapeOption {
  shape: CanvasNodeShape
  label: string
  Icon: LucideIcon
}

const shapeOptions: ShapeOption[] = [
  { shape: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
  { shape: "diamond", label: "Diamond", Icon: Diamond },
  { shape: "circle", label: "Circle", Icon: Circle },
  { shape: "pill", label: "Pill", Icon: Pill },
  { shape: "cylinder", label: "Cylinder", Icon: Cylinder },
  { shape: "hexagon", label: "Hexagon", Icon: Hexagon },
]

const canvasNodeTypes = {
  [CANVAS_NODE_TYPE]: CanvasNodeRenderer,
  rectangle: CanvasNodeRenderer,
  diamond: CanvasNodeRenderer,
  circle: CanvasNodeRenderer,
  pill: CanvasNodeRenderer,
  cylinder: CanvasNodeRenderer,
  hexagon: CanvasNodeRenderer,
} satisfies NodeTypes

interface CanvasErrorBoundaryProps {
  children: ReactNode
}

interface CanvasErrorBoundaryState {
  hasError: boolean
}

class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Liveblocks canvas failed to connect.", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <CanvasStateMessage
          title="Canvas connection failed"
          description="Refresh the workspace or check that you still have access to this project."
        />
      )
    }

    return this.props.children
  }
}

function CanvasStateMessage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 text-center">
      <div>
        <h2 className="text-sm font-medium text-copy-primary">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-copy-muted">
          {description}
        </p>
      </div>
    </div>
  )
}

function isCanvasNodeShape(value: unknown): value is CanvasNodeShape {
  return (
    typeof value === "string" &&
    (NODE_SHAPES as readonly string[]).includes(value)
  )
}

function isShapeDragPayload(value: unknown): value is ShapeDragPayload {
  if (!value || typeof value !== "object") {
    return false
  }

  const payload = value as Partial<ShapeDragPayload>

  return (
    isCanvasNodeShape(payload.shape) &&
    !!payload.size &&
    typeof payload.size.width === "number" &&
    typeof payload.size.height === "number" &&
    payload.size.width > 0 &&
    payload.size.height > 0
  )
}

function readShapeDragPayload(dataTransfer: DataTransfer) {
  const rawPayload = dataTransfer.getData(SHAPE_DRAG_MIME_TYPE)

  if (!rawPayload) {
    return null
  }

  try {
    const parsedPayload: unknown = JSON.parse(rawPayload)

    if (!isShapeDragPayload(parsedPayload)) {
      return null
    }

    return parsedPayload
  } catch {
    return null
  }
}

function createNodeId(shape: CanvasNodeShape) {
  return `${shape}-${crypto.randomUUID()}`
}

function getNodeStroke(selected: boolean) {
  return selected ? "var(--accent-primary)" : "var(--border-subtle)"
}

function ShapeSurface({
  shape,
  fill,
  stroke,
}: {
  shape: CanvasNodeShape
  fill: string
  stroke: string
}) {
  if (shape === "diamond") {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polygon
          points="50,2 98,50 50,98 2,50"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  if (shape === "hexagon") {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polygon
          points="24,3 76,3 98,50 76,97 24,97 2,50"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  if (shape === "cylinder") {
    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <path
          d="M8 20 C8 8 92 8 92 20 L92 80 C92 92 8 92 8 80 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="50"
          cy="20"
          rx="42"
          ry="12"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  return null
}

function CanvasNodeRenderer({
  data,
  isConnectable,
  selected,
}: NodeProps<CanvasNode>) {
  const handleClassName =
    "!h-2 !w-2 !border !border-base !bg-copy-primary !opacity-0 transition-opacity group-hover:!opacity-100"
  const stroke = getNodeStroke(!!selected)
  const isSvgShape =
    data.shape === "diamond" ||
    data.shape === "hexagon" ||
    data.shape === "cylinder"
  const cssShapeClassName =
    data.shape === "circle"
      ? "rounded-full border"
      : data.shape === "pill"
        ? "rounded-full border"
        : data.shape === "rectangle"
          ? "rounded-xl border"
          : ""

  return (
    <div
      className={`group relative flex h-full min-h-12 w-full min-w-20 items-center justify-center px-3 py-2 text-center text-sm font-medium ${cssShapeClassName}`}
      style={{
        backgroundColor: isSvgShape ? "transparent" : data.color.fill,
        borderColor: isSvgShape ? "transparent" : stroke,
        color: data.color.text,
      }}
    >
      <ShapeSurface
        shape={data.shape}
        fill={data.color.fill}
        stroke={stroke}
      />
      <span className="relative z-10 w-full truncate">{data.label}</span>
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className={handleClassName}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={handleClassName}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className={handleClassName}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className={handleClassName}
      />
    </div>
  )
}

function createCanvasNode(
  shape: CanvasNodeShape,
  position: CanvasNode["position"],
  size = DEFAULT_NODE_SIZES[shape]
) {
  return {
    id: createNodeId(shape),
    type: shape,
    position,
    width: size.width,
    height: size.height,
    initialWidth: size.width,
    initialHeight: size.height,
    style: {
      width: size.width,
      height: size.height,
    },
    data: {
      label: "",
      color: DEFAULT_NODE_COLOR,
      shape,
    },
  } satisfies CanvasNode
}

function ShapePanel({
  activeShape,
  onSelectShape,
}: {
  activeShape: CanvasNodeShape
  onSelectShape: (shape: CanvasNodeShape) => void
}) {
  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    shape: CanvasNodeShape
  ) {
    const payload: ShapeDragPayload = {
      shape,
      size: DEFAULT_NODE_SIZES[shape],
    }

    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData(SHAPE_DRAG_MIME_TYPE, JSON.stringify(payload))
    event.dataTransfer.setData("text/plain", shape)
  }

  return (
    <Panel position="bottom-center" className="mb-6">
      <div className="nodrag nopan flex items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1 shadow-lg backdrop-blur-md">
        {shapeOptions.map(({ shape, label, Icon }) => (
          <Button
            key={shape}
            type="button"
            variant="ghost"
            size="icon"
            draggable
            title={label}
            aria-label={`Drag ${label} shape`}
            aria-pressed={activeShape === shape}
            className={
              activeShape === shape
                ? "rounded-full bg-accent-dim text-brand hover:bg-accent-dim hover:text-brand"
                : "rounded-full text-copy-secondary hover:bg-accent-dim hover:text-brand"
            }
            onClick={() => onSelectShape(shape)}
            onDragStart={(event) => handleDragStart(event, shape)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </Button>
        ))}
      </div>
    </Panel>
  )
}

function CanvasFlow() {
  const [activeShape, setActiveShape] =
    useState<CanvasNodeShape>(DEFAULT_NODE_SHAPE)
  const { screenToFlowPosition } = useReactFlow<CanvasNode, CanvasEdge>()
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({
      suspense: true,
      nodes: {
        initial: [],
      },
      edges: {
        initial: [],
      },
    })

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes(SHAPE_DRAG_MIME_TYPE)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const payload = readShapeDragPayload(event.dataTransfer)

    if (!payload) {
      return
    }

    event.preventDefault()

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = createCanvasNode(payload.shape, position, payload.size)

    onNodesChange([{ type: "add", item: newNode }])
  }

  function handlePaneClick(event: MouseEvent) {
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = createCanvasNode(activeShape, position)

    onNodesChange([{ type: "add", item: newNode }])
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={canvasNodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDelete={onDelete}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaneClick={handlePaneClick}
      connectionMode={ConnectionMode.Loose}
      fitView
      className="bg-base text-copy-primary"
    >
      <MiniMap<CanvasNode>
        pannable
        zoomable
        bgColor="var(--bg-elevated)"
        maskColor="var(--accent-primary-dim)"
        nodeColor={(node) => node.data.color?.fill ?? DEFAULT_NODE_COLOR.fill}
        nodeStrokeColor="var(--border-subtle)"
        className="rounded-xl border border-surface-border bg-elevated"
      />
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="var(--border-subtle)"
        bgColor="var(--bg-base)"
      />
      <ShapePanel activeShape={activeShape} onSelectShape={setActiveShape} />
    </ReactFlow>
  )
}

export function CanvasWorkspace({ roomId }: CanvasWorkspaceProps) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <CanvasErrorBoundary key={roomId}>
        <RoomProvider
          id={roomId}
          initialPresence={{
            cursor: null,
            isThinking: false,
          }}
        >
          <ClientSideSuspense
            fallback={
              <CanvasStateMessage
                title="Loading canvas"
                description="Connecting to the collaborative workspace."
              />
            }
          >
            <ReactFlowProvider>
              <CanvasFlow />
            </ReactFlowProvider>
          </ClientSideSuspense>
        </RoomProvider>
      </CanvasErrorBoundary>
    </LiveblocksProvider>
  )
}
