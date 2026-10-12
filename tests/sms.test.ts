import { describe, expect, it } from "vitest";
import { createClient, onlyRequest, stubFetch, useCleanEnv } from "./test-utils";
import type {
  OptOutSmsOptions,
  RecordSmsConsentOptions,
  SendSmsOptions,
} from "../src/types";

useCleanEnv();

/** Keyed by `keyof SendSmsOptions`, so a new option must be mapped here too. */
const SMS_WIRE_FIELDS: Record<keyof SendSmsOptions, string> = {
  from: "from",
  to: "to",
  text: "text",
  purpose: "purpose",
  provider: "provider",
};

const FULL_SMS: Required<SendSmsOptions> = {
  from: "Acme",
  to: ["+237670000000", "+237670000001"],
  text: "Your verification code is 482913",
  purpose: "otp",
  provider: "sns",
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

  it("omits the optional provider when it is not given", async () => {
    const calls = stubFetch({ body: { id: "sms_1" } });

    await createClient().sms.send({
      from: "DISCOLAIRE",
      to: "+237670000000",
      text: "Your account was updated.",
      purpose: "account",
    });

    expect(onlyRequest(calls).body).toEqual({
      from: "DISCOLAIRE",
      to: "+237670000000",
      text: "Your account was updated.",
      purpose: "account",
    });
  });
});

describe("sms consent", () => {
  const consent: RecordSmsConsentOptions = {
    from: "DISCOLAIRE",
    phone: "+237670000000",
    purposes: ["otp", "account"],
    method: "web_form",
    source: "Discolaire notification settings",
    disclosure_text: "I agree to receive transactional SMS from Discolaire.",
    evidence_url: "https://discolaire.com/sms-opt-in",
  };

  it("records consent through /v1/sms/consents", async () => {
    const calls = stubFetch({ body: { id: "scn_1" }, status: 201 });
    await createClient().sms.recordConsent(consent);

    const request = onlyRequest(calls);
    expect(request.method).toBe("POST");
    expect(request.url.pathname).toBe("/v1/sms/consents");
    expect(request.body).toEqual(consent);
  });

  it("suppresses a recipient through /v1/sms/opt-outs", async () => {
    const calls = stubFetch({ body: { id: "ssp_1" }, status: 201 });
    const optOut: OptOutSmsOptions = {
      phone: "+237670000000",
      reason: "opt_out",
      source: "Discolaire notification settings",
    };
    await createClient().sms.optOut(optOut);

    const request = onlyRequest(calls);
    expect(request.url.pathname).toBe("/v1/sms/opt-outs");
    expect(request.body).toEqual(optOut);
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
