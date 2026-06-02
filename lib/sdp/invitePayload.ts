import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "sozupay_sdp_invite";

export type SdpInvitePayload = {
  sdpHost: string;
  organizationName: string;
  asset: string;
  webAuthEndpoint: string;
  sep24Base: string;
  /** SDP stellar.toml SIGNING_KEY (SEP-10 server account id) */
  sdpSigningPublicKey: string;
  /** SDP multi-tenant name — sent as SDP-Tenant-Name header on every SDP API call */
  tenantName?: string;
  /** Embedded-wallet invitation token when present on the registration link */
  token?: string;
  /** Expected beneficiary email (unsigned invite param) */
  expectedBeneficiaryEmail?: string;
  /** Expected full name from NGO batch CSV */
  expectedFullName?: string;
  /** Expected DOB YYYY-MM-DD from NGO batch verification column */
  expectedDateOfBirth?: string;
  /** Confirmed on Sozu before SEP-24 (optional, set by verify-identity) */
  verifiedFullName?: string;
  verifiedDateOfBirth?: string;
  verifiedEmail?: string;
  /** SEP-24 interactive transaction id (after passkey step) */
  sep24TransactionId?: string;
  /** DATE_OF_BIRTH | PIN | … from SDP send-otp response */
  sdpVerificationField?: string;
  /** Set after successful SDP /verification */
  registrationCompletedAt?: number;
  /** Epoch seconds */
  exp: number;
};

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-in-production";
}

function signPayload(json: string): string {
  return createHmac("sha256", getSecret()).update(json).digest("base64url");
}

/** Cookie value: v1.<sig>.<base64url json> */
export function serializeInviteCookie(payload: SdpInvitePayload): string {
  const json = JSON.stringify(payload);
  const sig = signPayload(json);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  return `v1.${sig}.${b64}`;
}

export function parseInviteCookie(
  value: string | undefined
): SdpInvitePayload | null {
  if (!value?.startsWith("v1.")) return null;
  const rest = value.slice(3);
  const dot = rest.indexOf(".");
  if (dot < 0) return null;
  const sig = rest.slice(0, dot);
  const b64 = rest.slice(dot + 1);
  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = signPayload(json);
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(json) as SdpInvitePayload;
    if (
      typeof data.sdpHost !== "string" ||
      typeof data.organizationName !== "string" ||
      typeof data.asset !== "string" ||
      typeof data.webAuthEndpoint !== "string" ||
      typeof data.sep24Base !== "string" ||
      typeof data.sdpSigningPublicKey !== "string" ||
      typeof data.exp !== "number"
    ) {
      return null;
    }
    if (data.token !== undefined && typeof data.token !== "string") {
      return null;
    }
    if (
      data.expectedBeneficiaryEmail !== undefined &&
      typeof data.expectedBeneficiaryEmail !== "string"
    ) {
      return null;
    }
    if (data.expectedFullName !== undefined && typeof data.expectedFullName !== "string") {
      return null;
    }
    if (
      data.expectedDateOfBirth !== undefined &&
      typeof data.expectedDateOfBirth !== "string"
    ) {
      return null;
    }
    if (data.verifiedFullName !== undefined && typeof data.verifiedFullName !== "string") {
      return null;
    }
    if (
      data.verifiedDateOfBirth !== undefined &&
      typeof data.verifiedDateOfBirth !== "string"
    ) {
      return null;
    }
    if (data.verifiedEmail !== undefined && typeof data.verifiedEmail !== "string") {
      return null;
    }
    if (
      data.sep24TransactionId !== undefined &&
      typeof data.sep24TransactionId !== "string"
    ) {
      return null;
    }
    if (
      data.sdpVerificationField !== undefined &&
      typeof data.sdpVerificationField !== "string"
    ) {
      return null;
    }
    if (
      data.registrationCompletedAt !== undefined &&
      typeof data.registrationCompletedAt !== "number"
    ) {
      return null;
    }
    if (data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export const SDP_INVITE_COOKIE_NAME = COOKIE;

export const SDP_INVITE_COOKIE_MAX_AGE_SEC = 60 * 60; // 1 hour
