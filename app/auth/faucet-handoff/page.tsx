"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { loadClientWalletSession } from "@/lib/client-wallet-session"
import {
  clearFaucetHandoffReturn,
  peekFaucetHandoffReturn,
  stashFaucetHandoffReturn,
} from "@/lib/sozu-faucet/handoff-return-storage"
import { parseAllowlistedFaucetReturnUrl } from "@/lib/sozu-faucet/return-allowlist"
import { getStoredSmartAccountAddress } from "@/lib/wallet/deposit-receive-address"
import { signalBootstrapReady } from "@/lib/app-ready"

type HandoffError =
  | "invalid_return"
  | "setup_incomplete"
  | "misconfigured"
  | "handoff_failed"
  | "unauthorized"
  | "timeout"

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
    case "timeout":
      return {
        title: "Taking too long",
        body: "Could not finish returning to the faucet. Sign in again, or go back and retry Login with Sozu.",
      }
    default:
      return {
        title: "Could not complete login",
        body: "Something went wrong returning to the faucet. Try again in a moment.",
      }
  }
}

function resolveRawReturn(searchParams: URLSearchParams): string | null {
  const fromQuery = searchParams.get("return")?.trim()
  if (fromQuery && parseAllowlistedFaucetReturnUrl(fromQuery)) {
    return fromQuery
  }
  // One decode pass if nested encoding left %3A form in the query value
  if (fromQuery?.includes("%")) {
    try {
      const decoded = decodeURIComponent(fromQuery)
      if (parseAllowlistedFaucetReturnUrl(decoded)) return decoded
    } catch {
      /* ignore */
    }
  }
  const stashed = peekFaucetHandoffReturn()
  if (stashed && parseAllowlistedFaucetReturnUrl(stashed)) return stashed
  return null
}

function authBounceUrl(rawReturn: string): string {
  const handoffPath = `/auth/faucet-handoff?return=${encodeURIComponent(rawReturn)}`
  return `/auth?faucet=1&return=${encodeURIComponent(handoffPath)}`
}

function FaucetHandoffContent() {
  const searchParams = useSearchParams()
  const startedRef = useRef(false)
  const [error, setError] = useState<HandoffError | null>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const timeoutId = window.setTimeout(() => {
      setError((prev) => prev ?? "timeout")
      requestAnimationFrame(() => {
        requestAnimationFrame(() => signalBootstrapReady())
      })
    }, 20_000)

    void (async () => {
      const rawReturn = resolveRawReturn(searchParams)
      if (!rawReturn) {
        window.clearTimeout(timeoutId)
        setError("invalid_return")
        requestAnimationFrame(() => {
          requestAnimationFrame(() => signalBootstrapReady())
        })
        return
      }

      stashFaucetHandoffReturn(rawReturn)

      const session = await loadClientWalletSession()
      if (!session.isAuthenticated || !session.userId) {
        // Hard navigate — client soft-nav can leave users stuck on "Returning to faucet…"
        window.location.replace(authBounceUrl(rawReturn))
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
          credentials: "same-origin",
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
          window.location.replace(authBounceUrl(rawReturn))
          return
        }

        window.clearTimeout(timeoutId)

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

        clearFaucetHandoffReturn()
        window.location.replace(data.redirectUrl)
      } catch {
        window.clearTimeout(timeoutId)
        setError("handoff_failed")
        requestAnimationFrame(() => {
          requestAnimationFrame(() => signalBootstrapReady())
        })
      }
    })()

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchParams])

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
  const rawReturn = resolveRawReturn(searchParams)

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
        {error === "unauthorized" ||
        error === "handoff_failed" ||
        error === "timeout" ? (
          <a
            href={rawReturn ? authBounceUrl(rawReturn) : "/auth"}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
          >
            Sign in
          </a>
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
