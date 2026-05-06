---
name: ledger-merchant-categorization
description: >-
  SozuCredit email-ledger merchant naming heuristics for LLM classification and
  code changes. Use when categorizing transactions, editing openrouter-classify,
  builtin category hints, or Gmail sync parsing for merchant-heavy receipts.
---

# Ledger merchant categorization (SozuCredit)

When working on ledger classification, Gmail sync, or OpenRouter prompts:

1. Read the canonical rules in **`lib/ledger/merchant-categorization-llm-rules.md`** and keep runtime prompts aligned with that file when you change behavior.
2. Runtime injection: `lib/ledger/openrouter-classify.ts` loads that markdown (via `loadMerchantCategorizationLlmRulesFromDisk`) into the user prompt when present.

Do not drift from those rules without updating the markdown file first.
