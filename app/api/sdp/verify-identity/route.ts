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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/sdp/verify-identity
 * Body: { email?: string, full_name?: string, date_of_birth?: string }
 * Saves beneficiary email for SDP (before passkey). Optional name/DOB when invite includes bn/bd.
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

  if (!email) {
    return NextResponse.json({ error: "Ingresá tu correo electrónico." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Ingresá un correo válido." }, { status: 400 });
  }
  if (!dateOfBirth) {
    return NextResponse.json(
      { error: "Ingresá tu fecha de nacimiento (formato AAAA-MM-DD, igual que en SDP)." },
      { status: 400 }
    );
  }
  const normalizedDobInput = normalizeDateOfBirth(dateOfBirth);
  if (!normalizedDobInput) {
    return NextResponse.json(
      { error: "Fecha inválida. Usá el formato AAAA-MM-DD (ej. 1990-03-15)." },
      { status: 400 }
    );
  }

  if (invite.expectedFullName && !fullName) {
    return NextResponse.json({ error: "Ingresá tu nombre completo." }, { status: 400 });
  }

  const result = verifyBeneficiaryIdentity({
    expectedFullName: invite.expectedFullName,
    expectedDateOfBirth: invite.expectedDateOfBirth,
    expectedEmail: invite.expectedBeneficiaryEmail,
    providedFullName: fullName || invite.expectedFullName || "",
    providedDateOfBirth: normalizedDobInput,
    providedEmail: email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const updated = {
    ...invite,
    verifiedEmail: normalizedEmail,
    verifiedDateOfBirth: normalizedDobInput,
    ...(fullName ? { verifiedFullName: fullName } : {}),
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
