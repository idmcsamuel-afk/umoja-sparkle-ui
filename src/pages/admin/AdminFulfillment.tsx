import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const fmtR = (n: number) => "R" + Math.round(n).toLocaleString("en-ZA");

export default function AdminFulfillment() {
  const { toast } = useToast();
  const [pending, setPending] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, any>>({});
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: apps }, { data: subs }] = await Promise.all([
      supabase.from("fulfillment_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("fulfillment_subscriptions").select("*").eq("status", "active").order("activated_at", { ascending: false }),
    ]);
    const ids = Array.from(new Set([...(apps ?? []), ...(subs ?? [])].map((r) => r.member_id)));
    if (ids.length) {
      const { data: members } = await supabase.from("members").select("id, full_name, email, rank").in("id", ids);
      setMemberMap(Object.fromEntries((members ?? []).map((m) => [m.id, m])));
    }
    setPending((apps ?? []).filter((a) => a.status === "pending"));
    setActive(subs ?? []);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_approve_fulfillment", { _application_id: id });
    setBusy(false);
    if (error) { toast({ title: "Approval failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Application approved! Member notified." });
    setReviewing(null);
    load();
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_reject_fulfillment", { _application_id: id, _reason: rejectReason });
    setBusy(false);
    if (error) { toast({ title: "Rejection failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Application rejected." });
    setRejectReason("");
    setReviewing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Fulfilled by UMOJA</h1>
        <p className="text-sm text-muted-foreground">Manage Gold member fulfillment applications and active subscriptions.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending applications</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending applications.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Member</TableHead><TableHead>Applied</TableHead><TableHead>Volume</TableHead>
                    <TableHead>Amazon</TableHead><TableHead>Takealot</TableHead><TableHead>Makro</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pending.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{memberMap[a.member_id]?.full_name ?? "—"}</div>
                          <Badge variant="secondary" className="text-[10px]">Gold</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{a.expected_volume}</TableCell>
                        <TableCell>{a.has_amazon ? "Y" : "N"}</TableCell>
                        <TableCell>{a.has_takealot ? "Y" : "N"}</TableCell>
                        <TableCell>{a.has_makro ? "Y" : "N"}</TableCell>
                        <TableCell><Button size="sm" onClick={() => setReviewing(a)}>Review</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader><CardTitle className="text-base">Active fulfillments</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {active.length === 0 ? <p className="text-sm text-muted-foreground">No active subscriptions.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Member</TableHead><TableHead>Activated</TableHead><TableHead>Monthly fee</TableHead><TableHead>Next billing</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {active.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{memberMap[s.member_id]?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(s.activated_at).toLocaleDateString()}</TableCell>
                        <TableCell>{fmtR(Number(s.monthly_fee))}</TableCell>
                        <TableCell className="text-xs">{new Date(s.next_billing_date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review application</DialogTitle>
            <DialogDescription>{reviewing && memberMap[reviewing.member_id]?.full_name}</DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <Section title="Marketplace accounts">
                <p>Amazon: {reviewing.has_amazon ? `✓ ${reviewing.amazon_seller_id ?? ""}` : reviewing.needs_amazon ? "Needs help" : "—"}</p>
                <p>Takealot: {reviewing.has_takealot ? `✓ ${reviewing.takealot_seller_id ?? ""}` : reviewing.needs_takealot ? "Needs help" : "—"}</p>
                <p>Makro: {reviewing.has_makro ? `✓ ${reviewing.makro_seller_id ?? ""}` : reviewing.needs_makro ? "Needs help" : "—"}</p>
              </Section>
              <Section title="Business">
                <p>Volume: {reviewing.expected_volume}</p>
                <p>Categories: {(reviewing.product_categories ?? []).join(", ")}{reviewing.other_category ? `, ${reviewing.other_category}` : ""}</p>
              </Section>
              <Section title="Banking">
                <p>{reviewing.bank_name} · {reviewing.account_type}</p>
                <p className="font-mono text-xs">Acc: {reviewing.account_number} · Branch: {reviewing.branch_code}</p>
              </Section>
              <div className="space-y-2 pt-2">
                <Textarea placeholder="Rejection reason (only required if rejecting)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => approve(reviewing.id)} disabled={busy} className="flex-1">Approve</Button>
                  <Button variant="destructive" onClick={() => reject(reviewing.id)} disabled={busy} className="flex-1">Reject</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
