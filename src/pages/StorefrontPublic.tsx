import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Star, MessageCircle, Mail, Share2, Copy, Facebook, Twitter } from "lucide-react";
import { toast } from "sonner";

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
  kyc_photo_url: string | null;
  buyers_club_tier: string | null;
  has_buyers_club_access: boolean;
  created_at: string;
}
interface Product {
  id: string;
  product_name: string | null;
  category: string | null;
  sale_price: number | null;
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
  const [signedPhoto, setSignedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from("members")
        .select("id, full_name, email, phone, kyc_photo_url, buyers_club_tier, has_buyers_club_access, created_at")
        .ilike("referral_code", code).maybeSingle();
      if (!m) { setLoading(false); return; }
      setMember(m as Member);

      const { data: s } = await supabase.from("storefronts")
        .select("*").eq("member_id", m.id).maybeSingle();
      setSf(s as Storefront | null);

      // Increment view count (fire and forget)
      supabase.rpc("increment_storefront_view" as any, { _owner: m.id }).catch(() => {});

      // Products from spark trade joins
      const { data: joins } = await supabase.from("spark_trade_joins")
        .select("shortlist_id").eq("member_id", m.id);
      const ids = (joins ?? []).map((j: any) => j.shortlist_id);
      if (ids.length) {
        const { data: prods } = await supabase.from("spark_trade_shortlist")
          .select("id, product_name, category, sale_price")
          .in("id", ids).eq("is_demo", false);
        setProducts((prods ?? []) as Product[]);
      }

      // Reviews
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

      // Signed URL for photo if available
      if (m.kyc_photo_url) {
        const { data: u } = await supabase.storage.from("kyc-photos").createSignedUrl(m.kyc_photo_url, 3600);
        setSignedPhoto(u?.signedUrl ?? null);
      }

      setLoading(false);
    })();
  }, [code]);

  const accent = sf?.accent_color || "#C9A84C";
  const avgRating = useMemo(() => reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0, [reviews]);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Check out ${sf?.display_name || member?.full_name}'s shop on UMOJA`;

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
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
    // refresh
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
    const msg = `Hi ${member.full_name.split(" ")[0]}, I'm interested in ${productName ?? "your products"} from your UMOJA shop. Is it still available?`;
    const phone = member.phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-10">
      {/* Banner */}
      <div className="w-full aspect-[4/1] sm:aspect-[5/1] bg-gradient-to-br from-primary/30 to-accent/20 overflow-hidden">
        {sf.banner_url && <img src={sf.banner_url} alt="" className="h-full w-full object-cover" />}
      </div>

      {/* Profile */}
      <div className="mx-auto max-w-4xl px-4 -mt-16 text-center">
        <div className="inline-block">
          <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full border-4 border-background overflow-hidden bg-secondary mx-auto"
               style={{ boxShadow: `0 0 0 3px ${accent}` }}>
            {signedPhoto ? (
              <img src={signedPhoto} alt={member.full_name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-display">
                {member.full_name.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <h1 className="font-display text-3xl mt-4">{sf.display_name || member.full_name}</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-wider"
             style={{ backgroundColor: `${accent}22`, color: accent }}>
          ⭐ Gold member
        </div>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
          {sf.bio || `Hi! I'm ${member.full_name.split(" ")[0]} and I import quality products through UMOJA. Browse my collection below!`}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Member since {new Date(member.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Products */}
      <div className="mx-auto max-w-5xl px-4 mt-10">
        <h2 className="font-display text-2xl">Products</h2>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No products listed yet — check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="rounded-3xl border border-border bg-gradient-card p-4 flex flex-col">
                <div className="aspect-square rounded-2xl bg-secondary/40 grid place-items-center text-3xl">📦</div>
                <h3 className="mt-3 font-medium line-clamp-2">{p.product_name ?? "Product"}</h3>
                <p className="text-xs text-muted-foreground">{p.category ?? "—"}</p>
                {typeof p.sale_price === "number" && p.sale_price > 0 && (
                  <p className="mt-1 font-display text-lg" style={{ color: accent }}>R{p.sale_price.toFixed(2)}</p>
                )}
                <Button onClick={() => contactWhatsapp(p.product_name ?? undefined)}
                  className="mt-auto rounded-2xl"
                  style={{ backgroundColor: accent, color: "#1a1100" }}>
                  <MessageCircle className="h-4 w-4 mr-1" /> Contact Seller
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mx-auto max-w-3xl px-4 mt-12">
        <h2 className="font-display text-2xl">Customer Reviews</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="text-4xl font-display" style={{ color: accent }}>{avgRating.toFixed(1)}</div>
          <div>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4" fill={i <= Math.round(avgRating) ? accent : "none"} stroke={accent} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">({reviews.length} reviews)</p>
          </div>
          {user && user.id !== member.id && (
            <Button onClick={() => setShowReview(true)} variant="outline" className="ml-auto rounded-2xl">
              Write Review
            </Button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-gradient-card p-4">
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
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">Be the first to leave a review.</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto max-w-3xl px-4 mt-16 text-center text-xs text-muted-foreground">
        <p>Powered by <Link to="/" className="text-accent hover:underline">UMOJA Rise</Link></p>
        <p className="mt-1">Want your own shop? <Link to="/spark" className="text-accent hover:underline">Join Gold tier →</Link></p>
      </div>

      {/* Sticky share bar (mobile) / inline (desktop) */}
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
                <button key={i} onClick={() => setRating(i)}>
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
