import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { mutateFlow } from "@liveblocks/react-flow/node";
import { logger, task } from "@trigger.dev/sdk";
import { generateObject, jsonSchema } from "ai";

import type { AiStatusEvent } from "@/liveblocks.config";
import { getLiveblocksClient } from "@/lib/liveblocks";
import {
  CANVAS_EDGE_TYPE,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZES,
  NODE_COLORS,
  NODE_SHAPES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeColor,
  type CanvasNodeShape,
} from "@/types/canvas";
import {
  AI_CHAT_FEED_ID,
  AI_STATUS_FEED_ID,
  type AiChatFeedMessage,
  type AiStatus,
  type AiStatusFeedMessage,
} from "@/types/tasks";

export interface DesignAgentPayload {
  prompt: string;
  roomId: string;
}

interface AddNodeAction {
  type: "addNode";
  id?: string;
  label: string;
  shape: CanvasNodeShape;
  x: number;
  y: number;
  width?: number;
  height?: number;
  colorIndex?: number;
}

interface MoveNodeAction {
  type: "moveNode";
  nodeId: string;
  x: number;
  y: number;
}

interface ResizeNodeAction {
  type: "resizeNode";
  nodeId: string;
  width: number;
  height: number;
}

interface UpdateNodeDataAction {
  type: "updateNodeData";
  nodeId: string;
  label?: string;
  shape?: CanvasNodeShape;
  colorIndex?: number;
}

interface DeleteNodeAction {
  type: "deleteNode";
  nodeId: string;
}

interface AddEdgeAction {
  type: "addEdge";
  id?: string;
  source: string;
  target: string;
  label?: string;
}

interface DeleteEdgeAction {
  type: "deleteEdge";
  edgeId: string;
}

type DesignAction =
  | AddNodeAction
  | MoveNodeAction
  | ResizeNodeAction
  | UpdateNodeDataAction
  | DeleteNodeAction
  | AddEdgeAction
  | DeleteEdgeAction;

interface DesignAgentPlan {
  summary: string;
  actions: DesignAction[];
}

const AI_USER_ID = "ghost-ai-agent";
const AI_USER_INFO = {
  name: "Ghost AI",
  avatar: "",
  color: "#8b82ff",
};
const AI_PRESENCE_TTL_SECONDS = 300;
const MIN_NODE_WIDTH = 80;
const MIN_NODE_HEIGHT = 48;
const MAX_NODE_WIDTH = 360;
const MAX_NODE_HEIGHT = 240;
const MAX_ACTIONS = 36;
const GENERATED_NODE_LAYER_X_POSITIONS = [0, 250, 550, 900] as const;
const GENERATED_NODE_ROW_GAP = 170;
const GENERATED_NODE_EXISTING_GAP = 260;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ACCESS_DENIED_MESSAGE =
  "Gemini access is denied for the configured API key project.";

interface GeminiApiKeyConfig {
  source: "GEMINI_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY" | "GOOGLE_AI_API_KEY";
  value: string;
  fingerprint: string;
}

const designPlanSchema = jsonSchema<DesignAgentPlan>({
  type: "object",
  additionalProperties: false,
  required: ["summary", "actions"],
  properties: {
    summary: {
      type: "string",
      description: "Short explanation of the canvas update.",
    },
    actions: {
      type: "array",
      maxItems: MAX_ACTIONS,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "label", "shape", "x", "y"],
            properties: {
              type: { const: "addNode" },
              id: { type: "string" },
              label: { type: "string" },
              shape: { enum: [...NODE_SHAPES] },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              colorIndex: {
                type: "integer",
                minimum: 0,
                maximum: NODE_COLORS.length - 1,
              },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "nodeId", "x", "y"],
            properties: {
              type: { const: "moveNode" },
              nodeId: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "nodeId", "width", "height"],
            properties: {
              type: { const: "resizeNode" },
              nodeId: { type: "string" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "nodeId"],
            properties: {
              type: { const: "updateNodeData" },
              nodeId: { type: "string" },
              label: { type: "string" },
              shape: { enum: [...NODE_SHAPES] },
              colorIndex: {
                type: "integer",
                minimum: 0,
                maximum: NODE_COLORS.length - 1,
              },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "nodeId"],
            properties: {
              type: { const: "deleteNode" },
              nodeId: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "source", "target"],
            properties: {
              type: { const: "addEdge" },
              id: { type: "string" },
              source: { type: "string" },
              target: { type: "string" },
              label: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "edgeId"],
            properties: {
              type: { const: "deleteEdge" },
              edgeId: { type: "string" },
            },
          },
        ],
      },
    },
  },
});

