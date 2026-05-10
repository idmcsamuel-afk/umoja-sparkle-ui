import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Loader2, Users, Calendar, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { toast } from "sonner";

interface Tier {
  id: string;
  name: string;
  weekly_contribution: number;
  pool_target: number;
  circle_size: number;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  car_image_url: string | null;
  description: string | null;
}

interface DriveCircle {
  id: string;
  name: string | null;
  tier_id: string | null;
  target_pool: number;
  current_pool: number | null;
  members_count: number | null;
  status: string | null;
}

interface Membership {
  id: string;
  circle_id: string | null;
  total_contributed: number | null;
  status: string | null;
  joined_at: string | null;
}

interface Repayment {
  id: string;
  circle_id: string | null;
  amount: number;
  week_number: number | null;
  paid_at: string | null;
  status: string | null;
}

const fmtR = (n: number | null | undefined) =>
  "R" + Math.round(Number(n ?? 0)).toLocaleString("en-ZA");

const Drive = () => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [circles, setCircles] = useState<DriveCircle[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [tRes, cRes, mRes, rRes] = await Promise.all([
      supabase.from("drive_tiers").select("*").eq("status", "active"),
      supabase.from("drive_circles").select("*").neq("status", "completed").order("created_at", { ascending: false }),
      user
        ? supabase.from("drive_members").select("*").eq("member_id", user.id)
        : Promise.resolve({ data: [], error: null } as const),
      user
        ? supabase
            .from("drive_repayments")
            .select("*")
            .eq("member_id", user.id)
            .order("week_number", { ascending: true })
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (tRes.error) console.error(tRes.error);
    if (cRes.error) console.error(cRes.error);
    const tiersData = (tRes.data ?? []) as Tier[];
    const realCircles = (cRes.data ?? []) as DriveCircle[];

    // Synthesize a forming circle for any active tier that has none yet
    const tiersWithCircles = new Set(realCircles.map((c) => c.tier_id));
    const synthetic: DriveCircle[] = tiersData
      .filter((t) => !tiersWithCircles.has(t.id))
      .map((t) => ({
        id: `synthetic-${t.id}`,
        name: `${t.name} Circle`,
        tier_id: t.id,
        target_pool: Number(t.pool_target),
        current_pool: 0,
        members_count: 0,
        status: "forming",
      }));

    setTiers(tiersData);
    setCircles([...realCircles, ...synthetic]);
    setMemberships((mRes.data ?? []) as Membership[]);
    setRepayments((rRes.data ?? []) as Repayment[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const join = async (c: DriveCircle) => {
    if (!user) return toast.error("Sign in first");
    setJoining(c.id);
    let circleId = c.id;
    // Materialize the synthetic forming circle into a real drive_circles row
    if (c.id.startsWith("synthetic-") && c.tier_id) {
      const { data: created, error: cErr } = await supabase
        .from("drive_circles")
        .insert({
          tier_id: c.tier_id,
          name: c.name,
          target_pool: c.target_pool,
          current_pool: 0,
          members_count: 0,
          status: "forming",
        })
        .select("id")
        .single();
      if (cErr || !created) {
        setJoining(null);
        return toast.error(cErr?.message ?? "Could not start circle");
      }
      circleId = created.id;
    }
    if (memberships.some((m) => m.circle_id === circleId)) {
      setJoining(null);
      return toast.message("You're already in this circle");
    }
    const { error } = await supabase.from("drive_members").insert({
      circle_id: circleId,
      member_id: user.id,
      total_contributed: 0,
      status: "active",
    });
    setJoining(null);
    if (error) return toast.error(error.message);
    toast.success(`Joined ${c.name ?? "circle"}`);
    load();
  };

  const tierFor = (id: string | null) => tiers.find((t) => t.id === id);
  const myCircles = circles.filter((c) => memberships.some((m) => m.circle_id === c.id));

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
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">UMOJA Drive</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Own the road,<br />
            <span className="text-gradient-gold italic font-[450]">together.</span>
          </h1>
        </div>
      </section>

      {loading && (
        <div className="px-5 pt-8">
          <div className="mx-auto max-w-md grid place-items-center rounded-3xl glass p-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
      )}

      {/* My Drive */}
      {!loading && myCircles.length > 0 && (
        <section className="px-5 pt-8">
          <div className="mx-auto max-w-md">
            <h2 className="font-display text-xl">My Drive</h2>
            <div className="mt-4 space-y-3">
              {myCircles.map((c) => {
                const t = tierFor(c.tier_id);
                const me = memberships.find((m) => m.circle_id === c.id);
                const pct = Math.min(100, Math.round(((c.current_pool ?? 0) / Math.max(1, c.target_pool)) * 100));
                return (
                  <article key={c.id} className="relative overflow-hidden rounded-3xl p-5 bg-gradient-primary shadow-glow">
                    <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />
                    <div className="relative">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-primary-foreground/80">{t?.name ?? "Drive"}</p>
                      <p className="mt-1 font-display text-xl text-primary-foreground">{c.name ?? "Drive Circle"}</p>
                      {t && (
                        <p className="text-xs text-primary-foreground/80">
                          {t.car_year} {t.car_make} {t.car_model}
                        </p>
                      )}
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between text-xs text-primary-foreground/80">
                          <span>Pool</span>
                          <span className="font-display text-sm text-primary-foreground">
                            {fmtR(c.current_pool)} / {fmtR(c.target_pool)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-background/20 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-gold" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-background/15 backdrop-blur p-3">
                          <p className="text-[10px] uppercase tracking-wider text-primary-foreground/75">My contributions</p>
                          <p className="mt-1 font-display text-base text-primary-foreground">{fmtR(me?.total_contributed)}</p>
                        </div>
                        <div className="rounded-2xl bg-background/15 backdrop-blur p-3">
                          <p className="text-[10px] uppercase tracking-wider text-primary-foreground/75">Members</p>
                          <p className="mt-1 font-display text-base text-primary-foreground inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {c.members_count ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Active circles */}
      {!loading && (
        <section className="px-5 pt-8">
          <div className="mx-auto max-w-md">
            <h2 className="font-display text-xl">Active circles</h2>
            {circles.length === 0 ? (
              <div className="mt-4 rounded-3xl glass p-6 text-center text-sm text-muted-foreground">
                No active drive circles right now.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {circles.map((c, i) => {
                  const t = tierFor(c.tier_id);
                  const pct = Math.min(100, Math.round(((c.current_pool ?? 0) / Math.max(1, c.target_pool)) * 100));
                  const joined = memberships.some((m) => m.circle_id === c.id);
                  const isForming = c.id.startsWith("synthetic-") || c.status === "forming";
                  return (
                    <article
                      key={c.id}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className={`relative overflow-hidden rounded-3xl p-5 animate-slide-up ${
                        isForming
                          ? "border border-dashed border-accent/40 bg-gradient-card"
                          : "glass"
                      }`}
                    >
                      {isForming && (
                        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-accent">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                          </span>
                          Forming
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-primary ${isForming ? "opacity-80" : ""}`}>
                          {t?.car_image_url ? (
                            <img src={t.car_image_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                          ) : (
                            <Car className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pr-20">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{t?.name ?? "Drive"}</p>
                          <p className="font-display text-lg leading-tight truncate">{c.name ?? "Drive Circle"}</p>
                          {t && (
                            <p className="text-xs text-muted-foreground truncate">
                              {t.car_year} {t.car_make} {t.car_model} · {fmtR(t.weekly_contribution)}/wk
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {c.members_count ?? 0}
                            {t ? ` / ${t.circle_size}` : ""}
                          </span>
                          <span>
                            {fmtR(c.current_pool)} / {fmtR(c.target_pool)} · {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isForming ? "bg-accent/30" : "bg-gradient-gold"}`}
                            style={{ width: `${Math.max(pct, isForming ? 4 : 0)}%` }}
                          />
                        </div>
                      </div>

                      {isForming ? (
                        <div className="mt-5 space-y-3">
                          <div className="rounded-2xl bg-secondary/60 p-3">
                            <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-accent">
                              <Clock className="h-3 w-3" /> Opens when full
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t ? `Joining opens once ${t.circle_size} members reserve a seat. ` : ""}
                              We'll notify you the moment this circle activates.
                            </p>
                          </div>
                          <button
                            disabled
                            aria-disabled="true"
                            className="w-full h-11 rounded-2xl border border-border bg-secondary/40 text-sm font-medium text-muted-foreground inline-flex items-center justify-center gap-1.5 cursor-not-allowed"
                          >
                            <Clock className="h-4 w-4" /> Join opens soon
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => join(c)}
                          disabled={joined || joining === c.id}
                          className="mt-5 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {joining === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : joined ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Joined
                            </>
                          ) : (
                            <>
                              <Car className="h-4 w-4" /> Join Circle
                            </>
                          )}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Repayments */}
      {!loading && repayments.length > 0 && (
        <section className="px-5 pt-8">
          <div className="mx-auto max-w-md">
            <h2 className="font-display text-xl inline-flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" /> Repayment schedule
            </h2>
            <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-gradient-card overflow-hidden">
              {repayments.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center gap-4 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                    {r.paid_at ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Week {r.week_number ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {r.paid_at ? `Paid ${new Date(r.paid_at).toLocaleDateString()}` : r.status ?? "pending"}
                    </p>
                  </div>
                  <span className="text-sm font-display text-gradient-gold">{fmtR(r.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
};

export default Drive;
