import { describe, expect, it } from "vitest";
import { toWirePayload } from "../src/emails";
import { createClient, onlyRequest, stubFetch, useCleanEnv } from "./test-utils";
import type { SendEmailOptions } from "../src/types";

useCleanEnv();

/**
 * The wire name for every field of `SendEmailOptions`. Because this is keyed by
 * `keyof SendEmailOptions`, adding a field to the interface without adding it
 * here fails `pnpm check-types`. That is the point: an unmapped field compiles
 * fine and silently drops the caller's data at runtime.
 */
const EMAIL_WIRE_FIELDS: Record<keyof SendEmailOptions, string> = {
  from: "from",
  to: "to",
  cc: "cc",
  bcc: "bcc",
  replyTo: "reply_to",
  subject: "subject",
  html: "html",
  text: "text",
  marketing: "marketing",
  tags: "tags",
};

/** Every field populated, so `Required` also breaks when a new option appears. */
const FULL_EMAIL: Required<SendEmailOptions> = {
  from: "Acme <hello@acme.com>",
  to: ["a@example.com", "b@example.com"],
  cc: "cc@example.com",
  bcc: ["bcc@example.com"],
  replyTo: "reply@acme.com",
  subject: "Your receipt",
  html: "<p>Thanks</p>",
  text: "Thanks",
  marketing: true,
  tags: [{ name: "campaign", value: "spring-2026" }],
};

describe("toWirePayload", () => {
  it("maps every option onto its wire field", () => {
    const wire = toWirePayload(FULL_EMAIL) as Record<string, unknown>;

    for (const [option, wireName] of Object.entries(EMAIL_WIRE_FIELDS)) {
      expect(wire[wireName]).toEqual(FULL_EMAIL[option as keyof SendEmailOptions]);
    }
  });

  it("emits exactly the mapped fields and nothing else", () => {
    const wire = toWirePayload(FULL_EMAIL);

    expect(Object.keys(wire).sort()).toEqual(Object.values(EMAIL_WIRE_FIELDS).sort());
  });

  it("renames replyTo to snake_case rather than passing it through", () => {
    const wire = toWirePayload(FULL_EMAIL) as Record<string, unknown>;

    expect(wire.reply_to).toBe("reply@acme.com");
    expect(wire).not.toHaveProperty("replyTo");
  });

  it("drops absent optional fields from the serialised body", async () => {
    const calls = stubFetch({ body: {} });

    await createClient().emails.send({
      from: "a@x.com",
      to: "b@x.com",
      subject: "s",
      text: "t",
    });

    expect(onlyRequest(calls).body).toEqual({
      from: "a@x.com",
      to: "b@x.com",
      subject: "s",
      text: "t",
    });
  });
});

describe("emails.send", () => {
  it("POSTs the wire payload to /v1/emails", async () => {
    const calls = stubFetch({ body: { id: "em_1" } });

    await createClient().emails.send(FULL_EMAIL);

    const request = onlyRequest(calls);
    expect(request.method).toBe("POST");
    expect(request.url.pathname).toBe("/v1/emails");
    expect(request.body).toEqual(toWirePayload(FULL_EMAIL));
  });
});

describe("emails.get", () => {
  it("GETs the email by id", async () => {
    const calls = stubFetch({ body: { id: "em_1" } });

    await createClient().emails.get("em_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/emails/em_1");
  });
});

describe("emails.list", () => {
  it("sends no query when called with no filters", async () => {
    const calls = stubFetch({ body: { emails: [] } });

    await createClient().emails.list();

    expect(onlyRequest(calls).url.search).toBe("");
  });

  it("encodes each tag as one name:value parameter", async () => {
    const calls = stubFetch({ body: { emails: [] } });

    await createClient().emails.list({
      tags: [
        { name: "campaign", value: "spring-2026" },
        { name: "category", value: "receipt" },
      ],
    });

    expect(onlyRequest(calls).url.searchParams.getAll("tag")).toEqual([
      "campaign:spring-2026",
      "category:receipt",
    ]);
  });

  it("maps batchId to batch_id and passes the other filters through", async () => {
    const calls = stubFetch({ body: { emails: [] } });

    await createClient().emails.list({
      status: "bounced",
      batchId: "bat_1",
      limit: 100,
      cursor: "cur_1",
    });

    const query = onlyRequest(calls).url.searchParams;
    expect(query.get("status")).toBe("bounced");
    expect(query.get("batch_id")).toBe("bat_1");
    expect(query.get("limit")).toBe("100");
    expect(query.get("cursor")).toBe("cur_1");
    expect(query.has("batchId")).toBe(false);
  });
});

describe("emails.tags", () => {
  it("GETs the tag index", async () => {
    const calls = stubFetch({ body: { tags: [] } });

    await createClient().emails.tags();

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/emails/tags");
  });
});
