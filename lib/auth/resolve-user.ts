import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Resolves the authenticated user ID from Supabase session or x-user-id header
 * (passkey/dev flow). Returns the userId string, or a NextResponse 401 to return early.
 */
export async function resolveUserId(
  request: Request,
): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.id) return { userId: user.id };

  const headerUserId = request.headers.get("x-user-id")?.trim();
  if (headerUserId) return { userId: headerUserId };

  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
