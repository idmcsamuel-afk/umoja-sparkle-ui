// Verify a TRC20 USDT transaction against a circle_bid.
// POST { bidId: string, txHash: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// USDT TRC20 contract address
const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bidId, txHash } = await req.json();
    if (!bidId || !txHash || typeof bidId !== "string" || typeof txHash !== "string") {
      return json({ ok: false, error: "missing_params" }, 400);
    }
    const hash = txHash.trim().replace(/^0x/, "");
    if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
      return json({ ok: false, error: "invalid_txhash_format" }, 400);
    }

    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Verify caller owns the bid
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ ok: false, error: "auth_required" }, 401);

    const { data: bid, error: bidErr } = await supa
      .from("circle_bids")
      .select("id, member_id, status, fiat_amount, amount_usdt, payment_method, payment_crypto_txhash, tier")
      .eq("id", bidId)
      .maybeSingle();
    if (bidErr || !bid) return json({ ok: false, error: "bid_not_found" }, 404);
    if (bid.member_id !== userId) return json({ ok: false, error: "forbidden" }, 403);
    if (bid.payment_crypto_txhash && bid.payment_crypto_txhash !== hash) {
      return json({ ok: false, error: "different_txhash_already_recorded" }, 409);
    }
    if (!bid.amount_usdt) return json({ ok: false, error: "no_usdt_amount" }, 400);

    // Get platform USDT address
    const { data: settings } = await supa
      .from("platform_settings")
      .select("usdt_trc20_address, crypto_enabled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const platformAddr = settings?.usdt_trc20_address?.trim();
    if (!platformAddr) return json({ ok: false, error: "platform_address_not_configured" }, 503);

    // Reject re-use of this txhash on a different bid
    const { data: dup } = await supa
      .from("circle_bids")
      .select("id")
      .eq("payment_crypto_txhash", hash)
      .neq("id", bidId)
      .maybeSingle();
    if (dup) return json({ ok: false, error: "txhash_already_used" }, 409);

    // Query TronGrid for transaction info
    const tgRes = await fetch(`https://api.trongrid.io/wallet/gettransactioninfobyid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: hash }),
    });
    const info = await tgRes.json();
    if (!info || !info.id) {
      return json({ ok: false, error: "tx_not_found" }, 404);
    }
    // Must be successful
    const success = info.receipt?.result === "SUCCESS" || (info.contractResult && info.contractResult[0] === "");
    if (info.result === "FAILED" || (!success && info.receipt?.result && info.receipt.result !== "SUCCESS")) {
      return json({ ok: false, error: "tx_failed_on_chain" }, 400);
    }

    // Parse the TRC20 transfer log: topic[0]=Transfer signature, address = USDT contract
    const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const log = (info.log ?? []).find((l: any) => {
      const addrHex = (l.address ?? "").toLowerCase();
      const usdtHex = tronBase58ToHex(USDT_TRC20).toLowerCase().replace(/^41/, "");
      return addrHex.endsWith(usdtHex) && (l.topics ?? [])[0]?.toLowerCase() === TRANSFER_TOPIC;
    });
    if (!log) return json({ ok: false, error: "not_a_usdt_transfer" }, 400);

    const toTopic = (log.topics?.[2] ?? "").toLowerCase();
    const platformHex = tronBase58ToHex(platformAddr).toLowerCase().replace(/^41/, "");
    if (!toTopic.endsWith(platformHex)) {
      return json({ ok: false, error: "wrong_recipient" }, 400);
    }
    const amountRaw = BigInt("0x" + (log.data || "0"));
    const usdtAmount = Number(amountRaw) / 1_000_000; // USDT has 6 decimals
    const expected = Number(bid.amount_usdt);
    if (usdtAmount + 0.01 < expected * 0.99) {
      return json({ ok: false, error: "amount_too_low", expected, received: usdtAmount }, 400);
    }

    // Parse sender (topic[1])
    const fromTopic = (log.topics?.[1] ?? "").toLowerCase();
    const senderHex41 = "41" + fromTopic.slice(-40);

    // Update bid -> mark as paid/confirmed via existing pipeline (set payment_confirmed_at)
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supa
      .from("circle_bids")
      .update({
        payment_method: "usdt",
        payment_crypto_network: "TRC20",
        payment_crypto_txhash: hash,
        payment_crypto_address: senderHex41,
        payment_submitted_at: nowIso,
        payment_confirmed_at: nowIso,
        status: "vault",
        vault_start: nowIso,
      })
      .eq("id", bidId);
    if (updErr) return json({ ok: false, error: updErr.message }, 500);

    // Notify admins
    const { data: admins } = await supa.from("admin_users").select("user_id");
    if (admins?.length) {
      await supa.from("notifications").insert(
        admins.map((a: any) => ({
          member_id: a.user_id,
          title: "✅ USDT payment confirmed",
          body: `${usdtAmount} USDT received for ${bid.tier} (bid ${bidId.slice(0, 6)})`,
          kind: "payment",
          link: "/admin/circles",
        })),
      );
    }

    return json({ ok: true, usdt_amount: usdtAmount, txhash: hash });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Minimal Tron Base58Check -> hex (returns 21-byte hex starting with 41)
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
  // strip 4-byte checksum
  hex = hex.slice(0, -8);
  return hex;
}
