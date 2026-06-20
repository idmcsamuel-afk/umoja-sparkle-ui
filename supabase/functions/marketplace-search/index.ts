import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const rainforestKey = Deno.env.get("RAINFOREST_API_KEY");
const brightDataKey = Deno.env.get("BRIGHT_DATA_API_KEY");

const makroSeedProducts = [
  {
    marketplace: "makro",
    name: "Portable Phone Charger 25000mAh",
    price: 45,
    currency: "ZAR",
    stock: 500,
    url: "https://makro.co.za/portable-charger",
    image_url: "https://cdn.makro.co.za/charger.jpg",
  },
  {
    marketplace: "makro",
    name: "Wireless Charger 15W",
    price: 89,
    currency: "ZAR",
    stock: 200,
    url: "https://makro.co.za/wireless-charger",
    image_url: "https://cdn.makro.co.za/wireless.jpg",
  },
  {
    marketplace: "makro",
    name: "USB-C Cable 2m",
    price: 29,
    currency: "ZAR",
    stock: 1000,
    url: "https://makro.co.za/usb-c",
    image_url: "https://cdn.makro.co.za/cable.jpg",
  },
  {
    marketplace: "makro",
    name: "Power Bank 20000mAh",
    price: 65,
    currency: "ZAR",
    stock: 300,
    url: "https://makro.co.za/power-bank",
    image_url: "https://cdn.makro.co.za/powerbank.jpg",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const marketplaces = url.searchParams.get("marketplaces")?.split(",") || ["amazon", "takealot"];
    const country = url.searchParams.get("country") || "ZA";

    if (!query) {
      return new Response(
        JSON.stringify({ error: "q parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];

    if (marketplaces.includes("makro")) {
      const makroResults = makroSeedProducts.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
      results.push(...makroResults);
    }

    if (marketplaces.includes("amazon")) {
      try {
        const amazonResponse = await fetch("https://api.rainforestapi.com/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: rainforestKey,
            type: "search",
            amazon_domain: "amazon.com",
            search_term: query,
            country: country === "ZA" ? "US" : country,
          }),
        });

        const amazonData = await amazonResponse.json();
        if (amazonData.products) {
          for (const product of amazonData.products.slice(0, 5)) {
            results.push({
              marketplace: "amazon",
              name: product.title,
              price: product.price?.value || 0,
              currency: "USD",
              sales_rank: product.sales_rank,
              rating: product.rating,
              url: product.link,
              image_url: product.image,
            });
          }
        }
      } catch (e) {
        console.error("Amazon error:", e);
      }
    }

    if (marketplaces.includes("takealot")) {
      try {
        const takealotResponse = await fetch("https://api.brightdata.com/datasets/gdc/query", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${brightDataKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dataset: "ecommerce",
            query: {
              url: `https://www.takealot.com/search?qsearch=${encodeURIComponent(query)}`,
              parse: true,
              render_javascript: true,
            },
          }),
        });

        const takealotData = await takealotResponse.json();
        if (takealotData.results) {
          for (const product of takealotData.results.slice(0, 5)) {
            results.push({
              marketplace: "takealot",
              name: product.title,
              price: product.price,
              currency: "ZAR",
              seller_count: product.seller_count || 1,
              rating: product.rating,
              url: product.url,
              image_url: product.image_url,
            });
          }
        }
      } catch (e) {
        console.error("Takealot error:", e);
      }
    }

    return new Response(
      JSON.stringify({ query, country, results, total: results.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
