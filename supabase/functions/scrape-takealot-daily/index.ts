import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataKey = Deno.env.get('BRIGHT_DATA_API_KEY')
const brightDataZone = 'umoja_web_unlocker1'

const categories = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Home & Garden', slug: 'home-garden' },
  { name: 'Books', slug: 'books' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' }
]

serve(async (req) => {
  try {
    console.log('Starting Takealot scrape with Web Unlocker API...')

    const allProducts: any[] = []

    for (const category of categories) {
      console.log(`Scraping ${category.name}...`)

      try {
        const takealotUrl = `https://www.takealot.com/${category.slug}`

        const response = await fetch('https://api.brightdata.com/request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${brightDataKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zone: brightDataZone,
            url: takealotUrl,
            format: 'json'
          })
        })

        if (!response.ok) {
          console.error(`Bright Data error for ${category.name}: ${response.status}`)
          const errorText = await response.text()
          console.error(`Error details: ${errorText}`)
          continue
        }

        const data = await response.json()
        console.log(`Bright Data response for ${category.name}:`, { status: response.status, dataType: typeof data })

        let products: any[] = []

        if (Array.isArray(data)) {
          products = data
        } else if (data.products && Array.isArray(data.products)) {
          products = data.products
        } else if (data.result && Array.isArray(data.result)) {
          products = data.result
        }

        if (products.length > 0) {
          for (const product of products.slice(0, 100)) {
            allProducts.push({
              takealot_name: product.title || product.name || product.product_name || 'Unknown',
              takealot_price: parseFloat(product.price) || parseFloat(product.current_price) || 0,
              takealot_url: product.url || product.link || takealotUrl,
              category: category.name,
              seller_count: product.seller_count || product.sellers || 1,
              rating: parseFloat(product.rating) || parseFloat(product.score) || null,
              image_url: product.image_url || product.image || product.thumbnail || null,
              scraped_at: new Date().toISOString()
            })
          }
          console.log(`Found ${products.length} products in ${category.name}`)
        } else {
          console.log(`No products found in ${category.name}`)
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
