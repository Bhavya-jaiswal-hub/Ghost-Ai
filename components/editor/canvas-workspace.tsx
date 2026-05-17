"use client"

import dynamic from "next/dynamic"
import {
  Component,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ErrorInfo,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import { useAuth } from "@clerk/nextjs"
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense"
import {
  ClientSideSuspense,
  shallow,
  useCanRedo,
  useCanUndo,
  useOther,
  useOthersConnectionIds,
  useOthersMapped,
  useRedo,
  useRoom,
  useUndo,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense"
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  ConnectionMode,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  type Connection,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  Circle,
  Cylinder,
  Diamond,
  CheckCircle2,
  Hexagon,
  LoaderCircle,
  Minus,
  Pill,
  Plus,
  RectangleHorizontal,
  Redo2,
  Save,
  Scan,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { type CanvasTemplate } from "@/components/editor/starter-templates"
import {
  useCanvasAutosave,
  type CanvasSaveStatus,
} from "@/hooks/use-canvas-autosave"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { userProfileAppearance } from "@/lib/clerk-appearance"
import {
  CANVAS_NODE_TYPE,
  CANVAS_EDGE_TYPE,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZES,
  NODE_COLORS,
  NODE_SHAPES,
  SHAPE_DRAG_MIME_TYPE,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeColor,
  type CanvasNodeShape,
  type CanvasNodeSize,
  type CanvasSnapshot,
  type ShapeDragPayload,
} from "@/types/canvas"

interface CanvasWorkspaceProps {
  roomId: string
  templateImportRequest?: TemplateImportRequest | null
}

interface TemplateImportRequest {
  template: CanvasTemplate
  requestId: number
}

interface ShapeOption {
  shape: CanvasNodeShape
  label: string
  Icon: LucideIcon
}

interface ColorOption {
  label: string
  color: CanvasNodeColor
}

interface ShapeDragPreviewState extends ShapeDragPayload {
  x: number
  y: number
}

interface CollaboratorPresence {
  id: string
  name: string
  avatar: string
  color: string
}

interface CanvasNodeActions {
  updateNodeLabel: (nodeId: string, label: string) => void
  updateNodeColor: (nodeId: string, color: CanvasNodeColor) => void
}

interface CanvasEdgeActions {
  updateEdgeLabel: (edgeId: string, label: string) => void
}

const CanvasNodeActionsContext = createContext<CanvasNodeActions | null>(null)
const CanvasEdgeActionsContext = createContext<CanvasEdgeActions | null>(null)

const MIN_NODE_WIDTH = 80
const MIN_NODE_HEIGHT = 48
const EMPTY_NODE_LABEL_PLACEHOLDER = "Untitled node"
const EDGE_INTERACTION_WIDTH = 28
const EDGE_LABEL_HINT = "Label"
const MAX_VISIBLE_COLLABORATORS = 5
const DEFAULT_CANVAS_EDGE_MARKER = {
  type: MarkerType.ArrowClosed,
  color: "var(--text-primary)",
  width: 18,
  height: 18,
}

const shapeOptions: ShapeOption[] = [
  { shape: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
  { shape: "diamond", label: "Diamond", Icon: Diamond },
  { shape: "circle", label: "Circle", Icon: Circle },
  { shape: "pill", label: "Pill", Icon: Pill },
  { shape: "cylinder", label: "Cylinder", Icon: Cylinder },
  { shape: "hexagon", label: "Hexagon", Icon: Hexagon },
]

const colorOptions: ColorOption[] = [
  { label: "Neutral", color: NODE_COLORS[0] },
  { label: "Blue", color: NODE_COLORS[1] },
  { label: "Purple", color: NODE_COLORS[2] },
  { label: "Orange", color: NODE_COLORS[3] },
  { label: "Red", color: NODE_COLORS[4] },
  { label: "Pink", color: NODE_COLORS[5] },
  { label: "Green", color: NODE_COLORS[6] },
  { label: "Teal", color: NODE_COLORS[7] },
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

const canvasEdgeTypes = {
  [CANVAS_EDGE_TYPE]: CanvasEdgeRenderer,
} satisfies EdgeTypes

const defaultCanvasEdgeOptions = {
  type: CANVAS_EDGE_TYPE,
  data: {
    label: "",
  },
  markerEnd: DEFAULT_CANVAS_EDGE_MARKER,
  interactionWidth: EDGE_INTERACTION_WIDTH,
} satisfies Partial<CanvasEdge>

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

function CanvasUserButtonPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="size-8 rounded-full border border-surface-border bg-elevated"
    />
  )
}

const CanvasUserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  {
    ssr: false,
    loading: CanvasUserButtonPlaceholder,
  }
)

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

function participantLabel(participant: Pick<CollaboratorPresence, "name">) {
  const trimmedName = participant.name.trim()

  return trimmedName.length > 0 ? trimmedName : "Collaborator"
}

function participantInitials(participant: Pick<CollaboratorPresence, "name">) {
  const label = participantLabel(participant)
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "C"
}

function isSafeAvatarUrl(url: string) {
  if (!url) {
    return false
  }

  try {
    const parsedUrl = new URL(url)

    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
  } catch {
    return false
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.closest("input, textarea, [contenteditable]")) {
    const editableElement = target.closest("[contenteditable]")

    return (
      !editableElement ||
      editableElement.getAttribute("contenteditable") !== "false"
    )
  }

  return false
}

function createNodeId(shape: CanvasNodeShape) {
  return `${shape}-${crypto.randomUUID()}`
}

function createEdgeId(connection: Connection) {
  return `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`
}

function hasSameConnection(edge: CanvasEdge, connection: Connection) {
  return (
    edge.source === connection.source &&
    edge.target === connection.target &&
    (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
    (edge.targetHandle ?? null) === (connection.targetHandle ?? null)
  )
}

function createCanvasEdge(connection: Connection) {
  return {
    id: createEdgeId(connection),
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    type: CANVAS_EDGE_TYPE,
    data: {
      label: "",
    },
    markerEnd: DEFAULT_CANVAS_EDGE_MARKER,
    interactionWidth: EDGE_INTERACTION_WIDTH,
  } satisfies CanvasEdge
}

function cloneTemplateNode(node: CanvasNode) {
  return {
    ...node,
    position: {
      ...node.position,
    },
    data: {
      ...node.data,
      color: node.data.color,
    },
    style: node.style
      ? {
          ...node.style,
        }
      : undefined,
  } satisfies CanvasNode
}

function cloneTemplateEdge(edge: CanvasEdge) {
  return {
    ...edge,
    data: {
      ...edge.data,
      label: edge.data?.label ?? "",
    },
  } satisfies CanvasEdge
}

function normalizeCanvasEdge(edge: CanvasEdge) {
  const label = edge.data?.label ?? ""

  if (
    edge.type === CANVAS_EDGE_TYPE &&
    edge.data?.label === label &&
    edge.markerEnd &&
    edge.interactionWidth
  ) {
    return edge
  }

  return {
    ...edge,
    type: CANVAS_EDGE_TYPE,
    data: {
      ...edge.data,
      label,
    },
    markerEnd: edge.markerEnd ?? DEFAULT_CANVAS_EDGE_MARKER,
    interactionWidth: edge.interactionWidth ?? EDGE_INTERACTION_WIDTH,
  } satisfies CanvasEdge
}

function getNodeStroke(selected: boolean) {
  return selected ? "var(--accent-primary)" : "var(--border-subtle)"
}

function isSvgNodeShape(shape: CanvasNodeShape) {
  return shape === "diamond" || shape === "hexagon" || shape === "cylinder"
}

function getCssShapeClassName(shape: CanvasNodeShape) {
  if (shape === "circle" || shape === "pill") {
    return "rounded-full border"
  }

  if (shape === "rectangle") {
    return "rounded-xl border"
  }

  return ""
}

function ShapeSvgSurface({
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

function ShapeSurface({
  shape,
  fill,
  stroke,
  text,
  className = "",
  children,
}: {
  shape: CanvasNodeShape
  fill: string
  stroke: string
  text: string
  className?: string
  children?: ReactNode
}) {
  const isSvgShape = isSvgNodeShape(shape)

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center ${getCssShapeClassName(shape)} ${className}`}
      style={{
        backgroundColor: isSvgShape ? "transparent" : fill,
        borderColor: isSvgShape ? "transparent" : stroke,
        color: text,
      }}
    >
      <ShapeSvgSurface shape={shape} fill={fill} stroke={stroke} />
      {children}
    </div>
  )
}

function isSameNodeColor(
  currentColor: CanvasNodeColor,
  nextColor: CanvasNodeColor
) {
  return currentColor.fill === nextColor.fill && currentColor.text === nextColor.text
}

function NodeColorToolbar({
  nodeId,
  currentColor,
  onSelectColor,
}: {
  nodeId: string
  currentColor: CanvasNodeColor
  onSelectColor: (nodeId: string, color: CanvasNodeColor) => void
}) {
  function stopToolbarInteraction(event: SyntheticEvent) {
    event.stopPropagation()
  }

  return (
    <div
      className="nodrag nopan absolute bottom-full left-1/2 z-30 mb-2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-surface-border bg-surface/95 p-1 shadow-lg backdrop-blur-md"
      onPointerDown={stopToolbarInteraction}
      onMouseDown={stopToolbarInteraction}
      onClick={stopToolbarInteraction}
      onDoubleClick={stopToolbarInteraction}
    >
      {colorOptions.map(({ label, color }) => {
        const isActive = isSameNodeColor(currentColor, color)
        const swatchStyle: CSSProperties & Record<"--swatch-glow", string> = {
          "--swatch-glow": color.text,
          backgroundColor: color.fill,
          borderColor: isActive ? color.text : "var(--border-subtle)",
          boxShadow: isActive ? `0 0 0 2px ${color.text}` : undefined,
          color: color.text,
        }

        return (
          <button
            key={color.fill}
            type="button"
            title={label}
            aria-label={`Apply ${label} node color`}
            aria-pressed={isActive}
            className="flex h-6 w-6 items-center justify-center rounded-full border transition-[box-shadow,transform,border-color] hover:scale-105 hover:shadow-[0_0_8px_var(--swatch-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            style={swatchStyle}
            onPointerDown={stopToolbarInteraction}
            onMouseDown={stopToolbarInteraction}
            onClick={(event) => {
              event.stopPropagation()
              onSelectColor(nodeId, color)
            }}
            onDoubleClick={stopToolbarInteraction}
          >
            <span className="sr-only">{label}</span>
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color.text }}
            />
          </button>
        )
      })}
    </div>
  )
}

function CanvasEdgeRenderer({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<CanvasEdge>) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data?.label ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const edgeActions = useContext(CanvasEdgeActionsContext)
  const label = data?.label ?? ""
  const hasLabel = label.trim().length > 0
  const isActive = !!selected || isHovered || isEditing
  const shouldShowLabel = isEditing || hasLabel || isActive
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    offset: 24,
  })
  const visibleEdgeStyle: CSSProperties = {
    stroke: isActive ? "var(--text-primary)" : "var(--text-secondary)",
    strokeOpacity: isActive ? 0.95 : 0.48,
    strokeWidth: 2,
  }
  const labelText = hasLabel ? label.trim() : EDGE_LABEL_HINT
  const inputCharacterCount = draftLabel.trim()
    ? draftLabel.length + 1
    : EDGE_LABEL_HINT.length + 1

  useEffect(() => {
    if (!isEditing) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  function startEditing(event: SyntheticEvent) {
    event.preventDefault()
    event.stopPropagation()
    setDraftLabel(label)
    setIsEditing(true)
  }

  function saveLabel() {
    edgeActions?.updateEdgeLabel(id, draftLabel.trim())
    setIsEditing(false)
  }

  function stopLabelInteraction(event: SyntheticEvent) {
    event.stopPropagation()
  }

  function handleLabelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    event.stopPropagation()

    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault()
      saveLabel()
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={EDGE_INTERACTION_WIDTH}
        className="transition-[stroke,stroke-opacity]"
        style={visibleEdgeStyle}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_INTERACTION_WIDTH}
        pointerEvents="stroke"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={startEditing}
      />
      {shouldShowLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              zIndex: isActive ? 30 : 20,
            }}
            onPointerDown={stopLabelInteraction}
            onMouseDown={stopLabelInteraction}
            onClick={stopLabelInteraction}
            onDoubleClick={startEditing}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={draftLabel}
                aria-label="Edit edge label"
                className="h-7 rounded-full border border-brand bg-elevated px-3 text-center text-xs font-medium text-copy-primary shadow-lg outline-none placeholder:text-copy-faint"
                style={{
                  width: `${Math.max(
                    7,
                    Math.min(28, inputCharacterCount)
                  )}ch`,
                }}
                onChange={(event) => setDraftLabel(event.target.value)}
                onBlur={saveLabel}
                onKeyDown={handleLabelKeyDown}
                onPointerDown={stopLabelInteraction}
                onMouseDown={stopLabelInteraction}
                onClick={stopLabelInteraction}
                onDoubleClick={stopLabelInteraction}
              />
            ) : (
              <button
                type="button"
                className={`max-w-56 truncate rounded-full border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur-md transition-[border-color,color,opacity] ${
                  hasLabel
                    ? "border-surface-border bg-elevated/95 text-copy-primary"
                    : "border-border-subtle bg-surface/80 text-copy-faint opacity-75"
                }`}
                onDoubleClick={startEditing}
              >
                {labelText}
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function CanvasNodeRenderer({
  id,
  data,
  isConnectable,
  selected,
}: NodeProps<CanvasNode>) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nodeActions = useContext(CanvasNodeActionsContext)
  const handleClassName =
    "!h-2 !w-2 !border !border-base !bg-copy-primary !opacity-0 transition-opacity group-hover:!opacity-100"
  const stroke = getNodeStroke(!!selected)
  const currentColor = data.color ?? DEFAULT_NODE_COLOR
  const label = data.label
  const labelText = label.trim() ? label : EMPTY_NODE_LABEL_PLACEHOLDER

  useEffect(() => {
    if (!isEditing) {
      return
    }

    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.focus()
    textarea.select()
  }, [isEditing])

  function handleLabelChange(event: ChangeEvent<HTMLTextAreaElement>) {
    nodeActions?.updateNodeLabel(id, event.target.value)
  }

  function handleLabelKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      setIsEditing(false)
      textareaRef.current?.blur()
    }
  }

  function stopTextInteraction(event: SyntheticEvent) {
    event.stopPropagation()
  }

  return (
    <ShapeSurface
      shape={data.shape}
      fill={currentColor.fill}
      stroke={stroke}
      text={currentColor.text}
      className="group min-h-12 min-w-20 text-center text-sm font-medium"
    >
      {selected ? (
        <NodeColorToolbar
          nodeId={id}
          currentColor={currentColor}
          onSelectColor={(nodeId, color) =>
            nodeActions?.updateNodeColor(nodeId, color)
          }
        />
      ) : null}
      <NodeResizer
        isVisible={!!selected}
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        color="var(--accent-primary)"
        handleStyle={{
          width: 8,
          height: 8,
          backgroundColor: "var(--bg-elevated)",
          border: "1px solid var(--accent-primary)",
        }}
        lineStyle={{
          borderColor: "var(--accent-primary)",
          opacity: 0.35,
        }}
      />
      <div
        className="relative z-10 flex h-full w-full items-center justify-center px-3 py-2"
        onDoubleClick={(event) => {
          event.stopPropagation()
          setIsEditing(true)
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={label}
            placeholder={EMPTY_NODE_LABEL_PLACEHOLDER}
            aria-label="Edit node label"
            className="nodrag nopan absolute left-3 right-3 top-1/2 h-10 -translate-y-1/2 resize-none overflow-hidden border-0 bg-transparent p-0 text-center text-sm font-medium leading-5 text-inherit outline-none placeholder:text-copy-faint"
            onChange={handleLabelChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleLabelKeyDown}
            onPointerDown={stopTextInteraction}
            onMouseDown={stopTextInteraction}
            onClick={stopTextInteraction}
            onDoubleClick={stopTextInteraction}
          />
        ) : (
          <span
            className={`w-full truncate ${
              label.trim() ? "" : "text-copy-faint"
            }`}
          >
            {labelText}
          </span>
        )}
      </div>
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
    </ShapeSurface>
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

function getCenteredCanvasNodePosition(
  screenToFlowPosition: ReactFlowInstance<
    CanvasNode,
    CanvasEdge
  >["screenToFlowPosition"],
  point: { x: number; y: number },
  size: CanvasNodeSize
) {
  const center = screenToFlowPosition(point)

  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
  } satisfies CanvasNode["position"]
}

function ShapePanel({
  activeShape,
  onSelectShape,
  onShapeDragStart,
  onShapeDragEnd,
}: {
  activeShape: CanvasNodeShape | null
  onSelectShape: (shape: CanvasNodeShape | null) => void
  onShapeDragStart: (
    payload: ShapeDragPayload,
    point: { x: number; y: number }
  ) => void
  onShapeDragEnd: () => void
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
    event.dataTransfer.setDragImage(document.createElement("canvas"), 0, 0)
    onShapeDragStart(payload, {
      x: event.clientX,
      y: event.clientY,
    })
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
            onClick={() => onSelectShape(activeShape === shape ? null : shape)}
            onDragStart={(event) => handleDragStart(event, shape)}
            onDragEnd={onShapeDragEnd}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </Button>
        ))}
      </div>
    </Panel>
  )
}

function ShapeDragPreview({ preview }: { preview: ShapeDragPreviewState }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 opacity-70"
      style={{
        width: preview.size.width,
        height: preview.size.height,
        transform: `translate(${preview.x - preview.size.width / 2}px, ${
          preview.y - preview.size.height / 2
        }px)`,
      }}
    >
      <ShapeSurface
        shape={preview.shape}
        fill={DEFAULT_NODE_COLOR.fill}
        stroke="var(--accent-primary)"
        text={DEFAULT_NODE_COLOR.text}
        className="shadow-lg"
      />
    </div>
  )
}

function getSaveStatusLabel(status: CanvasSaveStatus) {
  if (status === "idle") {
    return "Save"
  }

  if (status === "saving") {
    return "Saving"
  }

  if (status === "error") {
    return "Save"
  }

  return "Saved"
}

function SaveStatusIcon({ status }: { status: CanvasSaveStatus }) {
  if (status === "saving") {
    return (
      <LoaderCircle
        className="h-4 w-4 animate-spin"
        aria-hidden="true"
      />
    )
  }

  if (status === "error") {
    return <TriangleAlert className="h-4 w-4" aria-hidden="true" />
  }

  if (status === "saved") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
  }

  return <Save className="h-4 w-4" aria-hidden="true" />
}

function CanvasControlBar({
  reactFlowInstance,
  canUndo,
  canRedo,
  saveStatus,
  onSave,
  onUndo,
  onRedo,
}: {
  reactFlowInstance: ReactFlowInstance<CanvasNode, CanvasEdge>
  canUndo: boolean
  canRedo: boolean
  saveStatus: CanvasSaveStatus
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
}) {
  const controlButtonClassName =
    "h-8 w-8 rounded-full text-copy-secondary hover:bg-accent-dim hover:text-brand disabled:pointer-events-none disabled:opacity-35"
  const saveStatusClassName =
    saveStatus === "error"
      ? "text-state-error"
      : saveStatus === "saved"
        ? "text-state-success"
        : saveStatus === "idle"
          ? "text-copy-primary hover:text-brand"
          : "text-copy-secondary"
  const zoomOptions = { duration: 160 }
  const saveStatusLabel = getSaveStatusLabel(saveStatus)

  return (
    <Panel position="bottom-left" className="mb-6 ml-6">
      <div className="nodrag nopan flex items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          title={saveStatusLabel}
          aria-label={saveStatusLabel}
          disabled={saveStatus === "saving"}
          className={`h-8 rounded-full px-3 text-xs font-medium ${saveStatusClassName}`}
          onClick={onSave}
        >
          <SaveStatusIcon status={saveStatus} />
          <span>{saveStatusLabel}</span>
        </Button>
        <div className="mx-1 h-6 w-px bg-surface-border" />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Zoom out"
            aria-label="Zoom out"
            className={controlButtonClassName}
            onClick={() => void reactFlowInstance.zoomOut(zoomOptions)}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Fit view"
            aria-label="Fit view"
            className={controlButtonClassName}
            onClick={() => void reactFlowInstance.fitView(zoomOptions)}
          >
            <Scan className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Zoom in"
            aria-label="Zoom in"
            className={controlButtonClassName}
            onClick={() => void reactFlowInstance.zoomIn(zoomOptions)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mx-1 h-6 w-px bg-surface-border" />
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Undo"
            aria-label="Undo"
            disabled={!canUndo}
            className={controlButtonClassName}
            onClick={onUndo}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Redo"
            aria-label="Redo"
            disabled={!canRedo}
            className={controlButtonClassName}
            onClick={onRedo}
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function CollaboratorAvatar({
  participant,
}: {
  participant: CollaboratorPresence
}) {
  return (
    <div
      aria-label={participantLabel(participant)}
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base bg-subtle text-xs font-semibold text-copy-primary shadow-md ring-1 ring-surface-border"
      title={participantLabel(participant)}
    >
      {isSafeAvatarUrl(participant.avatar) ? (
        <span
          aria-hidden="true"
          className="block h-full w-full"
          style={{
            backgroundImage: `url(${participant.avatar})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center"
          style={{
            backgroundColor: participant.color,
            color: "var(--bg-base)",
          }}
        >
          {participantInitials(participant)}
        </span>
      )}
    </div>
  )
}

function CanvasPresenceGroup({
  currentUserId,
}: {
  currentUserId: string | null | undefined
}) {
  const others = useOthersMapped(
    (other) =>
      ({
        id: other.id,
        name: other.info.name,
        avatar: other.info.avatar,
        color: other.info.color,
      }) satisfies CollaboratorPresence,
    shallow
  )
  const collaborators = others.filter(
    ([, participant]) => participant.id !== currentUserId
  )
  const visibleCollaborators = collaborators.slice(0, MAX_VISIBLE_COLLABORATORS)
  const overflowCount = Math.max(
    0,
    collaborators.length - MAX_VISIBLE_COLLABORATORS
  )
  const hasCollaborators = collaborators.length > 0

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-surface-border bg-surface/90 px-2 py-1 shadow-lg backdrop-blur-md">
      {hasCollaborators ? (
        <>
          <div className="flex -space-x-2">
            {visibleCollaborators.map(([connectionId, participant]) => (
              <CollaboratorAvatar
                key={connectionId}
                participant={participant}
              />
            ))}
            {overflowCount > 0 ? (
              <div
                aria-label={`${overflowCount} more collaborators`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-base bg-elevated text-xs font-semibold text-copy-secondary shadow-md ring-1 ring-surface-border"
                title={`${overflowCount} more collaborators`}
              >
                +{overflowCount}
              </div>
            ) : null}
          </div>
          <div className="h-6 w-px bg-surface-border" aria-hidden="true" />
        </>
      ) : null}
      <CanvasUserButton
        userProfileProps={{ appearance: userProfileAppearance }}
      />
    </div>
  )
}

function CanvasLiveCursor({
  connectionId,
  currentUserId,
}: {
  connectionId: number
  currentUserId: string | null | undefined
}) {
  const participant = useOther(
    connectionId,
    (other) => ({
      id: other.id,
      name: other.info.name,
      color: other.info.color,
      cursor: other.presence.cursor,
    }),
    shallow
  )

  if (!participant.cursor || participant.id === currentUserId) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="absolute left-0 top-0 flex items-start gap-1"
      style={{
        transform: `translate(${participant.cursor.x}px, ${participant.cursor.y}px)`,
      }}
    >
      <svg
        className="h-4 w-4 shrink-0 drop-shadow"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M2 1.5L14 7L8.6 9.1L6.5 14.5L2 1.5Z"
          fill={participant.color}
          stroke="var(--bg-base)"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="mt-3 max-w-40 truncate rounded-xl px-2 py-1 text-xs font-medium text-base shadow-lg"
        style={{ backgroundColor: participant.color }}
      >
        {participantLabel(participant)}
      </span>
    </div>
  )
}

