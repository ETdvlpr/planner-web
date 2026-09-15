import { firebaseAuth } from "@/lib/firebase";
import { env } from "@/lib/env";
import type { ApiEnvelope } from "./types";

/**
 * The one HTTP layer.
 *
 * Every call attaches the current Firebase ID token, unwraps the
 * `{ success, data, error }` envelope planner-api shares with hi-selam, and
 * throws an `ApiError` on anything that is not a 2xx with `success: true`.
 * Callers never see `Response` objects or envelopes — they get `T` or an
 * exception, which is exactly what TanStack Query wants.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthenticated() {
    return this.status === 401;
  }
  get isNotFound() {
    return this.status === 404;
  }
}

export type QueryValue =
  string | number | boolean | null | undefined | readonly (string | number)[];

export type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
}

/**
 * Builds a query string the API's `ValidationPipe` understands: arrays repeat
 * the key (`status=next&status=waiting`), empties are omitted so an unset
 * filter does not become `?projectId=undefined`.
 */
export function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, String(entry));
    } else {
      search.set(key, String(value));
    }
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

/** Unwraps an envelope body, throwing `ApiError` when it reports failure. */
export function unwrap<T>(status: number, body: unknown): T {
  const envelope = body as Partial<ApiEnvelope<T>> | null;
  if (envelope && envelope.success === true) return envelope.data as T;
  const error = envelope?.error ?? null;
  throw new ApiError(
    status,
    error?.code ?? (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED"),
    error?.message ?? `Request failed with status ${status}`,
  );
}

async function idToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function api<T>(
  path: string,
  { method = "GET", body, query, signal }: RequestOptions = {},
): Promise<T> {
  const url = `${env.apiUrl}${path}${buildQuery(query)}`;

  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let response = await send(await idToken());

  // The SDK refreshes tokens on its own, but a laptop that slept through the
  // expiry can wake with a stale one cached. One forced refresh and retry
  // covers that without turning every 401 into a sign-out.
  if (response.status === 401 && firebaseAuth().currentUser) {
    response = await send(await idToken(true));
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        "BAD_RESPONSE",
        `Expected JSON from ${path}, got ${response.status}`,
      );
    }
  }
  return unwrap<T>(response.status, parsed);
}

/** Convenience wrappers so call sites read as intent rather than options. */
export const http = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    api<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) =>
    api<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) =>
    api<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};

/** A human message for any thrown value, for toasts. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
