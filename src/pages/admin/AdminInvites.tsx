import { useEffect, useState } from "react";
import { Loader2, Plus, Copy, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface InviteCode {
  id: string;
  code: string;
  uses_remaining: number;
  expires_at: string | null;
  created_at: string;
}

const generateCode = () =>
  Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export default function AdminInvites() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: generateCode(), uses: 1, days: 30 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_invite_codes")
      .select("id, code, uses_remaining, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setCodes((data ?? []) as InviteCode[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error("Code required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const expires = form.days > 0 ? new Date(Date.now() + form.days * 86400e3).toISOString() : null;
    const { error } = await supabase.from("admin_invite_codes").insert({
      code: form.code.trim().toUpperCase(),
      uses_remaining: Math.max(1, form.uses),
      expires_at: expires,
      created_by: user?.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite code created");
    setForm({ code: generateCode(), uses: 1, days: 30 });
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied");
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Access control</p>
        <h1 className="font-display text-3xl mt-1">Invite codes</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate codes for non-South-African signups during invite-only phase.</p>
      </div>

      <form onSubmit={createCode} className="rounded-2xl border border-border bg-gradient-card p-5 grid gap-4 md:grid-cols-4">
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Code</Label>
          <div className="flex gap-2">
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="h-11 rounded-xl bg-secondary/60 font-mono" />
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}>New</Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Uses</Label>
          <Input type="number" min={1} value={form.uses} onChange={(e) => setForm((f) => ({ ...f, uses: Number(e.target.value) }))} className="h-11 rounded-xl bg-secondary/60" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expires (days, 0 = never)</Label>
          <Input type="number" min={0} value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))} className="h-11 rounded-xl bg-secondary/60" />
        </div>
        <div className="md:col-span-4">
          <Button type="submit" disabled={busy} className="h-11 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Create code</>}
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-gradient-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Ticket className="h-4 w-4 text-accent" />
          <h2 className="font-display text-lg">Active codes</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : codes.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No invite codes yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {codes.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              const exhausted = c.uses_remaining <= 0;
              const status = exhausted ? "exhausted" : expired ? "expired" : "active";
              return (
                <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base">{c.code}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${status === "active" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>{status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.uses_remaining} uses left · {c.expires_at ? `expires ${new Date(c.expires_at).toLocaleDateString()}` : "no expiry"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => copy(c.code)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
