import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataKey = Deno.env.get('BRIGHT_DATA_API_KEY')
const datasetId = 'j_mqmpsczd257dozluc0'

const categories = [
  'electronics',
  'fashion',
  'home-garden',
  'books',
  'sports-outdoors'
]

serve(async (req) => {
  try {
    console.log('Starting Takealot scrape via Bright Data Dataset...')

    const allProducts: any[] = []

    for (const category of categories) {
      console.log(`Scraping ${category}...`)

      try {
        const categoryUrl = `https://www.takealot.com/${category}`

        const response = await fetch(`https://api.brightdata.com/datasets/${datasetId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${brightDataKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: categoryUrl })
        })

        if (!response.ok) {
          console.error(`Bright Data error for ${category}: ${response.status}`)
          const errorText = await response.text()
          console.error(`Error details: ${errorText}`)
          continue
        }

        const data = await response.json()

        let products: any[] = []
        if (Array.isArray(data)) {
          products = data
        } else if (data.results && Array.isArray(data.results)) {
          products = data.results
        }

        if (products.length > 0) {
          for (const product of products.slice(0, 100)) {
            allProducts.push({
              takealot_name: product.product_title || 'Unknown',
              takealot_price: product.price?.value || 0,
              takealot_url: product.product_url,
              category: category.replace('-', ' '),
              seller_count: product.seller_count || 1,
              rating: product.rating || null,
              image_url: product.image_url,
              scraped_at: new Date().toISOString()
            })
          }
          console.log(`Found ${products.length} products in ${category}`)
        } else {
          console.log(`No products found in ${category}`)
        }
      } catch (categoryError) {
        console.error(`Error scraping ${category}:`, categoryError)
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
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Scrape complete: ${allProducts.length} products scraped and inserted`)

    return new Response(
      JSON.stringify({
        status: 'success',
        scraped_count: allProducts.length,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Scrape error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
