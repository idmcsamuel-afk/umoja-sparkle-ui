import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Sparkles, Users, Trophy, Crown, Medal, Award, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { ThemeToggle } from "@/components/umoja/ThemeToggle";
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

interface ReferredRow {
  id: string;
  full_name: string;
  joined_at: string;
  kyc_level: number;
}

const Referrals = () => {
  const { user, member } = useAuth();
  const [code, setCode] = useState<string>("");
  const [stats, setStats] = useState({ total_refs: 0, sparks_earned: 0 });
  const [referred, setReferred] = useState<ReferredRow[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const link = useMemo(
    () => (code ? `${window.location.origin}/signup?ref=${code}` : ""),
    [code],
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: s }, { data: r }, { data: lb }] = await Promise.all([
        supabase.from("members").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.rpc("referral_stats", { _member: user.id }),
        supabase.rpc("my_referred_members"),
        supabase.rpc("referral_leaderboard", { _limit: 10 }),
      ]);
      setCode((m as any)?.referral_code ?? "");
      const sRow = Array.isArray(s) ? s[0] : s;
      if (sRow) setStats({ total_refs: Number(sRow.total_refs ?? 0), sparks_earned: Number(sRow.sparks_earned ?? 0) });
      setReferred((r as ReferredRow[]) ?? []);
      setBoard((lb as LeaderRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const linkRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const selectAll = () => linkRef.current?.select();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      selectAll();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { toast.error("Could not copy"); }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Your friend invited you to join Africa's fastest-growing wealth circle 🌍\n\n✅ Works in South Africa, Kenya, Nigeria, Ghana & more\n✅ Pay with local currency or USDT crypto\n✅ Get paid in 5–14 days\n\nUse my link for 50 welcome Sparks ✨\n${link}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join UMOJA", text: "Join me on UMOJA", url: link }); }
      catch {}
    } else copyLink();
  };

  const myRank = board.findIndex((b) => b.member_id === user?.id);
  const rankIcon = (i: number) =>
    i === 0 ? <Crown className="h-4 w-4 text-accent" /> :
    i === 1 ? <Medal className="h-4 w-4 text-muted-foreground" /> :
    i === 2 ? <Award className="h-4 w-4 text-amber-700" /> : null;

  return (
    <main className="relative min-h-screen overflow-hidden pb-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <Logo />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Invite friends 🎁</p>
            <h1 className="font-display text-[34px] leading-tight">
              Earn <span className="text-gradient-gold italic font-[450]">Sparks</span> for every friend you bring.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              100 Sparks per signup · 30 bonus when they verify · They get 50 welcome Sparks.
            </p>
            <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/5 p-3 text-xs text-foreground/90 space-y-1">
              <p>🌍 Works across Africa — South Africa, Kenya, Nigeria, Ghana & more</p>
              <p>💱 Friends can pay in local currency or USDT crypto</p>
              <p>⚡ Invite from anywhere on the continent</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Referrals</div>
              <div className="mt-1 text-3xl font-display">{stats.total_refs}</div>
            </div>
            <div className="glass rounded-3xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-accent" /> Sparks earned</div>
              <div className="mt-1 text-3xl font-display text-gradient-gold">{Math.round(stats.sparks_earned)}</div>
            </div>
          </div>

          {/* Link + QR */}
          <div className="glass rounded-3xl p-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your referral link</p>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative rounded-2xl border-2 border-accent/50 bg-accent/5 focus-within:border-accent transition-smooth">
                  <input
                    ref={linkRef}
                    readOnly
                    value={link}
                    onClick={selectAll}
                    onFocus={selectAll}
                    className="w-full bg-transparent px-4 py-4 text-base sm:text-lg font-medium text-accent tracking-tight outline-none cursor-text"
                  />
                </div>
                <Button
                  onClick={copyLink}
                  className={`h-auto sm:h-14 px-5 rounded-2xl text-base font-semibold shadow-glow transition-all ${
                    copied
                      ? "bg-accent text-accent-foreground scale-105"
                      : "bg-gradient-primary text-primary-foreground hover:opacity-95"
                  }`}
                >
                  {copied ? (<><Check className="h-5 w-5" /> Copied!</>) : (<><Copy className="h-5 w-5" /> Copy Link</>)}
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Code: <span className="font-mono text-foreground">{code}</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={shareWhatsApp} variant="outline" className="rounded-2xl border-accent/40 text-accent hover:bg-accent/10"><Share2 className="h-4 w-4" /> WhatsApp</Button>
                <Button onClick={nativeShare} variant="outline" className="rounded-2xl"><Share2 className="h-4 w-4" /> Share</Button>
              </div>
            </div>

            {link && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="rounded-2xl bg-white p-3">
                  <QRCodeSVG value={link} size={148} level="M" />
                </div>
                <p className="text-[11px] text-muted-foreground">Scan to join</p>
              </div>
            )}
          </div>

          {/* Referred members */}
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your referrals</p>
              <span className="text-xs text-muted-foreground">{referred.length}</span>
            </div>
            {referred.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals yet. Share your link to start earning.</p>
            ) : (
              <ul className="divide-y divide-border">
                {referred.map((r) => {
                  const approved = r.kyc_level >= 3;
                  return (
                    <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Joined {new Date(r.joined_at).toLocaleDateString()} · +100 ✨ {approved ? "· +30 bonus ✨" : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${approved ? "bg-accent/15 text-accent" : "bg-amber-500/10 text-amber-500"}`}>
                          {approved ? "Approved" : "Pending"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">KYC {r.kyc_level}/3</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-accent" />
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top referrers</p>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              board.length === 0 ? <p className="text-sm text-muted-foreground">Be the first on the board.</p> :
              <ul className="space-y-1">
                {board.map((b, i) => {
                  const me = b.member_id === user?.id;
                  return (
                    <li key={b.member_id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${me ? "bg-gradient-primary/15 ring-1 ring-accent/40" : ""}`}>
                      <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <span className="w-5">{rankIcon(i)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{b.full_name}{me && <span className="ml-2 text-[10px] text-accent">YOU</span>}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{b.total_refs} refs</span>
                      <span className="text-xs text-accent">{Math.round(Number(b.sparks_earned))} ✨</span>
                    </li>
                  );
                })}
              </ul>
            }
            {myRank >= 10 && (
              <p className="mt-3 text-xs text-muted-foreground">Your rank: outside top 10 — keep going!</p>
            )}
          </div>
        </div>
      </section>

      <BottomNav />
    </main>
  );
};

export default Referrals;
