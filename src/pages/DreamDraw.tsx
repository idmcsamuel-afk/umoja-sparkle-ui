import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Sparkles, Loader2, Users } from "lucide-react";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ENTRY_COST = 50;

function nextSundayMidnight() {
  const d = new Date();
  const day = d.getDay();
  const days = day === 0 ? 7 : 7 - day;
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function DreamDraw() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState(0);
  const [myTickets, setMyTickets] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const drawDate = new Date().toISOString().slice(0, 10);
  const close = nextSundayMidnight();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    if (!user) return;
    const [{ data: w }, { data: all }, { data: mine }] = await Promise.all([
      supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle(),
      supabase.from("dream_draw_entries").select("tickets").gte("draw_date", drawDate),
      supabase.from("dream_draw_entries").select("tickets").eq("member_id", user.id).gte("draw_date", drawDate),
    ]);
    setBalance(Number(w?.balance ?? 0));
    setEntries((all ?? []).reduce((s, r: any) => s + Number(r.tickets || 0), 0));
    setMyTickets((mine ?? []).reduce((s, r: any) => s + Number(r.tickets || 0), 0));
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  const enter = async () => {
    if (!user) return;
    if (balance < ENTRY_COST) {
      toast({ title: "Not enough Sparks", description: `Need ${ENTRY_COST} ⚡`, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("dream_draw_entries").insert({
      member_id: user.id, draw_date: drawDate, tickets: 1, cost_sparks: ENTRY_COST,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't enter", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "🎰 You're in the draw!", description: "Good luck this Sunday." });
    refresh();
  };

  const ms = Math.max(0, close.getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms / 3600000) % 24);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  const prizePool = Math.round(entries * ENTRY_COST * 0.6);

  return (
    <div className="min-h-screen pb-32 bg-[radial-gradient(ellipse_at_top,hsl(44_70%_22%/0.6),hsl(150_18%_5%)_55%)]">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/spark-pit" className="grid h-9 w-9 place-items-center rounded-full bg-card border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">🎰 Dream Draw</h1>
      </header>

      <main className="px-5 space-y-4">
        {/* Lottery machine */}
        <Card className="relative overflow-hidden p-6 border-amber-500/30 bg-gradient-to-b from-amber-950/40 to-black/60">
          <div className="text-center text-[11px] uppercase tracking-widest text-amber-300/80">Prize Pool</div>
          <div className="text-center text-5xl font-black bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent mt-1">
            R{prizePool.toLocaleString()}
          </div>

          <div className="relative mt-6 mx-auto h-44 w-44 rounded-full bg-gradient-to-b from-amber-900/40 to-black/80 border-4 border-amber-500/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.7)] overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="absolute h-9 w-9 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-[inset_-3px_-3px_6px_rgba(80,40,0,0.6),0_4px_10px_rgba(255,180,0,0.5)] grid place-items-center text-amber-900 font-bold text-sm"
                style={{
                  top: `${20 + Math.abs(Math.sin(i * 1.7)) * 90}px`,
                  left: `${20 + Math.abs(Math.cos(i * 1.3)) * 90}px`,
                  animation: `bounce ${1 + (i % 3) * 0.3}s ease-in-out infinite ${i * 0.15}s`,
                }}
              >
                {[7, 21, 9, 33, 12, 45][i]}
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2 text-center">
            {[{l:"Days",v:d},{l:"Hrs",v:h},{l:"Min",v:m},{l:"Sec",v:s}].map((b)=>(
              <div key={b.l} className="rounded-xl bg-black/40 border border-amber-500/20 py-2">
                <div className="text-2xl font-black text-amber-200">{String(b.v).padStart(2,"0")}</div>
                <div className="text-[10px] text-amber-300/70 uppercase">{b.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Users className="h-4 w-4" />} label="Entries" val={entries} />
          <Stat icon={<Trophy className="h-4 w-4" />} label="My tickets" val={myTickets} />
          <Stat icon={<Sparkles className="h-4 w-4" />} label="Balance" val={balance} />
        </div>

        <Button
          onClick={enter}
          disabled={busy || !user}
          className="w-full h-14 text-base font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 hover:opacity-95 border-0 shadow-[0_15px_40px_-15px_hsl(44_80%_55%/0.7)]"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Enter Draw — ${ENTRY_COST} ⚡`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">Winner announced every Sunday at midnight 🌙</p>
      </main>

      <BottomNav />
    </div>
  );
}

function Stat({ icon, label, val }: { icon: any; label: string; val: number }) {
  return (
    <Card className="p-3 text-center border-amber-500/20 bg-black/40">
      <div className="flex items-center justify-center text-amber-300 mb-1">{icon}</div>
      <div className="text-lg font-bold text-amber-100">{val.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </Card>
  );
}
