"use client"

import { Download } from "lucide-react"

import {
  CANVAS_TEMPLATES,
  type CanvasTemplate,
} from "@/components/editor/starter-templates"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type CanvasNode } from "@/types/canvas"

interface StarterTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (template: CanvasTemplate) => void
}

interface PreviewBounds {
  minX: number
  minY: number
  width: number
  height: number
}

interface PreviewTransform {
  scale: number
  offsetX: number
  offsetY: number
  bounds: PreviewBounds
}

const PREVIEW_WIDTH = 320
const PREVIEW_HEIGHT = 150
const PREVIEW_PADDING = 18

function getNodeSize(node: CanvasNode) {
  return {
    width: node.width ?? node.initialWidth ?? 120,
    height: node.height ?? node.initialHeight ?? 72,
  }
}

function getPreviewBounds(nodes: CanvasNode[]): PreviewBounds {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
    }
  }

  const bounds = nodes.reduce(
    (currentBounds, node) => {
      const size = getNodeSize(node)

      return {
        minX: Math.min(currentBounds.minX, node.position.x),
        minY: Math.min(currentBounds.minY, node.position.y),
        maxX: Math.max(currentBounds.maxX, node.position.x + size.width),
        maxY: Math.max(currentBounds.maxY, node.position.y + size.height),
      }
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  )

  return {
    minX: bounds.minX,
    minY: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  }
}

function getPreviewTransform(nodes: CanvasNode[]): PreviewTransform {
  const bounds = getPreviewBounds(nodes)
  const scale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / bounds.width,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / bounds.height
  )
  const scaledWidth = bounds.width * scale
  const scaledHeight = bounds.height * scale

  return {
    scale,
    offsetX: (PREVIEW_WIDTH - scaledWidth) / 2,
    offsetY: (PREVIEW_HEIGHT - scaledHeight) / 2,
    bounds,
  }
}

function projectPoint(
  x: number,
  y: number,
  { bounds, scale, offsetX, offsetY }: PreviewTransform
) {
  return {
    x: (x - bounds.minX) * scale + offsetX,
    y: (y - bounds.minY) * scale + offsetY,
  }
}

function getNodePreviewBox(node: CanvasNode, transform: PreviewTransform) {
  const size = getNodeSize(node)
  const point = projectPoint(node.position.x, node.position.y, transform)

  return {
    x: point.x,
    y: point.y,
    width: size.width * transform.scale,
    height: size.height * transform.scale,
  }
}

function getNodeCenter(node: CanvasNode, transform: PreviewTransform) {
  const size = getNodeSize(node)

  return projectPoint(
    node.position.x + size.width / 2,
    node.position.y + size.height / 2,
    transform
  )
}

function PreviewNode({
  node,
  transform,
}: {
  node: CanvasNode
  transform: PreviewTransform
}) {
  const box = getNodePreviewBox(node, transform)
  const color = node.data.color
  const stroke = color.text

  if (node.data.shape === "circle") {
    return (
      <ellipse
        cx={box.x + box.width / 2}
        cy={box.y + box.height / 2}
        rx={box.width / 2}
        ry={box.height / 2}
        fill={color.fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
    )
  }

  if (node.data.shape === "pill") {
    return (
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={box.height / 2}
        fill={color.fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
    )
  }

  if (node.data.shape === "diamond") {
    return (
      <polygon
        points={`${box.x + box.width / 2},${box.y} ${box.x + box.width},${
          box.y + box.height / 2
        } ${box.x + box.width / 2},${box.y + box.height} ${box.x},${
          box.y + box.height / 2
        }`}
        fill={color.fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
    )
  }

  if (node.data.shape === "hexagon") {
    return (
      <polygon
        points={`${box.x + box.width * 0.24},${box.y} ${
          box.x + box.width * 0.76
        },${box.y} ${box.x + box.width},${box.y + box.height / 2} ${
          box.x + box.width * 0.76
        },${box.y + box.height} ${box.x + box.width * 0.24},${
          box.y + box.height
        } ${box.x},${box.y + box.height / 2}`}
        fill={color.fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
    )
  }

  if (node.data.shape === "cylinder") {
    const ellipseHeight = Math.min(16, box.height * 0.28)

    return (
      <g>
        <path
          d={`M${box.x} ${box.y + ellipseHeight / 2} C${box.x} ${box.y} ${
            box.x + box.width
          } ${box.y} ${box.x + box.width} ${
            box.y + ellipseHeight / 2
          } L${box.x + box.width} ${box.y + box.height - ellipseHeight / 2} C${
            box.x + box.width
          } ${box.y + box.height} ${box.x} ${box.y + box.height} ${box.x} ${
            box.y + box.height - ellipseHeight / 2
          } Z`}
          fill={color.fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <ellipse
          cx={box.x + box.width / 2}
          cy={box.y + ellipseHeight / 2}
          rx={box.width / 2}
          ry={ellipseHeight / 2}
          fill={color.fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
      </g>
    )
  }

  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rx="6"
      fill={color.fill}
      stroke={stroke}
      strokeWidth="1.5"
    />
  )
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const transform = getPreviewTransform(template.nodes)
  const nodeById = new Map(template.nodes.map((node) => [node.id, node]))

  return (
    <svg
      role="img"
      aria-label={`${template.name} preview`}
      viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
      className="h-full w-full"
    >
      <rect
        x="0"
        y="0"
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        rx="14"
        fill="var(--bg-base)"
      />
      {template.edges.map((edge) => {
        const sourceNode = nodeById.get(edge.source)
        const targetNode = nodeById.get(edge.target)

        if (!sourceNode || !targetNode) {
          return null
        }

        const source = getNodeCenter(sourceNode, transform)
        const target = getNodeCenter(targetNode, transform)

        return (
          <line
            key={edge.id}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke="var(--text-secondary)"
            strokeOpacity="0.58"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
      {template.nodes.map((node) => (
        <g key={node.id}>
          <title>{node.data.label}</title>
          <PreviewNode node={node} transform={transform} />
        </g>
      ))}
    </svg>
  )
}

export function StarterTemplatesModal({
  open,
  onOpenChange,
  onImport,
}: StarterTemplatesModalProps) {
  function handleImport(template: CanvasTemplate) {
    onImport(template)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(46rem,calc(100vh-2rem))] gap-5 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Starter Templates</DialogTitle>
          <DialogDescription>
            Replace the current canvas with a prebuilt system diagram.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mr-2 max-h-[min(34rem,calc(100vh-10rem))] pr-2">
          <div className="grid gap-3 md:grid-cols-3">
            {CANVAS_TEMPLATES.map((template) => (
              <article
                key={template.id}
                className="grid min-h-0 gap-3 rounded-2xl border border-surface-border bg-surface p-3"
              >
                <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border-subtle bg-base">
                  <TemplatePreview template={template} />
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-copy-primary">
                    {template.name}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-5 text-copy-muted">
                    {template.description}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-auto"
                  onClick={() => handleImport(template)}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Import
                </Button>
              </article>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
