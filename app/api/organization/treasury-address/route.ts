import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "Missing organizationId parameter" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch organization's treasury smart account address
    const { data: org, error } = await supabase
      .from("organizations")
      .select("treasury_smart_account_address")
      .eq("id", organizationId)
      .single();

    if (error || !org) {
      console.error("[Organization Treasury Address] Error fetching organization:", error);
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (!org.treasury_smart_account_address) {
      return NextResponse.json(
        { error: "Organization does not have a treasury smart account address configured" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      treasurySmartAccountAddress: org.treasury_smart_account_address,
    });
  } catch (err) {
    console.error("[Organization Treasury Address] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
