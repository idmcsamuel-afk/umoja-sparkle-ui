import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyCountry } from "@/hooks/useCountryConfig";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Check, Copy, ArrowRight, Loader2 } from "lucide-react";

interface MarketplaceCard {
  id: string;
  name: string;
  country: string;
  url: string;
  description: string;
}

const MARKETPLACES: Record<string, MarketplaceCard[]> = {
  ZA: [
    { id: "takealot", name: "Takealot.com", country: "ZA", url: "https://www.takealot.com/sell", description: "South Africa's #1 ecommerce platform" },
    { id: "superbalist", name: "Superbalist.com", country: "ZA", url: "https://superbalist.com/sellers", description: "Fashion & lifestyle marketplace" },
    { id: "zando", name: "Zando.co.za", country: "ZA", url: "https://www.zando.co.za", description: "Online fashion platform" },
  ],
  NG: [
    { id: "jumia", name: "Jumia.ng", country: "NG", url: "https://www.jumia.com.ng/sp-sell-on-jumia/", description: "Nigeria's leading online retailer" },
    { id: "konga", name: "Konga.com", country: "NG", url: "https://www.konga.com/sell-on-konga", description: "Major Nigerian ecommerce" },
    { id: "jiji", name: "Jiji.ng", country: "NG", url: "https://jiji.ng", description: "Classifieds & marketplace" },
  ],
  KE: [
    { id: "jumia-ke", name: "Jumia.co.ke", country: "KE", url: "https://www.jumia.co.ke", description: "Kenya's leading online retailer" },
    { id: "kilimall", name: "Kilimall.co.ke", country: "KE", url: "https://www.kilimall.co.ke", description: "Pan-African ecommerce" },
    { id: "pigiame", name: "Pigiame.co.ke", country: "KE", url: "https://www.pigiame.co.ke", description: "Classifieds marketplace" },
  ],
  ZM: [
    { id: "mudxi", name: "Mudxi.com", country: "ZM", url: "https://mudxi.com", description: "Zambian online marketplace" },
    { id: "zammart", name: "Zammart.com", country: "ZM", url: "https://zammart.com", description: "Zambia ecommerce platform" },
  ],
  MZ: [
    { id: "zando-mz", name: "Zando.co.mz", country: "MZ", url: "https://www.zando.co.mz", description: "Online fashion in Mozambique" },
    { id: "kukulula", name: "Kukulula.com", country: "MZ", url: "https://kukulula.com", description: "Mozambique online marketplace" },
  ],
};

export default function SparkTradeMarketplaceRecommendations() {
  const { user } = useAuth();
  const { config } = useMyCountry();
  const navigate = useNavigate();
  const country = config.country_code;
  const marketplaces = MARKETPLACES[country] ?? MARKETPLACES.ZA;

  const [storeId, setStoreId] = useState<number | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: store } = await supabase
        .from("spark_trade_stores" as any)
        .select("id")
        .eq("member_id", user.id)
        .maybeSingle();
      const sid = (store as any)?.id ?? null;
      setStoreId(sid);

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

  const storeUrl = storeId ? `${window.location.origin}/shop/${storeId}` : "";

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
        <h1 className="mt-2 font-display text-3xl md:text-4xl">Expand Your Reach</h1>
        <p className="mt-2 text-muted-foreground">List your store on popular marketplaces in {config.country_name}.</p>

        {storeUrl && (
          <Card className="mt-6 p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Your store URL</p>
              <p className="font-mono text-sm truncate">{storeUrl}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copyUrl}><Copy className="mr-2 h-4 w-4" /> Copy</Button>
          </Card>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
