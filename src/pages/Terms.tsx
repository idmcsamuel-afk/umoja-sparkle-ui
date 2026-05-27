import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/umoja/Logo";
import { SiteFooter } from "@/components/umoja/SiteFooter";

const SECTIONS = [
  { id: "about", title: "1. About UMOJA" },
  { id: "eligibility", title: "2. Eligibility" },
  { id: "accounts", title: "3. Accounts & Security" },
  { id: "circles", title: "4. Wealth Circles & Contributions" },
  { id: "payments", title: "5. Payments, Fees & Payouts" },
  { id: "usdt", title: "6. Cryptocurrency (USDT) Payments" },
  { id: "kyc", title: "7. KYC & Compliance" },
  { id: "conduct", title: "8. Member Conduct" },
  { id: "risk", title: "9. Risk Disclosure" },
  { id: "ip", title: "10. Intellectual Property" },
  { id: "termination", title: "11. Termination" },
  { id: "liability", title: "12. Limitation of Liability" },
  { id: "law", title: "13. Governing Law" },
  { id: "changes", title: "14. Changes to Terms" },
  { id: "contact", title: "15. Contact" },
  { id: "spark-pit", title: "16. Spark Pit Games & Entertainment" },
  { id: "anti-fraud", title: "17. Anti-Gaming & Fraud Prevention" },
  { id: "withdrawal", title: "18. Withdrawal & Payment" },
];

