"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, Plus } from "lucide-react"
import { LedgerCategoryCombobox } from "@/components/ledger/ledger-category-combobox"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseHeuristicReceipt } from "@/lib/gmail/parse-heuristic"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { resolveMerchantLegalFromTx } from "@/lib/ledger/merchant-alias"
import { parseLedgerAmountInput } from "@/lib/ledger/currency"
import { formatLedgerTxDetailMoment } from "@/lib/ledger/transaction-date"
import { cn } from "@/lib/utils"

export type LedgerTransactionEditRow = {
  id: string
  date: string
  merchant: string | null
  /** Bank / receipt legal commerce name when known (e.g. Chile "Detalle Comercio"). */
  merchant_legal?: string | null
  amount: string | number
  currency: string
  type: string
  category: string
  source: string
  confidence: number
  raw_text?: string | null
  source_email_id?: string | null
  /** Manual vault (e.g. Binance) when marking income provenance. */
  source_vault_id?: string | null
  source_vault_name?: string | null
  institution_tag?: string
  institution_label?: string
  institution_kind?: string
  card_last_four?: string | null
  cardholder_name?: string | null
}

/** Sentinel for Select when no vault is linked (share with manual entry form). */
export const LEDGER_VAULT_SELECT_NONE = "__vault_none__"

const LEDGER_QUICK_CURRENCIES = ["CLP", "USD", "EUR", "ARS", "USDC", "MXN"] as const

type VaultOption = { id: string; name: string }

type LedgerTransactionEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: LedgerTransactionEditRow | null
  categories: string[]
  incomeCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  onIncomeCategoriesChange: (incomeCategories: string[]) => void
  onSaved: (id: string, patch: Partial<LedgerTransactionEditRow>) => void
  onDismissed: (id: string) => void
}

