export function CheckoutAmountHeader({
  merchantName,
  amountUsd,
  amountDisplay,
  assetLabel = "USD",
  reference,
  destinationAddress,
}: {
  merchantName: string;
  amountUsd?: string;
  amountDisplay?: string;
  assetLabel?: string;
  reference?: string | null;
  destinationAddress?: string;
}) {
  const display = amountDisplay ?? (amountUsd != null ? `$${amountUsd}` : "");
  return (
    <div className="text-center">
      <div className="mb-2 text-sm text-white/60">Pay</div>
      <h1 className="mb-4 text-2xl font-bold">{merchantName}</h1>
      <div className="mb-2 text-5xl font-bold tabular-nums">{display}</div>
      <div className="text-lg text-white/60">{assetLabel}</div>
      {destinationAddress && (
        <div className="mt-2 text-xs text-white/40 font-mono">
          To: {destinationAddress.slice(0, 8)}...{destinationAddress.slice(-4)}
        </div>
      )}
      {reference && (
        <div className="mt-4 text-sm text-white/40">Ref: {reference}</div>
      )}
    </div>
  );
}
