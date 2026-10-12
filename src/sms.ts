import type { Retransmit } from "./retransmit";
import type {
  GetSmsResponse,
  OptOutSmsOptions,
  RecordSmsConsentOptions,
  Result,
  SendSmsOptions,
  SendSmsResponse,
  SmsConsentResponse,
  SmsOptOutResponse,
} from "./types";

export class Sms {
  constructor(private readonly client: Retransmit) {}

  /** Queues a single SMS. Poll `get(id)` or subscribe to webhooks for the outcome. */
  send(options: SendSmsOptions): Promise<Result<SendSmsResponse>> {
    return this.client.request("POST", "/v1/sms", {
      from: options.from,
      to: options.to,
      text: options.text,
      purpose: options.purpose,
      provider: options.provider,
    });
  }

  /** Records affirmative consent before the first send to a recipient. */
  recordConsent(options: RecordSmsConsentOptions): Promise<Result<SmsConsentResponse>> {
    return this.client.request("POST", "/v1/sms/consents", {
      from: options.from,
      phone: options.phone,
      purposes: options.purposes,
      method: options.method,
      source: options.source,
      disclosure_text: options.disclosure_text,
      evidence_url: options.evidence_url,
      consented_at: options.consented_at,
      confirmed_at: options.confirmed_at,
    });
  }

  /** Immediately suppresses a recipient across every program in the organization. */
  optOut(options: OptOutSmsOptions): Promise<Result<SmsOptOutResponse>> {
    return this.client.request("POST", "/v1/sms/opt-outs", {
      phone: options.phone,
      reason: options.reason,
      source: options.source,
    });
  }

  /** Retrieves an SMS with its current status and event history. */
  get(id: string): Promise<Result<GetSmsResponse>> {
    return this.client.request("GET", `/v1/sms/${encodeURIComponent(id)}`);
  }
}
