import { createClient } from "@/lib/supabase/server"

/** Supabase session or dev/passkey `x-user-id` header — same pattern as balance routes. */
export async function resolveWalletUserId(
  request: Request,
): Promise<{ userId: string; via: "session" | "header" } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    return { userId: user.id, via: "session" }
  }

  const headerUserId = request.headers.get("x-user-id")?.trim()
  if (headerUserId) {
    return { userId: headerUserId, via: "header" }
  }

  return null
}
