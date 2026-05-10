import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Plus, Loader2, Tag, Star, ShieldCheck, ShoppingBag, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Listing {
  id: string;
  member_id: string;
  title: string;
  description: string | null;
  category: string;
  price_sparks: number | null;
  price_fiat: number | null;
  is_verified: boolean | null;
  is_featured: boolean | null;
  rating_avg: number | null;
  rating_count: number | null;
  is_active: boolean | null;
  created_at: string | null;
  seller_name?: string;
}

const CATEGORIES = ["All", "Goods", "Services", "Digital", "Crafts", "Food", "Other"];

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function Market() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sellOpen, setSellOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState<Listing | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Goods",
    price_fiat: "",
    price_sparks: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("market_listings")
      .select("*")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) console.error(error);
    const rows = (data ?? []) as Listing[];

    const ids = Array.from(new Set(rows.map((r) => r.member_id)));
    if (ids.length) {
      const { data: ms } = await supabase.from("members").select("id, full_name").in("id", ids);
      const map = new Map((ms ?? []).map((m) => [m.id, m.full_name as string]));
      for (const r of rows) r.seller_name = map.get(r.member_id) ?? "Member";
    }
    setListings(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return listings.filter((l) => {
      if (cat !== "All" && l.category !== cat) return false;
      if (!term) return true;
      return [l.title, l.description, l.seller_name, l.category].some((v) => v?.toLowerCase().includes(term));
    });
  }, [listings, q, cat]);

  const submitListing = async () => {
    if (!user) return toast.error("Sign in first");
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.price_fiat && !form.price_sparks) return toast.error("Set a price (Rands or Sparks)");
    setBusy(true);
    const { error } = await supabase.from("market_listings").insert({
      member_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price_fiat: form.price_fiat ? Number(form.price_fiat) : null,
      price_sparks: form.price_sparks ? Number(form.price_sparks) : null,
      is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Listing posted ✨");
    setSellOpen(false);
    setForm({ title: "", description: "", category: "Goods", price_fiat: "", price_sparks: "" });
    load();
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <button
            onClick={() => setSellOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            aria-label="Sell"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Ubuntu Market</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Buy & sell<br />
            <span className="text-gradient-gold italic font-[450]">in the village.</span>
          </h1>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search market…"
              className="pl-9 h-12 rounded-2xl bg-secondary/60 border-border"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
            {CATEGORIES.map((c) => {
              const active = c === cat;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 px-4 h-9 rounded-full border text-xs transition-smooth ${
                    active
                      ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                      : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          {loading ? (
            <div className="grid place-items-center rounded-3xl glass p-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl glass p-8 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No listings match. Be the first to sell.</p>
              <Button onClick={() => setSellOpen(true)} className="mt-4 rounded-2xl bg-gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-1" /> Post a listing
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((l, i) => (
                <li
                  key={l.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="relative overflow-hidden rounded-3xl glass p-5 animate-slide-up"
                >
                  {l.is_featured && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2 py-1 text-[10px] uppercase tracking-wider text-background">
                      <Sparkles className="h-3 w-3" /> Featured
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{l.category}</p>
                      <h3 className="mt-1 font-display text-lg leading-snug truncate">{l.title}</h3>
                      {l.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{l.description}</p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[9px] font-medium text-foreground">
                            {(l.seller_name ?? "M").slice(0, 1).toUpperCase()}
                          </span>
                          {l.seller_name}
                        </span>
                        {l.is_verified && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                        {(l.rating_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-accent">
                            <Star className="h-3 w-3" /> {Number(l.rating_avg ?? 0).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      {l.price_fiat != null && (
                        <p className="font-display text-xl text-gradient-gold">{fmtR(Number(l.price_fiat))}</p>
                      )}
                      {l.price_sparks != null && (
                        <p className="inline-flex items-center gap-1 text-xs text-accent-soft">
                          <Sparkles className="h-3 w-3" /> {Math.round(Number(l.price_sparks))} SP
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setContactOpen(l)}
                      className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
                    >
                      <Tag className="h-3.5 w-3.5 mr-1" /> Buy
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Post a listing</DialogTitle>
            <DialogDescription>Sell goods, services, or digital items to the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What are you selling?"
                className="mt-1 h-11 rounded-2xl bg-secondary/60"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details, condition, location…"
                className="mt-1 rounded-2xl bg-secondary/60 min-h-[88px]"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={`px-3 h-9 rounded-full border text-xs transition-smooth ${
                      form.category === c
                        ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                        : "bg-secondary/60 border-border text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Price (R)</Label>
                <Input
                  type="number"
                  value={form.price_fiat}
                  onChange={(e) => setForm({ ...form, price_fiat: e.target.value })}
                  placeholder="0"
                  className="mt-1 h-11 rounded-2xl bg-secondary/60"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sparks</Label>
                <Input
                  type="number"
                  value={form.price_sparks}
                  onChange={(e) => setForm({ ...form, price_sparks: e.target.value })}
                  placeholder="0"
                  className="mt-1 h-11 rounded-2xl bg-secondary/60"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellOpen(false)}>Cancel</Button>
            <Button onClick={submitListing} disabled={busy} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact / buy dialog */}
      <Dialog open={!!contactOpen} onOpenChange={(v) => !v && setContactOpen(null)}>
        <DialogContent className="rounded-3xl border border-border bg-gradient-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{contactOpen?.title}</DialogTitle>
            <DialogDescription>
              Reach out to <span className="text-foreground font-medium">{contactOpen?.seller_name}</span> to arrange purchase. UMOJA takes a small commission on completion.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border p-4 bg-secondary/30 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{contactOpen?.category}</span></div>
            {contactOpen?.price_fiat != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="text-gradient-gold font-display">{fmtR(Number(contactOpen.price_fiat))}</span></div>
            )}
            {contactOpen?.price_sparks != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Sparks</span><span className="text-accent-soft">{Math.round(Number(contactOpen.price_sparks))} SP</span></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactOpen(null)}>Close</Button>
            <Button
              onClick={() => {
                toast.success("Seller notified — they'll be in touch.");
                setContactOpen(null);
              }}
              className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <MessageCircle className="h-4 w-4 mr-1.5" /> Notify seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </main>
  );
}
