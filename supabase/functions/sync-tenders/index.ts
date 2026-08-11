import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const OCDS_BASE = 'https://ocds-api.etenders.gov.za/api/OCDSReleases';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape', 'National',
];

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function normalizeProvince(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const v = raw.trim();
  const hit = PROVINCES.find((p) => p.toLowerCase() === v.toLowerCase());
  if (hit) return hit;
  const loose = PROVINCES.find((p) => v.toLowerCase().includes(p.toLowerCase()));
  return loose ?? v;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapRelease(rel: Record<string, any>) {
  const t = rel?.tender ?? {};
  const contact = t?.contactPerson ?? {};
  const briefing = t?.briefingSession ?? {};
  const tenderId = t?.id ?? null;

  return {
    ocid: rel.ocid as string,
    release_id: rel.id ?? null,
    // SA eTenders puts the bid/reference number in tender.title and the human
    // readable description in tender.description.
    reference_number: t?.title ?? tenderId ?? null,
    title: t?.description ?? t?.title ?? null,
    description: t?.description ?? null,
    buyer_name: rel?.buyer?.name ?? t?.procuringEntity?.name ?? null,
    province: normalizeProvince(t?.province),
    category: t?.category ?? t?.mainProcurementCategory ?? null,
    procurement_method: t?.procurementMethodDetails ?? t?.procurementMethod ?? null,
    status: t?.status ?? null,
    value_amount: num(t?.value?.amount),
    value_currency: t?.value?.currency ?? 'ZAR',
    published_at: iso(t?.tenderPeriod?.startDate) ?? iso(rel?.date),
    closing_at: iso(t?.tenderPeriod?.endDate),
    briefing_at: briefing?.isSession ? iso(briefing?.date) : null,
    briefing_compulsory: briefing?.isSession ? !!briefing?.compulsory : null,
    source_url: tenderId
      ? `https://www.etenders.gov.za/Home/TenderInformation?id=${tenderId}`
      : null,
    documents: Array.isArray(t?.documents) ? t.documents : [],
    contact_name: contact?.name ?? null,
    contact_email: contact?.email ?? null,
    contact_phone: contact?.telephoneNumber ?? null,
    raw_json: rel,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let days = 2;
  let pageSize = 50;
  let maxPages = 40;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      days = Math.min(Math.max(Number(body?.days) || 2, 1), 90);
      pageSize = Math.min(Math.max(Number(body?.page_size) || 50, 1), 100);
      maxPages = Math.min(Math.max(Number(body?.max_pages) || 40, 1), 200);
    }
  } catch (_) { /* defaults */ }

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - days * 86400_000);

  let page = 1;
  let fetched = 0;
  let upserted = 0;
  const errors: string[] = [];
  let sample: unknown = null;

  try {
    while (page <= maxPages) {
      const url = `${OCDS_BASE}?PageNumber=${page}&PageSize=${pageSize}` +
        `&dateFrom=${ymd(dateFrom)}&dateTo=${ymd(dateTo)}`;

      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        // API error: stop, keep everything already stored intact.
        errors.push(`page ${page}: HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const releases: Record<string, any>[] = Array.isArray(json?.releases) ? json.releases : [];
      if (releases.length === 0) break;
      fetched += releases.length;
      if (!sample) sample = releases[0];

      // De-dupe within the batch (same ocid can repeat across releases)
      const byOcid = new Map<string, ReturnType<typeof mapRelease>>();
      for (const rel of releases) {
        if (!rel?.ocid) continue;
        byOcid.set(rel.ocid, mapRelease(rel));
      }
      const rows = [...byOcid.values()];

      if (rows.length) {
        const { error } = await supabase
          .from('tenders')
          .upsert(rows, { onConflict: 'ocid' });
        if (error) errors.push(`upsert page ${page}: ${error.message}`);
        else upserted += rows.length;
      }

      if (releases.length < pageSize && !json?.links?.next) break;
      page += 1;
    }
  } catch (e) {
    errors.push(String(e instanceof Error ? e.message : e));
  }

  const { count } = await supabase
    .from('tenders')
    .select('id', { count: 'exact', head: true });

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      window: { from: ymd(dateFrom), to: ymd(dateTo) },
      pages_read: page - 1,
      fetched,
      upserted,
      total_in_db: count ?? null,
      errors,
      sample_release: sample,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
});
