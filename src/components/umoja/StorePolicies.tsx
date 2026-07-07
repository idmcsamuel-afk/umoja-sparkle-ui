import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ShieldCheck, RotateCcw, Mail } from "lucide-react";

type PolicyKey = "terms" | "privacy" | "returns" | "contact";

interface Props {
  storeName: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  accent: string;
}

export function StorePolicies({ storeName, ownerName, ownerEmail, ownerPhone, accent }: Props) {
  const [open, setOpen] = useState<PolicyKey | null>(null);
  const year = new Date().getFullYear();

  const links: { key: PolicyKey; label: string; icon: ReactNode }[] = [
    { key: "terms", label: "Terms & Conditions", icon: <FileText className="h-3.5 w-3.5" /> },
    { key: "privacy", label: "Privacy Policy", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    { key: "returns", label: "Returns & Refunds", icon: <RotateCcw className="h-3.5 w-3.5" /> },
    { key: "contact", label: "Contact", icon: <Mail className="h-3.5 w-3.5" /> },
  ];

  const contactLine = [
    ownerEmail ? `Email: ${ownerEmail}` : null,
    ownerPhone ? `WhatsApp / phone: ${ownerPhone}` : null,
  ].filter(Boolean).join(" · ");

  const content: Record<PolicyKey, ReactNode> = {
    terms: (
      <>
        <p>Welcome to <strong>{storeName}</strong> ("the store"), an independent storefront operated by {ownerName} on the UMOJA Spark Trade platform. By placing an order you agree to these terms.</p>
        <h4>Orders &amp; payment</h4>
        <p>Prices are shown in South African Rand (ZAR) and include applicable taxes unless stated otherwise. Payment is processed securely via Paystack. An order is confirmed once payment clears.</p>
        <h4>Product information</h4>
        <p>We take reasonable care to describe products accurately. Colours, dimensions and packaging may vary slightly from images shown.</p>
        <h4>Delivery</h4>
        <p>Delivery timelines are shared at checkout or on WhatsApp confirmation. Risk in the goods passes to you on delivery.</p>
        <h4>Platform role</h4>
        <p>UMOJA Spark Trade provides the storefront technology and payment infrastructure. The seller of record for each order is {ownerName}.</p>
        <h4>Governing law</h4>
        <p>These terms are governed by the laws of the Republic of South Africa. Last updated {year}.</p>
      </>
    ),
    privacy: (
      <>
        <p>This Privacy Policy explains how <strong>{storeName}</strong> handles your personal information in line with the Protection of Personal Information Act (POPIA).</p>
        <h4>What we collect</h4>
        <p>When you place an order or contact us we may collect: your name, delivery address, email, phone number, and order history. Payment card details are handled directly by Paystack and never stored by us.</p>
        <h4>How we use it</h4>
        <p>To process and deliver your orders, provide customer support, send order updates, and comply with legal obligations.</p>
        <h4>Who we share it with</h4>
        <p>Only trusted service providers required to fulfil your order — including Paystack (payments), delivery partners, and the UMOJA Spark Trade platform which hosts this store.</p>
        <h4>Your rights</h4>
        <p>You may request access to, correction of, or deletion of your personal information at any time by contacting us.</p>
        <h4>Retention &amp; security</h4>
        <p>We keep order records for the period required by South African tax and consumer law, and apply reasonable technical safeguards to protect your data.</p>
        <p className="text-xs text-muted-foreground">Contact for privacy requests: {contactLine || "via the storefront share bar."}</p>
      </>
    ),
    returns: (
      <>
        <p><strong>{storeName}</strong> wants you to be happy with your purchase.</p>
        <h4>Faulty or incorrect items</h4>
        <p>If your item arrives damaged, defective or different from what was ordered, contact us within 7 days of delivery. We will arrange a replacement, repair or refund in line with the Consumer Protection Act.</p>
        <h4>Change of mind</h4>
        <p>Unused items in original packaging may be returned within 7 days of delivery. Return shipping is at your cost unless the item was faulty.</p>
        <h4>Refunds</h4>
        <p>Approved refunds are paid back to the original payment method via Paystack, typically within 5–10 business days of us receiving the returned item.</p>
        <h4>Non-returnable items</h4>
        <p>Personalised, perishable or hygiene-sensitive items cannot be returned unless faulty.</p>
        <h4>How to start a return</h4>
        <p>Message us on WhatsApp or email with your order details and a short description (plus a photo if the item is damaged).</p>
      </>
    ),
    contact: (
      <>
        <p>Questions, order updates or support requests — reach {ownerName} directly:</p>
        <ul>
          {ownerEmail && <li><strong>Email:</strong> <a href={`mailto:${ownerEmail}`} className="underline" style={{ color: accent }}>{ownerEmail}</a></li>}
          {ownerPhone && <li><strong>WhatsApp / phone:</strong> {ownerPhone}</li>}
          {!ownerEmail && !ownerPhone && <li>Use the WhatsApp share button at the bottom of the storefront.</li>}
        </ul>
        <p className="text-xs text-muted-foreground">Store: {storeName} · Platform: UMOJA Spark Trade</p>
      </>
    ),
  };

  const titles: Record<PolicyKey, string> = {
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    returns: "Returns & Refund Policy",
    contact: `Contact ${storeName}`,
  };

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 mt-10">
        <div className="border-t border-border/60 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Store policies" className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {links.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setOpen(l.key)}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-smooth"
              >
                {l.icon}
                {l.label}
              </button>
            ))}
          </nav>
          <p className="text-[11px] text-muted-foreground">
            © {year} {storeName}. Operated by {ownerName} on UMOJA Spark Trade.
          </p>
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{titles[open]}</DialogTitle>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-3 [&_h4]:font-display [&_h4]:text-base [&_h4]:mt-4 [&_h4]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                {content[open]}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
