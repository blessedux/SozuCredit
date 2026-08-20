/** Map a pay.sozu.capital /pay/qr/{slug} return_to onto wallet store checkout. */
export function pizzaCheckoutPathFromPayReturn(returnTo: string): string | null {
  try {
    const url = new URL(returnTo)
    const match = url.pathname.match(/^\/pay\/qr\/([^/]+)$/)
    const slug = match?.[1]?.trim().toLowerCase() ?? ""
    if (!slug || !/^[a-z0-9_-]+$/.test(slug)) return null
    return `/checkout/pizza/${slug}`
  } catch {
    return null
  }
}
