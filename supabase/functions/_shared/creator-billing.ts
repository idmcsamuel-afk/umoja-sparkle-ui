// Single Creator Credits gate for every paid provider call.
// Pattern: resolveCaller → chargeAndStart (charge + atomic claim) → provider → completeJob | refundJob.
// The DB charge function ALSO refuses when creator_generation_enabled is OFF (kill-switch wins over credits).
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

export type Caller = { kind: "service" } | { kind: "user"; userId: string } | null;

export async function resolveCaller(req: Request): Promise<Caller> {
  const cron = Deno.env.get("CRON_SECRET");
  if (cron && req.headers.get("x-cron-secret") === cron) return { kind: "service" };
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (SERVICE_KEY && token === SERVICE_KEY) return { kind: "service" };
  const u = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await u.auth.getClaims(token);
  const sub = (data?.claims as any)?.sub;
  if (error || !sub) return null;
  return { kind: "user", userId: sub };
}

export interface ChargeSpec {
  memberId: string;
  modelKey: string;
  route: string;
  jobType: "script" | "character_sheet" | "image" | "video" | "voice" | "lipsync";
  idempotencyKey: string;
  units?: number;
  params?: Record<string, unknown>;
  source?: string;
  /** Allow claiming a job that was pre-charged (status 'charged') under the same key. Default true. */
  claimPrecharged?: boolean;
}

export type ChargeResult =
  | { ok: true; jobId: string; credits: number }
  | { ok: false; status: number; body: Record<string, unknown> };

function mapError(msg: string): ChargeResult {
  if (msg.includes("generation_disabled") || msg.includes("creator_studio_disabled"))
    return { ok: false, status: 403, body: { error: "generation_disabled", message: "AI generation is temporarily disabled by the platform." } };
  if (msg.includes("insufficient_credits"))
    return { ok: false, status: 402, body: { error: "insufficient_credits", message: msg, buyUrl: "/creator-studio/credits" } };
  if (msg.includes("model_not_available"))
    return { ok: false, status: 503, body: { error: "model_not_available", message: "This generation option is not priced/available." } };
  return { ok: false, status: 500, body: { error: "charge_failed", message: msg } };
}

/** Charge Creator Credits (idempotent by key) and atomically move the job to 'generating'. */
export async function chargeAndStart(admin: SupabaseClient, s: ChargeSpec): Promise<ChargeResult> {
  const { data, error } = await admin.rpc("charge_generation_for_member", {
    p_member: s.memberId,
    p_model_key: s.modelKey,
    p_route: s.route,
    p_job_type: s.jobType,
    p_params: s.params ?? {},
    p_idem: s.idempotencyKey,
    p_units: Math.max(1, Math.ceil(s.units ?? 1)),
    p_source: s.source ?? "server",
  });
  if (error) return mapError(error.message ?? String(error));
  const r = data as any;
  if (r.duplicate && (r.status !== "charged" || s.claimPrecharged === false)) {
    return { ok: false, status: 409, body: { error: "duplicate_request", message: "This generation is already running or finished.", job_id: r.job_id, status: r.status } };
  }
  const { data: st, error: stErr } = await admin.rpc("start_generation_job", { p_job_id: r.job_id });
  if (stErr) {
    await refundJob(admin, r.job_id);
    return mapError(stErr.message ?? String(stErr));
  }
  if (!(st as any)?.started) {
    return { ok: false, status: 409, body: { error: "duplicate_request", message: "This generation is already running.", job_id: r.job_id } };
  }
  return { ok: true, jobId: r.job_id, credits: r.credits_charged };
}

/** Charge only (no claim) — used to pre-pay a job that a queue worker will claim later. */
export async function precharge(admin: SupabaseClient, s: ChargeSpec): Promise<ChargeResult> {
  const { data, error } = await admin.rpc("charge_generation_for_member", {
    p_member: s.memberId, p_model_key: s.modelKey, p_route: s.route, p_job_type: s.jobType,
    p_params: s.params ?? {}, p_idem: s.idempotencyKey, p_units: Math.max(1, Math.ceil(s.units ?? 1)), p_source: s.source ?? "server",
  });
  if (error) return mapError(error.message ?? String(error));
  const r = data as any;
  if (r.duplicate && r.status !== "charged") {
    return { ok: false, status: 409, body: { error: "duplicate_request", message: "This generation is already running or finished.", status: r.status } };
  }
  return { ok: true, jobId: r.job_id, credits: r.credits_charged };
}

export async function completeJob(admin: SupabaseClient, jobId: string, url?: string | null) {
  try { await admin.rpc("complete_generation_job", { p_job_id: jobId, p_result_url: url ?? null }); }
  catch (e) { console.error("[billing] complete failed", jobId, e); }
}

export async function refundJob(admin: SupabaseClient, jobId: string) {
  try {
    const { error } = await admin.rpc("refund_generation", { p_job_id: jobId });
    if (error && !/already_refunded|job_complete/.test(error.message)) console.error("[billing] refund failed", jobId, error.message);
  } catch (e) { console.error("[billing] refund exception", jobId, e); }
}

/** Refund any still-open jobs for these idempotency keys (used by orchestrators on crash/timeout). */
export async function refundOpenByKeys(admin: SupabaseClient, memberId: string, keys: string[]) {
  const { data } = await admin.from("creator_generation_jobs").select("id")
    .eq("member_id", memberId).in("idempotency_key", keys).in("status", ["charged", "generating"]);
  for (const j of data ?? []) await refundJob(admin, (j as any).id);
}

export async function marketingMemberId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("creator_settings").select("value").eq("key", "marketing_member_id").maybeSingle();
  return (data as any)?.value ?? null;
}

/** Faceless (stock) assembly billing: flat assembly + voice per 1,000 narration characters. */
export function facelessNarrationChars(scriptContent: any): number {
  let sc = scriptContent;
  if (typeof sc === "string") { try { sc = JSON.parse(sc); } catch { return sc.length; } }
  const scenes = Array.isArray(sc?.scenes) ? sc.scenes : Array.isArray(sc?.script?.scenes) ? sc.script.scenes : [];
  return scenes.reduce((n: number, s: any) => n + String(s?.narration ?? s?.text ?? "").length, 0);
}

export async function facelessVoiceTier(admin: SupabaseClient, agentId: string | null): Promise<"standard" | "premium"> {
  if (!agentId) return "standard";
  const { data } = await admin.from("zcreator_story_agents").select("brand_voice").eq("id", agentId).maybeSingle();
  return (data as any)?.brand_voice?.voice_tier === "premium" ? "premium" : "standard";
}

export const facelessKeys = (contentId: string) => ({
  assembly: `assemble:${contentId}`,
  voice: `assemble-voice:${contentId}`,
});

export function facelessSpecs(memberId: string, contentId: string, chars: number, tier: "standard" | "premium"): ChargeSpec[] {
  const k = facelessKeys(contentId);
  return [
    { memberId, modelKey: "stock-faceless", route: "assembly", jobType: "video", idempotencyKey: k.assembly, params: { contentId }, source: "faceless" },
    { memberId, modelKey: "eleven-multilingual-v2", route: `elevenlabs-${tier}`, jobType: "voice", idempotencyKey: k.voice,
      units: Math.max(1, Math.ceil(chars / 1000)), params: { contentId, chars }, source: "faceless" },
  ];
}
