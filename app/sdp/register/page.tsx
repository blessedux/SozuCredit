import Link from "next/link";
import { SdpRegisterFlow } from "@/components/SdpRegisterFlow";

export default function SdpRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Sozu Credit · Disbursement</span>
        <Link href="/wallet" className="text-sm text-gray-400 hover:text-white">
          Wallet
        </Link>
      </header>
      <main className="p-6 max-w-3xl mx-auto">
        <SdpRegisterFlow />
      </main>
    </div>
  );
}
