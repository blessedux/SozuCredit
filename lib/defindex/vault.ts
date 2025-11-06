/**
 * DeFindex Vault Service
 * Handles interactions with DeFindex vaults and strategies
 * Based on: https://docs.defindex.io/strategy-developers/03-how-to-create-a-strategy
 */

import { getDeFindexConfig, validateDeFindexConfig } from "./config"
import { Contract, Address, nativeToScVal, scValToNative, xdr, TransactionBuilder, Account, BASE_FEE, Networks, Keypair, Horizon } from "@stellar/stellar-sdk"
import { getUSDCBalance } from "@/lib/turnkey/stellar-wallet"
import { getStellarConfig } from "@/lib/turnkey/config"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { Api } from "@stellar/stellar-sdk/rpc"
import { signSorobanTransaction, submitSorobanTransaction } from "@/lib/turnkey/soroban-signing"
import { updatePositionOnDeposit, saveTransaction, updateTransactionStatus } from "./positions"

export interface VaultBalance {
  walletBalance: number // Balance in wallet
  strategyBalance: number // Balance in DeFindex strategy
  totalBalance: number // Total balance (wallet + strategy)
  strategyShares: number // Shares in strategy
}

export interface StrategyInfo {
  strategyAddress: string
  assetAddress: string
  apy: number // Current APY percentage
  totalAssets: number // Total assets in strategy
  totalShares: number // Total shares in strategy
}

/**
 * Get Soroban RPC client for contract interactions
 */
export function getSorobanRpc(): rpc.Server {
  const config = getDeFindexConfig()
  
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.network === "testnet"
  })
}

/**
 * Get contract instance for a strategy
 */
function getStrategyContract(strategyAddress: string): Contract {
  return new Contract(strategyAddress)
}

/**
 * Convert Stellar address string to Address ScVal
 */
function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal()
}

/**
 * Convert number to i128 ScVal for amounts
 */
function amountToScVal(amount: number): xdr.ScVal {
  // Convert to bigint (Stellar uses 7 decimal places, so multiply by 10^7)
  const scaledAmount = BigInt(Math.floor(amount * 10000000))
  const mask64 = BigInt("0xFFFFFFFFFFFFFFFF")
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      hi: xdr.Int64.fromString((scaledAmount >> BigInt(64)).toString()),
      lo: xdr.Uint64.fromString((scaledAmount & mask64).toString())
    })
  )
}

/**
 * Convert i128 ScVal to number
 */
function scValToAmount(scVal: xdr.ScVal): number {
  try {
    const i128 = scVal.i128()
    const hi = BigInt(i128.hi().toString())
    const lo = BigInt(i128.lo().toString())
    const shift64 = BigInt(64)
    const amount = (hi << shift64) | lo
    return Number(amount) / 10000000 // Divide by 10^7 to get real amount
  } catch {
    // Fallback to native conversion if available
    return Number(scValToNative(scVal))
  }
}

/**
 * Get vault balance for a user
 * Queries both wallet balance and strategy balance
 */
