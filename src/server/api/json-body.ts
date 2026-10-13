import { ApiError, ValidationApiError } from "./errors";
export async function readBoundedJson(request: Request, limitBytes: number): Promise<unknown> {
  if (!Number.isInteger(limitBytes) || limitBytes < 1 || limitBytes > 512 * 1024) throw new ValidationApiError();
  const tooLarge = () => new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new ValidationApiError();
    if (Number(length) > limitBytes) throw tooLarge();
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON request body required");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported request encoding");
  if (!request.body) throw new ValidationApiError("Request validation failed");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limitBytes) { void reader.cancel().catch(() => undefined); throw tooLarge(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ValidationApiError("Request validation failed");
  } finally { reader.releaseLock(); }
}
