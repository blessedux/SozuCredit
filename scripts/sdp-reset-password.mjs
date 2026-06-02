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
  listSdpAuthUserEmails,
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
  let res;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "SDP-Tenant-Name": config.tenantName,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const cause = e instanceof Error ? e.cause ?? e : e;
    const msg = cause instanceof Error ? cause.message : String(cause);
    console.error(
      `Network error calling ${config.apiUrl}${path}: ${msg}\n` +
        "Check internet/DNS. Try: curl -I " +
        config.apiUrl +
        "/health"
    );
    process.exit(1);
  }
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
  const authUsers = listSdpAuthUserEmails(merged);
  if (authUsers?.emails) {
    const want = config.adminEmail.trim().toLowerCase();
    if (!authUsers.emails.includes(want)) {
      console.error(
        `SDP_ADMIN_EMAIL=${config.adminEmail} is NOT in auth_users.\n` +
          `Registered operator email(s): ${authUsers.emails.join(", ")}\n` +
          `Update SDP_ADMIN_EMAIL in .env.local, then re-run this command.`
      );
      process.exit(1);
    }
  } else if (authUsers?.error) {
    console.error(`(Could not preflight auth_users: ${authUsers.error})`);
  }

  const { res, data } = await postJson("/forgot-password", {
    email: config.adminEmail,
  });
  console.log(`POST /forgot-password → HTTP ${res.status} (email=${config.adminEmail})`);
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);
  console.log(`
If this email is NOT in SDP auth_users, Railway logs show:
  level=error ... email not found
  (API still returns 200 — no email/token is created.)

List real operator emails:
  node scripts/sdp-list-auth-users.mjs   (needs SDP_DATABASE_PUBLIC_URL)

With EMAIL_SENDER_TYPE=TWILIO_EMAIL on Railway, a valid user gets a real reset email.

Or read token from DB (valid ~20 min) and run apply:
  node scripts/sdp-reset-password.mjs apply --token='...' --password='SozuAdmin2026!'
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
