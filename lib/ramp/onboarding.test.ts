import { describe, expect, it, vi } from "vitest"
import { completeSetup, deriveOnboardingStatus } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import type { RampCustomerRow } from "@/lib/ramp/types"

const mocks = vi.hoisted(() => ({
  registerBankAccount: vi.fn(),
  getKycStatus: vi.fn(),
  getRampCustomer: vi.fn(),
  setRampCustomerBankAccount: vi.fn(),
  setRampCustomerWallet: vi.fn(),
  upsertRampCustomer: vi.fn(),
}))

vi.mock("@/lib/ramp/registry", () => ({
  getRampProvider: () => ({
    registerBankAccount: mocks.registerBankAccount,
    getKycStatus: mocks.getKycStatus,
  }),
}))

vi.mock("@/lib/db/ramp", () => ({
  getRampCustomer: mocks.getRampCustomer,
  setRampCustomerBankAccount: mocks.setRampCustomerBankAccount,
  setRampCustomerWallet: mocks.setRampCustomerWallet,
  upsertRampCustomer: mocks.upsertRampCustomer,
}))

const base: RampCustomerRow = {
  user_id: "u", provider: "etherfuse", customer_id: "c", kyc_email: "a@b.c",
  display_name: "A", bank_account_id: null, wallet_id: null,
  created_at: "", updated_at: "",
}

describe("deriveOnboardingStatus", () => {
  it("not_started without a customer row", () => {
    expect(deriveOnboardingStatus(null, null)).toBe("not_started")
  })
  it("verifying until KYC approves (denied included — recovery is a fresh launch)", () => {
    expect(deriveOnboardingStatus(base, "in_progress")).toBe("verifying")
    expect(deriveOnboardingStatus(base, "denied")).toBe("verifying")
  })
  it("incomplete when approved but bank or wallet missing", () => {
    expect(deriveOnboardingStatus(base, "approved")).toBe("incomplete")
    expect(deriveOnboardingStatus({ ...base, bank_account_id: "b" }, "approved")).toBe("incomplete")
  })
  it("ready when approved with bank and wallet", () => {
    expect(deriveOnboardingStatus({ ...base, bank_account_id: "b", wallet_id: "w" }, "approved")).toBe("ready")
  })
})

describe("completeSetup — bank account write resumability", () => {
  it("throws bank_account_record_failed (not a re-registration) when the DB write fails after the provider already created the account", async () => {
    mocks.getRampCustomer.mockReset().mockResolvedValue(base)
    mocks.getKycStatus.mockReset().mockResolvedValue("approved")
    mocks.registerBankAccount.mockReset().mockResolvedValue({ bankAccountId: "bank-123" })
    mocks.setRampCustomerBankAccount.mockReset().mockRejectedValue(new Error("db down"))

    let caught: unknown
    try {
      await completeSetup({
        userId: "u", firstName: "A", lastName: "B", cpf: "12345678901",
        pixKey: "a@b.c", pixKeyType: "email",
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(RampProviderError)
    expect((caught as RampProviderError).reason).toBe("bank_account_record_failed")
    // The provider already created the bank account — Etherfuse allows only
    // one per org, so a retry must not re-call it after the DB write fails.
    expect(mocks.registerBankAccount).toHaveBeenCalledTimes(1)
    expect(mocks.setRampCustomerBankAccount).toHaveBeenCalledTimes(3)
  })
})
