#!/usr/bin/env node
/**
 * Trigger SDP forgot-password email for the NGO operator account.
 * After you set a new password via the email link, copy that exact password into
 * SDP_ADMIN_PASSWORD in SozuCredit + SozuPay .env.local and Vercel.
 *
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
  "\nCheck the inbox for",
  adminEmail,
  "(and spam). Set a password that satisfies SDP: 8+ chars, upper, lower, digit, symbol.",
  "Then put the SAME password in SDP_ADMIN_PASSWORD everywhere and run sdp-lookup-receiver-dob.mjs again."
);
