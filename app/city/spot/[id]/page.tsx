import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RedeemView } from "./redeem-view";

// Partner spots in Santiago (from API/DB in production; coordinates from geocoding)
const SPOTS: Record<
  string,
  { name: string; description?: string; rewardLabel?: string; address?: string }
> = {
  "1": {
    name: "Pandevilla",
    description: "Canjea tu tesoro en Pandevilla.",
    rewardLabel: "Pandevilla",
    address: "París 834, Santiago, Chile",
  },
  "2": {
    name: "Swe Store",
    description: "Canjea tu tesoro en Swe Store.",
    rewardLabel: "Swe Store",
    address: "Agustinas 651, 8320195 Santiago",
  },
  "3": {
    name: "Casawork",
    description: "Canjea tu tesoro en Casawork.",
    rewardLabel: "Casawork",
    address: "Villavicencio 395, 8320129 Santiago, Región Metropolitana",
  },
  "4": {
    name: "Charlie Wok",
    description: "Canjea tu tesoro en Charlie Wok.",
    rewardLabel: "Charlie Wok",
    address: "Bellavista 419, 8420488 Recoleta, Región Metropolitana",
  },
};

export default async function SpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = SPOTS[id];

  if (!spot) {
    return (
      <div className="flex min-h-screen flex-col bg-background p-4">
        <header className="flex items-center gap-2 pb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/city" aria-label="Back to city">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Spot not found</h1>
        </header>
        <p className="text-muted-foreground">This treasure spot does not exist.</p>
        <Button asChild className="mt-4">
          <Link href="/city">Back to City</Link>
        </Button>
      </div>
    );
  }

  return <RedeemView spot={{ name: spot.name, address: spot.address }} />;
}
