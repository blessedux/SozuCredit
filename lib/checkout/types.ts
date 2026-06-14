export type CheckoutSessionStatus = "pending" | "completed" | "failed" | "expired";

export type CheckoutSession = {
  id: string;
  status: CheckoutSessionStatus;
  amountUsd: string;
  reference: string | null;
  merchantName: string;
  destinationStellarAddress: string;
  allowDebit: boolean;
  allowCredit: boolean;
  allowBankTransfer: boolean;
  createdAt: string;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
};

export type CheckoutPublicResponse = CheckoutSession;

export type CheckoutStatusResponse = {
  id: string;
  status: CheckoutSessionStatus;
  amountUsd: string;
  reference: string | null;
  createdAt: string;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
};
