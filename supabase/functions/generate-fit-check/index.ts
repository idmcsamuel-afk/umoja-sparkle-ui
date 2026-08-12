// AI Fit-Check for tenders — charges 10 Sparks via unlock_tender, caches result.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL = "openai/gpt-5.6-sol";

const FIT_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    go_no_go: { type: "string", enum: ["strong fit", "worth considering", "likely not a fit"] },
    one_line_verdict: { type: "string" },
    key_requirements: { type: "array", items: { type: "string" } },
    likely_compliance_signals: { type: "array", items: { type: "string" } },
    deadline_pressure: { type: "string" },
    who_this_suits: { type: "string" },
    watch_outs: { type: "array", items: { type: "string" } },
  },
  required: [
    "go_no_go",
    "one_line_verdict",
    "key_requirements",
    "likely_compliance_signals",
    "deadline_pressure",
    "who_this_suits",
    "watch_outs",
  ],
} as const;

const SYSTEM = `You are an experienced South African public-procurement (tender) advisor helping a small or medium South African business decide whether to bid.

Rules you must follow:
- Base your analysis ONLY on the tender data provided. Do not invent specific requirements, CIDB grades, standards, quantities or documents that are not stated in or clearly implied by the data.
- Every compliance expectation (B-BBEE, functionality scoring, tax clearance, CSD registration, local content, documentation) must be phrased as LIKELY / probable, never as confirmed.
- This is guidance to help decide whether to bid. It is not a guarantee and not a substitute for reading the official bid document.
- Write in plain, practical language a business owner understands. No jargon dumps, no markdown, no preamble.
- Return STRICT JSON only, matching the required shape exactly.`;

async function callGateway(apiKey: string, prompt: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "tender_fit_check",
          strict: true,
          schema: FIT_CHECK_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gateway_${res.status}: ${detail.slice(0, 400)}`);
  }

  // Read the SSE stream and accumulate the output text deltas.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed") {
          const out = evt.response?.output ?? [];
          for (const item of out) {
            for (const part of item?.content ?? []) {
              if (part?.type === "output_text" && typeof part.text === "string") completedText += part.text;
            }
          }
        } else if (evt.type === "response.failed" || evt.type === "error") {
          throw new Error(`gateway_stream_error: ${JSON.stringify(evt).slice(0, 300)}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("gateway_stream_error")) throw e;
        // ignore non-JSON keepalive lines
      }
    }
  }

  const raw = (text || completedText).trim();
  if (!raw) throw new Error("gateway_empty_response");
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed?.go_no_go || !parsed?.one_line_verdict) throw new Error("gateway_bad_shape");
  return parsed as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const uid = claims?.claims?.sub as string | undefined;
    if (claimsErr || !uid) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const tenderId = String(body?.p_tender_id ?? body?.tender_id ?? "");
    if (!UUID_RE.test(tenderId)) return json({ error: "invalid_tender_id" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Cached result? Free re-view.
    const { data: cached } = await admin
      .from("tender_ai_outputs")
      .select("content_json, created_at")
      .eq("tender_id", tenderId)
      .eq("member_id", uid)
      .eq("kind", "fit_check")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.content_json) {
      return json({
        ok: true,
        cached: true,
        sparks_spent: 0,
        generated_at: cached.created_at,
        fit_check: cached.content_json,
      });
    }

    // 2. Tender data (full internal record).
    const { data: tender } = await admin
      .from("tenders")
      .select(
        "ocid, title, description, buyer_name, province, delivery_location, category, procurement_method, status, value_amount, value_currency, published_at, closing_at, reference_number, briefing_at, briefing_compulsory",
      )
      .eq("id", tenderId)
      .maybeSingle();
    if (!tender) return json({ error: "tender_not_found" }, 404);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "service_unavailable" }, 503);

    // 3. Charge 10 Sparks (as the member — auth.uid() required by unlock_tender).
    const { data: charge, error: chargeErr } = await userClient.rpc("unlock_tender", {
      p_tender_id: tenderId,
      p_unlock_type: "fit_check",
    });
    if (chargeErr) {
      const msg = chargeErr.message ?? "charge_failed";
      const code = msg.includes("insufficient_sparks")
        ? "insufficient_sparks"
        : msg.includes("spark_payments_disabled")
          ? "spark_payments_disabled"
          : "charge_failed";
      return json({ error: code, message: msg }, 402);
    }
    const sparksSpent = Number((charge as { sparks_spent?: number } | null)?.sparks_spent ?? 0);

    // 4. Build prompt.
    const days = tender.closing_at
      ? Math.ceil((new Date(tender.closing_at).getTime() - Date.now()) / 86400000)
      : null;
    const value =
      tender.value_amount && Number(tender.value_amount) > 0
        ? `${tender.value_currency ?? "ZAR"} ${Number(tender.value_amount).toLocaleString("en-ZA")}`
        : "not published";

    const prompt = `Analyse this South African government tender for a prospective bidder.

Reference: ${tender.reference_number ?? tender.title ?? "not stated"}
Scope / description: ${tender.description ?? tender.title ?? "not stated"}
Buyer / department: ${tender.buyer_name ?? "not stated"}
Category: ${tender.category ?? "not stated"}
Procurement method: ${tender.procurement_method ?? "not stated"}
Province: ${tender.province ?? "not stated"}
Delivery location: ${tender.delivery_location ?? "not stated"}
Estimated value: ${value}
Published: ${tender.published_at ?? "not stated"}
Closing: ${tender.closing_at ?? "not stated"}${days !== null ? ` (${days} day(s) from today)` : ""}
Briefing session: ${tender.briefing_at ? `${tender.briefing_at}${tender.briefing_compulsory ? " (compulsory)" : " (optional)"}` : "none stated"}
Status: ${tender.status ?? "not stated"}

Return the JSON fit-check now.`;

    // 5. Call the AI — retry once server-side before considering it failed.
    let result: Record<string, unknown> | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await callGateway(apiKey, prompt);
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`[generate-fit-check] attempt ${attempt + 1} failed:`, lastErr);
      }
    }

    // 6. Still failed → refund the charge so the member is never left paying for nothing.
    if (!result) {
      const { data: refund, error: refundErr } = await admin.rpc("refund_tender_unlock", {
        p_member: uid,
        p_tender_id: tenderId,
        p_unlock_type: "fit_check",
      });
      if (refundErr) console.error("[generate-fit-check] refund failed:", refundErr.message);
      return json(
        {
          error: "ai_failed",
          message:
            "The AI analysis could not be completed. Your 10 Sparks have been refunded — please try again.",
          refunded: !refundErr,
          refund: refund ?? null,
          detail: lastErr.slice(0, 200),
        },
        502,
      );
    }

    // 7. Store & return.
    const { error: storeErr } = await admin.from("tender_ai_outputs").insert({
      tender_id: tenderId,
      member_id: uid,
      kind: "fit_check",
      model: MODEL,
      content: JSON.stringify(result),
      content_json: result,
    });
    if (storeErr) console.error("[generate-fit-check] store failed:", storeErr.message);

    return json({
      ok: true,
      cached: false,
      sparks_spent: sparksSpent,
      generated_at: new Date().toISOString(),
      fit_check: result,
    });
  } catch (e) {
    console.error("[generate-fit-check] unexpected", e);
    return json({ error: "unexpected", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
