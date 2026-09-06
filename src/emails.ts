import type { Retransmit } from "./retransmit";
import type {
  Attachment,
  EmailAttachmentWithDownload,
  GetEmailResponse,
  ListEmailAttachmentsResponse,
  ListEmailTagsResponse,
  ListEmailsOptions,
  ListEmailsResponse,
  RequestOptions,
  Result,
  SendEmailOptions,
  SendEmailResponse,
} from "./types";

/** Base64 without relying on `Buffer`, so the SDK also works on edge runtimes. */
export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function toWireAttachment(attachment: Attachment) {
  return {
    filename: attachment.filename,
    content:
      attachment.content === undefined || typeof attachment.content === "string"
        ? attachment.content
        : toBase64(attachment.content),
    path: attachment.path,
    content_type: attachment.contentType,
    content_id: attachment.contentId,
  };
}

/** Maps the camelCase SDK options onto the snake_case wire format. */
export function toWirePayload(options: SendEmailOptions) {
  return {
    from: options.from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    reply_to: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    marketing: options.marketing,
    tags: options.tags,
    headers: options.headers,
    attachments: options.attachments?.map(toWireAttachment),
  };
}

export class Emails {
  constructor(private readonly client: Retransmit) {}

  /**
   * Queues a single email. Poll `get(id)` or subscribe to webhooks for the
   * outcome. Pass `{ idempotencyKey }` to make the call safe to retry.
   */
  send(
    options: SendEmailOptions,
    requestOptions?: RequestOptions,
  ): Promise<Result<SendEmailResponse>> {
    return this.client.request(
      "POST",
      "/v1/emails",
      toWirePayload(options),
      undefined,
      requestOptions,
    );
  }

  /** Retrieves an email with its current status and event history. */
  get(id: string): Promise<Result<GetEmailResponse>> {
    return this.client.request("GET", `/v1/emails/${encodeURIComponent(id)}`);
  }

  /**
   * Lists your emails, newest first, optionally filtered by tags, status or
   * batch. Pass `next_cursor` back as `cursor` to page through the results.
   */
  list(options: ListEmailsOptions = {}): Promise<Result<ListEmailsResponse>> {
    return this.client.request("GET", "/v1/emails", undefined, {
      tag: options.tags?.map((tag) => `${tag.name}:${tag.value}`),
      status: options.status,
      batch_id: options.batchId,
      limit: options.limit,
      cursor: options.cursor,
    });
  }

  /** Every distinct tag on your emails, with a count of emails carrying it. */
  tags(): Promise<Result<ListEmailTagsResponse>> {
    return this.client.request("GET", "/v1/emails/tags");
  }

  /**
   * The attachments of an email, each with a signed `download_url` valid for
   * one hour. Files are kept for 30 days after the send; after that the link
   * is `null` and only the metadata remains.
   */
  attachments(emailId: string): Promise<Result<ListEmailAttachmentsResponse>> {
    return this.client.request("GET", `/v1/emails/${encodeURIComponent(emailId)}/attachments`);
  }

  /** One attachment of an email with a signed download link. */
  getAttachment(
    emailId: string,
    attachmentId: string,
  ): Promise<Result<EmailAttachmentWithDownload>> {
    return this.client.request(
      "GET",
      `/v1/emails/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  }
}
