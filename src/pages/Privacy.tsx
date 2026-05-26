import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/umoja/Logo";
import { SiteFooter } from "@/components/umoja/SiteFooter";

const SECTIONS = [
  { id: "intro", title: "1. Introduction" },
  { id: "data-we-collect", title: "2. Data We Collect" },
  { id: "how-we-use", title: "3. How We Use Your Data" },
  { id: "legal-basis", title: "4. Legal Basis for Processing" },
  { id: "sharing", title: "5. Sharing & Disclosure" },
  { id: "kyc", title: "6. KYC & Identity Verification" },
  { id: "payments", title: "7. Payment & Wallet Information" },
  { id: "cookies", title: "8. Cookies & Tracking" },
  { id: "retention", title: "9. Data Retention" },
  { id: "security", title: "10. Security" },
  { id: "your-rights", title: "11. Your Rights" },
  { id: "children", title: "12. Children's Privacy" },
  { id: "transfers", title: "13. International Transfers" },
  { id: "changes", title: "14. Changes to This Policy" },
  { id: "contact", title: "15. Contact" },
];

const Privacy = () => {
  useEffect(() => {
    const prevDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
    document.title = "Privacy Policy | UMOJA";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "Privacy Policy for UMOJA Circle users";
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
        <h1 className="mt-2 font-display text-4xl tracking-tight text-foreground">Privacy Policy</h1>
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

        <section id="intro" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">1. Introduction</h2>
          <p className="mt-3">
            UMOJA ("we", "us") respects your privacy. This Privacy Policy explains what personal information we
            collect, how we use and protect it, and the choices you have.
          </p>
        </section>

        <section id="data-we-collect" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">2. Data We Collect</h2>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li>Account info: name, email, phone, country, referral code.</li>
            <li>KYC data: ID document, selfie, address (when required).</li>
            <li>Financial info: bank account details, USDT wallet addresses, transaction hashes.</li>
            <li>Usage data: pages visited, device, IP address, log data.</li>
          </ul>
        </section>

        <section id="how-we-use" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">3. How We Use Your Data</h2>
          <p className="mt-3">
            To operate Circles, verify identity, process payments and payouts, prevent fraud, send notifications, and
            improve the Platform.
          </p>
        </section>

        <section id="legal-basis" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">4. Legal Basis for Processing</h2>
          <p className="mt-3">
            We process data to perform our contract with you, to comply with legal obligations (such as anti-money
            laundering), and where you have given consent.
          </p>
        </section>

        <section id="sharing" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">5. Sharing & Disclosure</h2>
          <p className="mt-3">
            We share data only with payment processors, KYC providers, hosting and email vendors, and authorities
            when legally required. We do not sell your data.
          </p>
        </section>

        <section id="kyc" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">6. KYC & Identity Verification</h2>
          <p className="mt-3">
            Identity documents and selfies are stored securely and used solely to verify your identity and comply
            with applicable law.
          </p>
        </section>

        <section id="payments" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">7. Payment & Wallet Information</h2>
          <p className="mt-3">
            Bank account and USDT wallet details are encrypted at rest. Blockchain transaction hashes you submit are
            verified against on-chain data and stored for audit and payout reconciliation.
          </p>
        </section>

        <section id="cookies" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">8. Cookies & Tracking</h2>
          <p className="mt-3">
            We use essential cookies to keep you signed in and limited analytics to understand usage. You can control
            cookies via your browser settings.
          </p>
        </section>

        <section id="retention" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">9. Data Retention</h2>
          <p className="mt-3">
            We retain data for as long as your account is active and longer where required by law (e.g., financial
            records typically 5 years).
          </p>
        </section>

        <section id="security" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">10. Security</h2>
          <p className="mt-3">
            We use industry-standard safeguards including encryption in transit, encrypted storage, and access
            controls. No system is 100% secure; report concerns immediately.
          </p>
        </section>

        <section id="your-rights" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">11. Your Rights</h2>
          <p className="mt-3">
            Depending on your jurisdiction (e.g., POPIA, GDPR), you may request access, correction, deletion, or
            export of your data, and object to certain processing.
          </p>
        </section>

        <section id="children" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">12. Children's Privacy</h2>
          <p className="mt-3">UMOJA is not directed at children under 18 and we do not knowingly collect their data.</p>
        </section>

        <section id="transfers" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">13. International Transfers</h2>
          <p className="mt-3">
            Your data may be processed in countries other than your own. We use appropriate safeguards for such
            transfers.
          </p>
        </section>

        <section id="changes" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">14. Changes to This Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. Material changes will be notified via the Platform
            or by email.
          </p>
        </section>

        <section id="contact" className="mt-8 scroll-mt-24">
          <h2 className="font-display text-2xl text-foreground">15. Contact</h2>
          <p className="mt-3">
            Privacy questions? Email <a className="text-accent hover:underline" href="mailto:privacy@umojarise.com">privacy@umojarise.com</a>.
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

export default Privacy;
