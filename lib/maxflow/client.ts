/**
 * MaxFlow API Client
 * 
 * Handles API interactions with MaxFlow for ego scoring based on network flow.
 * API Reference: https://maxflow.one/api-docs
 * 
 * MaxFlow uses address-based ego scoring to determine trust/reputation
 * based on network flow analysis of relationships between addresses.
 */

import { MAXFLOW_CONFIG, type MaxFlowApiError, type MaxFlowEgoScore } from "./config"

export class MaxFlowClient {
  private apiUrl: string
  private timeout: number

  constructor() {
    this.apiUrl = MAXFLOW_CONFIG.apiUrl
    this.timeout = MAXFLOW_CONFIG.timeout
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error: MaxFlowApiError = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        }))
        throw error
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        throw { message: "Request timeout", code: "TIMEOUT" } as MaxFlowApiError
      }
      throw error
    }
  }

  /**
   * Get ego score for an address
   * 
   * @param address - Ethereum address (0x format)
   * @returns Ego score with network flow metrics
   * 
   * @example
   * ```typescript
   * const score = await maxflowClient.getEgoScore("0x216844eF94D95279c6d1631875F2dd93FbBdfB61")
   * ```
   */
  async getEgoScore(address: string): Promise<MaxFlowEgoScore> {
    if (!address || !address.startsWith("0x")) {
      throw { message: "Invalid address format. Must be a valid Ethereum address (0x...)", code: "INVALID_ADDRESS" } as MaxFlowApiError
    }

    return this.request<MaxFlowEgoScore>(`/api/ego/${address}/score`)
  }

  /**
   * Get multiple ego scores in parallel
   * 
   * @param addresses - Array of Ethereum addresses
   * @returns Map of address to ego score
   */
  async getEgoScores(addresses: string[]): Promise<Map<string, MaxFlowEgoScore>> {
    const scores = await Promise.all(
      addresses.map(async (address) => {
        try {
          const score = await this.getEgoScore(address)
          return { address, score }
        } catch (error) {
          console.error(`[MaxFlow] Error fetching score for ${address}:`, error)
          return { address, score: null }
        }
      })
    )

    const scoreMap = new Map<string, MaxFlowEgoScore>()
    scores.forEach(({ address, score }) => {
      if (score) {
        scoreMap.set(address, score)
      }
    })

    return scoreMap
  }

  /**
   * Get trust score (simplified metric from ego score)
   * 
   * @param address - Ethereum address
   * @returns Trust score number (based on localHealth and metrics)
   */
  async getTrustScore(address: string): Promise<number> {
    const egoScore = await this.getEgoScore(address)
    
    // Calculate trust score based on ego metrics
    // You can adjust this formula based on your needs
    const trustScore = 
      egoScore.localHealth * 0.4 +
      egoScore.metrics.avgResidualFlow * 0.3 +
      egoScore.metrics.medianMinCut * 0.2 +
      (egoScore.metrics.acceptedUsers / Math.max(egoScore.metrics.totalNodes, 1)) * 0.1

    return Math.max(0, trustScore)
  }

  /**
   * Check if an address has sufficient trust for vouching
   * 
   * @param address - Ethereum address
   * @param minTrustScore - Minimum trust score required
   * @returns Object with canVouch boolean and trust score
   */
  async canVouch(address: string, minTrustScore: number = 1.0): Promise<{
    canVouch: boolean
    trustScore: number
    egoScore: MaxFlowEgoScore
  }> {
    const egoScore = await this.getEgoScore(address)
    const trustScore = await this.getTrustScore(address)

    return {
      canVouch: trustScore >= minTrustScore,
      trustScore,
      egoScore,
    }
  }
}

// Export singleton instance
export const maxflowClient = new MaxFlowClient()

