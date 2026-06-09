import { NextResponse } from "next/server";
import { depositsEnabled } from "@/lib/app-config";
import { clpToUsdcMinor, formatUsdcMinor, getDepositFxRateAsync } from "@/lib/deposits/quote";

export const dynamic = "force-dynamic";

/**
 * GET /api/deposits/fx?amountClp=50000
 * Public quote preview for the deposit UI (no auth required).
 */
export async function GET(request: Request) {
  if (!depositsEnabled) {
    return NextResponse.json({ error: "Deposits not available on this deployment" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawAmount = url.searchParams.get("amountClp") ?? url.searchParams.get("amount_clp");
  const amountClp = rawAmount ? parseInt(rawAmount, 10) : null;

  try {
    const fx = await getDepositFxRateAsync();
    const body: Record<string, unknown> = {
      fx_clp_per_usdc: fx.rate,
      spot_clp_per_usdc: fx.spotClpPerUsdc,
      spread_bps: fx.spreadBps,
      source: fx.source,
      fetched_at: fx.fetchedAt,
    };

    if (amountClp != null && Number.isInteger(amountClp) && amountClp > 0) {
      const minor = clpToUsdcMinor(amountClp, fx.rate);
      body.amount_clp = amountClp;
      body.quoted_usdc_minor = minor;
      body.usdc_amount = formatUsdcMinor(minor);
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    console.error("[GET /api/deposits/fx]", err);
    return NextResponse.json({ error: "FX quote unavailable" }, { status: 503 });
  }
}
