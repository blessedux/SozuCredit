export function CheckoutAmountHeader({
  merchantName,
  amountUsd,
  reference,
}: {
  merchantName: string;
  amountUsd: string;
  reference: string | null;
}) {
  return (
    <div className="text-center">
      <div className="mb-2 text-sm text-white/60">Pay</div>
      <h1 className="mb-4 text-2xl font-bold">{merchantName}</h1>
      <div className="mb-2 text-5xl font-bold tabular-nums">${amountUsd}</div>
      <div className="text-lg text-white/60">USD</div>
      {reference && (
        <div className="mt-4 text-sm text-white/40">Ref: {reference}</div>
      )}
    </div>
  );
}
