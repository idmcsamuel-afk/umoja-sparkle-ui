import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Event {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_is_admin?: boolean;
  note: string | null;
  created_at: string;
}

const statusClass = (s: string) => {
  switch (s) {
    case "active": return "bg-primary/15 text-primary";
    case "payment_pending": return "bg-amber-500/15 text-amber-400";
    case "paid": return "bg-emerald-500/15 text-emerald-400";
    case "matched": return "bg-accent/15 text-accent";
    case "rejected":
    case "cancelled":
    case "refunded": return "bg-destructive/15 text-destructive";
    default: return "bg-secondary text-muted-foreground";
  }
};

export function BidStatusHistory({ bidId }: { bidId: string }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const { data, error } = await supabase
        .from("circle_bid_status_events")
        .select("id, from_status, to_status, actor_id, note, created_at")
        .eq("bid_id", bidId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) { setError(error.message); setEvents([]); return; }
      const rows = (data ?? []) as Event[];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (actorIds.length) {
        const [{ data: members }, { data: admins }] = await Promise.all([
          supabase.from("members").select("id, full_name").in("id", actorIds),
          supabase.from("admin_users").select("user_id").in("user_id", actorIds),
        ]);
        const nameMap = new Map((members ?? []).map((m: { id: string; full_name: string | null }) => [m.id, m.full_name]));
        const adminSet = new Set((admins ?? []).map((a: { user_id: string }) => a.user_id));
        rows.forEach((r) => {
          if (r.actor_id) {
            r.actor_name = nameMap.get(r.actor_id) ?? null;
            r.actor_is_admin = adminSet.has(r.actor_id);
          }
        });
      }
      setEvents(rows);
    })();
    return () => { cancelled = true; };
  }, [bidId]);

  if (events === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
      </div>
    );
  }
  if (error) return <p className="text-xs text-destructive">Failed to load history: {error}</p>;
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No history yet.</p>;

  return (
    <ol className="space-y-2">
      {events.map((e) => {
        const actorLabel = e.note === "backfill"
          ? "system (backfill)"
          : e.actor_is_admin
            ? `${e.actor_name ?? "Admin"} · admin`
            : e.actor_name ?? (e.actor_id ? "member" : "system");
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-mono text-muted-foreground tabular-nums">
              {new Date(e.created_at).toLocaleString()}
            </span>
            {e.from_status && (
              <>
                <span className={`rounded-full px-2 py-0.5 ${statusClass(e.from_status)}`}>{e.from_status}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </>
            )}
            <span className={`rounded-full px-2 py-0.5 ${statusClass(e.to_status)}`}>{e.to_status}</span>
            <span className="text-muted-foreground">by {actorLabel}</span>
          </li>
        );
      })}
    </ol>
  );
}
