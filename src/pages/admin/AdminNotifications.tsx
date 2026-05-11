import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, RefreshCw, Mail, AlertCircle, CheckCircle2, BellRing } from "lucide-react";
import { toast } from "sonner";

type Audience = "all" | "circle" | "buyers_club" | "tier" | "custom";

interface LogRow {
  id: string;
  recipient_email: string;
  template: string;
  subject: string;
  status: string;
  error: string | null;
  retry_count: number;
  created_at: string;
}

export default function AdminNotifications() {
  const { user, member } = useAuth();
  const [audience, setAudience] = useState<Audience>("all");
  const [tier, setTier] = useState("seed");
  const [memberIds, setMemberIds] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from("email_log")
      .select("id, recipient_email, template, subject, status, error, retry_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data ?? []) as LogRow[]);
    setLoadingLogs(false);
  };
  useEffect(() => { loadLogs(); }, []);

  const parsedIds = memberIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

  const sendTest = async () => {
    if (!user?.email) return toast.error("No email on your account");
    if (!subject || !body) return toast.error("Subject and body required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        action: "send",
        template: "custom",
        to: user.email,
        member_id: user.id,
        bypass_prefs: true,
        data: { subject, title: subject, body_html: body, name: member?.full_name },
      },
    });
    setBusy(false);
    if (error || !data?.ok) toast.error("Test failed: " + (error?.message ?? data?.error));
    else { toast.success("Test sent to " + user.email); loadLogs(); }
  };

  const sendBlast = async () => {
    if (!subject || !body) return toast.error("Subject and body required");
    if (audience === "custom" && parsedIds.length === 0) return toast.error("Provide member IDs");
    if (!confirm(`Send to ${audience}${audience === "tier" ? " · " + tier : ""}?`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        action: "blast",
        subject, body_html: body, audience,
        tier: audience === "tier" ? tier : undefined,
        member_ids: audience === "custom" ? parsedIds : undefined,
      },
    });
    setBusy(false);
    if (error || !data?.ok) toast.error("Blast failed: " + (error?.message ?? data?.error));
    else { toast.success(`Sent to ${data.sent}/${data.recipients} (failed ${data.failed})`); loadLogs(); }
  };

  const retry = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { action: "retry", log_id: id },
    });
    if (error || !data?.ok) toast.error("Retry failed: " + (error?.message ?? data?.error));
    else { toast.success("Retried"); loadLogs(); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl flex items-center gap-2"><BellRing className="h-6 w-6 text-accent" /> Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Send branded emails to UMOJA members and review delivery logs.</p>
      </div>

      <section className="rounded-3xl border border-border bg-gradient-card p-6 space-y-5">
        <h2 className="font-display text-xl flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /> Send Email to Members</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recipients</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                <SelectItem value="circle">Circle members only</SelectItem>
                <SelectItem value="buyers_club">Buyers Club only</SelectItem>
                <SelectItem value="tier">Specific tier</SelectItem>
                <SelectItem value="custom">Custom (member IDs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "tier" && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seed">Seed</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="harvest">Harvest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {audience === "custom" && (
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Member IDs (comma or newline)</Label>
            <Textarea value={memberIds} onChange={(e) => setMemberIds(e.target.value)} className="mt-1 rounded-2xl font-mono text-xs" rows={3} />
          </div>
        )}

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 rounded-2xl" placeholder="Important update from UMOJA" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body (HTML supported)</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 rounded-2xl" rows={8}
            placeholder="<p>Hi members,</p><p>Here is what's new...</p>" />
          <p className="text-[11px] text-muted-foreground mt-1">Wraps automatically in dark green/gold UMOJA template. Marketing recipients filtered by member preference.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendTest} disabled={busy} className="rounded-2xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send Test to Myself
          </Button>
          <Button onClick={sendBlast} disabled={busy} className="rounded-2xl bg-gradient-gold text-amber-950">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to Recipients
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Delivery log</h2>
          <Button variant="ghost" size="sm" onClick={loadLogs} className="rounded-2xl"><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-card overflow-x-auto">
          {loadingLogs ? (
            <div className="p-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No emails sent yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Recipient</th>
                  <th className="text-left p-3">Template</th>
                  <th className="text-left p-3">Subject</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-3 text-xs">{l.recipient_email}</td>
                    <td className="p-3 text-xs capitalize">{l.template.replace(/_/g, " ")}</td>
                    <td className="p-3 text-xs max-w-[220px] truncate">{l.subject}</td>
                    <td className="p-3">
                      {l.status === "sent" ? (
                        <Badge className="bg-primary/15 text-primary border-0"><CheckCircle2 className="h-3 w-3 mr-1" /> sent</Badge>
                      ) : l.status === "failed" ? (
                        <Badge className="bg-destructive/15 text-destructive border-0" title={l.error ?? ""}><AlertCircle className="h-3 w-3 mr-1" /> failed</Badge>
                      ) : l.status === "suppressed" ? (
                        <Badge variant="secondary">suppressed</Badge>
                      ) : (
                        <Badge variant="secondary">{l.status}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {l.status === "failed" && (
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => retry(l.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
