import { SdpRegisterFlow } from "@/components/SdpRegisterFlow";

export const metadata = { title: "Claim your payment · Sozu" };

export default function SdpRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-white">Sozu Credit</span>
      </header>
      <main className="flex-1 px-4 pb-16">
        <SdpRegisterFlow />
      </main>
    </div>
  );
}
