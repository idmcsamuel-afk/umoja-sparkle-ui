import { useEffect, useState } from "react";
import { Copy, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BankAccountProject = "circle" | "spark_trade" | "drive" | "property" | "buyers_club";

interface Account {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_holder: string;
}

const COL: Record<BankAccountProject, string> = {
  circle: "for_circle",
  spark_trade: "for_spark_trade",
  drive: "for_drive",
  property: "for_property",
  buyers_club: "for_buyers_club",
};

interface Props {
  project: BankAccountProject;
  reference: string;
}

export function BankAccountInfo({ project, reference }: Props) {
  const [acc, setAcc] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1. Try project-specific account
      const { data: byProj } = await (supabase as any)
        .from("bank_accounts")
        .select("*")
        .eq(COL[project], true)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byProj) { setAcc(byProj); setLoading(false); return; }
      // 2. Fall back to default
      const { data: dflt } = await (supabase as any)
        .from("bank_accounts")
        .select("*")
        .eq("is_default", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      setAcc(dflt ?? null);
      setLoading(false);
    })();
  }, [project]);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">Loading bank details…</div>;
  }
  if (!acc) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
        No bank account configured for this project. Please contact support.
      </div>
    );
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <button
      type="button"
      onClick={() => copy(label, value)}
      className="w-full flex items-center justify-between py-2 text-left hover:bg-secondary/40 -mx-2 px-2 rounded-lg transition-colors"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-mono">
        {value}
        <Copy className="h-3 w-3 text-muted-foreground" />
      </span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="h-4 w-4 text-accent" />
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pay via EFT</p>
      </div>
      <Row label="Bank" value={acc.bank_name} />
      <Row label="Account holder" value={acc.account_holder} />
      <Row label="Account number" value={acc.account_number} />
      <Row label="Branch code" value={acc.branch_code} />
      <div className="border-t border-border mt-2 pt-2">
        <Row label="Reference (use exactly)" value={reference} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        ⚠️ Use the reference above exactly so we can match your payment.
      </p>
    </div>
  );
}
