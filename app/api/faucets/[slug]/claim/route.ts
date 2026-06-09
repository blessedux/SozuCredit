import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/auth/resolve-user";
import {
  computeFaucetAvailability,
  createPendingClaim,
  finalizeClaim,
  getFaucetBySlug,
} from "@/lib/db/faucets";
import { sendFaucetPayment } from "@/lib/faucet/send-payment";
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet";
import type { FaucetClaimResponse } from "@/lib/faucet/types";

export const dynamic = "force-dynamic";

function softHash(value: string | null): string | null {
  if (!value) return null;
  const salt = process.env.FAUCET_HASH_SALT ?? "sozu-faucet-v1";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

/** Per-claim amount in whole USDC: FAUCET_CLAIM_AMOUNT env override > faucet row. */
function resolveClaimAmount(faucetAmount: number): number {
  const raw = process.env.FAUCET_CLAIM_AMOUNT?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return faucetAmount;
}

/**
 * POST /api/faucets/[slug]/claim — claim testnet funds from a faucet.
 * Requires a logged-in wallet (Supabase cookie or x-user-id header).
 *
 * V1 rules (enforced in computeFaucetAvailability):
 *   - faucet active
 *   - daily budget not exceeded
 *   - global faucet cooldown passed
 *   - wallet/user has not claimed in the last 24h
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await resolveUserId(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const { slug } = await params;

  try {
    const faucet = await getFaucetBySlug(slug);
    if (!faucet) {
      return NextResponse.json({ error: "Faucet not found" }, { status: 404 });
    }

    const wallet = await getStellarWallet(userId, true).catch(() => null);
    const walletAddress = wallet?.publicKey?.trim().toUpperCase() ?? null;
    if (!walletAddress) {
      const res: FaucetClaimResponse = {
        success: false,
        amount: faucet.claim_amount,
        error: "No Stellar wallet found for this account. Create a wallet first.",
        reason: "wallet_missing",
      };
      return NextResponse.json(res, { status: 422 });
    }

    const availability = await computeFaucetAvailability(faucet, {
      userId,
      walletAddress,
    });

    if (!availability.available) {
      const res: FaucetClaimResponse = {
        success: false,
        amount: faucet.claim_amount,
        nextAvailableAt: availability.nextAvailableAt,
        reason: availability.reason,
        error: "Faucet not available",
      };
      return NextResponse.json(res, { status: 409 });
    }

    const claimAmount = resolveClaimAmount(faucet.claim_amount);

    // Pending claim reserves budget/cooldown before touching the chain.
    const claim = await createPendingClaim({
      faucetId: faucet.id,
      userId,
      walletAddress,
      amount: claimAmount,
      ipHash: softHash(clientIp(request)),
      userAgentHash: softHash(request.headers.get("user-agent")),
    });

    try {
      const { txHash } = await sendFaucetPayment({
        toWalletAddress: walletAddress,
        amount: claimAmount,
        faucetSlug: faucet.slug,
      });

      await finalizeClaim({ claimId: claim.id, status: "success", txHash });

      const res: FaucetClaimResponse = {
        success: true,
        amount: claimAmount,
        txHash,
      };
      return NextResponse.json(res);
    } catch (payErr) {
      console.error("[POST /api/faucets/[slug]/claim] payment", payErr);
      // Failed claims do not consume budget or cooldowns.
      await finalizeClaim({ claimId: claim.id, status: "failed" }).catch((e) =>
        console.error("[POST /api/faucets/[slug]/claim] finalize", e),
      );
      const res: FaucetClaimResponse = {
        success: false,
        amount: faucet.claim_amount,
        error: "Transfer could not be completed. Try again in a moment.",
        reason: "payment_failed",
      };
      return NextResponse.json(res, { status: 502 });
    }
  } catch (err) {
    console.error("[POST /api/faucets/[slug]/claim]", err);
    return NextResponse.json({ error: "Failed to process claim" }, { status: 500 });
  }
}
