// Compares Paystack plan amounts against subscription_plans.monthly_price (ZAR).
// Returns drift report for the admin panel. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET) {
      return json(500, { ok: false, error: "PAYSTACK_SECRET_KEY not configured" });
    }

    // AuthN — admin only
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { ok: false, error: "unauthorized" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await admin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (!uid) return json(401, { ok: false, error: "unauthorized" });

    const { data: isAdminRow } = await admin
      .from("admin_users").select("user_id").eq("user_id", uid).maybeSingle();
    if (!isAdminRow) return json(403, { ok: false, error: "forbidden" });

    // Load local plans
    const { data: plans, error: pErr } = await admin
      .from("subscription_plans")
      .select("id, tier_name, display_name, monthly_price, paystack_plan_code, is_active");
    if (pErr) return json(500, { ok: false, error: pErr.message });

    // Fetch Paystack plans (paginated; 50 should cover us)
    const res = await fetch("https://api.paystack.co/plan?perPage=100", {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const psBody = await res.json();
    if (!res.ok || !psBody?.status) {
      return json(502, { ok: false, error: psBody?.message ?? "paystack fetch failed" });
    }
    const remote: Array<{ plan_code: string; amount: number; currency: string; name: string; interval: string }> = psBody.data ?? [];
    const byCode = new Map(remote.map((p) => [p.plan_code, p]));

    const report = (plans ?? []).map((p) => {
      const code = p.paystack_plan_code;
      const expectedZar = Number(p.monthly_price);
      const expectedKobo = Math.round(expectedZar * 100);
      const rp = code ? byCode.get(code) : undefined;

      let status: "ok" | "drift" | "missing_code" | "not_found" | "wrong_currency" | "wrong_interval" = "ok";
      let actualZar: number | null = null;
      let message = "";

      if (!code) {
        status = "missing_code";
        message = "No Paystack plan_code configured for this tier.";
      } else if (!rp) {
        status = "not_found";
        message = `Plan code ${code} not found on Paystack.`;
      } else {
        actualZar = rp.amount / 100;
        if ((rp.currency ?? "ZAR").toUpperCase() !== "ZAR") {
          status = "wrong_currency";
          message = `Paystack plan currency is ${rp.currency}, expected ZAR.`;
        } else if ((rp.interval ?? "").toLowerCase() !== "monthly") {
          status = "wrong_interval";
          message = `Paystack plan interval is ${rp.interval}, expected monthly.`;
        } else if (rp.amount !== expectedKobo) {
          status = "drift";
          message = `Paystack charges R${actualZar.toFixed(2)} but app shows R${expectedZar.toFixed(2)}.`;
        }
      }

      return {
        plan_id: p.id,
        tier_name: p.tier_name,
        display_name: p.display_name,
        paystack_plan_code: code,
        expected_zar: expectedZar,
        actual_zar: actualZar,
        currency: rp?.currency ?? null,
        interval: rp?.interval ?? null,
        is_active: p.is_active,
        status,
        message,
      };
    });

    const drift_count = report.filter((r) => r.status !== "ok").length;

    return json(200, {
      ok: true,
      checked_at: new Date().toISOString(),
      drift_count,
      report,
    });
  } catch (err) {
    console.error("[paystack-plan-audit]", err);
    return json(500, { ok: false, error: (err as Error).message });
  }
});
