/** Warm kit + on-chain connect so Pay can open the passkey prompt on tap. */
export async function warmKitForPay(
  contractId: string | null | undefined,
  credentialId: string | null | undefined,
): Promise<void> {
  const c = contractId?.trim().toUpperCase() ?? ""
  const cred = credentialId?.trim() ?? ""
  if (!c.startsWith("C") || !cred) return
  try {
    const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
    const { ensureKitConnectedForSend } = await import(
      "@/lib/stellar/smartAccounts/ensureKitConnected"
    )
    const { kit } = await getSmartAccountKit()
    await ensureKitConnectedForSend(kit, cred, c)
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[checkout] Kit warm-up skipped:", err)
    }
  }
}
