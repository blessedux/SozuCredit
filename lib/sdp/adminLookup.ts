import "server-only";

type ReceiverHit = {
  disbursementId: string;
  disbursementName: string;
  disbursementStatus: string;
  receiverId: string;
  externalId?: string;
  verificationDob: string;
  walletStatus?: string;
  sep24TransactionId?: string | null;
  matchesCurrentTx?: boolean;
};

function readSdpAdminEnv() {
  const apiUrl = (process.env.SDP_API_URL ?? process.env.SDP_ADMIN_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const adminEmail = (process.env.SDP_ADMIN_EMAIL ?? process.env.SDP_OWNER_EMAIL ?? "").trim();
  let adminPassword = (
    process.env.SDP_ADMIN_PASSWORD ??
    process.env.SDP_OWNER_PASSWORD ??
    ""
  ).trim();
  if (/^todo/i.test(adminPassword)) adminPassword = "";
  const tenantName = (process.env.SDP_TENANT_NAME ?? "mujeres-admin").trim();
  return { apiUrl, adminEmail, adminPassword, tenantName };
}

async function sdpAdminLogin(): Promise<{ token: string; tenantName: string; apiUrl: string }> {
  const { apiUrl, adminEmail, adminPassword, tenantName } = readSdpAdminEnv();
  if (!apiUrl || !adminEmail || !adminPassword) {
    throw new Error("SDP admin lookup not configured");
  }

  const res = await fetch(`${apiUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "SDP-Tenant-Name": tenantName,
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`SDP admin login failed (${res.status})`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("SDP admin login missing token");
  return { token: data.token, tenantName, apiUrl };
}

async function sdpAdminFetch<T>(
  path: string,
  token: string,
  apiUrl: string,
  tenantName: string
): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "SDP-Tenant-Name": tenantName,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`SDP admin ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function dobFromPayment(payment?: {
  verification_field_value?: string;
  verification?: string;
} | null): string {
  const raw =
    payment?.verification_field_value?.trim() ??
    payment?.verification?.trim() ??
    "";
  return raw || "(empty — hashed in SDP; may differ from CSV if blank default was used)";
}

/** Server-only: list batch DOB rows for an email (SDP admin API). */
export async function lookupReceiverVerificationByEmail(
  email: string,
  opts?: { sep24TransactionId?: string }
): Promise<{
  configured: boolean;
  email: string;
  count: number;
  duplicateEmail: boolean;
  uniqueDobs: string[];
  hits: ReceiverHit[];
  transactionHit?: ReceiverHit | null;
  sdpVerifyNote: string;
} | { configured: false }> {
  const normalized = email.trim().toLowerCase();
  const txId = opts?.sep24TransactionId?.trim() ?? "";
  const env = readSdpAdminEnv();
  if (!env.apiUrl || !env.adminEmail || !env.adminPassword) {
    return { configured: false };
  }

  const { token, tenantName, apiUrl } = await sdpAdminLogin();
  const { data: disbursements } = await sdpAdminFetch<{ data: Array<{ id: string; name: string; status: string }> }>(
    "/disbursements?page=1&page_limit=100",
    token,
    apiUrl,
    tenantName
  );

  const hits: ReceiverHit[] = [];
  for (const d of disbursements ?? []) {
    const { data: receivers } = await sdpAdminFetch<{
      data: Array<{
        id: string;
        email?: string;
        external_id?: string;
        payment?: { verification_field_value?: string; verification?: string } | null;
        receiver_wallet?: { status?: string; sep24_transaction_id?: string | null };
      }>;
    }>(`/disbursements/${d.id}/receivers?page=1&page_limit=200`, token, apiUrl, tenantName);

    for (const r of receivers ?? []) {
      if (r.email?.trim().toLowerCase() !== normalized) continue;
      const sep24Tx = r.receiver_wallet?.sep24_transaction_id ?? null;
      hits.push({
        disbursementId: d.id,
        disbursementName: d.name,
        disbursementStatus: d.status,
        receiverId: r.id,
        externalId: r.external_id,
        verificationDob: dobFromPayment(r.payment),
        walletStatus: r.receiver_wallet?.status,
        sep24TransactionId: sep24Tx,
        matchesCurrentTx: Boolean(txId && sep24Tx && sep24Tx === txId),
      });
    }
  }

  const uniqueDobs = [...new Set(hits.map((h) => h.verificationDob).filter(Boolean))];
  const duplicateEmail = hits.length > 1;
  const transactionHit = txId
    ? hits.find((h) => h.matchesCurrentTx) ?? null
    : null;

  return {
    configured: true,
    email: normalized,
    count: hits.length,
    duplicateEmail,
    uniqueDobs,
    hits,
    transactionHit,
    sdpVerifyNote:
      hits.length === 0
        ? "No SDP receiver row for this email — OTP may target a different contact than the batch."
        : duplicateEmail
          ? "SDP verify picks receivers[0] from GetByContacts(email), while OTP uses GetLatestByContactInfo — multiple batch rows for the same email can desync hashes."
          : txId && !transactionHit
            ? `No receiver_wallet linked to tx_id ${txId}. SEP-24 session may not match this batch row.`
            : hits.length === 1 && hits[0]!.verificationDob.includes("empty")
              ? "DOB not returned in admin API (hashed). SozuPay uploaded DOB is the source of truth for what you sent."
              : "If invite_bd matches verification_sent and SDP still fails, the bcrypt hash on the receiver SDP uses at verify does not match — try a fresh email alias.",
  };
}
