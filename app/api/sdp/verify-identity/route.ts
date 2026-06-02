import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  parseInviteCookie,
  serializeInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  SDP_INVITE_COOKIE_MAX_AGE_SEC,
} from "@/lib/sdp/invitePayload";
import {
  normalizeDateOfBirth,
  verifyBeneficiaryIdentity,
} from "@/lib/sdp/beneficiaryIdentity";

/**
 * POST /api/sdp/verify-identity
 * Body: { full_name?: string, date_of_birth?: string, email?: string }
 *
 * Local pre-check against unsigned invite hints (bn, bd, be). Does not run SDP OTP —
 * that happens on the SDP webview after SEP-24 redirect.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SDP_INVITE_COOKIE_NAME)?.value;
  const invite = parseInviteCookie(raw);
  if (!invite) {
    return NextResponse.json(
      { error: "Invitación expirada. Abrí el enlace del correo de nuevo." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const dateOfBirth =
    typeof body.date_of_birth === "string" ? body.date_of_birth.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  const needsIdentity = Boolean(
    invite.expectedFullName || invite.expectedDateOfBirth || invite.expectedBeneficiaryEmail
  );

  if (!needsIdentity) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (invite.expectedFullName && !fullName) {
    return NextResponse.json({ error: "Ingresá tu nombre completo." }, { status: 400 });
  }
  if (invite.expectedDateOfBirth && !dateOfBirth) {
    return NextResponse.json(
      { error: "Ingresá tu fecha de nacimiento." },
      { status: 400 }
    );
  }
  if (invite.expectedBeneficiaryEmail && !email) {
    return NextResponse.json(
      { error: "Ingresá el correo que la organización registró para este beneficiario." },
      { status: 400 }
    );
  }

  const result = verifyBeneficiaryIdentity({
    expectedFullName: invite.expectedFullName,
    expectedDateOfBirth: invite.expectedDateOfBirth,
    expectedEmail: invite.expectedBeneficiaryEmail,
    providedFullName: fullName || invite.expectedFullName || "",
    providedDateOfBirth: dateOfBirth || invite.expectedDateOfBirth || "",
    providedEmail: email || undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const normalizedDob = dateOfBirth ? normalizeDateOfBirth(dateOfBirth) : null;
  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

  const updated = {
    ...invite,
    ...(fullName ? { verifiedFullName: fullName } : {}),
    ...(normalizedDob ? { verifiedDateOfBirth: normalizedDob } : {}),
    ...(normalizedEmail ? { verifiedEmail: normalizedEmail } : {}),
  };
  cookieStore.set(SDP_INVITE_COOKIE_NAME, serializeInviteCookie(updated), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SDP_INVITE_COOKIE_MAX_AGE_SEC,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