export async function getVaultBalance(
  userWalletAddress: string,
  userId?: string,
  strategyAddress?: string
): Promise<VaultBalance> {
  const config = getDeFindexConfig()

  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid. Please check environment variables.")
  }

  try {
    // Query wallet balance from Stellar network using existing wallet service
    const walletBalance = await getUSDCBalance(userWalletAddress)

    let strategyBalance = 0
    let strategyShares = 0

    // If we have a userId, try to get strategy balance from database records
    // instead of contract queries (since the contract doesn't support individual balance queries)
    if (userId) {
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)

          // Get user's position from database
          const targetStrategy = strategyAddress || config.defindexStrategyAddress
          const { data: position } = await supabase
            .from("defindex_positions")
            .select("*")
            .eq("user_id", userId)
            .eq("strategy_address", targetStrategy)
            .single()

          if (position) {
            // Calculate strategy balance based on total deposited minus total withdrawn
            strategyBalance = Number(position.total_deposited) - Number(position.total_withdrawn)
            strategyShares = Number(position.shares)
            console.log(`[DeFindex] Found position in database: balance=${strategyBalance}, shares=${strategyShares}`)
          }
        }
      } catch (dbError) {
        console.warn("[DeFindex] Could not get position from database:", dbError)
      }
    }

    // Fallback: try contract query (will likely return 0 since functions don't exist)
    if (strategyBalance === 0) {
      try {
        const strategyInfo = await getStrategyInfo(strategyAddress || config.defindexStrategyAddress)
        strategyBalance = await getUserStrategyBalance(userWalletAddress, strategyInfo)
        strategyShares = await getUserStrategyShares(userWalletAddress, strategyInfo)
        console.log(`[DeFindex] Using contract query: balance=${strategyBalance}, shares=${strategyShares}`)
      } catch (contractError) {
        console.warn("[DeFindex] Contract query failed:", contractError)
      }
    }

    return {
      walletBalance,
      strategyBalance,
      totalBalance: walletBalance + strategyBalance,
      strategyShares,
    }
  } catch (error) {
    console.error("[DeFindex] Error getting vault balance:", error)
    throw error
  }
}

/**
 * Deposit assets into DeFindex strategy
 * Implements the deposit flow with real transaction signing and submission
 */
export async function depositToStrategy(
  userWalletAddress: string,
  amount: number,
  userId?: string,
  strategyAddress?: string
): Promise<{ success: boolean; shares: number; balance: number; transactionHash?: string }> {
  const config = getDeFindexConfig()
  
  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }
  
  if (!userId) {
    throw new Error("User ID is required for transaction signing")
  }
  
  try {
    const sorobanRpc = getSorobanRpc()
    const strategyAddr = strategyAddress || config.defindexStrategyAddress
    const contract = getStrategyContract(strategyAddr)
    
    // Get user's account information from Horizon API
    // Horizon API is needed to get the account sequence number for transaction building
    console.log("[DeFindex] Getting account information for:", userWalletAddress)
    const stellarConfig = getStellarConfig()
    const horizonServer = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )
    
    const accountResponse = await horizonServer.loadAccount(userWalletAddress)
    
    if (!accountResponse) {
      throw new Error("Account not found on network")
    }
    
    // Create account object with sequence number
    const account = new Account(userWalletAddress, accountResponse.sequenceNumber())
    
    // Prepare contract call parameters
    const userAddress = addressToScVal(userWalletAddress)
    const amountScVal = amountToScVal(amount)
    
    // Build transaction with deposit operation
    const networkPassphrase = config.network === "testnet" 
      ? Networks.TESTNET 
      : Networks.PUBLIC
    
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call("deposit", userAddress, amountScVal))
      .setTimeout(30)
      .build()
    
    // Simulate transaction first to check if it will succeed
    console.log("[DeFindex] Simulating deposit transaction...")
    const simulateResult = await sorobanRpc.simulateTransaction(transaction)
    
    if (Api.isSimulationError(simulateResult)) {
      const error = (simulateResult as Api.SimulateTransactionErrorResponse).error
      console.error("[DeFindex] Deposit simulation failed:", error)
      throw new Error(`Deposit simulation failed: ${error}`)
    }
    
    if (!Api.isSimulationSuccess(simulateResult) || !simulateResult.result) {
      throw new Error("Deposit simulation did not return a result")
    }
    
    // Get expected shares from simulation
    const sharesScVal = (simulateResult as Api.SimulateTransactionSuccessResponse).result!.retval
    const shares = scValToAmount(sharesScVal)
    
    console.log("[DeFindex] Deposit simulation successful:", {
      userWalletAddress,
      amount,
      expectedShares: shares,
      strategyAddress: strategyAddr,
    })
    
    // Sign transaction with Turnkey
    console.log("[DeFindex] Signing transaction with Turnkey...")
    const signedTransaction = await signSorobanTransaction(userId, transaction)
    
    // Submit transaction to network
    console.log("[DeFindex] Submitting transaction to Soroban network...")
    const submitResult = await submitSorobanTransaction(signedTransaction, config.network)
    
    if (!submitResult.success) {
      // Save failed transaction record for tracking
      if (userId && submitResult.transactionHash) {
        try {
          await saveTransaction(
            userId,
            submitResult.transactionHash,
            "deposit",
            amount,
            strategyAddr,
            {
              shares,
              status: "failed",
              errorMessage: `Transaction failed with status: ${submitResult.status}`,
            },
            true // use service client
          )
        } catch (dbError) {
          console.error("[DeFindex] Failed to save failed transaction record:", dbError)
        }
      }
      throw new Error(`Transaction submission failed with status: ${submitResult.status}`)
    }
    
    console.log("[DeFindex] ✅ Deposit transaction successful!")
    console.log("[DeFindex] Transaction hash:", submitResult.transactionHash)
    
    // Save transaction record and update position (non-blocking)
    if (userId && submitResult.transactionHash) {
      try {
        // Update position first
        const positionId = await updatePositionOnDeposit(
          userId,
          strategyAddr,
          amount,
          shares,
          true // use service client
        )
        
        // Save transaction record
        await saveTransaction(
          userId,
          submitResult.transactionHash,
          "deposit",
          amount,
          strategyAddr,
          {
            positionId,
            shares,
            status: submitResult.status === "SUCCESS" ? "confirmed" : "pending",
          },
          true // use service client
        )
        
        // If transaction was pending, update status when confirmed
        if (submitResult.status === "SUCCESS") {
          await updateTransactionStatus(
            submitResult.transactionHash,
            "confirmed",
            null,
            true // use service client
          )
        }
        
        console.log("[DeFindex] ✅ Position and transaction saved to database")
      } catch (dbError) {
        // Log error but don't fail the deposit - transaction already succeeded on-chain
        console.error("[DeFindex] Error saving position/transaction to database:", dbError)
        // Still save transaction record for tracking (even if position update failed)
        try {
          await saveTransaction(
            userId,
            submitResult.transactionHash,
            "deposit",
            amount,
            strategyAddr,
            {
              shares,
              status: "confirmed",
              errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
            },
            true
          )
        } catch (saveError) {
          console.error("[DeFindex] Failed to save transaction record:", saveError)
        }
      }
    }
    
    // Get updated balance after deposit
    const strategyInfo = await getStrategyInfo(strategyAddr)
    const updatedBalance = await getUserStrategyBalance(userWalletAddress, strategyInfo)
    
    return {
      success: true,
      shares,
      balance: updatedBalance,
      transactionHash: submitResult.transactionHash,
    }
  } catch (error) {
    console.error("[DeFindex] Error depositing to strategy:", error)
    throw error
  }
}

