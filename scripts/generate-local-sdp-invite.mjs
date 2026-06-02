#!/usr/bin/env node
/**
 * Build a localhost-signed SDP invite URL for local dev debugging.
 * Prod invite links are signed for credit.sozu.capital — they fail on localhost.
 *
 * Usage:
 *   node scripts/generate-local-sdp-invite.mjs
 *   node scripts/generate-local-sdp-invite.mjs --email you@example.com --dob 1997-08-05 --name "Ana Garcia"
 *
 * Requires in .env.local:
 *   SDP_SEP10_SIGNING_KEY=...   (same as SozuPay dashboard / Railway SDP)
 *   SDP_ALLOWED_DOMAINS=sdp-v2-production-f6c7.up.railway.app
 * Optional:
 *   SDP_TENANT_NAME=mujeres-admin
 *   LOCAL_SDP_INVITE_PORT=3000
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Keypair } from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
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

function parseArgs(argv) {
  const out = {
    email: "",
    dob: "",
    name: "",
    port: process.env.LOCAL_SDP_INVITE_PORT ?? "3000",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" && argv[i + 1]) out.email = argv[++i];
    else if (a === "--dob" && argv[i + 1]) out.dob = argv[++i];
    else if (a === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (a === "--port" && argv[i + 1]) out.port = argv[++i];
  }
  return out;
}

function encodeQuerySorted(params) {
  const byKey = new Map();
  for (const key of params.keys()) {
    if (!byKey.has(key)) byKey.set(key, params.getAll(key));
  }
  const keys = [...byKey.keys()].sort();
  const parts = [];
  for (const k of keys) {
    for (const v of byKey.get(k) ?? []) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join("&");
}

function signSdpInviteUrl(
  walletInviteUrl,
  assetCode,
  assetIssuer,
  sdpDomain,
  orgName,
  sep10SigningKey
) {
  const asset = assetIssuer ? `${assetCode}-${assetIssuer}` : "native";
  const params = new URLSearchParams();
  params.set("asset", asset);
  params.set("domain", sdpDomain);
  params.set("name", orgName);
  const sortedQs = encodeQuerySorted(params);
  const unsignedUrl = `${walletInviteUrl}?${sortedQs}`;
  const kp = Keypair.fromSecret(sep10SigningKey);
  const sigHex = Buffer.from(kp.sign(Buffer.from(unsignedUrl, "utf8"))).toString("hex");
  return `${unsignedUrl}&signature=${sigHex}`;
}

loadEnvLocal();

const args = parseArgs(process.argv.slice(2));
const signingKey = process.env.SDP_SEP10_SIGNING_KEY?.trim() ?? "";
const sdpHost =
  process.env.SDP_E2E_DOMAIN?.trim() ?? "sdp-v2-production-f6c7.up.railway.app";
const tenant = process.env.SDP_TENANT_NAME?.trim() ?? "";
const assetCode = "USDC";
const assetIssuer =
  process.env.TESTNET_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const orgName = "Sozu";

if (!signingKey) {
  console.error("Missing SDP_SEP10_SIGNING_KEY in .env.local");
  process.exit(1);
}

const walletInviteUrl = `http://localhost:${args.port}/sdp/invite`;
let url = signSdpInviteUrl(
  walletInviteUrl,
  assetCode,
  assetIssuer,
  sdpHost,
  orgName,
  signingKey
);

const u = new URL(url);
if (tenant) u.searchParams.set("tenant", tenant);
if (args.email) u.searchParams.set("be", args.email.trim());
if (args.name) u.searchParams.set("bn", args.name.trim());
if (args.dob) u.searchParams.set("bd", args.dob.trim());
url = u.toString();

console.log("\nLocal SDP invite URL (open while `npm run dev` is running):\n");
console.log(url);
console.log("\nAlso ensure .env.local contains:");
console.log(`  SDP_ALLOWED_DOMAINS=${sdpHost}`);
console.log("\nUnsigned params (be/bn/bd/tenant) are appended after the signature — same as production invites.\n");
