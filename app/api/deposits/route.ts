import { NextResponse } from "next/server";
import { depositsEnabled } from "@/lib/app-config";
import { resolveUserId } from "@/lib/auth/resolve-user";
import { clpToUsdcMinor, getDepositFxRateAsync } from "@/lib/deposits/quote";
import { getBankInstructions, generateBankReference } from "@/lib/deposits/bank-instructions";
import {
  attachSumUpCheckout,
  createDepositIntent,
  listDepositIntentsByUser,
  toPublic,
} from "@/lib/db/deposit-intents";
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet";
import { createHostedCheckout, sumUpConfigured } from "@/lib/sumup/client";
import type { CreateBankDepositResponse, CreateCardDepositResponse } from "@/lib/deposits/types";

export const dynamic = "force-dynamic";

function parseAmountClp(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return parseInt(raw, 10);
  return NaN;
}

async function resolveDestination(userId: string): Promise<string | null> {
  const wallet = await getStellarWallet(userId, true).catch(() => null);
  return wallet?.publicKey?.trim().toUpperCase() ?? null;
}

/** POST /api/deposits — create a new fiat deposit intent (bank transfer or card). */
export async function POST(request: Request) {
  if (!depositsEnabled) {
    return NextResponse.json({ error: "Deposits not available on this deployment" }, { status: 403 });
  }

  const auth = await resolveUserId(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const method = body.method;
  const amountClp = parseAmountClp(body.amountClp ?? body.amount_clp);

  if (method !== "bank_transfer" && method !== "card") {
    return NextResponse.json(
      { error: "method must be bank_transfer or card" },
      { status: 400 },
    );
  }

  if (!Number.isInteger(amountClp) || amountClp < 1000) {
    return NextResponse.json(
      { error: "amountClp must be an integer >= 1000 (minimum deposit)" },
      { status: 400 },
    );
  }

  const destAddress = await resolveDestination(userId);
  if (!destAddress) {
    return NextResponse.json(
      { error: "No Stellar wallet found for this account. Register a wallet first." },
      { status: 422 },
    );
  }

  let fxRate: number;
  let fxMeta: Record<string, unknown>;
  try {
    const fx = await getDepositFxRateAsync();
    fxRate = fx.rate;
    fxMeta = {
      fx_source: fx.source,
      fx_spot_clp_per_usdc: fx.spotClpPerUsdc,
      fx_spread_bps: fx.spreadBps,
      fx_fetched_at: fx.fetchedAt,
    };
  } catch (err) {
    console.error("[POST /api/deposits] FX", err);
    return NextResponse.json({ error: "FX quote unavailable" }, { status: 503 });
  }

  const quotedUsdcMinor = clpToUsdcMinor(amountClp, fxRate);
  if (quotedUsdcMinor <= 0) {
    return NextResponse.json({ error: "Amount too small to produce a valid USDC quote" }, { status: 400 });
  }

  if (method === "bank_transfer") {
    const bankReference = generateBankReference();
    const instructions = getBankInstructions(bankReference, amountClp, quotedUsdcMinor);
    if (!instructions) {
      return NextResponse.json(
        {
          error: "Bank transfer not configured on this server. Contact support.",
          hint: "Set SOZU_CLP_BANK_NAME, SOZU_CLP_BANK_ACCOUNT, SOZU_CLP_BANK_RUT, SOZU_CLP_BANK_EMAIL in env.",
        },
        { status: 503 },
      );
    }

    try {
      const intent = await createDepositIntent({
        userId,
        method: "bank_transfer",
        amountClp,
        quotedUsdcMinor,
        fxClpPerUsdc: fxRate,
        destinationStellarAddress: destAddress,
        bankReference,
        metadata: fxMeta,
      });

      const response: CreateBankDepositResponse = {
        intent: toPublic(intent),
        instructions,
      };
      return NextResponse.json(response, { status: 201 });
    } catch (err) {
      console.error("[POST /api/deposits] bank", err);
      return NextResponse.json({ error: "Failed to create deposit intent" }, { status: 500 });
    }
  }

  // --- card (SumUp hosted checkout) ---
  if (!sumUpConfigured()) {
    return NextResponse.json(
      {
        error: "Card payments not configured",
        hint: "Set SUMUP_API_KEY and SUMUP_MERCHANT_CODE on this deployment.",
      },
      { status: 503 },
    );
  }

  try {
    const intent = await createDepositIntent({
      userId,
      method: "card",
      amountClp,
      quotedUsdcMinor,
      fxClpPerUsdc: fxRate,
      destinationStellarAddress: destAddress,
      bankReference: null,
      metadata: { ...fxMeta, payment_provider: "sumup" },
    });

    const { checkoutId, hostedCheckoutUrl } = await createHostedCheckout({
      amountClp,
      checkoutReference: intent.id,
      description: `Sozu wallet deposit ${amountClp} CLP`,
      intentId: intent.id,
    });

    const updated = await attachSumUpCheckout(intent.id, userId, checkoutId, {
      sumup_hosted_checkout_url: hostedCheckoutUrl,
    });

    const response: CreateCardDepositResponse = {
      intent: toPublic(updated),
      checkout_url: hostedCheckoutUrl,
      sumup_checkout_id: checkoutId,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error("[POST /api/deposits] card", err);
    const message = err instanceof Error ? err.message : "Failed to create card checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/deposits — list the authenticated user's deposit intents. */
export async function GET(request: Request) {
  if (!depositsEnabled) {
    return NextResponse.json({ error: "Deposits not available on this deployment" }, { status: 403 });
  }

  const auth = await resolveUserId(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  try {
    const rows = await listDepositIntentsByUser(userId, limit, offset);
    return NextResponse.json({ deposits: rows.map(toPublic) });
  } catch (err) {
    console.error("[GET /api/deposits]", err);
    return NextResponse.json({ error: "Failed to list deposits" }, { status: 500 });
  }
}
