import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Q {
  id: string;
  question: string;
  options: unknown;
  correct_answer: string | null;
  status: string | null;
  closes_at: string | null;
  category: string | null;
}

export default function AdminPredictor() {
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({ question: "", options: "", category: "general", closes_at: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("admin_list_predictor_questions");
    setRows((data ?? []) as Q[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!q.question || !q.options) return toast.error("Fill question and options");
    const opts = q.options.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("predictor_questions").insert({
      question: q.question,
      options: opts,
      category: q.category,
      closes_at: q.closes_at ? new Date(q.closes_at).toISOString() : null,
      status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success("Question created");
    setQ({ question: "", options: "", category: "general", closes_at: "" });
    load();
  };

  const setCorrect = async (id: string, answer: string) => {
    const { error } = await supabase.from("predictor_questions").update({ correct_answer: answer, status: "closed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Answer set — payouts can now be processed.");
    load();
  };

  const updateAnswer = async (id: string, answer: string) => {
    const { error } = await supabase.from("predictor_questions").update({ correct_answer: answer }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Correct answer updated.");
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Predictor</h1>

      <div className="mt-6 rounded-3xl border border-border bg-gradient-card p-5 space-y-3">
        <p className="font-medium">Create question</p>
        <div>
          <Label className="text-xs">Question</Label>
          <Input value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} className="mt-1" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Options (comma-separated)</Label>
            <Input value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} placeholder="Yes, No, Maybe" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Input value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Closes at</Label>
            <Input type="datetime-local" value={q.closes_at} onChange={(e) => setQ({ ...q, closes_at: e.target.value })} className="mt-1" />
          </div>
        </div>
        <Button onClick={create} className="bg-gradient-primary text-primary-foreground">Create</Button>
      </div>

      <section className="mt-10 rounded-3xl border border-accent/40 bg-gradient-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Correct answers · admin review</h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-accent">Restricted</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Visible only to admins. Members can never read the <code>correct_answer</code> column.
        </p>
        {loading ? (
          <div className="mt-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {rows.filter((r) => r.correct_answer).length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">No answers set yet.</li>
            ) : (
              rows
                .filter((r) => r.correct_answer)
                .map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.question}</p>
                      <p className="text-xs text-muted-foreground">{r.category} · {r.status}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                      ✓ {r.correct_answer}
                    </span>
                  </li>
                ))
            )}
          </ul>
        )}
      </section>

      <h2 className="mt-10 font-display text-2xl">Recent questions</h2>
      {loading ? <div className="mt-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const opts = Array.isArray(r.options) ? (r.options as string[]) : [];
            return (
              <li key={r.id} className="rounded-3xl border border-border bg-gradient-card p-5">
                <p className="font-medium">{r.question}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.category} · {r.status} {r.correct_answer && `· ✓ ${r.correct_answer}`}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {opts.map((o) => (
                    <Button key={o} size="sm" variant={r.correct_answer === o ? "default" : "outline"} onClick={() => setCorrect(r.id, o)}>
                      Set "{o}"
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
