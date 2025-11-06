/**
 * DeFindex Position Management
 * Handles database operations for strategy positions and transactions
 */

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export interface DefindexPosition {
  id: string
  userId: string
  strategyAddress: string
  shares: number
  totalDeposited: number
  totalWithdrawn: number
  lastDepositAt: string | null
  lastWithdrawalAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DefindexTransaction {
  id: string
  userId: string
  positionId: string | null
  transactionHash: string
  transactionType: "deposit" | "withdraw" | "harvest"
  amount: number
  shares: number | null
  strategyAddress: string
  status: "pending" | "confirmed" | "failed"
  createdAt: string
  confirmedAt: string | null
  errorMessage: string | null
}

/**
 * Get or create position for a user and strategy
 */
export async function getOrCreatePosition(
  userId: string,
  strategyAddress: string,
  useServiceClient = false
): Promise<DefindexPosition | null> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }

  // Try to get existing position
  const { data: existingPosition, error: selectError } = await supabase
    .from("defindex_positions")
    .select("*")
    .eq("user_id", userId)
    .eq("strategy_address", strategyAddress)
    .maybeSingle()

  if (selectError && selectError.code !== "PGRST116") { // PGRST116 = no rows returned
    console.error("[Defindex Positions] Error getting position:", selectError)
    throw new Error(`Failed to get position: ${selectError.message}`)
  }

  if (existingPosition) {
    return {
      id: existingPosition.id,
      userId: existingPosition.user_id,
      strategyAddress: existingPosition.strategy_address,
      shares: Number(existingPosition.shares),
      totalDeposited: Number(existingPosition.total_deposited),
      totalWithdrawn: Number(existingPosition.total_withdrawn),
      lastDepositAt: existingPosition.last_deposit_at,
      lastWithdrawalAt: existingPosition.last_withdrawal_at,
      createdAt: existingPosition.created_at,
      updatedAt: existingPosition.updated_at,
    }
  }

  // Create new position if it doesn't exist
  const { data: newPosition, error: insertError } = await supabase
    .from("defindex_positions")
    .insert({
      user_id: userId,
      strategy_address: strategyAddress,
      shares: 0,
      total_deposited: 0,
      total_withdrawn: 0,
    })
    .select()
    .single()

  if (insertError) {
    console.error("[Defindex Positions] Error creating position:", insertError)
    throw new Error(`Failed to create position: ${insertError.message}`)
  }

  return {
    id: newPosition.id,
    userId: newPosition.user_id,
    strategyAddress: newPosition.strategy_address,
    shares: Number(newPosition.shares),
    totalDeposited: Number(newPosition.total_deposited),
    totalWithdrawn: Number(newPosition.total_withdrawn),
    lastDepositAt: newPosition.last_deposit_at,
    lastWithdrawalAt: newPosition.last_withdrawal_at,
    createdAt: newPosition.created_at,
    updatedAt: newPosition.updated_at,
  }
}

/**
 * Update position after deposit
 */
export async function updatePositionOnDeposit(
  userId: string,
  strategyAddress: string,
  amount: number,
  shares: number,
  useServiceClient = false
): Promise<string | null> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  }

  try {
    // Use database function to update position
    const { data, error } = await supabase.rpc("update_position_on_deposit", {
      p_user_id: userId,
      p_strategy_address: strategyAddress,
      p_amount: amount,
      p_shares: shares,
    })

    if (error) {
      console.error("[Defindex Positions] Error updating position on deposit:", error)
      // Fallback to manual update if function doesn't exist
      return await updatePositionManually(userId, strategyAddress, amount, shares, "deposit", supabase)
    }

    // Get the position ID
    const { data: position } = await supabase
      .from("defindex_positions")
      .select("id")
      .eq("user_id", userId)
      .eq("strategy_address", strategyAddress)
      .single()

    return position?.id || null
  } catch (error) {
    console.error("[Defindex Positions] Error in updatePositionOnDeposit:", error)
    // Fallback to manual update
    return await updatePositionManually(userId, strategyAddress, amount, shares, "deposit", supabase)
  }
}

/**
 * Manual position update (fallback if function doesn't exist)
 */
