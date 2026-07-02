
-- Sparkwheel — audit table + atomic spin RPC (adapted to actual spark_wallets column names)
create table if not exists public.sparkwheel_games (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null,
  bucket_used         text not null check (bucket_used in ('promotional','earned','purchased','referral')),
  stake_amount        numeric(18,2) not null check (stake_amount > 0),
  outcome_multiplier  numeric(6,2) not null check (outcome_multiplier >= 0),
  payout_amount       numeric(18,2) not null default 0 check (payout_amount >= 0),
  house_edge          numeric(6,4) not null,
  daily_game_count    integer not null check (daily_game_count between 1 and 10),
  "timestamp"         timestamptz not null default now()
);

GRANT SELECT ON public.sparkwheel_games TO authenticated;
GRANT ALL ON public.sparkwheel_games TO service_role;

alter table public.sparkwheel_games enable row level security;

create index if not exists idx_sparkwheel_games_member_time
  on public.sparkwheel_games (member_id, "timestamp" desc);

drop policy if exists "sparkwheel_select_own" on public.sparkwheel_games;
create policy "sparkwheel_select_own"
  on public.sparkwheel_games for select
  using (auth.uid() = member_id);

-- Atomic spin RPC
create or replace function public.spin_sparkwheel(
  p_member_id    uuid,
  p_bucket       text,
  p_stake_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_promo       boolean := (p_bucket = 'promotional');
  v_col            text;
  v_bucket_balance numeric;
  v_daily_count    integer;
  v_daily_limit    constant integer := 10;
  v_roll           integer;
  v_multiplier     numeric(6,2);
  v_payout         numeric(18,2);
  v_house_edge     numeric(6,4);
  v_balances       jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_member_id then
    raise exception 'Not authorised to spin for this member.' using errcode = '42501';
  end if;

  v_col := case p_bucket
    when 'promotional' then 'promotional_balance'
    when 'earned'      then 'earned_balance'
    when 'purchased'   then 'purchased_balance'
    when 'referral'    then 'referral_balance'
    else null
  end;
  if v_col is null then
    raise exception 'Invalid bucket: %', p_bucket using errcode = '22023';
  end if;

  if p_stake_amount is null or p_stake_amount <= 0 then
    raise exception 'Stake must be greater than zero.' using errcode = '22023';
  end if;

  perform 1 from public.spark_wallets where member_id = p_member_id for update;
  if not found then
    raise exception 'Wallet not found for member.' using errcode = 'P0002';
  end if;

  execute format('select %I from public.spark_wallets where member_id = $1', v_col)
    into v_bucket_balance using p_member_id;

  if coalesce(v_bucket_balance, 0) < p_stake_amount then
    raise exception 'Insufficient % balance: have %, need %',
      p_bucket, coalesce(v_bucket_balance, 0), p_stake_amount using errcode = 'P0001';
  end if;

  select count(*) into v_daily_count
  from public.sparkwheel_games
  where member_id = p_member_id
    and "timestamp" >= date_trunc('day', now());

  if v_daily_count >= v_daily_limit then
    raise exception 'Daily spin limit reached (%/%).', v_daily_count, v_daily_limit
      using errcode = 'P0001';
  end if;

  v_roll := floor(random() * 1000) + 1;
  if v_is_promo then
    v_house_edge := 0.4150;
    v_multiplier := case
      when v_roll <= 700 then 0
      when v_roll <= 850 then 1.2
      when v_roll <= 920 then 1.5
      when v_roll <= 970 then 2
      when v_roll <= 990 then 5
      else 10 end;
  else
    v_house_edge := 0.1660;
    v_multiplier := case
      when v_roll <= 550 then 0
      when v_roll <= 770 then 1.2
      when v_roll <= 890 then 1.5
      when v_roll <= 960 then 2
      when v_roll <= 990 then 5
      else 10 end;
  end if;

  v_payout := round(p_stake_amount * v_multiplier, 2);

  execute format('update public.spark_wallets set %I = %I - $1 where member_id = $2', v_col, v_col)
    using p_stake_amount, p_member_id;

  if v_payout > 0 then
    update public.spark_wallets
      set earned_balance = coalesce(earned_balance,0) + v_payout
      where member_id = p_member_id;
  end if;

  insert into public.sparkwheel_games (
    member_id, bucket_used, stake_amount, outcome_multiplier,
    payout_amount, house_edge, daily_game_count
  ) values (
    p_member_id, p_bucket, p_stake_amount, v_multiplier,
    v_payout, v_house_edge, v_daily_count + 1
  );

  select jsonb_build_object(
    'promotional', coalesce(promotional_balance,0),
    'earned',      coalesce(earned_balance,0),
    'purchased',   coalesce(purchased_balance,0),
    'referral',    coalesce(referral_balance,0)
  ) into v_balances
  from public.spark_wallets
  where member_id = p_member_id;

  return jsonb_build_object(
    'outcome_multiplier', v_multiplier,
    'payout_amount',      v_payout,
    'won',                (v_payout > 0),
    'house_edge',         v_house_edge,
    'daily_game_count',   v_daily_count + 1,
    'daily_remaining',    v_daily_limit - (v_daily_count + 1),
    'balances',           v_balances
  );
end;
$$;

grant execute on function public.spin_sparkwheel(uuid, text, numeric) to authenticated;
