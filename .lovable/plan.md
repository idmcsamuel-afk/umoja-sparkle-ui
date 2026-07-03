## Member MOQ + Aggregation Engine

Two floors, one factory MOQ, one live viability preview — everywhere.

---

### 1. Settings (migration + admin UI later)

Insert two rows into `spark_trade_settings`:
- `min_item_buyin_zar` = **400** — per-item member floor (landed R)
- `min_order_total_zar` = **2500** — whole-order minimum

These become the global defaults everywhere; Idara can edit values in-DB (existing admin settings surface can be extended in a follow-up).

### 2. Schema

Migration on `spark_trade_opportunities`:
- Add `member_min_buyin_zar numeric NULL` — per-product override of the R400 floor.
- `moq_required` (already exists) is now **treated as real factory MOQ** — no more silent default of 100. Approve/Edit forms require Idara to type it.

### 3. Shared helper

New `src/lib/sparkTradeMoq.ts` exports:
```ts
computeMemberMoq({ landedCostZar, memberMinBuyinZar, globalMinItem }) 
  → { memberMoqUnits, membersNeeded, effectiveMinItem }
```
`memberMoqUnits = ceil(effectiveMinItem / landedCostZar)`, `membersNeeded = ceil(factoryMoq / memberMoqUnits)`.

Plus a `useSparkTradeSettings()` hook that fetches both floors once and caches them (falls back to 400 / 2500).

### 4. Approve & Publish form (`AdminProductValidation.tsx`)

- MOQ input relabelled **"Factory MOQ (units) — REQUIRED"**, no `|| 100` default; blocks publish if blank/0.
- New input: **Member minimum buy-in (ZAR)** — optional, placeholder shows current global R400.
- Live preview block (when landed_sea > 0) shows: 
  `Each member buys min {memberMoqUnits} units (R{floor}). {membersNeeded} members needed to fill factory order of {factoryMoq}.`
- Payload writes `moq_required` and `member_min_buyin_zar` (or null).

### 5. Edit Pricing dialog (`SparkTradeAdminDashboard.tsx` → `PricingEditor`)

- Factory MOQ field relabelled + required.
- New "Member minimum buy-in (ZAR)" field.
- Same live preview block underneath.
- Save payload includes `member_min_buyin_zar` (nullable) → edge function `admin-update-opportunity-pricing` persists it.

### 6. Member group-buy card / dialog (`SparkTradeProductOpportunities.tsx`)

- Load opportunity fields `member_min_buyin_zar` + `landed_cost_sea_zar` (already selected).
- Compute `memberMoqUnits` per product using the helper and the settings hook.
- Card: replace `maxUnitsPerPerson`-based copy with `"Minimum {memberMoqUnits} units (R{floor})"` and `{members_needed}` denominators (use members_needed instead of hardcoded 10).
- Dialog: `qty` starts at `memberMoqUnits`, `min={memberMoqUnits}`, error copy uses member MOQ.
- Line total already = `qty × landedPerUnit` — unchanged.

### 7. Order-total floor at checkout

Since checkout is currently one product at a time (no multi-item cart yet), enforce `totalCost >= min_order_total_zar` in the reserve dialog:
- Disable "Complete & Pay" and show `"Add R{shortfall} more to reach the R2,500 minimum order."`
- Message wording exactly as requested.

(If/when a real multi-product cart lands, the same helper is already the source of truth.)

### 8. Blueprint MOQ label (`SparkTradeAIBlueprint.tsx`)

Line 198 currently prints `MOQ: {p.moq}` from the AI blueprint. Replace with a member-facing MOQ using the same formula: `MOQ: {ceil(400 / unit_cost_zar)} units` when `p.unit_cost_zar > 0`, else fall back to the AI value. This aligns the blueprint with what a member actually has to buy.

---

### Files touched

- **migration** — add 2 settings rows + `member_min_buyin_zar` column
- `src/lib/sparkTradeMoq.ts` (new) — helper + settings hook
- `src/pages/admin/AdminProductValidation.tsx` — MOQ required, new field, preview
- `src/pages/SparkTradeAdminDashboard.tsx` — PricingEditor field + preview
- `supabase/functions/admin-update-opportunity-pricing/index.ts` — persist `member_min_buyin_zar`
- `src/pages/SparkTradeProductOpportunities.tsx` — member card + dialog + order floor
- `src/pages/SparkTradeAIBlueprint.tsx` — blueprint MOQ line

### Verification (per your CONFIRM list)

- Approve form blocks publish without factory MOQ; shows live `member_moq_units` + `members_needed`.
- Landed R18 · factory MOQ 10,000 · R400 floor → `ceil(400/18)=23 units/member`, `ceil(10000/23)=435 members`. (Your ballpark of ~22/~455 matches within rounding.)
- Member card min = `memberMoqUnits`; checkout blocks under R2,500 with the exact shortfall copy.

Reply **go** to build, or tell me what to tweak.
