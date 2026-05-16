import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FulfillmentApplyModal } from "./FulfillmentApplyModal";

type AppRow = { id: string; status: string; rejection_reason: string | null };
type SubRow = { id: string; status: string };

export function FulfillmentCard() {
  const { user } = useAuth();
  const [app, setApp] = useState<AppRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [{ data: apps }, { data: subs }] = await Promise.all([
      supabase.from("fulfillment_applications").select("id, status, rejection_reason").eq("member_id", user.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("fulfillment_subscriptions").select("id, status").eq("member_id", user.id).maybeSingle(),
    ]);
    setApp(apps?.[0] ?? null);
    setSub(subs ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (loading) return null;

  const isActive = sub?.status === "active";
  const isPending = !isActive && app?.status === "pending";
  const isRejected = !isActive && app?.status === "rejected";

  return (
    <div className="mx-auto max-w-md animate-fade-in">
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-elegant">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg">Fulfilled by UMOJA 🏭</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          We source, store, list, ship, and fulfill for you. You provide capital. We do the rest.
        </p>

        <ul className="text-xs space-y-1 mb-4 text-muted-foreground">
          <li>✅ Complete hands-off e-commerce service</li>
          <li>✅ Amazon, Takealot &amp; Makro account management</li>
          <li>✅ Warehousing &amp; fulfillment</li>
          <li>✅ Dedicated account manager</li>
        </ul>

        <div className="rounded-xl bg-background/50 border border-border/50 p-3 mb-4 text-xs">
          <div className="flex justify-between font-medium"><span>Starting at</span><span className="text-accent">R1,999/month</span></div>
          <p className="text-[11px] text-muted-foreground mt-1">Part of the Buyers Club Fulfilled tier.</p>
        </div>

        {isActive ? (
          <Link to="/fulfillment/dashboard" className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 p-3 transition-smooth hover:border-primary/70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Active — view dashboard</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ) : isPending ? (
          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
            <Clock className="h-4 w-4 text-accent" />
            <span>⏳ Application under review</span>
          </div>
        ) : isRejected ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <span>❌ Rejected: {app?.rejection_reason ?? "Please contact support"}</span>
            </div>
            <Button onClick={() => setOpen(true)} className="w-full">Reapply</Button>
          </div>
        ) : (
          <Button onClick={() => setOpen(true)} className="w-full bg-gradient-gold text-amber-950 hover:opacity-90">
            Apply for Fulfilled Service →
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground text-center mt-2">Application required. Limited spots.</p>
      </div>

      <FulfillmentApplyModal open={open} onOpenChange={setOpen} onSubmitted={load} />
    </div>
  );
}
