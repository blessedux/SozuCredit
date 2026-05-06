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
