import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SA_BANKS = [
  "ABSA", "Capitec", "Discovery Bank", "FNB", "Investec",
  "Nedbank", "Standard Bank", "TymeBank", "African Bank", "Bidvest Bank",
];

interface Account {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_holder: string;
  is_default: boolean;
  for_circle: boolean;
  for_spark_trade: boolean;
  for_drive: boolean;
  for_property: boolean;
  for_buyers_club: boolean;
  is_active: boolean;
}

const empty: Partial<Account> = {
  account_name: "",
  bank_name: "FNB",
  account_number: "",
  branch_code: "",
  account_holder: "",
  is_default: false,
  for_circle: false,
  for_spark_trade: false,
  for_drive: false,
  for_property: false,
  for_buyers_club: false,
  is_active: true,
};

export default function AdminBankAccounts() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<Account>>(empty);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bank_accounts").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Account[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (a: Account) => { setForm(a); setOpen(true); };

  const save = async () => {
    if (!form.account_name || !form.bank_name || !form.account_number || !form.branch_code || !form.account_holder) {
      return toast.error("Fill all fields");
    }
    setBusy(true);
    const payload = { ...form };
    let err;
    if ((form as any).id) {
      ({ error: err } = await (supabase as any).from("bank_accounts").update(payload).eq("id", (form as any).id));
    } else {
      ({ error: err } = await (supabase as any).from("bank_accounts").insert(payload));
    }
    setBusy(false);
    if (err) return toast.error(err.message);
    toast.success("Saved");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this account?")) return;
    const { error } = await (supabase as any).from("bank_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const projects = (a: Account) => {
    const arr: string[] = [];
    if (a.is_default) arr.push("Default");
    if (a.for_circle) arr.push("Circle");
    if (a.for_spark_trade) arr.push("Spark Trade");
    if (a.for_drive) arr.push("Drive");
    if (a.for_property) arr.push("Property");
    if (a.for_buyers_club) arr.push("Buyers Club");
    return arr.length ? arr.join(", ") : "—";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Bank accounts</h1>
          <p className="text-sm text-muted-foreground">Configure where each project's payments are sent.</p>
        </div>
        <Button onClick={openNew} className="rounded-2xl bg-gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add account
        </Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left">
              <th className="p-3">Account</th>
              <th className="p-3">Bank</th>
              <th className="p-3">Number</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Used for</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No accounts yet.</td></tr>}
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium">{a.account_name}</div>
                  <div className="text-xs text-muted-foreground">{a.account_holder}</div>
                </td>
                <td className="p-3">{a.bank_name}</td>
                <td className="p-3 font-mono">{a.account_number}</td>
                <td className="p-3 font-mono">{a.branch_code}</td>
                <td className="p-3 text-xs">{projects(a)}</td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(form as any).id ? "Edit account" : "Add bank account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Account name (internal)">
              <Input value={form.account_name ?? ""} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Property Fund Account" />
            </Field>
            <Field label="Bank">
              <select
                value={form.bank_name ?? ""}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {SA_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account number">
                <Input value={form.account_number ?? ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
              </Field>
              <Field label="Branch code">
                <Input value={form.branch_code ?? ""} onChange={(e) => setForm({ ...form, branch_code: e.target.value })} />
              </Field>
            </div>
            <Field label="Account holder">
              <Input value={form.account_holder ?? ""} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} placeholder="UMOJA Property Fund" />
            </Field>

            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Use for</p>
              {[
                ["for_circle", "Circle (all tiers)"],
                ["for_spark_trade", "Spark Trade"],
                ["for_drive", "UMOJA Drive"],
                ["for_property", "Property Fund"],
                ["for_buyers_club", "Buyers Club"],
                ["is_default", "Default for all projects (fallback)"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean((form as any)[k])}
                    onCheckedChange={(v) => setForm({ ...form, [k]: !!v })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
