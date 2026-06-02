#!/usr/bin/env node
/**
 * Look up a receiver's verification DOB in SDP (plaintext from admin API).
 *
 * Usage:
 *   node scripts/sdp-lookup-receiver-dob.mjs inboxmentemaestra@gmail.com
 *
 * Env (from SozuPay dashboard .env.local or export):
 *   SDP_API_URL, SDP_ADMIN_EMAIL, SDP_ADMIN_PASSWORD, SDP_TENANT_NAME (optional)
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
const dashboardEnv = join(root, "..", "SozuPay_dashboard", ".env.local");

const { merged } = loadMergedSdpEnv(join(root, ".env.local"), dashboardEnv);

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/sdp-lookup-receiver-dob.mjs <email>");
  process.exit(1);
}

const config = getSdpAdminConfig(merged);

if (!config.apiUrl || !config.adminEmail || !config.adminPassword) {
  console.error(
    "Set SDP_API_URL, SDP_ADMIN_EMAIL, SDP_ADMIN_PASSWORD (real password, not TODO) in .env.local"
  );
  process.exit(1);
}

const policyIssues = sdpPasswordPolicyIssues(config.adminPassword);
console.error(
  `[env] api=${config.apiUrl} tenant=${config.tenantName} email=${config.adminEmail} password_len=${config.adminPassword.length} policy_ok=${policyIssues.length === 0}`
);
if (policyIssues.length) {
  console.error(
    `[warn] SDP_ADMIN_PASSWORD fails SDP policy (${policyIssues.join(", ")}). ` +
      "A random string in .env alone does not update SDP — use forgot-password or SDP UI, then sync .env."
  );
}

async function sdpFetch(path, token) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "SDP-Tenant-Name": config.tenantName,
  };
  const res = await fetch(`${config.apiUrl}${path}`, { headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) throw new Error(`SDP ${path} HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function login() {
  const { res, data } = await sdpAdminLogin(config);
  if (res.ok && data.token) return data.token;
  if (res.ok && data.message?.includes("MFA")) {
    throw new Error(
      `Login requires MFA (${data.message}). Complete MFA in SDP UI, or disable MFA for this user on Railway.`
    );
  }
  if (!res.ok) {
    const hint =
      policyIssues.length > 0
        ? " Password in .env may never have been accepted by SDP (policy). Run: node scripts/sdp-forgot-password.mjs"
        : " Password in .env does not match SDP database. Run forgot-password or reset in SDP UI, then copy the same password into .env.";
    throw new Error(
      `Login failed (HTTP ${res.status}): ${JSON.stringify(data)}.${hint}`
    );
  }
  throw new Error(`Login OK but no token: ${JSON.stringify(data)}`);
}

function dobFromReceiver(r) {
  const raw =
    r.payment?.verification_field_value?.trim() ??
    r.payment?.verification?.trim() ??
    "";
  return raw || "(empty — SDP may default to 2000-01-01 on upload)";
}

const token = await login();
const { data: disbursements } = await sdpFetch("/disbursements?page=1&page_limit=100", token);

const hits = [];
for (const d of disbursements ?? []) {
  const { data: receivers } = await sdpFetch(
    `/disbursements/${d.id}/receivers?page=1&page_limit=200`,
    token
  );
  for (const r of receivers ?? []) {
    if (r.email?.trim().toLowerCase() === emailArg) {
      hits.push({
        disbursementId: d.id,
        disbursementName: d.name,
        status: d.status,
        receiverId: r.id,
        externalId: r.external_id,
        walletStatus: r.receiver_wallet?.status,
        verificationDob: dobFromReceiver(r),
      });
    }
  }
}

if (hits.length === 0) {
  console.log(`No receiver found for ${emailArg}`);
  process.exit(0);
}

console.log(`Found ${hits.length} receiver row(s) for ${emailArg}:\n`);
for (const h of hits) {
  console.log(JSON.stringify(h, null, 2));
  console.log("");
}

if (hits.length > 1) {
  console.warn(
    "WARNING: duplicate email across batches — SDP verify may match the wrong receiver."
  );
}
