"use client";

/**
 * /faucets/map — dark city map where every faucet is an orb, not a pin.
 * Orb states: available (bright), cooldown (pulsing dim), empty (dormant),
 * inactive (hidden by the API — only active faucets are returned).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import { FaucetDepositSheet } from "@/components/faucet/faucet-deposit-sheet";
import { getFaucetTexts, readFaucetLanguage } from "@/lib/faucet/texts";
import { cn } from "@/lib/utils";
import type { FaucetMapEntry, OrbState } from "@/lib/faucet/types";

const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4489];
const DEFAULT_ZOOM = 13;

function markerState(entry: FaucetMapEntry): OrbState {
  if (entry.availability.available) return "available";
  switch (entry.availability.reason) {
    case "empty_today":
      return "empty";
    case "global_cooldown":
    case "user_cooldown":
      return "cooldown";
    default:
      return "inactive";
  }
}

/** Miniature orb used as a map marker. */
function OrbMarker({ state }: { state: OrbState }) {
  return (
    <div className="relative flex size-12 items-center justify-center">
      {state === "available" && (
        <div
          className="absolute size-12 animate-ping rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #fbbf24, transparent 70%)", animationDuration: "2.5s" }}
        />
      )}
      {state === "cooldown" && (
        <div
          className="absolute size-10 animate-pulse rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #d97706, transparent 70%)", animationDuration: "3s" }}
        />
      )}
      <div
        className={cn(
          "size-6 rounded-full transition-transform hover:scale-125",
          state === "available" &&
            "shadow-[0_0_18px_rgba(251,191,36,0.9),0_0_36px_rgba(249,115,22,0.5)]",
          state === "cooldown" && "shadow-[0_0_10px_rgba(217,119,6,0.4)]",
        )}
        style={{
          background:
            state === "available"
              ? "radial-gradient(circle at 35% 30%, #fffbeb 0%, #fcd34d 30%, #f97316 70%, #9a3412 100%)"
              : state === "cooldown"
                ? "radial-gradient(circle at 35% 30%, #fcd34d55 0%, #b4530999 50%, #451a03 100%)"
                : "radial-gradient(circle at 35% 30%, #92400e66 0%, #45230a 60%, #1c0d02 100%)",
          opacity: state === "empty" ? 0.55 : 1,
        }}
      />
    </div>
  );
}

export function FaucetMap() {
  const t = useMemo(() => getFaucetTexts(readFaucetLanguage()), []);
  const [entries, setEntries] = useState<FaucetMapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>(SANTIAGO_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [depositTarget, setDepositTarget] = useState<FaucetMapEntry | null>(null);

  const refresh = useCallback((recenter: boolean) => {
    return fetch("/api/faucets", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { faucets: FaucetMapEntry[] }) => {
        setEntries(data.faucets ?? []);
        if (recenter && data.faucets?.length) {
          setCenter([data.faucets[0]!.lng, data.faucets[0]!.lat]);
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh(true)
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleLocate = useCallback(
    (coords: { longitude: number; latitude: number }) => {
      setCenter([coords.longitude, coords.latitude]);
      setZoom(14);
    },
    [],
  );

  const stateLabel = (state: OrbState) =>
    state === "available"
      ? t.mapStateAvailable
      : state === "cooldown"
        ? t.mapStateCooldown
        : t.mapStateEmpty;

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="absolute left-4 right-4 top-4 z-10">
        <div className="rounded-2xl border border-amber-200/15 bg-black/80 px-4 py-3 backdrop-blur-xl">
          <h1 className="text-lg font-semibold text-amber-50">{t.mapHeader}</h1>
          <p className="text-xs leading-relaxed text-amber-100/60">{t.mapSubtext}</p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <Map
          theme="dark"
          className="absolute inset-0 h-full w-full"
          styles={{
            dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
            light: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          }}
          viewport={{ center, zoom }}
          onViewportChange={(vp) => {
            if (vp.center) setCenter(vp.center);
            if (vp.zoom != null) setZoom(vp.zoom);
          }}
        >
          <MapControls position="bottom-right" showZoom showLocate onLocate={handleLocate} />

          {entries.map((entry) => {
            const state = markerState(entry);
            return (
              <MapMarker key={entry.slug} longitude={entry.lng} latitude={entry.lat}>
                <MarkerContent>
                  <OrbMarker state={state} />
                </MarkerContent>
                <MarkerPopup closeButton className="min-w-[210px] p-0">
                  <div className="p-3">
                    <h3 className="font-semibold">{entry.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.locationName}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-sm font-medium",
                        state === "available" ? "text-amber-500" : "text-muted-foreground",
                      )}
                    >
                      {stateLabel(state)}
                    </p>
                    <Link
                      href={`/faucet/${entry.slug}`}
                      className="mt-3 block w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-center text-sm font-semibold text-black"
                    >
                      {t.mapOpenFaucet}
                    </Link>
                    {entry.depositAddress && (
                      <button
                        onClick={() => setDepositTarget(entry)}
                        className="mt-2 block w-full rounded-full border border-amber-500/40 px-4 py-2 text-center text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/10"
                      >
                        {t.depositCta}
                      </button>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="size-4 animate-pulse rounded-full bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.8)]" />
          </div>
        )}
      </div>

      {depositTarget?.depositAddress && (
        <FaucetDepositSheet
          open={!!depositTarget}
          onClose={() => setDepositTarget(null)}
          faucetName={depositTarget.name}
          vaultAddress={depositTarget.depositAddress}
          onDeposited={() => {
            refresh(false).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