async function updatePositionManually(
  userId: string,
  strategyAddress: string,
  amount: number,
  shares: number,
  type: "deposit" | "withdraw",
  supabase: any
): Promise<string | null> {
  const { data: position, error } = await supabase
    .from("defindex_positions")
    .upsert({
      user_id: userId,
      strategy_address: strategyAddress,
      shares: type === "deposit" ? shares : -shares,
      total_deposited: type === "deposit" ? amount : 0,
      total_withdrawn: type === "withdraw" ? amount : 0,
      last_deposit_at: type === "deposit" ? new Date().toISOString() : null,
      last_withdrawal_at: type === "withdraw" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,strategy_address",
    })
    .select()
    .single()

  if (error) {
    console.error("[Defindex Positions] Error in manual update:", error)
    return null
  }

  // If updating existing position, increment values
  if (position) {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (type === "deposit") {
      updateData.shares = (Number(position.shares) || 0) + shares
      updateData.total_deposited = (Number(position.total_deposited) || 0) + amount
      updateData.last_deposit_at = new Date().toISOString()
    } else {
      updateData.shares = Math.max(0, (Number(position.shares) || 0) - shares)
      updateData.total_withdrawn = (Number(position.total_withdrawn) || 0) + amount
      updateData.last_withdrawal_at = new Date().toISOString()
    }

    await supabase
      .from("defindex_positions")
      .update(updateData)
      .eq("id", position.id)
  }

  return position?.id || null
}

/**
 * Save transaction record
 */
export async function saveTransaction(
  userId: string,
  transactionHash: string,
  transactionType: "deposit" | "withdraw" | "harvest",
  amount: number,
  strategyAddress: string,
  options: {
    positionId?: string | null
    shares?: number | null
    status?: "pending" | "confirmed" | "failed"
    errorMessage?: string | null
  } = {},
  useServiceClient = false
): Promise<DefindexTransaction> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  }

  const { data: transaction, error } = await supabase
    .from("defindex_transactions")
    .insert({
      user_id: userId,
      position_id: options.positionId || null,
      transaction_hash: transactionHash,
      transaction_type: transactionType,
      amount: amount,
      shares: options.shares || null,
      strategy_address: strategyAddress,
      status: options.status || "pending",
      confirmed_at: options.status === "confirmed" ? new Date().toISOString() : null,
      error_message: options.errorMessage || null,
    })
    .select()
    .single()

  if (error) {
    console.error("[Defindex Positions] Error saving transaction:", error)
    throw new Error(`Failed to save transaction: ${error.message}`)
  }

  return {
    id: transaction.id,
    userId: transaction.user_id,
    positionId: transaction.position_id,
    transactionHash: transaction.transaction_hash,
    transactionType: transaction.transaction_type,
    amount: Number(transaction.amount),
    shares: transaction.shares ? Number(transaction.shares) : null,
    strategyAddress: transaction.strategy_address,
    status: transaction.status,
    createdAt: transaction.created_at,
    confirmedAt: transaction.confirmed_at,
    errorMessage: transaction.error_message,
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  transactionHash: string,
  status: "pending" | "confirmed" | "failed",
  errorMessage?: string | null,
  useServiceClient = false
): Promise<void> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === "confirmed") {
    updateData.confirmed_at = new Date().toISOString()
  }

  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  const { error } = await supabase
    .from("defindex_transactions")
    .update(updateData)
    .eq("transaction_hash", transactionHash)

  if (error) {
    console.error("[Defindex Positions] Error updating transaction status:", error)
    throw new Error(`Failed to update transaction status: ${error.message}`)
  }
}

/**
 * Get user's position for a strategy
 */
export async function getUserPosition(
  userId: string,
  strategyAddress: string,
  useServiceClient = false
): Promise<DefindexPosition | null> {
  const position = await getOrCreatePosition(userId, strategyAddress, useServiceClient)
  return position
}

/**
 * Get user's transactions
 */
export async function getUserTransactions(
  userId: string,
  options: {
    strategyAddress?: string
    transactionType?: "deposit" | "withdraw" | "harvest"
    status?: "pending" | "confirmed" | "failed"
    limit?: number
  } = {},
  useServiceClient = false
): Promise<DefindexTransaction[]> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  }

  let query = supabase
    .from("defindex_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (options.strategyAddress) {
    query = query.eq("strategy_address", options.strategyAddress)
  }

  if (options.transactionType) {
    query = query.eq("transaction_type", options.transactionType)
  }

  if (options.status) {
    query = query.eq("status", options.status)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data: transactions, error } = await query

  if (error) {
    console.error("[Defindex Positions] Error getting transactions:", error)
    throw new Error(`Failed to get transactions: ${error.message}`)
  }

  return (transactions || []).map((t: any) => ({
    id: t.id,
    userId: t.user_id,
    positionId: t.position_id,
    transactionHash: t.transaction_hash,
    transactionType: t.transaction_type,
    amount: Number(t.amount),
    shares: t.shares ? Number(t.shares) : null,
    strategyAddress: t.strategy_address,
    status: t.status,
    createdAt: t.created_at,
    confirmedAt: t.confirmed_at,
    errorMessage: t.error_message,
  }))
}

