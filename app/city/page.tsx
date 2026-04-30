import { CityMap } from "./city-map";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Urban Treasure | Sozu",
  description: "Find and redeem treasures at spots in your city.",
};

export default function CityPage() {
  return (
    <div className="dark flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">City</h1>
      </header>
      <main className="min-h-0 flex flex-1 flex-col p-4">
        <CityMap />
      </main>
    </div>
  );
}
