/**
 * Web haptics for the faucet ritual — Vibration API where supported,
 * iOS switch-trick fallback everywhere else. Call tap/success from onClick
 * (user gesture); claimingPulse may run on an interval during transfer.
 */

import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse";

function vibrate(pattern: number | number[]): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      return navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Claim button press — medium impact. */
export function hapticClaimPress(): void {
  if (!vibrate(40)) iosHapticSingle();
}

/** Soft pulse while the transfer is in flight (~every 500ms). */
export function hapticClaimingPulse(): void {
  if (!vibrate(12)) iosHapticSingle();
}

/** Success: dum … dum dum */
export function hapticClaimSuccess(): void {
  if (!vibrate([60, 220, 30, 90, 30])) {
    iosHapticSingle();
    setTimeout(() => iosHapticSingle(), 280);
    setTimeout(() => iosHapticSingle(), 400);
  }
}

/** Error / retry — short double tap. */
export function hapticClaimError(): void {
  if (!vibrate([30, 60, 30])) iosHapticSingle();
}
