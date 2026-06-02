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

/** ISO date → MM/DD/YYYY and DD/MM/YYYY (batch CSV often uses slashes). */
export function dateOfBirthFormatCandidates(iso: string): string[] {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [iso];
  const [, y, mo, d] = m;
  const mmddyyyy = `${mo}/${d}/${y}`;
  const ddmmyyyy = `${d}/${mo}/${y}`;
  return [iso, mmddyyyy, ddmmyyyy];
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
