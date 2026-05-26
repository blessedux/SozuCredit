/**
 * Query encoding compatible with Go's net/url Values.Encode (sorted keys),
 * used to verify SDP registration URLs per stellar-disbursement-platform-backend
 * internal/utils/url.go VerifySignedURL.
 */
export function encodeQuerySorted(searchParams: URLSearchParams): string {
  const byKey = new Map<string, string[]>();
  for (const key of searchParams.keys()) {
    if (!byKey.has(key)) {
      byKey.set(key, searchParams.getAll(key));
    }
  }
  const keys = [...byKey.keys()].sort();
  const parts: string[] = [];
  for (const k of keys) {
    for (const v of byKey.get(k) ?? []) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join("&");
}