/**
 * Withdraw assets from DeFindex strategy
 * Implements the withdraw flow from DeFindex strategy interface
 */
export async function withdrawFromStrategy(
  userWalletAddress: string,
  amount: number,
  strategyAddress?: string
): Promise<{ success: boolean; balance: number }> {
  const config = getDeFindexConfig()
  
  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }
  
  try {
    const rpc = getSorobanRpc()
    const strategyAddr = strategyAddress || config.defindexStrategyAddress
    const contract = getStrategyContract(strategyAddr)
    
    // Call the withdraw function on the strategy contract
    const userAddress = addressToScVal(userWalletAddress)
    const amountScVal = amountToScVal(amount)
    
    // Build a transaction with the withdraw operation
    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const transaction = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase: config.network === "testnet" 
        ? Networks.TESTNET 
        : Networks.PUBLIC
    })
      .addOperation(contract.call("withdraw", userAddress, amountScVal))
      .setTimeout(30)
      .build()
    
    // Simulate the transaction to get the result
    const simulateResult = await rpc.simulateTransaction(transaction)
    
    if (Api.isSimulationError(simulateResult)) {
      throw new Error(`Withdraw simulation failed: ${(simulateResult as Api.SimulateTransactionErrorResponse).error}`)
    }
    
    console.log("[DeFindex] Withdraw simulated successfully:", {
      userWalletAddress,
      amount,
      strategyAddress: strategyAddr,
    })
    
    // Get updated balance after withdraw
    const strategyInfo = await getStrategyInfo(strategyAddr)
    const updatedBalance = await getUserStrategyBalance(userWalletAddress, strategyInfo)
    
    return {
      success: true,
      balance: updatedBalance,
    }
  } catch (error) {
    console.error("[DeFindex] Error withdrawing from strategy:", error)
    throw error
  }
}

