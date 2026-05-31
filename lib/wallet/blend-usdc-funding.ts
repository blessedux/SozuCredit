import { getBlendStrategyLink } from "@/lib/defindex/blend-strategy-link"

export const BLEND_USDC_TESTNET_CONTRACT =
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"

export type BlendUsdcFundingGuide = {
  faucetUrl: string
  poolDeepLink: string
  contractId: string
  steps: string[]
}

/** How to obtain testnet BlendUSDC for sends from a C smart account. */
export function getBlendUsdcTestnetFundingGuide(network: "testnet" | "mainnet" = "testnet"): BlendUsdcFundingGuide | null {
  if (network !== "testnet") return null

  const link = getBlendStrategyLink("testnet", "fixed")

  return {
    faucetUrl: "https://testnet.blend.capital",
    poolDeepLink: link.url,
    contractId: BLEND_USDC_TESTNET_CONTRACT,
    steps: [
      "Connect Freighter (or another Stellar wallet) on Testnet.",
      "Open the Blend testnet faucet and mint / borrow test BlendUSDC.",
      "Transfer BlendUSDC to your Sozu smart account address (C… shown in Depositar).",
      "Confirm balance on Stellar Expert under Soroban assets (contract CAQCFVLO…), not only classic Circle USDC on G.",
      "Use Enviar in Sozu Credit for E2E payment tests (sends require BlendUSDC on C).",
    ],
  }
}
