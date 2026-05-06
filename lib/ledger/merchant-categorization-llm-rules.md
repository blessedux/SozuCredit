# Ledger merchant naming (LLM + agents)

Use **merchant_or_title** together with subject, snippet, body, and sender. Card networks often put the real business name only in the merchant field.

## Default to **food** (eating out, drinks, snacks, small shop)

- **Café / coffee / bakery**: Names or text suggest café, cafe, coffee, espresso, barista, roaster, tea, panadería, panaderia, bakery, pastelería, pasteleria, confitería, confiteria → **food** unless the email is clearly B2B wholesale or unrelated to a personal purchase.
- **Minimarket / corner store**: `minimarket`, `mini market`, `minimercado`, `mini mercado`, `minimarkt`, small **almacén** (snacks/bevs/treat run, not a weekly supermarket shop) → **food** by default. If the string looks like a typo for minimarket (e.g. **minimaker** on a LatAm receipt) and context is a small local store, still treat as **food**.

## **groceries** vs **food**

- Large supermarket / weekly shop chains (e.g. Jumbo, Líder, Tottus, Unimarc, Walmart, Cencosud-style hypermarket wording) → **groceries** when that is the clear merchant.
- Corner minimarket / kiosk / small almacén charge → **food** unless the receipt explicitly reads like a full grocery chain.

## Priority

1. User-defined merchant rules (when they clearly match).
2. Curated substring hints that fit the purchase.
3. These merchant-name conventions when the purchase is still ambiguous.

If the message is not a real financial movement, set `is_financial_transaction` to false regardless of merchant name.

## Currency (Chile receipts — Mach, Banco de Chile, Santander, Mercado Pago Chile, etc.)

- **Denomination is almost always CLP** for Chile-issued bank and wallet emails (Mach, Banco de Chile, BCI, Santander Chile, BancoEstado, Scotiabank Chile, Mercado Pago Chile, Tenpo, retail cards like CMR, `.cl` senders, “comprobante de pago” with “Detalle Comercio”, etc.).
- The **peso sign `$` does not mean US dollars** on these emails. Amounts like **`22.000`** or **`$ 22.000`** without “USD” are **thousands of pesos** (dot = thousands separator), not decimal dollars.
- Treat as **USD (or other FX) only** when the message clearly ties the amount to **USD / US$** (e.g. suffix “USD”, explicit “US$”, international wire wording), not from a stray “USD” in footer text alone.
- Runtime heuristics in `lib/gmail/parse-heuristic.ts` (`chileFinancialEmailContext`, peso vs USD branching) should stay aligned with this.
