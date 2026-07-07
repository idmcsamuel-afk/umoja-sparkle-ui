import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const brightDataApiKey = Deno.env.get('BRIGHT_DATA_API_KEY')

async function pollDataset(
  collectionId: string,
  maxWaitMs: number = 330000
): Promise<any[]> {
  const startTime = Date.now()
  const pollIntervalMs = 8000

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
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        continue
      }

      const rawText = await response.text()
      let data: any
      try { data = JSON.parse(rawText) } catch {
        console.log(`[${collectionId}] non-JSON body (first 300 chars): ${rawText.slice(0, 300)}`)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        continue
      }

      if (Array.isArray(data)) {
        console.log(`Collection ${collectionId} ready: ${data.length} products`)
        return data
      }

      // Bright Data returns various in-progress status strings depending on API version
      const status = (data?.status ?? '').toString().toLowerCase()
      const inProgress = ['processing', 'pending', 'running', 'building', 'collecting', 'in_progress', 'started', 'queued']
      if (inProgress.includes(status)) {
        console.log(`Collection ${collectionId} status=${status}, still processing...`)
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        continue
      }

      // Log the actual response so we can debug what Bright Data returned
      console.log(`[${collectionId}] unexpected response (first 500 chars): ${rawText.slice(0, 500)}`)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))

    } catch (error) {
      console.error(`Poll error for ${collectionId}:`, error)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
  }

  console.error(`Timeout waiting for collection ${collectionId}`)
  return []
}

serve(async (_req) => {
  try {
    console.log('Starting collection polling...')

    const { data: pendingJobs, error: queryError } = await supabase
      .from('takealot_scrape_jobs')
      .select('*')
      .eq('status', 'pending')

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('No pending jobs to collect')
      return new Response(
        JSON.stringify({ status: 'success', message: 'No pending jobs', jobs_processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingJobs.length} pending jobs`)

    const jobIds = pendingJobs.map(j => j.id)
    await supabase
      .from('takealot_scrape_jobs')
      .update({ status: 'polling', polling_started_at: new Date().toISOString() })
      .in('id', jobIds)

    const pollPromises = pendingJobs.map(job =>
      pollDataset(job.collection_id)
        .then(products => ({
          job_id: job.id,
          collection_id: job.collection_id,
          category: job.category,
          products,
          success: true as const,
          error: undefined as string | undefined
        }))
        .catch(error => ({
          job_id: job.id,
          collection_id: job.collection_id,
          category: job.category,
          products: [] as any[],
          success: false as const,
          error: (error as Error).message as string | undefined
        }))
    )

    const pollResults = await Promise.all(pollPromises)
    const successfulPolls = pollResults.filter(r => r.success && r.products.length > 0)

    console.log(`Polling complete: ${successfulPolls.length}/${pollResults.length} jobs returned data`)

    const allProducts: any[] = []

    for (const result of successfulPolls) {
      for (const product of result.products.slice(0, 100)) {
        let priceValue = 0
        if (product.price) {
          priceValue = typeof product.price === 'object'
            ? product.price.value || 0
            : product.price
        }

        allProducts.push({
          takealot_name: product.product_title || 'Unknown',
          takealot_price: priceValue,
          takealot_url: product.product_url || '',
          category: result.category.replace('-', ' '),
          seller_count: product.seller_count || 1,
          rating: product.rating || null,
          image_url: product.image_url || '',
          scraped_at: new Date().toISOString()
        })
      }
    }

    console.log(`Total products collected: ${allProducts.length}`)

    if (allProducts.length > 0) {
      const { error: insertError } = await supabase
        .from('takealot_products')
        .insert(allProducts)

      if (insertError) {
        console.error('Insert error:', insertError)
        return new Response(
          JSON.stringify({
            error: insertError.message,
            collected: allProducts.length,
            jobs_processed: pollResults.length
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    for (const result of pollResults) {
      await supabase
        .from('takealot_scrape_jobs')
        .update({
          status: result.success ? 'complete' : 'failed',
          product_count: result.products.length,
          error_message: result.error || null,
          polling_completed_at: new Date().toISOString()
        })
        .eq('id', result.job_id)
    }

    console.log(`Collection complete: ${allProducts.length} products inserted`)

    return new Response(
      JSON.stringify({
        status: 'success',
        jobs_processed: pollResults.length,
        successful_collections: successfulPolls.length,
        products_inserted: allProducts.length,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Collection error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
