import "server-only";

export type Sep24Info = {
  deposit?: { enabled?: boolean };
  /** Raw for forward compatibility */
  raw: Record<string, unknown>;
};

export async function fetchSep24Info(
  sep24Base: string,
  jwt: string
): Promise<{ ok: true; info: Sep24Info } | { ok: false; error: string }> {
  const base = sep24Base.replace(/\/?$/, "/");
  const url = `${base}info`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    next: { revalidate: 0 },
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `SEP-24 info not JSON (HTTP ${res.status})` };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
    };
  }
  const deposit = data.deposit as Sep24Info["deposit"] | undefined;
  return { ok: true, info: { deposit, raw: data } };
}

export type Sep24InteractiveResult =
  | { ok: true; url: string; id?: string }
  | { ok: false; error: string };

/** Multi-tenant Railway SDP wallet-registration pages require tenant + lang in the URL. */
export function augmentSdpInteractiveUrl(
  url: string,
  opts: { tenantName?: string; lang?: string }
): string {
  try {
    const u = new URL(url);
    const tenant = opts.tenantName?.trim();
    if (tenant && !u.searchParams.has("tenant")) {
      u.searchParams.set("tenant", tenant);
    }
    if (opts.lang) {
      u.searchParams.set("lang", opts.lang);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export async function postSep24DepositInteractive(params: {
  sep24Base: string;
  jwt: string;
  account: string;
  assetCode: string;
  assetIssuer: string | null;
  tenantName?: string;
  lang?: string;
  /** Extra fields some anchors expect */
  extra?: Record<string, string>;
}): Promise<Sep24InteractiveResult> {
  const base = params.sep24Base.replace(/\/?$/, "/");
  const url = `${base}transactions/deposit/interactive`;

  const form = new URLSearchParams();
  form.set("account", params.account);
  const isNative =
    !params.assetIssuer &&
    (params.assetCode.toLowerCase() === "native" ||
      params.assetCode.toUpperCase() === "XLM");
  if (isNative) {
    form.set("asset_code", "native");
  } else {
    form.set("asset_code", params.assetCode);
    if (params.assetIssuer) {
      form.set("asset_issuer", params.assetIssuer);
    }
  }
  if (params.lang) {
    form.set("lang", params.lang);
  }
  if (params.extra) {
    for (const [k, v] of Object.entries(params.extra)) {
      form.set(k, v);
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${params.jwt}`,
      ...(params.tenantName ? { "SDP-Tenant-Name": params.tenantName } : {}),
    },
    body: form.toString(),
    redirect: "manual",
    next: { revalidate: 0 },
  });

  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      return { ok: true, url: loc };
    }
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `SEP-24 interactive: HTTP ${res.status} ${text.slice(0, 120)}`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : `HTTP ${res.status}`,
    };
  }

  const interactive =
    (data.interactive_deposit as Record<string, unknown> | undefined) ||
    (data.interactive as Record<string, unknown> | undefined);

  const urlField =
    (typeof data.url === "string" && data.url) ||
    (typeof interactive?.url === "string" && interactive.url) ||
    (typeof data.type === "string" &&
      data.type === "interactive_customer_info_needed" &&
      typeof (data as { url?: string }).url === "string" &&
      (data as { url: string }).url);

  if (urlField) {
    const id =
      typeof data.id === "string"
        ? data.id
        : typeof interactive?.id === "string"
          ? interactive.id
          : undefined;
    return { ok: true, url: urlField, id };
  }

  return { ok: false, error: "Missing interactive URL in response" };
}

export type Sep24TransactionRow = Record<string, unknown>;

export async function fetchSep24Transactions(params: {
  sep24Base: string;
  jwt: string;
  /** SEP-24 id from interactive response when available */
  id?: string;
}): Promise<
  { ok: true; transactions: Sep24TransactionRow[] } | { ok: false; error: string }
> {
  const base = params.sep24Base.replace(/\/?$/, "/");
  const u = new URL(`${base}transactions`);
  if (params.id) {
    u.searchParams.set("id", params.id);
  }

  const res = await fetch(u.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${params.jwt}`,
    },
    next: { revalidate: 0 },
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `transactions: not JSON (HTTP ${res.status})` };
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
    };
  }

  const txs = data.transactions;
  if (Array.isArray(txs)) {
    return { ok: true, transactions: txs as Sep24TransactionRow[] };
  }
  if (data.transaction && typeof data.transaction === "object") {
    return {
      ok: true,
      transactions: [data.transaction as Sep24TransactionRow],
    };
  }
  return { ok: true, transactions: [] };
}
