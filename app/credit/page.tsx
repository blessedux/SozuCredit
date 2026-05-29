"use client"

import Link from "next/link"
import { ArrowLeft, CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { MICROCREDIT_PROGRAMS } from "@/lib/credit/programs"
import {
  getCreditProgramDesc,
  getCreditProgramName,
  getCreditStatusLabel,
} from "@/lib/credit/program-labels"
import type { CreditStatus, MicrocreditProgramId } from "@/lib/credit/types"
import { useCredits } from "@/hooks/use-credits"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"
import { cn } from "@/lib/utils"

const mainWidth =
  "mx-auto w-full max-w-lg px-4 sm:px-5 lg:max-w-2xl lg:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(6rem,env(safe-area-inset-bottom))]"

const creditGlassCard =
  "rounded-2xl border border-white/15 bg-black/55 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150"

function statusStyles(status: CreditStatus): string {
  switch (status) {
    case "approved":
    case "active":
      return "border-emerald-500/30 bg-emerald-950/50 text-emerald-300 backdrop-blur-md"
    case "repaid":
      return "border-sky-500/30 bg-sky-950/50 text-sky-300 backdrop-blur-md"
    case "rejected":
      return "border-rose-500/30 bg-rose-950/50 text-rose-300 backdrop-blur-md"
    default:
      return "border-amber-500/30 bg-amber-950/50 text-amber-200 backdrop-blur-md"
  }
}

function formatProgramAmount(amount: number, currency: string): string {
  if (currency === "CLP" || currency === "ARS") {
    return formatFiatAmount(amount, currency)
  }
  return `$${amount.toLocaleString("en-US")} ${currency}`
}

export default function CreditPage() {
  const { t } = useWalletLanguage()
  const { credits, eligibility, loading, applying, applyForProgram } = useCredits()

  const hasCredits = credits.length > 0
  const activeMujeresApplication = credits.some(
    (c) =>
      c.programId === "mujeres2000" &&
      c.status !== "rejected" &&
      c.status !== "repaid",
  )

  const handleApply = async (programId: MicrocreditProgramId) => {
    const result = await applyForProgram(programId)
    if (result.ok) {
      toast.success(t.creditApplySuccess)
      return
    }
    if (result.reason === "already_applied") {
      toast.message(t.creditAlreadyApplied)
    }
  }

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/50 backdrop-blur-xl backdrop-saturate-150">
        <div className={`${mainWidth} flex items-center gap-3 pb-3 pt-4`}>
          <Link
            href="/home"
            className="rounded-full border border-white/15 bg-white/10 p-2 transition-colors hover:bg-white/15"
            aria-label={t.creditBackHome}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{t.creditPageTitle}</h1>
            <p className="truncate text-xs text-white/50">{t.creditPageSubtitle}</p>
          </div>
        </div>
      </header>

      <main className={`${mainWidth} space-y-6 pt-6`}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn(creditGlassCard, "h-24 animate-pulse bg-black/45")} />
            ))}
          </div>
        ) : (
          <>
            {eligibility ? (
              <section className={cn(creditGlassCard, "p-4")}>
                <div className="flex items-start gap-3">
                  {eligibility.eligible ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90">{t.creditEligibilityTitle}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {eligibility.eligible
                        ? t.creditEligibilityEligible
                        : eligibility.reason ??
                          formatWalletText(t.creditEligibilityProgress, {
                            count: eligibility.trustworthyVouchesCount,
                            points: eligibility.totalTrustPoints,
                          })}
                    </p>
                    {!eligibility.eligible ? (
                      <p className="mt-2 text-xs text-white/40">
                        {formatWalletText(t.creditEligibilityProgress, {
                          count: eligibility.trustworthyVouchesCount,
                          points: eligibility.totalTrustPoints,
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/45">
                  {t.creditYourCredits}
                </h2>
              </div>

              {hasCredits ? (
                <div className="space-y-2">
                  {credits.map((credit) => (
                    <article key={credit.id} className={cn(creditGlassCard, "p-4")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white/90">{credit.programName}</p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-white">
                            {formatProgramAmount(credit.amount, credit.currency)}
                          </p>
                          <p className="mt-1 text-[11px] text-white/40">
                            {new Date(credit.appliedAt).toLocaleDateString()}
                            {credit.termDays
                              ? ` · ${formatWalletText(t.creditTermDays, { days: credit.termDays })}`
                              : null}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                            statusStyles(credit.status),
                          )}
                        >
                          {getCreditStatusLabel(credit.status, t)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    creditGlassCard,
                    "border-dashed bg-black/45 px-4 py-8 text-center",
                  )}
                >
                  <Sparkles className="mx-auto mb-3 h-6 w-6 text-white/30" />
                  <p className="text-sm text-white/50">{t.creditNoCredits}</p>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/45">
                  {t.creditApplyTitle}
                </h2>
                <p className="mt-1 text-sm text-white/50">{t.creditApplyDesc}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {MICROCREDIT_PROGRAMS.map((program) => {
                  const isAvailable = program.available
                  const isApplied =
                    program.id === "mujeres2000" ? activeMujeresApplication : false

                  return (
                    <button
                      key={program.id}
                      type="button"
                      disabled={!isAvailable || isApplied || applying}
                      onClick={() => {
                        if (!isAvailable) return
                        void handleApply(program.id)
                      }}
                      className={cn(
                        creditGlassCard,
                        "p-4 text-left transition",
                        isAvailable && !isApplied
                          ? "border-emerald-500/35 bg-black/60 hover:bg-black/70 active:scale-[0.99]"
                          : "cursor-not-allowed border-white/10 bg-black/45 opacity-80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white/90">
                          {getCreditProgramName(program.id, t)}
                        </p>
                        {!isAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50 backdrop-blur-md">
                            <Lock className="h-3 w-3" />
                            {t.creditProgramSoon}
                          </span>
                        ) : isApplied ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300 backdrop-blur-md">
                            {t.creditStatusPending}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xl font-bold tabular-nums text-white">
                        {formatProgramAmount(program.amount, program.currency)}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-white/45">
                        {getCreditProgramDesc(program.id, t)}
                      </p>
                      <p className="mt-3 text-[10px] uppercase tracking-wider text-white/35">
                        {formatWalletText(t.creditTermDays, { days: program.termDays })}
                      </p>
                      {isAvailable && !isApplied ? (
                        <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300">
                          {applying ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              …
                            </>
                          ) : (
                            t.creditApplyButton
                          )}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
