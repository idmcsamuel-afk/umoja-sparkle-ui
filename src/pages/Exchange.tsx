import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, ArrowDownLeft, ArrowUpRight, Plus, Wallet, History, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { SparksDisclaimer } from "@/components/umoja/SparksDisclaimer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const SPARK_RATE = 1; // 1 Spark = R1 ZAR
const COMMISSION = 0.02;

interface Offer {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  spark_amount: number;
  price_per_spark: number;
  total_price: number;
  commission: number;
  seller_receives: number;
  status: string | null;
  created_at: string | null;
}

interface Txn {
  id: string;
  tx_type: string;
  amount: number;
  fiat_amount: number | null;
  status: string | null;
  created_at: string | null;
  from_member: string | null;
  to_member: string | null;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");
const fmtSP = (n: number) => Math.round(n).toLocaleString("en-ZA") + " SP";

export default function Exchange() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sellOpen, setSellOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [hasContributed, setHasContributed] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [sellAmt, setSellAmt] = useState("");
  const [sellPrice, setSellPrice] = useState(String(SPARK_RATE));
  const [confirmBuy, setConfirmBuy] = useState<Offer | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const [tab, setTab] = useState<"market" | "history">("market");

  const load = async () => {
    setLoading(true);
    const [oRes, tRes, wRes, mRes] = await Promise.all([
      supabase
        .from("spark_exchange")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50),
      user
        ? supabase
            .from("spark_transactions")
            .select("id, tx_type, amount, fiat_amount, status, created_at, from_member, to_member")
            .or(`from_member.eq.${user.id},to_member.eq.${user.id}`)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null } as const),
      user
        ? supabase.from("spark_wallets").select("balance").eq("member_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      user
        ? supabase.from("members").select("has_contributed").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);
    setOffers((oRes.data ?? []) as Offer[]);
    setTxns((tRes.data ?? []) as Txn[]);
    setBalance(Number((wRes.data as { balance?: number } | null)?.balance ?? 0));
    setHasContributed(!!(mRes.data as { has_contributed?: boolean } | null)?.has_contributed);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const sellPreview = useMemo(() => {
    const amt = Number(sellAmt) || 0;
    const price = Number(sellPrice) || 0;
    const total = +(amt * price).toFixed(2);
    const commission = +(total * COMMISSION).toFixed(2);
    const receives = +(total - commission).toFixed(2);
    return { total, commission, receives };
  }, [sellAmt, sellPrice]);

