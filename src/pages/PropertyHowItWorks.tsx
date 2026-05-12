import { Link } from "react-router-dom";
import { ArrowLeft, Boxes, ShieldCheck, Leaf, TrendingUp, Truck, Hammer, Sparkles } from "lucide-react";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const FAQ = [
  { q: "What are modular homes?", a: "Factory-built homes assembled on-site. They arrive as panels or modules and are connected together — typically in 2 weeks vs 6 months for traditional construction." },
  { q: "Why source from China?", a: "Chinese manufacturers like Shenzhen ModuHome and Guangzhou PrefabPro have 15+ years building modular homes for global markets. We get 40% cost savings vs local build with comparable or better quality." },
  { q: "How durable are they?", a: "Steel frames and insulated panels are engineered for 50+ year lifespans. Structural warranty is 10 years from the manufacturer; appliances and finishes carry their own warranties." },
  { q: "What about energy efficiency?", a: "Modern modular homes ship with double-glazed windows, insulated panels (R-value 4+), and solar-ready wiring. Running costs are typically 30% lower than equivalent traditional builds." },
  { q: "Can I resell my units?", a: "Yes — REIT units can be sold back to UMOJA after a 12-month hold period at NAV (net asset value), or peer-to-peer at any time." },
  { q: "Who manages the property?", a: "UMOJA handles tenant placement, rent collection, and maintenance. 10% management fee is deducted from rental income before distribution." },
];

export default function PropertyHowItWorks() {
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
        <div className="mx-auto max-w-2xl animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">How it works</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            Modular homes,<br />
            <span className="text-gradient-gold italic font-[450]">explained.</span>
          </h1>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3">
          <Card icon={TrendingUp} title="40% cheaper" body="vs traditional construction" />
          <Card icon={Truck} title="6 weeks delivery" body="from factory to site" />
          <Card icon={Hammer} title="2 weeks assembly" body="plug-and-play install" />
          <Card icon={ShieldCheck} title="10-year warranty" body="on structural elements" />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
          <h2 className="font-display text-xl">The process</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              ["Land secured", "We source and acquire a serviced plot with title deed."],
              ["REIT opens", "Members invest in R100 units. Funding window typically 4 weeks."],
              ["Home ordered", "On full funding, we order from the Chinese supplier."],
              ["Delivery", "6 weeks ocean freight + customs to South African port."],
              ["Assembly", "2 weeks on-site assembly, services connection, finishing."],
              ["Tenant placement", "UMOJA finds a tenant. Rental income flows to unit holders quarterly."],
            ].map(([title, body], i) => (
              <li key={title} className="flex items-start gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">{i + 1}</div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-2xl rounded-3xl glass p-5">
          <h2 className="font-display text-xl">FAQ</h2>
          <Accordion type="single" collapsible className="mt-2">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

function Card({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-3xl glass p-4">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary/10 border border-primary/20">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 font-display text-lg">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
