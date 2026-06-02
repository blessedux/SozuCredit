#!/usr/bin/env node
/**
 * @deprecated Use scripts/sdp-reset-password.mjs (request + apply via Railway logs).
 *
 * Trigger SDP forgot-password. On Railway (DRY_RUN) no email is sent — token is in logs.
 * Usage: node scripts/sdp-forgot-password.mjs
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getSdpAdminConfig,
  loadMergedSdpEnv,
} from "./lib/sdp-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const { merged } = loadMergedSdpEnv(
  join(root, ".env.local"),
  join(root, "..", "SozuPay_dashboard", ".env.local")
);
const { apiUrl, adminEmail, tenantName } = getSdpAdminConfig(merged);

if (!apiUrl || !adminEmail) {
  console.error("Set SDP_API_URL and SDP_ADMIN_EMAIL in .env.local");
  process.exit(1);
}

const res = await fetch(`${apiUrl}/forgot-password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "SDP-Tenant-Name": tenantName,
  },
  body: JSON.stringify({ email: adminEmail }),
});

const text = await res.text();
console.log(`POST /forgot-password → HTTP ${res.status}`);
console.log(text.slice(0, 400));
if (!res.ok) process.exit(1);
console.log(
  "\nEmail is usually NOT sent (Railway EMAIL_SENDER_TYPE=DRY_RUN).",
  "Use: node scripts/sdp-reset-password.mjs (see docs/sdp-admin-password-recovery.md)"
);
