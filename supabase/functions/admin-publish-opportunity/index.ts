import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin check
    const { data: isAdminRow } = await admin
      .from("admin_users").select("user_id").eq("user_id", adminId).maybeSingle();
    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const row = body?.row;
    if (!row || typeof row !== "object") {
      return new Response(JSON.stringify({ error: "row payload required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute next spotlight rank if not provided / spotlight insert
    let nextRank: number | null = row.spotlight_rank ?? null;
    if (row.is_spotlight && nextRank == null) {
      const { data: maxRow } = await admin
        .from("spark_trade_opportunities")
        .select("spotlight_rank").eq("is_spotlight", true)
        .order("spotlight_rank", { ascending: false }).limit(1).maybeSingle();
      nextRank = Number((maxRow as any)?.spotlight_rank ?? 0) + 1;
    }

    const insertPayload = { ...row, ...(nextRank != null ? { spotlight_rank: nextRank } : {}) };

    const { data: inserted, error: insErr } = await admin
      .from("spark_trade_opportunities")
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error("[admin-publish-opportunity] insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, row: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[admin-publish-opportunity] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
