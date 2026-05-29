export function formatFiatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency === "USDC" ? "USD" : currency,
      maximumFractionDigits: currency === "CLP" || currency === "ARS" ? 0 : 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

/** Local fiat amount without currency symbol — for the primary balance display. */
export function formatReferenceAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CL", {
      maximumFractionDigits: currency === "CLP" || currency === "ARS" ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    return value.toFixed(currency === "CLP" || currency === "ARS" ? 0 : 2)
  }
}
