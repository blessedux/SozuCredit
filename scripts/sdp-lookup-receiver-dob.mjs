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

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dashboardEnv = join(root, "..", "SozuPay_dashboard", ".env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(dashboardEnv);

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: node scripts/sdp-lookup-receiver-dob.mjs <email>");
  process.exit(1);
}

const apiUrl = (process.env.SDP_API_URL ?? "").replace(/\/$/, "");
const adminEmail = process.env.SDP_ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.SDP_ADMIN_PASSWORD?.trim() ?? "";
const tenant = process.env.SDP_TENANT_NAME?.trim() ?? "";

if (!apiUrl || !adminEmail || !adminPassword || adminPassword.startsWith("TODO")) {
  console.error(
    "Set SDP_API_URL, SDP_ADMIN_EMAIL, SDP_ADMIN_PASSWORD (real password, not TODO) in .env.local"
  );
  process.exit(1);
}

console.error(
  `[env] api=${apiUrl} tenant=${tenant || "(none)"} email=${adminEmail} password_len=${adminPassword.length} sources=SozuCredit+.env.local then SozuPay_dashboard/.env.local`
);

async function sdpFetch(path, token) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (tenant) headers["SDP-Tenant-Name"] = tenant;
  const res = await fetch(`${apiUrl}${path}`, { headers });
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
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (tenant) headers["SDP-Tenant-Name"] = tenant;
  const res = await fetch(`${apiUrl}/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Login failed (HTTP ${res.status}): ${JSON.stringify(data)}. Use the same password as SDP admin UI / SozuPay Vercel env (not TODO_).`
    );
  }
  return data.token;
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
