"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

type Spot = {
  name: string;
  address?: string;
};

export function RedeemView({ spot }: { spot: Spot }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-black">
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4 z-20 text-white hover:bg-white/10 hover:text-white"
        asChild
      >
        <Link href="/city" aria-label="Volver al mapa">
          <ChevronLeft className="size-5" />
        </Link>
      </Button>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center justify-center">
          <SpiralAnimation
            totalDots={600}
            size={320}
            dotRadius={2}
            margin={2}
            duration={3}
            dotColor="#fff"
            backgroundColor="transparent"
            className="flex items-center justify-center"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-center text-lg font-medium tracking-wide text-white">
              Ready to scan NFC tag
            </p>
            <p className="text-center text-sm text-white/70">{spot.name}</p>
            {spot.address && (
              <p className="max-w-[260px] text-center text-xs text-white/50">
                {spot.address}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
