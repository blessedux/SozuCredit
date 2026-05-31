/**
 * Inline treasury / rendimiento panel — shared by balance card expand and modal.
 */

"use client"

import { memo } from "react"
import { TrendingUp, Info, X, Loader2 } from "lucide-react"
import type { DefindexBalance } from "@/hooks/use-wallet-data"
import type { TreasuryProjection, TreasuryPrefs, TreasuryMode } from "@/lib/treasury/types"
import { TREASURY_MODE_CONFIG } from "@/lib/treasury/treasury-modes"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { treasuryMathBreakdown } from "@/lib/treasury/projection-display"
import { getBlendStrategyLink, openBlendStrategyAsset } from "@/lib/defindex/blend-strategy-link"
import { PurchasingPowerPnlChart } from "@/components/wallet/purchasing-power-pnl-chart"
import { useWalletLanguage } from "@/lib/wallet-language"
import {
  formatWalletText,
  getTreasuryModeDescription,
  getTreasuryModeLabel,
} from "@/lib/wallet-texts"
import { useEarnYield } from "@/hooks/use-earn-yield"
import { useYieldPrefs } from "@/hooks/use-yield-prefs"

export type BalanceAuditPanelProps = {
  defindexBalance: DefindexBalance | null
  apyValue: number | null
  apyLoading: boolean
  treasuryProjection: TreasuryProjection | null
  treasuryLoading: boolean
  treasuryPrefs: TreasuryPrefs
  onUpdateTreasuryPrefs: (next: Partial<TreasuryPrefs>) => void
  onClose?: () => void
  showHeader?: boolean
  hideChart?: boolean
  walletNetwork?: "testnet" | "mainnet"
  /** Called after a successful deposit/withdraw to refresh balances. */
  onRefresh?: () => void
}