function isCanvasNodeShape(value: string): value is CanvasNodeShape {
  return (NODE_SHAPES as readonly string[]).includes(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeDimension(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(clampNumber(value, min, max));
}

function sanitizeCoordinate(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(clampNumber(value, -4000, 4000));
}

function sanitizeLabel(label: string | undefined, fallback: string) {
  const trimmedLabel = label?.trim();

  if (!trimmedLabel) {
    return fallback;
  }

  return trimmedLabel.slice(0, 80);
}

function sanitizeNodeId(rawId: string | undefined, label: string) {
  const source = rawId?.trim() || label;
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return `ai-${slug || "node"}-${crypto.randomUUID()}`;
}

function sanitizeEdgeId(rawId: string | undefined, source: string, target: string) {
  const sourceId = rawId?.trim();

  if (sourceId) {
    return `ai-edge-${sourceId.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${crypto.randomUUID()}`;
  }

  return `ai-edge-${source}-${target}-${crypto.randomUUID()}`;
}

function getNodeColor(colorIndex: number | undefined): CanvasNodeColor {
  if (
    typeof colorIndex === "number" &&
    Number.isInteger(colorIndex) &&
    NODE_COLORS[colorIndex]
  ) {
    return NODE_COLORS[colorIndex];
  }

  return DEFAULT_NODE_COLOR;
}

function createCanvasNode(action: AddNodeAction): CanvasNode {
  const label = sanitizeLabel(action.label, "Untitled node");
  const shape = isCanvasNodeShape(action.shape) ? action.shape : "rectangle";
  const defaultSize = DEFAULT_NODE_SIZES[shape];
  const width = sanitizeDimension(
    action.width,
    defaultSize.width,
    MIN_NODE_WIDTH,
    MAX_NODE_WIDTH
  );
  const height = sanitizeDimension(
    action.height,
    defaultSize.height,
    MIN_NODE_HEIGHT,
    MAX_NODE_HEIGHT
  );

  return {
    id: sanitizeNodeId(action.id, label),
    type: shape,
    position: {
      x: sanitizeCoordinate(action.x),
      y: sanitizeCoordinate(action.y),
    },
    width,
    height,
    initialWidth: width,
    initialHeight: height,
    style: {
      width,
      height,
    },
    data: {
      label,
      color: getNodeColor(action.colorIndex),
      shape,
    },
  };
}

function createCanvasEdge(action: AddEdgeAction): CanvasEdge {
  return {
    id: sanitizeEdgeId(action.id, action.source, action.target),
    source: action.source,
    target: action.target,
    type: CANVAS_EDGE_TYPE,
    data: {
      label: sanitizeLabel(action.label, ""),
    },
    markerEnd: {
      type: "arrowclosed",
      color: "var(--text-primary)",
      width: 18,
      height: 18,
    },
    interactionWidth: 28,
  };
}

function getActionReferenceId(action: AddNodeAction) {
  return action.id?.trim() || action.label.trim();
}

function getNodeRightEdge(node: CanvasNode) {
  const width =
    typeof node.width === "number"
      ? node.width
      : typeof node.style?.width === "number"
        ? node.style.width
        : DEFAULT_NODE_SIZES[node.data.shape].width;

  return node.position.x + width;
}

function getCanvasLayoutOrigin(snapshot: {
  nodes: readonly CanvasNode[];
}) {
  if (snapshot.nodes.length === 0) {
    return { x: 0, y: 0 };
  }

  const maxRightEdge = Math.max(...snapshot.nodes.map(getNodeRightEdge));
  const averageY =
    snapshot.nodes.reduce((total, node) => total + node.position.y, 0) /
    snapshot.nodes.length;

  return {
    x: Math.round(maxRightEdge + GENERATED_NODE_EXISTING_GAP),
    y: Math.round(averageY),
  };
}

function getGeneratedNodeLayer(action: AddNodeAction) {
  const label = action.label.toLowerCase();

  if (
    /\b(client|browser|user|mobile|web|frontend|ui|app|consumer)\b/.test(label)
  ) {
    return 0;
  }

  if (
    /\b(gateway|api|edge|cdn|proxy|load balancer|ingress|auth|firewall)\b/.test(
      label
    ) ||
    action.shape === "diamond"
  ) {
    return 1;
  }

  if (
    /\b(database|db|postgres|mysql|mongo|redis|cache|storage|blob|bucket|warehouse|lake|search|index)\b/.test(
      label
    ) ||
    action.shape === "cylinder"
  ) {
    return 3;
  }

  return 2;
}

function getClampedGeneratedNodeLayer(layer: number) {
  return clampNumber(
    Math.round(layer),
    0,
    GENERATED_NODE_LAYER_X_POSITIONS.length - 1
  );
}

function createGeneratedNodeLayout(
  actions: readonly DesignAction[],
  snapshot: { nodes: readonly CanvasNode[] }
) {
  const addActions = actions.filter(
    (action): action is AddNodeAction => action.type === "addNode"
  );

  if (addActions.length === 0) {
    return new Map<string, { x: number; y: number }>();
  }

  const origin = getCanvasLayoutOrigin(snapshot);
  const generatedNodeIds = new Set(addActions.map(getActionReferenceId));
  const tiers = new Map<string, number>();

  for (const action of addActions) {
    tiers.set(
      getActionReferenceId(action),
      getClampedGeneratedNodeLayer(getGeneratedNodeLayer(action))
    );
  }

  for (let pass = 0; pass < addActions.length * 2; pass += 1) {
    let changed = false;

    for (const action of actions) {
      if (action.type !== "addEdge") {
        continue;
      }

      if (!generatedNodeIds.has(action.source) || !generatedNodeIds.has(action.target)) {
        continue;
      }

      const sourceTier = tiers.get(action.source);
      const targetTier = tiers.get(action.target);

      if (sourceTier === undefined || targetTier === undefined) {
        continue;
      }

      const maxTier = GENERATED_NODE_LAYER_X_POSITIONS.length - 1;
      let nextSourceTier = sourceTier;
      let nextTargetTier = targetTier;

      if (targetTier <= sourceTier) {
        if (sourceTier < maxTier) {
          nextTargetTier = sourceTier + 1;
        } else {
          nextSourceTier = maxTier - 1;
          nextTargetTier = maxTier;
        }
      } else if (targetTier - sourceTier > 1) {
        nextTargetTier = sourceTier + 1;
      }

      nextSourceTier = getClampedGeneratedNodeLayer(nextSourceTier);
      nextTargetTier = getClampedGeneratedNodeLayer(nextTargetTier);

      if (nextSourceTier !== sourceTier) {
        tiers.set(action.source, nextSourceTier);
        changed = true;
      }

      if (nextTargetTier !== targetTier) {
        tiers.set(action.target, nextTargetTier);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  const columns = new Map<number, AddNodeAction[]>();

  for (const action of addActions) {
    const referenceId = getActionReferenceId(action);
    const tier = tiers.get(referenceId) ?? 0;
    const column = columns.get(tier) ?? [];

    column.push(action);
    columns.set(tier, column);
  }

  const layout = new Map<string, { x: number; y: number }>();
  const orderedTiers = [...columns.keys()].sort((a, b) => a - b);

  for (const tier of orderedTiers) {
    const column = columns.get(tier) ?? [];
    const columnHeight = (column.length - 1) * GENERATED_NODE_ROW_GAP;
    const columnStartY = origin.y - columnHeight / 2;

    column.forEach((action, rowIndex) => {
      const referenceId = getActionReferenceId(action);

      if (!generatedNodeIds.has(referenceId)) {
        return;
      }

      layout.set(referenceId, {
        x: origin.x + GENERATED_NODE_LAYER_X_POSITIONS[tier],
        y: Math.round(columnStartY + rowIndex * GENERATED_NODE_ROW_GAP),
      });
    });
  }

  return layout;
}

function applyGeneratedNodeLayout(
  plan: DesignAgentPlan,
  snapshot: { nodes: readonly CanvasNode[] }
): DesignAgentPlan {
  const layout = createGeneratedNodeLayout(plan.actions, snapshot);

  if (layout.size === 0) {
    return plan;
  }

  return {
    ...plan,
    actions: plan.actions.map((action) => {
      if (action.type === "addNode") {
        const position = layout.get(getActionReferenceId(action));

        if (!position) {
          return action;
        }

        return {
          ...action,
          x: position.x,
          y: position.y,
        };
      }

      if (action.type === "moveNode") {
        const position = layout.get(action.nodeId);

        if (!position) {
          return action;
        }

        return {
          ...action,
          x: position.x,
          y: position.y,
        };
      }

      return action;
    }),
  };
}

function compactCanvasForPrompt(snapshot: {
  nodes: readonly CanvasNode[];
  edges: readonly CanvasEdge[];
}) {
  return {
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      shape: node.data.shape,
      position: node.position,
      width: node.width ?? node.style?.width,
      height: node.height ?? node.style?.height,
    })),
    edges: snapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label ?? "",
    })),
  };
}

