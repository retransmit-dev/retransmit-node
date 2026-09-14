# retransmit.dev

[![CI](https://github.com/retransmit-dev/retransmit-node/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/retransmit-dev/retransmit-node/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/retransmit.dev)](https://www.npmjs.com/package/retransmit.dev)
[![license](https://img.shields.io/npm/l/retransmit.dev)](https://github.com/retransmit-dev/retransmit-node/blob/main/LICENSE)

Node.js SDK for the [Retransmit](https://retransmit.dev) messaging API. Send email, SMS, and WhatsApp through one typed client. Zero dependencies, works on Node 18+ and edge runtimes with `fetch`.

| Channel | SDK namespace | Availability |
| --- | --- | --- |
| Email | `retransmit.emails` | Available |
| SMS | `retransmit.sms` | Available |
| WhatsApp | `retransmit.whatsapp` | Available |

## Install

```bash
npm install retransmit.dev
# or
pnpm add retransmit.dev
```

## Create a client

Grab an API key from your Retransmit dashboard, then:

```ts
import { Retransmit } from "retransmit.dev";

const retransmit = new Retransmit("rt_xxxxxxxxxxxx");
// or set RETRANSMIT_API_KEY and call `new Retransmit()`
```

## Email

```ts
const { data, error } = await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Hello from Retransmit",
  html: "<p>It works!</p>",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.id); // em_xxxxxxxxxxxx
}
```

Emails are queued and sent asynchronously. Check the outcome later:

```ts
const { data } = await retransmit.emails.get("em_xxxxxxxxxxxx");
console.log(data?.status); // "delivered"
```

### Tags

Attach up to 10 `{ name, value }` tags to an email to label it. Filter by
them in the dashboard or with `emails.list`. Tags come back on `emails.get`
and are never sent to the recipient.

```ts
await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Your receipt",
  html: "<p>Thanks for your order!</p>",
  tags: [
    { name: "category", value: "receipt" },
    { name: "campaign", value: "spring-2026" },
  ],
});
```

Names and values allow letters, digits, underscores and dashes, up to 256
characters each. Names must be unique within one email. Batch emails accept
the same `tags` field.

### Custom headers

Add your own message headers with `headers`. The common case is a unique
`X-Entity-Ref-ID` per email so Gmail does not thread related messages, such as
order updates with the same subject, into one conversation.

```ts
await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Your order shipped",
  html: "<p>Order #4821 is on its way.</p>",
  headers: { "X-Entity-Ref-ID": "order_4821" },
});
```

Up to 20 headers per email. Names are printable ASCII without `:` and may
only appear once; values are a single line. Headers Retransmit sets itself,
like `From`, `To`, `Subject`, `Date` or `Message-ID`, are rejected with a
`validation_error`. Marketing emails keep the hosted `List-Unsubscribe`
headers even if you pass your own. Headers come back on `emails.get`, and
batch emails accept the same field.

### Attachments

Attach up to 20 files, 30 MB in total. Pass the bytes as `content` (a
`Buffer`, `Uint8Array` or base64 string), or a public URL as `path` and
Retransmit fetches it while the request runs. Either way the file travels
inside the email.

```ts
import { readFile } from "node:fs/promises";

await retransmit.emails.send({
  from: "Acme <billing@yourdomain.com>",
  to: "user@example.com",
  subject: "Your invoice",
  html: "<p>Your invoice is attached.</p>",
  attachments: [
    { filename: "invoice.pdf", content: await readFile("./invoice.pdf") },
    { filename: "terms.pdf", path: "https://yourdomain.com/terms.pdf" },
  ],
});
```

To embed an image in the HTML, give it a `contentId` and reference it as
`cid:`:

```ts
await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Welcome",
  html: '<p><img src="cid:logo" alt="Acme" /> Glad to have you.</p>',
  attachments: [{ filename: "logo.png", path: "https://yourdomain.com/logo.png", contentId: "logo" }],
});
```

Executables, scripts and installers are rejected with `invalid_attachment`,
and `batch.send` does not accept attachments. Files are kept for 30 days so
you can see what went out:

```ts
const { data } = await retransmit.emails.attachments("em_xxxxxxxxxxxx");
// data.attachments: [{ id, filename, content_type, size, download_url, expires_at, ... }]
```

`download_url` is signed and valid for one hour; it is `null` once the file
has expired.

### Idempotency

A send can succeed on the server and still fail on your side, through a
timeout or a dropped connection. Retrying it blindly sends the email twice.
Pass an `idempotencyKey` and retries become safe: for 24 hours the same key
with the same payload returns the original response, `id` included, and
nothing is queued again.

```ts
await retransmit.emails.send(
  {
    from: "Acme <hello@yourdomain.com>",
    to: "user@example.com",
    subject: "Welcome to Acme",
    html: "<p>Glad to have you.</p>",
  },
  { idempotencyKey: "welcome-user/123" },
);
```

Use a value that identifies that exact email, such as a UUID or
`<event>/<entity-id>`. Keys are 1 to 256 characters and are shared by every
API key in your organization. The same key with a different payload returns
`invalid_idempotent_request`; a retry that overlaps the first request returns
`concurrent_idempotent_requests`, so wait a moment and try again. Batches
accept the same option with one key for the whole batch.

### Scheduling

Pass `scheduledAt` to send later instead of now. It takes an ISO 8601 instant
with an offset, which is what `Date.toISOString()` gives you. The time must be
in the future and at most 30 days ahead. A bare local time such as
`"2026-09-20T09:00:00"` is rejected: it would mean one instant on your clock
and another on ours.

```ts
const delayMinutes = 60;
const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

const { data } = await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Your trial ends tomorrow",
  html: "<p>Here is what happens next.</p>",
  scheduledAt,
});

console.log(data?.status); // "scheduled"
```

An absolute time works the same way:

```ts
scheduledAt: new Date("2026-09-20T09:00:00Z").toISOString(),
```

Until it goes out you can move it or stop it:

```ts
await retransmit.emails.reschedule("em_xxxxxxxxxxxx", {
  scheduledAt: new Date("2026-09-21T09:00:00Z").toISOString(),
});

await retransmit.emails.cancel("em_xxxxxxxxxxxx");
```

Both fail with `not_scheduled` once the email has left the queue — a sent
email cannot be recalled. A cancelled email is not deleted: it keeps status
`canceled` and stays visible in `get` and `list`. Only the schedule can be
changed; to change the content, send a new email.

`batch.send` takes `scheduledAt` per email, so one batch can mix immediate and
scheduled sends.

### Why an email bounced

When `status` is `bounced`, `bounceReason` on a retrieved email says why, read
from the SMTP response the receiving server returned. The distinction worth
acting on is whether the address is bad or whether your sending was refused:

```ts
const { data } = await retransmit.emails.get("em_xxxxxxxxxxxx");

if (data?.bounce_reason === "spam_block") {
  // The content was filtered. The address is fine and is not suppressed.
} else if (data?.bounce_reason === "mailbox_not_found") {
  // The address is dead and has been added to your suppression list.
}
```

| Reason | Suppressed | Meaning |
| --- | --- | --- |
| `mailbox_not_found` | Yes | No account with that address. |
| `mailbox_inactive` | Yes | The account is disabled, suspended or unused. |
| `dns_failure` | Yes | The domain has no reachable mail server. |
| `policy_block` | Yes | A rule on the recipient's side refused the message. |
| `provider_suppressed` | Yes | On the upstream provider's suppression list from an earlier bounce. |
| `mailbox_full` | No | Over quota. Usually clears on its own. |
| `spam_block` | No | A spam filter rejected the content. |
| `reputation_block` | No | Your sending IP or domain is blocked or on a blocklist. |
| `authentication_failure` | No | SPF, DKIM or DMARC did not pass at the receiver. |
| `rate_limited` | No | The receiving server is throttling you. |
| `message_too_large` | No | Over the receiver's size limit. |
| `content_rejected` | No | An attachment or the body was refused. |
| `unknown` | Yes | No recognisable reason. Treated as a bad address. |

Reasons marked "Suppressed" add the recipient to your suppression list. The
rest leave the address alone: the mailbox is fine, and it will accept mail
again once the underlying problem is fixed.

No mailbox provider reports spam-folder placement back to a sender, so a
`spam_block` bounce is the only direct signal that filtering is happening.
An email filed silently into junk counts as `delivered`.

### List and filter emails

`emails.list` returns your emails newest first. Every tag you pass must match.
Combine with `status` or `batchId`, and page with `cursor`:

```ts
const { data } = await retransmit.emails.list({
  tags: [{ name: "campaign", value: "spring-2026" }],
  status: "bounced",
  limit: 100,
});

for (const email of data!.emails) {
  console.log(email.id, email.to, email.status, email.bounce_reason);
}

if (data!.has_more) {
  await retransmit.emails.list({ cursor: data!.next_cursor!, /* same filters */ });
}
```

To see which tags exist on your account, and how many emails carry each:

```ts
const { data } = await retransmit.emails.tags();
// data.tags: [{ name: "campaign", value: "spring-2026", count: 1240 }, ...]
```

## SMS

Use international E.164 phone numbers. A single request can contain up to 50
recipients, all in the same country.

```ts
const { data, error } = await retransmit.sms.send({
  from: "Acme",
  to: "+237670000000",
  text: "Your verification code is 482913",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.id, data.country, data.segments);
}
```

SMS messages are also asynchronous:

```ts
const { data } = await retransmit.sms.get("sms_xxxxxxxxxxxx");
console.log(data?.status); // "sent" | "delivered" | "undelivered" | ...
```

### Sender IDs

`from` is the name shown on the handset instead of a phone number. Approval is
per country, so request it first in the dashboard under **SMS > Sender IDs**.
The request asks for the name and the countries you send to. Most countries
accept the name as it is; where the carriers require a registration, the form
adds what that filing needs (what you send, a sample message, your legal
entity). Retransmit files it for you, and there is no AWS or carrier account to
set up.

Sending with a name that is not approved for the destination country fails with
`sender_not_allowed`. Leave `from` out to use your approved sender for that
country, or the provider default when you have none.

The United States, Canada, and Mexico do not accept alphanumeric sender IDs.

### Choosing a carrier

You do not have to work out which carrier fits a number. Leave `provider` out
and Retransmit routes by destination country and price.

Pass it to pin the send to one carrier. `sns` (AWS End User Messaging) is the
one that reaches every destination; `mtn` and `orange` only cover the countries
Retransmit has that carrier in:

```ts
await retransmit.sms.send({
  to: "+237670000000",
  text: "Your verification code is 482913",
  provider: "sns", // "sns" | "mtn" | "orange"
});
```

The value is the carrier, not one of its country operations, so it keeps
working as more countries are added. A pinned send never falls back: if that
carrier cannot deliver to the destination, the request fails with `no_route`.

`get` returns both. `requested_provider` is what you asked for, `provider` is
the country operation that carried the message (`mtn_cm`, `orange_cm`,
`aws_sns`), and is null until the message is routed.

## Email batches

Send up to 10,000 emails in one request:

```ts
const { data: batch } = await retransmit.batch.send(
  [
    { from: "Acme <hello@yourdomain.com>", to: "a@example.com", subject: "Hi", text: "Hello A" },
    { from: "Acme <hello@yourdomain.com>", to: "b@example.com", subject: "Hi", text: "Hello B" },
  ],
  { idempotencyKey: "weekly-digest/2026-09-07" },
);

const { data: progress } = await retransmit.batch.get(batch!.id);
console.log(progress?.processed, "/", progress?.total, progress?.counts);
```

## WhatsApp

Connect your WhatsApp Business number in the dashboard first. One recipient
per request, in E.164 format. Start a conversation with an approved template;
once the recipient replies you can send free-form text and media for 24 hours.

```ts
const { data, error } = await retransmit.whatsapp.send({
  to: "+237670000000",
  type: "template",
  template: {
    name: "verification_code",
    language: "en_US",
    components: [{ type: "body", parameters: [{ type: "text", text: "482913" }] }],
  },
});

// Inside the 24-hour window:
await retransmit.whatsapp.send({ to: "+237670000000", text: "Anything else we can help with?" });
```

Check the outcome, including `read` receipts:

```ts
const { data } = await retransmit.whatsapp.get("wa_xxxxxxxxxxxx");
console.log(data?.status); // "sent" | "delivered" | "read" | "failed"
```

Replies from recipients reach you as `whatsapp.received` webhooks.

## Error handling

Methods never throw on API errors — they return `{ data, error }`:

```ts
const { data, error } = await retransmit.sms.send(/* ... */);
if (error) {
  // error.code: "validation_error" | "no_route" | "unauthorized" | ...
}
```

Only constructing the client without an API key throws.

### Plan limits

A send returns `quota_exceeded` when the account is out of included emails with
no payment method on file, or when SMS or WhatsApp is sent without one. Those
two channels are pay as you go on every plan, so they always need a card. The
error carries the numbers, and is not worth retrying — the fix is in
[the dashboard](https://app.retransmit.dev/settings/billing):

```ts
const { error } = await retransmit.emails.send(/* ... */);
if (error?.code === "quota_exceeded") {
  console.error(`Used ${error.used} of ${error.limit} emails this period`);
}
```

## Configuration

| Option | Env var | Default |
| --- | --- | --- |
| `apiKey` (first argument) | `RETRANSMIT_API_KEY` | — (required) |
| `baseUrl` | `RETRANSMIT_BASE_URL` | `https://api.retransmit.dev` |

## License

MIT
