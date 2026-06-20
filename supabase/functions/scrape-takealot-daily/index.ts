import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataKey = Deno.env.get('BRIGHT_DATA_API_KEY')

const categories = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Home & Garden', slug: 'home-garden' },
  { name: 'Books', slug: 'books' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting Takealot scrape...')

    if (!brightDataKey) {
      return new Response(
        JSON.stringify({ error: 'BRIGHT_DATA_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allProducts: any[] = []

    for (const category of categories) {
      console.log(`Scraping ${category.name}...`)

      try {
        const response = await fetch('https://api.brightdata.com/datasets/gdc/query', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${brightDataKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dataset: 'ecommerce',
            query: {
              url: `https://www.takealot.com/${category.slug}`,
              render_javascript: true,
              parse: true,
            },
          }),
        })

        if (!response.ok) {
          console.error(`Bright Data error for ${category.name}: ${response.status}`)
          continue
        }

        const data = await response.json()

        if (data.results && Array.isArray(data.results)) {
          for (const product of data.results.slice(0, 100)) {
            allProducts.push({
              takealot_name: product.title || product.name,
              takealot_price: parseFloat(product.price) || 0,
              takealot_url: product.url,
              category: category.name,
              seller_count: product.seller_count || 1,
              rating: parseFloat(product.rating) || null,
              image_url: product.image_url,
              scraped_at: new Date().toISOString(),
            })
          }
          console.log(`Found ${data.results.length} products in ${category.name}`)
        }
      } catch (categoryError) {
        console.error(`Error scraping ${category.name}:`, categoryError)
        continue
      }
    }

    if (allProducts.length > 0) {
      const { error } = await supabase
        .from('takealot_products')
        .insert(allProducts)

      if (error) {
        console.error('Insert error:', error)
        return new Response(
          JSON.stringify({ error: error.message, count: 0 }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Scrape complete: ${allProducts.length} products`)

    return new Response(
      JSON.stringify({
        status: 'success',
        scraped_count: allProducts.length,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Scrape error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
