import { hash, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"

/** XDR-encode Vec<u32> the same way Soroban `ToXdr` does for context_rule_ids. */
export function contextRuleIdsToXdr(ruleIds: number[]): Buffer {
  return xdr.ScVal.scvVec(ruleIds.map((id) => xdr.ScVal.scvU32(id))).toXDR()
}

/**
 * OZ smart-account WASM (3e51f5b2…) binds rule selection into the signed digest:
 * auth_digest = sha256(signature_payload || context_rule_ids.to_xdr())
 */
export function computeOzAuthDigest(
  signaturePayload32: Buffer,
  contextRuleIds: number[],
): Buffer {
  const preimage = Buffer.concat([signaturePayload32, contextRuleIdsToXdr(contextRuleIds)])
  return hash(preimage)
}

/**
 * Soroban host signature_payload for a SorobanAuthorizationEntry (32-byte hash).
 */
export function sorobanSignaturePayloadFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
}): Buffer {
  const credentials = params.entry.credentials().address()
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(params.networkPassphrase)),
      nonce: credentials.nonce(),
      signatureExpirationLedger: credentials.signatureExpirationLedger(),
      invocation: params.entry.rootInvocation(),
    }),
  )
  return hash(preimage.toXDR())
}

/** WebAuthn challenge (base64url) for OZ passkey signing on new smart-account WASM. */
export function ozWebAuthnChallengeFromEntry(params: {
  networkPassphrase: string
  entry: xdr.SorobanAuthorizationEntry
  contextRuleIds: number[]
}): string {
  const signaturePayload = sorobanSignaturePayloadFromEntry({
    networkPassphrase: params.networkPassphrase,
    entry: params.entry,
  })
  const authDigest = computeOzAuthDigest(signaturePayload, params.contextRuleIds)
  return base64url(authDigest)
}

/**
 * New OZ AuthPayload: map { context_rule_ids, signers } on credentials.signature.
 */
export function buildOzAuthPayloadScVal(
  signerEntries: xdr.ScMapEntry[],
  contextRuleIds: number[],
): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("context_rule_ids"),
      val: xdr.ScVal.scvVec(contextRuleIds.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signers"),
      val: xdr.ScVal.scvMap(signerEntries),
    }),
  ])
}

/**
 * Rule IDs for wallets deployed via deployOzSmartAccountForUser (Default rule id 0).
 * One id per Soroban auth context; a single USDC transfer uses one context → [0].
 */
export function defaultContextRuleIdsForEntry(
  _entry: xdr.SorobanAuthorizationEntry,
): number[] {
  return [0]
}
