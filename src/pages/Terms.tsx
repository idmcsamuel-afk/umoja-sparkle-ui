import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/umoja/Logo";
import { SiteFooter } from "@/components/umoja/SiteFooter";

const SECTIONS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
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

        <section id="acceptance" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By creating an account or using UMOJA ("the Platform"), you agree to be bound by these Terms of Service.
            If you do not agree, you may not use the Platform.
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