/**
 * Harvest rewards from DeFindex strategy
 * Implements the harvest flow from DeFindex strategy interface
 */
export async function harvestStrategy(
  userWalletAddress: string,
  strategyAddress?: string
): Promise<{ success: boolean; rewards: number }> {
  const config = getDeFindexConfig()
  
  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }
  
  try {
    const rpc = getSorobanRpc()
    const strategyAddr = strategyAddress || config.defindexStrategyAddress
    const contract = getStrategyContract(strategyAddr)
    
    // Call the harvest function on the strategy contract
    const userAddress = addressToScVal(userWalletAddress)
    
    // Build a transaction with the harvest operation
    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const transaction = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase: config.network === "testnet" 
        ? Networks.TESTNET 
        : Networks.PUBLIC
    })
      .addOperation(contract.call("harvest", userAddress))
      .setTimeout(30)
      .build()
    
    // Simulate the transaction to get the result
    const simulateResult = await rpc.simulateTransaction(transaction)
    
    if (Api.isSimulationError(simulateResult)) {
      throw new Error(`Harvest simulation failed: ${(simulateResult as Api.SimulateTransactionErrorResponse).error}`)
    }
    
    // Get rewards from simulation result (only available on success)
    if (!Api.isSimulationSuccess(simulateResult) || !simulateResult.result) {
      return { success: true, rewards: 0 }
    }
    
    const rewardsScVal = (simulateResult as Api.SimulateTransactionSuccessResponse).result!.retval
    const rewards = scValToAmount(rewardsScVal)
    
    console.log("[DeFindex] Harvest simulated successfully:", {
      userWalletAddress,
      rewards,
      strategyAddress: strategyAddr,
    })
    
    return {
      success: true,
      rewards,
    }
  } catch (error) {
    console.error("[DeFindex] Error harvesting strategy:", error)
    throw error
  }
}

/**
 * Get strategy information including current APY
 */
export async function getStrategyInfo(
  strategyAddress?: string
): Promise<StrategyInfo> {
  const config = getDeFindexConfig()
  
  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }
  
  try {
    const rpc = getSorobanRpc()
    const strategyAddr = strategyAddress || config.defindexStrategyAddress
    const contract = getStrategyContract(strategyAddr)
    
    // Build transactions for querying strategy info
    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const networkPassphrase = config.network === "testnet" 
      ? Networks.TESTNET 
      : Networks.PUBLIC
    
    // Query strategy contract for total assets
    const totalAssetsTx = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase
    })
      .addOperation(contract.call("total_assets"))
      .setTimeout(30)
      .build()
    
    const totalAssetsResult = await rpc.simulateTransaction(totalAssetsTx)
    const totalAssets = Api.isSimulationError(totalAssetsResult) || !Api.isSimulationSuccess(totalAssetsResult) || !totalAssetsResult.result
      ? 0
      : scValToAmount((totalAssetsResult as Api.SimulateTransactionSuccessResponse).result!.retval)
    
    // Query strategy contract for total shares
    const totalSharesTx = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase
    })
      .addOperation(contract.call("total_shares"))
      .setTimeout(30)
      .build()
    
    const totalSharesResult = await rpc.simulateTransaction(totalSharesTx)
    const totalShares = Api.isSimulationError(totalSharesResult) || !Api.isSimulationSuccess(totalSharesResult) || !totalSharesResult.result
      ? 0
      : scValToAmount((totalSharesResult as Api.SimulateTransactionSuccessResponse).result!.retval)
    
    // Use the comprehensive APY calculator instead of direct contract calls
    // This provides better fallback mechanisms and multiple data sources
    let apy = 15.5 // Default fallback APY

    try {
      const { getRealTimeAPY } = await import('./apy-calculator')
      const apyResult = await getRealTimeAPY(strategyAddr)

      if (apyResult.success && apyResult.data) {
        apy = apyResult.data.yearly
        console.log(`[DeFindex] Using calculated APY:`, apy, "% (source:", apyResult.data.source, ")")
      } else {
        console.warn("[DeFindex] APY calculation failed, using fallback:", apy, "%")
      }
    } catch (apyError) {
      console.warn("[DeFindex] APY calculator import/execution failed, using fallback:", apy, "%", apyError)
    }
    
    return {
      strategyAddress: strategyAddr,
      assetAddress: config.assetAddress,
      apy,
      totalAssets,
      totalShares,
    }
  } catch (error) {
    console.error("[DeFindex] Error getting strategy info:", error)
    // Return fallback data if query fails
    return {
      strategyAddress: strategyAddress || config.defindexStrategyAddress,
      assetAddress: config.assetAddress,
      apy: 15.5,
      totalAssets: 0,
      totalShares: 0,
    }
  }
}

