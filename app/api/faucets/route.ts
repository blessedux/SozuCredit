import { NextResponse } from "next/server";
import {
  computeFaucetAvailability,
  listActiveFaucets,
  toPublicFaucet,
} from "@/lib/db/faucets";
import type { FaucetMapEntry } from "@/lib/faucet/types";

export const dynamic = "force-dynamic";

/** Per-faucet vault, else the shared deployed faucet contract. */
function depositAddressFor(vaultAddress: string | null): string | null {
  const addr =
    vaultAddress?.trim().toUpperCase() ||
    process.env.FAUCET_CONTRACT_ID?.trim().toUpperCase() ||
    null;
  return addr?.startsWith("C") && addr.length === 56 ? addr : null;
}

/** GET /api/faucets — all active faucets with availability (map view). Public. */
export async function GET() {
  try {
    const faucets = await listActiveFaucets();
    const entries: FaucetMapEntry[] = await Promise.all(
      faucets.map(async (faucet) => ({
        ...toPublicFaucet(faucet),
        // No wallet/user context here: map shows faucet-level state only.
        availability: await computeFaucetAvailability(faucet),
        depositAddress: depositAddressFor(faucet.vault_address),
      })),
    );
    return NextResponse.json({ faucets: entries });
  } catch (err) {
    console.error("[GET /api/faucets]", err);
    return NextResponse.json({ error: "Failed to list faucets" }, { status: 500 });
  }
}
