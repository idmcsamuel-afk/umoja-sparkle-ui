// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
const ZONE = Deno.env.get("BRIGHT_DATA_UNLOCKER_ZONE") || "umoja_web_unlocker1";

interface Candidate {
  id: string;
  name: string;
  url: string;
  image: string | null;
  price_from: number | null;
  price_to: number | null;
  price_currency: string;
  price_label: string;                // e.g. "from $0.35" or "$0.35 - $0.89"
  moq: number | null;
  moq_unit: string | null;
  moq_found: boolean;
  supplier_name: string | null;
  supplier_url: string | null;
  supplier_rating: number | null;
  supplier_review_count: number | null;
}

function slugify(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function shortSlug(q: string): string {
  const words = q.toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join("-");
}

async function unlockerFetch(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone: ZONE, url, format: "raw", country: "us" }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

function extractProductId(url: string): string | null {
  const m = url.match(/product-detail\/[^/?]*_(\d{6,})\.html/) || url.match(/\/(\d{9,})\.html/);
  return m ? m[1] : null;
}

function parseJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      out.push(parsed);
    } catch { /* ignore */ }
  }
  return out;
}

/** Best-effort HTML regex around a product-id anchor to find MOQ + supplier + price range. */
function extractCardMeta(html: string, id: string) {
  const anchorRe = new RegExp(`_${id}\\.html`);
  const idx = html.search(anchorRe);
  if (idx < 0) return {};
  const window = html.slice(Math.max(0, idx - 4000), idx + 4000);

  // Price range like "US $0.35 - $0.89" or "$0.35-$0.89"
  const rangeMatch = window.match(/US\s*\$\s*([\d.]+)\s*[-–]\s*\$?\s*([\d.]+)/i);
  const priceFrom = rangeMatch ? Number(rangeMatch[1]) : null;
  const priceTo = rangeMatch ? Number(rangeMatch[2]) : null;

  // MOQ: "Min. order: 100 pieces" / "Min. Order: 500 sets" / "MOQ: 200"
  const moqMatch = window.match(/Min\.?\s*Order[:\s]*([\d,]+)\s*([a-zA-Z]+)?/i)
                || window.match(/MOQ[:\s]*([\d,]+)\s*([a-zA-Z]+)?/i);
  const moq = moqMatch ? Number(moqMatch[1].replace(/,/g, "")) : null;
  const moqUnit = moqMatch && moqMatch[2] ? moqMatch[2] : null;

  // Supplier name: nearby "by <name>" or company anchor. Alibaba markup varies; try a couple.
  const supMatch = window.match(/company-name[^>]*>\s*([^<]{2,80})</i)
                || window.match(/supplier-name[^>]*>\s*([^<]{2,80})</i)
                || window.match(/data-company-name=["']([^"']{2,80})["']/i);
  const supplier_name = supMatch ? supMatch[1].trim() : null;

  const supUrlMatch = window.match(/href=["'](https?:\/\/[^"']*\.alibaba\.com[^"']*)["'][^>]*(?:company|supplier)/i);
  const supplier_url = supUrlMatch ? supUrlMatch[1] : null;

  return { priceFrom, priceTo, moq, moqUnit, supplier_name, supplier_url };
}

function candidatesFromHtml(html: string): Candidate[] {
  const jsonBlocks = parseJsonLd(html);
  const itemList = jsonBlocks.find((b) => b && (b["@type"] === "ItemList" || b.itemListElement));
  if (!itemList || !Array.isArray(itemList.itemListElement)) return [];

  const results: Candidate[] = [];
  for (const el of itemList.itemListElement) {
    const item = el?.item ?? el;
    if (!item?.url) continue;
    const id = extractProductId(item.url) || String(el?.position ?? results.length);
    const meta = extractCardMeta(html, id);

    const jsonPrice = Number(item?.offers?.price ?? item?.offers?.lowPrice ?? NaN);
    const currency = item?.offers?.priceCurrency || "USD";
    const priceFrom = meta.priceFrom ?? (isFinite(jsonPrice) ? jsonPrice : null);
    const priceTo = meta.priceTo ?? null;

    let priceLabel = "—";
    if (priceFrom != null && priceTo != null && priceTo !== priceFrom) {
      priceLabel = `$${priceFrom.toFixed(2)} - $${priceTo.toFixed(2)}`;
    } else if (priceFrom != null) {
      priceLabel = `from $${priceFrom.toFixed(2)}`;
    }

    const rating = item?.aggregateRating?.ratingValue != null ? Number(item.aggregateRating.ratingValue) : null;
    const reviewCount = item?.aggregateRating?.reviewCount != null ? Number(item.aggregateRating.reviewCount) : null;

    results.push({
      id,
      name: String(item.name ?? "").trim(),
      url: item.url.startsWith("http") ? item.url : `https:${item.url}`,
      image: item.image ? (String(item.image).startsWith("http") ? String(item.image) : `https:${item.image}`) : null,
      price_from: priceFrom,
      price_to: priceTo,
      price_currency: currency,
      price_label: priceLabel,
      moq: meta.moq ?? null,
      moq_unit: meta.moqUnit ?? null,
      moq_found: meta.moq != null,
      supplier_name: meta.supplier_name ?? null,
      supplier_url: meta.supplier_url ?? null,
      supplier_rating: rating,
      supplier_review_count: reviewCount,
    });
    if (results.length >= 10) break;
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!KEY) {
      return new Response(JSON.stringify({ error: "BRIGHT_DATA_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let query = "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      query = String(body?.query ?? body?.q ?? "").trim();
    } else {
      query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    }
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const slug = slugify(query);
    const attempted: { slug: string; status: number; found: number }[] = [];

    // Attempt 1: full slug
    let url = `https://www.alibaba.com/showroom/${slug}.html`;
    let r = await unlockerFetch(url);
    let candidates = r.status === 200 ? candidatesFromHtml(r.body) : [];
    attempted.push({ slug, status: r.status, found: candidates.length });

    // Attempt 2: shorter slug (first 3 words) if nothing usable
    if (candidates.length === 0) {
      const s2 = shortSlug(query);
      if (s2 && s2 !== slug) {
        url = `https://www.alibaba.com/showroom/${s2}.html`;
        r = await unlockerFetch(url);
        candidates = r.status === 200 ? candidatesFromHtml(r.body) : [];
        attempted.push({ slug: s2, status: r.status, found: candidates.length });
      }
    }

    return new Response(
      JSON.stringify({
        query,
        source_url: url,
        candidates,
        attempted,
        note: "1 Web Unlocker request per search. MOQ is best-effort HTML parse — always verify via the Alibaba link.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