function normalizeEnvSecret(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function createSecretFingerprint(value: string) {
  const prefix = value.slice(0, 8);
  const suffix = value.slice(-4);

  return `${prefix}...${suffix}`;
}

function getGeminiApiKey(): GeminiApiKeyConfig | null {
  const candidates: Array<{
    source: GeminiApiKeyConfig["source"];
    value: string | undefined;
  }> = [
    {
      source: "GEMINI_API_KEY",
      value: normalizeEnvSecret(process.env.GEMINI_API_KEY),
    },
    {
      source: "GOOGLE_GENERATIVE_AI_API_KEY",
      value: normalizeEnvSecret(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    },
    {
      source: "GOOGLE_AI_API_KEY",
      value: normalizeEnvSecret(process.env.GOOGLE_AI_API_KEY),
    },
  ];

  const activeCandidate = candidates.find(
    (candidate) => candidate.value && candidate.value.length > 0
  );

  if (!activeCandidate?.value) {
    return null;
  }

  return {
    source: activeCandidate.source,
    value: activeCandidate.value,
    fingerprint: createSecretFingerprint(activeCandidate.value),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The design agent failed unexpectedly.";
}

function isGeminiAccessDeniedError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("project has been denied access") ||
    normalizedMessage.includes("permission_denied") ||
    normalizedMessage.includes("api key") &&
      normalizedMessage.includes("required permissions")
  );
}

function normalizeDesignAgentError(
  error: unknown,
  apiKeyConfig: GeminiApiKeyConfig | null
) {
  const message = getErrorMessage(error);

  if (isGeminiAccessDeniedError(message)) {
    const keyDescription = apiKeyConfig
      ? `${apiKeyConfig.source} (${apiKeyConfig.fingerprint})`
      : "the selected Gemini API key";

    return [
      GEMINI_ACCESS_DENIED_MESSAGE,
      `The failed run used ${keyDescription}.`,
      "Create a new Gemini API key in Google AI Studio or use a Google Cloud project with Gemini API access and billing/quota enabled, then set it as GEMINI_API_KEY in the environment where Trigger is running and restart/redeploy the task.",
    ].join(" ");
  }

  return message;
}

function applyDesignPlan(plan: DesignAgentPlan, roomId: string) {
  const client = getLiveblocksClient();

  return mutateFlow<CanvasNode, CanvasEdge>({ client, roomId }, (flow) => {
    const addedNodeIds = new Map<string, string>();

    for (const action of plan.actions.slice(0, MAX_ACTIONS)) {
      if (action.type === "addNode") {
        const node = createCanvasNode(action);

        if (action.id) {
          addedNodeIds.set(action.id, node.id);
        }

        flow.addNode(node);
        continue;
      }

      if (action.type === "moveNode") {
        const nodeId = addedNodeIds.get(action.nodeId) ?? action.nodeId;

        flow.updateNode(nodeId, {
          position: {
            x: sanitizeCoordinate(action.x),
            y: sanitizeCoordinate(action.y),
          },
        });
        continue;
      }

      if (action.type === "resizeNode") {
        const nodeId = addedNodeIds.get(action.nodeId) ?? action.nodeId;
        const currentNode = flow.getNode(nodeId);

        if (!currentNode) {
          continue;
        }

        const width = sanitizeDimension(
          action.width,
          currentNode.width ?? MIN_NODE_WIDTH,
          MIN_NODE_WIDTH,
          MAX_NODE_WIDTH
        );
        const height = sanitizeDimension(
          action.height,
          currentNode.height ?? MIN_NODE_HEIGHT,
          MIN_NODE_HEIGHT,
          MAX_NODE_HEIGHT
        );

        flow.updateNode(nodeId, {
          width,
          height,
          style: {
            ...currentNode.style,
            width,
            height,
          },
        });
        continue;
      }

      if (action.type === "updateNodeData") {
        const nodeId = addedNodeIds.get(action.nodeId) ?? action.nodeId;
        const currentNode = flow.getNode(nodeId);

        if (!currentNode) {
          continue;
        }

        const shape =
          action.shape && isCanvasNodeShape(action.shape)
            ? action.shape
            : currentNode.data.shape;

        flow.updateNode(nodeId, {
          type: shape,
          data: {
            ...currentNode.data,
            label: action.label
              ? sanitizeLabel(action.label, currentNode.data.label)
              : currentNode.data.label,
            color:
              action.colorIndex === undefined
                ? currentNode.data.color
                : getNodeColor(action.colorIndex),
            shape,
          },
        });
        continue;
      }

      if (action.type === "deleteNode") {
        const nodeId = addedNodeIds.get(action.nodeId) ?? action.nodeId;

        flow.removeEdges(
          flow.edges
            .filter((edge) => edge.source === nodeId || edge.target === nodeId)
            .map((edge) => edge.id)
        );
        flow.removeNode(nodeId);
        continue;
      }

      if (action.type === "addEdge") {
        const source = addedNodeIds.get(action.source) ?? action.source;
        const target = addedNodeIds.get(action.target) ?? action.target;

        if (!flow.getNode(source) || !flow.getNode(target) || source === target) {
          continue;
        }

        const duplicateEdge = flow.edges.some(
          (edge) => edge.source === source && edge.target === target
        );

        if (duplicateEdge) {
          continue;
        }

        flow.addEdge(
          createCanvasEdge({
            ...action,
            source,
            target,
          })
        );
        continue;
      }

      if (action.type === "deleteEdge") {
        flow.removeEdge(action.edgeId);
      }
    }
  });
}

async function getCanvasSnapshot(roomId: string) {
  const client = getLiveblocksClient();
  let snapshot: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] } = {
    nodes: [],
    edges: [],
  };

  await mutateFlow<CanvasNode, CanvasEdge>({ client, roomId }, (flow) => {
    snapshot = flow.toJSON();
  });

  return snapshot;
}