export const BalanceAuditPanel = memo(function BalanceAuditPanel({
  defindexBalance,
  apyValue,
  apyLoading,
  treasuryProjection,
  treasuryLoading,
  treasuryPrefs,
  onUpdateTreasuryPrefs,
  onClose,
  showHeader = true,
  hideChart = false,
  walletNetwork = "testnet",
  onRefresh,
}: BalanceAuditPanelProps) {
  const { t } = useWalletLanguage()
  const { prefs: yieldPrefs } = useYieldPrefs()
  const { state: earnState, deposit, withdraw } = useEarnYield(onRefresh)

  const proj = treasuryProjection
  const fiat = treasuryPrefs.referenceFiat
  const mathLines = proj ? treasuryMathBreakdown(proj, t) : []
  const blendLink = getBlendStrategyLink(walletNetwork, yieldPrefs.strategy)
  const modeConfig = TREASURY_MODE_CONFIG[treasuryPrefs.mode]

  const protocolApy =
    proj && proj.protocolApy > 0
      ? proj.protocolApy
      : typeof apyValue === "number" && !isNaN(apyValue) && apyValue > 0
        ? apyValue
        : typeof defindexBalance?.apy === "number" && !isNaN(defindexBalance.apy) && defindexBalance.apy > 0
          ? defindexBalance.apy
          : 15.5

  const protocolApyLabel = apyLoading ? "..." : `${protocolApy.toFixed(2)}%`
  const effectiveApy =
    proj && proj.merchantApy > 0 && proj.merchantApy !== proj.protocolApy ? proj.merchantApy : null

  const strategyBalance = defindexBalance?.strategyBalance ?? 0
  const walletBalance = defindexBalance?.walletBalance ?? 0
  const sorobanSacBalance = defindexBalance?.sorobanSacBalance ?? 0
  const displayTotal = defindexBalance?.displayBalance ?? 0

  const MIN_DEPOSIT = Number(process.env.NEXT_PUBLIC_VAULT_MIN_DEPOSIT || "10") || 10
  const FEE_BUFFER = Number(process.env.NEXT_PUBLIC_VAULT_FEE_BUFFER || "0.4") || 0.4
  const maxDepositable = Math.max(0, walletBalance - FEE_BUFFER)

  const canDeposit = maxDepositable >= MIN_DEPOSIT
  const earnBusy = earnState.status === "signing" || earnState.status === "submitting"

  return (
    <div className="space-y-5 py-1">
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{t.treasuryPanelTitle}</h3>
            <p className="mt-0.5 text-xs text-white/55">{t.treasuryPanelSubtitle}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/15 p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={t.close}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {!hideChart ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <PurchasingPowerPnlChart
            projection={proj}
            loading={treasuryLoading}
            variant="full"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{t.usdcBalanceSection}</p>
        {defindexBalance ? (
          <div className="space-y-2">
            {walletBalance > 0 ? (
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-white/80 text-sm">{t.walletBlendBalanceLabel}</span>
                <span className="text-white font-medium tabular-nums">
                  ${walletBalance.toFixed(2)} USD
                </span>
              </div>
            ) : null}
            {sorobanSacBalance > 0 ? (
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-white/80 text-sm">{t.walletSacBalanceLabel}</span>
                <span className="text-white font-medium tabular-nums">
                  ${sorobanSacBalance.toFixed(2)} USD
                </span>
              </div>
            ) : null}
            {defindexBalance.classicOnSigner > 0 ? (
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-white/80 text-sm">{t.walletSignerBalanceLabel}</span>
                <span className="text-white/70 font-medium tabular-nums">
                  ${defindexBalance.classicOnSigner.toFixed(2)} USD
                </span>
              </div>
            ) : null}
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
              <span className="text-white/80 text-sm">{t.defiStrategyLabel}</span>
              <span className="text-green-400 font-medium tabular-nums">
                ${strategyBalance === 0 ? "0" : strategyBalance.toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg border-2 border-white/20">
              <span className="text-white font-semibold text-sm">{t.totalLabel}</span>
              <span className="text-white font-bold tabular-nums">
                ${displayTotal === 0 ? "0" : displayTotal.toFixed(2)} USD
              </span>
            </div>
            {walletBalance === 0 && sorobanSacBalance > 0 ? (
              <p className="text-[10px] leading-snug text-amber-200/80 px-1">{t.walletSacSendHint}</p>
            ) : null}
            {defindexBalance.strategyShares > 0 && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-white/50 text-xs">{t.defindexSharesLabel}</span>
                <span className="text-white/60 text-xs tabular-nums">
                  {defindexBalance.strategyShares.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-white/50 text-sm text-center py-4">{t.noBalanceData}</p>
        )}
      </div>

      {/* ── Earn CTAs ─────────────────────────────────────────────── */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40">Rendimiento DeFi</p>

        {earnState.status === "success" ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
            <p className="text-xs text-emerald-300 font-medium">
              {earnState.depositedAmount !== undefined
                ? `✓ Depositado $${earnState.depositedAmount.toFixed(2)} USD`
                : earnState.withdrawnAmount !== undefined
                  ? `✓ Retirado $${earnState.withdrawnAmount?.toFixed(2)} USD`
                  : "✓ Operación exitosa"}
            </p>
            {earnState.transactionHash && (
              <p className="text-[10px] text-emerald-300/60 mt-0.5 truncate">
                tx: {earnState.transactionHash.slice(0, 24)}...
              </p>
            )}
          </div>
        ) : earnState.status === "error" ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5">
            <p className="text-xs text-rose-300">{earnState.errorMessage ?? "Error desconocido"}</p>
          </div>
        ) : null}

        {strategyBalance === 0 ? (
          /* No strategy position yet — show "Start earning" */
          <button
            type="button"
            disabled={!canDeposit || earnBusy}
            onClick={() => deposit()}
            className={`w-full rounded-lg py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              canDeposit && !earnBusy
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {earnBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {earnState.status === "signing" ? "Firmando..." : "Enviando..."}
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" />
                {canDeposit ? "Empezar a ganar" : `Mínimo $${MIN_DEPOSIT} USDC`}
              </>
            )}
          </button>
        ) : (
          /* Has strategy position — show Add + Withdraw */
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canDeposit || earnBusy}
              onClick={() => deposit()}
              className={`rounded-lg py-2.5 px-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                canDeposit && !earnBusy
                  ? "bg-emerald-600/80 hover:bg-emerald-600 text-white"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {earnBusy && earnState.depositedAmount !== undefined ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              Agregar
            </button>
            <button
              type="button"
              disabled={strategyBalance <= 0 || earnBusy}
              onClick={() => withdraw()}
              className={`rounded-lg py-2.5 px-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                strategyBalance > 0 && !earnBusy
                  ? "bg-white/10 hover:bg-white/20 text-white/80"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              {earnBusy && earnState.withdrawnAmount !== undefined ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Retirar
            </button>
          </div>
        )}

        {!canDeposit && strategyBalance === 0 && (
          <p className="text-[10px] text-white/35 text-center">
            Deposita USDC en tu billetera para empezar a generar rendimiento.
          </p>
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{t.projectionParams}</p>
        <div className="space-y-1.5">
          <p className="text-xs text-white/55">{t.treasuryModeLabel}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["efficient", "balanced", "fast"] as TreasuryMode[]).map((m) => {
              const active = treasuryPrefs.mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onUpdateTreasuryPrefs({ mode: m })}
                  className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                    active
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white/80"
                  }`}
                >
                  {getTreasuryModeLabel(m, t)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-white/55">{t.periodDaysLabel}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {([7, 14, 30, 90] as Array<7 | 14 | 30 | 90>).map((d) => {
              const active = treasuryPrefs.holdingDays === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onUpdateTreasuryPrefs({ holdingDays: d })}
                  className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                    active
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white/80"
                  }`}
                >
                  {d}d
                </button>
              )
            })}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-white/40">{t.activePlan}</p>
          <p className="mt-1 text-sm font-medium text-white/90">
            {getTreasuryModeLabel(treasuryPrefs.mode, t)}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/50">
            {getTreasuryModeDescription(treasuryPrefs.mode, t)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
            <span>
              {formatWalletText(t.suggestedWithdrawals, {
                days: modeConfig.suggestedCashoutDays,
              })}
            </span>
            <span>
              {formatWalletText(t.strategyAllocation, {
                pct: modeConfig.strategyAllocationPct,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-4">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          {formatWalletText(t.projectionHeading, {
            days: treasuryPrefs.holdingDays,
            fiat,
          })}
        </p>
        {treasuryLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : proj ? (
          <div className="space-y-2">
            <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-black/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-emerald-200/70">{t.blendYield}</p>
                <span className="text-xs text-emerald-300/60 tabular-nums">
                  {proj.merchantApy.toFixed(2)}% APY · {proj.layers.yield.percent > 0 ? "+" : ""}
                  {proj.layers.yield.percent.toFixed(2)}% / {proj.periodDays}d
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <p className="text-xl font-bold tabular-nums text-emerald-300">
                  {proj.layers.yield.amountLocal >= 0 ? "+" : ""}
                  {formatFiatAmount(proj.layers.yield.amountLocal, fiat)}
                </p>
                <span className="text-xs text-emerald-300/50">
                  +${proj.layers.yield.amountUsd.toFixed(2)} USD
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.08] to-black/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-sky-200/70">{t.inflationAvoided}</p>
                <span className="text-xs text-sky-300/60">
                  +{proj.layers.inflationAvoided.percent.toFixed(2)}%
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums text-sky-300 mt-0.5">
                +{formatFiatAmount(proj.layers.inflationAvoided.amountLocal, fiat)}
              </p>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 ${
                proj.layers.fxProtection.amountLocal >= 0
                  ? "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] to-black/50"
                  : "border-rose-500/25 bg-gradient-to-br from-rose-500/[0.08] to-black/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-[10px] uppercase tracking-widest ${
                    proj.layers.fxProtection.amountLocal >= 0 ? "text-violet-200/70" : "text-rose-200/70"
                  }`}
                >
                  {t.fxProtection}
                </p>
                <span
                  className={`text-xs ${
                    proj.layers.fxProtection.amountLocal >= 0 ? "text-violet-300/60" : "text-rose-300/60"
                  }`}
                >
                  {proj.layers.fxProtection.percent >= 0 ? "+" : ""}
                  {proj.layers.fxProtection.percent.toFixed(2)}%
                </span>
              </div>
              <p
                className={`text-xl font-bold tabular-nums mt-0.5 ${
                  proj.layers.fxProtection.amountLocal >= 0 ? "text-violet-300" : "text-rose-400"
                }`}
              >
                {proj.layers.fxProtection.amountLocal >= 0 ? "+" : ""}
                {formatFiatAmount(proj.layers.fxProtection.amountLocal, fiat)}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-white/20 bg-white/[0.05] px-4 py-4">
              <p className="text-[10px] uppercase tracking-widest text-white/50">
                {t.totalPurchasingPowerTitle}
              </p>
              <p className="text-2xl font-bold tabular-nums text-white mt-1">
                {proj.total.amountLocal >= 0 ? "+" : ""}
                {formatFiatAmount(proj.total.amountLocal, fiat)}
              </p>
              <p className="text-xs text-white/45 mt-1">
                {formatWalletText(t.periodTotalLine, {
                  sign: proj.total.percentPeriod >= 0 ? "+" : "",
                  pct: proj.total.percentPeriod.toFixed(2),
                  days: proj.periodDays,
                })}
                {proj.layers.yield.percent > 0 ? (
                  <>
                    {" "}
                    {formatWalletText(t.periodLayerBreakdown, {
                      defi: proj.layers.yield.percent.toFixed(2),
                      inflation: proj.layers.inflationAvoided.percent.toFixed(2),
                      fx: proj.layers.fxProtection.percent.toFixed(2),
                    })}
                  </>
                ) : null}
              </p>
              <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
                {formatWalletText(t.notBlendApyNote, {
                  annualized: `${proj.total.percentAnnualized >= 0 ? "+" : ""}${proj.total.percentAnnualized.toFixed(1)}`,
                  apy: proj.merchantApy.toFixed(2),
                })}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40">{t.howCalculated}</p>
              <ul className="mt-2 space-y-2">
                {mathLines.map((line) => (
                  <li key={line.label} className="flex items-start justify-between gap-3 text-[11px]">
                    <div className="min-w-0">
                      <p className="font-medium text-white/70">{line.label}</p>
                      <p className="text-white/40 leading-snug">{line.detail}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-white/60">{line.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            {proj.comparison.localFiatLossPercent !== 0 && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3">
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  {formatWalletText(t.localFiatLossNote, {
                    fiat,
                    loss: Math.abs(proj.comparison.localFiatLossPercent).toFixed(2),
                    days: proj.periodDays,
                    inflation: proj.layers.inflationAvoided.percent.toFixed(2),
                    fx: Math.abs(proj.layers.fxProtection.percent).toFixed(2),
                  })}
                </p>
              </div>
            )}
            <div className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
              <p className="text-[10px] leading-relaxed text-white/30">{t.estimatedDisclaimer}</p>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm text-center py-4">{t.noProjection}</p>
        )}
      </div>

      {/* ── Verify on Blend (secondary link) ─────────────────────── */}
      <div className="border-t border-white/10 pt-4 space-y-2">
        <button
          type="button"
          onClick={() => openBlendStrategyAsset(walletNetwork, yieldPrefs.strategy)}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/60 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span>{t.viewBlendPool}</span>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="text-sm font-semibold text-white/80">{protocolApyLabel}</span>
            <span className="text-[10px] text-white/40">{t.poolApyLabel}</span>
          </div>
        </button>
        <p className="text-[10px] text-center text-white/30">
          {blendLink.poolLabel}
          {effectiveApy !== null
            ? ` · ${formatWalletText(t.effectiveApyCompare, { apy: effectiveApy.toFixed(2) })}`
            : ""}
        </p>
      </div>
    </div>
  )
})
