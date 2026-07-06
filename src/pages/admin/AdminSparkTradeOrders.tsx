import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Users, DollarSign, Boxes, CheckCircle2, ArrowUpDown } from "lucide-react";

interface Reservation {
  id: number;
  member_id: string;
  opportunity_id: number;
  units_reserved: number;
  total_capital_allocated: number;
  reservation_status: string;
  paid_at: string | null;
  created_at: string;
}
interface Opp {
  id: number;
  product_name: string | null;
  product_image_url: string | null;
  moq_required: number | null;
  suggested_selling_price_zar: number | null;
  category: string | null;
}
interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
}

const fmt = (n: number) => `R${Math.round(n).toLocaleString()}`;

export default function AdminSparkTradeOrders() {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [opps, setOpps] = useState<Record<number, Opp>>({});
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"units" | "fill" | "revenue">("units");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rs } = await supabase
        .from("spark_trade_inventory_reservations")
        .select("id, member_id, opportunity_id, units_reserved, total_capital_allocated, reservation_status, paid_at, created_at")
        .in("reservation_status", ["paid", "shipped", "received", "confirmed"]);
      const rows = (rs ?? []) as unknown as Reservation[];
      setReservations(rows);

      const oppIds = [...new Set(rows.map(r => r.opportunity_id))];
      const memIds = [...new Set(rows.map(r => r.member_id))];
      const [oppRes, memRes] = await Promise.all([
        oppIds.length
          ? supabase.from("spark_trade_opportunities")
              .select("id, product_name, product_image_url, moq_required, suggested_selling_price_zar, category")
              .in("id", oppIds)
          : Promise.resolve({ data: [] as any }),
        memIds.length
          ? supabase.from("members")
              .select("id, full_name, email")
              .in("id", memIds)
          : Promise.resolve({ data: [] as any }),
      ]);
      const oMap: Record<number, Opp> = {};
      (oppRes.data ?? []).forEach((o: any) => { oMap[o.id] = o; });
      setOpps(oMap);
      const mMap: Record<string, Member> = {};
      (memRes.data ?? []).forEach((m: any) => { mMap[m.id] = m; });
      setMembers(mMap);
      setLoading(false);
    })();
  }, []);

  const summary = useMemo(() => {
    const totalRevenue = reservations.reduce((s, r) => s + Number(r.total_capital_allocated || 0), 0);
    const totalUnits = reservations.reduce((s, r) => s + (r.units_reserved || 0), 0);
    const uniqueMembers = new Set(reservations.map(r => r.member_id)).size;
    const uniqueProducts = new Set(reservations.map(r => r.opportunity_id)).size;
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const monthMs = 30 * 86400000;
    const inRange = (iso: string | null, ms: number) => iso && (now - new Date(iso).getTime()) <= ms;
    const revThisWeek = reservations.filter(r => inRange(r.paid_at || r.created_at, weekMs))
      .reduce((s, r) => s + Number(r.total_capital_allocated || 0), 0);
    const revThisMonth = reservations.filter(r => inRange(r.paid_at || r.created_at, monthMs))
      .reduce((s, r) => s + Number(r.total_capital_allocated || 0), 0);
    return { totalRevenue, totalUnits, uniqueMembers, uniqueProducts, revThisWeek, revThisMonth };
  }, [reservations]);

  const byProduct = useMemo(() => {
    const map = new Map<number, { opp: Opp | undefined; units: number; members: Set<string>; revenue: number }>();
    reservations.forEach(r => {
      const cur = map.get(r.opportunity_id) ?? { opp: opps[r.opportunity_id], units: 0, members: new Set<string>(), revenue: 0 };
      cur.units += r.units_reserved || 0;
      cur.members.add(r.member_id);
      cur.revenue += Number(r.total_capital_allocated || 0);
      map.set(r.opportunity_id, cur);
    });
    const list = [...map.entries()].map(([id, v]) => {
      const moq = v.opp?.moq_required || 0;
      const fill = moq > 0 ? (v.units / moq) * 100 : 0;
      return { id, ...v, memberCount: v.members.size, moq, fill, ready: moq > 0 && v.units >= moq };
    });
    list.sort((a, b) => {
      if (sortKey === "units") return b.units - a.units;
      if (sortKey === "fill") return b.fill - a.fill;
      return b.revenue - a.revenue;
    });
    return list;
  }, [reservations, opps, sortKey]);

  const byMember = useMemo(() => {
    const map = new Map<string, { member: Member | undefined; items: { opp: Opp | undefined; units: number; revenue: number }[]; units: number; revenue: number }>();
    reservations.forEach(r => {
      const cur = map.get(r.member_id) ?? { member: members[r.member_id], items: [], units: 0, revenue: 0 };
      const existing = cur.items.find(i => i.opp?.id === r.opportunity_id);
      if (existing) {
        existing.units += r.units_reserved || 0;
        existing.revenue += Number(r.total_capital_allocated || 0);
      } else {
        cur.items.push({ opp: opps[r.opportunity_id], units: r.units_reserved || 0, revenue: Number(r.total_capital_allocated || 0) });
      }
      cur.units += r.units_reserved || 0;
      cur.revenue += Number(r.total_capital_allocated || 0);
      map.set(r.member_id, cur);
    });
    const q = search.trim().toLowerCase();
    const list = [...map.entries()].map(([id, v]) => ({ id, ...v }));
    const filtered = q
      ? list.filter(m =>
          (m.member?.full_name ?? "").toLowerCase().includes(q) ||
          (m.member?.email ?? "").toLowerCase().includes(q))
      : list;
    filtered.sort((a, b) => b.revenue - a.revenue);
    return filtered;
  }, [reservations, opps, members, search]);

  if (loading) {
    return <div className="grid place-items-center p-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Spark Trade Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Paid member reservations — sourcing view and per-member view.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={DollarSign} label="Total Revenue" value={fmt(summary.totalRevenue)} />
        <StatCard icon={Boxes} label="Total Units" value={summary.totalUnits.toLocaleString()} />
        <StatCard icon={Users} label="Members Ordered" value={summary.uniqueMembers.toString()} />
        <StatCard icon={Package} label="Products Ordered" value={summary.uniqueProducts.toString()} />
        <StatCard icon={DollarSign} label="Revenue (7d)" value={fmt(summary.revThisWeek)} />
        <StatCard icon={DollarSign} label="Revenue (30d)" value={fmt(summary.revThisMonth)} />
      </div>

      <Tabs defaultValue="product">
        <TabsList>
          <TabsTrigger value="product">By Product</TabsTrigger>
          <TabsTrigger value="member">By Member</TabsTrigger>
        </TabsList>

        <TabsContent value="product">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Sourcing / Fulfillment</CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <ArrowUpDown className="h-3 w-3" /> Sort:
                {(["units","fill","revenue"] as const).map(k => (
                  <button key={k} onClick={() => setSortKey(k)}
                    className={`px-2 py-1 rounded-md ${sortKey===k?"bg-primary text-primary-foreground":"bg-secondary"}`}>
                    {k}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                    <th className="text-left p-3">Product</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Members</th>
                    <th className="text-right p-3">MOQ</th>
                    <th className="text-left p-3">Fill %</th>
                    <th className="text-right p-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map(p => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {p.opp?.product_image_url ? (
                            <img src={p.opp.product_image_url} alt="" className="h-10 w-10 rounded object-cover bg-secondary" />
                          ) : <div className="h-10 w-10 rounded bg-secondary" />}
                          <div>
                            <div className="font-medium">{p.opp?.product_name ?? `Product #${p.id}`}</div>
                            <div className="text-xs text-muted-foreground">{p.opp?.category ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">{p.units}</td>
                      <td className="p-3 text-right">{p.memberCount}</td>
                      <td className="p-3 text-right">{p.moq || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full ${p.ready ? "bg-emerald-500" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, p.fill)}%` }} />
                          </div>
                          <span className="text-xs w-12 text-right">{Math.round(p.fill)}%</span>
                          {p.ready && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                  {byProduct.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No paid orders yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4">
              <CardTitle className="text-lg">Purchases by Member</CardTitle>
              <Input placeholder="Search by name or email…" value={search}
                onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                    <th className="text-left p-3">Member</th>
                    <th className="text-left p-3">Products Purchased</th>
                    <th className="text-right p-3">Units</th>
                    <th className="text-right p-3">Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {byMember.map(m => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0 align-top">
                      <td className="p-3">
                        <div className="font-medium">{m.member?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.member?.email ?? ""}</div>
                      </td>
                      <td className="p-3">
                        <ul className="space-y-1">
                          {m.items.map((it, i) => (
                            <li key={i} className="text-xs">
                              <span className="font-medium">{it.opp?.product_name ?? `Product #${it.opp?.id ?? ""}`}</span>
                              <span className="text-muted-foreground"> × {it.units}</span>
                              <span className="ml-2 text-emerald-400">{fmt(it.revenue)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="p-3 text-right">{m.units}</td>
                      <td className="p-3 text-right font-medium">{fmt(m.revenue)}</td>
                    </tr>
                  ))}
                  {byMember.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No members match.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-xl">{value}</div>
    </div>
  );
}
