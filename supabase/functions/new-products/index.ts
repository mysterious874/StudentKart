// StudentKart — New Products feed
// Supabase Edge Function
// Sources: Amazon Creators API + Flipkart Affiliate API
// Secrets must be configured in Supabase, never in frontend code.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const rateBuckets = new Map<string, { started: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

const clientKey = (req: Request) => req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Product = {
  id: string;
  name: string;
  category: string;
  price: number | null;
  mrp: number | null;
  image: string;
  url: string;
  source: "Amazon" | "Flipkart";
};

function categoryFor(text: string) {
  const s = text.toLowerCase();
  if (/(laptop|mobile|phone|tablet|monitor|keyboard|mouse|headphone|earphone|ssd|hard.?drive|camera|charger|speaker|smartwatch)/.test(s)) return "electronics";
  if (/(book|novel|notebook|study|textbook)/.test(s)) return "books";
  if (/(shirt|t.?shirt|jeans|shoe|sneaker|hoodie|jacket|bag|watch|fashion)/.test(s)) return "fashion";
  if (/(sofa|chair|table|desk|bed|lamp|furniture|mattress)/.test(s)) return "home";
  if (/(playstation|xbox|gaming|controller|console|game)/.test(s)) return "gaming";
  return "other";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function getAmazonProducts(query: string): Promise<Product[]> {
  const clientId = Deno.env.get("AMAZON_CLIENT_ID");
  const clientSecret = Deno.env.get("AMAZON_CLIENT_SECRET");
  const partnerTag = Deno.env.get("AMAZON_PARTNER_TAG");
  const tokenUrl = Deno.env.get("AMAZON_TOKEN_URL") || "https://api.amazon.co.uk/auth/o2/token";

  if (!clientId || !clientSecret || !partnerTag) return [];

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "creatorsapi::default",
    }),
  });

  if (!tokenResponse.ok) throw new Error("Amazon token request failed: " + tokenResponse.status);
  const tokenData = await tokenResponse.json();

  const apiResponse = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + tokenData.access_token,
      "Content-Type": "application/json",
      "x-marketplace": "www.amazon.in",
    },
    body: JSON.stringify({
      keywords: query,
      searchIndex: "All",
      itemCount: 10,
      marketplace: "www.amazon.in",
      partnerTag,
      resources: [
        "images.primary.large",
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "offersV2.listings.price",
        "offersV2.listings.availability",
      ],
    }),
  });

  if (!apiResponse.ok) throw new Error("Amazon catalog request failed: " + apiResponse.status);
  const data = await apiResponse.json();
  const items = Array.isArray(data?.searchResult?.items) ? data.searchResult.items : [];

  return items.map((item: any, index: number) => {
    const name = firstString(
      item?.itemInfo?.title?.displayValue,
      item?.itemInfo?.title?.label,
      item?.itemInfo?.title
    ) || "Amazon product";

    const listing = item?.offersV2?.listings?.[0];
    const price = numberValue(
      listing?.price?.amount ??
      listing?.price?.displayAmount ??
      listing?.price?.displayPrice
    );

    return {
      id: "amazon-" + (item?.asin || index),
      name,
      category: categoryFor(name),
      price,
      mrp: null,
      image: firstString(
        item?.images?.primary?.large?.url,
        item?.images?.primary?.medium?.url,
        item?.images?.primary?.small?.url
      ),
      url: firstString(item?.detailPageURL, item?.detailPageUrl, item?.url),
      source: "Amazon" as const,
    };
  }).filter((p: Product) => p.name && p.url);
}

async function getFlipkartProducts(query: string): Promise<Product[]> {
  const trackingId = Deno.env.get("FLIPKART_AFFILIATE_ID");
  const token = Deno.env.get("FLIPKART_AFFILIATE_TOKEN");

  if (!trackingId || !token) return [];

  const endpoint =
    "https://affiliate-api.flipkart.net/affiliate/1.0/search/json?query=" +
    encodeURIComponent(query) +
    "&resultCount=10";

  const response = await fetch(endpoint, {
    headers: {
      "Fk-Affiliate-Id": trackingId,
      "Fk-Affiliate-Token": token,
    },
  });

  if (!response.ok) throw new Error("Flipkart API request failed: " + response.status);
  const data = await response.json();

  const raw =
    data?.productInfoList ||
    data?.products?.productInfoList ||
    data?.productInfo ||
    [];

  const list = Array.isArray(raw) ? raw : [];

  return list.map((item: any, index: number) => {
    const base = item?.productBaseInfoV1 || item?.productBaseInfo || item;
    const title = firstString(base?.title, item?.title) || "Flipkart product";
    const price = numberValue(
      base?.productAttributes?.sellingPrice?.amount ??
      base?.sellingPrice?.amount ??
      base?.price?.amount ??
      base?.sellingPrice
    );
    const mrp = numberValue(
      base?.productAttributes?.maximumRetailPrice?.amount ??
      base?.maximumRetailPrice?.amount ??
      base?.mrp
    );
    const image =
      firstString(
        base?.imageUrls?.["400x400"],
        base?.imageUrls?.["200x200"],
        base?.imageUrls?.unknown,
        base?.imageUrl
      );

    const url = firstString(
      base?.productUrl,
      base?.productAttributes?.productUrl,
      item?.productUrl
    );

    return {
      id: "flipkart-" + (base?.productId || index),
      name: title,
      category: categoryFor(title),
      price,
      mrp,
      image,
      url,
      source: "Flipkart" as const,
    };
  }).filter((p: Product) => p.name && p.url);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = clientKey(request);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.started >= RATE_WINDOW_MS) rateBuckets.set(key, { started: now, count: 1 });
  else { bucket.count += 1; if (bucket.count > RATE_LIMIT) return json({ products: [], error: "Too many requests. Please try again shortly." }, 429); }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "student essentials").trim();

    const [amazonResult, flipkartResult] = await Promise.allSettled([
      getAmazonProducts(query),
      getFlipkartProducts(query),
    ]);

    const products: Product[] = [
      ...(amazonResult.status === "fulfilled" ? amazonResult.value : []),
      ...(flipkartResult.status === "fulfilled" ? flipkartResult.value : []),
    ];

    return json({
      products,
      sources: {
        amazon: amazonResult.status === "fulfilled",
        flipkart: flipkartResult.status === "fulfilled",
      },
      query,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return json({
      products: [],
      error: error instanceof Error ? error.message : "New products feed failed",
    }, 200);
  }
});