function CanvasLiveCursors({
  currentUserId,
}: {
  currentUserId: string | null | undefined
}) {
  const connectionIds = useOthersConnectionIds()

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {connectionIds.map((connectionId) => (
        <CanvasLiveCursor
          key={connectionId}
          connectionId={connectionId}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

function CanvasFlow({
  roomId,
  templateImportRequest,
}: {
  roomId: string
  templateImportRequest?: TemplateImportRequest | null
}) {
  const [activeShape, setActiveShape] =
    useState<CanvasNodeShape | null>(null)
  const [dragPreview, setDragPreview] =
    useState<ShapeDragPreviewState | null>(null)
  const [pendingFitNodeIds, setPendingFitNodeIds] =
    useState<string[] | null>(null)
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] =
    useState(false)
  const importedRequestIdRef = useRef<number | null>(null)
  const hasAttemptedSavedCanvasLoadRef = useRef(false)
  const latestCanvasStateRef = useRef<{
    nodes: CanvasNode[]
    edges: CanvasEdge[]
  }>({
    nodes: [],
    edges: [],
  })
  const isDraggingShape = dragPreview !== null
  const reactFlowInstance = useReactFlow<CanvasNode, CanvasEdge>()
  const { screenToFlowPosition } = reactFlowInstance
  const flowNodes = useNodes<CanvasNode>()
  const flowEdges = useEdges<CanvasEdge>()
  const selectedNodes = useMemo(
    () => flowNodes.filter((node) => node.selected),
    [flowNodes]
  )
  const selectedEdges = useMemo(
    () => flowEdges.filter((edge) => edge.selected),
    [flowEdges]
  )
  const undo = useUndo()
  const redo = useRedo()
  const room = useRoom()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const updateMyPresence = useUpdateMyPresence()
  const { userId: currentUserId } = useAuth()
  const { nodes, edges, onNodesChange, onEdgesChange, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({
      suspense: true,
      nodes: {
        initial: [],
      },
      edges: {
        initial: [],
      },
    })
  const normalizedEdges = useMemo(
    () => edges.map((edge) => normalizeCanvasEdge(edge)),
    [edges]
  )
  const { saveNow, status: saveStatus } = useCanvasAutosave({
    projectId: roomId,
    nodes,
    edges: normalizedEdges,
    enabled: hasCompletedInitialLoad,
  })
  const nodeActions = useMemo<CanvasNodeActions>(
    () => ({
      updateNodeLabel: (nodeId, label) => {
        const node = nodes.find((currentNode) => currentNode.id === nodeId)

        if (!node || node.data.label === label) {
          return
        }

        onNodesChange([
          {
            id: nodeId,
            type: "replace",
            item: {
              ...node,
              data: {
                ...node.data,
                label,
              },
            },
          },
        ])
      },
      updateNodeColor: (nodeId, color) => {
        const node = nodes.find((currentNode) => currentNode.id === nodeId)

        if (!node) {
          return
        }

        const currentColor = node.data.color ?? DEFAULT_NODE_COLOR

        if (isSameNodeColor(currentColor, color)) {
          return
        }

        onNodesChange([
          {
            id: nodeId,
            type: "replace",
            item: {
              ...node,
              data: {
                ...node.data,
                color,
              },
            },
          },
        ])
      },
    }),
    [nodes, onNodesChange]
  )
  const edgeActions = useMemo<CanvasEdgeActions>(
    () => ({
      updateEdgeLabel: (edgeId, label) => {
        const edge = edges.find((currentEdge) => currentEdge.id === edgeId)

        if (!edge) {
          return
        }

        const currentLabel = edge.data?.label ?? ""

        if (currentLabel === label) {
          return
        }

        onEdgesChange([
          {
            id: edgeId,
            type: "replace",
            item: {
              ...normalizeCanvasEdge(edge),
              data: {
                ...edge.data,
                label,
              },
            },
          },
        ])
      },
    }),
    [edges, onEdgesChange]
  )
  const handleUndo = useMemo(
    () => () => {
      if (canUndo) {
        undo()
      }
    },
    [canUndo, undo]
  )
  const handleRedo = useMemo(
    () => () => {
      if (canRedo) {
        redo()
      }
    },
    [canRedo, redo]
  )

  function importCanvasTemplate(template: CanvasTemplate) {
    room.batch(() => {
      onDelete({ nodes, edges })
      onNodesChange(
        template.nodes.map((node, index) => ({
          type: "add" as const,
          item: cloneTemplateNode(node),
          index,
        }))
      )
      onEdgesChange(
        template.edges.map((edge, index) => ({
          type: "add" as const,
          item: cloneTemplateEdge(edge),
          index,
        }))
      )
    })
    setActiveShape(null)
    setDragPreview(null)
    setPendingFitNodeIds(template.nodes.map((node) => node.id))
  }

  const loadCanvasSnapshot = useCallback((snapshot: CanvasSnapshot) => {
    room.batch(() => {
      onNodesChange(
        snapshot.nodes.map((node, index) => ({
          type: "add" as const,
          item: cloneTemplateNode(node),
          index,
        }))
      )
      onEdgesChange(
        snapshot.edges.map((edge, index) => ({
          type: "add" as const,
          item: normalizeCanvasEdge(cloneTemplateEdge(edge)),
          index,
        }))
      )
    })
  }, [onEdgesChange, onNodesChange, room])

  useKeyboardShortcuts({
    reactFlowInstance,
    onUndo: handleUndo,
    onRedo: handleRedo,
  })

  useEffect(() => {
    latestCanvasStateRef.current = {
      nodes,
      edges,
    }
  }, [edges, nodes])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.key !== "Delete" &&
        event.key !== "Backspace"
      ) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (selectedNodes.length === 0 && selectedEdges.length === 0) {
        return
      }

      event.preventDefault()
      onDelete({ nodes: selectedNodes, edges: selectedEdges })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onDelete, selectedEdges, selectedNodes])

  useEffect(() => {
    if (hasAttemptedSavedCanvasLoadRef.current) {
      return
    }

    hasAttemptedSavedCanvasLoadRef.current = true

    let isCancelled = false

    if (nodes.length > 0 || edges.length > 0) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setHasCompletedInitialLoad(true)
        }
      })

      return () => {
        isCancelled = true
      }
    }

    async function loadSavedCanvas() {
      try {
        const response = await fetch(`/api/projects/${roomId}/canvas`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Saved canvas load failed.")
        }

        const body = (await response.json()) as {
          canvas?: CanvasSnapshot | null
        }

        if (isCancelled || !body.canvas) {
          return
        }

        const currentCanvas = latestCanvasStateRef.current

        if (currentCanvas.nodes.length > 0 || currentCanvas.edges.length > 0) {
          return
        }

        loadCanvasSnapshot(body.canvas)
      } catch (error) {
        console.error("Saved canvas load failed.", error)
      } finally {
        if (!isCancelled) {
          setHasCompletedInitialLoad(true)
        }
      }
    }

    void loadSavedCanvas()

    return () => {
      isCancelled = true
    }
  }, [edges.length, loadCanvasSnapshot, nodes.length, roomId])

  useEffect(() => {
    return () => {
      updateMyPresence({ cursor: null })
    }
  }, [updateMyPresence])

  useEffect(() => {
    if (
      !templateImportRequest ||
      importedRequestIdRef.current === templateImportRequest.requestId
    ) {
      return
    }

    importedRequestIdRef.current = templateImportRequest.requestId
    importCanvasTemplate(templateImportRequest.template)
  })

  useEffect(() => {
    if (!pendingFitNodeIds) {
      return
    }

    const nodeIds = new Set(nodes.map((node) => node.id))
    const importedNodesReady = pendingFitNodeIds.every((nodeId) =>
      nodeIds.has(nodeId)
    )

    if (!importedNodesReady) {
      return
    }

    const animationFrame = requestAnimationFrame(() => {
      void reactFlowInstance.fitView({ duration: 180, padding: 0.18 })
      setPendingFitNodeIds(null)
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [nodes, pendingFitNodeIds, reactFlowInstance])

  useEffect(() => {
    if (!isDraggingShape) {
      return
    }

    function handleWindowDragOver(event: globalThis.DragEvent) {
      setDragPreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              x: event.clientX,
              y: event.clientY,
            }
          : null
      )
    }

    function clearDragPreview() {
      setDragPreview(null)
    }

    window.addEventListener("dragover", handleWindowDragOver)
    window.addEventListener("drop", clearDragPreview)
    window.addEventListener("dragend", clearDragPreview)

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver)
      window.removeEventListener("drop", clearDragPreview)
      window.removeEventListener("dragend", clearDragPreview)
    }
  }, [isDraggingShape])

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

    const position = getCenteredCanvasNodePosition(
      screenToFlowPosition,
      {
        x: event.clientX,
        y: event.clientY,
      },
      payload.size
    )

    const newNode = createCanvasNode(payload.shape, position, payload.size)

    onNodesChange([{ type: "add", item: newNode }])
    setActiveShape(null)
    setDragPreview(null)
  }

  function handleConnect(connection: Connection) {
    if (edges.some((edge) => hasSameConnection(edge, connection))) {
      return
    }

    onEdgesChange([{ type: "add", item: createCanvasEdge(connection) }])
  }

  function handlePaneClick(event: MouseEvent) {
    if (!activeShape) {
      return
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = createCanvasNode(activeShape, position)

    onNodesChange([{ type: "add", item: newNode }])
    setActiveShape(null)
  }

  function handleCanvasMouseMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()

    updateMyPresence({
      cursor: {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
    })
  }

  function handleCanvasMouseLeave() {
    updateMyPresence({ cursor: null })
  }

  return (
    <CanvasNodeActionsContext.Provider value={nodeActions}>
      <CanvasEdgeActionsContext.Provider value={edgeActions}>
        <div className="relative h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={normalizedEdges}
            nodeTypes={canvasNodeTypes}
            edgeTypes={canvasEdgeTypes}
            defaultEdgeOptions={defaultCanvasEdgeOptions}
            defaultMarkerColor="var(--text-primary)"
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{
              stroke: "var(--text-secondary)",
              strokeWidth: 2,
              strokeLinecap: "round",
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onDelete={onDelete}
            deleteKeyCode={null}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onPaneClick={handlePaneClick}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-base text-copy-primary"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--border-subtle)"
              bgColor="var(--bg-base)"
            />
            <CanvasControlBar
              reactFlowInstance={reactFlowInstance}
              canUndo={canUndo}
              canRedo={canRedo}
              saveStatus={saveStatus}
              onSave={saveNow}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            <ShapePanel
              activeShape={activeShape}
              onSelectShape={setActiveShape}
              onShapeDragStart={(payload, point) =>
                setDragPreview({ ...payload, ...point })
              }
              onShapeDragEnd={() => setDragPreview(null)}
            />
          </ReactFlow>
          <CanvasLiveCursors currentUserId={currentUserId} />
          <CanvasPresenceGroup currentUserId={currentUserId} />
        </div>
      </CanvasEdgeActionsContext.Provider>
      {dragPreview ? <ShapeDragPreview preview={dragPreview} /> : null}
    </CanvasNodeActionsContext.Provider>
  )
}

export function CanvasWorkspace({
  roomId,
  templateImportRequest,
}: CanvasWorkspaceProps) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <CanvasErrorBoundary key={roomId}>
        <RoomProvider
          id={roomId}
          initialPresence={{
            cursor: null,
            thinking: false,
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
              <CanvasFlow
                roomId={roomId}
                templateImportRequest={templateImportRequest}
              />
            </ReactFlowProvider>
          </ClientSideSuspense>
        </RoomProvider>
      </CanvasErrorBoundary>
    </LiveblocksProvider>
  )
}
