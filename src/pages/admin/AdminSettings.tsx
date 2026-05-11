import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Banknote, Eye, EyeOff, AlertTriangle, Play, Square, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSessionState, refreshOverrides } from "@/components/umoja/CircleSessionTimer";

interface Settings {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_code: string;
  payment_instructions: string;
}

const empty: Settings = {
  bank_name: "",
  account_name: "",
  account_number: "",
  branch_code: "",
  payment_instructions: "",
};

export default function AdminSettings() {
  const [s, setS] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unmask, setUnmask] = useState(false);

  const maskAccount = (v: string) => {
    if (!v) return "";
    if (unmask) return v;
    const digits = v.replace(/\s+/g, "");
    if (digits.length <= 4) return "•".repeat(digits.length);
    return "•".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  };

  const previewReady = !!(s.bank_name && s.account_number);
  const sampleRef = "BID-PREVIEW-0001";
  const sampleAmount = "R2,500";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setS({
          id: data.id,
          bank_name: data.bank_name ?? "",
          account_name: data.account_name ?? "",
          account_number: data.account_number ?? "",
          branch_code: data.branch_code ?? "",
          payment_instructions: data.payment_instructions ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      bank_name: s.bank_name || null,
      account_name: s.account_name || null,
      account_number: s.account_number || null,
      branch_code: s.branch_code || null,
      payment_instructions: s.payment_instructions || null,
    };
    let error;
    if (s.id) {
      ({ error } = await supabase.from("platform_settings").update(payload).eq("id", s.id));
    } else {
      const res = await supabase.from("platform_settings").insert(payload).select("id").single();
      error = res.error;
      if (res.data?.id) setS({ ...s, id: res.data.id });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Bank details saved");
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const field = (k: keyof Settings, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      <Input
        value={(s[k] as string) ?? ""}
        onChange={(e) => setS({ ...s, [k]: e.target.value })}
        placeholder={placeholder}
        className="h-11 rounded-2xl bg-secondary/40 border-border"
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">Platform settings</h1>
          <p className="text-sm text-muted-foreground mt-1">EFT bank details shown to members on the bid screen.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-3xl border border-border bg-gradient-card p-6">
        {field("bank_name", "Bank name", "e.g. Standard Bank")}
        {field("account_name", "Account name", "Umoja Rise (Pty) Ltd")}
        {field("account_number", "Account number", "10-digit account number")}
        {field("branch_code", "Branch code", "e.g. 051001")}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment instructions (optional)</Label>
          <Textarea
            value={s.payment_instructions}
            onChange={(e) => setS({ ...s, payment_instructions: e.target.value })}
            placeholder="Use the reference exactly as shown. Allow up to 24h for clearance."
            className="rounded-2xl bg-secondary/40 border-border min-h-[100px]"
          />
        </div>
        <div className="pt-2 flex justify-end">
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
          </Button>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">Member EFT preview</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Exactly what members see in the bid modal. Account number is masked by default.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUnmask((v) => !v)}
            className="rounded-2xl"
          >
            {unmask ? <><EyeOff className="h-4 w-4 mr-1" /> Mask</> : <><Eye className="h-4 w-4 mr-1" /> Reveal</>}
          </Button>
        </div>

        {!previewReady ? (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Fill in at least the bank name and account number above to preview the modal.
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-accent pb-2 border-b border-border/40">
              Pay via EFT
            </p>
            {[
              ["Bank", s.bank_name],
              ["Account Name", s.account_name],
              ["Account Number", maskAccount(s.account_number)],
              ["Branch Code", s.branch_code],
              ["Reference", sampleRef],
              ["Amount", sampleAmount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 py-1 border-b border-border/40 last:border-b-0"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className="font-mono text-sm truncate">{value || "—"}</span>
              </div>
            ))}
            {s.payment_instructions && (
              <p className="pt-2 text-xs text-muted-foreground whitespace-pre-line">
                {s.payment_instructions}
              </p>
            )}
            <p className="pt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Sample reference & amount — actual values are generated per bid.
            </p>
          </div>
        )}
      </div>

      <SessionTestingCard settingsId={s.id} />
    </div>
  );
}

// ---------- Session Testing (admin manual override) ----------
import { getSessionState, refreshOverrides } from "@/components/umoja/CircleSessionTimer";
import { AlertTriangle, Play, Square, Clock } from "lucide-react";

type TierKey = "seed" | "growth" | "harvest";
const TIERS: { key: TierKey; label: string; col: "seed_override_open" | "growth_override_open" | "harvest_override_open" }[] = [
  { key: "seed", label: "Seed Circle", col: "seed_override_open" },
  { key: "growth", label: "Growth Circle", col: "growth_override_open" },
  { key: "harvest", label: "Harvest Circle", col: "harvest_override_open" },
];

interface OverrideRow {
  id?: string;
  seed_override_open: boolean;
  growth_override_open: boolean;
  harvest_override_open: boolean;
  override_expires_at: string | null;
}

function SessionTestingCard({ settingsId }: { settingsId?: string }) {
  const [row, setRow] = useState<OverrideRow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<TierKey | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("id, seed_override_open, growth_override_open, harvest_override_open, override_expires_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow(data as OverrideRow | null);
    await refreshOverrides(true);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [settingsId]);

  const expiresMs = row?.override_expires_at ? new Date(row.override_expires_at).getTime() : null;
  const overrideActive = !!(expiresMs && expiresMs > now);

  const isOverriddenOpen = (t: TierKey) => overrideActive && !!row?.[`${t}_override_open` as const];

  const forceOpen = async (t: TierKey) => {
    if (!row?.id) { toast.error("Save bank settings first to create the settings row."); return; }
    setBusy(t);
    const patch: Partial<OverrideRow> = {
      seed_override_open: t === "seed",
      growth_override_open: t === "growth",
      harvest_override_open: t === "harvest",
      override_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    const { error } = await supabase.from("platform_settings").update(patch).eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${t} session force-opened for 1 hour`);
    load();
  };

  const forceClose = async () => {
    if (!row?.id) return;
    setBusy("seed");
    const { error } = await supabase
      .from("platform_settings")
      .update({
        seed_override_open: false,
        growth_override_open: false,
        harvest_override_open: false,
        override_expires_at: null,
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Manual override cleared");
    load();
  };

  return (
    <div className="mt-8 rounded-3xl border border-destructive/30 bg-gradient-card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-destructive/15 text-destructive shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl">Session testing</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            ⚠️ Manual overrides are for testing only. Members will see conflicting countdown timers while an override is active. Auto-expires after 1 hour.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {TIERS.map(({ key, label }) => {
          const s = getSessionState(key, now);
          const forced = isOverriddenOpen(key);
          const open = s.status === "open";
          return (
            <div key={key} className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Status:{" "}
                    {open ? (
                      <span className="text-primary font-medium">
                        🟢 OPEN {forced ? "(forced)" : ""} · closes {new Date(s.target).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">
                        🔴 CLOSED · next {new Date(s.target).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === key || forced}
                    onClick={() => forceOpen(key)}
                    className="rounded-2xl"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Force open
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/30 p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {overrideActive && expiresMs ? (
            <>Override active — expires in {Math.max(0, Math.ceil((expiresMs - now) / 60000))} min</>
          ) : (
            <>No override active</>
          )}
        </p>
        <Button
          size="sm"
          variant="destructive"
          disabled={!overrideActive || busy !== null}
          onClick={forceClose}
          className="rounded-2xl"
        >
          <Square className="h-3.5 w-3.5 mr-1" /> Force close / clear
        </Button>
      </div>
    </div>
  );
}
