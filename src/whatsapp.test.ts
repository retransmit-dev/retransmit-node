import { describe, expect, it } from "vitest";
import { createClient, onlyRequest, stubFetch, useCleanEnv } from "./test-utils";
import type { SendWhatsappOptions } from "./types";

useCleanEnv();

/** Keyed by `keyof SendWhatsappOptions`, so a new option must be mapped here too. */
const WHATSAPP_WIRE_FIELDS: Record<keyof SendWhatsappOptions, string> = {
  from: "from",
  to: "to",
  type: "type",
  text: "text",
  previewUrl: "preview_url",
  template: "template",
  image: "image",
  document: "document",
};

/**
 * Deliberately over-populated. A real send carries one of text, template, image
 * or document, but every field must be present here to prove each one is mapped.
 */
const FULL_WHATSAPP: Required<SendWhatsappOptions> = {
  from: "+237670000000",
  to: "+237670000001",
  type: "template",
  text: "Anything else we can help with?",
  previewUrl: true,
  template: {
    name: "verification_code",
    language: "en_US",
    components: [{ type: "body", parameters: [{ type: "text", text: "482913" }] }],
  },
  image: { link: "https://example.com/a.png", caption: "a" },
  document: { link: "https://example.com/a.pdf", caption: "b", filename: "a.pdf" },
};

describe("whatsapp.send", () => {
  it("POSTs to /v1/whatsapp", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.send(FULL_WHATSAPP);

    const request = onlyRequest(calls);
    expect(request.method).toBe("POST");
    expect(request.url.pathname).toBe("/v1/whatsapp");
  });

  it("sends every option and nothing else", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.send(FULL_WHATSAPP);

    const body = onlyRequest(calls).body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(Object.values(WHATSAPP_WIRE_FIELDS).sort());
    for (const [option, wireName] of Object.entries(WHATSAPP_WIRE_FIELDS)) {
      expect(body[wireName]).toEqual(FULL_WHATSAPP[option as keyof SendWhatsappOptions]);
    }
  });

  it("renames previewUrl to preview_url", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.send({ to: "+237670000000", text: "hi", previewUrl: true });

    const body = onlyRequest(calls).body as Record<string, unknown>;
    expect(body.preview_url).toBe(true);
    expect(body).not.toHaveProperty("previewUrl");
  });

  it("passes template components through verbatim", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.send({
      to: "+237670000000",
      type: "template",
      template: FULL_WHATSAPP.template,
    });

    const body = onlyRequest(calls).body as Record<string, unknown>;
    expect(body.template).toEqual(FULL_WHATSAPP.template);
  });

  it("sends only what the caller provided for a plain text message", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.send({ to: "+237670000000", text: "hi" });

    expect(onlyRequest(calls).body).toEqual({ to: "+237670000000", text: "hi" });
  });
});

describe("whatsapp.get", () => {
  it("GETs the message by id", async () => {
    const calls = stubFetch({ body: { id: "wa_1" } });

    await createClient().whatsapp.get("wa_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/whatsapp/wa_1");
  });
});