const Terms = () => {
  useEffect(() => {
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
    document.title = "Terms of Service | UMOJA";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "Terms of Service for UMOJA Circle platform";
    return () => {
      if (prevDesc && meta) meta.content = prevDesc;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-smooth">
            Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 text-[16px] leading-7 text-foreground/90">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Legal</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-foreground">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: May 26, 2026</p>

        <nav aria-label="Table of contents" className="mt-8 rounded-2xl border border-border bg-secondary/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-accent hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="about" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">1. About UMOJA</h2>
          <p className="mt-3">
            UMOJA is a comprehensive community wealth platform with multiple income-generating and wealth-building
            features. We are NOT:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>An investment company</li>
            <li>A bank or financial institution</li>
            <li>A money lending service</li>
            <li>A pyramid or Ponzi scheme</li>
          </ul>

          <h3 className="mt-6 font-display text-xl text-foreground">Platform Features</h3>

          <h4 className="mt-4 font-semibold text-foreground">1. Contribution Circles (Modern Stokvel)</h4>
          <p className="mt-2">
            Peer-to-peer contribution circles where members contribute funds, wait their turn in a priority queue,
            and receive payouts based on predetermined multipliers (14%, 23.5%, or 42.5% returns).
          </p>

          <h4 className="mt-4 font-semibold text-foreground">2. Drive Program (Community Car Ownership)</h4>
          <p className="mt-2">
            A car financing program built on community contributions. Members contribute incrementally (like a
            stokvel) to reach a target amount (e.g., R10,000 for an economy car). Once the target is reached, they
            receive the car and make weekly or monthly payments to complete the purchase. No credit checks, no large
            bank deposits, no traditional financing needed — just community members helping each other get cars in
            turns.
          </p>

          <h4 className="mt-4 font-semibold text-foreground">3. Spark Trade (Group Buying Intelligence)</h4>
          <p className="mt-2">
            Data-validated group buying platform that shows members what products are already selling on Takealot,
            Amazon, and Makro. Three intelligence tiers:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li><strong>Buy Now:</strong> Products selling 100+/month (proven demand)</li>
            <li><strong>Buy Soon:</strong> High search volume (10K+/month), low supply (first-mover advantage)</li>
            <li><strong>Coming Wave:</strong> Trending globally on TikTok/YouTube, not yet in SA (highest upside)</li>
          </ul>
          <p className="mt-2">
            Includes Finzite profitability calculator (accounts for all marketplace fees), group buying coordination
            (wholesale prices without minimum orders), and optional "Fulfilled by UMOJA" service (we warehouse, list,
            ship, and handle returns while you collect the margin).
          </p>

          <h4 className="mt-4 font-semibold text-foreground">4. Referral System</h4>
          <p className="mt-2">Earn rewards for growing the community:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>100 Spark Points per successful referral</li>
            <li>50 Spark Points welcome bonus for new members</li>
            <li>Referrals boost your Priority Score in Circles</li>
            <li>Build passive income through network growth</li>
          </ul>

          <h4 className="mt-4 font-semibold text-foreground">5. Spark Points Ecosystem</h4>
          <p className="mt-2">Loyalty rewards program where points can be:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Redeemed for platform benefits</li>
            <li>Used to boost Circle priority</li>
            <li>Exchanged for exclusive opportunities</li>
            <li>Accumulated for community standing</li>
          </ul>

          <h3 className="mt-6 font-display text-xl text-foreground">Registered Entity</h3>
          <p className="mt-2">
            UMOJA RISE PTY LTD<br />
            Registration: 2026/3595533/07<br />
            Headquarters: Johannesburg, South Africa
          </p>

          <h3 className="mt-6 font-display text-xl text-foreground">Platform Scope</h3>
          <p className="mt-2">
            Currently serving South Africa with expansion to Kenya, Nigeria, and Ghana. Accepts payments in ZAR,
            USDT cryptocurrency (global access), and expanding to KES, NGN, and GHS.
          </p>
        </section>

        <section id="eligibility" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">2. Eligibility</h2>
          <p className="mt-3">
            You must be at least 18 years old and legally capable of entering into binding contracts in your
            jurisdiction. UMOJA serves members across Africa and accepts international members via USDT payments.
          </p>
        </section>

        <section id="accounts" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">3. Accounts & Security</h2>
          <p className="mt-3">
            You are responsible for safeguarding your account credentials and for all activity under your account.
            Notify us immediately of any unauthorized access.
          </p>
        </section>

        <section id="circles" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">4. Wealth Circles & Contributions</h2>
          <p className="mt-3">
            UMOJA Circles are peer-to-peer rotating savings groups. Contributions you make are pooled and distributed
            to members according to the tier rules disclosed at the time of joining (Seed, Growth, Harvest).
          </p>
        </section>

        <section id="payments" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">5. Payments, Fees & Payouts</h2>
          <p className="mt-3">
            A 5% fee applies to gross payouts (2% platform, 3% Ubuntu community fund). Payouts are scheduled per the
            tier you select and are subject to receipt and verification of your contribution.
          </p>
        </section>

        <section id="usdt" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">6. Cryptocurrency (USDT) Payments</h2>
          <p className="mt-3">
            Members outside South Africa may contribute and receive payouts in USDT (TRC-20). You are responsible for
            sending to the correct wallet address and for any network fees. Exchange rates are captured at the time of
            payment to determine your fiat-equivalent payout.
          </p>
        </section>

        <section id="kyc" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">7. KYC & Compliance</h2>
          <p className="mt-3">
            You agree to provide accurate identity verification (KYC) information when required. We may suspend
            access until verification is complete.
          </p>
        </section>

        <section id="conduct" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">8. Member Conduct</h2>
          <p className="mt-3">
            You agree not to use the Platform for fraud, money laundering, abuse, harassment, or any unlawful
            purpose. Violations may result in suspension or termination without refund.
          </p>
        </section>

        <section id="risk" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">9. Risk Disclosure</h2>
          <p className="mt-3">
            Participation in community wealth circles involves risk, including delays or non-receipt of payouts if
            members default. UMOJA does not guarantee returns and is not a bank, deposit-taking institution, or
            registered financial advisor.
          </p>
        </section>

        <section id="ip" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">10. Intellectual Property</h2>
          <p className="mt-3">
            All Platform content, branding, and software are the property of UMOJA or its licensors. You may not copy,
            modify, or redistribute without written permission.
          </p>
        </section>

        <section id="termination" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">11. Termination</h2>
          <p className="mt-3">
            We may suspend or terminate your account at our discretion for breach of these Terms or to comply with
            law. You may close your account at any time after fulfilling active obligations.
          </p>
        </section>

        <section id="liability" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">12. Limitation of Liability</h2>
          <p className="mt-3">
            To the maximum extent permitted by law, UMOJA is not liable for indirect, incidental, or consequential
            damages arising from your use of the Platform.
          </p>
        </section>

        <section id="law" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">13. Governing Law</h2>
          <p className="mt-3">
            These Terms are governed by the laws of the Republic of South Africa, without regard to conflict-of-law
            principles.
          </p>
        </section>

        <section id="changes" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">14. Changes to Terms</h2>
          <p className="mt-3">
            We may update these Terms from time to time. Material changes will be communicated via the Platform or by
            email. Continued use constitutes acceptance.
          </p>
        </section>

        <section id="contact" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">15. Contact</h2>
          <p className="mt-3">
            Questions? Email <a className="text-accent hover:underline" href="mailto:support@umojarise.com">support@umojarise.com</a>.
          </p>
        </section>

        <div className="mt-12 border-t border-border pt-6">
          <Link to="/" className="text-sm text-accent hover:underline">← Back to Home</Link>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
};

export default Terms;
