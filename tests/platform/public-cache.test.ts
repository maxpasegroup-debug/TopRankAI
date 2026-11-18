import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  entries: new Map<string, Promise<unknown>>(),
  categories: vi.fn(),
  exams: vi.fn(),
  count: vi.fn(),
  invalidate: vi.fn(),
  user: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keys: string[]) => () => {
    const key = keys.join(":");
    if (!mocks.entries.has(key)) mocks.entries.set(key, fn());
    return mocks.entries.get(key);
  },
  revalidateTag: mocks.invalidate,
}));
vi.mock("@/server/db", () => ({ prisma: {
  examCategory: { findMany: mocks.categories, count: mocks.count },
  exam: { findMany: mocks.exams, count: mocks.count },
  syllabusTopic: { count: mocks.count },
  question: { count: mocks.count },
  achievementDefinition: { count: mocks.count },
} }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/auth/request-security", () => ({
  requireAuthOrigin: vi.fn(),
  readAuthJson: (request: Request) => request.json(),
}));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { getPlatformStats, getPublicCatalogue } from "@/server/platform/public";
import { invalidatePublicContent, PUBLIC_CONTENT_TAG } from "@/server/platform/public-cache";
import { adminMutation } from "@/server/api/admin-handler";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.entries.clear();
  mocks.categories.mockResolvedValue([]);
  mocks.exams.mockResolvedValue([]);
  mocks.count.mockResolvedValue(3);
  mocks.user.mockResolvedValue({ id: "admin", role: "PLATFORM_ADMIN" });
  mocks.invalidate.mockImplementation(() => mocks.entries.clear());
});

describe("public content caching", () => {
  it("reuses catalogue and statistics across requests", async () => {
    await getPublicCatalogue();
    await getPublicCatalogue();
    await getPlatformStats();
    await getPlatformStats();
    expect(mocks.exams).toHaveBeenCalledTimes(1);
    expect(mocks.categories).toHaveBeenCalledTimes(1);
    expect(mocks.count).toHaveBeenCalledTimes(5);
  });

  it("expires published data immediately after an edit", async () => {
    expect((await getPlatformStats()).exams).toBe(3);
    mocks.count.mockResolvedValue(4);
    invalidatePublicContent();
    expect(mocks.invalidate).toHaveBeenCalledWith(PUBLIC_CONTENT_TAG, { expire: 0 });
    expect((await getPlatformStats()).exams).toBe(4);
  });

  it("invalidates after a successful administrative API mutation", async () => {
    const handler = adminMutation(z.object({}), vi.fn().mockResolvedValue({ saved: true }));
    const response = await handler(new Request("http://localhost/api/admin/exams", { method: "POST", body: "{}" }));
    expect(response.status).toBe(200);
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps the cache when the mutation fails", async () => {
    const handler = adminMutation(z.object({}), vi.fn().mockRejectedValue(new Error("write failed")));
    const response = await handler(new Request("http://localhost/api/admin/exams", { method: "POST", body: "{}" }));
    expect(response.status).toBe(500);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
