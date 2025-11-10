import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get current trust points
    const { data: trustPoints, error: fetchError } = await supabase
      .from("trust_points")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (fetchError || !trustPoints) {
      return NextResponse.json({ error: "Trust points not found" }, { status: 404 })
    }

    // Check if 24 hours have passed
    const lastCredit = new Date(trustPoints.last_daily_credit)
    const now = new Date()
    const hoursSinceLastCredit = (now.getTime() - lastCredit.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastCredit < 24) {
      return NextResponse.json(
        { error: "You can only claim daily points once every 24 hours", hoursRemaining: 24 - hoursSinceLastCredit },
        { status: 400 },
      )
    }

    // NOTE: Daily trust points are disabled - users only get points from referrals
    // This endpoint is kept for backward compatibility but returns an error
    return NextResponse.json(
      { 
        error: "Daily trust points are no longer available. Get points by referring new users!",
        message: "Trust points are now only earned through referrals. Share your referral code to earn points when others sign up."
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error claiming daily trust points:", error)
    return NextResponse.json({ error: "Failed to claim daily trust points" }, { status: 500 })
  }
}
