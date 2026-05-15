import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Play, Pencil, Clock, Zap } from "lucide-react";

type Auto = {
  id: string;
  name: string;
  message_type: string;
  trigger_type: string;
  trigger_config: any;
  message_template: string;
  target_audience: string | null;
  channels: any;
  enabled: boolean;
  last_triggered_at: string | null;
};
type Sched = {
  id: string;
  automated_message_id: string | null;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  recipient_count: number | null;
  channel: string | null;
  error: string | null;
  delivery_stats: Record<string, { sent: number; failed: number }> | null;
  created_at?: string;
};

export default function AdminAutomations() {
  const [autos, setAutos] = useState<Auto[]>([]);
  const [logs, setLogs] = useState<Sched[]>([]);
  const [editing, setEditing] = useState<Auto | null>(null);
  const [tab, setTab] = useState("active");
  const [running, setRunning] = useState(false);

  const load = async () => {
    const { data: a } = await supabase
      .from("automated_messages")
      .select("*")
      .order("trigger_type", { ascending: true })
      .order("name", { ascending: true });
    if (a) setAutos(a as Auto[]);
    const { data: l } = await supabase
      .from("scheduled_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (l) setLogs(l as Sched[]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("admin-automations")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "automated_messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggle = async (a: Auto) => {
    await supabase.from("automated_messages").update({ enabled: !a.enabled }).eq("id", a.id);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("automated_messages")
      .update({
        name: editing.name,
        message_template: editing.message_template,
        trigger_config: editing.trigger_config,
        channels: editing.channels,
        target_audience: editing.target_audience,
      })
      .eq("id", editing.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); setEditing(null); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("automation-cron");
      if (error) throw error;
      toast({ title: "Cron run", description: `Fired: ${(data?.fired || []).length}` });
    } catch (e: any) {
      toast({ title: "Run failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
      load();
    }
  };

  const sumChan = (key: "chat" | "push", which: "sent" | "failed") =>
    logs.reduce((n, l) => n + (l.delivery_stats?.[key]?.[which] || 0), 0);

  const stats = {
    today: logs.filter((l) => Date.now() - new Date(l.scheduled_for).getTime() < 24 * 3600 * 1000).length,
    week: logs.filter((l) => Date.now() - new Date(l.scheduled_for).getTime() < 7 * 24 * 3600 * 1000).length,
    failed: logs.filter((l) => l.status === "failed").length,
    chatSent: sumChan("chat", "sent"),
    chatFailed: sumChan("chat", "failed"),
    pushSent: sumChan("push", "sent"),
    pushFailed: sumChan("push", "failed"),
  };

  const sendTestPush = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { title: "UMOJA test", message: "Push delivery is working ✅", url: "/community" },
      });
      if (error) throw error;
      toast({ title: "Test push sent", description: `${data?.sent || 0}/${data?.total || 0} devices` });
    } catch (e: any) {
      toast({ title: "Push failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Automations</h1>
          <p className="text-sm text-muted-foreground">Time-based reminders and event-based engagement messages.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runNow} disabled={running}>
            <Play className="h-4 w-4 mr-2" /> Run cron now
          </Button>
          <Button variant="outline" onClick={sendTestPush}>
            <Zap className="h-4 w-4 mr-2" /> Test push
          </Button>
        </div>
      </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Automations ({autos.length})</TabsTrigger>
          <TabsTrigger value="log">Delivery log</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {autos.map((a) => (
            <Card key={a.id} className="p-4 flex items-start gap-3">
              <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {a.trigger_type === "time_based" ? <Clock className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    {a.trigger_type === "time_based" ? a.trigger_config?.time : a.trigger_config?.event}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {a.message_type}
                  </span>
                  {Array.isArray(a.channels) && a.channels.map((c: string) => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c}</span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.message_template}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last fired: {a.last_triggered_at ? new Date(a.last_triggered_at).toLocaleString() : "never"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card className="divide-y divide-border">
            {logs.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No deliveries yet.</div>}
            {logs.map((l) => {
              const auto = autos.find((a) => a.id === l.automated_message_id);
              return (
                <div key={l.id} className="p-3 flex items-center gap-3 text-sm">
                  <span className={
                    l.status === "sent" ? "text-emerald-500" :
                    l.status === "failed" ? "text-destructive" : "text-muted-foreground"
                  }>●</span>
                  <span className="font-medium flex-1 truncate">{auto?.name || "—"}</span>
                  <span className="text-xs text-muted-foreground">{l.channel}</span>
                  <span className="text-xs text-muted-foreground">{l.recipient_count ?? 0} recipients</span>
                  <span className="text-xs text-muted-foreground">{new Date(l.scheduled_for).toLocaleString()}</span>
                </div>
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">Sent (24h)</div><div className="text-2xl font-display mt-1">{stats.today}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Sent (7d)</div><div className="text-2xl font-display mt-1">{stats.week}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">Failed</div><div className="text-2xl font-display mt-1">{stats.failed}</div></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit automation</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Message template</label>
                <Textarea
                  rows={5}
                  value={editing.message_template}
                  onChange={(e) => setEditing({ ...editing, message_template: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Variables: {"{member_name} {member_count} {remaining_members} {tier} {referral_count}"}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Trigger config (JSON)</label>
                <Textarea
                  rows={4}
                  className="font-mono text-xs"
                  value={JSON.stringify(editing.trigger_config, null, 2)}
                  onChange={(e) => {
                    try { setEditing({ ...editing, trigger_config: JSON.parse(e.target.value) }); } catch { /* keep typing */ }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Channels (comma-separated)</label>
                <Input
                  value={Array.isArray(editing.channels) ? editing.channels.join(",") : ""}
                  onChange={(e) => setEditing({ ...editing, channels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
