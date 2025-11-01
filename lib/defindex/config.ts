/**
 * DeFindex Configuration
 * Configures connection to DeFindex protocol and strategies
 */

export interface DeFindexConfig {
  network: "testnet" | "mainnet"
  rpcUrl: string
  defindexVaultAddress: string
  defindexStrategyAddress: string
  assetAddress: string // USDC contract address on Soroban
}

/**
 * Get DeFindex configuration based on environment
 */
export function getDeFindexConfig(): DeFindexConfig {
  const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK as "testnet" | "mainnet") || "testnet"
  
  // Soroban RPC URLs
  const rpcUrl = network === "testnet"
    ? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
    : process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban.stellar.org"
  
  // DeFindex contract addresses (these should be set via environment variables)
  // For now, using placeholder addresses - these need to be set based on actual deployments
  const defindexVaultAddress = process.env.DEFINDEX_VAULT_ADDRESS || ""
  const defindexStrategyAddress = process.env.DEFINDEX_STRATEGY_ADDRESS || ""
  
  // USDC contract address on Soroban (testnet vs mainnet)
  const assetAddress = network === "testnet"
    ? process.env.TESTNET_USDC_CONTRACT_ADDRESS || ""
    : process.env.MAINNET_USDC_CONTRACT_ADDRESS || ""
  
  return {
    network,
    rpcUrl,
    defindexVaultAddress,
    defindexStrategyAddress,
    assetAddress,
  }
}

/**
 * Validate DeFindex configuration
 */
export function validateDeFindexConfig(config: DeFindexConfig): boolean {
  return !!(
    config.rpcUrl &&
    config.defindexVaultAddress &&
    config.defindexStrategyAddress &&
    config.assetAddress
  )
}

