import "server-only"

import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { rampEnabled } from "@/lib/app-config"
import { resolveUserId } from "@/lib/auth/resolve-user"
import { rampServerConfigured } from "@/lib/ramp/config"
import { getRampProvider } from "@/lib/ramp/registry"
import { deriveUserRampKeypair, ensureUserRampAccount } from "@/lib/ramp/settlement"
import {
  getRampCustomer, setRampCustomerBankAccount, setRampCustomerWallet, upsertRampCustomer,
} from "@/lib/db/ramp"
import { RampProviderError } from "@/lib/ramp/provider"
import type { KycLaunch, RampKycStatus } from "@/lib/ramp/provider"
import type { RampCustomerRow } from "@/lib/ramp/types"

const BANK_ACCOUNT_WRITE_ATTEMPTS = 3
const BANK_ACCOUNT_WRITE_BACKOFF_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Persists the bank account id the provider already created, retrying the DB
 * write a few times before giving up. The provider call is NOT retried here
 * — Etherfuse allows only one BRL bank account per org, so a retry loop that
 * re-calls `registerBankAccount` after this write fails would just get
 * rejected forever with no way to recover the id it already has (there is no
 * bank-account GET endpoint on this provider). Surfacing a distinct reason
 * token turns that silent, permanent-retry dead end into a diagnosable state
 * support can repair by hand.
 */
async function recordBankAccount(
  userId: string,
  provider: string,
  customerId: string,
  bankAccountId: string,
): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= BANK_ACCOUNT_WRITE_ATTEMPTS; attempt++) {
    try {
      await setRampCustomerBankAccount(userId, provider, bankAccountId)
      return
    } catch (err) {
      lastError = err
      if (attempt < BANK_ACCOUNT_WRITE_ATTEMPTS) await sleep(BANK_ACCOUNT_WRITE_BACKOFF_MS)
    }
  }
  // customerId/bankAccountId are provider identifiers, not secrets — safe to log.
  console.error(
    "[ramp/onboarding] bank_account_record_failed — manual repair needed:",
    { customerId, bankAccountId },
    lastError,
  )
  throw new RampProviderError(
    "bank_account_record_failed",
    `Failed to record bank_account_id ${bankAccountId} for customer ${customerId} after ${BANK_ACCOUNT_WRITE_ATTEMPTS} attempts`,
  )
}

export type OnboardingStatus = "not_started" | "verifying" | "incomplete" | "ready"

export function deriveOnboardingStatus(
  customer: RampCustomerRow | null,
  kyc: RampKycStatus | null,
): OnboardingStatus {
  if (!customer) return "not_started"
  // `denied` reads as verifying too: Etherfuse exposes no distinct recovery
  // state — the fix is a fresh kyc-launch, which "verifying" UI offers.
  if (kyc !== "approved") return "verifying"
  if (!customer.bank_account_id || !customer.wallet_id) return "incomplete"
  return "ready"
}

/** appUrl is where the hosted KYC tab lands after /idv. */
function kycReturnUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")
  return `${base}/ramp/kyc-return`
}

export function buildLaunchPayload(customer: RampCustomerRow): KycLaunch & { returnUrl: string } {
  const provider = getRampProvider()
  const launch = provider.buildKycLaunch(customer.customer_id, {
    email: customer.kyc_email,
    displayName: customer.display_name,
  })
  return { ...launch, returnUrl: kycReturnUrl() }
}

export async function startOnboarding(params: {
  userId: string
  displayName: string
  email: string
}): Promise<{ launch: KycLaunch & { returnUrl: string } }> {
  const provider = getRampProvider()
  const existing = await getRampCustomer(params.userId)
  if (existing) return { launch: buildLaunchPayload(existing) }
  const customerId = randomUUID()
  // Re-posting the same org id is idempotent on Etherfuse's side.
  await provider.createOrganization({
    customerId,
    displayName: params.displayName,
    email: params.email,
  })
  const customer = await upsertRampCustomer({
    userId: params.userId,
    customerId,
    kycEmail: params.email,
    displayName: params.displayName,
  })
  return { launch: buildLaunchPayload(customer) }
}

export async function completeSetup(params: {
  userId: string
  firstName: string
  lastName: string
  cpf: string
  pixKey: string
  pixKeyType: string
}): Promise<{ status: OnboardingStatus } | { conflict: string }> {
  const provider = getRampProvider()
  const customer = await getRampCustomer(params.userId)
  if (!customer) return { conflict: "onboarding_not_started" }
  const kyc = await provider.getKycStatus(customer.customer_id)
  if (kyc !== "approved") return { conflict: "kyc_not_approved" }

  // Resumable per field — only one BRL bank account is allowed per org, so
  // a retry after a partial failure must not re-register what already exists.
  if (!customer.bank_account_id) {
    const { bankAccountId } = await provider.registerBankAccount(customer.customer_id, {
      transactionId: randomUUID(),
      firstName: params.firstName,
      lastName: params.lastName,
      cpf: params.cpf,
      pixKey: params.pixKey,
      pixKeyType: params.pixKeyType,
    })
    await recordBankAccount(params.userId, customer.provider, customer.customer_id, bankAccountId)
  }
  if (!customer.wallet_id) {
    // Etherfuse rejects reusing the same G across organizations ("This
    // wallet is claimed by another organization"), so each customer gets a
    // unique, deterministically-derived per-user G instead of treasury's.
    await ensureUserRampAccount(params.userId)
    const userPk = deriveUserRampKeypair(params.userId).publicKey()
    const { walletId } = await provider.registerWallet(customer.customer_id, userPk)
    await setRampCustomerWallet(params.userId, customer.provider, walletId)
  }
  return { status: "ready" }
}

/** Shared guard for every /api/ramp/* route. */
export async function rampRouteGuard(request: Request):
  Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  if (!rampEnabled) {
    return { error: NextResponse.json({ error: "ramp_disabled" }, { status: 503 }) }
  }
  if (!rampServerConfigured()) {
    return { error: NextResponse.json({ error: "ramp_not_configured" }, { status: 503 }) }
  }
  return resolveUserId(request)
}
