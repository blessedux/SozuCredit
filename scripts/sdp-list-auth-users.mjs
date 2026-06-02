#!/usr/bin/env node
/**
 * List NGO operator accounts in SDP Postgres (requires DATABASE_PUBLIC_URL).
 *
 * Get URL: Railway → Postgres service → DATABASE_PUBLIC_URL
 * Add to .env.local (do not commit): SDP_DATABASE_PUBLIC_URL=postgresql://...
 *
 * Usage: node scripts/sdp-list-auth-users.mjs
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadMergedSdpEnv } from "./lib/sdp-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const { merged } = loadMergedSdpEnv(
  join(root, ".env.local"),
  join(root, "..", "SozuPay_dashboard", ".env.local")
);

const dbUrl =
  merged.SDP_DATABASE_PUBLIC_URL?.trim() ||
  merged.DATABASE_PUBLIC_URL?.trim() ||
  "";

if (!dbUrl) {
  console.error(
    "Set SDP_DATABASE_PUBLIC_URL in .env.local (copy DATABASE_PUBLIC_URL from Railway → Postgres)."
  );
  process.exit(1);
}

const tenant = merged.SDP_TENANT_NAME?.trim() || "mujeres-admin";
const schema = `sdp_${tenant}`;

const sql = `
SELECT email, is_owner, created_at
FROM "${schema}".auth_users
ORDER BY created_at;
`;

const r = spawnSync("psql", [dbUrl, "-c", sql], { encoding: "utf8" });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
