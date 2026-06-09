import { formatUsdcMinor } from "./quote";
import type { BankTransferInstructions } from "./types";

/**
 * Returns static CLP bank transfer details configured via env vars.
 * All fields are required for the bank transfer flow to work; the API route
 * checks this before creating an intent.
 */
export function getBankInstructions(
  reference: string,
  amountClp: number,
  usdcMinor: number,
): BankTransferInstructions | null {
  const bank_name = process.env.SOZU_CLP_BANK_NAME?.trim();
  const account_number = process.env.SOZU_CLP_BANK_ACCOUNT?.trim();
  const rut = process.env.SOZU_CLP_BANK_RUT?.trim();
  const email = process.env.SOZU_CLP_BANK_EMAIL?.trim();

  if (!bank_name || !account_number || !rut || !email) {
    return null;
  }

  return {
    bank_name,
    account_number,
    rut,
    email,
    reference,
    amount_clp: amountClp,
    usdc_amount: formatUsdcMinor(usdcMinor),
  };
}

/**
 * Generates a short, unique bank reference code.
 * Format: SOZ + 6 uppercase alphanumeric chars, e.g. "SOZAB12C3".
 * Kept intentionally short so users can type it into bank transfer forms easily.
 */
export function generateBankReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "SOZ";
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)];
  }
  return ref;
}
