import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _cron = Deno.env.get("CRON_SECRET");
  if (!_cron || req.headers.get("x-cron-secret") !== _cron) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Single-flight: bail if a job is already processing.
    const { data: running, error: runErr } = await supabase
      .from("zcreator_job_queue")
      .select("id, started_at")
      .eq("status", "processing")
      .limit(1);
    if (runErr) return json({ error: runErr.message }, 500);

    if (running && running.length > 0) {
      // Auto-recover stuck jobs (>30 min).
      const stuck = running[0];
      const ageMs = stuck.started_at ? Date.now() - new Date(stuck.started_at).getTime() : 0;
      if (ageMs > 30 * 60 * 1000) {
        await supabase
          .from("zcreator_job_queue")
          .update({ status: "failed", error_message: "Job timed out (>30 min)", completed_at: new Date().toISOString() })
          .eq("id", stuck.id);
      } else {
        return json({ idle: false, message: "Another job is processing" });
      }
    }

    // Pick next queued job (highest priority, then oldest).
    const { data: next, error: nextErr } = await supabase
      .from("zcreator_job_queue")
      .select("*")
      .eq("status", "queued")
      .order("priority", { ascending: false })
      .order("queued_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextErr) return json({ error: nextErr.message }, 500);
    if (!next) return json({ idle: true, message: "No queued jobs" });

    // Claim it (best-effort optimistic lock).
    const { data: claimed, error: claimErr } = await supabase
      .from("zcreator_job_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", next.id)
      .eq("status", "queued")
      .select()
      .maybeSingle();
    if (claimErr || !claimed) return json({ idle: false, message: "Job already claimed" });

    await supabase
      .from("zcreator_content_queue")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", next.content_id);

    // Run assembly.
    let ok = false;
    let errorMsg: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/zcreator-assemble-faceless`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ contentId: next.content_id }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out?.error ?? `assemble failed (${r.status})`);
      if (out?.cancelled) {
        errorMsg = "cancelled";
      } else {
        ok = true;
      }
    } catch (e: any) {
      errorMsg = e?.message ?? "assemble error";
    }

    if (ok) {
      await supabase
        .from("zcreator_job_queue")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", next.id);
      // Increment usage counter on success.
      const { data: sub } = await supabase
        .from("zcreator_subscriptions")
        .select("videos_used_this_month")
        .eq("user_id", next.user_id)
        .maybeSingle();
      if (sub) {
        await supabase
          .from("zcreator_subscriptions")
          .update({ videos_used_this_month: (sub.videos_used_this_month ?? 0) + 1 })
          .eq("user_id", next.user_id);
      }
    } else {
      await supabase
        .from("zcreator_job_queue")
        .update({ status: "failed", error_message: errorMsg, completed_at: new Date().toISOString() })
        .eq("id", next.id);
      // assemble-faceless already updates content row; ensure status reflects failure if not cancelled.
      if (errorMsg !== "cancelled") {
        await supabase
          .from("zcreator_content_queue")
          .update({ status: "failed", error_message: `[queue] ${errorMsg}`, updated_at: new Date().toISOString() })
          .eq("id", next.content_id);
      }
    }

    return json({ processed: true, jobId: next.id, ok, error: errorMsg });
  } catch (e: any) {
    console.error("[process-queue] error", e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
