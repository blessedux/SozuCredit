import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { CreditEligibilitySnapshot, CreditStatus, UserCreditRecord } from "@/lib/credit/types"
import { getMicrocreditProgram } from "@/lib/credit/programs"

function mapBusinessStatus(status: string): CreditStatus {
  switch (status) {
    case "approved":
      return "approved"
    case "funded":
      return "active"
    case "rejected":
      return "rejected"
    default:
      return "pending"
  }
}

async function resolveUserId(request: Request): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.id) return user.id
  return request.headers.get("x-user-id")
}

async function fetchEligibility(userId: string): Promise<CreditEligibilitySnapshot> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseServiceKey && supabaseUrl) {
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: trustPoints } = await serviceClient
      .from("trust_points")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle()

    const { data: trustworthyCountData } = await serviceClient.rpc(
      "get_trustworthy_vouches_count",
      { user_uuid: userId },
    )

    const trustworthyVouchesCount = trustworthyCountData || 0
    const totalTrustPoints = trustPoints?.balance || 0
    const eligible = trustworthyVouchesCount >= 5

    return {
      eligible,
      trustworthyVouchesCount,
      totalTrustPoints,
      reason: eligible
        ? null
        : `Necesitas al menos 5 puntos de confianza recibidos de usuarios confiables para solicitar un crédito. Tienes ${trustworthyVouchesCount} punto(s) confiable(s) de ${totalTrustPoints} punto(s) total(es).`,
    }
  }

  const supabase = await createClient()
  const { data: trustPoints } = await supabase
    .from("trust_points")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle()

  const { data: trustworthyCountData } = await supabase.rpc("get_trustworthy_vouches_count", {
    user_uuid: userId,
  })

  const trustworthyVouchesCount = trustworthyCountData || 0
  const totalTrustPoints = trustPoints?.balance || 0
  const eligible = trustworthyVouchesCount >= 5

  return {
    eligible,
    trustworthyVouchesCount,
    totalTrustPoints,
    reason: eligible
      ? null
      : `Necesitas al menos 5 puntos de confianza recibidos de usuarios confiables para solicitar un crédito. Tienes ${trustworthyVouchesCount} punto(s) confiable(s) de ${totalTrustPoints} punto(s) total(es).`,
  }
}

async function fetchLegacyBusinessCredits(userId: string): Promise<UserCreditRecord[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return []

  const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { data, error } = await serviceClient
    .from("business_ideas")
    .select("id, title, funding_goal, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error || !data?.length) return []

  return data.map((row) => ({
    id: String(row.id),
    programId: "legacy" as const,
    programName: row.title ?? "Microcrédito",
    amount: Number(row.funding_goal) || 0,
    currency: "USD",
    status: mapBusinessStatus(String(row.status ?? "pending")),
    appliedAt: row.created_at ?? new Date().toISOString(),
  }))
}

export async function GET(request: Request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [eligibility, legacyCredits] = await Promise.all([
      fetchEligibility(userId),
      fetchLegacyBusinessCredits(userId),
    ])

    return NextResponse.json({
      credits: legacyCredits,
      eligibility,
    })
  } catch (error) {
    console.error("[Credits API] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { programId?: string }
    if (body.programId !== "mujeres2000") {
      return NextResponse.json({ error: "Program not available" }, { status: 400 })
    }

    const program = getMicrocreditProgram("mujeres2000")
    if (!program?.available) {
      return NextResponse.json({ error: "Program not available" }, { status: 400 })
    }

    const record: UserCreditRecord = {
      id: `app_mujeres2000_${Date.now()}`,
      programId: "mujeres2000",
      programName: "Mujeres $2.000",
      amount: program.amount,
      currency: program.currency,
      status: "pending",
      appliedAt: new Date().toISOString(),
      termDays: program.termDays,
    }

    return NextResponse.json({
      credit: record,
      storedClientSide: true,
    })
  } catch (error) {
    console.error("[Credits API] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
