import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, Loader2, Trophy, Sparkles, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Question {
  id: string;
  question: string;
  category: string | null;
  options: string[] | null;
  closes_at: string | null;
  sparks_cost: number | null;
  sparks_reward: number | null;
  status: string | null;
}

interface Entry {
  id: string;
  question_id: string | null;
  selected_answer: string | null;
  is_correct: boolean | null;
  sparks_spent: number | null;
  sparks_won: number | null;
  created_at: string | null;
}

interface LeaderRow {
  member_id: string;
  full_name: string;
  correct: number;
  sparks_won: number;
}

const useCountdown = (iso: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Closed";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
};

const QuestionCard = ({
  q, myEntry, onAnswer, busy,
}: {
  q: Question;
  myEntry?: Entry;
  onAnswer: (q: Question, ans: string) => void;
  busy: boolean;
}) => {
  const countdown = useCountdown(q.closes_at);
  const closed = countdown === "Closed";
  return (
    <article className="relative overflow-hidden rounded-3xl glass p-5 animate-slide-up">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{q.category ?? "Market"}</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {countdown}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg leading-snug">{q.question}</h3>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {(q.options ?? []).map((opt) => {
          const picked = myEntry?.selected_answer === opt;
          return (
            <button
              key={opt}
              onClick={() => onAnswer(q, opt)}
              disabled={!!myEntry || closed || busy}
              className={`h-11 px-4 rounded-2xl text-sm font-medium text-left inline-flex items-center justify-between transition-smooth border ${
                picked
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "bg-secondary/60 border-border hover:border-primary/40"
              } disabled:opacity-60`}
            >
              <span>{opt}</span>
              {picked && <CheckCircle2 className="h-4 w-4" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-accent" /> {q.sparks_cost ?? 10} SP to play
        </span>
        <span>Win {q.sparks_reward ?? 25} SP</span>
      </div>
    </article>
  );
};

const Predictor = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const [qRes, eRes, lRes] = await Promise.all([
      supabase
        .from("predictor_questions")
        .select("*")
        .eq("status", "active")
        .gt("closes_at", nowIso)
        .order("closes_at", { ascending: true }),
      user
        ? supabase
            .from("predictor_entries")
            .select("*")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as const),
      supabase
        .from("predictor_entries")
        .select("member_id, is_correct, sparks_won")
        .eq("is_correct", true)
        .limit(1000),
    ]);
    if (qRes.error) console.error(qRes.error);

    const rawQuestions = (qRes.data ?? []) as Array<Omit<Question, "options"> & { options: unknown }>;
    setQuestions(
      rawQuestions.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : null,
      }))
    );
    setEntries((eRes.data ?? []) as Entry[]);

    // Aggregate leaderboard
    const agg: Record<string, { correct: number; sparks_won: number }> = {};
    for (const r of (lRes.data ?? []) as { member_id: string; sparks_won: number | null }[]) {
      if (!r.member_id) continue;
      agg[r.member_id] = agg[r.member_id] ?? { correct: 0, sparks_won: 0 };
      agg[r.member_id].correct += 1;
      agg[r.member_id].sparks_won += Number(r.sparks_won ?? 0);
    }
    const ids = Object.keys(agg);
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: ms } = await supabase.from("members").select("id, full_name").in("id", ids);
      names = Object.fromEntries((ms ?? []).map((m) => [m.id, m.full_name]));
    }
    const board = ids
      .map((id) => ({
        member_id: id,
        full_name: names[id] ?? "Member",
        correct: agg[id].correct,
        sparks_won: agg[id].sparks_won,
      }))
      .sort((a, b) => b.correct - a.correct || b.sparks_won - a.sparks_won)
      .slice(0, 10);
    setLeaders(board);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const entryByQ = useMemo(() => {
    const map: Record<string, Entry> = {};
    for (const e of entries) if (e.question_id) map[e.question_id] = map[e.question_id] ?? e;
    return map;
  }, [entries]);

  const submit = async (q: Question, ans: string) => {
    if (!user) return toast.error("Sign in first");
    setBusy(true);
    const { error } = await supabase.from("predictor_entries").insert({
      question_id: q.id,
      member_id: user.id,
      selected_answer: ans,
      sparks_spent: q.sparks_cost ?? 10,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pick locked in ✨");
    load();
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Predictor</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Read the market.<br />
            <span className="text-gradient-gold italic font-[450]">Earn the Sparks.</span>
          </h1>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <Tabs defaultValue="play" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-secondary/60 p-1 h-12">
              <TabsTrigger value="play" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow text-xs">
                Play
              </TabsTrigger>
              <TabsTrigger value="picks" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-xs">
                My Picks
              </TabsTrigger>
              <TabsTrigger value="board" className="rounded-xl data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-xs">
                Leaderboard
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="mt-6 grid place-items-center rounded-3xl glass p-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="play" className="mt-5 space-y-3">
                  {questions.length === 0 ? (
                    <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
                      No live questions right now. New rounds drop daily.
                    </div>
                  ) : (
                    questions.map((q) => (
                      <QuestionCard
                        key={q.id}
                        q={q}
                        myEntry={entryByQ[q.id]}
                        onAnswer={submit}
                        busy={busy}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="picks" className="mt-5">
                  {entries.length === 0 ? (
                    <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
                      You haven't placed any picks yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
                      {entries.slice(0, 20).map((e) => (
                        <li key={e.id} className="flex items-center gap-4 p-4">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                            {e.is_correct === true ? (
                              <CheckCircle2 className="h-4 w-4 text-accent" />
                            ) : e.is_correct === false ? (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{e.selected_answer ?? "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {e.is_correct === null
                                ? "Awaiting result"
                                : e.is_correct
                                ? `Won +${e.sparks_won ?? 0} SP`
                                : `−${e.sparks_spent ?? 0} SP`}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {e.created_at ? new Date(e.created_at).toLocaleDateString() : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="board" className="mt-5">
                  {leaders.length === 0 ? (
                    <div className="rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
                      Leaderboard is empty — be the first to call it right.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
                      {leaders.map((l, i) => (
                        <li key={l.member_id} className="flex items-center gap-4 p-4">
                          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl font-display text-sm ${
                            i === 0 ? "bg-gradient-gold text-background" : "bg-secondary text-primary"
                          }`}>
                            {i === 0 ? <Trophy className="h-4 w-4" /> : i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{l.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground inline-flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" /> {l.correct} correct
                            </p>
                          </div>
                          <span className="text-sm font-display text-gradient-gold">+{l.sparks_won} SP</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </section>

      <BottomNav />
    </main>
  );
};

export default Predictor;
