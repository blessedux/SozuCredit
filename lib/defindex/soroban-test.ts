/**
 * Soroban SDK Integration Test
 * Verifies that @stellar/stellar-sdk supports Soroban contract calls
 */

import { getDeFindexConfig } from "./config"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { Contract, Address, Networks } from "@stellar/stellar-sdk"

/**
 * Test Soroban RPC connection
 */
export async function testSorobanRpcConnection(): Promise<boolean> {
  try {
    const config = getDeFindexConfig()
    console.log("[Soroban Test] Testing RPC connection to:", config.rpcUrl)
    
    const sorobanRpc = new rpc.Server(config.rpcUrl, {
      allowHttp: config.network === "testnet"
    })
    
    // Test connection by getting latest ledger
    const latestLedger = await sorobanRpc.getLatestLedger()
    
    if (latestLedger && latestLedger.sequence) {
      console.log("[Soroban Test] ✅ RPC connection successful!")
      console.log("[Soroban Test] Latest ledger sequence:", latestLedger.sequence)
      return true
    }
    
    console.error("[Soroban Test] ❌ RPC connection failed: No ledger data returned")
    return false
  } catch (error) {
    console.error("[Soroban Test] ❌ RPC connection failed:", error)
    return false
  }
}

/**
 * Test contract address format and encoding
 */
export function testContractAddressFormat(address: string): boolean {
  try {
    console.log("[Soroban Test] Testing contract address format:", address)
    
    // Soroban contract addresses start with 'C' and are base32 encoded
    if (!address || address.length === 0) {
      console.error("[Soroban Test] ❌ Contract address is empty")
      return false
    }
    
    // Check if it starts with 'C' (Soroban contract address format)
    if (address.startsWith("C")) {
      console.log("[Soroban Test] ✅ Contract address format is valid (starts with 'C')")
      
      // Try to create an Address object from it
      try {
        const addr = Address.fromString(address)
        console.log("[Soroban Test] ✅ Contract address can be parsed as Address object")
        return true
      } catch (parseError) {
        console.error("[Soroban Test] ❌ Contract address cannot be parsed:", parseError)
        return false
      }
    } else {
      console.warn("[Soroban Test] ⚠️ Contract address does not start with 'C' (may be Stellar account address 'G')")
      // Still try to parse it - it might be a valid address
      try {
        const addr = Address.fromString(address)
        console.log("[Soroban Test] ✅ Address can be parsed (may be Stellar account address)")
        return true
      } catch (parseError) {
        console.error("[Soroban Test] ❌ Address cannot be parsed:", parseError)
        return false
      }
    }
  } catch (error) {
    console.error("[Soroban Test] ❌ Contract address format test failed:", error)
    return false
  }
}

/**
 * Test contract instance creation
 */
export function testContractInstance(strategyAddress: string): boolean {
  try {
    console.log("[Soroban Test] Testing contract instance creation for:", strategyAddress)
    
    const contract = new Contract(strategyAddress)
    
    if (contract) {
      console.log("[Soroban Test] ✅ Contract instance created successfully")
      console.log("[Soroban Test] Contract address:", contract.contractId())
      return true
    }
    
    console.error("[Soroban Test] ❌ Contract instance creation failed")
    return false
  } catch (error) {
    console.error("[Soroban Test] ❌ Contract instance creation failed:", error)
    return false
  }
}

/**
 * Run all Soroban SDK integration tests
 */
export async function runSorobanIntegrationTests(): Promise<{
  rpcConnection: boolean
  contractAddressFormat: boolean
  contractInstance: boolean
  allPassed: boolean
}> {
  console.log("[Soroban Test] ===== Starting Soroban SDK Integration Tests =====")
  
  const config = getDeFindexConfig()
  
  // Test 1: RPC Connection
  const rpcConnection = await testSorobanRpcConnection()
  
  // Test 2: Contract Address Format
  const contractAddressFormat = config.defindexStrategyAddress
    ? testContractAddressFormat(config.defindexStrategyAddress)
    : false
  
  // Test 3: Contract Instance Creation
  const contractInstance = config.defindexStrategyAddress
    ? testContractInstance(config.defindexStrategyAddress)
    : false
  
  const allPassed = rpcConnection && contractAddressFormat && contractInstance
  
  console.log("[Soroban Test] ===== Test Results =====")
  console.log("[Soroban Test] RPC Connection:", rpcConnection ? "✅" : "❌")
  console.log("[Soroban Test] Contract Address Format:", contractAddressFormat ? "✅" : "❌")
  console.log("[Soroban Test] Contract Instance:", contractInstance ? "✅" : "❌")
  console.log("[Soroban Test] All Tests Passed:", allPassed ? "✅" : "❌")
  
  return {
    rpcConnection,
    contractAddressFormat,
    contractInstance,
    allPassed
  }
}

