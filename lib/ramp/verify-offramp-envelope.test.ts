import { describe, expect, it } from "vitest"
import { Account, Address, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal } from "@stellar/stellar-sdk"
import { verifyOfframpEnvelope } from "@/lib/ramp/verify-offramp-envelope"

const NETWORK_PASSPHRASE = Networks.TESTNET
const SENDER_C = Address.contract(Buffer.alloc(32, 1)).toString()
const SAC_CONTRACT = Address.contract(Buffer.alloc(32, 2)).toString()
const OTHER_CONTRACT = Address.contract(Buffer.alloc(32, 3)).toString()
const OTHER_C = Address.contract(Buffer.alloc(32, 4)).toString()
const DESTINATION_G = Keypair.random().publicKey()
const OTHER_G = Keypair.random().publicKey()
const FEE_PAYER_G = Keypair.random().publicKey()
const AMOUNT_MINOR = 12_345_678

const expected = {
  senderC: SENDER_C,
  destinationG: DESTINATION_G,
  sacContractId: SAC_CONTRACT,
  amountMinor: AMOUNT_MINOR,
  networkPassphrase: NETWORK_PASSPHRASE,
}

/** Builds an unsigned envelope — verification only inspects operation structure, never signatures. */
function buildEnvelope(opts: {
  contractId?: string
  functionName?: string
  from?: string
  to?: string
  amountMinor?: number
  extraOp?: boolean
  extraArg?: boolean
}): string {
  const account = new Account(FEE_PAYER_G, "0")
  const builder = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
  const contract = new Contract(opts.contractId ?? SAC_CONTRACT)
  const args = [
    Address.fromString(opts.from ?? SENDER_C).toScVal(),
    Address.fromString(opts.to ?? DESTINATION_G).toScVal(),
    nativeToScVal(BigInt(opts.amountMinor ?? AMOUNT_MINOR), { type: "i128" }),
  ]
  if (opts.extraArg) args.push(nativeToScVal(BigInt(1), { type: "i128" }))
  builder.addOperation(contract.call(opts.functionName ?? "transfer", ...args))
  if (opts.extraOp) {
    builder.addOperation(
      contract.call(
        "transfer",
        Address.fromString(SENDER_C).toScVal(),
        Address.fromString(DESTINATION_G).toScVal(),
        nativeToScVal(BigInt(AMOUNT_MINOR), { type: "i128" }),
      ),
    )
  }
  return builder.setTimeout(30).build().toEnvelope().toXDR("base64")
}

describe("verifyOfframpEnvelope", () => {
  it("accepts a correctly-built C→treasury transfer matching the order exactly", () => {
    const envelope = buildEnvelope({})
    expect(verifyOfframpEnvelope(envelope, expected)).toEqual({ ok: true })
  })

  it("rejects a wrong amount — the treasury-drain scenario (e.g. a 1-stroop self-transfer)", () => {
    const envelope = buildEnvelope({ amountMinor: 1 })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_amount")
  })

  it("rejects a destination other than treasury", () => {
    const envelope = buildEnvelope({ to: OTHER_G })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_destination")
  })

  it("rejects a sender other than the order's recorded C address", () => {
    const envelope = buildEnvelope({ from: OTHER_C })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_sender")
  })

  it("rejects a contract other than the expected USDC SAC", () => {
    const envelope = buildEnvelope({ contractId: OTHER_CONTRACT })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_contract")
  })

  it("rejects a non-transfer function call on the same contract", () => {
    const envelope = buildEnvelope({ functionName: "approve" })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("not_transfer")
  })

  it("rejects a multi-operation transaction", () => {
    const envelope = buildEnvelope({ extraOp: true })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_operation_count")
  })

  it("rejects a transfer call with an unexpected argument count", () => {
    const envelope = buildEnvelope({ extraArg: true })
    const result = verifyOfframpEnvelope(envelope, expected)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("wrong_arg_count")
  })

  it("rejects unparseable XDR", () => {
    const result = verifyOfframpEnvelope("not-valid-xdr", expected)
    expect(result).toEqual({ ok: false, reason: "unparseable" })
  })
})
