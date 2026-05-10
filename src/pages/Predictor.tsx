import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, Loader2, Trophy, Sparkles, Clock, CheckCircle2, XCircle, History, Lock } from "lucide-react";
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

interface QMeta { question: string; category: string | null; correct_answer: string | null; closes_at: string | null }

const Predictor = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [qMeta, setQMeta] = useState<Record<string, QMeta>>({});
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [qRes, eRes, lRes] = await Promise.all([
      supabase
        .from("predictor_questions")
        .select("id, question, category, options, closes_at, sparks_cost, sparks_reward, status")
        .eq("status", "active")
        .order("closes_at", { ascending: true, nullsFirst: false }),
      user
        ? supabase
            .from("predictor_entries")
            .select("*")
            .eq("member_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null } as const),
      supabase.rpc("predictor_leaderboard", { _limit: 10 }),
    ]);
    if (qRes.error) console.error(qRes.error);

    const rawQuestions = (qRes.data ?? []) as Array<Omit<Question, "options"> & { options: unknown }>;
    const liveQs: Question[] = rawQuestions.map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? (q.options as string[]) : null,
    }));
    setQuestions(liveQs);

    const myEntries = (eRes.data ?? []) as Entry[];
    setEntries(myEntries);

    // Fetch question meta for any entries whose question isn't in the live list
    const liveIds = new Set(liveQs.map((q) => q.id));
    const missingIds = Array.from(
      new Set(myEntries.map((e) => e.question_id).filter((id): id is string => !!id && !liveIds.has(id)))
    );
    const meta: Record<string, QMeta> = {};
    for (const q of liveQs) meta[q.id] = { question: q.question, category: q.category, correct_answer: null, closes_at: q.closes_at };
    if (missingIds.length > 0) {
      const { data: extra } = await supabase
        .from("predictor_questions")
        .select("id, question, category, correct_answer, closes_at")
        .in("id", missingIds);
      for (const q of (extra ?? []) as Array<{ id: string } & QMeta>) {
        meta[q.id] = { question: q.question, category: q.category, correct_answer: q.correct_answer, closes_at: q.closes_at };
      }
    }
    setQMeta(meta);

    const board = ((lRes.data ?? []) as Array<{ member_id: string; full_name: string | null; correct: number; sparks_won: number }>).map(
      (r) => ({
        member_id: r.member_id,
        full_name: r.full_name ?? "Member",
        correct: Number(r.correct ?? 0),
        sparks_won: Number(r.sparks_won ?? 0),
      })
    );
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

                <TabsContent value="picks" className="mt-5 space-y-3">
                  {!user ? (
                    <div className="rounded-3xl glass p-8 text-center animate-fade-in">
                      <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">Sign in to see your prediction history.</p>
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="rounded-3xl glass p-8 text-center animate-fade-in">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary/10 border border-primary/20">
                        <History className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="mt-3 font-display text-lg">No picks yet</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Place your first prediction in the Play tab.</p>
                    </div>
                  ) : (
                    <>
                      {/* Summary stats */}
                      {(() => {
                        const won = entries.filter((e) => e.is_correct === true).length;
                        const lost = entries.filter((e) => e.is_correct === false).length;
                        const pending = entries.filter((e) => e.is_correct === null).length;
                        const net = entries.reduce(
                          (s, e) => s + (e.is_correct ? Number(e.sparks_won ?? 0) : e.is_correct === false ? -Number(e.sparks_spent ?? 0) : 0),
                          0
                        );
                        const acc = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
                        return (
                          <div className="grid grid-cols-4 gap-2 animate-fade-in">
                            <Stat label="Picks" value={entries.length.toString()} />
                            <Stat label="Won" value={won.toString()} accent />
                            <Stat label="Pending" value={pending.toString()} />
                            <Stat label="Net SP" value={`${net >= 0 ? "+" : ""}${net}`} gold={net > 0} />
                            <div className="col-span-4 rounded-2xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground inline-flex items-center justify-between">
                              <span>Accuracy</span>
                              <span className="font-display text-base text-gradient-gold">{acc}%</span>
                            </div>
                          </div>
                        );
                      })()}

                      <ul className="space-y-2 animate-slide-up">
                        {entries.map((e) => {
                          const meta = e.question_id ? qMeta[e.question_id] : undefined;
                          const dt = e.created_at ? new Date(e.created_at) : null;
                          const status =
                            e.is_correct === true ? "won" : e.is_correct === false ? "lost" : "pending";
                          return (
                            <li
                              key={e.id}
                              className="rounded-3xl border border-border bg-gradient-card p-4 transition-smooth hover:border-primary/40"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                                  status === "won" ? "bg-gradient-gold text-background"
                                  : status === "lost" ? "bg-destructive/15 text-destructive"
                                  : "bg-secondary text-muted-foreground"
                                }`}>
                                  {status === "won" ? <CheckCircle2 className="h-4 w-4" />
                                    : status === "lost" ? <XCircle className="h-4 w-4" />
                                    : <Clock className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent truncate">
                                      {meta?.category ?? "Market"}
                                    </p>
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                                      {dt ? dt.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : ""}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-2">
                                    {meta?.question ?? "Question"}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="rounded-full bg-secondary/60 border border-border px-2.5 py-0.5">
                                      Your pick: <span className="font-medium">{e.selected_answer ?? "—"}</span>
                                    </span>
                                    {meta?.correct_answer && status !== "pending" && (
                                      <span className="rounded-full bg-secondary/30 border border-border px-2.5 py-0.5 text-muted-foreground">
                                        Outcome: {meta.correct_answer}
                                      </span>
                                    )}
                                    <span
                                      className={`ml-auto inline-flex items-center gap-1 font-display ${
                                        status === "won" ? "text-gradient-gold"
                                        : status === "lost" ? "text-destructive"
                                        : "text-muted-foreground"
                                      }`}
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      {status === "won"
                                        ? `+${e.sparks_won ?? 0} SP`
                                        : status === "lost"
                                        ? `−${e.sparks_spent ?? 0} SP`
                                        : `${e.sparks_spent ?? 0} SP held`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
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

function Stat({ label, value, accent, gold }: { label: string; value: string; accent?: boolean; gold?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-2.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-base ${gold ? "text-gradient-gold" : accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

export default Predictor;
