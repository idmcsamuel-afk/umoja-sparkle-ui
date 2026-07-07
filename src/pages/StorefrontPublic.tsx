import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Star, MessageCircle, Copy, Facebook, Twitter,
  ShieldCheck, Truck, Package, ChevronLeft, ChevronRight, ShoppingBag, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/umoja/Logo";
import { StorePolicies } from "@/components/umoja/StorePolicies";

interface Storefront {
  member_id: string;
  display_name: string | null;
  bio: string | null;
  banner_url: string | null;
  accent_color: string;
  is_active: boolean;
  view_count: number;
}
interface Member {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  buyers_club_tier: string | null;
  has_buyers_club_access: boolean;
  created_at: string;
}
interface Product {
  id: number;
  product_name: string | null;
  category: string | null;
  sale_price: number | null;
  image_url: string | null;
}
interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  reviewer_name?: string;
}

export default function StorefrontPublic() {
  const { code } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [sf, setSf] = useState<Storefront | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from("members")
        .select("id, full_name, email, phone, buyers_club_tier, has_buyers_club_access, created_at")
        .ilike("referral_code", code).maybeSingle();
      if (!m) { setLoading(false); return; }
      setMember(m as Member);

      const { data: s } = await supabase.from("storefronts")
        .select("*").eq("member_id", m.id).maybeSingle();
      setSf(s as Storefront | null);

      void supabase.rpc("increment_storefront_view" as any, { _owner: m.id });

      const { data: reservations } = await supabase
        .from("spark_trade_inventory_reservations" as any)
        .select("opportunity_id, reservation_status")
        .eq("member_id", m.id);
      const oppIds = Array.from(
        new Set(
          ((reservations as any[]) ?? [])
            .filter((r) => r.reservation_status !== "cancelled")
            .map((r) => Number(r.opportunity_id))
            .filter((n) => Number.isFinite(n))
        )
      );
      if (oppIds.length) {
        const { data: opps } = await supabase
          .from("spark_trade_opportunities")
          .select("id, product_name, category, suggested_selling_price_zar, product_image_url")
          .in("id", oppIds as any);
        const list: Product[] = ((opps as any[]) ?? []).map((o) => ({
          id: Number(o.id),
          product_name: o.product_name ?? null,
          category: o.category ?? null,
          sale_price: o.suggested_selling_price_zar != null ? Number(o.suggested_selling_price_zar) : null,
          image_url: o.product_image_url ?? null,
        }));
        setProducts(list);
      } else {
        setProducts([]);
      }

      const { data: rv } = await supabase.from("storefront_reviews")
        .select("id, reviewer_id, rating, review_text, created_at")
        .eq("storefront_owner_id", m.id).order("created_at", { ascending: false });
      const list = (rv ?? []) as Review[];
      const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_id)));
      if (reviewerIds.length) {
        const { data: rps } = await supabase.from("members").select("id, full_name").in("id", reviewerIds);
        const map: Record<string, string> = {};
        (rps ?? []).forEach((p: any) => { map[p.id] = (p.full_name ?? "").split(" ")[0] || "Member"; });
        list.forEach((r) => { r.reviewer_name = map[r.reviewer_id] ?? "Member"; });
      }
      setReviews(list);

      setLoading(false);
    })();
  }, [code]);

  const accent = sf?.accent_color || "#C9A84C";
  const avgRating = useMemo(() => reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0, [reviews]);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const storeName = sf?.display_name || member?.full_name || "Shop";
  const shareText = `Check out ${storeName} on UMOJA Spark Trade`;

  const heroProducts = useMemo(
    () => products.filter((p) => !!p.image_url).slice(0, 5),
    [products]
  );
  const activeHero = heroProducts[heroIdx] ?? heroProducts[0];

  // Auto-advance hero
  useEffect(() => {
    if (heroProducts.length < 2) return;
    const prefersReduced = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const id = setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroProducts.length);
    }, 5000);
    return () => clearInterval(id);
  }, [heroProducts.length]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!member || !sf || !sf.is_active) {
    return (
      <div className="mx-auto max-w-md p-6 text-center mt-20">
        <h1 className="font-display text-2xl">Shop not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This storefront isn't available.</p>
        <Link to="/"><Button className="mt-4 rounded-2xl">Go home</Button></Link>
      </div>
    );
  }

  const submitReview = async () => {
    if (!user) return toast.error("Sign in to leave a review");
    if (text.trim().length < 5) return toast.error("Add a brief review");
    setSubmitting(true);
    const { error } = await supabase.from("storefront_reviews").insert({
      storefront_owner_id: member.id,
      reviewer_id: user.id,
      rating, review_text: text.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your review!");
    setShowReview(false); setText(""); setRating(5);
    const { data: rv } = await supabase.from("storefront_reviews")
      .select("id, reviewer_id, rating, review_text, created_at")
      .eq("storefront_owner_id", member.id).order("created_at", { ascending: false });
    setReviews((rv ?? []) as Review[]);
  };

  const contactWhatsapp = (productName?: string) => {
    if (!member.phone) {
      if (member.email) window.location.href = `mailto:${member.email}?subject=UMOJA shop enquiry`;
      else toast.error("No contact details available");
      return;
    }
    const msg = `Hi ${member.full_name.split(" ")[0]}, I'd like to buy ${productName ?? "your products"} from your UMOJA Spark Trade shop. Is it still available?`;
    const phone = member.phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  // SEO
  const categoryLabel = products[0]?.category || "quality imported products";
  const metaTitle = `${storeName} — ${categoryLabel} | UMOJA Spark Trade`;
  const metaDesc = (sf.bio && sf.bio.trim().length > 0)
    ? sf.bio.trim().slice(0, 155)
    : `Shop ${categoryLabel} from ${storeName}, a verified UMOJA Spark Trade member store. Secure Paystack checkout.`;
  const ogImage = activeHero?.image_url || sf.banner_url || undefined;

  const productJsonLd = products
    .filter((p) => p.product_name && p.sale_price && p.sale_price > 0)
    .map((p) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.product_name,
      image: p.image_url ? [p.image_url] : undefined,
      category: p.category ?? undefined,
      brand: { "@type": "Brand", name: storeName },
      offers: {
        "@type": "Offer",
        priceCurrency: "ZAR",
        price: p.sale_price,
        availability: "https://schema.org/InStock",
        url: shareUrl,
      },
    }));

  return (
    <div className="min-h-screen bg-background pb-28 sm:pb-10">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={shareUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={shareUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
        {productJsonLd.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        )}
      </Helmet>

      {/* UMOJA brand strip */}
      <div className="w-full border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md">
            <Logo showWord={false} className="scale-90" />
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground group-hover:text-foreground transition-smooth">
              UMOJA <span className="text-accent">Spark Trade</span>
            </span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Verified member store
          </span>
        </div>
      </div>

      {/* HERO */}
      <section
        className="relative w-full overflow-hidden"
        aria-label={`${storeName} featured products`}
      >
        <div className="relative h-[62vh] min-h-[420px] max-h-[720px] sm:h-[70vh] w-full bg-secondary">
          {/* Slides */}
          {heroProducts.length > 0 ? (
            heroProducts.map((p, i) => (
              <img
                key={p.id}
                src={p.image_url!}
                alt={`${p.product_name ?? "Featured product"} — ${p.category ?? categoryLabel}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === heroIdx ? "opacity-100" : "opacity-0"}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i === 0 ? "high" as any : undefined}
              />
            ))
          ) : sf.banner_url ? (
            <img src={sf.banner_url} alt={`${storeName} store banner`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${accent}44, hsl(var(--background)))` }}
              aria-hidden
            />
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" aria-hidden />

          {/* Text overlay */}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-8 sm:pb-14">
            <div className="mx-auto max-w-6xl">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold rounded-full px-3 py-1 backdrop-blur"
                style={{ backgroundColor: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
              >
                <Sparkles className="h-3 w-3" /> Spark Trade Store
              </span>
              <h1
                className="mt-3 font-display text-4xl sm:text-6xl leading-[1.02] tracking-tight max-w-3xl"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55)" }}
              >
                {storeName}
              </h1>
              <p className="mt-3 max-w-xl text-sm sm:text-base text-foreground/85">
                {sf.bio?.trim() || "Quality products, delivered to your door."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="#products"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ backgroundColor: accent, color: "#1a1100" }}
                >
                  <ShoppingBag className="h-4 w-4" /> Shop the collection
                </a>
                <div className="inline-flex items-center gap-1.5 rounded-2xl bg-background/60 backdrop-blur px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border border-border/60">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Secure via Paystack
                </div>
              </div>
            </div>
          </div>

          {/* Slide controls */}
          {heroProducts.length > 1 && (
            <>
              <button
                aria-label="Previous product"
                onClick={() => setHeroIdx((i) => (i - 1 + heroProducts.length) % heroProducts.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-background/60 backdrop-blur border border-border/60 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                aria-label="Next product"
                onClick={() => setHeroIdx((i) => (i + 1) % heroProducts.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-background/60 backdrop-blur border border-border/60 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {heroProducts.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => setHeroIdx(i)}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === heroIdx ? 24 : 8,
                      backgroundColor: i === heroIdx ? accent : "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Trust bar */}
      <section aria-label="Store guarantees" className="border-b border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-4 grid grid-cols-3 gap-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
            <span><span className="font-semibold">Secure checkout</span><span className="hidden sm:inline text-muted-foreground"> · Paystack</span></span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm">
            <Truck className="h-4 w-4 text-accent shrink-0" />
            <span><span className="font-semibold">Delivery to your door</span><span className="hidden sm:inline text-muted-foreground"> · nationwide</span></span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm">
            <Sparkles className="h-4 w-4 text-accent shrink-0" />
            <span><span className="font-semibold">Verified member</span><span className="hidden sm:inline text-muted-foreground"> · UMOJA</span></span>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="mx-auto max-w-6xl px-4 mt-10 sm:mt-14 scroll-mt-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">The collection</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {products.length > 0
                ? `${products.length} product${products.length === 1 ? "" : "s"} available`
                : "New drops loading"}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Delivered nationwide
          </div>
        </div>

        {products.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-gradient-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ backgroundColor: `${accent}22` }}>
              <Sparkles className="h-6 w-6" style={{ color: accent }} />
            </div>
            <p className="mt-4 font-display text-lg">Coming soon</p>
            <p className="mt-1 text-sm text-muted-foreground">New products are dropping shortly — check back or follow the store.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <article
                key={p.id}
                className="group relative flex flex-col rounded-3xl border border-border bg-card overflow-hidden transition-all hover:border-accent/50 hover:shadow-xl"
              >
                <div className="relative aspect-square bg-secondary/40 overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={`${p.product_name ?? "Product"} — ${p.category ?? "Spark Trade product"}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-4xl">📦</div>
                  )}
                  {p.category && (
                    <span
                      className="absolute top-3 left-3 text-[10px] uppercase tracking-wider rounded-full px-2.5 py-1 backdrop-blur bg-background/70 border border-border/60"
                    >
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <h3 className="font-display text-lg leading-tight line-clamp-2">
                    {p.product_name ?? "Product"}
                  </h3>
                  {typeof p.sale_price === "number" && p.sale_price > 0 ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                        R{Math.round(p.sale_price).toLocaleString("en-ZA")}
                      </span>
                      <span className="text-xs text-muted-foreground">incl. group delivery</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Contact for pricing</p>
                  )}
                  <Button
                    onClick={() => contactWhatsapp(p.product_name ?? undefined)}
                    className="mt-1 h-12 rounded-2xl text-sm font-semibold shadow-md transition-transform hover:scale-[1.01]"
                    style={{ backgroundColor: accent, color: "#1a1100" }}
                    aria-label={`Buy ${p.product_name ?? "product"} now`}
                  >
                    <ShoppingBag className="h-4 w-4 mr-1.5" /> Buy now
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    <ShieldCheck className="inline h-3 w-3 mr-1 text-accent" />
                    Secure checkout · WhatsApp confirmation
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* REVIEWS */}
      <section className="mx-auto max-w-4xl px-4 mt-14">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">Customer reviews</h2>
        <div className="mt-4 flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="text-5xl font-display" style={{ color: accent }}>{avgRating.toFixed(1)}</div>
          <div className="flex-1">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4" fill={i <= Math.round(avgRating) ? accent : "none"} stroke={accent} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{reviews.length} review{reviews.length === 1 ? "" : "s"}</p>
          </div>
          {user && user.id !== member.id && (
            <Button onClick={() => setShowReview(true)} variant="outline" className="rounded-2xl">
              Write a review
            </Button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{r.reviewer_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5" fill={i <= r.rating ? accent : "none"} stroke={accent} />
                ))}
              </div>
              <p className="mt-2 text-sm">{r.review_text}</p>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Be the first to leave a review.</p>
          )}
        </div>
      </section>

      {/* Footer — powered by */}
      <section className="mx-auto max-w-4xl px-4 mt-14">
        <div className="rounded-3xl border border-border bg-gradient-card p-5 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <Logo showWord={false} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Powered by UMOJA <span className="text-accent">Spark Trade</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              Every Spark Trade store is run by a verified UMOJA member and backed by our group-buying network.
              Member since {new Date(member.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
            </p>
          </div>
          <Link to="/spark" className="text-xs font-semibold text-accent hover:underline whitespace-nowrap">
            Open your store →
          </Link>
        </div>
      </section>

      {/* Sticky share bar */}
      <div className="fixed bottom-0 inset-x-0 sm:static sm:max-w-3xl sm:mx-auto sm:mt-6 z-40 border-t sm:border border-border bg-background/95 backdrop-blur sm:rounded-2xl sm:bg-gradient-card">
        <div className="flex items-center justify-around sm:justify-center sm:gap-3 px-2 py-3">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs hover:bg-secondary">
            <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs hover:bg-secondary">
            <Facebook className="h-4 w-4 text-blue-500" /> Facebook
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs hover:bg-secondary">
            <Twitter className="h-4 w-4 text-sky-500" /> Twitter
          </a>
          <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs hover:bg-secondary">
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
      </div>

      {/* Review modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur p-4" onClick={() => setShowReview(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Write a review</h3>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setRating(i)} aria-label={`${i} star${i === 1 ? "" : "s"}`}>
                  <Star className="h-7 w-7" fill={i <= rating ? accent : "none"} stroke={accent} />
                </button>
              ))}
            </div>
            <Textarea maxLength={500} rows={4} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Share your experience..." className="mt-3 rounded-2xl" />
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setShowReview(false)} className="rounded-2xl">Cancel</Button>
              <Button disabled={submitting} onClick={submitReview} className="flex-1 rounded-2xl bg-gradient-gold text-amber-950">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
