// Daily scan-and-score: pulls trending products from Alibaba, validates
// against Amazon + Takealot, scores demand, computes margin, and upserts
// into product_discovery. Designed for cron (1 AM UTC).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ZAR_PER_USD = 18.5;
const ZAR_PER_CNY = 2.6;

interface AlibabaItem {
  product_id: string;
  title: string;
  category?: string;
  price_cny: number;
  supplier_rating?: number; // 0-5
  moq?: number;
  product_url?: string | null;
  supplier_name?: string | null;
}

interface AmazonItem {
  title: string;
  price_usd: number;
  review_count: number;
  rating: number;
  asin?: string | null;
  product_url?: string | null;
}

interface TakealotItem {
  title: string;
  price_zar: number;
  sales_velocity?: number; // 0-100
  rating?: number | null;
  product_url?: string | null;
  review_count?: number | null;
}

interface Scored {
  product_name: string;
  category: string | null;
  china_api_price_zar: number;
  amazon_price_zar: number | null;
  takealot_price_zar: number | null;
  demand_score: number;
  estimated_margin_pct: number;
  high_margin_flag: boolean;
  alibaba_product_url: string | null;
  alibaba_supplier_name: string | null;
  alibaba_supplier_rating: number | null;
  amazon_product_url: string | null;
  amazon_rating: number | null;
  amazon_reviews_count: number | null;
  takealot_product_url: string | null;
  takealot_rating: number | null;
  takealot_reviews_count: number | null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 2));
}

