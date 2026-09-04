import { describe, expect, it } from "vitest";
import { createClient, onlyRequest, stubFetch, useCleanEnv } from "./test-utils";
import type { SendSmsOptions } from "./types";

useCleanEnv();

/** Keyed by `keyof SendSmsOptions`, so a new option must be mapped here too. */
const SMS_WIRE_FIELDS: Record<keyof SendSmsOptions, string> = {
  from: "from",
  to: "to",
  text: "text",
};

const FULL_SMS: Required<SendSmsOptions> = {
  from: "Acme",
  to: ["+237670000000", "+237670000001"],
  text: "Your verification code is 482913",
};

describe("sms.send", () => {
  it("POSTs to /v1/sms", async () => {
    const calls = stubFetch({ body: { id: "sms_1" } });

    await createClient().sms.send(FULL_SMS);

    const request = onlyRequest(calls);
    expect(request.method).toBe("POST");
    expect(request.url.pathname).toBe("/v1/sms");
  });

  it("sends every option and nothing else", async () => {
    const calls = stubFetch({ body: { id: "sms_1" } });

    await createClient().sms.send(FULL_SMS);

    const body = onlyRequest(calls).body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(Object.values(SMS_WIRE_FIELDS).sort());
    for (const [option, wireName] of Object.entries(SMS_WIRE_FIELDS)) {
      expect(body[wireName]).toEqual(FULL_SMS[option as keyof SendSmsOptions]);
    }
  });

  it("omits the optional sender when it is not given", async () => {
    const calls = stubFetch({ body: { id: "sms_1" } });

    await createClient().sms.send({ to: "+237670000000", text: "hi" });

    expect(onlyRequest(calls).body).toEqual({ to: "+237670000000", text: "hi" });
  });
});

describe("sms.get", () => {
  it("GETs the message by id", async () => {
    const calls = stubFetch({ body: { id: "sms_1" } });

    await createClient().sms.get("sms_1");

    const request = onlyRequest(calls);
    expect(request.method).toBe("GET");
    expect(request.url.pathname).toBe("/v1/sms/sms_1");
  });
});
