import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Share2, Sparkles, Trophy, Gift, Info, Crown, Medal, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeaderRow {
  member_id: string;
  full_name: string;
  referral_code: string;
  total_refs: number;
  sparks_earned: number;
}

export function ReferralPromo() {
  const { user, member } = useAuth();
  const [code, setCode] = useState<string>(member?.referral_code ?? "");
  const [stats, setStats] = useState({ total_refs: 0, sparks_earned: 0 });
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [copied, setCopied] = useState(false);

  const link = useMemo(
    () => (code ? `${window.location.origin}/signup?ref=${code}` : ""),
    [code],
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: s }, { data: lb }] = await Promise.all([
        code ? Promise.resolve({ data: { referral_code: code } as any }) : supabase.from("members").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.rpc("referral_stats", { _member: user.id }),
        supabase.rpc("referral_leaderboard", { _limit: 5 }),
      ]);
      if (!code) setCode((m as any)?.referral_code ?? "");
      const sRow = Array.isArray(s) ? s[0] : s;
      if (sRow) setStats({ total_refs: Number(sRow.total_refs ?? 0), sparks_earned: Number(sRow.sparks_earned ?? 0) });
      setBoard((lb as LeaderRow[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `💰 Join me on UMOJA! Earn 15% returns in 5 days through community savings circles.\n\nI'm already earning — you can too! No credit checks needed.\n\nJoin with my link and get 50 Sparks bonus:\n${link}\n\n🌱 Start with just R200\n✨ Get paid every 5-14 days\n🤝 Real community support`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const myRank = board.findIndex((b) => b.member_id === user?.id);
  const rankIcon = (i: number) =>
    i === 0 ? <Crown className="h-3.5 w-3.5 text-accent" /> :
    i === 1 ? <Medal className="h-3.5 w-3.5 text-muted-foreground" /> :
    i === 2 ? <Award className="h-3.5 w-3.5 text-amber-700" /> : null;

  return (
    <TooltipProvider>
      <div className="rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent p-5 shadow-glow animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent/20 text-accent">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-accent">Earn 100 Sparks</p>
              <h3 className="font-display text-lg leading-tight">Invite a friend</h3>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground" aria-label="What are Sparks?">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">
              Sparks boost your merit score, which determines your position in the payout queue. 100 Sparks = +10 merit points = get paid days earlier.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Friends joined</p>
            <p className="mt-1 font-display text-2xl">{stats.total_refs}</p>
          </div>
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-accent" /> Sparks earned
            </p>
            <p className="mt-1 font-display text-2xl text-gradient-gold">{Math.round(stats.sparks_earned)}</p>
          </div>
        </div>

        {/* Link + share */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your referral link</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <div className="flex-1 truncate rounded-2xl border-2 border-accent/40 bg-accent/5 px-3 py-3 text-sm font-medium text-accent">
              {link || "Loading…"}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copyLink}
                className={`min-h-[48px] flex-1 sm:flex-none rounded-2xl ${copied ? "bg-accent text-accent-foreground" : "bg-gradient-primary text-primary-foreground"}`}
                disabled={!link}
              >
                {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
              </Button>
              <Button
                onClick={shareWhatsApp}
                variant="outline"
                className="min-h-[48px] flex-1 sm:flex-none rounded-2xl border-accent/40 text-accent hover:bg-accent/10"
                disabled={!link}
              >
                <Share2 className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </div>

        {/* Value props */}
        <div className="mt-4 rounded-2xl bg-background/40 p-3 text-xs space-y-1">
          <p className="font-medium text-foreground">💰 What you get</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• 100 Sparks per friend (boost merit score)</li>
            <li>• They get 50 Sparks to start</li>
            <li>• Help grow the community</li>
          </ul>
        </div>

        {/* Competition */}
        <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3 text-xs">
          <p className="font-medium text-foreground inline-flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5 text-accent" /> Top 3 this month win
          </p>
          <p className="mt-1 text-muted-foreground">
            🥇 R1,000 + Gold status · 🥈🥉 R500 each · 5+ refs = R100 bonus
          </p>
        </div>

        {/* Leaderboard */}
        {board.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Leaderboard</p>
            <ul className="space-y-1">
              {board.slice(0, 3).map((b, i) => {
                const me = b.member_id === user?.id;
                return (
                  <li key={b.member_id} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ${me ? "bg-gradient-primary/15 ring-1 ring-accent/40" : ""}`}>
                    <span className="w-4 text-center text-muted-foreground">{i + 1}</span>
                    <span className="w-4">{rankIcon(i)}</span>
                    <span className="flex-1 truncate">{b.full_name}{me && <span className="ml-1 text-[9px] text-accent">YOU</span>}</span>
                    <span className="text-muted-foreground">{b.total_refs} refs</span>
                  </li>
                );
              })}
              {myRank < 0 && stats.total_refs > 0 && (
                <li className="rounded-xl px-2.5 py-1.5 text-xs bg-gradient-primary/10 ring-1 ring-accent/30 flex items-center gap-2">
                  <span className="flex-1 truncate text-accent">You</span>
                  <span className="text-muted-foreground">{stats.total_refs} refs</span>
                </li>
              )}
            </ul>
            <Link to="/referrals" className="mt-2 block text-center text-xs text-accent hover:underline">
              View full leaderboard →
            </Link>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ReferralPromo;
