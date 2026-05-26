/**
 * SSRF protection: only fetch stellar.toml from operator-approved SDP hosts.
 */
export function parseSdpAllowedDomains(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSdpHostAllowed(host: string, allowed: string[]): boolean {
  const h = host.trim().toLowerCase();
  if (!h || allowed.length === 0) return false;
  return allowed.includes(h);
}
