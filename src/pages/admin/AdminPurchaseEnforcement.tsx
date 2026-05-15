import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

type Req = {
  id: string;
  member_id: string;
  tier: string | null;
  min_monthly_spend: number;
  min_monthly_units: number;
  current_month_spend: number;
  current_month_units: number;
  compliance_status: string;
  next_review_date: string | null;
  last_purchase_at: string | null;
  member?: { full_name: string; email: string };
};

type Setting = {
  id: string;
  tier: string;
  min_monthly_spend: number;
  min_monthly_units: number;
  grace_period_days: number;
  auto_enforce: boolean;
};

export default function AdminPurchaseEnforcement() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Purchase Enforcement Dashboard</h1>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Compliance Overview</TabsTrigger>
          <TabsTrigger value="settings">Requirements</TabsTrigger>
          <TabsTrigger value="history">Purchase History</TabsTrigger>
          <TabsTrigger value="groupbuys">Group Buys</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="settings"><Settings /></TabsContent>
        <TabsContent value="history"><History /></TabsContent>
        <TabsContent value="groupbuys"><GroupBuys /></TabsContent>
      </Tabs>
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    compliant: "bg-emerald-500/15 text-emerald-500",
    warning: "bg-amber-500/15 text-amber-500",
    below: "bg-red-500/15 text-red-500",
    suspended: "bg-zinc-500/15 text-zinc-500",
  };
  return <Badge className={map[s] ?? "bg-muted"}>{s}</Badge>;
}

