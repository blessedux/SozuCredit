/** Gmail search query: last 90d + finance keywords + common Chile senders (sync walks pages until max messages). */
export const GMAIL_SYNC_LIST_QUERY =
  "newer_than:90d " +
  "(" +
  "(" +
  "boleta OR factura OR recibo OR comprobante OR pago OR transferencia OR compra " +
  "OR depósito OR deposito OR ingreso OR acreditación OR acreditado OR abono " +
  "OR remuneración OR remuneraciones OR nómina OR nomina OR haberes OR liquidación OR liquidacion " +
  "OR \"transferencia recibida\" OR \"transferencia entrante\"" +
  ") " +
  "OR " +
  "(from:mercadopago OR from:mercadolibre OR from:mach OR from:banco OR from:flow OR from:transbank)" +
  ")"
