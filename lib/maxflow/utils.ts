/**
 * MaxFlow Integration Utilities
 * 
 * Helper functions for integrating MaxFlow ego scores with the existing Supabase system
 */

import { maxflowClient } from "./client"
import type { MaxFlowEgoScore } from "./config"

/**
 * Get user's wallet address from Supabase profile
 * This is a helper to get the Ethereum address for MaxFlow ego scoring
 */
export async function getUserWalletAddress(userId: string): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("evm_address")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[MaxFlow Utils] Error fetching profile:", error)
      return null
    }

    return profile?.evm_address || null
  } catch (error) {
    console.error("[MaxFlow Utils] Error getting wallet address:", error)
    return null
  }
}

/**
 * Get ego score for a user by their wallet address
 * 
 * @param walletAddress - Ethereum address (0x format)
 * @returns Ego score or null if address is invalid
 */
export async function getUserEgoScore(walletAddress: string | null): Promise<MaxFlowEgoScore | null> {
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    return null
  }

  try {
    return await maxflowClient.getEgoScore(walletAddress)
  } catch (error) {
    console.error("[MaxFlow Utils] Error getting ego score:", error)
    return null
  }
}

/**
 * Check if a user can vouch based on their MaxFlow ego score
 * 
 * @param walletAddress - Ethereum address
 * @param minTrustScore - Minimum trust score required (default: 1.0)
 * @returns Object with vouching eligibility
 */
export async function canUserVouchByEgoScore(
  walletAddress: string | null,
  minTrustScore: number = 1.0
): Promise<{
  canVouch: boolean
  trustScore: number
  reason?: string
  egoScore?: MaxFlowEgoScore
}> {
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    return {
      canVouch: false,
      trustScore: 0,
      reason: "Invalid or missing wallet address",
    }
  }

  try {
    const result = await maxflowClient.canVouch(walletAddress, minTrustScore)
    return {
      canVouch: result.canVouch,
      trustScore: result.trustScore,
      reason: result.canVouch ? undefined : `Trust score ${result.trustScore} is below minimum ${minTrustScore}`,
      egoScore: result.egoScore,
    }
  } catch (error) {
    console.error("[MaxFlow Utils] Error checking vouching eligibility:", error)
    return {
      canVouch: false,
      trustScore: 0,
      reason: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Calculate voting power based on MaxFlow ego score
 * 
 * @param walletAddress - Ethereum address
 * @returns Voting power (0-100 scale based on trust score)
 */
export async function calculateVotingPowerFromEgoScore(
  walletAddress: string | null
): Promise<number> {
  if (!walletAddress || !walletAddress.startsWith("0x")) {
    return 0
  }

  try {
    const trustScore = await maxflowClient.getTrustScore(walletAddress)
    // Scale trust score to voting power (0-100)
    // You can adjust this formula based on your needs
    const votingPower = Math.min(100, Math.max(0, trustScore * 10))
    return Math.round(votingPower)
  } catch (error) {
    console.error("[MaxFlow Utils] Error calculating voting power:", error)
    return 0
  }
}

/**
 * Get multiple ego scores for batch operations
 * Useful for displaying trust scores for multiple users
 * 
 * @param walletAddresses - Array of Ethereum addresses
 * @returns Map of address to ego score
 */
export async function getBatchEgoScores(
  walletAddresses: string[]
): Promise<Map<string, MaxFlowEgoScore>> {
  // Filter out invalid addresses
  const validAddresses = walletAddresses.filter(
    (addr) => addr && addr.startsWith("0x")
  )

  if (validAddresses.length === 0) {
    return new Map()
  }

  try {
    return await maxflowClient.getEgoScores(validAddresses)
  } catch (error) {
    console.error("[MaxFlow Utils] Error getting batch ego scores:", error)
    return new Map()
  }
}

