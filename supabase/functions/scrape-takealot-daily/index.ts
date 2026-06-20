import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataApiKey = Deno.env.get('BRIGHT_DATA_API_KEY')

const categories = [
  'electronics',
  'fashion',
  'home-garden',
  'books',
  'sports-outdoors'
]

serve(async (req) => {
  try {
    console.log('Starting Takealot scrape via Bright Data Discover API...')

    const allProducts: any[] = []

    for (const category of categories) {
      const categoryUrl = `https://www.takealot.com/${category}`

      console.log(`Scraping ${category} from ${categoryUrl}...`)

      try {
        const response = await fetch('https://api.brightdata.com/discover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${brightDataApiKey}`
          },
          body: JSON.stringify({
            query: categoryUrl,
            mode: 'standard',
            language: 'en',
            country: 'ZA',
            format: 'json',
            remove_duplicates: true,
            include_content: false,
            include_images: false
          })
        })

        if (!response.ok) {
          console.error(`Bright Data error for ${category}: ${response.status}`)
          const errText = await response.text()
          console.error(`Body: ${errText}`)
          continue
        }

        const data = await response.json()

        if (Array.isArray(data) && data.length > 0) {
          for (const product of data.slice(0, 100)) {
            allProducts.push({
              takealot_name: product.product_title || product.name || 'Unknown',
              takealot_price: product.price?.value || product.price || 0,
              takealot_url: product.product_url || product.url || '',
              category: category.replace('-', ' '),
              seller_count: product.seller_count || 1,
              rating: product.rating || null,
              image_url: product.image_url || product.image || '',
              scraped_at: new Date().toISOString()
            })
          }
          console.log(`Found ${data.length} products in ${category}`)
        } else {
          console.log(`No products found in ${category}`)
        }
      } catch (categoryError) {
        console.error(`Error scraping ${category}:`, categoryError)
        continue
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
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
