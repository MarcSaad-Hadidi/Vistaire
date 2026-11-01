# Direct inbound email: Cloudflare Routing → Vistaire

Scope: receive `contact@vistaire.ca`, preserve the existing verified forwarding destination, and request a Resend confirmation only for a first human message. This Worker never sends/replies to email itself. There is no `send_email` binding, Resend key, HTTP handler, `workers.dev` endpoint or preview URL.

## Configuration

| Setting | Where | Value |
| --- | --- | --- |
| `VISTAIRE_FORWARD_TO` | Cloudflare Worker private secret binding | Existing verified destination, entered privately in the dashboard. Never commit a personal mailbox. |
| `VISTAIRE_INBOUND_EMAIL_URL` | Cloudflare Worker variable | `https://www.vistaire.ca/api/inbound-email` (canonical host avoids apex redirects). |
| `VISTAIRE_INBOUND_EMAIL_SECRET` | Cloudflare Worker secret + Vercel server-only production environment | Same randomly generated secret, at least 32 characters. Never `NEXT_PUBLIC_*`, Git, screenshots or logs. |
| Resend credentials | Vercel only | Existing production Resend configuration; no key in Cloudflare. |

No forwarding address is committed. Provision `VISTAIRE_FORWARD_TO` as a private secret binding (it is omitted from `vars` so deployments cannot replace it with a placeholder). Do not attach the route until the real verified destination is configured. Wrangler deployments preserve existing secrets; verify the binding before every route switch. Never change MX, nameservers, SPF, DKIM or DMARC for this rollout. [Wrangler deployment semantics](https://developers.cloudflare.com/workers/wrangler/commands/workers/).

## Delivery and security contract

`await message.forward(VISTAIRE_FORWARD_TO)` runs before metadata extraction, signing or fetch. A forwarding exception propagates; it is never converted to a success. The current routing API returns `EmailSendResult`, whose documented success shape is `{ messageId: string }`; failures throw. Awaiting it follows the documented contract, and does not assert eventual placement in Gmail's inbox. Cloudflare retries temporary SMTP delivery failures with exponential backoff; permanent failures are returned upstream. Those SMTP retries are separate from this Worker's webhook retries. [Email Routing API](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/), [result/error interface](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/), [inbound lifecycle](https://developers.cloudflare.com/email-service/concepts/email-lifecycle/).

After forwarding, `ctx.waitUntil` runs a caught, best-effort notification. Metadata/parser/config/signing/webhook failures cannot undo forwarding. Three attempts maximum, each with a 5-second timeout and delays of 250/500 ms (15.75 seconds of fetch/delay budget). Retry only network failures, timeout, 429 and 5xx; stop on other HTTP responses. Redirects are errors. The JSON body is serialized once, and every retry uses the same body/event ID and signature timestamp. Logs contain fixed operational codes, never the subject, sender, body, secrets or server response.

`waitUntil` extends the invocation, but is not a durable queue. Runtime cancellation, quotas or a prolonged outage can lose the notification while the original mail is forwarded. The context documentation states a 30-second post-response allowance for HTTP-triggered Workers; it is not an email webhook delivery guarantee. No automatic webhook replay by Cloudflare is assumed. Introduce durable delivery only if this accepted best-effort limit proves insufficient. [Context API](https://developers.cloudflare.com/workers/runtime-apis/context/).

Only bounded metadata is posted (maximum 16 KiB UTF-8 JSON): version, stable event ID, normalized Message-ID, SMTP envelope sender/recipient, subject/date/rawSize, From/Return-Path/Content-Type, reply/automation/list headers and receivedAt. No MIME, message text/HTML, attachments or raw stream is read or posted. Oversized/invalid metadata skips confirmation rather than truncating away anti-loop evidence. RFC folded header whitespace is unfolded; other controls remain rejected.

Both runtimes trim surrounding whitespace from the configured signing secret. HMAC-SHA256 signs UTF-8 `timestamp + "." + rawBody`, using epoch seconds and hexadecimal signature in `X-Vistaire-Timestamp` / `X-Vistaire-Signature`. Vercel verifies the original bytes, time window, payload schema and recomputed digest before Resend. The signature authenticates the Worker webhook, **not the human author**.

The portable `lib/inboundEmail.ts` filters run on both sides. Skip reply headers, automated/list/bounce/report mail, Vistaire self-mail, null sender and sender uncertainty. A valid header From mailbox must equal the SMTP envelope sender. Legitimate senders using a different bounce/return mailbox or unsupported address syntax can therefore receive no confirmation; their original mail still forwards. A subject such as `Re:` alone does not identify a reply; absent/broken RFC threading headers can cause a composed or malformed reply to look new. MIME-encoded subjects use a generic bilingual subject instead of displaying raw encoded words; safe In-Reply-To/References help clients link the acknowledgement to the original message.

Cloudflare performs authentication before route execution, requires SPF or DKIM, and enforces the sending domain's DMARC policy. The Worker API exposes the envelope and message headers, **no documented trusted SPF/DKIM/DMARC result property**. Do not trust arbitrary incoming `Authentication-Results`, `Received-SPF` or `X-*` as platform attestation. ARC/SRS are added during forwarding, after the Worker decision. Matching envelope/From addresses and Cloudflare checks reduce ambiguity but do not prove mailbox ownership, especially for domains with non-enforcing DMARC. An attacker who can arrange accepted mail with both addresses spoofed remains a backscatter risk. Verify real authentication evidence in Cloudflare Activity log and received headers before enabling the route; do not claim spoof-proof operation. [Postmaster](https://developers.cloudflare.com/email-service/reference/postmaster/), [email logs](https://developers.cloudflare.com/email-service/observability/logs/).

Identity uses normalized Message-ID + normalized SMTP sender/recipient. Without valid Message-ID, SHA-256 uses sender/recipient/date/subject/rawSize/headerFrom. No UUID or receivedAt enters the identity. Identical messages without Message-ID and Date can collide, suppressing a legitimate second confirmation. A new valid Message-ID yields a new conversation identity. Resend idempotency deduplicates within **24 hours**, not forever; replay beyond that window can send another confirmation. No durable dedupe is claimed. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Email Routing itself is free; Workers processing remains subject to the account's Workers plan and quotas. Arbitrary Cloudflare Email Sending is unnecessary. Confirm available quotas before switching. [Cloudflare pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

## Rollout (order is mandatory)

These are operational steps, not actions already completed by committing this code. Keep the current direct forward rule active through step 4.

1. **Deploy the Worker without connecting the email route.** From the repository root, with an authenticated approved Wrangler CLI: `wrangler deploy --config workers/inbound-email/wrangler.jsonc`. Confirm the deployment exports an email handler, no HTTP route/binding, and the account quota is sufficient. Confirm the existing destination remains verified; a Worker does not bypass this requirement.
2. **Provision the private bindings.** `wrangler secret put VISTAIRE_FORWARD_TO --config workers/inbound-email/wrangler.jsonc`; enter the existing verified destination privately. Then provision the signing secret: `wrangler secret put VISTAIRE_INBOUND_EMAIL_SECRET --config workers/inbound-email/wrangler.jsonc`; enter a cryptographically random value with at least 32 characters. Put the identical value in Vercel's production server-only environment. Verify the canonical webhook URL and private forwarding binding. Never echo either secret.
3. **Deploy Vistaire/Vercel with `/api/inbound-email` and the production secret.** Keep `/api/contact` and its existing form behavior. Confirm the new API route is reachable, excluded from login/Clerk redirects, and unsigned requests return 401 once the secret is configured (503 while it is missing/invalid). No route switch if these fail.
4. **Verify signed connectivity without sending a confirmation.** Use the following local Bash command with the server secret already present in your private process environment (PowerShell can pipe an equivalent here-string to `node --input-type=module`). This signs a self-mail fixture, so the endpoint must acknowledge it as skipped, with no Resend send. Require HTTP 200 and the expected skip response. Also verify an invalid signature returns 401. Do not enable based solely on a local mock.

   ```bash
   node --input-type=module <<'JS'
   import { createHmac } from 'node:crypto';
   import { inboundEventId } from './lib/inboundEmail.ts';
   const secret = process.env.VISTAIRE_INBOUND_EMAIL_SECRET?.trim();
   if (!secret || secret.length < 32) throw new Error('Secret unavailable');
   const data = { messageId: '<connectivity@vistaire.ca>', from: 'contact@vistaire.ca',
     to: 'contact@vistaire.ca', subject: 'Connectivity check', date: '', rawSize: 0,
     headerFrom: 'contact@vistaire.ca', returnPath: '', contentType: '', inReplyTo: '',
     references: '', autoSubmitted: '', precedence: '', listId: '', xAutoResponseSuppress: '' };
   const body = JSON.stringify({ version: 1, ...data, eventId: await inboundEventId(data), receivedAt: new Date().toISOString() });
   const timestamp = String(Math.floor(Date.now() / 1000));
   const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
   const response = await fetch('https://www.vistaire.ca/api/inbound-email', { method: 'POST',
     redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-Vistaire-Timestamp': timestamp,
       'X-Vistaire-Signature': signature }, body, signal: AbortSignal.timeout(5000) });
   console.log('HTTP', response.status, await response.text());
   if (response.status !== 200) process.exitCode = 1;
   JS
   ```

5. **Switch only the `contact@vistaire.ca` routing action** from its existing verified direct forward to `vistaire-inbound-email`. Record the previous rule privately for rollback; leave unrelated addresses/catch-all untouched. Check the actual Worker deployment, private forward binding, destination verification and both copies of the secret immediately before switching. No DNS changes.
6. **Run live smoke tests.** From a real external Gmail and Outlook mailbox, send a new thread with a valid Message-ID/From/envelope. Verify original delivery to the destination, exactly one premium confirmation and Cloudflare/Resend logs. Reply twice: originals must forward with zero new confirmations. Compose another new thread: one new confirmation. Replay a fixture within the provider window: no duplicate confirmation. Send automation/list/bounce fixtures: forward, zero confirmation. Verify real authentication results in Activity log/received headers. Exercise webhook failure only in a safe test environment and observe forwarding survives. Record what was genuinely tested; a Node mock is not real SMTP delivery or client rendering evidence.

Do not mark inbound production live until the route, destination delivery and these external service tests were actually observed. No credentials/session means deployment and routing remain pending, even when all local tests pass.

## Rollback and operations

Restore `contact@vistaire.ca` to the **previous verified direct forward** destination immediately if any original mail delivery fails, if unexpected confirmations/backscatter occur, or if configuration cannot be verified. Keep DNS and other routing rules intact. Verify a real original message arrives after rollback. The Worker/endpoint may remain deployed for diagnosis; no secret rotation/deletion or destructive infrastructure action is needed for rollback.

Inspect Cloudflare Email Routing Activity log for `Forwarded`, `Handled`, `Delivery failed` and `Error`; inspect only sanitized Worker failure codes and Resend send/idempotency outcomes. `Handled` alone does not prove destination delivery. Temporary SMTP retry is not notification retry. If webhook attempts exhaust, the confirmation may be missing; the original remains the operator's source of truth. [Email logs](https://developers.cloudflare.com/email-service/observability/logs/).

## Local checks

- `node --test tests/inbound-email-worker.test.mjs`: transfer priority, schema/HMAC compatibility, duplicate identity, thread/anti-loop filters, forwarding errors, missing config, metadata/parser failures, bounded network/429/5xx/timeout retry and non-retriable 4xx.
- Repository checks: `npm run assets:check`, `npm run lfs:check`, `npm run lint`, `npm run typecheck`, `npm run build`.
- `wrangler deploy --dry-run --config workers/inbound-email/wrangler.jsonc` with a locally available CLI, without login or deployment; never confuse dry-run or mocks with the live rollout.

No package/framework or durable queue is introduced. Local validation does not require Cloudflare credentials; live deployment does. Source files follow [the repository asset policy](../repo-asset-policy.md).
