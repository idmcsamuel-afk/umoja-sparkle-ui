import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Package, TrendingUp, Warehouse, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function FulfillmentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [pastInvoices, setPastInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date();
      const [s, o, inv, curInv, past] = await Promise.all([
        supabase.from("fulfillment_subscriptions").select("*").eq("member_id", user.id).maybeSingle(),
        supabase.from("fulfillment_orders").select("*").eq("member_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("fulfillment_inventory").select("*").eq("member_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("fulfillment_invoices").select("*").eq("member_id", user.id).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).maybeSingle(),
        supabase.from("fulfillment_invoices").select("*").eq("member_id", user.id).order("year", { ascending: false }).order("month", { ascending: false }).limit(12),
      ]);
      setSub(s.data);
      setOrders(o.data ?? []);
      setInventory(inv.data ?? []);
      setInvoice(curInv.data);
      setPastInvoices(past.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (authLoading || loading) return <div className="grid min-h-screen place-items-center"><div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!sub || sub.status !== "active") return <Navigate to="/dashboard" replace />;

  const monthOrders = orders.filter((o) => new Date(o.created_at).getMonth() === new Date().getMonth());
  const revenue = monthOrders.reduce((s, o) => s + Number(o.amount || 0), 0);
  const itemsInWarehouse = inventory.reduce((s, i) => s + Number(i.quantity_total || 0), 0);
  const aov = monthOrders.length > 0 ? revenue / monthOrders.length : 0;

  // Compute current invoice live if not yet generated
  const sm = monthOrders.filter((o) => o.size_tier === "small").length;
  const md = monthOrders.filter((o) => o.size_tier === "medium").length;
  const lg = monthOrders.filter((o) => o.size_tier === "large").length;
  const handling = itemsInWarehouse;
  const liveInvoice = invoice ?? {
    base_fee: sub.monthly_fee,
    small_item_count: sm, medium_item_count: md, large_item_count: lg,
    handling_count: handling,
    item_fees: sm * 15 + md * 25 + lg * 45,
    handling_fees: handling * 5,
    total_amount: Number(sub.monthly_fee) + sm * 15 + md * 25 + lg * 45 + handling * 5,
    due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 7).toISOString(),
    status: "preview",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-5 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="font-display text-lg ml-2">Fulfilled by UMOJA</h1>
      </header>
      <main className="p-5 max-w-6xl mx-auto space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Package} label="Orders this month" value={monthOrders.length.toString()} />
          <StatCard icon={TrendingUp} label="Revenue this month" value={fmtR(revenue)} />
          <StatCard icon={Warehouse} label="Items in warehouse" value={itemsInWarehouse.toString()} />
          <StatCard icon={Receipt} label="Avg order value" value={fmtR(aov)} />
        </div>

        {/* Recent orders */}
        <Card>
          <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Order</TableHead><TableHead>Platform</TableHead><TableHead>City</TableHead>
                  <TableHead>Product</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {orders.slice(0, 20).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{o.platform}</Badge></TableCell>
                      <TableCell>{o.customer_city ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{o.product_name}</TableCell>
                      <TableCell>{fmtR(Number(o.amount))}</TableCell>
                      <TableCell><Badge className="capitalize">{o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader><CardTitle className="text-base">Inventory</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {inventory.length === 0 ? <p className="text-sm text-muted-foreground">No inventory in warehouse yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Total</TableHead>
                  <TableHead>Reserved</TableHead><TableHead>Available</TableHead><TableHead>Last restocked</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {inventory.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{i.sku ?? "—"}</TableCell>
                      <TableCell>{i.quantity_total}</TableCell>
                      <TableCell>{i.quantity_reserved}</TableCell>
                      <TableCell>{i.quantity_available}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.last_restocked_at ? new Date(i.last_restocked_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader><CardTitle className="text-base">Current month invoice</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <Row label="Monthly fee" value={fmtR(Number(liveInvoice.base_fee))} />
            <Row label={`Small item fees (${liveInvoice.small_item_count} × R15)`} value={fmtR(liveInvoice.small_item_count * 15)} />
            <Row label={`Medium item fees (${liveInvoice.medium_item_count} × R25)`} value={fmtR(liveInvoice.medium_item_count * 25)} />
            <Row label={`Large item fees (${liveInvoice.large_item_count} × R45)`} value={fmtR(liveInvoice.large_item_count * 45)} />
            <Row label={`Handling fees (${liveInvoice.handling_count} × R5)`} value={fmtR(liveInvoice.handling_count * 5)} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-medium">
              <span>Total due</span><span className="text-accent">{fmtR(Number(liveInvoice.total_amount))}</span>
            </div>
            <p className="text-xs text-muted-foreground">Due: {new Date(liveInvoice.due_date).toLocaleDateString()}</p>
            {invoice && <Button size="sm" variant="outline" className="mt-2" onClick={() => window.print()}>Download invoice</Button>}
          </CardContent>
        </Card>

        {pastInvoices.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pastInvoices.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.month}/{p.year}</TableCell>
                      <TableCell>{fmtR(Number(p.total_amount))}</TableCell>
                      <TableCell className="text-xs">{new Date(p.due_date).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={p.status === "paid" ? "default" : "destructive"} className="capitalize">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Icon className="h-4 w-4" />{label}</div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
