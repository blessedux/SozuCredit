/** SEP-24 interactive wallet-registration API (hosted on SDP core, not /sep24 transfer path). */
export function sdpInteractiveDepositApiBase(sdpHost: string): string {
  const host = sdpHost.trim().replace(/^https?:\/\//i, "").split("/")[0];
  return `https://${host}/sep24-interactive-deposit`;
}

export function parseSep24SessionFromInteractiveUrl(
  interactiveUrl: string
): { sep24Jwt: string; transactionId: string } | null {
  try {
    const u = new URL(interactiveUrl);
    const sep24Jwt = u.searchParams.get("token")?.trim();
    const transactionId = u.searchParams.get("transaction_id")?.trim();
    if (!sep24Jwt || !transactionId) return null;
    return { sep24Jwt, transactionId };
  } catch {
    return null;
  }
}
