"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { loadClientWalletSession } from "@/lib/client-wallet-session"
import { parseAllowlistedFaucetReturnUrl } from "@/lib/sozu-faucet/return-allowlist"
import { getStoredSmartAccountAddress } from "@/lib/wallet/deposit-receive-address"
import { signalBootstrapReady } from "@/lib/app-ready"

type HandoffError =
  | "invalid_return"
  | "setup_incomplete"
  | "misconfigured"
  | "handoff_failed"
  | "unauthorized"

function errorCopy(reason: HandoffError): { title: string; body: string } {
  switch (reason) {
    case "invalid_return":
      return {
        title: "Invalid return URL",
        body: "This login link is not from an allowed Sozu Faucet origin.",
      }
    case "setup_incomplete":
      return {
        title: "Setup Incomplete",
        body: "Finish setting up your smart account (C…) in the wallet, then try Login with Sozu again.",
      }
    case "misconfigured":
      return {
        title: "Faucet login unavailable",
        body: "Faucet auth is not configured on this deployment. Ask the team to set FAUCET_AUTH_SECRET.",
      }
    case "unauthorized":
      return {
        title: "Sign in required",
        body: "Your session expired. Sign in with your passkey, then try again.",
      }
    default:
      return {
        title: "Could not complete login",
        body: "Something went wrong returning to the faucet. Try again in a moment.",
      }
  }
}

function FaucetHandoffContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startedRef = useRef(false)
  const [error, setError] = useState<HandoffError | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      const rawReturn = searchParams.get("return")
      const returnUrl = parseAllowlistedFaucetReturnUrl(rawReturn)
      if (!returnUrl || !rawReturn) {
        setError("invalid_return")
        requestAnimationFrame(() => {
          requestAnimationFrame(() => signalBootstrapReady())
        })
        return
      }

      const session = await loadClientWalletSession()
      if (!session.isAuthenticated || !session.userId) {
        const handoffPath = `/auth/faucet-handoff?return=${encodeURIComponent(rawReturn)}`
        router.replace(
          `/auth?faucet=1&return=${encodeURIComponent(handoffPath)}`,
        )
        return
      }

      try {
        const clientC = getStoredSmartAccountAddress()
        const res = await fetch("/api/wallet/sozu-faucet/handoff", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": session.userId,
          },
          body: JSON.stringify({
            return: rawReturn,
            ...(clientC ? { to: clientC } : {}),
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean
          redirectUrl?: string
          reason?: string
        }

        if (res.status === 401) {
          const handoffPath = `/auth/faucet-handoff?return=${encodeURIComponent(rawReturn)}`
          router.replace(
            `/auth?faucet=1&return=${encodeURIComponent(handoffPath)}`,
          )
          return
        }

        if (!res.ok || !data.success || !data.redirectUrl) {
          if (data.reason === "setup_incomplete") setError("setup_incomplete")
          else if (data.reason === "misconfigured") setError("misconfigured")
          else if (data.reason === "invalid_return") setError("invalid_return")
          else setError("handoff_failed")
          requestAnimationFrame(() => {
            requestAnimationFrame(() => signalBootstrapReady())
          })
          return
        }

        window.location.replace(data.redirectUrl)
      } catch {
        setError("handoff_failed")
        requestAnimationFrame(() => {
          requestAnimationFrame(() => signalBootstrapReady())
        })
      }
    })()
  }, [router, searchParams])

  if (!error) {
    return (
      <div className="flex min-h-[var(--sozu-app-height,100lvh)] flex-col items-center justify-center bg-black px-6 text-white">
        <p className="text-[10px] font-extralight tracking-[0.12em] text-white/70">
          SOZU
        </p>
        <p className="mt-6 text-sm text-white/55">Returning to faucet…</p>
      </div>
    )
  }

  const copy = errorCopy(error)

  return (
    <div className="flex min-h-[var(--sozu-app-height,100lvh)] flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-[10px] font-extralight tracking-[0.12em] text-white/70">
        SOZU
      </p>
      <h1 className="mt-8 text-lg font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-3 max-w-sm text-sm text-white/55">{copy.body}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        {error === "setup_incomplete" ? (
          <Link
            href="/home"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
          >
            Open wallet
          </Link>
        ) : null}
        {error === "unauthorized" || error === "handoff_failed" ? (
          <Link
            href={`/auth?faucet=1&return=${encodeURIComponent(
              `/auth/faucet-handoff?return=${encodeURIComponent(searchParams.get("return") ?? "")}`,
            )}`}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
          >
            Sign in
          </Link>
        ) : null}
        <a
          href="https://faucet.sozu.capital/"
          className="text-xs text-white/40 underline-offset-4 hover:text-white/60 hover:underline"
        >
          Back to faucet
        </a>
      </div>
    </div>
  )
}

export default function FaucetHandoffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[var(--sozu-app-height,100lvh)] items-center justify-center bg-black text-sm text-white/55">
          Returning to faucet…
        </div>
      }
    >
      <FaucetHandoffContent />
    </Suspense>
  )
}
