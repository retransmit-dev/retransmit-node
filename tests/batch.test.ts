import { describe, expect, it } from "vitest";
import { toWirePayload } from "../src/emails";
import { createClient, onlyRequest, stubFetch, useCleanEnv } from "./test-utils";
import type { SendEmailOptions } from "../src/types";

useCleanEnv();

const EMAILS: SendEmailOptions[] = [
  { from: "Acme <hello@acme.com>", to: "a@example.com", subject: "Hi", text: "Hello A" },
  {
    from: "Acme <hello@acme.com>",
    to: "b@example.com",
    subject: "Hi",
    text: "Hello B",
    replyTo: "reply@acme.com",
  },
];

describe("batch.send", () => {
  it("POSTs the emails to /v1/emails/batch", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send(EMAILS);

    const request = onlyRequest(calls);
    expect(request.method).toBe("POST");
    expect(request.url.pathname).toBe("/v1/emails/batch");
  });

  it("wraps the emails in an `emails` array", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send(EMAILS);

    expect(onlyRequest(calls).body).toEqual({ emails: EMAILS.map(toWirePayload) });
  });

  it("applies the same wire mapping as a single send", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send(EMAILS);

    const body = onlyRequest(calls).body as { emails: Record<string, unknown>[] };
    expect(body.emails[1]?.reply_to).toBe("reply@acme.com");
    expect(body.emails[1]).not.toHaveProperty("replyTo");
  });

  it("sends idempotencyKey as the Idempotency-Key header for the whole batch", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send(EMAILS, { idempotencyKey: "weekly-digest/2026-09-07" });

    const request = onlyRequest(calls);
    expect(request.headers["Idempotency-Key"]).toBe("weekly-digest/2026-09-07");
    expect(request.body).toEqual({ emails: EMAILS.map(toWirePayload) });
  });

  it("omits the Idempotency-Key header when no key is given", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send(EMAILS);

    expect(onlyRequest(calls).headers).not.toHaveProperty("Idempotency-Key");
  });

  it("sends an empty array unchanged rather than omitting it", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.send([]);

    expect(onlyRequest(calls).body).toEqual({ emails: [] });
  });
});

describe("batch.get", () => {
  it("GETs the batch by id", async () => {
    const calls = stubFetch({ body: { id: "bat_1" } });

    await createClient().batch.get("bat_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/emails/batch/bat_1");
  });
});
