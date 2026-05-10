import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  rank: string | null;
  is_active: boolean | null;
  created_at: string | null;
  balance?: number;
}

export default function AdminMembers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [m, w] = await Promise.all([
        supabase.from("members").select("id, full_name, email, phone, rank, is_active, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("spark_wallets").select("member_id, balance"),
      ]);
      const wmap = new Map<string, number>();
      for (const x of (w.data ?? []) as { member_id: string; balance: number }[]) wmap.set(x.member_id, Number(x.balance ?? 0));
      setRows((m.data ?? []).map((r) => ({ ...r, balance: wmap.get(r.id) ?? 0 })) as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.rank].some((v) => v?.toLowerCase().includes(term))
    );
  }, [rows, q]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{rows.length.toLocaleString()} total</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…" className="pl-9 h-11 rounded-2xl bg-secondary/60 border-border" />
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Rank</th>
                <th className="text-right p-4">SP</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                  <td className="p-4 font-medium">{r.full_name}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    <div>{r.email}</div>
                    <div>{r.phone}</div>
                  </td>
                  <td className="p-4 capitalize text-xs">{r.rank ?? "—"}</td>
                  <td className="p-4 text-right font-display text-accent-soft">{Math.round(r.balance ?? 0).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-1 ${r.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {r.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No members found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
