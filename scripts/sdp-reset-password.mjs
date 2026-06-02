#!/usr/bin/env node
/**
 * Reset SDP NGO operator password without email (Railway EMAIL_SENDER_TYPE=DRY_RUN).
 *
 * 1) Request reset (token is logged on Railway, not emailed):
 *    node scripts/sdp-reset-password.mjs request
 *    → Railway dashboard → sdp-v2 service → Logs → search "reset-password" or "token="
 *
 * 2) Apply new password (12–36 chars, upper, lower, digit, symbol):
 *    node scripts/sdp-reset-password.mjs apply --token='<from-logs>' --password='SozuAdmin2026!'
 *
 * 3) Copy the same password into SDP_ADMIN_PASSWORD (.env.local + Vercel) and verify:
 *    node scripts/sdp-diagnose-admin-env.mjs
 *
 * You cannot recover the old plaintext password from SDP or Postgres — only reset.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getSdpAdminConfig,
  loadMergedSdpEnv,
  sdpAdminLogin,
  sdpPasswordPolicyIssues,
} from "./lib/sdp-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { merged } = loadMergedSdpEnv(
  join(root, ".env.local"),
  join(root, "..", "SozuPay_dashboard", ".env.local")
);
const config = getSdpAdminConfig(merged);

function parseArgs(argv) {
  const cmd = argv[0] ?? "help";
  const opts = {};
  for (const a of argv.slice(1)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return { cmd, opts };
}

async function postJson(path, body) {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "SDP-Tenant-Name": config.tenantName,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { res, data };
}

const { cmd, opts } = parseArgs(process.argv.slice(2));

if (!config.apiUrl || !config.adminEmail) {
  console.error("Set SDP_API_URL and SDP_ADMIN_EMAIL in .env.local");
  process.exit(1);
}

if (cmd === "request") {
  const { res, data } = await postJson("/forgot-password", {
    email: config.adminEmail,
  });
  console.log(`POST /forgot-password → HTTP ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);
  console.log(`
Next steps (email is DRY_RUN on Railway — nothing arrives in inbox):

1. Open Railway → project → service sdp-v2 (or sdp-api) → **Logs**
2. Search for: reset-password   or   token=
3. Copy the token from the URL, e.g. .../reset-password?token=XXXXXXXX
4. Run:
   node scripts/sdp-reset-password.mjs apply --token='XXXXXXXX' --password='YourNewPass2026!'
5. Put that password in SDP_ADMIN_PASSWORD (SozuCredit + SozuPay .env.local + Vercel)
6. node scripts/sdp-diagnose-admin-env.mjs  → should show "token received"
`);
  process.exit(0);
}

if (cmd === "apply") {
  const token = opts.token?.trim();
  const password = opts.password ?? "";
  if (!token || !password) {
    console.error(
      "Usage: node scripts/sdp-reset-password.mjs apply --token='<from-railway-logs>' --password='SozuAdmin2026!'"
    );
    process.exit(1);
  }
  const issues = sdpPasswordPolicyIssues(password);
  if (issues.length) {
    console.error("Password invalid for SDP:", issues.join(", "));
    process.exit(1);
  }
  const { res, data } = await postJson("/reset-password", {
    reset_token: token,
    password,
  });
  console.log(`POST /reset-password → HTTP ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);

  const login = await sdpAdminLogin({ ...config, adminPassword: password });
  if (login.res.ok && login.data.token) {
    console.log("\n✓ Login works with the new password. Update SDP_ADMIN_PASSWORD in all envs to this value.");
  } else {
    console.log(
      "\nReset returned OK but login probe failed — token may have been wrong tenant or password not saved. Try request again."
    );
    console.log(JSON.stringify(login.data));
    process.exit(1);
  }
  process.exit(0);
}

console.log(`Usage:
  node scripts/sdp-reset-password.mjs request
  node scripts/sdp-reset-password.mjs apply --token='...' --password='SozuAdmin2026!'

Also: node scripts/sdp-diagnose-admin-env.mjs
`);
