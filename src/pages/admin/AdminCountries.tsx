import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Globe } from "lucide-react";

interface CountryRow {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  enabled: boolean;
  seed_min: number; seed_max: number;
  growth_min: number; growth_max: number;
  harvest_min: number; harvest_max: number;
  payment_gateways: string[];
  requires_kyc: boolean;
  max_monthly_contribution: number | null;
}

interface RateRow {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
}

const FLAGS: Record<string, string> = { ZA: "🇿🇦", KE: "🇰🇪", NG: "🇳🇬", GH: "🇬🇭" };
const GATEWAYS = ["paystack", "flutterwave", "eft", "usdt"];

export default function AdminCountries() {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<CountryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from("country_configs" as any).select("*").order("country_name"),
      supabase.from("currency_rates" as any).select("*").order("effective_date", { ascending: false }),
    ]);
    setRows((c as any) ?? []);
    // dedupe rates per (from,to) keeping newest
    const seen = new Set<string>();
    const latest: RateRow[] = [];
    for (const row of ((r as any) ?? []) as RateRow[]) {
      const key = `${row.from_currency}->${row.to_currency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(row);
    }
    setRates(latest);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (row: CountryRow, enabled: boolean) => {
    const { error } = await supabase
      .from("country_configs" as any)
      .update({ enabled })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.country_name} ${enabled ? "enabled" : "disabled"}`);
    load();
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    const { error } = await supabase
      .from("country_configs" as any)
      .update({
        country_name: edit.country_name,
        currency_code: edit.currency_code.toUpperCase(),
        currency_symbol: edit.currency_symbol,
        enabled: edit.enabled,
        seed_min: edit.seed_min, seed_max: edit.seed_max,
        growth_min: edit.growth_min, growth_max: edit.growth_max,
        harvest_min: edit.harvest_min, harvest_max: edit.harvest_max,
        payment_gateways: edit.payment_gateways,
        requires_kyc: edit.requires_kyc,
        max_monthly_contribution: edit.max_monthly_contribution,
      })
      .eq("id", edit.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEdit(null);
    load();
  };

  const updateRate = async (row: RateRow, newRate: number) => {
    if (!Number.isFinite(newRate) || newRate <= 0) return;
    const { error } = await supabase
      .from("currency_rates" as any)
      .insert({
        from_currency: row.from_currency,
        to_currency: row.to_currency,
        rate: newRate,
        source: "manual",
      });
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.from_currency}→${row.to_currency} updated`);
    load();
  };

  return (
    <div className="space-y-8 p-1">
      <div>
        <h1 className="text-2xl font-display flex items-center gap-2"><Globe className="h-6 w-6" /> Country Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure currencies, tier amounts, and enable countries for signup.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h2 className="text-sm font-medium uppercase tracking-wider">Countries</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-3">Country</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-left p-3">Enabled</th>
                  <th className="text-left p-3">Seed</th>
                  <th className="text-left p-3">Growth</th>
                  <th className="text-left p-3">Harvest</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-3">
                      <span className="mr-2">{FLAGS[r.country_code] ?? "🌍"}</span>
                      <span className="font-medium">{r.country_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.country_code}</span>
                    </td>
                    <td className="p-3">{r.currency_symbol} {r.currency_code}</td>
                    <td className="p-3">
                      <Switch checked={r.enabled} onCheckedChange={(v) => toggleEnabled(r, v)} />
                    </td>
                    <td className="p-3 text-xs">{r.currency_symbol}{r.seed_min.toLocaleString()}–{r.currency_symbol}{r.seed_max.toLocaleString()}</td>
                    <td className="p-3 text-xs">{r.currency_symbol}{r.growth_min.toLocaleString()}–{r.currency_symbol}{r.growth_max.toLocaleString()}</td>
                    <td className="p-3 text-xs">{r.currency_symbol}{r.harvest_min.toLocaleString()}–{r.currency_symbol}{r.harvest_max.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setEdit({ ...r, payment_gateways: r.payment_gateways ?? [] })}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <h2 className="text-sm font-medium uppercase tracking-wider">Exchange Rates</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">From</th>
                <th className="text-left p-3">To</th>
                <th className="text-left p-3">Rate</th>
                <th className="text-left p-3">Updated</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <RateEditRow key={r.id} row={r} onSave={updateRate} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit && (FLAGS[edit.country_code] ?? "")} Edit {edit?.country_name}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Country name</Label>
                  <Input value={edit.country_name} onChange={(e) => setEdit({ ...edit, country_name: e.target.value })} />
                </div>
                <div>
                  <Label>Currency code</Label>
                  <Input value={edit.currency_code} onChange={(e) => setEdit({ ...edit, currency_code: e.target.value })} maxLength={3} />
                </div>
                <div>
                  <Label>Symbol</Label>
                  <Input value={edit.currency_symbol} onChange={(e) => setEdit({ ...edit, currency_symbol: e.target.value })} maxLength={5} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={edit.enabled} onCheckedChange={(v) => setEdit({ ...edit, enabled: v })} />
                  <span className="text-sm">Enabled for signup</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Seed</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={edit.seed_min} onChange={(e) => setEdit({ ...edit, seed_min: Number(e.target.value) })} placeholder="min" />
                  <Input type="number" value={edit.seed_max} onChange={(e) => setEdit({ ...edit, seed_max: Number(e.target.value) })} placeholder="max" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Growth</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={edit.growth_min} onChange={(e) => setEdit({ ...edit, growth_min: Number(e.target.value) })} placeholder="min" />
                  <Input type="number" value={edit.growth_max} onChange={(e) => setEdit({ ...edit, growth_max: Number(e.target.value) })} placeholder="max" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Harvest</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={edit.harvest_min} onChange={(e) => setEdit({ ...edit, harvest_min: Number(e.target.value) })} placeholder="min" />
                  <Input type="number" value={edit.harvest_max} onChange={(e) => setEdit({ ...edit, harvest_max: Number(e.target.value) })} placeholder="max" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment gateways</Label>
                <div className="flex flex-wrap gap-3">
                  {GATEWAYS.map((g) => {
                    const checked = edit.payment_gateways.includes(g);
                    return (
                      <label key={g} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...edit.payment_gateways, g]
                              : edit.payment_gateways.filter((x) => x !== g);
                            setEdit({ ...edit, payment_gateways: next });
                          }}
                        />
                        {g}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={edit.requires_kyc} onCheckedChange={(v) => setEdit({ ...edit, requires_kyc: v })} />
                  <span className="text-sm">Requires KYC</span>
                </div>
                <div>
                  <Label>Max monthly contribution</Label>
                  <Input type="number" value={edit.max_monthly_contribution ?? ""} onChange={(e) => setEdit({ ...edit, max_monthly_contribution: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RateEditRow({ row, onSave }: { row: RateRow; onSave: (r: RateRow, v: number) => void }) {
  const [val, setVal] = useState(String(row.rate));
  const [editing, setEditing] = useState(false);
  return (
    <tr className="border-b border-border/50">
      <td className="p-3 font-mono">{row.from_currency}</td>
      <td className="p-3 font-mono">{row.to_currency}</td>
      <td className="p-3">
        {editing ? (
          <Input className="h-8 w-28" value={val} onChange={(e) => setVal(e.target.value)} />
        ) : (
          <span className="font-mono">{Number(row.rate).toFixed(4)}</span>
        )}
      </td>
      <td className="p-3 text-xs text-muted-foreground">
        {new Date(row.effective_date).toLocaleDateString()} · {row.source}
      </td>
      <td className="p-3 text-right">
        {editing ? (
          <div className="inline-flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setVal(String(row.rate)); }}>Cancel</Button>
            <Button size="sm" onClick={() => { onSave(row, Number(val)); setEditing(false); }}>Save</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
        )}
      </td>
    </tr>
  );
}
