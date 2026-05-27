import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { put } from "@vercel/blob";
import { generateText } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { NODE_SHAPES } from "@/types/canvas";
import { aiChatFeedMessageSchema } from "@/types/tasks";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ACCESS_DENIED_MESSAGE =
  "Gemini access is denied for the configured API key project.";

const specNodeSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    data: z
      .object({
        label: z.string(),
        shape: z.enum(NODE_SHAPES).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const specEdgeSchema = z
  .object({
    id: z.string().trim().min(1),
    source: z.string().trim().min(1),
    target: z.string().trim().min(1),
    data: z
      .object({
        label: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const generateSpecPayloadSchema = z.object({
  projectId: z.string().trim().min(1),
  roomId: z.string().trim().min(1),
  chatHistory: z.array(aiChatFeedMessageSchema).max(100),
  nodes: z.array(specNodeSchema).max(250),
  edges: z.array(specEdgeSchema).max(500),
});

export type GenerateSpecPayload = z.infer<typeof generateSpecPayloadSchema>;

interface GeminiApiKeyConfig {
  source: "GEMINI_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY" | "GOOGLE_AI_API_KEY";
  value: string;
  fingerprint: string;
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

  return "Spec generation failed unexpectedly.";
}

function isGeminiAccessDeniedError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("project has been denied access") ||
    normalizedMessage.includes("permission_denied") ||
    (normalizedMessage.includes("api key") &&
      normalizedMessage.includes("required permissions"))
  );
}

function normalizeSpecGenerationError(
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

function compactSpecInput(payload: GenerateSpecPayload) {
  return {
    projectId: payload.projectId,
    roomId: payload.roomId,
    chatHistory: payload.chatHistory.map((message) => ({
      role: message.role,
      sender: message.sender.name,
      content: message.content,
      timestamp: message.timestamp,
    })),
    canvas: {
      nodes: payload.nodes.map((node) => ({
        id: node.id,
        label: node.data.label,
        shape: node.data.shape ?? node.type ?? "rectangle",
        position: node.position,
        width: node.width,
        height: node.height,
      })),
      edges: payload.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.data?.label ?? "",
      })),
    },
  };
}

async function generateMarkdownSpec(payload: GenerateSpecPayload) {
  const apiKeyConfig = getGeminiApiKey();

  if (!apiKeyConfig) {
    throw new Error(
      "Gemini API key is missing. Set GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_AI_API_KEY."
    );
  }

  const { text } = await generateText({
    model: createGoogleGenerativeAI({ apiKey: apiKeyConfig.value })(
      GEMINI_MODEL
    ),
    temperature: 0.2,
    system: [
      "You are Ghost AI, a senior systems architect writing a Markdown technical specification.",
      "Use the provided collaborative canvas graph and chat history as source material.",
      "Return plain Markdown only. Do not wrap the response in code fences.",
      "Include clear sections for overview, architecture, components, data/storage, integrations, flows, reliability, security, and open questions.",
      "Ground every component and connection in the provided node and edge data. If information is missing, call it out as an open question instead of inventing implementation detail.",
    ].join(" "),
    prompt: JSON.stringify(compactSpecInput(payload)),
  });

  return text.trim();
}

async function persistMarkdownSpec(projectId: string, markdown: string) {
  const specId = randomUUID();
  const blob = await put(`specs/${projectId}/${specId}.md`, markdown, {
    access: "private",
    contentType: "text/markdown; charset=utf-8",
  });

  return prisma.projectSpec.create({
    data: {
      id: specId,
      projectId,
      filePath: blob.url,
    },
    select: {
      id: true,
      filePath: true,
      createdAt: true,
    },
  });
}

export const generateSpec = task({
  id: "generate-spec",
  retry: {
    maxAttempts: 1,
  },
  run: async (rawPayload: GenerateSpecPayload) => {
    metadata
      .set("status", "started")
      .set("progress", 0)
      .set("source", "spec");

    const payload = generateSpecPayloadSchema.parse(rawPayload);

    logger.info("Spec generation task received input.", {
      projectId: payload.projectId,
      roomId: payload.roomId,
      nodeCount: payload.nodes.length,
      edgeCount: payload.edges.length,
      chatMessageCount: payload.chatHistory.length,
    });

    try {
      metadata
        .set("status", "processing")
        .set("progress", 35)
        .set("message", "Ghost AI is drafting the technical spec.");

      const markdown = await generateMarkdownSpec(payload);
      const spec = await persistMarkdownSpec(payload.projectId, markdown);

      metadata
        .set("status", "complete")
        .set("progress", 100)
        .set("message", "Ghost AI completed the technical spec.")
        .set("specId", spec.id);

      logger.info("Spec generation completed.", {
        projectId: payload.projectId,
        roomId: payload.roomId,
        specId: spec.id,
        filePath: spec.filePath,
        markdownLength: markdown.length,
      });

      return {
        specId: spec.id,
        downloadPath: `/api/projects/${payload.projectId}/specs/${spec.id}/download`,
        createdAt: spec.createdAt.toISOString(),
      };
    } catch (error) {
      const apiKeyConfig = getGeminiApiKey();
      const message = normalizeSpecGenerationError(error, apiKeyConfig);

      metadata
        .set("status", "error")
        .set("progress", 100)
        .set("message", message);

      logger.error("Spec generation failed.", {
        projectId: payload.projectId,
        roomId: payload.roomId,
        error: message,
        rawError: getErrorMessage(error),
        geminiApiKeySource: apiKeyConfig?.source,
        geminiApiKeyFingerprint: apiKeyConfig?.fingerprint,
      });

      throw new Error(message);
    }
  },
});
