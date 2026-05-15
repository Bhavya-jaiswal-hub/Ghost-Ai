import {
  CANVAS_EDGE_TYPE,
  DEFAULT_NODE_SIZES,
  NODE_COLORS,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeColor,
  type CanvasNodeShape,
} from "@/types/canvas"

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

interface TemplateNodeConfig {
  id: string
  label: string
  shape: CanvasNodeShape
  position: CanvasNode["position"]
  color: CanvasNodeColor
  size?: {
    width: number
    height: number
  }
}

interface TemplateEdgeConfig {
  id: string
  source: string
  target: string
  label?: string
  sourceHandle?: string
  targetHandle?: string
}

function templateNode({
  id,
  label,
  shape,
  position,
  color,
  size = DEFAULT_NODE_SIZES[shape],
}: TemplateNodeConfig) {
  return {
    id,
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
      label,
      color,
      shape,
    },
  } satisfies CanvasNode
}

function templateEdge({
  id,
  source,
  target,
  label = "",
  sourceHandle = "right",
  targetHandle = "left",
}: TemplateEdgeConfig) {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: CANVAS_EDGE_TYPE,
    data: {
      label,
    },
  } satisfies CanvasEdge
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices-commerce",
    name: "Microservices Commerce",
    description:
      "API gateway, service boundaries, shared messaging, and separate stores for a transactional commerce system.",
    nodes: [
      templateNode({
        id: "ms-client",
        label: "Client App",
        shape: "circle",
        position: { x: 0, y: 120 },
        color: NODE_COLORS[6],
      }),
      templateNode({
        id: "ms-gateway",
        label: "API Gateway",
        shape: "hexagon",
        position: { x: 180, y: 118 },
        color: NODE_COLORS[7],
      }),
      templateNode({
        id: "ms-auth",
        label: "Auth Service",
        shape: "pill",
        position: { x: 390, y: 20 },
        color: NODE_COLORS[1],
      }),
      templateNode({
        id: "ms-orders",
        label: "Orders Service",
        shape: "pill",
        position: { x: 390, y: 118 },
        color: NODE_COLORS[2],
      }),
      templateNode({
        id: "ms-payments",
        label: "Payments Service",
        shape: "pill",
        position: { x: 390, y: 216 },
        color: NODE_COLORS[3],
      }),
      templateNode({
        id: "ms-bus",
        label: "Event Bus",
        shape: "diamond",
        position: { x: 620, y: 80 },
        color: NODE_COLORS[5],
        size: { width: 116, height: 116 },
      }),
      templateNode({
        id: "ms-order-db",
        label: "Orders DB",
        shape: "cylinder",
        position: { x: 620, y: 230 },
        color: NODE_COLORS[4],
      }),
      templateNode({
        id: "ms-search",
        label: "Search Index",
        shape: "cylinder",
        position: { x: 820, y: 96 },
        color: NODE_COLORS[0],
      }),
    ],
    edges: [
      templateEdge({ id: "ms-e1", source: "ms-client", target: "ms-gateway" }),
      templateEdge({ id: "ms-e2", source: "ms-gateway", target: "ms-auth" }),
      templateEdge({ id: "ms-e3", source: "ms-gateway", target: "ms-orders" }),
      templateEdge({
        id: "ms-e4",
        source: "ms-gateway",
        target: "ms-payments",
      }),
      templateEdge({
        id: "ms-e5",
        source: "ms-orders",
        target: "ms-bus",
        label: "publish",
      }),
      templateEdge({
        id: "ms-e6",
        source: "ms-payments",
        target: "ms-bus",
        label: "events",
      }),
      templateEdge({
        id: "ms-e7",
        source: "ms-orders",
        target: "ms-order-db",
        sourceHandle: "bottom",
        targetHandle: "top",
      }),
      templateEdge({ id: "ms-e8", source: "ms-bus", target: "ms-search" }),
    ],
  },
  {
    id: "ci-cd-pipeline",
    name: "CI/CD Pipeline",
    description:
      "Commit-triggered build, test, scan, artifact, and staged deployment flow for a delivery platform.",
    nodes: [
      templateNode({
        id: "ci-repo",
        label: "Git Repo",
        shape: "cylinder",
        position: { x: 0, y: 110 },
        color: NODE_COLORS[1],
      }),
      templateNode({
        id: "ci-runner",
        label: "CI Runner",
        shape: "hexagon",
        position: { x: 200, y: 106 },
        color: NODE_COLORS[7],
      }),
      templateNode({
        id: "ci-build",
        label: "Build",
        shape: "pill",
        position: { x: 420, y: 30 },
        color: NODE_COLORS[2],
      }),
      templateNode({
        id: "ci-test",
        label: "Test Suite",
        shape: "pill",
        position: { x: 420, y: 125 },
        color: NODE_COLORS[6],
      }),
      templateNode({
        id: "ci-scan",
        label: "Security Gate",
        shape: "diamond",
        position: { x: 440, y: 226 },
        color: NODE_COLORS[3],
        size: { width: 120, height: 120 },
      }),
      templateNode({
        id: "ci-registry",
        label: "Artifact Registry",
        shape: "cylinder",
        position: { x: 660, y: 105 },
        color: NODE_COLORS[5],
        size: { width: 164, height: 92 },
      }),
      templateNode({
        id: "ci-deploy",
        label: "Deploy Job",
        shape: "pill",
        position: { x: 890, y: 114 },
        color: NODE_COLORS[4],
      }),
      templateNode({
        id: "ci-cluster",
        label: "Runtime Cluster",
        shape: "hexagon",
        position: { x: 1110, y: 105 },
        color: NODE_COLORS[0],
        size: { width: 168, height: 104 },
      }),
    ],
    edges: [
      templateEdge({ id: "ci-e1", source: "ci-repo", target: "ci-runner" }),
      templateEdge({ id: "ci-e2", source: "ci-runner", target: "ci-build" }),
      templateEdge({ id: "ci-e3", source: "ci-runner", target: "ci-test" }),
      templateEdge({ id: "ci-e4", source: "ci-runner", target: "ci-scan" }),
      templateEdge({
        id: "ci-e5",
        source: "ci-build",
        target: "ci-registry",
        label: "image",
      }),
      templateEdge({
        id: "ci-e6",
        source: "ci-test",
        target: "ci-registry",
        label: "pass",
      }),
      templateEdge({
        id: "ci-e7",
        source: "ci-scan",
        target: "ci-registry",
        label: "approve",
      }),
      templateEdge({ id: "ci-e8", source: "ci-registry", target: "ci-deploy" }),
      templateEdge({ id: "ci-e9", source: "ci-deploy", target: "ci-cluster" }),
    ],
  },
  {
    id: "event-driven-orders",
    name: "Event-Driven Orders",
    description:
      "Command intake, broker fan-out, async workers, and analytical storage for an event-driven backend.",
    nodes: [
      templateNode({
        id: "ev-web",
        label: "Web Client",
        shape: "circle",
        position: { x: 0, y: 125 },
        color: NODE_COLORS[6],
      }),
      templateNode({
        id: "ev-api",
        label: "Command API",
        shape: "hexagon",
        position: { x: 180, y: 118 },
        color: NODE_COLORS[7],
      }),
      templateNode({
        id: "ev-orders",
        label: "Order Service",
        shape: "pill",
        position: { x: 390, y: 118 },
        color: NODE_COLORS[2],
      }),
      templateNode({
        id: "ev-store",
        label: "Event Store",
        shape: "cylinder",
        position: { x: 610, y: 20 },
        color: NODE_COLORS[1],
      }),
      templateNode({
        id: "ev-broker",
        label: "Message Broker",
        shape: "diamond",
        position: { x: 630, y: 155 },
        color: NODE_COLORS[5],
        size: { width: 128, height: 128 },
      }),
      templateNode({
        id: "ev-inventory",
        label: "Inventory Worker",
        shape: "pill",
        position: { x: 870, y: 35 },
        color: NODE_COLORS[3],
      }),
      templateNode({
        id: "ev-email",
        label: "Email Worker",
        shape: "pill",
        position: { x: 870, y: 155 },
        color: NODE_COLORS[4],
      }),
      templateNode({
        id: "ev-warehouse",
        label: "Analytics Store",
        shape: "cylinder",
        position: { x: 870, y: 275 },
        color: NODE_COLORS[0],
        size: { width: 164, height: 92 },
      }),
    ],
    edges: [
      templateEdge({ id: "ev-e1", source: "ev-web", target: "ev-api" }),
      templateEdge({ id: "ev-e2", source: "ev-api", target: "ev-orders" }),
      templateEdge({
        id: "ev-e3",
        source: "ev-orders",
        target: "ev-store",
        sourceHandle: "right",
        targetHandle: "left",
      }),
      templateEdge({
        id: "ev-e4",
        source: "ev-orders",
        target: "ev-broker",
        label: "emit",
      }),
      templateEdge({ id: "ev-e5", source: "ev-broker", target: "ev-inventory" }),
      templateEdge({ id: "ev-e6", source: "ev-broker", target: "ev-email" }),
      templateEdge({
        id: "ev-e7",
        source: "ev-broker",
        target: "ev-warehouse",
      }),
    ],
  },
]
