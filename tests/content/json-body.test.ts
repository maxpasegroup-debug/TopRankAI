import { describe, expect, it } from "vitest";
import { readBoundedJson } from "@/server/api/json-body";
import { readAuthJson } from "@/server/auth/request-security";
function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://toprank.test", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
}
describe("bounded editorial JSON without increasing authentication limits", () => {
  it("accepts an editorial body above the auth cap only with the explicit reader", async () => {
    const text = JSON.stringify({ content: "x".repeat(40000) });
    await expect(readBoundedJson(request(text), 160 * 1024)).resolves.toMatchObject({ content: expect.any(String) });
    await expect(readAuthJson(request(text), 40001)).rejects.toMatchObject({ status: 400 });
    await expect(readAuthJson(request(text))).rejects.toMatchObject({ status: 413 });
  });
  it.each([0, -1, NaN, 1.5, 512 * 1024 + 1])("rejects invalid editorial limit %s", async limit => await expect(readBoundedJson(request("{}"), limit)).rejects.toMatchObject({ status: 400 }));
  it("counts UTF-8 bytes rather than characters", async () => await expect(readBoundedJson(request(JSON.stringify({ text: "\u00e9".repeat(100) })), 150)).rejects.toMatchObject({ status: 413 }));
  it("rejects oversized declared and actual bodies", async () => {
    await expect(readBoundedJson(request("{}", { "content-length": "200" }), 100)).rejects.toMatchObject({ status: 413 });
    await expect(readBoundedJson(request(JSON.stringify({ text: "x".repeat(200) })), 100)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects non-JSON media and compressed requests", async () => {
    await expect(readBoundedJson(request("{}", { "content-type": "text/plain" }), 100)).rejects.toMatchObject({ status: 415 });
    await expect(readBoundedJson(request("{}", { "content-encoding": "gzip" }), 100)).rejects.toMatchObject({ status: 415 });
  });
  it("returns a generic validation error for malformed JSON", async () => await expect(readBoundedJson(request("{broken"), 100)).rejects.toMatchObject({ status: 400, message: "Request validation failed" }));
});
