"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, MapPin, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const CITY_EXPLAINER_KEY = "sozu_city_explainer_seen";

// Santiago, Chile (default city)
const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4489];
const DEFAULT_ZOOM = 13;

export type TreasureSpot = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  description?: string;
  rewardLabel?: string;
  redeemed?: boolean;
};

// Treasure spots: partner stores in Santiago (coordinates from geocoding)
// París 834 → Nominatim; Agustinas/Villavicencio/Bellavista → geocoding + references
const DEFAULT_SPOTS: TreasureSpot[] = [
  {
    id: "1",
    name: "Pandevilla",
    longitude: -70.6481253,
    latitude: -33.4446721,
    description: "París 834, Santiago, Chile. Canjea tu tesoro aquí.",
    rewardLabel: "Pandevilla",
  },
  {
    id: "2",
    name: "Swe Store",
    longitude: -70.6512,
    latitude: -33.4419,
    description: "Agustinas 651, 8320195 Santiago. Canjea tu tesoro aquí.",
    rewardLabel: "Swe Store",
  },
  {
    id: "3",
    name: "Casawork",
    longitude: -70.6408018,
    latitude: -33.4380742,
    description: "Villavicencio 395, 8320129 Santiago, Región Metropolitana.",
    rewardLabel: "Casawork",
  },
  {
    id: "4",
    name: "Charlie Wok",
    longitude: -70.6454365,
    latitude: -33.4326041,
    description: "Bellavista 419, 8420488 Recoleta, Región Metropolitana.",
    rewardLabel: "Charlie Wok",
  },
];

export function CityMap() {
  const [showExplainer, setShowExplainer] = useState(false);
  const [center, setCenter] = useState<[number, number]>(SANTIAGO_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [userLocation, setUserLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [spots] = useState<TreasureSpot[]>(DEFAULT_SPOTS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(CITY_EXPLAINER_KEY) === "true";
    if (!seen) setShowExplainer(true);
  }, []);

  const closeExplainer = useCallback(() => {
    setShowExplainer(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(CITY_EXPLAINER_KEY, "true");
    }
  }, []);

  const handleLocate = useCallback(
    (coords: { longitude: number; latitude: number }) => {
      setUserLocation({ lng: coords.longitude, lat: coords.latitude });
      setCenter([coords.longitude, coords.latitude]);
      setZoom(14);
    },
    []
  );

  const tryUseMyLocation = useCallback(() => {
    setLocationLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
          };
          handleLocate(coords);
          setLocationLoading(false);
        },
        () => {
          setLocationLoading(false);
          // Keep Santiago on error
        }
      );
    } else {
      setLocationLoading(false);
    }
  }, [handleLocate]);

  // Optionally center on user location on mount (with permission)
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
          });
          // Option: auto-center on user. For now we keep Santiago as initial view.
          // setCenter([pos.coords.longitude, pos.coords.latitude]);
          // setZoom(14);
        },
        () => {}
      );
    }
  }, []);

  return (
    <div className="flex min-h-0 h-full w-full flex-col">
      <Dialog open={showExplainer} onOpenChange={(open) => !open && closeExplainer()}>
        <DialogContent
          className="dark border-border bg-card text-card-foreground max-w-sm text-center sm:max-w-md"
          showCloseButton={true}
        >
          <DialogHeader>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border-2 border-amber-500/80 bg-amber-500/20">
              <Gift className="size-7 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Tesoro Urbano</DialogTitle>
            <DialogDescription className="mt-2 text-muted-foreground">
              Usa tu billetera para canjear tesoros en la vida real en locales participantes.
            </DialogDescription>
            <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4 shrink-0 mt-0.5 text-amber-500/80" />
              <span>
                Encuentra los puntos en el mapa, acércate al local y canjea tu recompensa con tu billetera Sozu.
              </span>
            </div>
          </DialogHeader>
          <Button onClick={closeExplainer} className="mt-4 w-full">
            Comenzar
          </Button>
        </DialogContent>
      </Dialog>

      <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
          <h1 className="text-lg font-semibold">Urban Treasure</h1>
          <p className="text-xs text-muted-foreground">
            {userLocation
              ? "Showing your area"
              : "Santiago, Chile — tap Locate for your city"}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shadow-sm"
          onClick={tryUseMyLocation}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MapPin className="size-4" />
          )}
          <span className="hidden sm:inline">
            {userLocation ? "My location" : "Use my location"}
          </span>
        </Button>
      </div>

      <div className="relative min-h-0 w-full flex-1 rounded-lg overflow-hidden border bg-muted/30">
        <Map
          theme="dark"
          className={cn("absolute inset-0 h-full w-full rounded-lg")}
          styles={{
            dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
            light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          }}
          viewport={{ center, zoom }}
          onViewportChange={(vp) => {
            if (vp.center) setCenter(vp.center);
            if (vp.zoom != null) setZoom(vp.zoom);
          }}
        >
          <MapControls
            position="bottom-right"
            showZoom
            showLocate
            onLocate={handleLocate}
          />

          {spots.map((spot) => (
            <MapMarker
              key={spot.id}
              longitude={spot.longitude}
              latitude={spot.latitude}
            >
              <MarkerContent className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110",
                    spot.redeemed
                      ? "border-muted-foreground/50 bg-muted"
                      : "border-amber-500/80 bg-amber-500/20"
                  )}
                >
                  <Gift
                    className={cn(
                      "size-5",
                      spot.redeemed ? "text-muted-foreground" : "text-amber-600"
                    )}
                  />
                </div>
              </MarkerContent>
              <MarkerPopup closeButton className="min-w-[200px] p-0">
                <div className="p-3">
                  <h3 className="font-semibold">{spot.name}</h3>
                  {spot.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {spot.description}
                    </p>
                  )}
                  {spot.rewardLabel && !spot.redeemed && (
                    <p className="mt-2 text-sm font-medium text-amber-600">
                      {spot.rewardLabel}
                    </p>
                  )}
                  {spot.redeemed ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Already redeemed
                    </p>
                  ) : (
                    <Button asChild size="sm" className="mt-3 w-full">
                      <Link href={`/city/spot/${spot.id}`}>Redeem treasure</Link>
                    </Button>
                  )}
                </div>
              </MarkerPopup>
            </MapMarker>
          ))}
        </Map>
      </div>
    </div>
  );
}
