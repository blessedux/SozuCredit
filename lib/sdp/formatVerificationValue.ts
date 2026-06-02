import { normalizeDateOfBirth } from "./beneficiaryIdentity";

/** SDP VerificationType values (see stellar-disbursement-platform-backend). */
export type SdpVerificationField =
  | "DATE_OF_BIRTH"
  | "YEAR_MONTH"
  | "PIN"
  | "NATIONAL_ID_NUMBER";

export function normalizeVerificationField(
  field: string | undefined | null
): SdpVerificationField {
  const raw = (field ?? "DATE_OF_BIRTH").trim().toUpperCase().replace(/-/g, "_");
  if (raw === "DATE_OF_BIRTH" || raw === "DOB") return "DATE_OF_BIRTH";
  if (raw === "YEAR_MONTH") return "YEAR_MONTH";
  if (raw === "PIN") return "PIN";
  if (raw === "NATIONAL_ID_NUMBER" || raw === "NATIONAL_ID") {
    return "NATIONAL_ID_NUMBER";
  }
  return "DATE_OF_BIRTH";
}

/**
 * SEP-24 verification accepts only YYYY-MM-DD for DATE_OF_BIRTH (SDP Extra_2).
 * Slash formats return HTTP 400 with a generic "invalid in some way" message.
 */
export function dateOfBirthFormatCandidates(iso: string): string[] {
  const normalized = normalizeDateOfBirth(iso);
  if (normalized) return [normalized];
  const trimmed = iso.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Value sent as JSON `verification` to SDP /sep24-interactive-deposit/verification.
 * DATE_OF_BIRTH must be YYYY-MM-DD per SDP validator.
 */
export function formatVerificationValueForSdp(
  field: string | undefined | null,
  raw: string
): string | null {
  const f = normalizeVerificationField(field);
  const trimmed = raw.trim();
  if (!trimmed) return null;

  switch (f) {
    case "DATE_OF_BIRTH": {
      return normalizeDateOfBirth(trimmed);
    }
    case "YEAR_MONTH": {
      const iso = normalizeDateOfBirth(trimmed);
      if (iso) return iso.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
      return null;
    }
    case "PIN":
    case "NATIONAL_ID_NUMBER":
      return trimmed;
    default:
      return trimmed;
  }
}

export function verificationFieldLabel(field: SdpVerificationField): string {
  switch (field) {
    case "DATE_OF_BIRTH":
      return "fecha de nacimiento";
    case "YEAR_MONTH":
      return "año y mes de nacimiento (AAAA-MM)";
    case "PIN":
      return "PIN personal";
    case "NATIONAL_ID_NUMBER":
      return "número de documento";
    default:
      return "dato de verificación";
  }
}
