import { describe, expect, it } from "vitest";
import { toBase64, toWirePayload } from "../src/emails";
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
  headers: "headers",
  attachments: "attachments",
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
  headers: { "X-Entity-Ref-ID": "order_4821" },
  attachments: [{ filename: "invoice.pdf", content: "aGVsbG8=" }],
};

/** Attachments are re-shaped on the wire; every other field passes through as-is. */
const PASSTHROUGH_FIELDS = Object.entries(EMAIL_WIRE_FIELDS).filter(
  ([option]) => option !== "attachments",
);

describe("toWirePayload", () => {
  it("maps every option onto its wire field", () => {
    const wire = toWirePayload(FULL_EMAIL) as Record<string, unknown>;

    for (const [option, wireName] of PASSTHROUGH_FIELDS) {
      expect(wire[wireName]).toEqual(FULL_EMAIL[option as keyof SendEmailOptions]);
    }
    expect(wire.attachments).toEqual([
      {
        filename: "invoice.pdf",
        content: "aGVsbG8=",
        path: undefined,
        content_type: undefined,
        content_id: undefined,
      },
    ]);
  });

  it("base64-encodes attachment bytes and maps the attachment fields to snake_case", () => {
    const wire = toWirePayload({
      ...FULL_EMAIL,
      attachments: [
        {
          filename: "logo.png",
          content: new Uint8Array([104, 101, 108, 108, 111]),
          contentType: "image/png",
          contentId: "logo",
        },
        { filename: "terms.pdf", path: "https://acme.com/terms.pdf" },
      ],
    }) as { attachments: Record<string, unknown>[] };

    expect(wire.attachments[0]).toMatchObject({
      filename: "logo.png",
      content: "aGVsbG8=",
      content_type: "image/png",
      content_id: "logo",
    });
    expect(wire.attachments[0]).not.toHaveProperty("contentType");
    expect(wire.attachments[1]).toMatchObject({
      filename: "terms.pdf",
      path: "https://acme.com/terms.pdf",
      content: undefined,
    });
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

  it("passes headers through as a name to value object", () => {
    const wire = toWirePayload(FULL_EMAIL) as Record<string, unknown>;

    expect(wire.headers).toEqual({ "X-Entity-Ref-ID": "order_4821" });
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

  it("sends idempotencyKey as the Idempotency-Key header, not in the body", async () => {
    const calls = stubFetch({ body: { id: "em_1" } });

    await createClient().emails.send(FULL_EMAIL, { idempotencyKey: "welcome-user/123" });

    const request = onlyRequest(calls);
    expect(request.headers["Idempotency-Key"]).toBe("welcome-user/123");
    expect(request.body).toEqual(toWirePayload(FULL_EMAIL));
  });

  it("omits the Idempotency-Key header when no key is given", async () => {
    const calls = stubFetch({ body: { id: "em_1" } });

    await createClient().emails.send(FULL_EMAIL);
    await createClient().emails.send(FULL_EMAIL, {});

    for (const request of calls) {
      expect(request.headers).not.toHaveProperty("Idempotency-Key");
    }
  });

  it("returns the API's 409 idempotency errors as a result, not a throw", async () => {
    stubFetch({
      status: 409,
      body: { error: { code: "invalid_idempotent_request", message: "Different payload" } },
    });

    const result = await createClient().emails.send(FULL_EMAIL, { idempotencyKey: "k" });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalid_idempotent_request");
  });
});

describe("toBase64", () => {
  it("encodes bytes the same way Buffer does", () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 251);

    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

describe("emails.attachments", () => {
  it("GETs the attachment list of an email", async () => {
    const calls = stubFetch({ body: { attachments: [] } });

    await createClient().emails.attachments("em_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/emails/em_1/attachments");
  });

  it("GETs one attachment by id", async () => {
    const calls = stubFetch({ body: { id: "att_1" } });

    await createClient().emails.getAttachment("em_1", "att_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/emails/em_1/attachments/att_1");
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
