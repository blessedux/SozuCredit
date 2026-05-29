/** Normalize date of birth to YYYY-MM-DD for comparison. */
export function normalizeDateOfBirth(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameToSlug(input: string): string {
  return normalizeName(input).replace(/\s+/g, "_");
}

/** Compare beneficiary full name against expected display name or external_id slug. */
export function namesMatch(expected: string, provided: string): boolean {
  const e = normalizeName(expected);
  const p = normalizeName(provided);
  if (!e || !p) return false;
  if (e === p) return true;
  return nameToSlug(provided) === e.replace(/\s+/g, "_") || nameToSlug(expected) === p.replace(/\s+/g, "_");
}

export function verifyBeneficiaryIdentity(params: {
  expectedFullName?: string;
  expectedDateOfBirth?: string;
  providedFullName: string;
  providedDateOfBirth: string;
}): { ok: true } | { ok: false; error: string } {
  const { expectedFullName, expectedDateOfBirth, providedFullName, providedDateOfBirth } =
    params;

  if (!expectedFullName && !expectedDateOfBirth) {
    return { ok: true };
  }

  if (expectedFullName && !namesMatch(expectedFullName, providedFullName)) {
    return {
      ok: false,
      error: "El nombre no coincide con el registrado para este pago.",
    };
  }

  if (expectedDateOfBirth) {
    const expectedNorm = normalizeDateOfBirth(expectedDateOfBirth);
    const providedNorm = normalizeDateOfBirth(providedDateOfBirth);
    if (!providedNorm) {
      return { ok: false, error: "Ingresá la fecha de nacimiento en formato AAAA-MM-DD." };
    }
    if (!expectedNorm || expectedNorm !== providedNorm) {
      return {
        ok: false,
        error: "La fecha de nacimiento no coincide con la registrada para este pago.",
      };
    }
  }

  return { ok: true };
}
