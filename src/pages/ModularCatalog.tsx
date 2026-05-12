import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Boxes, Bed, Bath, Maximize2, Truck, Hammer, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";

interface Model {
  id: string; name: string; bedrooms: number; bathrooms: number; size_sqm: number;
  base_price_zar: number; delivery_weeks: number; assembly_weeks: number;
  min_plot_sqm: number | null; description: string | null; image_url: string | null; supplier: string | null;
}

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function ModularCatalog() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("modular_models").select("*").eq("is_active", true).order("base_price_zar");
      setModels((data ?? []) as Model[]);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/property" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Modular catalog</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Browse modular<br />
            <span className="text-gradient-gold italic font-[450]">home models.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Pre-vetted prefab homes from trusted Chinese manufacturers. Pick a model and we'll source land + launch a community fundraise.
          </p>
        </div>
      </section>

      <section className="px-5 pt-8">
        <div className="mx-auto max-w-2xl">
          {loading ? (
            <div className="rounded-3xl glass p-10 animate-pulse h-32" />
          ) : (
            <ul className="space-y-4">
              {models.map((m, i) => (
                <li key={m.id} style={{ animationDelay: `${i * 60}ms` }} className="overflow-hidden rounded-3xl glass animate-slide-up">
                  <div className="relative h-40 bg-secondary">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-primary/10">
                        <Boxes className="h-10 w-10 text-primary/60" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-xl">{m.name}</h3>
                        {m.supplier && <p className="text-[11px] text-muted-foreground">{m.supplier}</p>}
                      </div>
                      <p className="font-display text-xl text-gradient-gold">{fmtR(m.base_price_zar)}</p>
                    </div>
                    {m.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{m.description}</p>}
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <Spec icon={Bed} value={`${m.bedrooms} bed`} />
                      <Spec icon={Bath} value={`${m.bathrooms} bath`} />
                      <Spec icon={Maximize2} value={`${m.size_sqm} m²`} />
                      <Spec icon={Truck} value={`${m.delivery_weeks}w del`} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Hammer className="h-3 w-3" /> {m.assembly_weeks} week assembly
                      {m.min_plot_sqm && <> · plot ≥ {m.min_plot_sqm} m²</>}
                    </div>
                    <Button disabled className="mt-4 w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground hover-scale">
                      <Sparkles className="h-4 w-4 mr-1.5" /> Build a project (coming soon)
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

function Spec({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 border border-border p-2 flex flex-col items-center gap-0.5">
      <Icon className="h-3.5 w-3.5 text-accent" />
      <p className="text-[10px]">{value}</p>
    </div>
  );
}