export function LedgerTransactionEditDialog({
  open,
  onOpenChange,
  row,
  categories,
  incomeCategories,
  onCategoriesChange,
  onIncomeCategoriesChange,
  onSaved,
  onDismissed,
}: LedgerTransactionEditDialogProps) {
  const [editMerchant, setEditMerchant] = useState("")
  const [editCategory, setEditCategory] = useState("unknown")
  const [editType, setEditType] = useState("expense")
  const [rememberManualRule, setRememberManualRule] = useState(true)
  const [rememberMerchantAlias, setRememberMerchantAlias] = useState(false)
  const [rememberDismissRule, setRememberDismissRule] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [dismissLoading, setDismissLoading] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const [editAmountStr, setEditAmountStr] = useState("")
  const [editCurrency, setEditCurrency] = useState("CLP")
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false)

  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState("")
  const [addCategoryLoading, setAddCategoryLoading] = useState(false)
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null)

  const [savedFlash, setSavedFlash] = useState(false)
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRowIdRef = useRef<string | null>(null)

  const [vaultOptions, setVaultOptions] = useState<VaultOption[]>([])
  const [vaultsLoading, setVaultsLoading] = useState(false)
  const [editSourceVaultId, setEditSourceVaultId] = useState<string>(LEDGER_VAULT_SELECT_NONE)

  function clearSavedFlashTimer() {
    if (savedFlashTimerRef.current) {
      clearTimeout(savedFlashTimerRef.current)
      savedFlashTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!open) {
      setDialogError(null)
      setSavedFlash(false)
      dialogRowIdRef.current = null
      clearSavedFlashTimer()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setVaultsLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/ledger/vaults", {
          headers: { ...ledgerUserHeaders() },
          cache: "no-store",
        })
        const j = (await res.json().catch(() => ({}))) as { vaults?: { id: string; name: string }[] }
        if (!cancelled && res.ok && Array.isArray(j.vaults)) {
          setVaultOptions(j.vaults.map((v) => ({ id: v.id, name: v.name })))
        }
      } finally {
        if (!cancelled) setVaultsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !row) return

    const prevId = dialogRowIdRef.current
    const switchedTransaction = prevId !== null && prevId !== row.id
    dialogRowIdRef.current = row.id
    if (switchedTransaction) {
      setSavedFlash(false)
      clearSavedFlashTimer()
    }

    setEditMerchant(row.merchant ?? "")
    const amt = Number(row.amount)
    setEditAmountStr(Number.isFinite(amt) ? String(amt) : "")
    setEditCurrency(String(row.currency ?? "CLP")
      .trim()
      .toUpperCase()
      .slice(0, 8))
    setCurrencyPopoverOpen(false)
    setEditCategory(String(row.category ?? "unknown").trim().toLowerCase())
    setEditType(row.type)
    setRememberManualRule(false)
    const legal = resolveMerchantLegalFromTx({
      merchant_legal: row.merchant_legal ?? null,
      raw_text: row.raw_text ?? null,
    })
    setRememberMerchantAlias(Boolean(legal?.trim()))
    setRememberDismissRule(false)
    setDialogError(null)
    setEditSourceVaultId(row.source_vault_id?.trim() ? row.source_vault_id : LEDGER_VAULT_SELECT_NONE)
  }, [open, row])

  useEffect(() => {
    if (!open || !row) return
    setEditCategory((prev) => {
      const list = editType === "income" || editType === "refund" ? incomeCategories : categories
      if (list.includes(prev)) return prev
      return "unknown"
    })
  }, [open, row?.id, editType, categories, incomeCategories])

  const categoryListForType = useMemo(() => {
    return editType === "income" || editType === "refund" ? incomeCategories : categories
  }, [editType, categories, incomeCategories])

  const parsedFromEmail = useMemo(() => {
    if (!row?.raw_text?.trim() || row.source !== "gmail") return null
    return parseHeuristicReceipt(row.raw_text)
  }, [row?.raw_text, row?.source])

  const commerceLegalName = useMemo(() => {
    if (!row) return null
    return resolveMerchantLegalFromTx({
      merchant_legal: row.merchant_legal ?? null,
      raw_text: row.raw_text ?? null,
    })
  }, [row])

  async function saveManualEdits() {
    if (!row) return
    const parsedAmt = parseLedgerAmountInput(editAmountStr)
    if (parsedAmt == null) {
      setDialogError("Revisá el monto (ej: 25000 o 25.000).")
      return
    }
    const curNorm = editCurrency.trim().toUpperCase().slice(0, 8)
    if (curNorm.length < 3) {
      setDialogError("Elegí una moneda (tocá el código al lado del monto).")
      return
    }

    setSaveLoading(true)
    setDialogError(null)
    let showSavedFlash = false
    try {
      const res = await fetch(`/api/ledger/transactions/${row.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({
          merchant: editMerchant.trim() || null,
          amount: parsedAmt,
          currency: curNorm,
          category: editCategory,
          type: editType,
          remember_merchant_alias:
            rememberMerchantAlias && Boolean(commerceLegalName?.trim()),
          source_vault_id:
            editType === "income" || editType === "refund"
              ? editSourceVaultId === LEDGER_VAULT_SELECT_NONE
                ? null
                : editSourceVaultId
              : null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string } & Partial<LedgerTransactionEditRow>
      if (!res.ok) {
        setDialogError(typeof json.error === "string" ? json.error : "No se pudo guardar")
        return
      }
      onSaved(row.id, {
        merchant: (json.merchant !== undefined ? json.merchant : editMerchant.trim()) || null,
        merchant_legal:
          (json as { merchant_legal?: string | null }).merchant_legal ?? row.merchant_legal ?? null,
        amount: Number(json.amount ?? parsedAmt),
        currency: String(json.currency ?? curNorm),
        category: String(json.category ?? editCategory),
        type: String(json.type ?? editType),
        card_last_four: (json as { card_last_four?: string | null }).card_last_four ?? row.card_last_four ?? null,
        cardholder_name: (json as { cardholder_name?: string | null }).cardholder_name ?? row.cardholder_name ?? null,
        source_vault_id: (json as { source_vault_id?: string | null }).source_vault_id ?? null,
        source_vault_name: (json as { source_vault_name?: string | null }).source_vault_name ?? null,
        institution_label: (json as { institution_label?: string }).institution_label ?? row.institution_label,
      })
      showSavedFlash = true

      if (rememberManualRule) {
        const rr = await fetch("/api/ledger/category-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
          body: JSON.stringify({
            from_transaction_id: row.id,
            category: editCategory,
            type: editType,
            skip_sync: false,
          }),
        })
        if (!rr.ok) {
          const j = (await rr.json().catch(() => ({}))) as { error?: string }
          setDialogError(typeof j.error === "string" ? j.error : "Movimiento guardado; regla no creada")
          showSavedFlash = false
        }
      }
    } finally {
      setSaveLoading(false)
      if (showSavedFlash) {
        clearSavedFlashTimer()
        setSavedFlash(true)
        savedFlashTimerRef.current = setTimeout(() => {
          setSavedFlash(false)
          savedFlashTimerRef.current = null
        }, 2000)
      }
    }
  }

  async function submitNewLedgerCategory() {
    const label = newCategoryLabel.trim()
    if (!label) {
      setAddCategoryError("Escribí un nombre.")
      return
    }
    const kind = editType === "income" || editType === "refund" ? "income" : "expense"
    setAddCategoryLoading(true)
    setAddCategoryError(null)
    try {
      const res = await fetch("/api/ledger/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({ label, kind }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        categories?: string[]
        incomeCategories?: string[]
        slug?: string
      }
      if (!res.ok) {
        setAddCategoryError(typeof json.error === "string" ? json.error : "No se pudo crear")
        return
      }
      if (Array.isArray(json.categories)) onCategoriesChange(json.categories)
      if (Array.isArray(json.incomeCategories)) onIncomeCategoriesChange(json.incomeCategories)
      if (json.slug) setEditCategory(String(json.slug))
      setNewCategoryLabel("")
      setCategoryPopoverOpen(false)
    } catch {
      setAddCategoryError("Red no disponible")
    } finally {
      setAddCategoryLoading(false)
    }
  }

  async function dismissNotExpense() {
    if (!row) return
    setDismissLoading(true)
    setDialogError(null)
    try {
      const res = await fetch(`/api/ledger/transactions/${row.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({ dismissed: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDialogError(typeof json.error === "string" ? json.error : "No se pudo ocultar el movimiento")
        return
      }

      if (rememberDismissRule) {
        const rr = await fetch("/api/ledger/category-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
          body: JSON.stringify({
            from_transaction_id: row.id,
            category: "junk_mail",
            type: null,
            skip_sync: true,
          }),
        })
        if (!rr.ok) {
          const j = (await rr.json().catch(() => ({}))) as { error?: string }
          setDialogError(typeof j.error === "string" ? j.error : "Oculto; no se guardó la regla anti-correo")
        }
      }

      onDismissed(row.id)
    } finally {
      setDismissLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "border-white/15 bg-neutral-950 text-white",
          /* flex shell keeps Radix centering stable; scroll lives inside (overflow on same node as translate can shift off-screen) */
          "flex max-h-[min(88dvh,calc(100dvh-1.5rem))] w-[min(100vw-1.5rem,32rem)] max-w-[calc(100vw-1.5rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            {row ? (
              <div className="relative flex min-w-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle className="text-white pr-8">Editar movimiento</DialogTitle>
              {commerceLegalName?.trim() ? (
                <div className="space-y-1 text-left">
                  <p className="text-[11px] uppercase tracking-wide text-white/40">Razón social (banco / correo)</p>
                  <p className="text-sm text-white/75 break-words">{commerceLegalName.trim()}</p>
                </div>
              ) : (
                <p className="text-sm text-white/65 text-left">{row.merchant?.trim() || "Sin título"}</p>
              )}
            </DialogHeader>

            {dialogError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {dialogError}
              </div>
            ) : null}

            <div className="grid min-w-0 max-w-full gap-3 text-sm">
              <DetailItem
                label={row.source === "gmail" ? "Fecha y hora (correo recibido)" : "Fecha"}
                value={formatLedgerTxDetailMoment(row.date, row.source)}
              />
              <div className="space-y-2 min-w-0">
                <Label className="text-xs text-white/50">Monto</Label>
                <div className="flex gap-2 items-center min-w-0">
                  <Input
                    value={editAmountStr}
                    onChange={(e) => setEditAmountStr(e.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-white/5 border-white/20 text-white tabular-nums"
                    placeholder="Ej: 25000 o 25.000"
                  />
                  <Popover open={currencyPopoverOpen} onOpenChange={setCurrencyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 h-9 min-w-[4.25rem] px-2 font-mono text-xs border-white/25 bg-white/10 text-white hover:bg-white/15"
                        aria-label="Cambiar moneda"
                      >
                        {editCurrency}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="z-[200] w-[13.5rem] border-white/15 bg-neutral-950 p-3 text-white shadow-xl"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-white/45 mb-2">Moneda</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {LEDGER_QUICK_CURRENCIES.map((c) => (
                          <Button
                            key={c}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={
                              editCurrency === c
                                ? "h-8 border-white/35 bg-white font-mono text-[11px] text-black hover:bg-white/90"
                                : "h-8 border-white/20 bg-white/5 font-mono text-[11px] text-white hover:bg-white/10"
                            }
                            onClick={() => {
                              setEditCurrency(c)
                              setCurrencyPopoverOpen(false)
                            }}
                          >
                            {c}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-[10px] text-white/40 leading-snug">
                  Tocá el código (CLP, USD…) para cambiar la moneda sin salir del diálogo.
                </p>
              </div>
              {row.card_last_four ? (
                <DetailItem label="Tarjeta (últimos 4)" value={`···· ${row.card_last_four}`} />
              ) : null}
              {row.cardholder_name ? (
                <DetailItem label="Titular en tarjeta" value={row.cardholder_name} />
              ) : null}

              <div className="space-y-2">
                <Label className="text-xs text-white/50">
                  {commerceLegalName?.trim() ? "Alias / nombre en el libro" : "Comercio / título"}
                </Label>
                <Input
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  placeholder={
                    commerceLegalName?.trim()
                      ? "Ej: Café de la esquina, Jumbo Costanera…"
                      : "Nombre del movimiento"
                  }
                  className="bg-white/5 border-white/20 text-white"
                />
                {commerceLegalName?.trim() ? (
                  <label className="flex items-start gap-2 text-xs text-white/55 cursor-pointer">
                    <Checkbox
                      checked={rememberMerchantAlias}
                      onCheckedChange={(v) => setRememberMerchantAlias(v === true)}
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                    />
                    Usar este nombre para todos los cargos con la misma razón social y en futuras importaciones desde
                    Gmail
                  </label>
                ) : (
                  <p className="text-[11px] text-white/40 leading-snug">
                    Si el correo trae razón social en el cuerpo, podrás guardar un alias distinto y reutilizarlo en
                    cargos iguales.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Tipo</Label>
                  <Select
                    value={editType}
                    onValueChange={(v) => {
                      setEditType(v)
                      if (v !== "income" && v !== "refund") setEditSourceVaultId(LEDGER_VAULT_SELECT_NONE)
                      setEditCategory((prev) => {
                        const list = v === "income" || v === "refund" ? incomeCategories : categories
                        if (list.includes(prev)) return prev
                        return "unknown"
                      })
                    }}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Ingreso</SelectItem>
                      <SelectItem value="expense">Gasto</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="refund">Reembolso</SelectItem>
                      <SelectItem value="unknown">Desconocido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label className="text-xs text-white/50">Categoría</Label>
                  <div className="flex gap-1.5 items-center">
                    <div className="min-w-0 flex-1">
                      <LedgerCategoryCombobox
                        value={editCategory}
                        onValueChange={setEditCategory}
                        categories={categoryListForType}
                        triggerClassName="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                    <Popover
                      open={categoryPopoverOpen}
                      onOpenChange={(nextOpen) => {
                        setCategoryPopoverOpen(nextOpen)
                        if (!nextOpen) {
                          setAddCategoryError(null)
                          setNewCategoryLabel("")
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="shrink-0 h-9 w-9 border-white/20 bg-white/5 text-white hover:bg-white/10"
                          aria-label="Agregar categoría"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="z-[200] w-72 border-white/15 bg-neutral-950 p-3 text-white shadow-xl"
                      >
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-white/85">Nueva categoría</p>
                          <Input
                            value={newCategoryLabel}
                            onChange={(e) => setNewCategoryLabel(e.target.value)}
                            placeholder={
                              editType === "income" || editType === "refund"
                                ? "Ej: sueldo, honorarios…"
                                : "Ej: café, gimnasio, regalos…"
                            }
                            className="bg-white/5 border-white/20 text-white text-sm"
                            disabled={addCategoryLoading}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                void submitNewLedgerCategory()
                              }
                            }}
                          />
                          <p className="text-[10px] text-white/45 leading-snug">
                            Se guarda como etiqueta en minúsculas y guiones bajos (ej:{" "}
                            <span className="font-mono text-white/55">gimnasio</span>).
                          </p>
                          {addCategoryError ? (
                            <p className="text-[11px] text-red-300/95">{addCategoryError}</p>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            className="w-full bg-white text-black hover:bg-white/90"
                            disabled={addCategoryLoading}
                            onClick={() => void submitNewLedgerCategory()}
                          >
                            {addCategoryLoading ? "Guardando…" : "Agregar y seleccionar"}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {editType === "income" || editType === "refund" ? (
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Procedencia (vault opcional)</Label>
                  <p className="text-[11px] text-white/40 leading-snug">
                    Si este ingreso llegó desde un exchange u otro ahorro manual (ej. offramp Binance → Mach), elegí el
                    vault.
                  </p>
                  <Select
                    value={editSourceVaultId}
                    onValueChange={setEditSourceVaultId}
                    disabled={vaultsLoading || vaultOptions.length === 0}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue
                        placeholder={
                          vaultsLoading
                            ? "Cargando vaults…"
                            : vaultOptions.length === 0
                              ? "Creá un vault en la pestaña Vaults"
                              : "Sin vault"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LEDGER_VAULT_SELECT_NONE}>Sin vault</SelectItem>
                      {vaultOptions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <label className="flex items-start gap-2 text-xs text-white/55 cursor-pointer">
                <Checkbox
                  checked={rememberManualRule}
                  onCheckedChange={(v) => setRememberManualRule(v === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                Recordar categoría para este comercio (próximos cargos iguales se clasifican igual en la
                sincronización de Gmail)
              </label>

              <Button
                type="button"
                className="w-full bg-white text-black hover:bg-white/90"
                disabled={saveLoading}
                onClick={() => void saveManualEdits()}
              >
                {saveLoading ? "Guardando…" : "Guardar cambios manuales"}
              </Button>

              <Separator className="bg-white/10" />

              {parsedFromEmail ? (
                <div className="space-y-2 min-w-0">
                  <p className="text-xs font-medium text-white/50">Detectado en el correo</p>
                  <EmailParsedSummary parsed={parsedFromEmail} />
                </div>
              ) : row.source === "gmail" && !row.raw_text?.trim() ? (
                <p className="text-[11px] text-white/45 leading-snug">
                  No hay fragmento de correo guardado para este movimiento.
                </p>
              ) : null}

              <DetailItem
                label="Origen (banco / app / vault)"
                value={
                  <span>
                    {row.institution_label ?? "—"}
                    {row.institution_kind ? (
                      <span className="text-white/45 text-[11px]"> ({row.institution_kind})</span>
                    ) : null}
                  </span>
                }
              />
              <DetailItem label="Canal" value={<span className="capitalize">{row.source}</span>} />
              <DetailItem label="Confianza actual" value={`${(row.confidence * 100).toFixed(0)}%`} />
              {row.source_email_id ? (
                <DetailItem label="Email origen (id)" value={row.source_email_id} mono />
              ) : null}
              <DetailItem label="ID movimiento" value={row.id} mono />
            </div>

            <Separator className="bg-white/10 my-2" />

            <DialogFooter className="flex-col gap-3 sm:flex-col border-t border-white/10 pt-4 mt-0">
              <label className="flex items-start gap-2 text-xs text-white/55 cursor-pointer w-full">
                <Checkbox
                  checked={rememberDismissRule}
                  onCheckedChange={(v) => setRememberDismissRule(v === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                Al ocultar, no volver a importar desde Gmail si el texto coincide (regla{" "}
                <code className="text-white/60">skip_sync</code>)
              </label>
              <Button
                type="button"
                variant="outline"
                className="w-full border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                disabled={dismissLoading}
                onClick={(e) => {
                  e.preventDefault()
                  void dismissNotExpense()
                }}
              >
                {dismissLoading ? "Guardando…" : "No es un gasto — ocultar"}
              </Button>
            </DialogFooter>

              </div>
            ) : null}
          </div>
          {row && savedFlash ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-neutral-950/35 backdrop-blur-xl backdrop-saturate-150 animate-in fade-in-0 zoom-in-95 ease-out duration-300"
            >
              <CheckCircle2
                className="size-12 shrink-0 text-emerald-400/95 drop-shadow-[0_0_18px_rgba(52,211,153,0.22)] motion-reduce:animate-none motion-reduce:transform-none animate-[ledger-save-icon-nudge_2.4s_ease-in-out_infinite]"
                aria-hidden
              />
              <p className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both px-6 text-center text-base font-medium tracking-tight text-white/95 delay-100 duration-300 ease-out">
                Comprobante actualizado
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmailParsedSummary({
  parsed,
}: {
  parsed: ReturnType<typeof parseHeuristicReceipt>
}) {
  const rows: { label: string; value: string }[] = []
  if (parsed.merchant?.trim()) {
    rows.push({ label: "Comercio", value: parsed.merchant.trim() })
  }
  if (parsed.amount != null && parsed.amount > 0) {
    rows.push({
      label: "Monto",
      value: `${Number(parsed.amount).toLocaleString("es-CL")} ${parsed.currency}`,
    })
  }
  if (parsed.type && parsed.type !== "unknown") {
    rows.push({ label: "Tipo (heurística)", value: parsed.type })
  }
  if (parsed.card_last_four) {
    rows.push({ label: "Tarjeta ····", value: parsed.card_last_four })
  }
  if (parsed.cardholder_name?.trim()) {
    rows.push({ label: "Titular en tarjeta", value: parsed.cardholder_name.trim() })
  }

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-white/45 leading-snug">
        En el fragmento guardado no aparecen comercio ni monto reconocibles (puede estar incompleto o ser un correo no
        estándar).
      </p>
    )
  }

  return (
    <ul className="rounded-md border border-white/10 bg-black/25 px-3 py-2.5 space-y-2 text-xs min-w-0">
      {rows.map((r) => (
        <li key={r.label} className="min-w-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 items-baseline">
          <span className="text-white/45 shrink-0">{r.label}</span>
          <span className="text-white/90 break-words min-w-0">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-xs font-medium text-white/50">{label}</p>
      <p
        className={
          mono
            ? "font-mono text-[11px] text-white/80 break-all min-w-0"
            : "text-white/90 break-words min-w-0"
        }
      >
        {value}
      </p>
    </div>
  )
}