function Overview() {
  const [rows, setRows] = useState<Req[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase
      .from("member_purchase_requirements")
      .select("*, member:members(full_name, email)")
      .order("current_month_spend", { ascending: true });
    setRows((data ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (filterStatus !== "all" && r.compliance_status !== filterStatus) return false;
      if (search && !(r.member?.full_name ?? "").toLowerCase().includes(search.toLowerCase()) && !(r.member?.email ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [rows, filterStatus, search]
  );

  const stats = {
    total: rows.length,
    compliant: rows.filter((r) => r.compliance_status === "compliant").length,
    warning: rows.filter((r) => r.compliance_status === "warning").length,
    suspended: rows.filter((r) => r.compliance_status === "suspended").length,
    monthSpend: rows.reduce((s, r) => s + Number(r.current_month_spend ?? 0), 0),
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { compliance_status: status };
    if (status === "suspended") patch.access_revoked_at = new Date().toISOString();
    if (status === "compliant") patch.access_revoked_at = null;
    await supabase.from("member_purchase_requirements").update(patch).eq("id", id);
    toast({ title: `Status set to ${status}` });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Tracked" v={stats.total} />
        <Kpi label="Compliant" v={stats.compliant} />
        <Kpi label="Warning" v={stats.warning} />
        <Kpi label="Suspended" v={stats.suspended} />
        <Kpi label="Spend (mo)" v={`R${stats.monthSpend.toLocaleString()}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 rounded-md border border-border bg-background text-sm">
          <option value="all">All statuses</option>
          <option value="compliant">Compliant</option>
          <option value="warning">Warning</option>
          <option value="below">Below</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Spent</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last purchase</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const pct = r.min_monthly_spend ? Math.min(150, (Number(r.current_month_spend) / Number(r.min_monthly_spend)) * 100) : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => {
                      const n = new Set(selected); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelected(n);
                    }} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.member?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.member?.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.tier ?? "default"}</Badge></TableCell>
                  <TableCell>R{Number(r.min_monthly_spend).toLocaleString()}</TableCell>
                  <TableCell>R{Number(r.current_month_spend).toLocaleString()}</TableCell>
                  <TableCell className="min-w-[120px]">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}%</div>
                  </TableCell>
                  <TableCell>{statusBadge(r.compliance_status)}</TableCell>
                  <TableCell className="text-xs">{r.last_purchase_at ? new Date(r.last_purchase_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <select className="text-xs px-2 py-1 rounded border border-border bg-background" defaultValue="" onChange={(e) => { if (e.target.value) { setStatus(r.id, e.target.value); e.target.value = ""; } }}>
                      <option value="">Action</option>
                      <option value="suspended">Suspend</option>
                      <option value="compliant">Restore</option>
                      <option value="warning">Warn</option>
                    </select>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Settings() {
  const [rows, setRows] = useState<Setting[]>([]);

  const load = async () => {
    const { data } = await supabase.from("purchase_requirement_settings").select("*").order("min_monthly_spend");
    setRows((data ?? []) as Setting[]);
  };
  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<Setting>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const saveAll = async () => {
    for (const r of rows) {
      await supabase.from("purchase_requirement_settings").update({
        min_monthly_spend: r.min_monthly_spend,
        min_monthly_units: r.min_monthly_units,
        grace_period_days: r.grace_period_days,
        auto_enforce: r.auto_enforce,
      }).eq("id", r.id);
    }
    toast({ title: "Settings saved" });
    load();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {rows.map((r, i) => (
        <Card key={r.id} className="p-4 space-y-3">
          <h3 className="font-bold capitalize">{r.tier} Tier</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Min spend (R)</Label><Input type="number" value={r.min_monthly_spend} onChange={(e) => update(i, { min_monthly_spend: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Min units</Label><Input type="number" value={r.min_monthly_units} onChange={(e) => update(i, { min_monthly_units: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Grace days</Label><Input type="number" value={r.grace_period_days} onChange={(e) => update(i, { grace_period_days: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2"><Switch checked={r.auto_enforce} onCheckedChange={(v) => update(i, { auto_enforce: v })} /><span className="text-sm">Auto-enforce</span></div>
          </div>
        </Card>
      ))}
      <Button onClick={saveAll}>Save All Settings</Button>
      <Card className="p-4 text-sm space-y-1 text-muted-foreground">
        <p>• Auto-enforce suspends access automatically on the last day of the month if minimum not met.</p>
        <p>• Grace period sends warning email X days before month end.</p>
        <p>• Members receive email when suspended and when restored.</p>
      </Card>
    </div>
  );
}

function History() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("member_purchases")
        .select("*, member:members(full_name, email)")
        .order("purchased_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Product</TableHead><TableHead>Source</TableHead><TableHead>Qty</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{new Date(r.purchased_at).toLocaleDateString()}</TableCell>
              <TableCell>{r.member?.full_name}</TableCell>
              <TableCell className="max-w-[200px] truncate">{r.product_name}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{r.product_source}</Badge></TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>R{Number(r.total_price_zar).toLocaleString()}</TableCell>
              <TableCell><Badge>{r.order_status}</Badge></TableCell>
              <TableCell><Badge variant="outline">{r.payment_status}</Badge></TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchases yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function GroupBuys() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ product_name: "", target_quantity: 100, unit_price_zar: 0, group_price_zar: 0, supplier_name: "", supplier_url: "", moq: 100, status: "active" });

  const load = async () => {
    const { data } = await supabase.from("group_buys").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.product_name) return toast({ title: "Name required", variant: "destructive" });
    await supabase.from("group_buys").insert(form);
    setOpen(false);
    setForm({ product_name: "", target_quantity: 100, unit_price_zar: 0, group_price_zar: 0, supplier_name: "", supplier_url: "", moq: 100, status: "active" });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "ordered") patch.ordered_at = new Date().toISOString();
    await supabase.from("group_buys").update(patch).eq("id", id);
    load();
  };

  const active = rows.filter((r) => r.status === "active");
  const completed = rows.filter((r) => r.status !== "active");

  return (
    <div className="space-y-4">
      <div className="flex justify-between"><h3 className="font-bold">Active Group Buys</h3><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {active.map((g) => {
          const pct = g.target_quantity ? Math.min(100, (g.current_quantity / g.target_quantity) * 100) : 0;
          return (
            <Card key={g.id} className="p-4 space-y-2">
              <div className="font-semibold">{g.product_name}</div>
              <div className="text-sm">{g.current_quantity} / {g.target_quantity} units</div>
              <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
              <div className="text-sm text-muted-foreground">R{g.unit_price_zar} → R{g.group_price_zar} at target</div>
              {g.closes_at && <div className="text-xs text-muted-foreground">Closes {new Date(g.closes_at).toLocaleDateString()}</div>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStatus(g.id, "ordered")}>Mark Ordered</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(g.id, "cancelled")}>Cancel</Button>
              </div>
            </Card>
          );
        })}
        {active.length === 0 && <p className="text-sm text-muted-foreground">No active group buys.</p>}
      </div>

      <details className="pt-4">
        <summary className="cursor-pointer font-bold">Completed ({completed.length})</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {completed.map((g) => (
            <Card key={g.id} className="p-3 text-sm">
              <div className="font-medium">{g.product_name}</div>
              <div className="text-xs text-muted-foreground">{g.current_quantity}/{g.target_quantity} · {g.status}</div>
            </Card>
          ))}
        </div>
      </details>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group Buy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Product Name *</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Target Qty</Label><Input type="number" value={form.target_quantity} onChange={(e) => setForm({ ...form, target_quantity: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">MOQ</Label><Input type="number" value={form.moq} onChange={(e) => setForm({ ...form, moq: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Unit Price (R)</Label><Input type="number" value={form.unit_price_zar} onChange={(e) => setForm({ ...form, unit_price_zar: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Group Price (R)</Label><Input type="number" value={form.group_price_zar} onChange={(e) => setForm({ ...form, group_price_zar: Number(e.target.value) })} /></div>
            </div>
            <div><Label className="text-xs">Supplier</Label><Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} /></div>
            <div><Label className="text-xs">Supplier URL</Label><Input value={form.supplier_url} onChange={(e) => setForm({ ...form, supplier_url: e.target.value })} /></div>
            <div><Label className="text-xs">Closes At</Label><Input type="datetime-local" onChange={(e) => setForm({ ...form, closes_at: new Date(e.target.value).toISOString() })} /></div>
            <Button onClick={create}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: any }) {
  return <Card className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{v}</div></Card>;
}
