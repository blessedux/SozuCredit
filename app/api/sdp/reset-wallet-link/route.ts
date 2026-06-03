import { NextResponse } from "next/server";
import { resetSdpWalletLinkSession } from "@/lib/sdp/resetRegistrationSession";

/** POST — clear SEP-10/SEP-24 JWT cookies and invite sep24 progress (account switch). */
export async function POST() {
  const result = await resetSdpWalletLinkSession();
  return NextResponse.json(result);
}
