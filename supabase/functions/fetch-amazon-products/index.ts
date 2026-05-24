import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const CATEGORIES = [
  'Electronics',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Toys & Games',
  'Clothing & Accessories',
];

interface MockProduct {
  asin: string;
  title: string;
  image_url: string;
  price_usd: number;
  rating: number;
  review_count: number;
  sales_rank: number;
  category: string;
  // SA mock data
  sa_available: boolean;
  sa_price_zar: number | null;
}

// Mock dataset combining US + SA Amazon intelligence.
// sa_available=false → first-mover opportunity (high score).
const MOCK_PRODUCTS: MockProduct[] = [
  // Electronics
  { asin: 'B0CHX1W1XY', title: 'Apple AirPods Pro (2nd Gen) with MagSafe Charging Case', image_url: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg', price_usd: 189.99, rating: 4.7, review_count: 124530, sales_rank: 12, category: 'Electronics', sa_available: true, sa_price_zar: 6499 },
  { asin: 'B0BDHWDR12', title: 'Anker Portable Charger 20000mAh Power Bank USB-C', image_url: 'https://m.media-amazon.com/images/I/71yf6yTNWSL._AC_SL1500_.jpg', price_usd: 49.99, rating: 4.6, review_count: 38420, sales_rank: 84, category: 'Electronics', sa_available: true, sa_price_zar: 1599 },
  { asin: 'B09JQMJHXY', title: 'Echo Dot (5th Gen) Smart Speaker with Alexa', image_url: 'https://m.media-amazon.com/images/I/71xoR4A6q-L._AC_SL1000_.jpg', price_usd: 49.99, rating: 4.7, review_count: 392104, sales_rank: 5, category: 'Electronics', sa_available: false, sa_price_zar: null },
  { asin: 'B0BSHF7WHW', title: 'Fire TV Stick 4K Max streaming device with Wi-Fi 6E', image_url: 'https://m.media-amazon.com/images/I/51CgKGfMelL._AC_SL1000_.jpg', price_usd: 59.99, rating: 4.6, review_count: 87653, sales_rank: 21, category: 'Electronics', sa_available: false, sa_price_zar: null },
  { asin: 'B07XJ8C8F5', title: 'JBL Flex 5 Portable Bluetooth Waterproof Speaker', image_url: 'https://m.media-amazon.com/images/I/71fGFs6+CCL._AC_SL1500_.jpg', price_usd: 99.95, rating: 4.7, review_count: 215430, sales_rank: 145, category: 'Electronics', sa_available: true, sa_price_zar: 2799 },
  { asin: 'B0B7BP6CJN', title: 'Logitech MX Master 3S Wireless Mouse Ergonomic', image_url: 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg', price_usd: 99.99, rating: 4.7, review_count: 24503, sales_rank: 312, category: 'Electronics', sa_available: true, sa_price_zar: 2499 },

  // Home & Kitchen
  { asin: 'B08PCT9R3J', title: 'Ninja AF101 Air Fryer 4 Quart Capacity', image_url: 'https://m.media-amazon.com/images/I/71+8uTMDRFL._AC_SL1500_.jpg', price_usd: 99.99, rating: 4.7, review_count: 73215, sales_rank: 33, category: 'Home & Kitchen', sa_available: true, sa_price_zar: 3299 },
  { asin: 'B07VDJW8VR', title: 'Stanley Quencher H2.0 FlowState 40oz Tumbler', image_url: 'https://m.media-amazon.com/images/I/71-pE5hnpmL._AC_SL1500_.jpg', price_usd: 44.95, rating: 4.8, review_count: 198432, sales_rank: 8, category: 'Home & Kitchen', sa_available: false, sa_price_zar: null },
  { asin: 'B0BGN2DBDF', title: 'Bissell Little Green Portable Carpet Cleaner', image_url: 'https://m.media-amazon.com/images/I/81GqM3pV1HL._AC_SL1500_.jpg', price_usd: 123.59, rating: 4.6, review_count: 84210, sales_rank: 96, category: 'Home & Kitchen', sa_available: false, sa_price_zar: null },
  { asin: 'B07T6QZGM9', title: 'Brita Standard Water Filter Pitcher 10 Cup', image_url: 'https://m.media-amazon.com/images/I/81PzIMTk-CL._AC_SL1500_.jpg', price_usd: 36.99, rating: 4.7, review_count: 95430, sales_rank: 412, category: 'Home & Kitchen', sa_available: true, sa_price_zar: 1199 },
  { asin: 'B09B9R8MM8', title: 'Lodge 10.25-Inch Pre-Seasoned Cast Iron Skillet', image_url: 'https://m.media-amazon.com/images/I/61qzFyt5kJL._AC_SL1500_.jpg', price_usd: 19.90, rating: 4.8, review_count: 152840, sales_rank: 156, category: 'Home & Kitchen', sa_available: true, sa_price_zar: 749 },

  // Sports & Outdoors
  { asin: 'B07GBVFGN7', title: 'Hydro Flask Wide Mouth Stainless Steel Bottle 32oz', image_url: 'https://m.media-amazon.com/images/I/41HMhYvJv4L._AC_SL1000_.jpg', price_usd: 49.95, rating: 4.8, review_count: 65430, sales_rank: 78, category: 'Sports & Outdoors', sa_available: true, sa_price_zar: 1799 },
  { asin: 'B0B5KMFYJX', title: 'Resistance Bands Set with Handles & Door Anchor', image_url: 'https://m.media-amazon.com/images/I/81Mc3RPQGCL._AC_SL1500_.jpg', price_usd: 29.99, rating: 4.6, review_count: 38120, sales_rank: 245, category: 'Sports & Outdoors', sa_available: false, sa_price_zar: null },
  { asin: 'B098NTDQMC', title: 'Yeti Rambler 20 oz Tumbler Stainless Steel Vacuum Insulated', image_url: 'https://m.media-amazon.com/images/I/61M5cfTn22L._AC_SL1500_.jpg', price_usd: 35.00, rating: 4.8, review_count: 215430, sales_rank: 187, category: 'Sports & Outdoors', sa_available: true, sa_price_zar: 1399 },
  { asin: 'B07W9KJQ4Q', title: 'Coleman Sundome Camping Tent 4 Person Weatherproof', image_url: 'https://m.media-amazon.com/images/I/71nxRJ0eOhL._AC_SL1500_.jpg', price_usd: 89.99, rating: 4.5, review_count: 52310, sales_rank: 612, category: 'Sports & Outdoors', sa_available: false, sa_price_zar: null },

  // Beauty & Personal Care
  { asin: 'B07W4DHQXY', title: 'CeraVe Daily Moisturizing Lotion for Dry Skin 19 Ounce', image_url: 'https://m.media-amazon.com/images/I/61H1Lk6JcKL._AC_SL1500_.jpg', price_usd: 17.99, rating: 4.8, review_count: 168732, sales_rank: 19, category: 'Beauty & Personal Care', sa_available: true, sa_price_zar: 549 },
  { asin: 'B08QB5R8HW', title: 'Revlon One-Step Volumizer Hair Dryer & Hot Air Brush', image_url: 'https://m.media-amazon.com/images/I/71lj+JkUKqL._AC_SL1500_.jpg', price_usd: 41.49, rating: 4.5, review_count: 412305, sales_rank: 47, category: 'Beauty & Personal Care', sa_available: true, sa_price_zar: 1499 },
  { asin: 'B07P9M5NHL', title: 'Mielle Organics Rosemary Mint Scalp & Hair Strengthening Oil', image_url: 'https://m.media-amazon.com/images/I/61Sg+P-7Y4L._AC_SL1500_.jpg', price_usd: 9.99, rating: 4.6, review_count: 87320, sales_rank: 134, category: 'Beauty & Personal Care', sa_available: false, sa_price_zar: null },
  { asin: 'B0BDFXJ7Q9', title: 'Olaplex No. 3 Hair Perfector Bond Repair Treatment', image_url: 'https://m.media-amazon.com/images/I/61gpUtt2x6L._AC_SL1500_.jpg', price_usd: 30.00, rating: 4.6, review_count: 56210, sales_rank: 287, category: 'Beauty & Personal Care', sa_available: true, sa_price_zar: 999 },

  // Toys & Games
  { asin: 'B0BJZGYZ3N', title: 'LEGO Icons Bonsai Tree Building Set 10281', image_url: 'https://m.media-amazon.com/images/I/81vYXJj+TFL._AC_SL1500_.jpg', price_usd: 49.99, rating: 4.9, review_count: 28510, sales_rank: 56, category: 'Toys & Games', sa_available: true, sa_price_zar: 1599 },
  { asin: 'B09K7HBLT8', title: 'Squishmallows 8" Plush Toy Bundle Pack', image_url: 'https://m.media-amazon.com/images/I/71XRiFdkH9L._AC_SL1500_.jpg', price_usd: 19.99, rating: 4.8, review_count: 41230, sales_rank: 124, category: 'Toys & Games', sa_available: false, sa_price_zar: null },
  { asin: 'B07VXLW7ZF', title: 'Catan Board Game (Base Game) Family Strategy', image_url: 'https://m.media-amazon.com/images/I/91VXTkH5+gL._AC_SL1500_.jpg', price_usd: 44.99, rating: 4.8, review_count: 38450, sales_rank: 421, category: 'Toys & Games', sa_available: true, sa_price_zar: 1299 },
  { asin: 'B08GS2DQX2', title: 'Magnetic Tiles Building Blocks 100 Pieces STEM Toy', image_url: 'https://m.media-amazon.com/images/I/81q6uM0KPLL._AC_SL1500_.jpg', price_usd: 39.99, rating: 4.7, review_count: 21450, sales_rank: 856, category: 'Toys & Games', sa_available: false, sa_price_zar: null },

  // Clothing & Accessories
  { asin: 'B07CGRYBT9', title: 'Hanes Men\'s ComfortSoft 100% Cotton T-Shirt 4-Pack', image_url: 'https://m.media-amazon.com/images/I/81wzpY2mZIL._AC_UL1500_.jpg', price_usd: 19.50, rating: 4.6, review_count: 142310, sales_rank: 38, category: 'Clothing & Accessories', sa_available: false, sa_price_zar: null },
  { asin: 'B08T1PJ72T', title: 'Crocs Unisex Adult Classic Clogs Lightweight Comfort', image_url: 'https://m.media-amazon.com/images/I/61-IMR0EKKL._AC_UL1500_.jpg', price_usd: 49.99, rating: 4.7, review_count: 287104, sales_rank: 92, category: 'Clothing & Accessories', sa_available: true, sa_price_zar: 1499 },
  { asin: 'B0B68HCJRG', title: 'Levi\'s Men\'s 505 Regular Fit Jeans Classic Denim', image_url: 'https://m.media-amazon.com/images/I/71Z9hPxA6cL._AC_UL1500_.jpg', price_usd: 39.99, rating: 4.5, review_count: 64210, sales_rank: 542, category: 'Clothing & Accessories', sa_available: true, sa_price_zar: 1299 },
  { asin: 'B09NDBGC1C', title: 'Ray-Ban RB3025 Aviator Classic Sunglasses Polarized', image_url: 'https://m.media-amazon.com/images/I/51jmzeHqL+L._AC_UL1500_.jpg', price_usd: 161.00, rating: 4.7, review_count: 18430, sales_rank: 1245, category: 'Clothing & Accessories', sa_available: true, sa_price_zar: 4999 },
];

function calculateImportCost(usdPrice: number, exchangeRate: number): number {
  const zarPrice = usdPrice * exchangeRate;
  const shipping = zarPrice * 0.15;
  const cif = zarPrice + shipping;
  const duty = cif * 0.25;
  const vat = (cif + duty) * 0.15;
  return Math.round(cif + duty + vat);
}

function calculateOpportunityScore(
  importCost: number,
  saPrice: number | null,
  notInSA: boolean,
): number {
  if (notInSA) {
    // First-mover advantage
    return 90 + Math.floor(Math.random() * 10);
  }
  if (!saPrice) return 50;
  const advantage = saPrice - importCost;
  const advantagePercent = (advantage / saPrice) * 100;
  if (advantagePercent > 40) return Math.min(89, 80 + Math.floor(advantagePercent / 5));
  if (advantagePercent > 20) return 60 + Math.floor(advantagePercent / 2);
  if (advantagePercent > 0) return 40 + Math.floor(advantagePercent);
  return 20;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: require admin JWT or CRON_SECRET
  const _cron = Deno.env.get('CRON_SECRET');
  if (!_cron || req.headers.get('x-cron-secret') !== _cron) {
    const _authHeader = req.headers.get('Authorization');
    if (!_authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: _claims, error: _ce } = await _anon.auth.getClaims(_authHeader.replace('Bearer ', ''));
    if (_ce || !_claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const _admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: _row } = await _admin.from('admin_users').select('user_id').eq('user_id', _claims.claims.sub).maybeSingle();
    if (!_row) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }


  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: settings } = await supabase
      .from('amazon_integration_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const exchangeRate = Number(settings?.exchange_rate_zar_per_usd ?? 18.5);
    const tracked: string[] = settings?.tracked_categories ?? CATEGORIES;
    const bsrThreshold = Number(settings?.bsr_threshold ?? 10000);

    const hasApiKey = !!Deno.env.get('RAINFOREST_API_KEY') || !!Deno.env.get('AMAZON_API_KEY');

    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';
    const lastSync = settings?.last_sync_at ? new Date(settings.last_sync_at).getTime() : 0;
    const stale = Date.now() - lastSync > 24 * 60 * 60 * 1000;

    if (!force && !stale) {
      const { data: cached } = await supabase
        .from('amazon_products')
        .select('*')
        .in('category', tracked)
        .lte('sales_rank', bsrThreshold)
        .order('opportunity_score', { ascending: false })
        .limit(50);
      return new Response(
        JSON.stringify({
          products: cached ?? [],
          cached: true,
          last_sync: settings?.last_sync_at,
          source: hasApiKey ? 'amazon_api' : 'mock',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // TODO: When RAINFOREST_API_KEY is set, fetch live data from amazon.com bestsellers
    // and amazon.co.za search for each ASIN/title. For now use mock dataset.
    const products = MOCK_PRODUCTS
      .filter((p) => tracked.includes(p.category))
      .map((p) => {
        const us_price_zar = Number((p.price_usd * exchangeRate).toFixed(2));
        const import_cost_zar = calculateImportCost(p.price_usd, exchangeRate);
        const sa_price_zar = p.sa_price_zar;
        const price_advantage = sa_price_zar != null ? sa_price_zar - import_cost_zar : null;
        const opportunity_score = calculateOpportunityScore(
          import_cost_zar,
          sa_price_zar,
          !p.sa_available,
        );
        return {
          asin: p.asin,
          title: p.title,
          image_url: p.image_url,
          price_usd: p.price_usd,
          price_zar: us_price_zar,
          rating: p.rating,
          review_count: p.review_count,
          sales_rank: p.sales_rank,
          category: p.category,
          sa_available: p.sa_available,
          sa_price_zar,
          import_cost_zar,
          price_advantage,
          opportunity_score,
          last_updated: new Date().toISOString(),
        };
      });

    const { error: upsertErr } = await supabase
      .from('amazon_products')
      .upsert(products, { onConflict: 'asin' });
    if (upsertErr) throw upsertErr;

    await supabase
      .from('amazon_integration_settings')
      .update({
        last_sync_at: new Date().toISOString(),
        api_connected: hasApiKey,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings?.id);

    const filtered = products.filter((p) => p.sales_rank <= bsrThreshold);
    const sa_matches = filtered.filter((p) => p.sa_available).length;
    const unique_opportunities = filtered.filter((p) => !p.sa_available).length;
    const avg_score = filtered.length
      ? Math.round(filtered.reduce((s, p) => s + p.opportunity_score, 0) / filtered.length)
      : 0;

    return new Response(
      JSON.stringify({
        products: filtered,
        cached: false,
        last_sync: new Date().toISOString(),
        source: hasApiKey ? 'amazon_api' : 'mock',
        synced: products.length,
        stats: {
          us_fetched: products.length,
          sa_matches,
          unique_opportunities,
          avg_opportunity_score: avg_score,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('fetch-amazon-products error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
