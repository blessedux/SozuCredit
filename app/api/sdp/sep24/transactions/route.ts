import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";
import { fetchSep24Transactions } from "@/lib/sdp/sep24Server";

export async function GET() {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const jwt = await getSdpSep10JwtCookie();
  if (!jwt) {
    return NextResponse.json(
      { error: "SEP-10 session expired." },
      { status: 401 }
    );
  }

  const { invite } = ctx;
  const result = await fetchSep24Transactions({ sep24Base: invite.sep24Base, jwt });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ transactions: result.transactions });
}
