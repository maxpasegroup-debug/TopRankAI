import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";

export type AiFailureCode = "NOT_CONFIGURED" | "FAILED" | "INVALID_RESPONSE";

export type AiResult<T> =
  | { ok: true; data: T; provider: string; model: string; latencyMs: number }
  | { ok: false; code: AiFailureCode; message: string };

/**
 * A deliberately small subset of the OpenAPI schema dialect that Gemini's
 * `responseSchema` accepts. Passing one of these keeps the model on the
 * contract instead of relying on prompt wording alone.
 */
export type GeminiResponseSchema = Record<string, unknown>;

type StructuredRequest<T> = {
  operation: string;
  system: string;
  prompt: string;
  schema: { parse: (value: unknown) => T };
  responseSchema?: GeminiResponseSchema;
  userId?: string | null;
  examId?: string | null;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  attempts?: number;
};

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 30_000;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in model response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callGemini(apiKey: string, model: string, request: StructuredRequest<unknown>, signal: AbortSignal) {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxOutputTokens ?? 4096,
        responseMimeType: "application/json",
        ...(request.responseSchema ? { responseSchema: request.responseSchema } : {}),
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned an empty response (${payload.candidates?.[0]?.finishReason ?? "unknown"})`);
  return text;
}

/**
 * Calls Google Gemini with a structured-JSON contract. The caller owns domain
 * validation; this function only guarantees transport, JSON extraction, schema
 * validation, bounded retries and an audit log row.
 */
export async function generateStructured<T>(request: StructuredRequest<T>): Promise<AiResult<T>> {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL;
  if (!apiKey) {
    return { ok: false, code: "NOT_CONFIGURED", message: "AI is not configured. Add GEMINI_API_KEY to enable it." };
  }
  if (env.AI_FEATURES_ENABLED === "false") {
    return { ok: false, code: "NOT_CONFIGURED", message: "AI features are disabled by AI_FEATURES_ENABLED=false." };
  }

  const startedAt = Date.now();
  const maxAttempts = Math.max(1, request.attempts ?? 2);
  const timeoutMs = Math.max(5_000, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let lastError = "Unknown AI error";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await callGemini(apiKey, model, request, controller.signal);
      const parsed = request.schema.parse(extractJson(text));
      const latencyMs = Date.now() - startedAt;
      await logUsage({ request, model, success: true, latencyMs, promptChars: request.prompt.length, responseChars: text.length });
      return { ok: true, data: parsed, provider: "google", model, latencyMs };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  const latencyMs = Date.now() - startedAt;
  await logUsage({ request, model, success: false, latencyMs, promptChars: request.prompt.length, responseChars: 0, error: lastError });
  logger.warn({ operation: request.operation, error: lastError }, "AI request failed");
  return { ok: false, code: "FAILED", message: "The AI service did not respond correctly. Please try again." };
}

async function logUsage(input: {
  request: StructuredRequest<unknown>;
  model: string;
  success: boolean;
  latencyMs: number;
  promptChars: number;
  responseChars: number;
  error?: string;
}) {
  try {
    await prisma.aIUsageLog.create({
      data: {
        userId: input.request.userId ?? null,
        examId: input.request.examId ?? null,
        provider: "google",
        model: input.model,
        operation: input.request.operation,
        success: input.success,
        latencyMs: input.latencyMs,
        promptChars: input.promptChars,
        responseChars: input.responseChars,
        error: input.error ? input.error.slice(0, 500) : null,
      },
    });
  } catch (error) {
    logger.warn({ error }, "Could not write AI usage log");
  }
}
