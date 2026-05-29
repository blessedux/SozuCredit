import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet";
import {
  parseInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  type SdpInvitePayload,
} from "./invitePayload";

export type SdpApiContext =
  | {
      ok: true;
      invite: SdpInvitePayload;
      clientDomain: string;
      clientSigningSecret: string;
      stellarAccount: string;
      userId: string;
    }
  | { ok: false; status: number; error: string };

export async function getSdpApiContext(): Promise<SdpApiContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fall back to x-user-id header for the passkey / sessionStorage flow
  let userId: string | null = user?.id ?? null;
  if (!userId) {
    const { headers } = await import("next/headers");
    const hdrs = await headers();
    userId = hdrs.get("x-user-id");
  }

  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const raw = (await cookies()).get(SDP_INVITE_COOKIE_NAME)?.value;
  const invite = parseInviteCookie(raw);
  if (!invite) {
    return {
      ok: false,
      status: 400,
      error:
        "Missing or expired disbursement invitation. Open the link from your message again.",
    };
  }

  const clientDomain = process.env.WALLET_CLIENT_DOMAIN?.trim();
  if (!clientDomain) {
    return {
      ok: false,
      status: 503,
      error: "Server misconfiguration: WALLET_CLIENT_DOMAIN",
    };
  }

  const clientSigningSecret = process.env.SEP10_CLIENT_SIGNING_SECRET?.trim();
  if (!clientSigningSecret) {
    return {
      ok: false,
      status: 503,
      error: "Server misconfiguration: SEP10_CLIENT_SIGNING_SECRET",
    };
  }

  // Primary: look up wallet from DB.
  // Fallback: accept x-stellar-public-key header sent by the passkey client
  // (the key is stored in sessionStorage after passkey login). Security is
  // preserved because SEP-10 requires the user to sign a challenge with the
  // matching private key — a fake key would fail token exchange.
  let stellarAccount: string | null = null;

  const wallet = await getStellarWallet(userId, true);
  stellarAccount = wallet?.publicKey?.trim() ?? null;

  if (!stellarAccount) {
    const { headers } = await import("next/headers");
    const hdrs = await headers();
    const headerKey = hdrs.get("x-stellar-public-key")?.trim() ?? null;
    if (headerKey && headerKey.startsWith("G") && headerKey.length === 56) {
      stellarAccount = headerKey;
    }
  }

  if (!stellarAccount) {
    return {
      ok: false,
      status: 400,
      error: "No Stellar wallet found. Please sign in with your passkey again.",
    };
  }

  return {
    ok: true,
    invite,
    clientDomain,
    clientSigningSecret,
    stellarAccount,
    userId,
  };
}

export { SDP_INVITE_COOKIE_NAME };
