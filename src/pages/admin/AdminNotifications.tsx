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
import { Loader2, Send, RefreshCw, Mail, AlertCircle, CheckCircle2, BellRing, FileText, X } from "lucide-react";
import { toast } from "sonner";

const DRAFT_KEY = "email_draft";
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Audience = "all" | "circle" | "buyers_club" | "no_contribution" | "tier" | "custom";

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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<{ subject: string; body: string; timestamp: number } | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [bypassPrefs, setBypassPrefs] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(100);
  const [throttleMs, setThrottleMs] = useState(600);
  const [campaignProgress, setCampaignProgress] = useState<{ total: number; already_sent: number; remaining: number; next_batch_size: number } | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - parsed.timestamp < DRAFT_MAX_AGE_MS && (parsed.subject || parsed.body)) {
          setDraftPrompt(parsed);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    setDraftLoaded(true);
  }, []);

  // Auto-save draft every 3s after typing stops
  useEffect(() => {
    if (!draftLoaded || draftPrompt) return;
    if (!subject && !body) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, body, timestamp: Date.now() }));
      setLastSaved(new Date());
    }, 3000);
    return () => clearTimeout(timer);
  }, [subject, body, draftLoaded, draftPrompt]);

  const restoreDraft = () => {
    if (!draftPrompt) return;
    setSubject(draftPrompt.subject);
    setBody(draftPrompt.body);
    setLastSaved(new Date(draftPrompt.timestamp));
    setDraftPrompt(null);
  };
  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftPrompt(null);
    setLastSaved(null);
  };
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setLastSaved(null);
  };

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

  // Live recipient count preview for the currently selected segment.
  useEffect(() => {
    let cancelled = false;
    if (audience === "custom" && parsedIds.length === 0) { setAudienceCount(null); return; }
    setCountLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          action: "preview_recipients",
          audience,
          tier: audience === "tier" ? tier : undefined,
          member_ids: audience === "custom" ? parsedIds : undefined,
          bypass_prefs: bypassPrefs,
        },
      });
      if (cancelled) return;
      setCountLoading(false);
      if (error || !data?.ok) setAudienceCount(null);
      else setAudienceCount(data.recipient_count as number);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); setCountLoading(false); };
  }, [audience, tier, memberIds, bypassPrefs]);

  // Live batch/campaign progress preview (only meaningful for "all" audience).
  const loadCampaignProgress = async () => {
    if (audience !== "all" || !subject.trim()) { setCampaignProgress(null); return; }
    setProgressLoading(true);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: { preview: true, subject, campaign_id: subject, batch_size: batchSize },
    });
    setProgressLoading(false);
    if (error || !data || data.error) { setCampaignProgress(null); return; }
    setCampaignProgress({
      total: data.total, already_sent: data.already_sent,
      remaining: data.remaining, next_batch_size: data.next_batch_size,
    });
  };
  useEffect(() => {
    const t = setTimeout(loadCampaignProgress, 400);
    return () => clearTimeout(t);
  }, [audience, subject, batchSize]);


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

  // Runs the REAL bulk-send route restricted to your own email, so you can
  // verify the exact rendering path that "Send to all" uses before broadcasting.
  const sendBulkTestToMe = async () => {
    if (!user?.email) return toast.error("No email on your account");
    if (!subject || !body) return toast.error("Subject and body required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: {
        subject, body,
        campaign_id: `test:${user.email}:${Date.now()}`,
        batch_size: 1,
        throttle_ms: 0,
        only_email: user.email,
      },
    });
    setBusy(false);
    if (error || !data || data.error) toast.error("Bulk test failed: " + (error?.message ?? data?.error));
    else { toast.success(`Bulk test sent to ${user.email} (${data.sent}/${data.batch_size})`); loadLogs(); }
  };

  const sendBlast = async () => {
    if (!subject || !body) return toast.error("Subject and body required");
    if (audience === "custom" && parsedIds.length === 0) return toast.error("Provide member IDs");

    setBusy(true);

    // For "all members" use the dedicated bulk endpoint (batched, dedup by campaign=subject).
    if (audience === "all") {
      const { data: preview, error: previewErr } = await supabase.functions.invoke("send-bulk-email", {
        body: { preview: true, subject, campaign_id: subject, batch_size: batchSize },
      });
      if (previewErr || !preview || preview.error) {
        setBusy(false);
        return toast.error("Could not load recipients: " + (previewErr?.message ?? preview?.error ?? "no members found"));
      }
      const nextN = preview.next_batch_size as number;
      if (nextN === 0) {
        setBusy(false);
        return toast.info(`All ${preview.total} recipients already received this campaign.`);
      }
      const msg = `Send next batch: ${nextN} email${nextN === 1 ? "" : "s"}\n\n` +
        `Progress: ${preview.already_sent} of ${preview.total} sent · ${preview.remaining} remaining\n` +
        `Throttle: ~${Math.round(60000 / Math.max(throttleMs, 1))}/min\n\n` +
        `Campaign key (subject): "${subject}"\nProceed?`;
      if (!confirm(msg)) { setBusy(false); return; }
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: { subject, body, campaign_id: subject, batch_size: batchSize, throttle_ms: throttleMs },
      });
      setBusy(false);
      if (error || !data || data.error) return toast.error("Send failed: " + (error?.message ?? data?.error));
      toast.success(`Sent ${data.sent}/${data.batch_size}${data.failed ? ` · ${data.failed} failed` : ""} · ${data.remaining} remaining`);
      if (data.failed > 0) console.warn("[bulk] failed emails:", data.failedEmails);
      loadLogs();
      loadCampaignProgress();
      return;
    }

    // Targeted audiences (circle/buyers_club/tier/custom) keep using send-email blast.
    const { data: preview, error: previewErr } = await supabase.functions.invoke("send-email", {
      body: {
        action: "preview_recipients", audience,
        tier: audience === "tier" ? tier : undefined,
        member_ids: audience === "custom" ? parsedIds : undefined,
        bypass_prefs: bypassPrefs,
      },
    });
    if (previewErr || !preview?.ok) {
      setBusy(false);
      return toast.error("Could not load recipients: " + (previewErr?.message ?? preview?.error));
    }
    const count = preview.recipient_count as number;
    if (count === 0) {
      setBusy(false);
      return toast.error(`No eligible recipients (total: ${preview.total_members}, after filter: ${preview.after_audience_filter}).`);
    }
    if (!confirm(`This email will be sent to ${count} member${count === 1 ? "" : "s"}.\n\nAudience: ${audience}${audience === "tier" ? " · " + tier : ""}${bypassPrefs ? "\nMarketing filter: BYPASSED (service message)" : ""}\n\nProceed?`)) {
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        action: "blast",
        subject, body_html: body, audience,
        tier: audience === "tier" ? tier : undefined,
        member_ids: audience === "custom" ? parsedIds : undefined,
        bypass_prefs: bypassPrefs,
      },
    });
    setBusy(false);
    if (error || !data?.ok) return toast.error("Blast failed: " + (error?.message ?? data?.error));
    const failures = (data.failures ?? []) as Array<{ email: string; error: string }>;
    toast.success(`Sent to ${data.sent}/${data.recipients}${data.failed ? ` · ${data.failed} failed` : ""}${data.suppressed ? ` · ${data.suppressed} suppressed` : ""}`);
    if (failures.length) {
      console.warn("[blast] failures:", failures);
      toast.error(`First failure: ${failures[0].email} — ${failures[0].error}`, { duration: 8000 });
    }
    clearDraft();
    loadLogs();
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

        {draftPrompt && (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 flex flex-wrap items-center gap-3">
            <FileText className="h-4 w-4 text-accent shrink-0" />
            <div className="flex-1 min-w-[180px] text-sm">
              <div className="font-medium">Draft found from {timeAgo(draftPrompt.timestamp)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {draftPrompt.subject || "(no subject)"}
              </div>
            </div>
            <Button size="sm" className="rounded-xl" onClick={restoreDraft}>Restore draft</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={discardDraft}>
              <X className="h-3 w-3" /> Discard
            </Button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Recipients</span>
              <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
                {countLoading ? "counting…" : audienceCount !== null ? `≈${audienceCount} members` : ""}
              </span>
            </Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                <SelectItem value="circle">Circle members only</SelectItem>
                <SelectItem value="buyers_club">Buyers Club only</SelectItem>
                <SelectItem value="no_contribution">Registered — no contribution yet</SelectItem>
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

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={bypassPrefs}
            onChange={(e) => setBypassPrefs(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">Send as service message (bypass marketing filter)</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              Use only for genuinely transactional/service emails (e.g. helping a member complete onboarding). Default OFF.
            </span>
          </span>
        </label>
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
          <p className="text-[11px] text-muted-foreground mt-1">Wraps automatically in dark green/gold UMOJA template. Marketing recipients filtered by member preference. Personalize with <code>{"{{first_name}}"}</code> or <code>{"{{name}}"}</code> in the subject or body — falls back to "there" if a member has no name on file.</p>
          {lastSaved && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Draft saved at {lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        {audience === "all" && (
          <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Batched sending (domain warm-up)</div>
              <Button size="sm" variant="ghost" onClick={loadCampaignProgress} className="rounded-xl h-7 text-xs" disabled={progressLoading || !subject.trim()}>
                <RefreshCw className={`h-3 w-3 ${progressLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Batch size</Label>
                <Input type="number" min={1} max={500} value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  className="mt-1 rounded-2xl" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Delay between emails (ms)
                </Label>
                <Input type="number" min={0} max={10000} step={100} value={throttleMs}
                  onChange={(e) => setThrottleMs(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))}
                  className="mt-1 rounded-2xl" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  ≈ {throttleMs > 0 ? Math.round(60000 / throttleMs) : "∞"} emails/min
                </p>
              </div>
            </div>
            {subject.trim() ? (
              campaignProgress ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
                  <div className="font-medium">
                    Sent {campaignProgress.already_sent} of {campaignProgress.total} — {campaignProgress.remaining} remaining
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Next batch will send to {campaignProgress.next_batch_size} recipient{campaignProgress.next_batch_size === 1 ? "" : "s"} who haven't received this campaign yet.
                    Campaign is tracked by subject: <code className="text-[11px]">"{subject}"</code>
                  </div>
                  {campaignProgress.total > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((campaignProgress.already_sent / campaignProgress.total) * 100)}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">{progressLoading ? "Loading progress…" : "No progress data yet."}</div>
              )
            ) : (
              <div className="text-xs text-muted-foreground">Enter a subject to see progress. Dedup key = subject line.</div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sendTest} disabled={busy} className="rounded-2xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send Test to Myself
          </Button>
          <Button variant="outline" onClick={sendBulkTestToMe} disabled={busy} className="rounded-2xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Bulk Test (only me)
          <Button onClick={sendBlast} disabled={busy} className="rounded-2xl bg-gradient-gold text-amber-950">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {audience === "all" && campaignProgress
              ? ` Send next batch (${campaignProgress.next_batch_size})`
              : " Send to Recipients"}
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
