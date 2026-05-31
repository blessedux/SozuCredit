"use client";

import {
  getCurrentCredentialId,
  storeCredentialIdInSession,
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

  let credentialId = sessionStorage.getItem("credential_id");
  if (!credentialId && publicKey) {
    credentialId = await getCurrentCredentialId(publicKey);
  }

  const isAuthenticated =
    isAuthenticatedClient() && !!userId && !!publicKey && publicKey.startsWith("G");

  return { userId, publicKey, credentialId, isAuthenticated };
}

/** Keep local + session storage aligned so /sdp/register sees auth immediately after /auth. */
export function persistClientWalletSession(params: {
  userId: string;
  publicKey: string;
  credentialId: string;
  username?: string;
}): void {
  const { userId, publicKey, credentialId, username } = params;

  localStorage.setItem("dev_username", userId);
  localStorage.setItem("dev_authenticated", "true");
  localStorage.setItem("stellar_public_key", publicKey);

  sessionStorage.setItem("dev_username", userId);
  sessionStorage.setItem("dev_authenticated", "true");
  sessionStorage.setItem("stellar_public_key", publicKey);

  if (credentialId) {
    storeCredentialIdInSession(credentialId);
  }

  if (username) {
    localStorage.setItem("sozu_username", username);
    sessionStorage.setItem("dev_username_display", username);
  }

  sessionStorage.setItem("passkey_registered", "true");
}