async function publishStatus(
  roomId: string,
  status: AiStatus,
  message: string
) {
  const client = getLiveblocksClient();
  const event = {
    type: "ai-status",
    id: crypto.randomUUID(),
    status,
    message,
    timestamp: new Date().toISOString(),
  } satisfies AiStatusEvent;
  const feedMessage = {
    type: "ai-status",
    status,
    source: "design",
    text: message,
  } satisfies AiStatusFeedMessage;

  await Promise.allSettled([
    client.broadcastEvent(roomId, event),
    createAiStatusFeedMessage(roomId, feedMessage),
  ]);
}

async function createAiStatusFeedMessage(
  roomId: string,
  message: AiStatusFeedMessage
) {
  const client = getLiveblocksClient();

  await client
    .createFeed({
      roomId,
      feedId: AI_STATUS_FEED_ID,
      metadata: {
        name: "AI status feed",
      },
    })
    .catch(() => undefined);

  await client.createFeedMessage({
    roomId,
    feedId: AI_STATUS_FEED_ID,
    data: message,
  });
}

async function createAiChatFeedMessage(
  roomId: string,
  content: string
) {
  const client = getLiveblocksClient();
  const message = {
    type: "ai-chat",
    sender: {
      id: AI_USER_ID,
      name: AI_USER_INFO.name,
      avatar: AI_USER_INFO.avatar,
    },
    role: "assistant",
    content: content.trim().slice(0, 2_000),
    timestamp: new Date().toISOString(),
  } satisfies AiChatFeedMessage;

  await client
    .createFeed({
      roomId,
      feedId: AI_CHAT_FEED_ID,
      metadata: {
        name: "AI chat feed",
      },
    })
    .catch(() => undefined);

  await client.createFeedMessage({
    roomId,
    feedId: AI_CHAT_FEED_ID,
    data: message,
  });
}

