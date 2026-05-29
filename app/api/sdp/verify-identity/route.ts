import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseInviteCookie, SDP_INVITE_COOKIE_NAME } from "@/lib/sdp/invitePayload";
import { verifyBeneficiaryIdentity } from "@/lib/sdp/beneficiaryIdentity";

/**
 * POST /api/sdp/verify-identity
 * Body: { full_name: string, date_of_birth: string }
 * Confirms the claimant matches the beneficiary on the NGO disbursement batch.
 */
export async function POST(request: Request) {
  const raw = (await cookies()).get(SDP_INVITE_COOKIE_NAME)?.value;
  const invite = parseInviteCookie(raw);
  if (!invite) {
    return NextResponse.json(
      { error: "Invitación expirada. Abrí el enlace del correo de nuevo." },
      { status: 400 }
    );
  }

  if (!invite.expectedFullName && !invite.expectedDateOfBirth) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const dateOfBirth =
    typeof body.date_of_birth === "string" ? body.date_of_birth.trim() : "";

  if (!fullName || !dateOfBirth) {
    return NextResponse.json(
      { error: "Nombre completo y fecha de nacimiento son obligatorios." },
      { status: 400 }
    );
  }

  const result = verifyBeneficiaryIdentity({
    expectedFullName: invite.expectedFullName,
    expectedDateOfBirth: invite.expectedDateOfBirth,
    providedFullName: fullName,
    providedDateOfBirth: dateOfBirth,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
