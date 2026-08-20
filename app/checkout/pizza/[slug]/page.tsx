import { PizzaCheckoutExperience } from "@/components/checkout/pizza-checkout-experience";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PizzaCheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  return <PizzaCheckoutExperience slug={slug} />;
}