async function setAiPresence(
  roomId: string,
  thinking: boolean,
  cursor: { x: number; y: number } | null
) {
  await getLiveblocksClient().setPresence(roomId, {
    userId: AI_USER_ID,
    userInfo: AI_USER_INFO,
    data: {
      cursor,
      thinking,
    },
    ttl: thinking ? AI_PRESENCE_TTL_SECONDS : 2,
  });
}

async function generateDesignPlan(
  prompt: string,
  snapshot: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] }
) {
  const currentCanvas = compactCanvasForPrompt(snapshot);
  const apiKeyConfig = getGeminiApiKey();

  if (!apiKeyConfig) {
    throw new Error(
      "Gemini API key is missing. Set GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_AI_API_KEY."
    );
  }

  const { object } = await generateObject({
    model: createGoogleGenerativeAI({ apiKey: apiKeyConfig.value })(
      GEMINI_MODEL
    ),
    schema: designPlanSchema,
    temperature: 0.25,
    system: [
      "You are Ghost AI, a collaborative system design canvas agent.",
      "Return only structured actions that update a React Flow architecture canvas.",
      "Prefer adding a coherent design when the canvas is empty, or minimally extending/updating existing nodes when the prompt asks for changes.",
      "Use only allowed shapes: rectangle, diamond, circle, pill, cylinder, hexagon.",
      "Use colorIndex values from 0 to 7.",
      "Lay nodes out in architecture layers: client/user entry, gateway/API, services/workers, and data/storage.",
      "Keep directly connected generated nodes in neighboring layers with compact spacing; do not skip multiple columns.",
      "Use at least 150px vertical spacing between nodes in the same layer.",
      "Use concise node labels under 5 words.",
      "Only create edges whose source and target nodes exist in the current canvas or were added earlier in the same action list.",
      "For newly added nodes, use stable temporary ids in later actions and edges by referencing the same id you supplied in addNode.",
    ].join(" "),
    prompt: JSON.stringify({
      userPrompt: prompt,
      currentCanvas,
    }),
  });

  return object;
}

