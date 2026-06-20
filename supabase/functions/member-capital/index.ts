import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const pathParts = new URL(req.url).pathname.split('/').filter(Boolean)
    const memberId = pathParts[pathParts.length - 1]

    if (!memberId || memberId === 'member-capital') {
      return new Response(
        JSON.stringify({ error: 'memberId required in URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('balance')
      .eq('id', memberId)
      .single()

    if (memberError) {
      return new Response(
        JSON.stringify({ error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const totalCapital = Number((member as any)?.balance) || 0

    const { data: reservations } = await supabase
      .from('spark_trade_inventory_reservations')
      .select('total_cost')
      .eq('member_id', memberId)
      .eq('payment_status', 'paid')

    const reservedAmount = reservations?.reduce((sum: number, r: any) => sum + (Number(r.total_cost) || 0), 0) || 0

    const { data: investments } = await supabase
      .from('spark_trade_group_brand_investors')
      .select('investment_amount')
      .eq('member_id', memberId)
      .eq('payment_status', 'verified')

    const investedAmount = investments?.reduce((sum: number, i: any) => sum + (Number(i.investment_amount) || 0), 0) || 0

    const reservedCapital = reservedAmount + investedAmount
    const availableCapital = Math.max(0, totalCapital - reservedCapital)

    return new Response(
      JSON.stringify({
        member_id: memberId,
        total_capital: totalCapital,
        available_capital: availableCapital,
        reserved_capital: reservedCapital,
        breakdown: {
          inventory_reservations: reservedAmount,
          group_brand_investments: investedAmount,
        },
        can_reserve: availableCapital > 0,
        max_reserve_amount: availableCapital,
        last_updated: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
