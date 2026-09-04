import { afterEach, beforeEach, vi } from "vitest";
import { Retransmit } from "../src/retransmit";
import type { RetransmitOptions } from "../src/types";

export const TEST_API_KEY = "rt_test_key";

/** One request the SDK handed to `fetch`, decoded for assertions. */
export interface CapturedRequest {
  url: URL;
  method: string;
  headers: Record<string, string>;
  /** Parsed JSON body, or undefined for a bodyless request. */
  body: unknown;
}

export interface StubbedResponse {
  status?: number;
  /** JSON body. Ignored when `raw` or `networkError` is set. */
  body?: unknown;
  /** Non-JSON body, e.g. an HTML error page from a proxy in front of the API. */
  raw?: string;
  /** Make `fetch` itself reject, as it does on DNS or connection failure. */
  networkError?: string;
}

/**
 * Replaces global `fetch` and records every request. Responses are returned in
 * order; the last one repeats if the SDK makes more calls than were stubbed.
 */
export function stubFetch(...responses: StubbedResponse[]): CapturedRequest[] {
  const calls: CapturedRequest[] = [];
  let index = 0;

  vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
    const spec = responses[Math.min(index, responses.length - 1)] ?? {};
    index += 1;

    calls.push({
      url: new URL(input),
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string> | undefined) },
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });

    if (spec.networkError !== undefined) throw new TypeError(spec.networkError);

    return new Response(spec.raw ?? JSON.stringify(spec.body ?? {}), {
      status: spec.status ?? 200,
      headers: { "Content-Type": spec.raw === undefined ? "application/json" : "text/html" },
    });
  });

  return calls;
}

/** Asserts exactly one request was made and returns it. */
export function onlyRequest(calls: CapturedRequest[]): CapturedRequest {
  const [first, ...rest] = calls;
  if (!first) throw new Error("expected one request, none was made");
  if (rest.length > 0) throw new Error(`expected one request, got ${calls.length}`);
  return first;
}

export function createClient(options?: RetransmitOptions): Retransmit {
  return new Retransmit(TEST_API_KEY, options);
}

const ENV_KEYS = ["RETRANSMIT_API_KEY", "RETRANSMIT_BASE_URL"] as const;

/**
 * Clears the SDK's environment variables around each test and restores them
 * after, so a real key in the developer's shell cannot mask a failure.
 */
export function useCleanEnv(): void {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    saved.clear();
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });
}
