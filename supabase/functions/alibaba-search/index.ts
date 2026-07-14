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
  price_label: string;
  moq: number | null;
  moq_unit: string | null;
  moq_found: boolean;
  supplier_name: string | null;
  supplier_url: string | null;
  supplier_rating: number | null;
  supplier_review_count: number | null;
  matched_query?: string;
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
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch { /* ignore */ }
  }
  return out;
}

function extractCardMeta(html: string, id: string) {
  const anchorRe = new RegExp(`_${id}\\.html`);
  const idx = html.search(anchorRe);
  if (idx < 0) return {} as any;
  const window = html.slice(Math.max(0, idx - 4000), idx + 4000);

  const rangeMatch = window.match(/US\s*\$\s*([\d.]+)\s*[-–]\s*\$?\s*([\d.]+)/i);
  const priceFrom = rangeMatch ? Number(rangeMatch[1]) : null;
  const priceTo = rangeMatch ? Number(rangeMatch[2]) : null;

  const moqMatch = window.match(/Min\.?\s*Order[:\s]*([\d,]+)\s*([a-zA-Z]+)?/i)
                || window.match(/MOQ[:\s]*([\d,]+)\s*([a-zA-Z]+)?/i);
  const moq = moqMatch ? Number(moqMatch[1].replace(/,/g, "")) : null;
  const moqUnit = moqMatch && moqMatch[2] ? moqMatch[2] : null;

  const supMatch = window.match(/company-name[^>]*>\s*([^<]{2,80})</i)
                || window.match(/supplier-name[^>]*>\s*([^<]{2,80})</i)
                || window.match(/data-company-name=["']([^"']{2,80})["']/i);
  const supplier_name = supMatch ? supMatch[1].trim() : null;

  const supUrlMatch = window.match(/href=["'](https?:\/\/[^"']*\.alibaba\.com[^"']*)["'][^>]*(?:company|supplier)/i);
  const supplier_url = supUrlMatch ? supUrlMatch[1] : null;

  return { priceFrom, priceTo, moq, moqUnit, supplier_name, supplier_url };
}

function candidatesFromHtml(html: string, matchedQuery: string): Candidate[] {
  const jsonBlocks = parseJsonLd(html);
  const itemList = jsonBlocks.find((b) => b && b["@type"] === "ItemList" && Array.isArray(b.itemListElement));
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
      matched_query: matchedQuery,
    });
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

    let queries: string[] = [];
    let pages = 3;
    let targetCount = 40;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.queries)) queries = body.queries.map((s: any) => String(s).trim()).filter(Boolean);
      else if (body?.query) queries = [String(body.query).trim()];
      if (typeof body?.pages === "number") pages = Math.min(5, Math.max(1, body.pages));
      if (typeof body?.target === "number") targetCount = Math.min(60, Math.max(10, body.target));
    } else {
      const q = new URL(req.url).searchParams.get("q")?.trim();
      if (q) queries = [q];
    }
    if (queries.length === 0) {
      return new Response(JSON.stringify({ error: "query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const attempted: { query: string; slug: string; page: number; url: string; status: number; found: number }[] = [];
    const byId = new Map<string, Candidate>();
    let unlockerRequests = 0;
    let source_url = "";

    outer:
    for (const q of queries) {
      const slug = slugify(q);
      if (!slug) continue;
      for (let p = 1; p <= pages; p++) {
        const url = p === 1
          ? `https://www.alibaba.com/showroom/${slug}.html`
          : `https://www.alibaba.com/showroom/${slug}/${p}.html`;
        if (!source_url) source_url = url;
        const r = await unlockerFetch(url);
        unlockerRequests++;
        const found = r.status === 200 ? candidatesFromHtml(r.body, q) : [];
        attempted.push({ query: q, slug, page: p, url, status: r.status, found: found.length });
        for (const c of found) {
          if (!byId.has(c.id)) byId.set(c.id, c);
        }
        if (byId.size >= targetCount) break outer;
        // if a page returns 0 items, don't waste more requests on later pages of same query
        if (found.length === 0 && p > 1) break;
      }
    }

    const candidates = Array.from(byId.values()).slice(0, targetCount);

    return new Response(
      JSON.stringify({
        queries,
        source_url,
        candidates,
        attempted,
        unlocker_requests: unlockerRequests,
        note: `${unlockerRequests} Web Unlocker request(s) used. MOQ is best-effort — verify via the Alibaba link.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