  const postSell = async () => {
    if (!user) return toast.error("Sign in first");
    const amt = Number(sellAmt);
    const price = Number(sellPrice);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter Spark amount");
    if (!Number.isFinite(price) || price <= 0) return toast.error("Enter price per Spark");
    if (amt > balance) return toast.error("Not enough Sparks in your wallet");
    setBusy(true);
    const { error } = await supabase.from("spark_exchange").insert({
      seller_id: user.id,
      spark_amount: amt,
      price_per_spark: price,
      total_price: sellPreview.total,
      commission: sellPreview.commission,
      seller_receives: sellPreview.receives,
      status: "open",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Offer posted to exchange ✨");
    setSellOpen(false);
    setSellAmt("");
    load();
  };

  const confirmReserve = async () => {
    if (!confirmBuy || !user) return;
    setBuyBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBuyBusy(false);
    toast.success("Reserved — admin will settle the trade shortly.", {
      description: `${fmtSP(confirmBuy.spark_amount)} for ${fmtR(confirmBuy.total_price)}`,
    });
    setConfirmBuy(null);
  };

  const onBuyClick = (o: Offer) => {
    if (!user) return toast.error("Sign in first");
    if (o.seller_id === user.id) return toast.error("That's your own offer");
    setConfirmBuy(o);
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <button
            onClick={() => (hasContributed ? setSellOpen(true) : setLockOpen(true))}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            aria-label="Sell sparks"
          >
            {hasContributed ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Spark Exchange</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Trade Sparks<br />
            <span className="text-gradient-gold italic font-[450]">at fair rates.</span>
          </h1>
        </div>
      </section>

      {/* Balance + rate */}
      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md grid grid-cols-2 gap-3">
          <div className="rounded-3xl glass p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Your wallet
            </div>
            <p className="mt-2 font-display text-2xl text-gradient-gold">{fmtSP(balance)}</p>
            <p className="text-xs text-muted-foreground">≈ {fmtR(balance * SPARK_RATE)}</p>
          </div>
          <div className="rounded-3xl glass p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Current rate
            </div>
            <p className="mt-2 font-display text-2xl">1 SP = R{SPARK_RATE.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{Math.round(COMMISSION * 100)}% platform fee</p>
          </div>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-md">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "market" | "history")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-secondary/60 p-1 h-12">
              <TabsTrigger value="market" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Offers
                {!loading && offers.length > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === "market" ? "bg-background/25 text-primary-foreground" : "bg-secondary text-foreground"}`}>{offers.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl gap-1.5 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow text-xs font-medium">
                <History className="h-3.5 w-3.5" /> History
                {!loading && txns.length > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === "history" ? "bg-background/25 text-primary-foreground" : "bg-secondary text-foreground"}`}>{txns.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="mt-5 space-y-3 animate-fade-in">
              {loading ? (
                <div className="space-y-3">
                  {[0,1,2].map((i) => (
                    <div key={i} className="rounded-3xl glass p-5 animate-pulse" style={{ animationDelay: `${i * 70}ms` }}>
                      <div className="flex justify-between">
                        <div className="space-y-2">
                          <div className="h-3 w-16 rounded bg-secondary/80" />
                          <div className="h-6 w-24 rounded bg-secondary/80" />
                          <div className="h-3 w-20 rounded bg-secondary/60" />
                        </div>
                        <div className="h-5 w-16 rounded bg-secondary/80" />
                      </div>
                      <div className="mt-4 h-10 w-full rounded-2xl bg-secondary/80" />
                    </div>
                  ))}
                </div>
              ) : offers.length === 0 ? (
                <div className="rounded-3xl glass p-10 text-center animate-scale-in">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary/10 border border-primary/20">
                    <Sparkles className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="mt-4 font-display text-xl">No open offers</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">Be the first to set a fair rate for the village.</p>
                  <Button
                    onClick={() => (hasContributed ? setSellOpen(true) : setLockOpen(true))}
                    className="mt-5 h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale"
                  >
                    {hasContributed ? <><Plus className="h-4 w-4 mr-1.5" /> Sell Sparks</> : <><Lock className="h-4 w-4 mr-1.5" /> Withdrawal locked</>}
                  </Button>
                </div>
              ) : (
                offers.map((o, i) => {
                  const mine = o.seller_id === user?.id;
                  return (
                    <article
                      key={o.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                      className="rounded-3xl glass p-5 animate-slide-up transition-transform active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                            {mine ? "Your offer" : "Selling"}
                          </p>
                          <p className="mt-1 font-display text-xl">
                            <span className="text-gradient-gold">{fmtSP(Number(o.spark_amount))}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @ R{Number(o.price_per_spark).toFixed(2)} per SP
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-lg">{fmtR(Number(o.total_price))}</p>
                          <p className="text-[11px] text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={mine}
                        onClick={() => onBuyClick(o)}
                        className="mt-4 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-50 hover-scale"
                      >
                        {mine ? "Awaiting buyer" : (<><ArrowDownLeft className="h-4 w-4 mr-1.5" /> Buy now</>)}
                      </Button>
                    </article>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-5 animate-fade-in">
              {loading ? (
                <div className="rounded-3xl glass divide-y divide-border overflow-hidden">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                      <div className="h-10 w-10 rounded-2xl bg-secondary/80" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-secondary/80" />
                        <div className="h-2.5 w-32 rounded bg-secondary/60" />
                      </div>
                      <div className="h-3 w-16 rounded bg-secondary/80" />
                    </div>
                  ))}
                </div>
              ) : txns.length === 0 ? (
                <div className="rounded-3xl glass p-10 text-center animate-scale-in">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary/80 border border-border">
                    <History className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-display text-xl">No transactions yet</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">Your trades and transfers will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
                  {txns.map((t, i) => {
                    const incoming = t.to_member === user?.id;
                    return (
                      <li key={t.id} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }} className="flex items-center gap-4 p-4 animate-fade-in">
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${incoming ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium capitalize">{t.tx_type.replace(/_/g, " ")}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.status} · {t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
                          </p>
                        </div>
                        <span className={`text-sm font-display ${incoming ? "text-gradient-gold" : "text-muted-foreground"}`}>
                          {incoming ? "+" : "−"}{fmtSP(Number(t.amount))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Sell offer dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Sell Sparks</DialogTitle>
            <DialogDescription>
              Post an offer for buyers. {Math.round(COMMISSION * 100)}% platform fee on completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sparks to sell</Label>
              <Input
                type="number"
                value={sellAmt}
                onChange={(e) => setSellAmt(e.target.value)}
                placeholder="0"
                className="mt-1 h-12 rounded-2xl bg-secondary/60 font-display text-xl"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Wallet balance: {fmtSP(balance)}</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Price per Spark (R)</Label>
              <Input
                type="number"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="mt-1 h-12 rounded-2xl bg-secondary/60"
              />
            </div>
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{fmtR(sellPreview.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fee ({Math.round(COMMISSION * 100)}%)</span><span className="text-muted-foreground">− {fmtR(sellPreview.commission)}</span></div>
              <div className="my-1 h-px bg-border" />
              <div className="flex justify-between"><span>You receive</span><span className="text-gradient-gold font-display">{fmtR(sellPreview.receives)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellOpen(false)}>Cancel</Button>
            <Button onClick={postSell} disabled={busy} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm buy dialog */}
      <Dialog open={!!confirmBuy} onOpenChange={(v) => !v && !buyBusy && setConfirmBuy(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Confirm purchase</DialogTitle>
            <DialogDescription>Review the trade before reserving. Admin will settle once payment clears.</DialogDescription>
          </DialogHeader>
          {confirmBuy && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-gradient-primary/10 border border-primary/20 p-5 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent">You receive</p>
                <p className="mt-1 font-display text-3xl text-gradient-gold">{fmtSP(Number(confirmBuy.spark_amount))}</p>
                <p className="text-xs text-muted-foreground mt-0.5">@ R{Number(confirmBuy.price_per_spark).toFixed(2)} per SP</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtR(Number(confirmBuy.total_price))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-muted-foreground">included</span></div>
                <div className="my-1 h-px bg-border" />
                <div className="flex justify-between font-medium"><span>You pay</span><span className="text-gradient-gold font-display">{fmtR(Number(confirmBuy.total_price))}</span></div>
              </div>
              <div className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p>Sparks are held in escrow until admin confirms your payment to the seller.</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" disabled={buyBusy} onClick={() => setConfirmBuy(null)}>Cancel</Button>
            <Button
              onClick={confirmReserve}
              disabled={buyBusy}
              className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover-scale min-w-[140px]"
            >
              {buyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ArrowDownLeft className="h-4 w-4 mr-1.5" /> Reserve trade</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal lock dialog */}
      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="rounded-3xl border border-accent/40 bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2"><Lock className="h-5 w-5 text-accent" /> Withdrawal Locked</DialogTitle>
            <DialogDescription>
              Spark withdrawals require a financial contribution to the UMOJA community first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl bg-secondary/40 p-4">
              <p className="font-medium mb-2">Contribute by:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Joining a Circle (from R50)</li>
                <li>• Purchasing from Spark Trade</li>
                <li>• Joining UMOJA Drive</li>
                <li>• Subscribing to Buyers Club</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-medium mb-2">Sparks earned through referrals can still be used for:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Playing Spark Pit games</li>
                <li>✓ Joining Spark Trade groups</li>
                <li>✓ Circle entry fees</li>
              </ul>
              <p className="mt-2 text-xs text-accent">But not for cash withdrawal until you contribute.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setLockOpen(false)}>Close</Button>
            <Link to="/circle" onClick={() => setLockOpen(false)}>
              <Button className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">View contribution options</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <BottomNav />
    </main>
  );
}
