import { CheckoutExperience } from "@/components/checkout/checkout-experience";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { id } = await params;
  return <CheckoutExperience sessionId={id} />;
}
