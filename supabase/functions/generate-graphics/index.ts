import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WEEKLY_LIMIT = 3

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt) return jsonResponse({ error: 'Prompt is required' }, 400)

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    // Tier check
    const { data: member } = await supabase
      .from('members')
      .select('buyers_club_tier, buyers_club_status')
      .eq('id', user.id)
      .single()

    const tier = member?.buyers_club_tier
    const status = member?.buyers_club_status
    const hasFlamePro =
      (tier === 'pro' && status === 'active') ||
      (tier === 'fulfilled' && status === 'active') ||
      tier === 'gold'

    // Weekly limit for free tier
    let currentCount = 0
    if (!hasFlamePro) {
      const today = new Date()
      const monday = new Date(today)
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      monday.setDate(diff)
      monday.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('flame_usage')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', user.id)
        .eq('asset_type', 'graphic')
        .gte('created_at', monday.toISOString())

      currentCount = count ?? 0
      if (currentCount >= WEEKLY_LIMIT) {
        return jsonResponse(
          {
            error: `Weekly limit reached (${WEEKLY_LIMIT}/${WEEKLY_LIMIT}). Upgrade to Buyers Club Pro for unlimited graphics.`,
            current_count: currentCount,
            weekly_limit: WEEKLY_LIMIT,
          },
          429,
        )
      }
    }

    // OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) return jsonResponse({ error: 'OpenAI API key not configured' }, 500)

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return jsonResponse({ error: data.error?.message || 'Generation failed' }, response.status)
    }

    // Log usage for free tier
    if (!hasFlamePro) {
      await supabase.from('flame_usage').insert({
        member_id: user.id,
        asset_type: 'graphic',
      })
      currentCount += 1
    }

    return jsonResponse({
      image_url:
        data.data[0].url ??
        (data.data[0].b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null),
      revised_prompt: data.data[0].revised_prompt || prompt,
      unlimited: hasFlamePro,
      used: hasFlamePro ? null : currentCount,
      remaining: hasFlamePro ? null : Math.max(0, WEEKLY_LIMIT - currentCount),
    })
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})
