#!/usr/bin/env node
/**
 * Print the current valid SDP password-reset token (when email did not arrive).
 *
 * Requires SDP_DATABASE_PUBLIC_URL in .env.local (Railway → Postgres → DATABASE_PUBLIC_URL).
 *
 * Usage:
 *   node scripts/sdp-fetch-reset-token.mjs
 *   node scripts/sdp-fetch-reset-token.mjs jfarfantorres@gmail.com
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { getSdpAdminConfig, loadMergedSdpEnv } from "./lib/sdp-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const { merged } = loadMergedSdpEnv(
  join(root, ".env.local"),
  join(root, "..", "SozuPay_dashboard", ".env.local")
);

const config = getSdpAdminConfig(merged);
const emailArg = (process.argv[2] ?? config.adminEmail).trim().toLowerCase();
const dbUrl =
  merged.SDP_DATABASE_PUBLIC_URL?.trim() ||
  merged.DATABASE_PUBLIC_URL?.trim() ||
  "";

if (!dbUrl) {
  console.error(
    "Add SDP_DATABASE_PUBLIC_URL to .env.local (copy DATABASE_PUBLIC_URL from Railway → Postgres)."
  );
  process.exit(1);
}

const schema = `sdp_${config.tenantName}`;
const sql = `
SELECT aupr.token,
       aupr.created_at,
       (aupr.created_at + interval '20 minutes') > now() AS still_valid
FROM "${schema}".auth_user_password_reset aupr
JOIN "${schema}".auth_users au ON au.id = aupr.auth_user_id
WHERE lower(au.email) = lower('${emailArg.replace(/'/g, "''")}')
  AND aupr.is_valid = true
ORDER BY aupr.created_at DESC
LIMIT 1;
`;

const r = spawnSync("psql", [dbUrl, "-t", "-A", "-F", "|", "-c", sql], {
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}

const line = (r.stdout || "").trim();
if (!line) {
  console.log(`No valid reset token for ${emailArg}. Run: node scripts/sdp-reset-password.mjs request`);
  process.exit(1);
}

const [token, createdAt, stillValid] = line.split("|");
console.log(`email: ${emailArg}`);
console.log(`token: ${token}`);
console.log(`created_at: ${createdAt}`);
console.log(`valid: ${stillValid}`);
if (stillValid !== "t") {
  console.log("\nToken expired (>20 min). Wait and run request again after invalidation, or use a new request once expired.");
  process.exit(1);
}
console.log(`
Apply new password (12–36 chars, upper, lower, digit, symbol):
  node scripts/sdp-reset-password.mjs apply --token='${token}' --password='SozuAdmin2026!'
`);
