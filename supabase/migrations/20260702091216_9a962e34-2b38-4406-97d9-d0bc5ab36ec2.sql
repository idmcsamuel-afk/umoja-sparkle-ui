with cat as (
  select id, product_name, category, moq_required, unit_cost_zar, landed_cost_zar, landed_cost_sea_zar, suggested_selling_price_zar, product_image_url, gross_margin_sea_zar, gross_margin_air_zar, margin_sea_pct, margin_air_pct, air_available
  from public.spark_trade_opportunities
  where is_spotlight = true
),
scored as (
  select *,
    greatest(5, ceil(coalesce(moq_required,0) * 0.10))::int as entry_qty,
    coalesce(nullif(landed_cost_sea_zar,0), nullif(landed_cost_zar,0), nullif(unit_cost_zar,0), 0) as landed
  from cat
),
calc as (
  select *, (entry_qty * landed) as entry_cost, ((entry_qty * landed) <= 5000) as fits
  from scored
),
picks as (
  select * from calc where fits
  order by coalesce(margin_sea_pct,0) desc
  limit 5
),
agg as (
  select
    jsonb_agg(jsonb_build_object(
      'opportunity_id', id,
      'name', product_name,
      'category', category,
      'image_url', product_image_url,
      'moq', moq_required,
      'recommended_entry_qty', entry_qty,
      'recommended_entry_cost_zar', round(entry_cost),
      'unit_cost_zar', landed,
      'suggested_selling_price_zar', suggested_selling_price_zar,
      'margin_sea_pct', margin_sea_pct,
      'margin_air_pct', margin_air_pct,
      'gross_margin_sea_zar', gross_margin_sea_zar,
      'gross_margin_air_zar', gross_margin_air_zar,
      'air_available', coalesce(air_available,false),
      'fits_capital', fits
    ) order by coalesce(margin_sea_pct,0) desc) as products,
    round(sum(entry_cost))::int as startup,
    round(avg(coalesce(margin_sea_pct,0)))::int as margin_pct,
    round(sum(coalesce(suggested_selling_price_zar,0) * entry_qty))::int as revenue
  from picks
)
insert into public.spark_trade_blueprints
  (member_id, income_goal, recommended_business_name, recommended_products,
   estimated_startup_capital, estimated_monthly_revenue, estimated_gross_margin,
   estimated_launch_timeline_days, confidence_score, blueprint_json)
select
  '12469fec-57da-41b8-8a40-2c9610bfbc21',
  20000,
  'Electronics Trader',
  a.products,
  a.startup,
  a.revenue,
  a.margin_pct,
  42,
  90,
  jsonb_build_object(
    'recommended_business_name', 'Electronics Trader',
    'recommended_products', a.products,
    'estimated_startup_capital', a.startup,
    'estimated_monthly_revenue', a.revenue,
    'estimated_gross_margin', a.margin_pct || '%',
    'overall_moq_fill_percentage', null,
    'estimated_launch_timeline_days', 42,
    'confidence_score', 90,
    'capital_input_zar', 5000,
    'income_goal_zar', 20000,
    'catalog_source', 'spark_trade_opportunities.is_spotlight'
  )
from agg a
where a.products is not null
  and not exists (
    select 1 from public.spark_trade_blueprints
    where member_id = '12469fec-57da-41b8-8a40-2c9610bfbc21'
  );