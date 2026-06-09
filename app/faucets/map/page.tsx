import type { Metadata } from "next";
import { FaucetMap } from "@/components/faucet/faucet-map";

export const metadata: Metadata = {
  title: "Fuentes activas — Sozu",
  description: "Explora la ciudad y descubre dónde fluye el dinero digital.",
};

export default function FaucetsMapPage() {
  return <FaucetMap />;
}