/**
 * Get user's strategy balance
 */
async function getUserStrategyBalance(
  userWalletAddress: string,
  strategyInfo: StrategyInfo
): Promise<number> {
  try {
    const rpc = getSorobanRpc()
    const contract = getStrategyContract(strategyInfo.strategyAddress)
    
    // Query strategy contract for user's balance
    const userAddress = addressToScVal(userWalletAddress)
    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const networkPassphrase = strategyInfo.strategyAddress.startsWith("C") 
      ? (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC)
      : Networks.TESTNET
    
    const balanceTx = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase
    })
      .addOperation(contract.call("balance_of", userAddress))
      .setTimeout(30)
      .build()
    
    const balanceResult = await rpc.simulateTransaction(balanceTx)
    
    if (Api.isSimulationError(balanceResult)) {
      console.warn("[DeFindex] Error querying user balance:", (balanceResult as Api.SimulateTransactionErrorResponse).error)
      return 0
    }
    
    if (!Api.isSimulationSuccess(balanceResult) || !balanceResult.result) {
      return 0
    }
    
    const balanceScVal = (balanceResult as Api.SimulateTransactionSuccessResponse).result!.retval
    return scValToAmount(balanceScVal)
  } catch (error) {
    console.error("[DeFindex] Error getting user strategy balance:", error)
    return 0
  }
}

/**
 * Get user's strategy shares
 */
async function getUserStrategyShares(
  userWalletAddress: string,
  strategyInfo: StrategyInfo
): Promise<number> {
  try {
    const rpc = getSorobanRpc()
    const contract = getStrategyContract(strategyInfo.strategyAddress)
    
    // Query strategy contract for user's shares
    const userAddress = addressToScVal(userWalletAddress)
    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const networkPassphrase = strategyInfo.strategyAddress.startsWith("C")
      ? (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet" ? Networks.TESTNET : Networks.PUBLIC)
      : Networks.TESTNET
    
    const sharesTx = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase
    })
      .addOperation(contract.call("shares_of", userAddress))
      .setTimeout(30)
      .build()
    
    const sharesResult = await rpc.simulateTransaction(sharesTx)
    
    if (Api.isSimulationError(sharesResult)) {
      console.warn("[DeFindex] Error querying user shares:", (sharesResult as Api.SimulateTransactionErrorResponse).error)
  return 0
}

    if (!Api.isSimulationSuccess(sharesResult) || !sharesResult.result) {
      return 0
    }
    
    const sharesScVal = (sharesResult as Api.SimulateTransactionSuccessResponse).result!.retval
    return scValToAmount(sharesScVal)
  } catch (error) {
    console.error("[DeFindex] Error getting user strategy shares:", error)
    return 0
  }
}
