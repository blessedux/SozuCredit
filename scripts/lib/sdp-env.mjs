import { readFileSync, existsSync } from "fs";

/** SDP login requires upper, lower, digit, symbol, min 8 (see SDP OpenAPI /login). */
export function sdpPasswordPolicyIssues(password) {
  const issues = [];
  if (!password) return ["empty"];
  if (password.length < 8) issues.push("min 8 characters");
  if (!/[A-Z]/.test(password)) issues.push("uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("digit");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("symbol");
  return issues;
}

function parseLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const m = t.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
  if (!m) return null;
  let v = m[2].trim();
  const hashIdx = v.indexOf(" #");
  if (hashIdx >= 0) v = v.slice(0, hashIdx).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return [m[1], v];
}

export function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    vars[parsed[0]] = parsed[1];
  }
  return vars;
}

/** SozuCredit .env.local first; SozuPay fills only unset keys (same as lookup script). */
export function loadMergedSdpEnv(creditEnvPath, dashboardEnvPath) {
  const pay = loadEnvFile(dashboardEnvPath);
  const credit = loadEnvFile(creditEnvPath);
  const merged = { ...pay, ...credit };
  return { merged, credit, pay };
}

function readEnvValue(merged, ...keys) {
  for (const key of keys) {
    let v = merged[key];
    if (typeof v !== "string") continue;
    v = v.trim();
    if (/^todo\b/i.test(v) || /^todo_/i.test(v)) continue;
    if (v) return v;
  }
  return "";
}

export function getSdpAdminConfig(merged) {
  return {
    apiUrl: readEnvValue(merged, "SDP_API_URL", "SDP_ADMIN_URL").replace(/\/$/, ""),
    adminEmail: readEnvValue(merged, "SDP_ADMIN_EMAIL", "SDP_OWNER_EMAIL"),
    adminPassword: readEnvValue(merged, "SDP_ADMIN_PASSWORD", "SDP_OWNER_PASSWORD"),
    tenantName: readEnvValue(merged, "SDP_TENANT_NAME") || "mujeres-admin",
  };
}

export async function sdpAdminLogin(config) {
  const { apiUrl, adminEmail, adminPassword, tenantName } = config;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "SDP-Tenant-Name": tenantName,
  };
  const res = await fetch(`${apiUrl}/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
