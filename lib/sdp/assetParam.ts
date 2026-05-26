/**
 * SDP registration links use asset "native" or "CODE-ISSUER" (see WalletDeepLink.assetName() in SDP backend).
 */
export function parseSdpAssetParam(asset: string): {
  code: string;
  issuer: string | null;
} {
  const t = asset.trim();
  if (!t || t === "native") {
    return { code: "XLM", issuer: null };
  }
  const idx = t.indexOf("-");
  if (idx <= 0) {
    return { code: t.toUpperCase(), issuer: null };
  }
  const code = t.slice(0, idx).trim();
  const issuer = t.slice(idx + 1).trim();
  if (!issuer) {
    return { code: code.toUpperCase(), issuer: null };
  }
  return { code: code.toUpperCase(), issuer };
}
