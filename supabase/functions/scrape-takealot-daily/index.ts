import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataApiKey = Deno.env.get('BRIGHT_DATA_API_KEY')
const collectorId = 'c_mqmoy84l1pihbltggn'

const categories = [
  'electronics',
  'fashion',
  'home-garden',
  'books',
  'sports-outdoors'
]

serve(async (req) => {
  try {
    console.log('Starting Takealot scrape via Bright Data DCA API...')

    const allProducts: any[] = []

    for (const category of categories) {
      const categoryUrl = `https://www.takealot.com/${category}`

      console.log(`Scraping ${category} from ${categoryUrl}...`)

      try {
        const response = await fetch(
          `https://api.brightdata.com/dca/trigger?collector=${collectorId}&queue_next=1`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${brightDataApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify([{ url: categoryUrl }])
          }
        )

        if (!response.ok) {
          console.error(`Bright Data error for ${category}: ${response.status}`)
          const errorText = await response.text()
          console.error(`Error response: ${errorText}`)
          continue
        }

        const data = await response.json()

        if (Array.isArray(data) && data.length > 0) {
          for (const product of data.slice(0, 100)) {
            let priceValue = 0
            if (product.price) {
              priceValue = typeof product.price === 'object' ? product.price.value || 0 : product.price
            }

            allProducts.push({
              takealot_name: product.product_title || 'Unknown',
              takealot_price: priceValue,
              takealot_url: product.product_url || '',
              category: category.replace('-', ' '),
              seller_count: product.seller_count || 1,
              rating: product.rating || null,
              image_url: product.image_url || '',
              scraped_at: new Date().toISOString()
            })
          }
          console.log(`Found ${data.length} products in ${category}`)
        } else {
          console.log(`No products found in ${category}: ${JSON.stringify(data).slice(0, 300)}`)
        }
      } catch (categoryError) {
        console.error(`Error scraping ${category}:`, categoryError)
        continue
      }

      await new Promise(resolve => setTimeout(resolve, 500))
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
