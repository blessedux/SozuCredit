/**
 * MaxFlow API Configuration
 * 
 * MaxFlow provides ego scoring based on network flow analysis.
 * This is a reputation/trust system based on address relationships.
 * API Reference: https://maxflow.one/api-docs
 */

export const MAXFLOW_CONFIG = {
  apiUrl: process.env.MAXFLOW_API_URL || "https://maxflow.one",
  timeout: 30000, // 30 seconds
} as const

export interface MaxFlowApiError {
  message: string
  code?: string
  status?: number
}

/**
 * MaxFlow Ego Score Response
 * Based on network flow analysis of address relationships
 */
export interface MaxFlowEgoScore {
  ownerAddress: string
  localHealth: number
  seedAddresses: string[]
  metrics: {
    totalNodes: number
    acceptedUsers: number
    avgResidualFlow: number
    medianMinCut: number
    maxPossibleFlow: number
  }
  nodeDetails: Array<{
    address: string
    flow?: number
    [key: string]: any
  }>
}

