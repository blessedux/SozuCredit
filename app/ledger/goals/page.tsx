"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, MessageCircle, Plus, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import type { GoalsCoachChatMessage, GoalsCoachSuggestedGoal } from "@/lib/ledger/goals-coach-openrouter"
import {
  appendGoalFromSuggestion,
  readGoalsStore,
  writeGoalsStore,
  type LedgerGoalType,
  type LedgerStoredGoal,
  type LedgerStoredMilestone,
} from "@/lib/ledger/goals-local-storage"

const ledgerFetchInit = {
  headers: ledgerUserHeaders(),
  cache: "no-store" as RequestCache,
}

const WELCOME =
  "Hola. Soy tu asistente para metas financieras: te ayudo a bajar deuda, ahorrar un monto o lograr un objetivo concreto con hitos y fechas. Contame en una o dos frases qué querés lograr y en qué plazo pensás, y si podés un monto aproximado."

type Summary = {
  primaryCurrency: string
  incomeThisMonth: number
  expensesThisMonth: number
  netCashflow: number
  error?: string
}

function goalTypeLabel(t: LedgerGoalType): string {
  switch (t) {
    case "pay_debt":
      return "Pagar deuda"
    case "save_amount":
      return "Ahorrar un monto"
    default:
      return "Objetivo específico"
  }
}

function buildDraftSummary(parts: {
  goalType: LedgerGoalType
  title: string
  targetAmount: string
  currency: string
  targetDate: string
  milestones: { label: string; due: string; amount: string }[]
}): string {
  const lines = [
    `Tipo: ${parts.goalType}`,
    `Título: ${parts.title || "(vacío)"}`,
    `Monto objetivo: ${parts.targetAmount || "(sin definir)"} ${parts.currency}`,
    `Fecha objetivo: ${parts.targetDate || "(sin definir)"}`,
    "Hitos:",
    ...parts.milestones.map((m, i) => `  ${i + 1}. ${m.label || "(sin título)"} — ${m.due || "?"} — ${m.amount || "?"}`),
  ]
  return lines.join("\n")
}