export const designAgent = task({
  id: "design-agent",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: DesignAgentPayload) => {
    logger.info("Design agent task received input.", {
      prompt: payload.prompt,
      roomId: payload.roomId,
    });

    await setAiPresence(payload.roomId, true, { x: 120, y: 120 });
    await publishStatus(
      payload.roomId,
      "started",
      "Ghost AI is reading the current canvas."
    );

    try {
      const snapshot = await getCanvasSnapshot(payload.roomId);

      await setAiPresence(payload.roomId, true, { x: 220, y: 160 });
      await publishStatus(
        payload.roomId,
        "processing",
        "Ghost AI is planning canvas updates."
      );

      const generatedPlan = await generateDesignPlan(payload.prompt, snapshot);
      const plan = applyGeneratedNodeLayout(generatedPlan, snapshot);

      await setAiPresence(payload.roomId, true, { x: 320, y: 220 });
      await publishStatus(
        payload.roomId,
        "processing",
        "Ghost AI is applying the design to the shared canvas."
      );

      await applyDesignPlan(plan, payload.roomId);

      await publishStatus(
        payload.roomId,
        "complete",
        plan.summary || "Ghost AI updated the architecture canvas."
      );
      await createAiChatFeedMessage(
        payload.roomId,
        plan.summary || "Ghost AI updated the architecture canvas."
      );

      return {
        ok: true,
        summary: plan.summary,
        actionsApplied: plan.actions.length,
      };
    } catch (error) {
      const apiKeyConfig = getGeminiApiKey();
      const message = normalizeDesignAgentError(error, apiKeyConfig);

      logger.error("Design agent failed.", {
        roomId: payload.roomId,
        error: message,
        rawError: getErrorMessage(error),
        geminiApiKeySource: apiKeyConfig?.source,
        geminiApiKeyFingerprint: apiKeyConfig?.fingerprint,
      });

      await publishStatus(
        payload.roomId,
        "error",
        "Ghost AI could not complete the design update."
      );

      return {
        ok: false,
        error: message,
      };
    } finally {
      await setAiPresence(payload.roomId, false, null);
    }
  },
});
