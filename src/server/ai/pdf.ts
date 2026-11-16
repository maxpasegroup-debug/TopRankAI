import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Official syllabi are usually published as PDFs. Rather than guessing a PDF
 * parser, the importer hands the document to the configured Gemini model and
 * asks for a faithful plain-text transcription. The result is stored with the
 * source URL so a human can check it.
 */
export async function transcribePdf(input: {
  buffer: Buffer;
  label: string;
  timeoutMs?: number;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) return { ok: false, message: "GEMINI_API_KEY is not configured." };
  if (env.AI_FEATURES_ENABLED === "false") return { ok: false, message: "AI features are disabled." };
  if (input.buffer.byteLength > 15 * 1024 * 1024) {
    return { ok: false, message: "PDF is larger than the 15 MB inline transcription limit." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 120_000);
  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You transcribe official examination documents. Return faithful plain text only. Do not summarise, add commentary, or invent missing content." }],
        },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: input.buffer.toString("base64") } },
            { text: `Transcribe every readable word of this document (${input.label}). Preserve headings, numbered lists and subject names. Output plain text with no markdown fences.` },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8_192,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, message: `Gemini PDF transcription failed (${response.status}): ${detail.slice(0, 240)}` };
    }
    const payload = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!text) return { ok: false, message: `Gemini returned no text (${payload.candidates?.[0]?.finishReason ?? "unknown"}).` };
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ error: message, label: input.label }, "PDF transcription failed");
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
