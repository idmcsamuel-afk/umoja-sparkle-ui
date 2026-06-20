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

serve(async (_req) => {
  try {
    console.log('Triggering Bright Data scrapes for all categories...')

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
          collection_id: data.collection_id as string | undefined,
          success: !!data.collection_id
        }))
        .catch(error => ({
          category,
          collection_id: undefined,
          success: false,
          error: (error as Error).message
        }))
    )

    const triggerResults = await Promise.all(triggerPromises)
    const successfulTriggers = triggerResults.filter(r => r.success && r.collection_id)

    console.log(`Triggered ${successfulTriggers.length}/${categories.length} categories`)

    const jobsToInsert = successfulTriggers.map(trigger => ({
      collection_id: trigger.collection_id!,
      category: trigger.category,
      status: 'pending'
    }))

    if (jobsToInsert.length > 0) {
      const { error } = await supabase
        .from('takealot_scrape_jobs')
        .insert(jobsToInsert)

      if (error) {
        console.error('Error storing jobs:', error)
        return new Response(
          JSON.stringify({
            status: 'error',
            message: 'Failed to store collection_ids',
            triggers: triggerResults.length,
            successful: successfulTriggers.length
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log(`Stored ${jobsToInsert.length} pending jobs. Collection will happen in 6 min.`)

    return new Response(
      JSON.stringify({
        status: 'triggered',
        triggers_sent: triggerResults.length,
        successful_triggers: successfulTriggers.length,
        jobs_stored: jobsToInsert.length,
        message: 'Scrapes triggered. Results will be collected in 6 minutes.',
        timestamp: new Date().toISOString()
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Trigger error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message, status: 'error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
