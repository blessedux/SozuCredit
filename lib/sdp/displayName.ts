/** Decode organization name from SDP invite query (`name=Stellar+Test`). */
export function decodeSdpOrganizationName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed.replace(/\+/g, " ")).trim();
  } catch {
    return trimmed.replace(/\+/g, " ").trim();
  }
}
