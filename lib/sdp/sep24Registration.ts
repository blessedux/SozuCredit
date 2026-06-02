import "server-only";

import { maskEmail, sdpDebugLog } from "@/lib/sdp/debugLog";

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
