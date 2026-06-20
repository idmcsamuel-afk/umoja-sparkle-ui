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

async function pollDataset(collectionId: string, maxWaitMs = 180000): Promise<any[]> {
  const startTime = Date.now()
  const pollIntervalMs = 5000

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(
        `https://api.brightdata.com/dca/dataset?id=${collectionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${brightDataApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`Poll error for ${collectionId}: ${response.status}`)
        await new Promise(r => setTimeout(r, pollIntervalMs))
        continue
      }

      const data = await response.json()

      if (Array.isArray(data)) {
        console.log(`Collection ${collectionId} ready: ${data.length} products`)
        return data
      }

      if (data.status === 'processing' || data.status === 'pending' || data.status === 'building' || data.status === 'collecting') {
        console.log(`Collection ${collectionId} status: ${data.status}`)
        await new Promise(r => setTimeout(r, pollIntervalMs))
        continue
      }

      console.log(`Collection ${collectionId}: unexpected response ${JSON.stringify(data).slice(0, 200)}`)
      await new Promise(r => setTimeout(r, pollIntervalMs))
    } catch (error) {
      console.error(`Poll error for ${collectionId}:`, error)
      await new Promise(r => setTimeout(r, pollIntervalMs))
    }
  }

  console.error(`Timeout waiting for collection ${collectionId}`)
  return []
}

serve(async (_req) => {
  try {
    console.log('Starting parallel Takealot scrape via Bright Data DCA API...')

    const triggerPromises = categories.map(category =>
      fetch(
        `https://api.brightdata.com/dca/trigger?collector=${collectorId}&queue_next=1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${brightDataApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ url: `https://www.takealot.com/${category}` }])
        }
      )
        .then(res => res.json())
        .then(data => ({
          category,
          collectionId: data.collection_id as string | undefined,
          success: !!data.collection_id
        }))
        .catch(error => ({
          category,
          collectionId: undefined,
          success: false,
          error: (error as Error).message
        }))
    )

    const triggerResults = await Promise.all(triggerPromises)
    const successfulTriggers = triggerResults.filter(r => r.success && r.collectionId)
    console.log(`Triggered ${successfulTriggers.length}/${categories.length} categories`)

    if (successfulTriggers.length === 0) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Failed to trigger any categories', scraped_count: 0 }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const pollResults = await Promise.all(
      successfulTriggers.map(trigger =>
        pollDataset(trigger.collectionId!)
          .then(products => ({ category: trigger.category, products, success: true as const }))
          .catch(error => ({ category: trigger.category, products: [] as any[], success: false as const, error: (error as Error).message }))
      )
    )

    const allProducts: any[] = []
    for (const pr of pollResults) {
      if (pr.success && Array.isArray(pr.products)) {
        for (const product of pr.products.slice(0, 100)) {
          let priceValue = 0
          if (product.price) {
            priceValue = typeof product.price === 'object' ? (product.price.value || 0) : product.price
          }
          allProducts.push({
            takealot_name: product.product_title || product.title || 'Unknown',
            takealot_price: priceValue,
            takealot_url: product.product_url || product.url || '',
            category: pr.category.replace('-', ' '),
            seller_count: product.seller_count || 1,
            rating: product.rating || null,
            image_url: product.image_url || product.image || '',
            scraped_at: new Date().toISOString()
          })
        }
      }
    }

    console.log(`Total products collected: ${allProducts.length}`)

    if (allProducts.length > 0) {
      const { error } = await supabase.from('takealot_products').insert(allProducts)
      if (error) {
        console.error('Insert error:', error)
        return new Response(
          JSON.stringify({ error: error.message, scraped_count: 0, collected: allProducts.length }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        scraped_count: allProducts.length,
        timestamp: new Date().toISOString(),
        triggers: triggerResults.length,
        successful_triggers: successfulTriggers.length,
        successful_polls: pollResults.filter(r => r.success).length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Scrape error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message, status: 'error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
