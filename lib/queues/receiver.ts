/**
 * lib/queues/receiver.ts
 *
 * QStash request verification helper.
 *
 * QStash signs every outgoing HTTP request with HMAC-SHA-256. Receivers MUST
 * verify this signature to prevent arbitrary actors from triggering agents.
 *
 * Required env vars:
 *   QSTASH_CURRENT_SIGNING_KEY  — upstash.com > QStash > Signing Keys (current)
 *   QSTASH_NEXT_SIGNING_KEY     — upstash.com > QStash > Signing Keys (next)
 *
 * Usage:
 *   const rawBody = await verifyQStashRequest(req); // throws if invalid
 *   const payload = JSON.parse(rawBody);
 */

import { Receiver } from "@upstash/qstash";

let _receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!_receiver) {
    const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const next = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!current || !next) {
      throw new Error(
        "QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be set in .env.local"
      );
    }
    _receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  }
  return _receiver;
}

/**
 * Verify a QStash request signature.
 *
 * Reads and returns the raw body string so the caller can parse it.
 * Throws an error (with descriptive message) if verification fails.
 *
 * IMPORTANT: This consumes the request body stream. Do NOT call req.json()
 * or req.text() before calling this function.
 */
export async function verifyQStashRequest(req: Request): Promise<string> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    throw new Error("Missing upstash-signature header — request did not come from QStash");
  }

  const body = await req.text();

  const isValid = await getReceiver().verify({
    signature,
    body,
    clockTolerance: 5, // seconds, accounts for minor clock skew
  });

  if (!isValid) {
    throw new Error("QStash signature verification failed — request rejected");
  }

  return body;
}
