import { describe, expect, it } from "vitest";
import { Batch, Emails, EMAIL_STATUSES, Retransmit, SMS_STATUSES, Sms, Whatsapp, WHATSAPP_STATUSES } from "../src/index";
import { TEST_API_KEY, useCleanEnv } from "./test-utils";

useCleanEnv();

describe("public entry point", () => {
  it("exports the client and every channel class", () => {
    expect(Retransmit).toBeTypeOf("function");
    expect(Emails).toBeTypeOf("function");
    expect(Sms).toBeTypeOf("function");
    expect(Whatsapp).toBeTypeOf("function");
    expect(Batch).toBeTypeOf("function");
  });

  it("exposes the channels as instances on a client", () => {
    const client = new Retransmit(TEST_API_KEY);

    expect(client.emails).toBeInstanceOf(Emails);
    expect(client.sms).toBeInstanceOf(Sms);
    expect(client.whatsapp).toBeInstanceOf(Whatsapp);
    expect(client.batch).toBeInstanceOf(Batch);
  });

  it("exports the status constants used to narrow webhook payloads", () => {
    // These must stay in step with the API's status values.
    expect(EMAIL_STATUSES).toContain("delivered");
    expect(SMS_STATUSES).toContain("undelivered");
    expect(WHATSAPP_STATUSES).toEqual(["queued", "sent", "delivered", "read", "failed"]);
  });
});
