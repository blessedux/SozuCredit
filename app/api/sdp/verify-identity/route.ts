import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseInviteCookie, SDP_INVITE_COOKIE_NAME } from "@/lib/sdp/invitePayload";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";
import {
  normalizeDateOfBirth,
  verifyBeneficiaryIdentity,
} from "@/lib/sdp/beneficiaryIdentity";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/sdp/verify-identity
 * Body: { email: string, date_of_birth: string }
 * Saves beneficiary email + DOB for SDP (before passkey). Validated against invite when present.
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

  const result = verifyBeneficiaryIdentity({
    expectedFullName: invite.expectedFullName,
    expectedDateOfBirth: invite.expectedDateOfBirth,
    expectedEmail: invite.expectedBeneficiaryEmail,
    providedFullName: invite.expectedFullName || "",
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
  };
  await persistInvitePayload(updated);

  return NextResponse.json({ ok: true });
}
