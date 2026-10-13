export class StudentRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function studentRequest<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await response.json();
  if (!response.ok) throw new StudentRequestError(body.error?.message ?? "Unable to save. Please try again.", response.status);
  return body.data as T;
}
