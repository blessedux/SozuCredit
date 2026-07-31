# Tool 09 — AI-driven development

Architect the repo so the agent's default behavior is already correct. Reviewing good output beats correcting bad output.

## Highest leverage: `AGENTS.md`

Passive context agents read automatically. Vercel evals: a solid ~8KB `AGENTS.md` beat installed skills on Next API accuracy; agents often never invoke skills. Put frequent conventions in `AGENTS.md`; reserve skills for multi-step workflows.

Skeleton:

```markdown
# AGENTS.md

## Stack
Next.js (App Router, Cache Components), React, TypeScript strict, Tailwind v4, Zod.

## Conventions
- Server Components by default; `'use client'` only for state/effects/browser APIs.
- Server Actions verify auth internally — never middleware alone.
- `use cache` + `cacheTag`; `revalidateTag` from mutating Action.
- Zod-validate external data; `z.infer` for types.

## Do not touch
- `lib/auth/*` — explicit review required
- `next.config.ts` cache settings — discuss first

## Commands
- `pnpm dev` / `pnpm test` / `pnpm lint`
```

Encode **team taste** (banned libs, Action naming, error shapes) — not just public API docs.

## Skills ecosystem

`npx skills add <package>` via skills.sh. Relevant: `vercel-react-best-practices`, `vercel-composition-patterns`, `next-best-practices`, `next-cache-components`, `deploy-to-vercel`, `turborepo`, `ai-sdk`, `tailwind-design-system`.

Vet like npm: install counts, reputable org (`vercel-labs`, etc.), active repo. Skills can execute code.

## Verify loop

When `agent-browser` / dev MCP available: edit → reload → check console/tree → iterate. Instruct agents in `AGENTS.md` to verify runtime, not just claim success from a plausible diff.

## Review habit

Treat agent PRs like human PRs. Watch for reinterpreted ambiguous instructions, over-engineering, and files outside the asked scope.
