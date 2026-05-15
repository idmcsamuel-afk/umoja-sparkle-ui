import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, KeyRound, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const ALL_CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Sports & Outdoors",
  "Beauty & Personal Care",
  "Toys & Games",
  "Clothing & Accessories",
];

interface Settings {
  id: string;
  tracked_categories: string[];
  bsr_threshold: number;
  exchange_rate_zar_per_usd: number;
  last_sync_at: string | null;
  api_connected: boolean;
}

export const AmazonIntegrationPanel = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { count }] = await Promise.all([
      supabase.from("amazon_integration_settings").select("*").limit(1).maybeSingle(),
      supabase.from("amazon_products").select("*", { count: "exact", head: true }),
    ]);
    setSettings(s as Settings | null);
    setProductCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    const { error } = await supabase.functions.invoke("fetch-amazon-products", {
      body: {},
      // edge function reads ?force=true via URL; we trigger a fresh sync here
    });
    // Trigger force=true via separate fetch to bypass cache
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-amazon-products?force=true`;
      await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
    } catch {
      // ignore — initial invoke already syncs when stale
    }
    setSyncing(false);
    if (error) return toast.error(error.message);
    toast.success("Amazon products synced");
    load();
  };

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("amazon_integration_settings")
      .update(patch as never)
      .eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  };

  const toggleCategory = (cat: string) => {
    if (!settings) return;
    const next = settings.tracked_categories.includes(cat)
      ? settings.tracked_categories.filter((c) => c !== cat)
      : [...settings.tracked_categories, cat];
    updateSettings({ tracked_categories: next });
  };

  const ago = (iso: string | null) => {
    if (!iso) return "never";
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading || !settings) {
    return (
      <div className="rounded-3xl border border-border bg-gradient-card p-8 grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-gradient-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-2xl">Amazon Integration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live bestsellers feeding the Spark Trade Amazon tab.
            </p>
          </div>
        </div>
        <Button onClick={sync} disabled={syncing} className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Now
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="API status"
          value={
            settings.api_connected ? (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> Mock data
              </span>
            )
          }
        />
        <Stat label="Last sync" value={ago(settings.last_sync_at)} />
        <Stat label="Products cached" value={productCount.toLocaleString()} />
        <Stat label="BSR threshold" value={`#${settings.bsr_threshold.toLocaleString()}`} />
      </div>

      {!settings.api_connected && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <KeyRound className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-200 font-medium">Connect Amazon API</p>
            <p className="text-amber-200/80 text-xs mt-1">
              Add <code className="px-1 py-0.5 rounded bg-background/40">AMAZON_API_KEY</code> in Supabase secrets to
              switch from mock data to live Product Advertising API results.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Tracked categories
          </Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((c) => {
              const on = settings.tracked_categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider border transition-colors ${
                    on
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bsr" className="text-xs uppercase tracking-wider text-muted-foreground">
              BSR threshold
            </Label>
            <Input
              id="bsr"
              type="number"
              min={1}
              defaultValue={settings.bsr_threshold}
              onBlur={(e) => {
                const v = Math.max(1, Number(e.target.value));
                if (v !== settings.bsr_threshold) updateSettings({ bsr_threshold: v });
              }}
              className="mt-2 h-10"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Show products ranked below this number.</p>
          </div>
          <div>
            <Label htmlFor="rate" className="text-xs uppercase tracking-wider text-muted-foreground">
              USD → ZAR rate
            </Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              min={0.01}
              defaultValue={settings.exchange_rate_zar_per_usd}
              onBlur={(e) => {
                const v = Math.max(0.01, Number(e.target.value));
                if (v !== settings.exchange_rate_zar_per_usd)
                  updateSettings({ exchange_rate_zar_per_usd: v });
              }}
              className="mt-2 h-10"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Used at next sync.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-2xl bg-secondary/40 p-3">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-display text-sm mt-1">{value}</p>
  </div>
);
