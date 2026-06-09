/** True when running as an installed PWA (standalone / fullscreen). */
export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  // iOS Safari legacy flag
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export const PWA_INSTALLED_KEY = "sozu_pwa_installed:v1";

export function markPwaInstalled(): void {
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, "true");
  } catch {
    /* private browsing */
  }
}

export function wasPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}
