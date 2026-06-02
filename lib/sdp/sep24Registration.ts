import "server-only";

import { dateOfBirthFormatCandidates } from "@/lib/sdp/formatVerificationValue";
import { maskEmail, sdpDebugLog } from "@/lib/sdp/debugLog";

const SDP_NOT_FOUND = "The information you provided could not be found";

function isSdpNotFoundError(error: string): boolean {
  return error.includes(SDP_NOT_FOUND) || /could not be found/i.test(error);
}

export type SdpSendOtpResult =
  | { ok: true; verificationField: string; message: string }
  | { ok: false; error: string; status?: number };

export type SdpVerifyRegistrationResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status?: number };

export type SdpRegistrationInfoResult =
  | {
      ok: true;
      organizationName: string;
      isRegistered: boolean;
      truncatedContactInfo?: string;
    }
  | { ok: false; error: string; status?: number };

async function readSdpJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 200) };
  }
}

/** POST /sep24-interactive-deposit/otp — sends OTP to email on file for this beneficiary. */
export async function postSdpRegistrationOtp(params: {
  apiBase: string;
  sep24Jwt: string;
  email: string;
  tenantName?: string;
}): Promise<SdpSendOtpResult> {
  const url = `${params.apiBase.replace(/\/?$/, "")}/otp`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.sep24Jwt}`,
      ...(params.tenantName ? { "SDP-Tenant-Name": params.tenantName } : {}),
    },
    body: JSON.stringify({ email: params.email.trim().toLowerCase() }),
    next: { revalidate: 0 },
  });

  const data = await readSdpJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        typeof data.error === "string"
          ? data.error
          : `SDP OTP failed (HTTP ${res.status})`,
    };
  }

  const verificationField =
    typeof data.verification_field === "string"
      ? data.verification_field
      : "DATE_OF_BIRTH";
  const message =
    typeof data.message === "string" ? data.message : "OTP sent";

  return { ok: true, verificationField, message };
}

/** POST /sep24-interactive-deposit/verification — OTP + verification value (e.g. DOB). */
export async function postSdpRegistrationVerify(params: {
  apiBase: string;
  sep24Jwt: string;
  email: string;
  otp: string;
  verificationValue: string;
  verificationField: string;
  tenantName?: string;
}): Promise<SdpVerifyRegistrationResult> {
  const url = `${params.apiBase.replace(/\/?$/, "")}/verification`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.sep24Jwt}`,
      ...(params.tenantName ? { "SDP-Tenant-Name": params.tenantName } : {}),
    },
    body: JSON.stringify({
      email: params.email.trim().toLowerCase(),
      otp: params.otp.trim(),
      verification: params.verificationValue.trim(),
      verification_field: params.verificationField,
    }),
    next: { revalidate: 0 },
  });

  const data = await readSdpJson(res);
  if (!res.ok) {
    sdpDebugLog(
      "sep24Registration.ts:postSdpRegistrationVerify",
      "SDP verify HTTP error",
      {
        emailMasked: maskEmail(params.email),
        verificationField: params.verificationField,
        verificationLen: params.verificationValue.length,
        verificationFormat: /^\d{4}-\d{2}-\d{2}$/.test(params.verificationValue)
          ? "iso"
          : params.verificationValue.includes("/")
            ? "slash"
            : "other",
        httpStatus: res.status,
        sdpError:
          typeof data.error === "string" ? data.error.slice(0, 120) : "unknown",
      },
      "A"
    );
    return {
      ok: false,
      status: res.status,
      error:
        typeof data.error === "string"
          ? data.error
          : `SDP verification failed (HTTP ${res.status})`,
    };
  }

  return {
    ok: true,
    message: typeof data.message === "string" ? data.message : "ok",
  };
}

/**
 * POST /verification — tries ISO DOB first, then slash-format variants on SDP "not found".
 * OTP and DOB must use the same email; hash mismatch can still fail after all candidates.
 */
export async function postSdpRegistrationVerifyWithCandidates(params: {
  apiBase: string;
  sep24Jwt: string;
  email: string;
  otp: string;
  verificationValue: string;
  verificationField: string;
  tenantName?: string;
}): Promise<
  | { ok: true; message: string; verificationUsed: string; candidatesTried: string[] }
  | { ok: false; error: string; status?: number; candidatesTried: string[] }
> {
  const field = params.verificationField;
  const candidates =
    field === "DATE_OF_BIRTH"
      ? [...new Set(dateOfBirthFormatCandidates(params.verificationValue))]
      : [params.verificationValue.trim()];

  let last: SdpVerifyRegistrationResult = {
    ok: false,
    error: "No verification candidates",
  };

  for (const candidate of candidates) {
    last = await postSdpRegistrationVerify({
      ...params,
      verificationValue: candidate,
    });
    if (last.ok) {
      sdpDebugLog(
        "sep24Registration.ts:verify-candidate-success",
        "SDP verify succeeded with candidate",
        {
          emailMasked: maskEmail(params.email),
          verificationUsed: candidate,
          candidatesTried: candidates,
        },
        "E"
      );
      return {
        ok: true,
        message: last.message,
        verificationUsed: candidate,
        candidatesTried: candidates,
      };
    }
    if (!isSdpNotFoundError(last.error)) {
      return { ...last, candidatesTried: candidates };
    }
  }

  sdpDebugLog(
    "sep24Registration.ts:verify-candidates-exhausted",
    "all DOB format candidates rejected by SDP",
    {
      emailMasked: maskEmail(params.email),
      candidatesTried: candidates,
      lastError: last.error.slice(0, 120),
    },
    "A"
  );

  return {
    ok: false,
    error: last.error,
    status: last.status,
    candidatesTried: candidates,
  };
}

/** GET /sep24-interactive-deposit/info — registration context for this SEP-24 session. */
export async function getSdpRegistrationInfo(params: {
  apiBase: string;
  sep24Jwt: string;
}): Promise<SdpRegistrationInfoResult> {
  const url = `${params.apiBase.replace(/\/?$/, "")}/info`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${params.sep24Jwt}`,
    },
    next: { revalidate: 0 },
  });

  const data = await readSdpJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        typeof data.error === "string"
          ? data.error
          : `SDP info failed (HTTP ${res.status})`,
    };
  }

  return {
    ok: true,
    organizationName:
      typeof data.organization_name === "string"
        ? data.organization_name
        : "Organization",
    isRegistered: Boolean(data.is_registered),
    truncatedContactInfo:
      typeof data.truncated_contact_info === "string"
        ? data.truncated_contact_info
        : undefined,
  };
}
