// Paid resource gates are intentionally inactive until subscriptions are introduced.
export async function requireResourceAccess(_kind: "MOCK" | "LESSON", _resourceId: string, ..._legacyArgs: unknown[]) {
  return;
}
