import "server-only";

import {
  Keypair,
  Networks,
  Transaction,
  WebAuth,
} from "@stellar/stellar-sdk";

function webAuthHostFromEndpoint(webAuthEndpoint: string): string {
  try {
    return new URL(webAuthEndpoint).hostname;
  } catch {
    return "";
  }
}

export type Sep10ChallengeResult =
  | {
      ok: true;
      transactionXdr: string;
      networkPassphrase: string;
      serverAccountId: string;
      webAuthDomain: string;
      homeDomains: string[];
    }
  | { ok: false; error: string };

/**
 * Request SEP-10 challenge from SDP (or any anchor).
 */
export async function requestSep10Challenge(params: {
  webAuthEndpoint: string;
  account: string;
  clientDomain: string;
  sdpHomeDomain: string;
  sdpSigningPublicKey: string;
  tenantName?: string;
}): Promise<Sep10ChallengeResult> {
  const {
    webAuthEndpoint,
    account,
    clientDomain,
    sdpHomeDomain,
    sdpSigningPublicKey,
    tenantName,
  } = params;

  const u = new URL(webAuthEndpoint);
  u.searchParams.set("account", account.trim());
  u.searchParams.set("client_domain", clientDomain.trim());
  u.searchParams.set("home_domain", sdpHomeDomain.trim());

  const sdpHeaders: HeadersInit = {
    Accept: "application/json",
    ...(tenantName ? { "SDP-Tenant-Name": tenantName } : {}),
  };

  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: sdpHeaders,
      next: { revalidate: 0 },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Challenge fetch failed",
    };
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `Challenge response not JSON (HTTP ${res.status})` };
  }

  if (!res.ok) {
    const err =
      typeof data.error === "string"
        ? data.error
        : JSON.stringify(data).slice(0, 200);
    return { ok: false, error: `SEP-10 challenge failed: ${err}` };
  }

  const transactionXdr =
    (typeof data.transaction === "string" && data.transaction) ||
    (typeof data.transaction_xdr === "string" && data.transaction_xdr) ||
    "";

  const networkPassphrase =
    (typeof data.network_passphrase === "string" && data.network_passphrase) ||
    (process.env.STELLAR_NETWORK === "public"
      ? Networks.PUBLIC
      : Networks.TESTNET);

  if (!transactionXdr) {
    return { ok: false, error: "Challenge missing transaction" };
  }

  const webAuthDomain = webAuthHostFromEndpoint(webAuthEndpoint);
  const homeDomains = [sdpHomeDomain.trim()];

  try {
    WebAuth.readChallengeTx(
      transactionXdr,
      sdpSigningPublicKey.trim(),
      networkPassphrase,
      homeDomains,
      webAuthDomain
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid challenge";
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    transactionXdr,
    networkPassphrase,
    serverAccountId: sdpSigningPublicKey.trim(),
    webAuthDomain,
    homeDomains,
  };
}

export type Sep10TokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Add client_domain signature (wallet SIGNING_KEY) and submit SEP-10 token request.
 */
export async function submitSep10SignedTransaction(params: {
  webAuthEndpoint: string;
  userSignedTransactionXdr: string;
  networkPassphrase: string;
  serverAccountId: string;
  homeDomains: string[];
  webAuthDomain: string;
  userAccountId: string;
  clientSigningSecret: string;
  tenantName?: string;
}): Promise<Sep10TokenResult> {
  const {
    webAuthEndpoint,
    userSignedTransactionXdr,
    networkPassphrase,
    serverAccountId,
    homeDomains,
    webAuthDomain,
    userAccountId,
    clientSigningSecret,
    tenantName,
  } = params;

  try {
    WebAuth.verifyChallengeTxSigners(
      userSignedTransactionXdr,
      serverAccountId,
      networkPassphrase,
      [userAccountId.trim()],
      homeDomains,
      webAuthDomain
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Challenge signer verification failed",
    };
  }

  let tx: Transaction;
  try {
    tx = new Transaction(userSignedTransactionXdr, networkPassphrase);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid transaction XDR",
    };
  }

  try {
    const clientKp = Keypair.fromSecret(clientSigningSecret.trim());
    tx.sign(clientKp);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Client sign failed",
    };
  }

  const signedXdr = tx.toEnvelope().toXDR("base64");

  const attempts: Array<{ body: string; contentType: string }> = [
    {
      body: JSON.stringify({ transaction: signedXdr }),
      contentType: "application/json",
    },
    {
      body: new URLSearchParams({ transaction: signedXdr }).toString(),
      contentType: "application/x-www-form-urlencoded",
    },
  ];

  let lastError = "Token response not recognized";
  for (const { body, contentType } of attempts) {
    const res = await fetch(webAuthEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": contentType,
        ...(tenantName ? { "SDP-Tenant-Name": tenantName } : {}),
      },
      body,
      next: { revalidate: 0 },
    });

    const raw = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      lastError = `Non-JSON response (HTTP ${res.status})`;
      continue;
    }

    if (!res.ok) {
      lastError =
        typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
      continue;
    }

    const token =
      (typeof data.token === "string" && data.token) ||
      (typeof data.jwt === "string" && data.jwt);
    if (token) {
      return { ok: true, token };
    }
  }

  return { ok: false, error: lastError };
}
