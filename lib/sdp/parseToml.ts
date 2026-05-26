/**
 * Minimal stellar.toml (SEP-0001) field extraction for SDP integration.
 * Handles QUOTED_VALUE = "..." lines; sufficient for SIGNING_KEY, WEB_AUTH_ENDPOINT, etc.
 */
export function parseStellarTomlFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lineRe = /^\s*([A-Z0-9_]+)\s*=\s*"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/i;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (m) {
      const key = m[1];
      const value = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      out[key] = value;
    }
  }
  return out;
}
