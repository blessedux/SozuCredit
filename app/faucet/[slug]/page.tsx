import type { Metadata } from "next";
import { FaucetClaimExperience } from "@/components/faucet/faucet-claim-experience";

export const metadata: Metadata = {
  title: "Sozu Faucet",
  description: "Toca la esfera. Recibe valor.",
};

/** NFC entry point: the NTAG215 tag stores https://app.sozu.capital/faucet/<slug>. */
export default async function FaucetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <FaucetClaimExperience slug={slug} />;
}
