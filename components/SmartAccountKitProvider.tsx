"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { SmartAccountKit, ConnectWalletResult, CreateWalletResult } from "smart-account-kit"
import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client"
import { linkMemberWalletWithLoginPasskey } from "@/lib/stellar/smartAccounts/linkMemberWallet"

type SmartAccountContextValue = {
  ready: boolean
  kit: SmartAccountKit | null
  connected: boolean
  contractId: string | null
  credentialId: string | null
  error: string | null
  connect: (opts?: {
    prompt?: boolean
    credentialId?: string
    contractId?: string
  }) => Promise<{
    contractId: string | null
    credentialId: string | null
    publicKey: Uint8Array | null
  }>
  createWallet: (userLabel: string, userName: string) => Promise<CreateWalletResult>
  linkMemberWallet: (loginCredentialId?: string) => Promise<{
    contractId: string
    credentialId: string
    publicKey: Uint8Array
  }>
  disconnect: () => Promise<void>
}

const Ctx = createContext<SmartAccountContextValue | null>(null)

export function SmartAccountKitProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [kit, setKit] = useState<SmartAccountKit | null>(null)
  const [connected, setConnected] = useState(false)
  const [contractId, setContractId] = useState<string | null>(null)
  const [credentialId, setCredentialId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { kit: k } = await getSmartAccountKit()
        if (cancelled) return
        setKit(k)
        const res = (await k.connectWallet()) as ConnectWalletResult | null
        if (res?.contractId) {
          setConnected(true)
          setContractId(res.contractId)
          setCredentialId(res.credentialId ?? null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Smart account init failed")
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const connect = useCallback(
    async (opts?: { prompt?: boolean; credentialId?: string; contractId?: string }) => {
      if (!kit) throw new Error("Smart account kit not ready")
      setError(null)
      const res = (await kit.connectWallet(opts)) as ConnectWalletResult | null
      if (res?.contractId) {
        setConnected(true)
        setContractId(res.contractId)
        setCredentialId(res.credentialId ?? null)
        return {
          contractId: res.contractId,
          credentialId: res.credentialId ?? null,
          publicKey: res.credential?.publicKey ?? null,
        }
      }
      setConnected(false)
      setContractId(null)
      setCredentialId(null)
      return { contractId: null, credentialId: null, publicKey: null }
    },
    [kit]
  )

  const createWallet = useCallback(
    async (userLabel: string, userName: string) => {
      if (!kit) throw new Error("Smart account kit not ready")
      const res = await kit.createWallet(userLabel, userName, { autoSubmit: true })
      setConnected(true)
      setContractId(res.contractId)
      setCredentialId(res.credentialId ?? null)
      return res
    },
    [kit]
  )

  const linkMemberWallet = useCallback(
    async (loginCredentialId?: string) => {
      if (!kit) throw new Error("Smart account kit not ready")
      return linkMemberWalletWithLoginPasskey({ kit, connect, loginCredentialId })
    },
    [kit, connect]
  )

  const disconnect = useCallback(async () => {
    if (!kit) return
    await kit.disconnect()
    setConnected(false)
    setContractId(null)
    setCredentialId(null)
  }, [kit])

  const value = useMemo(
    () => ({
      ready,
      kit,
      connected,
      contractId,
      credentialId,
      error,
      connect,
      createWallet,
      linkMemberWallet,
      disconnect,
    }),
    [
      ready,
      kit,
      connected,
      contractId,
      credentialId,
      error,
      connect,
      createWallet,
      linkMemberWallet,
      disconnect,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSmartAccountKitContext(): SmartAccountContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error("useSmartAccountKitContext must be used within SmartAccountKitProvider")
  return v
}