function fuzzyMatch(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function findBest<T extends { title: string }>(name: string, list: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of list) {
    const s = fuzzyMatch(name, item.title);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

async function fetchAlibaba(): Promise<AlibabaItem[]> {
  const appId = Deno.env.get("ALIBABA_APP_ID");
  const appSecret = Deno.env.get("ALIBABA_APP_SECRET");
  if (!appId || !appSecret) {
    console.warn("Alibaba credentials missing, using fallback seed");
    return seedAlibaba();
  }
  try {
    const res = await fetch("https://api.alibabacloud.com/alitems/search?trending=true&limit=100", {
      headers: {
        "X-App-Id": appId,
        "Authorization": `Bearer ${appSecret}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) {
      console.error("Alibaba API non-OK", res.status, await res.text());
      return seedAlibaba();
    }
    const json = await res.json();
    const items: AlibabaItem[] = (json.items ?? json.data ?? []).map((r: any) => ({
      product_id: String(r.product_id ?? r.id ?? crypto.randomUUID()),
      title: String(r.title ?? r.name ?? ""),
      category: r.category ?? null,
      price_cny: Number(r.price_cny ?? r.price ?? 0),
      supplier_rating: Number(r.supplier_rating ?? r.rating ?? 4),
      moq: Number(r.moq ?? 50),
      product_url: r.product_url ?? r.url ?? null,
      supplier_name: r.supplier_name ?? r.supplier ?? null,
    })).filter((i: AlibabaItem) => i.title && i.price_cny > 0);
    return items.length ? items : seedAlibaba();
  } catch (e) {
    console.error("Alibaba fetch failed", e);
    return seedAlibaba();
  }
}

function seedAlibaba(): AlibabaItem[] {
  // Fallback seed so the cron still produces rows on API outage.
  const seed = [
    "Wireless Earbuds Bluetooth 5.3", "USB-C Cable 2m Braided", "LED Bulbs 10W Pack",
    "Portable Phone Charger 20000mAh", "Wireless Charger 15W Fast", "Smart Watch Fitness Tracker",
    "Bluetooth Speaker Waterproof", "Phone Stand Adjustable Aluminum", "HDMI Cable 4K 2m",
    "Car Phone Holder Magnetic", "Yoga Mat Non-Slip 6mm", "Resistance Bands Set 5pc",
    "Stainless Steel Water Bottle 750ml", "Kitchen Knife Set 6pc", "Silicone Baking Mat",
    "Air Fryer 4L Digital", "Electric Kettle 1.7L", "Coffee Grinder Manual",
    "Reusable Shopping Bags 5pc", "LED Strip Lights 5m RGB", "Desk Organizer Bamboo",
    "Laptop Stand Adjustable", "Mouse Pad Large Gaming", "Mechanical Keyboard 60%",
    "Webcam 1080p HD", "Ring Light 10 inch", "Tripod Phone Holder",
    "Selfie Stick Bluetooth", "Power Strip 6 Outlets USB", "Extension Cord 3m",
    "Sunglasses Polarized UV400", "Travel Backpack 30L", "Packing Cubes 6pc Set",
    "Compression Socks Set", "Yoga Block Cork", "Foam Roller 45cm",
    "Pet Grooming Brush", "Cat Scratching Post", "Dog Leash Retractable 5m",
    "Plant Pot Ceramic Set", "Garden Tool Set 5pc", "Bird Feeder Hanging",
    "Solar Garden Lights 10pc", "Outdoor Camping Tent 2P", "Sleeping Bag 3 Season",
    "Hiking Backpack 40L", "Insulated Lunch Bag", "Vacuum Insulated Tumbler 30oz",
    "Bamboo Cutting Board Set", "Silicone Spatula Set", "Measuring Cups Stainless",
    "Hair Dryer Ionic 2000W", "Curling Iron Ceramic", "Beard Trimmer Cordless",
    "Electric Toothbrush Sonic", "Facial Cleansing Brush", "Makeup Brush Set 12pc",
    "Nail Polish Kit UV LED", "Essential Oil Diffuser 500ml", "Aromatherapy Humidifier",
    "White Noise Machine", "Memory Foam Pillow", "Weighted Blanket 7kg",
    "Bed Sheets Microfiber Queen", "Throw Blanket Knit", "Floor Lamp LED Modern",
    "Wall Mirror Round 60cm", "Picture Frame Set 5pc", "Wall Clock Silent",
    "Tool Kit Household 100pc", "Drill Driver Cordless 20V", "Tape Measure 5m",
    "Safety Goggles Anti-Fog", "Work Gloves Leather", "Multimeter Digital",
  ];
  return seed.map((title, i) => ({
    product_id: `seed-${i}`,
    title,
    category: null,
    price_cny: Math.round((20 + Math.random() * 180) * 10) / 10,
    supplier_rating: 3.5 + Math.random() * 1.5,
    moq: 50,
    product_url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(title)}`,
    supplier_name: null,
  }));
}

async function fetchAmazon(supabase: ReturnType<typeof createClient>): Promise<AmazonItem[]> {
  const { data } = await supabase
    .from("amazon_products")
    .select("title, price_usd, review_count, rating, asin")
    .order("review_count", { ascending: false })
    .limit(500);
  return (data ?? []).map((r: any) => ({
    title: r.title,
    price_usd: Number(r.price_usd ?? 0),
    review_count: Number(r.review_count ?? 0),
    rating: Number(r.rating ?? 0),
    asin: r.asin ?? null,
    product_url: r.asin ? `https://www.amazon.co.za/dp/${r.asin}` : null,
  }));
}

async function fetchTakealot(supabase: ReturnType<typeof createClient>): Promise<TakealotItem[]> {
  const { data } = await supabase
    .from("takealot_products")
    .select("takealot_name, takealot_price, takealot_url, rating, seller_count")
    .limit(500);
  return (data ?? []).map((r: any) => ({
    title: r.takealot_name,
    price_zar: Number(r.takealot_price ?? 0),
    sales_velocity: Math.min(100, (Number(r.seller_count ?? 0)) * 10),
    rating: r.rating != null ? Number(r.rating) : null,
    product_url: r.takealot_url ?? null,
    review_count: null,
  }));
}

function scoreDemand(amazon: AmazonItem | null, takealot: TakealotItem | null, supplierRating: number): number {
  // Amazon review count → 0-5
  let amazonPts = 0;
  if (amazon) {
    const r = amazon.review_count;
    if (r > 100000) amazonPts = 5;
    else if (r > 25000) amazonPts = 4;
    else if (r > 5000) amazonPts = 3;
    else if (r > 1000) amazonPts = 2;
    else amazonPts = 1;
  }
  // Takealot velocity → 0-3
  let takealotPts = 0;
  if (takealot) {
    const v = takealot.sales_velocity ?? 50;
    takealotPts = Math.min(3, Math.round((v / 100) * 3));
  }
  // Supplier rating → 0-2
  const supplierPts = Math.min(2, Math.round((supplierRating / 5) * 2));
  return Math.max(1, Math.min(10, amazonPts + takealotPts + supplierPts));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [alibaba, amazon, takealot] = await Promise.all([
      fetchAlibaba(),
      fetchAmazon(supabase),
      fetchTakealot(supabase),
    ]);

    console.log(`Sources: alibaba=${alibaba.length} amazon=${amazon.length} takealot=${takealot.length}`);

    const scored: Scored[] = [];
    for (const a of alibaba) {
      const ama = findBest(a.title, amazon);
      const tak = findBest(a.title, takealot);

      const china_api_price_zar = Math.round(a.price_cny * ZAR_PER_CNY * 100) / 100;
      const amazon_price_zar = ama ? Math.round(ama.price_usd * ZAR_PER_USD * 100) / 100 : null;
      const takealot_price_zar = tak ? Number(tak.price_zar) : null;

      // sell price preference: takealot → amazon → 3x china cost
      const sell_price = takealot_price_zar ?? amazon_price_zar ?? china_api_price_zar * 3;
      const margin = sell_price > 0 ? ((sell_price - china_api_price_zar) / sell_price) * 100 : 0;

      scored.push({
        product_name: a.title,
        category: a.category ?? null,
        china_api_price_zar,
        amazon_price_zar,
        takealot_price_zar,
        demand_score: scoreDemand(ama, tak, a.supplier_rating ?? 4),
        estimated_margin_pct: Math.round(margin * 100) / 100,
        high_margin_flag: margin > 30,
        alibaba_product_url: a.product_url ?? null,
        alibaba_supplier_name: a.supplier_name ?? null,
        alibaba_supplier_rating: a.supplier_rating ?? null,
        amazon_product_url: ama?.product_url ?? null,
        amazon_rating: ama?.rating ?? null,
        amazon_reviews_count: ama?.review_count ?? null,
        takealot_product_url: tak?.product_url ?? null,
        takealot_rating: tak?.rating ?? null,
        takealot_reviews_count: tak?.review_count ?? null,
      });
    }

    // Upsert: lookup by product_name, UPDATE if exists else INSERT.
    let inserted = 0;
    let updated = 0;
    let highMargin = 0;
    let updateErrors = 0;
    let insertErrors = 0;
    let firstError: string | null = null;
    let sampleLogged = false;
    for (const s of scored) {
      if (s.high_margin_flag) highMargin++;
      const { data: existing } = await supabase
        .from("product_discovery")
        .select("id")
        .eq("product_name", s.product_name)
        .maybeSingle();

      const payload = {
        product_name: s.product_name,
        category: s.category,
        source: "china_api",
        status: "discovered",
        data_validation_status: "pending_review",
        amazon_price_zar: s.amazon_price_zar,
        takealot_price_zar: s.takealot_price_zar,
        china_api_price_zar: s.china_api_price_zar,
        demand_score: s.demand_score,
        estimated_margin_pct: s.estimated_margin_pct,
        alibaba_product_url: s.alibaba_product_url,
        alibaba_supplier_name: s.alibaba_supplier_name,
        alibaba_supplier_rating: s.alibaba_supplier_rating,
        amazon_product_url: s.amazon_product_url,
        amazon_rating: s.amazon_rating,
        amazon_reviews_count: s.amazon_reviews_count,
        takealot_product_url: s.takealot_product_url,
        takealot_rating: s.takealot_rating,
        takealot_reviews_count: s.takealot_reviews_count,
        updated_at: new Date().toISOString(),
      };

      if (!sampleLogged) {
        console.log("Sample payload:", JSON.stringify({
          name: s.product_name,
          alibaba_url: s.alibaba_product_url,
          amazon_url: s.amazon_product_url,
          takealot_url: s.takealot_product_url,
        }));
        sampleLogged = true;
      }

      if (existing) {
        const { error, data } = await supabase
          .from("product_discovery")
          .update(payload)
          .eq("id", (existing as any).id)
          .select("id, alibaba_product_url, amazon_product_url")
          .maybeSingle();
        if (error) {
          updateErrors++;
          if (!firstError) firstError = `UPDATE: ${error.message} | code=${error.code} | details=${error.details} | hint=${error.hint}`;
          console.error("Update error for", s.product_name, JSON.stringify(error));
        } else if (updated === 0) {
          console.log("First update returned:", JSON.stringify(data));
        }
        updated++;
      } else {
        const { error } = await supabase.from("product_discovery").insert(payload);
        if (error) {
          insertErrors++;
          if (!firstError) firstError = `INSERT: ${error.message} | code=${error.code} | details=${error.details} | hint=${error.hint}`;
          console.error("Insert error for", s.product_name, JSON.stringify(error));
        }
        inserted++;
      }
    }

    const summary = `Inserted ${inserted} products, ${updated} updated, ${highMargin} with margin > 30%, updateErrors=${updateErrors}, insertErrors=${insertErrors}`;
    console.log(summary);
    if (firstError) console.error("First error:", firstError);

    return new Response(
      JSON.stringify({ ok: true, inserted, updated, high_margin: highMargin, total_scored: scored.length, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scan-and-score-products error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
