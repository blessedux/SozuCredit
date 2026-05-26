import { parseStellarTomlFields } from "./parseToml";

export type SdpTomlEndpoints = {
  signingKey: string;
  webAuthEndpoint: string;
  transferServerSep24: string;
};

export async function fetchSdpTomlEndpoints(
  sdpHost: string,
  options?: { signal?: AbortSignal }
): Promise<SdpTomlEndpoints | { error: string }> {
  const host = sdpHost.trim().replace(/^https?:\/\//i, "").split("/")[0];
  if (!host) {
    return { error: "Empty SDP host" };
  }

  // Local/dev SDP often serves HTTP only (e.g. Docker on :8000). Try HTTP first for
  // loopback and common dev hostnames (*.stellar.local per SDP docs); production hosts
  // still try HTTPS first when not matched here.
  const tryHttpFirst =
    host.startsWith("localhost") ||
    host.startsWith("127.") ||
    host === "[::1]" ||
    host.includes("stellar.local");
  const tryUrls = tryHttpFirst
    ? [
        `http://${host}/.well-known/stellar.toml`,
        `https://${host}/.well-known/stellar.toml`,
      ]
    : [`https://${host}/.well-known/stellar.toml`];

  let res: Response | null = null;
  let lastErr = "Fetch failed";
  for (const url of tryUrls) {
    try {
      const r = await fetch(url, {
        redirect: "follow",
        signal: options?.signal,
        headers: { Accept: "text/plain" },
        next: { revalidate: 0 },
      });
      if (r.ok) {
        res = r;
        break;
      }
      lastErr = `stellar.toml HTTP ${r.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Fetch failed";
    }
  }

  if (!res) {
    return { error: lastErr };
  }

  const raw = await res.text();
  const fields = parseStellarTomlFields(raw);
  const signingKey = fields.SIGNING_KEY?.trim();
  const webAuthEndpoint = fields.WEB_AUTH_ENDPOINT?.trim();
  const transferServerSep24 = fields.TRANSFER_SERVER_SEP0024?.trim();

  if (!signingKey) {
    return { error: "stellar.toml missing SIGNING_KEY" };
  }
  if (!webAuthEndpoint) {
    return { error: "stellar.toml missing WEB_AUTH_ENDPOINT" };
  }
  if (!transferServerSep24) {
    return { error: "stellar.toml missing TRANSFER_SERVER_SEP0024" };
  }

  return { signingKey, webAuthEndpoint, transferServerSep24 };
}
