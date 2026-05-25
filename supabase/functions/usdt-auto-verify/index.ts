// Periodic auto-verify of pending USDT bids that have a txhash recorded.
// Called by pg_cron every 5 minutes.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
import { createClient } from "npm:@supabase/supabase-js@2";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supa
    .from("platform_settings")
    .select("usdt_trc20_address")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const platformAddr = settings?.usdt_trc20_address?.trim();
  if (!platformAddr) {
    return json({ ok: true, skipped: "no_platform_address" });
  }
  const platformHex = tronBase58ToHex(platformAddr).toLowerCase().replace(/^41/, "");

  // Find recent pending USDT bids with a txhash
  const { data: bids } = await supa
    .from("circle_bids")
    .select("id, amount_usdt, payment_crypto_txhash, tier, member_id")
    .eq("payment_method", "usdt")
    .in("status", ["pending", "payment_pending"])
    .not("payment_crypto_txhash", "is", null)
    .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString());

  const results: any[] = [];
  for (const b of bids ?? []) {
    try {
      const tg = await fetch("https://api.trongrid.io/wallet/gettransactioninfobyid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: b.payment_crypto_txhash }),
      });
      const info = await tg.json();
      if (!info?.id) { results.push({ id: b.id, skip: "not_found" }); continue; }
      const log = (info.log ?? []).find((l: any) =>
        (l.topics ?? [])[0]?.toLowerCase() === TRANSFER_TOPIC
      );
      if (!log) { results.push({ id: b.id, skip: "no_log" }); continue; }
      const toTopic = (log.topics?.[2] ?? "").toLowerCase();
      if (!toTopic.endsWith(platformHex)) { results.push({ id: b.id, skip: "wrong_to" }); continue; }
      const usdtAmount = Number(BigInt("0x" + (log.data || "0"))) / 1_000_000;
      const expected = Number(b.amount_usdt);
      const tolerance = expected < 50 ? expected * 0.15 : 7.5;
      if (usdtAmount + 0.01 < expected - tolerance) {
        results.push({ id: b.id, skip: "amount_low" });
        continue;
      }
      const nowIso = new Date().toISOString();
      await supa.from("circle_bids").update({
        status: "vault",
        payment_confirmed_at: nowIso,
        vault_start: nowIso,
        amount_usdt_received: usdtAmount,
      }).eq("id", b.id);
      results.push({ id: b.id, ok: true });
    } catch (e) {
      results.push({ id: b.id, err: String((e as any)?.message ?? e) });
    }
  }

  return json({ ok: true, checked: bids?.length ?? 0, results });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tronBase58ToHex(addr: string): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const ch of addr) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("invalid_base58");
    num = num * 58n + BigInt(i);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return hex.slice(0, -8);
}
