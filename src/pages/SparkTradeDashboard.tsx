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
  const [memberProfile, setMemberProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [bp, st, res] = await Promise.all([
        supabase.from("spark_trade_blueprints" as any).select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("spark_trade_stores" as any).select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("spark_trade_inventory_reservations" as any)
          .select("*, spark_trade_opportunities(product_name, expected_order_date, expected_arrival_date)")
          .eq("member_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setBlueprint((bp as any).data);
      setStore((st as any).data);
      setReservations(((res as any).data as any[]) ?? []);
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
            <TabsTrigger value="demand"><Users className="h-4 w-4 mr-1" /> Demand</TabsTrigger>
          </TabsList>

          <TabsContent value="blueprint" className="mt-6">
            {!blueprint ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">You don't have a blueprint yet.</p>
                <Button className="mt-4" onClick={() => navigate("/spark-trade/onboarding/income-goal")}>Start onboarding</Button>
              </Card>
            ) : (
              <Card className="p-6">
                <h2 className="font-display text-2xl">{blueprint.recommended_business_name}</h2>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Startup capital" value={fmtMoney(Number(blueprint.estimated_startup_capital ?? 0), config)} />
                  <Stat label="Monthly revenue" value={fmtMoney(Number(blueprint.estimated_monthly_revenue ?? 0), config)} />
                  <Stat label="Gross margin" value={`${blueprint.estimated_gross_margin ?? 0}%`} />
                  <Stat label="Confidence" value={`${blueprint.confidence_score ?? 0}%`} />
                </div>
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Recommended products</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(blueprint.recommended_products as any[] ?? []).map((p: any, i: number) => (
                      <Card key={i} className="p-4">
                        <p className="font-medium">{p.name || p.product_name}</p>
                        <p className="text-sm text-muted-foreground mt-1">MOQ: {p.moq || p.moq_required} • Margin: {p.margin || p.margin_pct}%</p>
                      </Card>
                    ))}
                  </div>
                </div>
                <Button variant="outline" className="mt-6" onClick={() => navigate("/spark-trade/onboarding/ai-blueprint")}>Regenerate Blueprint</Button>
              </Card>
            )}
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
                  <Button variant="outline" size="sm" asChild>
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
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Capital</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order date</TableHead>
                      <TableHead>Arrival</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.spark_trade_opportunities?.product_name ?? `#${r.opportunity_id}`}</TableCell>
                        <TableCell>{r.units_reserved}</TableCell>
                        <TableCell>{fmtMoney(Number(r.total_capital_allocated), config)}</TableCell>
                        <TableCell><Badge variant={r.reservation_status === "received" ? "default" : "secondary"}>{r.reservation_status}</Badge></TableCell>
                        <TableCell>{r.spark_trade_opportunities?.expected_order_date ? new Date(r.spark_trade_opportunities.expected_order_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{r.spark_trade_opportunities?.expected_arrival_date ? new Date(r.spark_trade_opportunities.expected_arrival_date).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="opportunities" className="mt-6">
            <SparkTradeProductOpportunities />
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
