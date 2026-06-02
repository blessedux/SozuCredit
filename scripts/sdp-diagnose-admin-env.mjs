#!/usr/bin/env node
/**
 * Compare SDP admin env across SozuCredit / SozuPay .env.local (no secrets printed).
 * Usage: node scripts/sdp-diagnose-admin-env.mjs
 */

import { createHash } from "crypto";
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
const creditEnv = join(root, ".env.local");

function fp(value) {
  if (!value) return "(unset)";
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

const { merged, credit, pay } = loadMergedSdpEnv(creditEnv, dashboardEnv);

const keys = [
  "SDP_API_URL",
  "SDP_ADMIN_URL",
  "SDP_ADMIN_EMAIL",
  "SDP_OWNER_EMAIL",
  "SDP_ADMIN_PASSWORD",
  "SDP_OWNER_PASSWORD",
  "SDP_TENANT_NAME",
];

console.log("SDP env diagnostic (fingerprints only — not passwords)\n");
for (const k of keys) {
  const c = credit[k];
  const p = pay[k];
  let match = "both-unset";
  if (c && p) match = c === p ? "SAME" : "DIFF";
  else if (c) match = "credit-only";
  else if (p) match = "pay-only";
  console.log(
    `${k}: credit_len=${c?.length ?? 0} pay_len=${p?.length ?? 0} fp_credit=${fp(c)} fp_pay=${fp(p)} ${match}`
  );
}

const config = getSdpAdminConfig(merged);
const policyIssues = sdpPasswordPolicyIssues(config.adminPassword);

console.log("\nEffective config (SozuCredit .env.local overrides SozuPay for same keys):");
console.log(`  api=${config.apiUrl}`);
console.log(`  tenant=${config.tenantName}`);
console.log(`  email=${config.adminEmail || "(empty)"}`);
console.log(`  password_len=${config.adminPassword.length} fp=${fp(config.adminPassword)}`);
console.log(
  `  sdp_password_policy: ${policyIssues.length === 0 ? "OK" : "FAIL — " + policyIssues.join(", ")}`
);

if (config.apiUrl && config.adminEmail && config.adminPassword) {
  console.log("\nLogin probe:");
  const { res, data } = await sdpAdminLogin(config);
  if (res.ok && data.token) {
    console.log("  ✓ token received — credentials match SDP database");
  } else if (res.ok && data.message) {
    console.log(`  MFA required: ${data.message}`);
  } else {
    console.log(`  HTTP ${res.status} ${JSON.stringify(data)}`);
    if (policyIssues.length) {
      console.log(
        "\n→ Env password likely never valid in SDP. Updating .env/Vercel does NOT change SDP users."
      );
      console.log("  Run: node scripts/sdp-reset-password.mjs request (token in Railway logs)");
      console.log("  Then set SDP_ADMIN_PASSWORD to the password you chose in the email link.");
    } else {
      console.log(
        "\n→ Repos are in sync but SDP DB password differs. Reset via forgot-password or SDP UI."
      );
    }
  }
}
