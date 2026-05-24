This is a large, multi-phase feature spanning DB, UI, edge functions, and a third-party blockchain API. Here is the plan I'll follow once you approve. I'll likely ship it in 2–3 review cycles.

## 1. Database (migration)

Add to `circle_bids`:
- `payment_crypto_network text` (e.g. `TRC20`)
- `payment_crypto_txhash text`
- `payment_crypto_address text` (sender wallet, optional)
- `amount_usdt numeric(12,2)`
- `payout_crypto_txhash text`
- `payout_crypto_network text`

Add to `platform_settings`:
- `usdt_trc20_address text`
- `usdt_zar_rate numeric(12,4)` (fallback rate, admin-editable; live rate fetched in edge function)
- `crypto_enabled boolean default false`

Add to `members`:
- `usdt_wallet_trc20 text` (for receiving payouts)

Extend allowed `payment_method` values to include `usdt`. No CHECK constraints (trigger-based if needed).

## 2. Edge functions

- `usdt-rate` (GET) — returns current ZAR→USD rate (cache 10 min). Source: free public FX API (e.g. exchangerate.host). No secret required.
- `usdt-verify-tx` (POST `{ bidId, txHash }`) — calls TronScan/Trongrid public API to verify:
  - tx exists, confirmed
  - `to` == platform USDT TRC20 address (USDT contract `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`)
  - amount ≥ `amount_usdt` (within 1% tolerance)
  - tx not already used by another bid
  - On success, updates bid: `status='payment_pending'→'confirmed'`-equivalent (matches existing EFT confirm flow), sets `payment_confirmed_at`, `payment_crypto_txhash`, `payment_crypto_network='TRC20'`.
- `usdt-auto-verify` (cron, every 5 min) — scans pending USDT bids in last 2h; for those with a saved sender address or txhash, re-checks status. Light v1: only re-check rows with txhash set.

Public TronScan / Trongrid endpoints don't require keys for read calls. No secrets needed for v1. If rate-limited later, we'll add `TRONGRID_API_KEY` via the secrets tool.

## 3. Frontend — Circle bid flow (`src/pages/Circle.tsx` + `PaymentMethodSelector.tsx`)

- Add `usdt` option to `PaymentMethod` with TRC20 badge ("Instant · Low fees").
- When user selects USDT:
  - Fetch live rate, compute `amount_usdt = round(fiat_amount / rate, 2)`.
  - Persist `payment_method='usdt'`, `amount_usdt`, `payment_crypto_network='TRC20'`, `payment_deadline = now()+1h` on the bid.
  - Show new `UsdtPayPanel` with: network, amount in USDT, platform address (copy button), QR code (use `qrcode.react` — already a peer of many shadcn projects; if not installed, add it), 1-hour countdown, "I've sent payment" → modal with txhash input → calls `usdt-verify-tx`.
- On success, identical UX to confirmed EFT (banner, vault timer kicks in via existing logic).

## 4. Currency display

- Lightweight `useUsdtRate()` hook (TanStack Query, 10-min stale) used in:
  - Circle tier cards: append `(≈$X–$Y USDT)` to ZAR ranges.
  - Bid amount input: live "= $X.XX USDT" helper.
  - "My bids" list: show USDT equivalent when `payment_method='usdt'` (uses stored `amount_usdt`, not live rate).

## 5. Admin

`AdminSettings.tsx` — new "Cryptocurrency" card:
- USDT TRC20 receiving address input + QR preview
- Fallback ZAR/USD rate input
- `crypto_enabled` toggle (gates the UI option for members)
- Read-only "Last verified balance" placeholder (v1: shown as "Check on TronScan ↗")

`AdminCircleTracker.tsx` / payouts:
- New filter for `payment_method='usdt'`, show txhash with link to `https://tronscan.org/#/transaction/<hash>`.
- On payout: admin can pick "Bank EFT" or "USDT". If USDT, requires member's `usdt_wallet_trc20`, prompts admin to send manually, then records `payout_crypto_txhash` + `payout_crypto_network`. Reuses existing `record_circle_payout` flow with extra params (small DB function update).

## 6. Member profile (`Banking.tsx`)

Add optional "USDT payout wallet (TRC20)" input below bank details, with format validation (Tron addresses start with `T`, 34 chars).

## 7. Education + disclaimer

Small collapsible `UsdtHelp` component embedded in the USDT pay panel and on the Banking page, containing the "What is USDT / How to get it / Recommended wallets / Compliance disclaimer" copy from your spec.

## 8. Cron

Add a `*/5 * * * *` `pg_cron` job calling `usdt-auto-verify` (same pattern as existing `expire-unpaid-bids-15m`). Migration includes the schedule.

## 9. Out of scope for v1 (called out so we don't surprise you)

- Auto-sweep / treasury management
- Other networks (Polygon, BEP20) — schema supports it but UI is TRC20-only
- KYC/AML beyond what Lovable Cloud already enforces
- Real-time balance readout in admin (manual TronScan link instead)
- Webhooks from Coinbase Commerce / Binance Pay (manual verification only)

## Order of execution

1. Migration (schema + cron stub disabled).
2. Edge functions `usdt-rate` + `usdt-verify-tx`.
3. Member bid flow + selector + QR panel.
4. Currency display hook + tier cards.
5. Admin settings + payout selector.
6. Banking wallet field.
7. Enable cron + `usdt-auto-verify`.

Approve and I'll start with the migration.