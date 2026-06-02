import "server-only";

import { appendFileSync } from "fs";

const ENDPOINT =
  "http://127.0.0.1:7454/ingest/aec984e4-6773-4680-98b7-b535bc491a52";
const SESSION_ID = "d5ebeb";
const LOG_PATH =
  "/Users/JoaquinNam/Desktop/SOZUCAPITAL/SozuCredit/.cursor/debug-d5ebeb.log";

/** Server-side debug log for SDP registration (no tokens/OTP). */
export function sdpDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string
): void {
  const entry = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId: "pre-fix",
  };

  // #region agent log
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // ignore when log dir missing
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[SDP_DEBUG]", JSON.stringify(entry));
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}

/** Mask email for logs: keep domain + first char of local part. */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return "(invalid)";
  const head = local?.charAt(0) ?? "?";
  return `${head}***@${domain}`;
}
