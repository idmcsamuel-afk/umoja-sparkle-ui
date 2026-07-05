import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry, fmtMoney } from "@/hooks/useCountryConfig";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Store, Sparkles, Package, Users, ShoppingBag, Copy, ExternalLink, Building2 } from "lucide-react";
import { toast } from "sonner";
import SparkTradeProductOpportunities from "./SparkTradeProductOpportunities";
import SparkTradeDemandMeter from "./SparkTradeDemandMeter";
import SparkTradeGroupBrands from "./SparkTradeGroupBrands";

export default function SparkTradeDashboard() {
  const { user } = useAuth();
  const { config } = useMyCountry();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "blueprint";

  const [loading, setLoading] = useState(true);
  const [blueprint, setBlueprint] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [fillByOpp, setFillByOpp] = useState<Record<string, { moq: number; reserved: number; airAvailable: boolean; filledAt: string | null }>>({});
  const [memberProfile, setMemberProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: member } = await supabase
        .from("members")
        .select("spark_trade_onboarding_complete, spark_trade_income_path")
        .eq("id", user.id)
        .maybeSingle();

      if (!member || !(member as any).spark_trade_onboarding_complete) {
        navigate("/spark-trade/onboarding/income-goal");
        setLoading(false);
        return;
      }

      setMemberProfile(member);

      const currentTab = params.get("tab");
      if (!currentTab) {
        const incomePath = (member as any).spark_trade_income_path;
        if (incomePath === "GROUP_BRAND") {
          setParams({ tab: "group-brands" });
        } else if (incomePath === "INDIVIDUAL") {
          setParams({ tab: "reservations" });
        }
      }

      const [bp, st, res] = await Promise.all([
        supabase.from("spark_trade_blueprints" as any).select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("spark_trade_stores" as any).select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("spark_trade_inventory_reservations" as any)
          .select("*, spark_trade_opportunities(product_name, moq_required, air_available, expected_order_date, expected_arrival_date)")
          .eq("member_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setBlueprint((bp as any).data);
      setStore((st as any).data);
      const rows = ((res as any).data as any[]) ?? [];
      setReservations(rows);

      // Build fill map: aggregate ALL reservations across the opportunities this member holds
      const oppIds = Array.from(new Set(rows.map((r) => r.opportunity_id))).filter(Boolean);
      if (oppIds.length) {
        const { data: allRes } = await supabase
          .from("spark_trade_inventory_reservations" as any)
          .select("opportunity_id, units_reserved, reservation_status, reserved_at, created_at")
          .in("opportunity_id", oppIds as any)
          .order("reserved_at", { ascending: true, nullsFirst: true });
        const byOpp: Record<string, { moq: number; reserved: number; airAvailable: boolean; filledAt: string | null }> = {};
        for (const r of rows) {
          const opp = r.spark_trade_opportunities || {};
          byOpp[String(r.opportunity_id)] = {
            moq: Number(opp.moq_required ?? 0) || 0,
            reserved: 0,
            airAvailable: !!opp.air_available,
            filledAt: null,
          };
        }
        for (const a of (allRes as any[]) ?? []) {
          const key = String(a.opportunity_id);
          const entry = byOpp[key];
          if (!entry) continue;
          if (a.reservation_status === "cancelled") continue;
          const prev = entry.reserved;
          entry.reserved = prev + (Number(a.units_reserved) || 0);
          if (!entry.filledAt && entry.moq > 0 && prev < entry.moq && entry.reserved >= entry.moq) {
            entry.filledAt = a.reserved_at || a.created_at || null;
          }
        }
        setFillByOpp(byOpp);
      } else {
        setFillByOpp({});
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const storeUrl = store ? `${window.location.origin}/shop/${store.id}` : "";

  const totalCapital = reservations.reduce((s, r) => s + Number(r.total_capital_allocated || 0), 0);
  const pendingCount = reservations.filter(r => r.reservation_status === "pending").length;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl md:text-4xl">Spark Trade Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Your AI-powered business at a glance.</p>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Capital allocated</p><p className="mt-1 text-xl font-bold">{fmtMoney(totalCapital, config)}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Pending orders</p><p className="mt-1 text-xl font-bold">{pendingCount}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Reservations</p><p className="mt-1 text-xl font-bold">{reservations.length}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Store status</p><p className="mt-1 text-xl font-bold">{store ? "Live" : "—"}</p></Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="mt-8">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="blueprint"><Sparkles className="h-4 w-4 mr-1" /> Blueprint</TabsTrigger>
            <TabsTrigger value="store"><Store className="h-4 w-4 mr-1" /> Store</TabsTrigger>
            <TabsTrigger value="reservations"><Package className="h-4 w-4 mr-1" /> Reservations</TabsTrigger>
            <TabsTrigger value="opportunities"><ShoppingBag className="h-4 w-4 mr-1" /> Browse</TabsTrigger>
            <TabsTrigger value="group-brands"><Building2 className="h-4 w-4 mr-1" /> Group Brands</TabsTrigger>
            <TabsTrigger value="demand"><Users className="h-4 w-4 mr-1" /> Demand</TabsTrigger>
          </TabsList>

          <TabsContent value="blueprint" className="mt-6">
            {!blueprint ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">You don't have a blueprint yet.</p>
                <Button className="mt-4" onClick={() => navigate("/spark-trade/onboarding/income-goal")}>Start onboarding</Button>
              </Card>
            ) : (() => {
              const bpJson = (blueprint.blueprint_json ?? {}) as any;
              const basket = bpJson.basket ?? {};
              const items: any[] = basket.items ?? (blueprint.recommended_products as any[]) ?? [];
              return (
                <Card className="p-6">
                  <h2 className="font-display text-2xl">{blueprint.recommended_business_name}</h2>
                  {bpJson.tier_label && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {bpJson.tier_label}
                      {bpJson.capital_zar != null && <> · capital {fmtMoney(bpJson.capital_zar, config)}</>}
                      {basket.product_count != null && <> · {basket.product_count} products</>}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Total Investment" value={fmtMoney(Number(basket.total_investment_zar ?? 0), config)} />
                    <Stat label="Potential Gross Profit" value={`+${fmtMoney(Number(basket.potential_gross_profit_zar ?? 0), config)}`} />
                    <Stat label="Blended Margin" value={`${basket.blended_margin_pct ?? 0}%`} />
                    <Stat label="First Stock" value={bpJson.estimated_first_stock ?? "~4-6 weeks"} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Real basket cost and *potential* profit if every unit sells. Not guaranteed income.
                  </p>
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Recommended products</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map((p: any, i: number) => (
                        <Card key={i} className="p-4">
                          <p className="font-medium">{p.name || p.product_name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {p.member_moq_units ? `${p.member_moq_units} units` : `MOQ ${p.moq || p.moq_required || "—"}`}
                            {p.margin_pct != null || p.margin != null ? ` • ${p.margin_pct ?? p.margin}% margin` : ""}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" className="mt-6" onClick={() => navigate("/spark-trade/onboarding/ai-blueprint")}>Regenerate Blueprint</Button>
                </Card>
              );
            })()}
          </TabsContent>


          <TabsContent value="store" className="mt-6">
            {!store ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Create your store to start trading.</p>
                <Button className="mt-4" onClick={() => navigate("/spark-trade/onboarding/ai-store-creation")}>Create Store</Button>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="rounded-xl p-6" style={{ background: store.banner_color || "#1e293b", color: "#fff" }}>
                  <h2 className="font-display text-2xl">{store.store_name}</h2>
                  <p className="opacity-80 text-sm mt-1">{store.store_category}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(storeUrl); toast.success("Copied"); }}>
                    <Copy className="h-4 w-4 mr-1" /> Copy URL
                  </Button>
                  <Button variant="outline" size="sm" asChild style={{ display: "none" }}>
                    <a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Visit store</a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/spark-trade/onboarding/ai-store-creation")}>Edit store</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/spark-trade/onboarding/marketplace-recommendations")}>Marketplace listings</Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reservations" className="mt-6">
            {reservations.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No reservations yet.</Card>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => {
                  const fill = fillByOpp[String(r.opportunity_id)] ?? { moq: 0, reserved: 0, airAvailable: false, filledAt: null };
                  const filled = fill.moq > 0 && fill.reserved >= fill.moq;
                  const pct = fill.moq > 0 ? Math.min(100, Math.round((fill.reserved / fill.moq) * 100)) : 0;
                  const placedAt = r.created_at ? new Date(r.created_at) : null;
                  // Arrival estimate: 5 weeks (sea) or 10 days (air) from filled_at
                  const useAir = fill.airAvailable; // per-reservation air flag not tracked; opp-level flag as best signal
                  const filledDate = fill.filledAt ? new Date(fill.filledAt) : null;
                  const arrival = filledDate
                    ? new Date(filledDate.getTime() + (useAir ? 10 : 35) * 86400000)
                    : null;
                  return (
                    <Card key={r.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.spark_trade_opportunities?.product_name ?? `#${r.opportunity_id}`}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.units_reserved} units · {fmtMoney(Number(r.total_capital_allocated), config)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Order placed: {placedAt ? placedAt.toLocaleDateString() : "—"}
                          </p>
                        </div>
                        <Badge variant={r.reservation_status === "received" ? "default" : "secondary"}>
                          {r.reservation_status}
                        </Badge>
                      </div>

                      {fill.moq > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">
                              {filled ? "Group order filled" : "Group order filling"}
                            </span>
                            <span className="text-muted-foreground">
                              {fill.reserved.toLocaleString()} / {fill.moq.toLocaleString()} units ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={`h-full ${filled ? "bg-green-500" : "bg-primary"} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                        {!filled ? (
                          <>
                            <p className="font-medium">Ships once the group order fills</p>
                            <p className="text-muted-foreground mt-0.5">
                              Estimated 4–6 weeks after fill (sea freight). Invite others to help fill this order faster.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">
                              Group order filled on {filledDate!.toLocaleDateString()} — sourcing started.
                            </p>
                            <p className="text-muted-foreground mt-0.5">
                              Estimated arrival {arrival!.toLocaleDateString()} ({useAir ? "~1–2 weeks air" : "~5 weeks sea"}).
                            </p>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>


          <TabsContent value="opportunities" className="mt-6">
            <SparkTradeProductOpportunities />
          </TabsContent>

          <TabsContent value="group-brands" className="mt-6">
            <SparkTradeGroupBrands />
          </TabsContent>

          <TabsContent value="demand" className="mt-6">
            <SparkTradeDemandMeter />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
