import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSdpAllowedDomains, isSdpHostAllowed } from "@/lib/sdp/allowlist";
import { fetchSdpTomlEndpoints } from "@/lib/sdp/fetchSdpToml";
import { verifySdpRegistrationUrl } from "@/lib/sdp/verifyInviteUrl";
import { encodeQuerySorted } from "@/lib/sdp/queryEncode";
import { decodeSdpOrganizationName } from "@/lib/sdp/displayName";
import {
  serializeInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  SDP_INVITE_COOKIE_MAX_AGE_SEC,
} from "@/lib/sdp/invitePayload";
import {
  clearSdpSep10JwtCookie,
  clearSdpSep24JwtCookie,
} from "@/lib/sdp/jwtCookie";

function htmlError(title: string, message: string, status: number): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/**
 * SDP wallet registration entry (signed deep link target).
 * Query: asset, domain, name, signature (+ optional token for embedded wallets).
 *
 * SDP deep link for this app: https://credit.sozu.capital/sdp/invite
 */
export async function GET(request: NextRequest) {
  const allowed = parseSdpAllowedDomains(process.env.SDP_ALLOWED_DOMAINS);
  if (allowed.length === 0) {
    return htmlError(
      "Configuration required",
      "SDP_ALLOWED_DOMAINS is not set. Add comma-separated SDP hostnames before accepting invitations.",
      503
    );
  }

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "";
  if (!host) {
    return htmlError("Bad request", "Missing Host header.", 400);
  }

  const pathname = process.env.SDP_INVITE_PATHNAME?.trim() || "/sdp/invite";

  const incoming = new URLSearchParams(request.nextUrl.searchParams);
  const domainParam = incoming.get("domain")?.trim() || "";
  const assetParam = incoming.get("asset")?.trim() || "";
  const nameParam = incoming.get("name")?.trim() || "";
  const tokenParam = incoming.get("token")?.trim() || "";
  // Unsigned extra params — strip before signature verification
  const tenantParam = incoming.get("tenant")?.trim() || "";
  const beneficiaryEmailParam = incoming.get("be")?.trim() || "";
  const beneficiaryNameParam = incoming.get("bn")?.trim() || "";
  const beneficiaryDobParam = incoming.get("bd")?.trim() || "";
  incoming.delete("tenant");
  incoming.delete("be");
  incoming.delete("bn");
  incoming.delete("bd");

  if (!domainParam || !assetParam) {
    return htmlError(
      "Invalid invitation",
      "This link is missing required parameters (domain, asset).",
      400
    );
  }

  if (!isSdpHostAllowed(domainParam.toLowerCase(), allowed)) {
    return htmlError(
      "Blocked",
      "This disbursement domain is not on the allowed list for this wallet.",
      403
    );
  }

  const toml = await fetchSdpTomlEndpoints(domainParam);
  if ("error" in toml) {
    return htmlError(
      "Cannot reach disbursement service",
      `Could not load stellar.toml from the disbursement domain: ${toml.error}`,
      502
    );
  }

  const sortedQs = encodeQuerySorted(incoming);
  const signedUrlString = `${proto}://${host}${pathname}${sortedQs ? `?${sortedQs}` : ""}`;

  const verified = verifySdpRegistrationUrl(signedUrlString, toml.signingKey);
  if (!verified.ok) {
    return htmlError("Invalid invitation", verified.error, 400);
  }

  const exp = Math.floor(Date.now() / 1000) + SDP_INVITE_COOKIE_MAX_AGE_SEC;
  const payload = {
    sdpHost: domainParam,
    organizationName: decodeSdpOrganizationName(nameParam) || "Organization",
    asset: assetParam,
    webAuthEndpoint: toml.webAuthEndpoint,
    sep24Base: toml.transferServerSep24,
    sdpSigningPublicKey: toml.signingKey,
    ...(tenantParam ? { tenantName: tenantParam } : {}),
    ...(tokenParam ? { token: tokenParam } : {}),
    ...(beneficiaryEmailParam ? { expectedBeneficiaryEmail: beneficiaryEmailParam } : {}),
    ...(beneficiaryNameParam ? { expectedFullName: beneficiaryNameParam } : {}),
    ...(beneficiaryDobParam ? { expectedDateOfBirth: beneficiaryDobParam } : {}),
    exp,
  };

  const cookieVal = serializeInviteCookie(payload);
  const cookieStore = await cookies();
  await clearSdpSep10JwtCookie();
  await clearSdpSep24JwtCookie();
  cookieStore.set(SDP_INVITE_COOKIE_NAME, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SDP_INVITE_COOKIE_MAX_AGE_SEC,
    path: "/",
  });

  // Always land on register; passkey auth is sessionStorage-based (not Supabase-only).
  const next = new URL("/sdp/register", request.url);
  return NextResponse.redirect(next);
}