export default function LedgerGoalsPage() {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [messages, setMessages] = useState<GoalsCoachChatMessage[]>(() => [
    { role: "assistant", content: WELCOME },
  ])
  const [input, setInput] = useState("")
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [lastSuggestion, setLastSuggestion] = useState<GoalsCoachSuggestedGoal | null>(null)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [coachOpen, setCoachOpen] = useState(false)

  const [goals, setGoals] = useState<LedgerStoredGoal[]>(() => readGoalsStore().goals)

  const [goalType, setGoalType] = useState<LedgerGoalType>("save_amount")
  const [title, setTitle] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [currency, setCurrency] = useState("CLP")
  const [targetDate, setTargetDate] = useState("")
  const [milestoneRows, setMilestoneRows] = useState<{ label: string; due: string; amount: string }[]>([
    { label: "", due: "", amount: "" },
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSummaryLoading(true)
      const res = await fetch("/api/ledger/summary", ledgerFetchInit)
      const json = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setSummary(null)
        setSummaryLoading(false)
        return
      }
      setSummary({
        primaryCurrency: String(json.primaryCurrency ?? "CLP"),
        incomeThisMonth: Number(json.incomeThisMonth) || 0,
        expensesThisMonth: Number(json.expensesThisMonth) || 0,
        netCashflow: Number(json.netCashflow) || 0,
        error: json.error,
      })
      setCurrency(String(json.primaryCurrency ?? "CLP").toUpperCase())
      setSummaryLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, coachLoading])

  const persistGoals = useCallback((next: LedgerStoredGoal[]) => {
    setGoals(next)
    writeGoalsStore({ goals: next })
  }, [])

  const ledgerContextForApi = useMemo(() => {
    if (!summary || summary.error) return null
    return {
      primaryCurrency: summary.primaryCurrency,
      incomeThisMonth: summary.incomeThisMonth,
      expensesThisMonth: summary.expensesThisMonth,
      netCashflow: summary.netCashflow,
    }
  }, [summary])

  const draftSummary = useMemo(
    () =>
      buildDraftSummary({
        goalType,
        title,
        targetAmount,
        currency,
        targetDate,
        milestones: milestoneRows,
      }),
    [goalType, title, targetAmount, currency, targetDate, milestoneRows]
  )

  const sendCoach = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || coachLoading) return
      setCoachError(null)
      setQuickReplies([])
      const nextUser: GoalsCoachChatMessage = { role: "user", content: trimmed }
      const history = [...messages, nextUser]
      setMessages(history)
      setInput("")
      setCoachLoading(true)
      setLastSuggestion(null)
      try {
        const res = await fetch("/api/ledger/goals-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
          body: JSON.stringify({
            messages: history,
            ledgerContext: ledgerContextForApi,
            currentDraftSummary: draftSummary,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setCoachError(typeof json.error === "string" ? json.error : "No se pudo contactar al coach.")
          setMessages((m) => m.slice(0, -1))
          setInput(trimmed)
          return
        }
        const assistant = typeof json.assistant_message === "string" ? json.assistant_message : ""
        const chips = Array.isArray(json.follow_up_chips)
          ? (json.follow_up_chips as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 6)
          : []
        const suggested = json.suggested_goal as GoalsCoachSuggestedGoal | null | undefined
        setMessages([...history, { role: "assistant", content: assistant }])
        setQuickReplies(chips)
        if (suggested && typeof suggested === "object" && suggested.title) {
          setLastSuggestion(suggested)
        }
      } catch {
        setCoachError("Error de red. Intentá de nuevo.")
        setMessages((m) => m.slice(0, -1))
        setInput(trimmed)
      } finally {
        setCoachLoading(false)
      }
    },
    [messages, coachLoading, ledgerContextForApi, draftSummary]
  )

  const applySuggestionToForm = useCallback((s: GoalsCoachSuggestedGoal) => {
    setGoalType(s.goal_type)
    setTitle(s.title)
    setCurrency(s.currency.trim().toUpperCase())
    setTargetAmount(s.target_amount != null && Number.isFinite(s.target_amount) ? String(s.target_amount) : "")
    setTargetDate(s.target_date_iso?.trim() ?? "")
    if (s.milestones.length > 0) {
      setMilestoneRows(
        s.milestones.map((m) => ({
          label: m.label,
          due: m.due_date_iso?.trim() ?? "",
          amount: m.amount != null && Number.isFinite(m.amount) ? String(m.amount) : "",
        }))
      )
    }
    setLastSuggestion(null)
  }, [])

  const saveFromForm = useCallback(() => {
    const t = title.trim()
    if (!t) {
      setCoachError("Agregá un título a la meta antes de guardar.")
      return
    }
    const amt = targetAmount.trim() ? Number(targetAmount.replace(",", ".")) : null
    const ms: LedgerStoredMilestone[] = milestoneRows
      .map((row) => {
        const label = row.label.trim()
        if (!label) return null
        const a = row.amount.trim() ? Number(row.amount.replace(",", ".")) : null
        return {
          id: crypto.randomUUID(),
          label,
          due_date_iso: row.due.trim() || null,
          amount: a != null && Number.isFinite(a) ? a : null,
          done: false,
        }
      })
      .filter(Boolean) as LedgerStoredMilestone[]

    const goal: LedgerStoredGoal = {
      id: crypto.randomUUID(),
      goal_type: goalType,
      title: t,
      target_amount: amt != null && Number.isFinite(amt) ? amt : null,
      currency: currency.trim().toUpperCase() || "CLP",
      target_date_iso: targetDate.trim() || null,
      milestones: ms,
      created_at: new Date().toISOString(),
    }
    persistGoals([goal, ...goals])
    setCoachError(null)
  }, [title, targetAmount, currency, targetDate, milestoneRows, goalType, goals, persistGoals])

  const saveSuggestionDirect = useCallback(
    (s: GoalsCoachSuggestedGoal) => {
      const goal = appendGoalFromSuggestion(s)
      persistGoals([goal, ...goals])
      setLastSuggestion(null)
    },
    [goals, persistGoals]
  )

  const removeGoal = useCallback(
    (id: string) => {
      persistGoals(goals.filter((g) => g.id !== id))
    },
    [goals, persistGoals]
  )

  const toggleMilestone = useCallback(
    (goalId: string, mid: string) => {
      persistGoals(
        goals.map((g) => {
          if (g.id !== goalId) return g
          return {
            ...g,
            milestones: g.milestones.map((m) => (m.id === mid ? { ...m, done: !m.done } : m)),
          }
        })
      )
    },
    [goals, persistGoals]
  )

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <p className="text-xs uppercase tracking-widest text-white/40">Metas financieras</p>
          <h2 className="text-xl font-semibold text-white">Objetivos, hitos y plazos</h2>
          <p className="text-sm text-white/50 max-w-xl">
            Definí metas concretas (deuda, ahorro u otro objetivo). Si querés ayuda para afinar montos y hitos, abrí el
            coach con el botón flotante abajo a la derecha.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="border-white/20 bg-white/5 text-white hover:bg-white/10 shrink-0">
          <Link href="/ledger" className="inline-flex items-center gap-1">
            Volver al resumen
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {summaryLoading ? (
        <div
          className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-4 space-y-2"
          aria-busy
          aria-label="Cargando resumen del libro"
        >
          <Skeleton className="h-3 w-48 rounded bg-white/10" />
          <Skeleton className="h-4 w-full max-w-xl rounded bg-white/10" />
          <Skeleton className="h-4 w-full max-w-md rounded bg-white/10" />
        </div>
      ) : summary && !summary.error ? (
        <div className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          <span className="text-white/45">Mes actual ({summary.primaryCurrency}):</span> ingresos{" "}
          <span className="text-emerald-300/95 tabular-nums">{formatFiatAmount(summary.incomeThisMonth, summary.primaryCurrency)}</span>
          {" · "}gastos{" "}
          <span className="text-rose-300/95 tabular-nums">{formatFiatAmount(summary.expensesThisMonth, summary.primaryCurrency)}</span>
          {" · "}flujo neto{" "}
          <span className="text-white/90 font-medium tabular-nums">{formatFiatAmount(summary.netCashflow, summary.primaryCurrency)}</span>
        </div>
      ) : (
        <p className="text-xs text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          No pudimos cargar el resumen del libro (¿sesión?). Podés seguir escribiendo metas; el coach usará solo lo que
          le cuentes.
        </p>
      )}

      <div className="space-y-6 max-w-3xl">
          <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Nueva meta</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/70">Tipo</Label>
                <Select value={goalType} onValueChange={(v) => setGoalType(v as LedgerGoalType)}>
                  <SelectTrigger className="w-full max-w-md bg-black/40 border-white/15 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pay_debt">Pagar deuda</SelectItem>
                    <SelectItem value="save_amount">Ahorrar un monto</SelectItem>
                    <SelectItem value="specific">Objetivo específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/70">Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej.: Fondo de emergencia 3 meses"
                  className="bg-black/40 border-white/15 text-white placeholder:text-white/35"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Monto objetivo</Label>
                <Input
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="Opcional"
                  className="bg-black/40 border-white/15 text-white placeholder:text-white/35"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Moneda</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="bg-black/40 border-white/15 text-white placeholder:text-white/35"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/70">Fecha objetivo</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-black/40 border-white/15 text-white scheme-dark max-w-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-white/70">Hitos</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setMilestoneRows((r) => [...r, { label: "", due: "", amount: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden />
                  Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {milestoneRows.map((row, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-12 items-end border border-white/10 rounded-lg p-2 bg-black/20">
                    <div className="sm:col-span-5 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Etiqueta</span>
                      <Input
                        value={row.label}
                        onChange={(e) =>
                          setMilestoneRows((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x))
                          )
                        }
                        className="h-9 bg-black/40 border-white/15 text-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Fecha</span>
                      <Input
                        type="date"
                        value={row.due}
                        onChange={(e) =>
                          setMilestoneRows((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, due: e.target.value } : x))
                          )
                        }
                        className="h-9 bg-black/40 border-white/15 text-white scheme-dark text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Monto</span>
                      <Input
                        value={row.amount}
                        onChange={(e) =>
                          setMilestoneRows((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x))
                          )
                        }
                        inputMode="decimal"
                        className="h-9 bg-black/40 border-white/15 text-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white/40 hover:text-rose-300"
                        aria-label="Quitar hito"
                        disabled={milestoneRows.length <= 1}
                        onClick={() => setMilestoneRows((rows) => rows.filter((_, j) => j !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="button" className="bg-white text-black hover:bg-white/90" onClick={saveFromForm}>
              Guardar meta
            </Button>
          </section>

          <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-white/40">Tus metas ({goals.length})</p>
            {goals.length === 0 ? (
              <p className="text-sm text-white/45">
                Todavía no guardaste metas. Podés usar el botón del coach (abajo a la derecha) para armar la primera.
              </p>
            ) : (
              <ul className="space-y-3">
                {goals.map((g) => (
                  <li key={g.id} className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase text-white/40">{goalTypeLabel(g.goal_type)}</p>
                        <p className="font-medium text-white">{g.title}</p>
                        <p className="text-xs text-white/55 mt-1">
                          {g.target_amount != null
                            ? `${formatFiatAmount(g.target_amount, g.currency)}`
                            : "Sin monto fijo"}
                          {g.target_date_iso ? ` · objetivo ${g.target_date_iso}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-white/40 hover:text-rose-300 shrink-0"
                        aria-label="Eliminar meta"
                        onClick={() => removeGoal(g.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {g.milestones.length > 0 ? (
                      <ul className="space-y-1.5 pt-1 border-t border-white/10">
                        {g.milestones.map((m) => (
                          <li key={m.id} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={m.done}
                              onChange={() => toggleMilestone(g.id, m.id)}
                              className="mt-1 rounded border-white/30"
                              aria-label={m.done ? `Marcar pendiente: ${m.label}` : `Marcar hecho: ${m.label}`}
                            />
                            <span className={m.done ? "text-white/40 line-through" : "text-white/80"}>
                              {m.label}
                              {m.due_date_iso ? (
                                <span className="text-white/45"> · {m.due_date_iso}</span>
                              ) : null}
                              {m.amount != null ? (
                                <span className="text-white/45 tabular-nums">
                                  {" "}
                                  · {formatFiatAmount(m.amount, g.currency)}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-white/35 leading-relaxed">
              Las metas se guardan en este dispositivo (local). Más adelante podrán sincronizarse con tu cuenta.
            </p>
          </section>
      </div>
    </div>

    <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
      <SheetContent
        side="right"
        className="relative flex h-full w-full flex-col gap-0 border-l border-white/15 bg-neutral-950 p-0 text-white sm:max-w-md"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-white/10 px-4 py-3 pr-12 text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300/90" aria-hidden />
            <SheetTitle className="text-base text-white">Coach estratégico</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-white/50">
            Preguntas y sugerencias según lo que nos cuentes y el resumen del mes cuando esté disponible.
          </SheetDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-9 w-9 text-white/55 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar coach"
            onClick={() => setCoachOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 max-w-[95%] ${
                  msg.role === "user"
                    ? "ml-auto bg-violet-500/20 text-violet-50 border border-violet-400/25"
                    : "mr-auto bg-white/[0.06] text-white/85 border border-white/10"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            ))}
            {coachLoading ? (
              <div className="flex items-center gap-2 text-white/45 text-xs px-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Pensando…
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
          {lastSuggestion ? (
            <div className="shrink-0 border-t border-white/10 px-4 py-3 space-y-2 bg-amber-500/[0.06]">
              <p className="text-xs text-amber-100/90 font-medium">Sugerencia del coach</p>
              <p className="text-[11px] text-white/55">{lastSuggestion.why_achievable_one_line}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-white text-black hover:bg-white/90"
                  onClick={() => applySuggestionToForm(lastSuggestion)}
                >
                  Aplicar al formulario
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10"
                  onClick={() => saveSuggestionDirect(lastSuggestion)}
                >
                  Guardar sugerencia
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-white/55 hover:text-white"
                  onClick={() => setLastSuggestion(null)}
                >
                  Descartar
                </Button>
              </div>
            </div>
          ) : null}
          {coachError ? (
            <p className="shrink-0 border-t border-white/10 px-4 py-2 text-xs text-rose-300/95">{coachError}</p>
          ) : null}
          <div className="shrink-0 border-t border-white/10 p-3 space-y-2">
            {quickReplies.length > 0 && !coachLoading ? (
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="rounded-full border border-white/20 bg-white/[0.07] px-3 py-1 text-xs text-white/85 hover:bg-white/15 transition-colors"
                    onClick={() => void sendCoach(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu respuesta o lo que querés lograr…"
              rows={3}
              className="resize-none bg-black/40 border-white/15 text-white placeholder:text-white/35"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void sendCoach(input)
                }
              }}
            />
            <Button
              type="button"
              className="w-full bg-amber-500/90 text-black hover:bg-amber-400"
              disabled={coachLoading || !input.trim()}
              onClick={() => void sendCoach(input)}
            >
              <MessageCircle className="h-4 w-4 mr-2" aria-hidden />
              Enviar al coach
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {!coachOpen ? (
      <button
        type="button"
        onClick={() => setCoachOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/35 bg-amber-500/90 text-black shadow-lg shadow-black/40 transition-transform hover:scale-105 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:bottom-28 sm:right-6"
        aria-label="Abrir coach de metas"
      >
        <Sparkles className="h-6 w-6" aria-hidden />
      </button>
    ) : null}
    </>
  )
}
