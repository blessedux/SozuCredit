#!/usr/bin/env node
/**
 * List SDP tenants (admin API). Needs Railway variable ADMIN_API_KEY (not SDP_ADMIN_PASSWORD).
 *
 * Add to .env.local (do not commit):
 *   SDP_ADMIN_API_KEY=<same as Railway ADMIN_API_KEY>
 *
 * Usage: node scripts/sdp-list-tenants.mjs
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadMergedSdpEnv } from "./lib/sdp-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const { merged } = loadMergedSdpEnv(
  join(root, ".env.local"),
  join(root, "..", "SozuPay_dashboard", ".env.local")
);

const apiUrl = (merged.SDP_API_URL ?? merged.SDP_ADMIN_URL ?? "").replace(/\/$/, "");
const adminKey = (
  merged.SDP_ADMIN_API_KEY ??
  merged.ADMIN_API_KEY ??
  ""
).trim();

if (!apiUrl || !adminKey) {
  console.error(
    "Set SDP_API_URL and SDP_ADMIN_API_KEY (copy ADMIN_API_KEY from Railway → sdp-v2 → Variables)."
  );
  process.exit(1);
}

const auth = Buffer.from(`SDP-admin:${adminKey}`).toString("base64");
const res = await fetch(`${apiUrl}/admin/tenants`, {
  headers: {
    Accept: "application/json",
    Authorization: `Basic ${auth}`,
    "SDP-Tenant-Name": "admin",
  },
});
const text = await res.text();
console.log(`GET /admin/tenants → HTTP ${res.status}`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text.slice(0, 500));
}
if (!res.ok) process.exit(1);
