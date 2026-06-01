"use client";

import {
  getCurrentCredentialId,
  storeCredentialIdInSession,
  storeCredentialRawIdInSession,
} from "@/lib/storage/key-utils";

export type ClientWalletSession = {
  userId: string | null;
  publicKey: string | null;
  credentialId: string | null;
  isAuthenticated: boolean;
};

export function isAuthenticatedClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem("dev_authenticated") === "true" ||
    sessionStorage.getItem("dev_authenticated") === "true"
  );
}

/** Read passkey wallet session from localStorage + sessionStorage (auth uses both). */
export async function loadClientWalletSession(): Promise<ClientWalletSession> {
  if (typeof window === "undefined") {
    return {
      userId: null,
      publicKey: null,
      credentialId: null,
      isAuthenticated: false,
    };
  }

  const userId =
    localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username");
  const publicKey =
    localStorage.getItem("stellar_public_key") ??
    sessionStorage.getItem("stellar_public_key");

  let credentialId =
    sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id");
  if (!credentialId && publicKey) {
    credentialId = await getCurrentCredentialId(publicKey);
  }
  if (!credentialId && userId) {
    try {
      const addrRes = await fetch("/api/wallet/stellar/address", {
        headers: { "x-user-id": userId },
      });
      if (addrRes.ok) {
        const data = (await addrRes.json()) as { signerPublicKey?: string | null };
        const signer = data.signerPublicKey?.trim().toUpperCase();
        if (signer?.startsWith("G") && signer.length === 56) {
          credentialId = await getCurrentCredentialId(signer);
        }
      }
    } catch {
      // non-fatal
    }
  }
  if (!credentialId && userId) {
    try {
      const pkRes = await fetch("/api/auth/passkeys/primary", {
        headers: { "x-user-id": userId },
      });
      if (pkRes.ok) {
        const data = (await pkRes.json()) as { credentialId?: string };
        if (typeof data.credentialId === "string" && data.credentialId.trim()) {
          credentialId = data.credentialId.trim();
        }
      }
    } catch {
      // non-fatal
    }
  }

  const isAuthenticated = isAuthenticatedClient() && !!userId;

  return { userId, publicKey, credentialId, isAuthenticated };
}

/** Passkey login succeeded — persist before wallet provisioning so /home never bounces to /auth. */
export function persistAuthIdentitySession(params: {
  userId: string;
  credentialId: string;
  credentialRawId?: string;
  username?: string;
}): void {
  const { userId, credentialId, credentialRawId, username } = params;

  localStorage.setItem("dev_username", userId);
  localStorage.setItem("dev_authenticated", "true");
  sessionStorage.setItem("dev_username", userId);
  sessionStorage.setItem("dev_authenticated", "true");

  if (credentialId) {
    storeCredentialIdInSession(credentialId);
  }
  if (credentialRawId) {
    storeCredentialRawIdInSession(credentialRawId);
  }

  if (username) {
    localStorage.setItem("sozu_username", username);
    sessionStorage.setItem("dev_username_display", username);
  }

  sessionStorage.setItem("passkey_registered", "true");
}

export function persistWalletPublicKey(publicKey: string): void {
  const pk = publicKey.trim().toUpperCase();
  localStorage.setItem("stellar_public_key", pk);
  sessionStorage.setItem("stellar_public_key", pk);
}

/** Keep local + session storage aligned so /sdp/register sees auth immediately after /auth. */
export function persistClientWalletSession(params: {
  userId: string;
  publicKey: string;
  credentialId: string;
  username?: string;
}): void {
  const { userId, publicKey, credentialId, username } = params;

  persistAuthIdentitySession({ userId, credentialId, username });
  persistWalletPublicKey(publicKey);
}
