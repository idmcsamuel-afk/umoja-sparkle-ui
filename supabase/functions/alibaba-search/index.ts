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

// Alibaba's /showroom/<slug>.html uses arbitrary canonical slugs — many are
// pluralized ("luggage-sets", "hair-clippers"), some singular. There's no way
// to know in advance, so we generate a few candidate slugs per query and try
// each until one returns a real page (not the 404-Error soft page).
function slugCandidates(q: string): string[] {
  const base = slugify(q);
  if (!base) return [];
  const priority: string[] = [];
  const fallback: string[] = [];
  const pushPriority = (s: string) => { if (s && s.length > 1 && !priority.includes(s)) priority.push(s); };
  const pushFallback = (s: string) => { if (s && s.length > 1 && !priority.includes(s) && !fallback.includes(s)) fallback.push(s); };

  const words = base.split("-").filter(Boolean);
  const has = (word: string) => words.includes(word);

  // Put high-signal core product nouns first. Long descriptive showroom slugs
  // often render thin SEO pages with no cards, while canonical noun slugs work.
  if ((has("luggage") || has("suitcase") || has("suitcases")) && (has("set") || has("sets"))) {
    pushPriority("luggage-sets");
    pushPriority("suitcase-sets");
    if (has("hard") || has("hardshell") || has("shell")) pushPriority("hardshell-luggage");
  }
  if ((has("clipper") || has("clippers") || has("trimmer") || has("trimmers")) && has("hair")) {
    pushPriority("hair-clippers");
  }

  // Strip a leading numeric quantity ("3-piece-luggage-set" -> "luggage-set")
  const stripped = base.replace(/^(\d+[a-z]{0,4}-)+/i, "").replace(/^(piece|pcs|pc|pack)-/i, "");

  for (const s of [base, stripped]) {
    const parts = s.split("-").filter(Boolean);
    if (!parts.length) continue;
    const last = parts[parts.length - 1];
    let pl = last;
    if (/(s|x|z|ch|sh)$/.test(last)) pl = last + "es";
    else if (/[^aeiou]y$/.test(last)) pl = last.slice(0, -1) + "ies";
    else if (!last.endsWith("s")) pl = last + "s";
    if (pl !== last) pushPriority([...parts.slice(0, -1), pl].join("-"));
    if (last.endsWith("s") && last.length > 3) {
      const sg = last.endsWith("ies") ? last.slice(0, -3) + "y"
              : /(ses|xes|zes|ches|shes)$/.test(last) ? last.slice(0, -2)
              : last.slice(0, -1);
      pushFallback([...parts.slice(0, -1), sg].join("-"));
    }
  }

  pushFallback(stripped);
  pushFallback(base);
  return [...priority, ...fallback].slice(0, 4);
}

function isSoft404(html: string): boolean {
  return /<title>\s*404-Error\s*<\/title>/i.test(html.slice(0, 4000));
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
  if (!itemList || !Array.isArray(itemList.itemListElement)) return candidatesFromDom(html, matchedQuery);

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

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteAlibabaUrl(url: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.alibaba.com${url}`;
  return `https://www.alibaba.com/${url}`;
}

function extractAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, "i");
  return tag.match(re)?.[1] ?? null;
}

function candidatesFromDom(html: string, matchedQuery: string): Candidate[] {
  const results: Candidate[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href=["']([^"']*product-detail\/[^"']+_[0-9]{6,}\.html[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) && results.length < 50) {
    const anchorHtml = m[0];
    const url = absoluteAlibabaUrl(decodeHtml(m[1]));
    const id = extractProductId(url) || String(results.length + 1);
    if (seen.has(id)) continue;

    const imgTag = anchorHtml.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const alt = extractAttr(imgTag, "alt");
    const src = extractAttr(imgTag, "src");
    const name = decodeHtml(alt || anchorHtml.replace(/<[^>]+>/g, " ")).slice(0, 240);
    if (!name || name.length < 8) continue;

    const meta = extractCardMeta(html, id);
    let priceLabel = "—";
    if (meta.priceFrom != null && meta.priceTo != null && meta.priceTo !== meta.priceFrom) {
      priceLabel = `$${meta.priceFrom.toFixed(2)} - $${meta.priceTo.toFixed(2)}`;
    } else if (meta.priceFrom != null) {
      priceLabel = `from $${meta.priceFrom.toFixed(2)}`;
    }

    seen.add(id);
    results.push({
      id,
      name,
      url,
      image: src ? absoluteAlibabaUrl(decodeHtml(src)) : null,
      price_from: meta.priceFrom ?? null,
      price_to: meta.priceTo ?? null,
      price_currency: "USD",
      price_label: priceLabel,
      moq: meta.moq ?? null,
      moq_unit: meta.moqUnit ?? null,
      moq_found: meta.moq != null,
      supplier_name: meta.supplier_name ?? null,
      supplier_url: meta.supplier_url ?? null,
      supplier_rating: null,
      supplier_review_count: null,
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
    let pages = 2;
    let targetCount = 40;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.queries)) queries = body.queries.map((s: any) => String(s).trim()).filter(Boolean);
      else if (body?.query) queries = [String(body.query).trim()];
      if (typeof body?.pages === "number") pages = Math.min(3, Math.max(1, body.pages));
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
      const slugs = slugCandidates(q);
      if (!slugs.length) continue;
      let workingSlug: string | null = null;

      // First, find a slug that isn't a soft-404 by probing page 1 of each candidate.
      for (const slug of slugs) {
        const url = `https://www.alibaba.com/showroom/${slug}.html`;
        if (!source_url) source_url = url;
        const r = await unlockerFetch(url);
        unlockerRequests++;
        const soft404 = r.status === 200 && isSoft404(r.body);
        const found = r.status === 200 && !soft404 ? candidatesFromHtml(r.body, q) : [];
        attempted.push({ query: q, slug, page: 1, url, status: soft404 ? 404 : r.status, found: found.length });
        for (const c of found) if (!byId.has(c.id)) byId.set(c.id, c);
        if (!soft404 && r.status === 200 && found.length > 0) { workingSlug = slug; break; }
        if (byId.size >= targetCount) break outer;
      }

      if (byId.size >= targetCount) break outer;
      if (!workingSlug) continue;

      // Paginate the working slug for extra results.
      for (let p = 2; p <= pages; p++) {
        const url = `https://www.alibaba.com/showroom/${workingSlug}/${p}.html`;
        const r = await unlockerFetch(url);
        unlockerRequests++;
        const found = r.status === 200 && !isSoft404(r.body) ? candidatesFromHtml(r.body, q) : [];
        attempted.push({ query: q, slug: workingSlug, page: p, url, status: r.status, found: found.length });
        for (const c of found) if (!byId.has(c.id)) byId.set(c.id, c);
        if (byId.size >= targetCount) break outer;
        if (found.length === 0) break;
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
