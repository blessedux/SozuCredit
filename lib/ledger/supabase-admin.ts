import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export type ApiUserContext = {
  userId: string
  db: SupabaseClient
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** GoTrue / undici transient failures seen often on flaky networks (ECONNRESET, etc.). */
function isTransientAuthNetworkFailure(err: unknown): boolean {
  const walk = (e: unknown): string => {
    if (e == null) return ""
    if (typeof e === "string") return e
    if (e instanceof Error) {
      return `${e.message}\n${walk((e as Error & { cause?: unknown }).cause)}`
    }
    if (typeof e === "object" && "code" in e) {
      return `${String((e as { code?: unknown }).code)} ${walk((e as { cause?: unknown }).cause)}`
    }
    return String(e)
  }
  const blob = walk(err).toLowerCase()
  return (
    /econnreset|etimedout|econnrefused|epipe|socket hang up|fetch failed|networkerror|failed to fetch|connect.?timeout|und_err_connect/.test(
      blob
    )
  )
}

type GetUserOutcome =
  | { kind: "user"; userId: string }
  | { kind: "anon" }
  | { kind: "transient_fail" }

async function getUserOutcomeWithRetries(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<GetUserOutcome> {
  const maxAttempts = 2
  let outcome: GetUserOutcome | undefined

  for (let attempt = 0; attempt < maxAttempts && outcome === undefined; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        if (isTransientAuthNetworkFailure(error) && attempt < maxAttempts - 1) {
          await delay(150 * (attempt + 1) ** 2)
          continue
        }
        outcome = isTransientAuthNetworkFailure(error) ? { kind: "transient_fail" } : { kind: "anon" }
        break
      }
      const id = data.user?.id?.trim()
      outcome = id ? { kind: "user", userId: id } : { kind: "anon" }
    } catch (e) {
      if (isTransientAuthNetworkFailure(e) && attempt < maxAttempts - 1) {
        await delay(150 * (attempt + 1) ** 2)
        continue
      }
      if (isTransientAuthNetworkFailure(e)) {
        outcome = { kind: "transient_fail" }
        break
      }
      throw e
    }
  }

  return outcome ?? { kind: "transient_fail" }
}

/**
 * Resolves the acting user from Supabase session or `x-user-id` (dev).
 * Prefers the service role client when available so dev headers work under RLS.
 *
 * Uses `getSession()` first (cookie/JWT, no GoTrue round-trip) so ledger API routes stay fast.
 * Falls back to `getUser()` with retries only when there is no session — avoids multi-second
 * connect timeouts on every save when Supabase Auth is slow or flaky.
 *
 * In **development only**, if GoTrue keeps failing but `x-user-id` is set and the service role key
 * exists, we still resolve the user id from the header so local ledger edits keep working.
 */
export async function getApiUserClient(request: Request): Promise<ApiUserContext | null> {
  const supabase = await createClient()
  const devId = request.headers.get("x-user-id")?.trim() || null
  const devHeaderFallback =
    process.env.NODE_ENV === "development" &&
    Boolean(devId) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  let userId: string | null = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const fromSession = session?.user?.id?.trim() ?? null
    if (fromSession) {
      userId = fromSession
    } else {
      const outcome = await getUserOutcomeWithRetries(supabase)
      if (outcome.kind === "user") {
        userId = outcome.userId
      } else if (outcome.kind === "anon") {
        userId = devId
      } else if (outcome.kind === "transient_fail" && devHeaderFallback) {
        console.warn("[getApiUserClient] auth.getUser failed after retries; using x-user-id (dev only)")
        userId = devId
      }
    }
  } catch (e) {
    if (devHeaderFallback) {
      console.warn("[getApiUserClient] auth.getSession/getUser threw; using x-user-id (dev only)", e)
      userId = devId
    } else {
      throw e
    }
  }

  if (!userId) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (serviceKey && url) {
    return {
      userId,
      db: createServiceClient(url, serviceKey),
    }
  }

  return { userId, db: supabase }
}
