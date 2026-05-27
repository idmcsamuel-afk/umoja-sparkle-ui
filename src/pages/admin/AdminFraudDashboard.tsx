import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Loader2 } from "lucide-react";

type RiskLevel = "green" | "yellow" | "orange" | "red";

interface ScoreRow {
  member_id: string;
  score: number;
  risk_level: RiskLevel;
  breakdown: Record<string, unknown>;
  last_calculated_at: string;
  members?: { full_name: string | null; email: string | null; status: string | null } | null;
}

interface FlagRow {
  id: string;
  member_id: string;
  flag_type: string;
  severity: string;
  created_at: string;
  details: Record<string, unknown>;
}

interface CaseRow {
  id: string;
  member_id: string;
  status: string;
  opened_reason: string | null;
  created_at: string;
}

const levelTone: Record<RiskLevel, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  red: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function AdminFraudDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalcing, setRecalcing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, sc, fl, cs] = await Promise.all([
      supabase.rpc("admin_fraud_dashboard"),
      supabase
        .from("fraud_scores")
        .select("member_id, score, risk_level, breakdown, last_calculated_at, members:member_id(full_name, email, status)")
        .order("score", { ascending: false })
        .limit(50),
      supabase.from("fraud_flags").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(30),
      supabase.from("investigation_cases").select("*").in("status", ["open", "under_review"]).order("created_at", { ascending: false }).limit(30),
    ]);
    setSummary(s.data ?? null);
    setScores((sc.data as unknown as ScoreRow[]) ?? []);
    setFlags((fl.data as FlagRow[]) ?? []);
    setCases((cs.data as CaseRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const recalc = async () => {
    setRecalcing(true);
    const { data, error } = await supabase.rpc("admin_recalc_all_fraud_scores");
    setRecalcing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Recalculated ${data} members`);
    load();
  };

  const freeze = async (memberId: string) => {
    const reason = window.prompt("Reason for freezing this account?");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_freeze_member", { _member: memberId, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Account frozen");
    load();
  };

  const unfreeze = async (memberId: string) => {
    const { error } = await supabase.rpc("admin_unfreeze_member", { _member: memberId });
    if (error) return toast.error(error.message);
    toast.success("Account unfrozen");
    load();
  };

  const resolveCase = async (id: string) => {
    const notes = window.prompt("Resolution notes?") ?? "";
    const { error } = await supabase
      .from("investigation_cases")
      .update({ status: "resolved", resolution_notes: notes, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Case resolved");
    load();
  };

  const counts = (summary?.risk_counts ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-400" /> Fraud Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Auto-calculated risk scores, flags, and investigation queue.</p>
        </div>
        <Button onClick={recalc} disabled={recalcing} variant="outline">
          {recalcing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Recalculate all
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {(["green", "yellow", "orange", "red"] as RiskLevel[]).map((lvl) => (
          <Card key={lvl} className={`p-4 border ${levelTone[lvl]}`}>
            <p className="text-[10px] uppercase tracking-wider">{lvl}</p>
            <p className="text-2xl font-bold">{counts[lvl] ?? 0}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Flags 24h</p>
          <p className="text-2xl font-bold">{summary?.flags_today ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open cases</p>
          <p className="text-2xl font-bold">{summary?.open_cases ?? 0}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Top risk members</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores yet. Click “Recalculate all”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Member</th>
                  <th className="text-left">Risk</th>
                  <th className="text-left">Score</th>
                  <th className="text-left">Account</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.member_id} className="border-b border-border/40">
                    <td className="py-2">
                      <div className="font-medium">{s.members?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.members?.email ?? s.member_id.slice(0, 8)}</div>
                    </td>
                    <td>
                      <Badge variant="outline" className={levelTone[s.risk_level]}>
                        {s.risk_level}
                      </Badge>
                    </td>
                    <td className="font-mono">{s.score}</td>
                    <td className="text-xs">{s.members?.status ?? "active"}</td>
                    <td className="text-right space-x-2">
                      {s.members?.status === "frozen" ? (
                        <Button size="sm" variant="outline" onClick={() => unfreeze(s.member_id)}>
                          Unfreeze
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => freeze(s.member_id)}>
                          Freeze
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Open investigation cases</h2>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open cases.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {cases.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                  <div>
                    <p className="font-medium">{c.opened_reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.status} · {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => resolveCase(c.id)}>
                    Resolve
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Recent flags</h2>
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active flags.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {flags.map((f) => (
                <li key={f.id} className="border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {f.severity}
                    </Badge>
                    <span className="font-medium">{f.flag_type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString()} · {f.member_id.slice(0, 8)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
