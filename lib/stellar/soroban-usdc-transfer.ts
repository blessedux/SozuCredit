/**
 * @deprecated Import from `@/lib/stellar/send-token` instead.
 * Re-exports preserve existing import paths during migration.
 */
export {
  sendToken,
  buildSorobanUsdcTransferXdr,
  buildOzSmartUsdcTransferEnvelope,
  submitSignedSorobanEnvelope,
} from "@/lib/stellar/send-token"

import { getBlendUsdcAsset } from "@/lib/stellar/asset-registry"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

/** @deprecated Use asset registry contractId */
export function getUsdcTokenContractId(network: StellarNetwork): string {
  return getBlendUsdcAsset(network).contractId
}
