/**
 * Custom hook for send payment functionality
 * Handles recipient resolution, payment submission, and transaction signing
 */

import { useState, useCallback } from "react"
import { getUserId } from "@/lib/wallet-utils"

export function useSendPayment(
  walletAddress: string,
  walletNetwork: "testnet" | "mainnet",
  defindexBalance: { walletBalance: number; strategyBalance: number; totalBalance: number } | null,
  onSuccess?: (transactionHash: string) => void,
  onRefresh?: () => void
) {
  const [sendRecipient, setSendRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendStep, setSendStep] = useState<"recipient" | "amount">("recipient")
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState<string | null>(null)
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [sendMemo, setSendMemo] = useState("")
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [isVibrating, setIsVibrating] = useState(false)

  // Reset send payment state
  const resetSendPayment = useCallback(() => {
    setSendStep("recipient")
    setSendRecipient("")
    setSendAmount("")
    setResolvedRecipientAddress(null)
    setIsManualMode(false)
    setSendMemo("")
    setRecipientError(null)
    setIsVibrating(false)
  }, [])

  // Resolve recipient (Sozu tag or Stellar address)
  const handleResolveRecipient = useCallback(async () => {
    if (!sendRecipient.trim()) {
      return
    }

    setRecipientError(null)
    setIsResolvingRecipient(true)
    try {
      const userId = getUserId()
      if (!userId) {
        throw new Error("User not authenticated")
      }

      // If in manual mode and recipient is already a Stellar address, use it directly
      if (isManualMode) {
        const isStellarAddress = /^G[A-Z0-9]{55}$/.test(sendRecipient.trim())
        if (isStellarAddress) {
          console.log("[Resolve Recipient] ✅ Manual mode: Using Stellar address directly")
          setResolvedRecipientAddress(sendRecipient.trim())
          setSendStep("amount")
          return
        } else {
          throw new Error("Invalid Stellar wallet address format")
        }
      }

      // Resolve recipient (Sozu tag or wallet address)
      const resolveResponse = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ recipient: sendRecipient.trim() }),
      })

      if (!resolveResponse.ok) {
        const error = await resolveResponse.json()
        if (error.error && (error.error.includes("not found") || error.error.includes("Recipient not found"))) {
          setRecipientError("Sozu tag not found")
          setIsVibrating(true)
          setTimeout(() => setIsVibrating(false), 500)
          return
        }
        throw new Error(error.error || "Failed to resolve recipient")
      }

      const { walletAddress: recipientAddress } = await resolveResponse.json()
      if (!recipientAddress) {
        setRecipientError("Sozu tag not found")
        setIsVibrating(true)
        setTimeout(() => setIsVibrating(false), 500)
        return
      }

      console.log("[Resolve Recipient] ✅ Recipient resolved:", recipientAddress.substring(0, 10) + "...")
      setResolvedRecipientAddress(recipientAddress)
      setSendStep("amount")
      setRecipientError(null)
    } catch (error: any) {
      console.error("[Resolve Recipient] Error:", error)
      if (!recipientError) {
        setRecipientError("Sozu tag not found")
        setIsVibrating(true)
        setTimeout(() => setIsVibrating(false), 500)
      }
    } finally {
      setIsResolvingRecipient(false)
    }
  }, [sendRecipient, isManualMode, recipientError])

  // Send payment
  const handleSendPayment = useCallback(async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0 || !resolvedRecipientAddress) {
      return
    }

    const amount = parseFloat(sendAmount)
    if (!walletAddress) {
      alert("Wallet address not found. Please create a wallet first.")
      return
    }

    // Check balance before proceeding
    const userId = getUserId()
    if (!userId) {
      alert("User not authenticated. Please log in again.")
      return
    }
    
    console.log("[Send Payment] Fetching real-time USDC balance for verification...")
    let currentBalance = defindexBalance?.walletBalance || 0
    
    // Fetch real-time balance from Stellar network
    if (walletAddress) {
      try {
        const balanceResponse = await fetch(`/api/wallet/stellar/balance?publicKey=${walletAddress}`, {
          headers: {
            "x-user-id": userId,
          },
        })
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json()
          if (balanceData.usdcBalance !== undefined) {
            currentBalance = balanceData.usdcBalance
            console.log("[Send Payment] ✅ Real-time USDC balance:", currentBalance)
          }
        }
      } catch (balanceError) {
        console.warn("[Send Payment] Could not fetch real-time balance, using cached:", balanceError)
      }
    }
    
    const bufferAmount = 0.01
    const requiredBalance = amount + bufferAmount

    if (currentBalance < requiredBalance) {
      const shortfall = requiredBalance - currentBalance
      const strategyBalance = defindexBalance?.strategyBalance || 0
      
      let errorMessage = `Insufficient balance. You need ${requiredBalance.toFixed(2)} USDC (including ${bufferAmount.toFixed(2)} USDC buffer) but only have ${currentBalance.toFixed(2)} USDC available in your wallet.`
      
      if (strategyBalance > 0) {
        errorMessage += `\n\nYou have ${strategyBalance.toFixed(2)} USDC locked in DeFindex strategy. You need to withdraw from DeFindex first to make it available for sending.`
      }
      
      alert(errorMessage)
      setIsSending(false)
      return
    }

    setIsSending(true)
    try {
      // Step 1: Get unsigned transaction from server
      console.log("[Send Payment] Building transaction")
      
      const buildResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          destination: resolvedRecipientAddress,
          amount: amount.toString(),
          sender: walletAddress,
          memo: sendMemo.trim() || undefined,
        }),
      })

      if (!buildResponse.ok) {
        const error = await buildResponse.json()
        throw new Error(error.error || "Failed to build payment transaction")
      }

      const { unsignedXdr } = await buildResponse.json()
      if (!unsignedXdr) {
        throw new Error("No unsigned transaction returned")
      }

      // Step 2: Sign transaction with biometric
      const stellarSdk = await import("@stellar/stellar-sdk")
      const { getStellarConfig } = await import("@/lib/turnkey/config")
      const stellarConfig = getStellarConfig()
      const networkPassphrase = stellarConfig.network === "mainnet" ? stellarSdk.Networks.PUBLIC : stellarSdk.Networks.TESTNET
      const transactionXdr = stellarSdk.TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase)
      if (transactionXdr instanceof stellarSdk.FeeBumpTransaction) {
        throw new Error("Fee bump transactions are not supported")
      }
      const transaction = transactionXdr

      // Verify transaction source matches our wallet address
      if (transaction.source !== walletAddress) {
        console.error("[Send Payment] ❌ Transaction source doesn't match wallet address!")
        throw new Error(`Transaction source mismatch. Expected: ${walletAddress?.substring(0, 10)}..., Got: ${transaction.source.substring(0, 10)}...`)
      }

      // Get credential ID and sign with passkey approval
      const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
      const { signTransactionWithPasskeyApproval } = await import("@/lib/stellar/client-signing")
      
      const credentialId = await getCurrentCredentialId()
      if (!credentialId) {
        throw new Error("Credential ID not found. Please log in again.")
      }

      console.log("[Send Payment] Signing transaction with passkey approval")
      
      let signedResult
      try {
        signedResult = await signTransactionWithPasskeyApproval(transaction, credentialId, walletAddress, userId)
      } catch (signError: any) {
        console.error("[Send Payment] ❌ Transaction signing failed:", signError)
        if (signError.message?.includes("not found") || signError.message?.includes("Keypair not found")) {
          throw new Error("Unable to sign transaction. Please ensure you're logged in and have created a wallet.")
        } else if (signError.message?.includes("cancelled") || signError.message?.includes("Cancelled") || signError.name === "NotAllowedError" || signError.name === "AbortError") {
          throw new Error("Transaction cancelled. You must approve the transaction with your passkey to send payment.")
        } else if (signError.message?.includes("verification failed") || signError.message?.includes("Challenge")) {
          throw new Error("Passkey verification failed. Please try again.")
        } else {
          throw new Error(`Transaction signing failed: ${signError.message || "Please try again."}`)
        }
      }
      
      if (!signedResult || !signedResult.transaction) {
        throw new Error("Transaction signing failed - no signed transaction returned. Please try again.")
      }
      
      if (signedResult.transaction.signatures.length === 0) {
        throw new Error("Transaction signing failed - no signatures found. Please try again.")
      }
      
      console.log("[Send Payment] ✅ Transaction signed successfully")
      const signedXdr = signedResult.transaction.toXDR()

      // Step 3: Submit signed transaction
      const submitResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          signedTransactionXdr: signedXdr,
        }),
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json()
        const errorMessage = error.error || "Failed to submit payment"
        console.error("[Send Payment] Error response:", error)
        throw new Error(errorMessage)
      }

      const result = await submitResponse.json()
      
      if (result.success === true && result.transactionHash && typeof result.transactionHash === "string" && result.transactionHash.length > 0) {
        console.log("[Send Payment] ✅ Transaction submitted successfully:", result.transactionHash)
        
        // Wait for transaction to be included in ledger
        if (!result.confirmed) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        
        // Refresh balance and transaction history
        if (onRefresh) {
          onRefresh()
          setTimeout(() => onRefresh(), 3000)
        }
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.transactionHash)
        }
        
        // Reset state
        resetSendPayment()
      } else {
        const errorMessage = result.error || "Payment failed. Transaction was not submitted successfully."
        console.error("[Send Payment] ❌ Payment failed:", result)
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error("[Send Payment] Error:", error)
      
      let errorMessage = error.message || "Unknown error"
      if (error.message?.includes("account not found")) {
        errorMessage = "Your wallet account is not active on the Stellar network. Please ensure your account has been funded with at least 1 XLM."
      } else if (error.message?.includes("insufficient")) {
        errorMessage = "Insufficient balance. Please check your USDC balance."
      } else if (error.message?.includes("trustline")) {
        errorMessage = "USDC trustline not established. Please set up your wallet first."
      } else if (error.message?.includes("Credential ID not found")) {
        errorMessage = "Authentication error. Please log out and log back in."
      }
      
      alert(`❌ ${errorMessage}`)
    } finally {
      setIsSending(false)
    }
  }, [sendAmount, resolvedRecipientAddress, walletAddress, walletNetwork, defindexBalance, sendMemo, onSuccess, onRefresh, resetSendPayment])

  return {
    // State
    sendRecipient,
    sendAmount,
    isSending,
    sendStep,
    resolvedRecipientAddress,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    isVibrating,
    // Actions
    setSendRecipient,
    setSendAmount,
    setSendStep,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
  }
}
