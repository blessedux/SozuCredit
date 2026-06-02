import { SdpRegisterFlow } from "@/components/SdpRegisterFlow";

export const metadata = { title: "Recibir tu pago" };

export default function SdpRegisterPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-transparent text-white">
      <header className="border-b border-white/10 bg-black/50 px-6 py-4 backdrop-blur-xl backdrop-saturate-150">
        <span className="text-sm font-semibold tracking-tight text-white/80">
          Registro de pago
        </span>
      </header>
      <main className="flex-1 px-4 pb-16">
        <SdpRegisterFlow />
      </main>
    </div>
  );
}
