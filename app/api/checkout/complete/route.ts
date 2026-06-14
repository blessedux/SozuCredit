import { NextRequest, NextResponse } from "next/server";

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, transactionHash, paymentMethod } = body;

    console.log("[checkout/complete] Request received:", {
      id,
      transactionHash,
      paymentMethod,
    });

    if (!id || !transactionHash) {
      console.error("[checkout/complete] Missing required fields:", { id, transactionHash });
      return NextResponse.json(
        { error: "Missing required fields: id and transactionHash" },
        { status: 400 }
      );
    }

    const requestBody = {
      id,
      transactionHash,
      paymentMethod: paymentMethod || "sozu",
    };

    console.log("[checkout/complete] Calling sozupay API:", {
      url: `${SOZUPAY_URL}/api/checkout/complete`,
      body: requestBody,
    });

    const res = await fetch(`${SOZUPAY_URL}/api/checkout/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[checkout/complete] Sozupay API error:", {
        status: res.status,
        error: data.error,
        data,
      });
      return NextResponse.json(
        { error: data.error || `Failed to complete checkout (${res.status})` },
        { status: res.status }
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[checkout/complete] Error:", err);
    return NextResponse.json(
      { error: "Network error completing checkout" },
      { status: 500 }
    );
  }
}
