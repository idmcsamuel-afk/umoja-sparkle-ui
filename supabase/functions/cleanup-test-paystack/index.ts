// Admin-only one-off: quarantine rows that originated from Paystack TEST-mode
// transactions while the platform is configured for LIVE (or vice-versa).
//
// Non-destructive: sets quarantined_at + quarantine_reason and reverts the
// row's user-visible status so front-end queries filtering by active/paid/etc.
// stop showing them. Originals remain in the DB for audit.
//
// Returns a per-table + grand-total summary: rows quarantined, total ZAR,
// distinct members affected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const EXPECTED_DOMAIN: "live" | "test" =
  (Deno.env.get("PAYSTACK_EXPECTED_DOMAIN") as any) ||
  (PAYSTACK_SECRET.startsWith("sk_live_") ? "live" : "test");
// Anything NOT matching EXPECTED_DOMAIN is contraband and gets quarantined.
const BAD_DOMAIN = EXPECTED_DOMAIN === "live" ? "test" : "live";

const sb = createClient(SUPABASE_URL, SERVICE);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Table → (paystack ref column, ZAR amount column, member column, status patch SQL fragment)
const TARGETS: Array<{
  table: string;
  refCol: string;
  amountCol: string;
  memberCol: string;
  statusPatch: Record<string, unknown>;
}> = [
  { table: "circle_bids", refCol: "paystack_reference", amountCol: "fiat_amount", memberCol: "member_id",
    statusPatch: { status: "payment_pending", payment_confirmed_at: null } },
  { table: "reit_units", refCol: "paystack_reference", amountCol: "total_paid", memberCol: "member_id",
    statusPatch: { status: "payment_pending", confirmed_at: null } },
  { table: "spark_trade_inventory_reservations", refCol: "payment_reference", amountCol: "total_capital_allocated", memberCol: "member_id",
    statusPatch: { reservation_status: "pending", paid_at: null } },
  { table: "spark_trade_group_brand_investors", refCol: "payment_reference", amountCol: "investment_amount", memberCol: "investor_user_id",
    statusPatch: { payment_status: "pending" } },
  { table: "product_memberships", refCol: "paystack_reference", amountCol: "amount_paid_zar", memberCol: "user_id",
    statusPatch: { status: "cancelled", payment_status: "reverted" } },
  { table: "drive_contributions", refCol: "payment_ref", amountCol: "amount", memberCol: "member_id",
    statusPatch: { status: "reverted" } },
];

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await sb.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- AuthZ: admins only ----
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) return json(401, { error: "Unauthorized" });
  if (!(await isAdmin(claims.claims.sub))) return json(403, { error: "Admin required" });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  // ---- Find bad references ----
  const { data: badEvents, error: evErr } = await sb
    .from("paystack_events")
    .select("reference, raw")
    .not("reference", "is", null)
    .limit(10000);
  if (evErr) return json(500, { error: evErr.message });
  const badRefs = new Set<string>();
  for (const ev of badEvents ?? []) {
    const d = String((ev as any)?.raw?.tx?.domain ?? (ev as any)?.raw?.data?.domain ?? "").toLowerCase();
    if (d === BAD_DOMAIN && ev.reference) badRefs.add(ev.reference as string);
  }
  const refList = Array.from(badRefs);

  const summary: Record<string, { rows: number; zar: number; members: number; mode: string }> = {};
  let grandRows = 0;
  let grandZar = 0;
  const grandMembers = new Set<string>();

  for (const t of TARGETS) {
    // Find target rows
    if (refList.length === 0) {
      summary[t.table] = { rows: 0, zar: 0, members: 0, mode: dryRun ? "dry_run" : "applied" };
      continue;
    }
    const { data: rows, error: selErr } = await sb
      .from(t.table)
      .select(`id, ${t.refCol}, ${t.amountCol}, ${t.memberCol}, quarantined_at`)
      .in(t.refCol, refList);
    if (selErr) {
      summary[t.table] = { rows: 0, zar: 0, members: 0, mode: `error:${selErr.message}` };
      continue;
    }
    const fresh = (rows ?? []).filter((r: any) => !r.quarantined_at);
    const ids = fresh.map((r: any) => r.id);
    const zar = fresh.reduce((s: number, r: any) => s + Number(r[t.amountCol] ?? 0), 0);
    const members = new Set(fresh.map((r: any) => r[t.memberCol]).filter(Boolean));

    summary[t.table] = {
      rows: ids.length,
      zar,
      members: members.size,
      mode: dryRun ? "dry_run" : "applied",
    };
    grandRows += ids.length;
    grandZar += zar;
    for (const m of members) grandMembers.add(String(m));

    if (!dryRun && ids.length > 0) {
      const patch = {
        ...t.statusPatch,
        quarantined_at: new Date().toISOString(),
        quarantine_reason: "paystack_test_mode",
      };
      const { error: upErr } = await sb.from(t.table).update(patch).in("id", ids);
      if (upErr) summary[t.table].mode = `error:${upErr.message}`;
    }
  }

  return json(200, {
    ok: true,
    expected_domain: EXPECTED_DOMAIN,
    bad_domain: BAD_DOMAIN,
    bad_references_found: refList.length,
    dry_run: dryRun,
    summary,
    totals: {
      rows_quarantined: grandRows,
      total_zar: grandZar,
      distinct_members: grandMembers.size,
    },
  });
});
