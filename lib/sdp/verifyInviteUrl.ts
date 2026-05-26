import { Keypair } from "@stellar/stellar-sdk";
import { encodeQuerySorted } from "./queryEncode";

/**
 * Verifies SDP wallet registration URL signature (same algorithm as
 * github.com/stellar/stellar-disbursement-platform-backend VerifySignedURL).
 */
export function verifySdpRegistrationUrl(
  signedUrlString: string,
  expectedSigningPublicKey: string
): { ok: true; unsignedUrl: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(signedUrlString);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (!u.protocol || !u.host) {
    return { ok: false, error: "URL must include scheme and host" };
  }

  const signatureHex = u.searchParams.get("signature");
  if (!signatureHex?.trim()) {
    return { ok: false, error: "Missing signature" };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(signatureHex, "hex");
  } catch {
    return { ok: false, error: "Invalid signature encoding" };
  }

  u.searchParams.delete("signature");
  const sorted = encodeQuerySorted(u.searchParams);
  u.search = sorted ? `?${sorted}` : "";

  const message = u.toString();

  try {
    const pub = Keypair.fromPublicKey(expectedSigningPublicKey.trim());
    const ok = pub.verify(Buffer.from(message, "utf8"), signature);
    if (!ok) {
      return { ok: false, error: "Signature verification failed" };
    }
    return { ok: true, unsignedUrl: message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verify error";
    return { ok: false, error: msg };
  }
}
