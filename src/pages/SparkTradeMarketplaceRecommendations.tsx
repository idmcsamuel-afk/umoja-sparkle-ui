import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Check, Copy, ArrowRight, Loader2, Store, Sparkles } from "lucide-react";

interface MarketplaceCard {
  id: string;
  name: string;
  country: string;
  url: string;
  description: string;
}

// Canonical marketplace catalog — MUST match the sales-channels list in
// SparkTradeSubscriptionRecommendation.tsx (no fashion-only sites).
const MARKETPLACES: Record<string, MarketplaceCard[]> = {
  ZA: [
    { id: "takealot", name: "Takealot.com", country: "ZA", url: "https://www.takealot.com/sell", description: "South Africa's #1 ecommerce platform" },
    { id: "amazon_sa", name: "Amazon.co.za", country: "ZA", url: "https://sell.amazon.com", description: "Amazon's global seller portal (South Africa supported)" },
    { id: "makro", name: "Makro Marketplace", country: "ZA", url: "https://www.makro.co.za/sellers", description: "Massmart / Walmart-owned wholesale" },
  ],
  NG: [
    { id: "jumia", name: "Jumia.ng", country: "NG", url: "https://www.jumia.com.ng/sp-sell-on-jumia/", description: "Nigeria's leading online retailer" },
    { id: "jiji", name: "Jiji.ng", country: "NG", url: "https://jiji.ng", description: "Classifieds & marketplace" },
    { id: "konga", name: "Konga.com", country: "NG", url: "https://www.konga.com/sell-on-konga", description: "Major Nigerian ecommerce" },
  ],
  KE: [
    { id: "jumia-ke", name: "Jumia.co.ke", country: "KE", url: "https://www.jumia.co.ke", description: "Kenya's leading online retailer" },
    { id: "kilimall", name: "Kilimall.co.ke", country: "KE", url: "https://www.kilimall.co.ke", description: "Pan-African ecommerce" },
  ],
  ZM: [
    { id: "mudxi", name: "Mudxi.com", country: "ZM", url: "https://mudxi.com", description: "Zambian online marketplace" },
    { id: "zammart", name: "Zammart.com", country: "ZM", url: "https://zammart.com", description: "Zambia ecommerce platform" },
  ],
  MZ: [
    { id: "kukulula", name: "Kukulula.com", country: "MZ", url: "https://kukulula.com", description: "Mozambique online marketplace" },
  ],
};

export default function SparkTradeMarketplaceRecommendations() {
  const { user, member } = useAuth();
  const { config } = useMyCountry();
  const navigate = useNavigate();
  const country = config.country_code;
  const allMarketplaces = MARKETPLACES[country] ?? MARKETPLACES.ZA;

  const [storeId, setStoreId] = useState<number | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: store }, { data: mem }] = await Promise.all([
        supabase.from("spark_trade_stores" as any).select("id").eq("member_id", user.id).maybeSingle(),
        supabase.from("members").select("spark_trade_sales_channels" as any).eq("id", user.id).maybeSingle(),
      ]);
      const sid = (store as any)?.id ?? null;
      setStoreId(sid);
      setSelectedChannels(((mem as any)?.spark_trade_sales_channels as string[] | null) ?? null);

      if (sid) {
        const { data: listings } = await supabase
          .from("spark_trade_marketplace_listings" as any)
          .select("marketplace_name")
          .eq("store_id", sid);
        setCompleted(((listings as any[]) ?? []).map((l) => l.marketplace_name));
      }
      setLoading(false);
    })();
  }, [user]);

  // Canonical live store URL — /shop/:referral_code (routed to StorefrontPublic)
  const referralCode = member?.referral_code ?? "";
  const storeUrl = referralCode ? `${window.location.origin}/shop/${referralCode}` : "";

  // Personalize: show only the marketplaces the member picked in sales-channels.
  // Fall back to all if they didn't pick any marketplaces.
  const marketplaces = useMemo(() => {
    if (!selectedChannels || selectedChannels.length === 0) return allMarketplaces;
    const picked = allMarketplaces.filter((m) => selectedChannels.includes(m.id));
    return picked.length > 0 ? picked : allMarketplaces;
  }, [selectedChannels, allMarketplaces]);

  const handleMarkDone = async (m: MarketplaceCard) => {
    if (!storeId) {
      toast.error("Create your store first");
      return;
    }
    const { error } = await supabase.from("spark_trade_marketplace_listings" as any).insert({
      store_id: storeId,
      marketplace_name: m.id,
      marketplace_country: m.country,
      listing_url: m.url,
      listing_status: "visited",
    });
    if (error) {
      toast.error("Could not save", { description: error.message });
      return;
    }
    setCompleted((c) => [...c, m.id]);
    toast.success(`Marked ${m.name} as done`);
  };

  const copyUrl = async () => {
    if (!storeUrl) return;
    await navigator.clipboard.writeText(storeUrl);
    toast.success("Store URL copied");
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Step 6 of 10</p>

        {/* HERO — Your store is live */}
        {storeUrl ? (
          <Card className="mt-4 overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary font-semibold">
                <Sparkles className="h-3.5 w-3.5" /> Your store is live
              </div>
              <h1 className="mt-2 font-display text-3xl md:text-4xl">🎉 You're open for business</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Share this link everywhere — customers can buy from you right now.
              </p>
              <div className="mt-5 rounded-2xl bg-background/70 border border-border p-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-primary shrink-0" />
                <p className="font-mono text-sm truncate flex-1">{storeUrl}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button asChild size="lg" className="h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow">
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    View My Store <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-12 rounded-2xl" onClick={copyUrl}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Link
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="mt-4 p-6">
            <p className="text-sm text-muted-foreground">Finish your storefront setup to get your live link.</p>
          </Card>
        )}

        {/* MARKETPLACES */}
        <div className="mt-10">
          <h2 className="font-display text-2xl">Expand Your Reach</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedChannels && selectedChannels.length > 0
              ? "The marketplaces you picked earlier — list your products on each."
              : `Marketplaces you can sell on in ${config.country_name}.`}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketplaces.map((m) => {
            const isDone = completed.includes(m.id);
            return (
              <Card key={m.id} className={`p-5 border-l-4 ${isDone ? "border-l-green-500" : "border-l-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg">{m.name}</h3>
                  {isDone && <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Done</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                      Visit <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                  <Button size="sm" variant={isDone ? "secondary" : "outline"} className="flex-1" onClick={() => handleMarkDone(m)} disabled={isDone}>
                    {isDone ? "Done" : "Mark Done"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 flex justify-end">
          <Button size="lg" onClick={() => navigate("/spark-trade/onboarding/product-opportunities")}>
            Continue to Opportunities <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
