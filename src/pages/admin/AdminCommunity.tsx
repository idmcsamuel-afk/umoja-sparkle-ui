import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Volume2, VolumeX, Flag } from "lucide-react";

type ChatMsg = {
  id: string; member_id: string | null; message: string; message_type: string;
  likes_count: number; created_at: string; is_deleted: boolean;
};
type Member = { id: string; full_name: string; email: string | null };
type Report = {
  id: string; message_id: string; reporter_id: string; reason: string | null;
  status: string; created_at: string;
};

const MUTE_OPTIONS: Record<string, number> = { "1h": 1, "24h": 24, "7d": 168 };

export default function AdminCommunity() {
  const [tab, setTab] = useState("overview");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, activeAuthors: 0 });

  const load = async () => {
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (msgs) setMessages(msgs as ChatMsg[]);

    const ids = Array.from(new Set((msgs || []).map((m: any) => m.member_id).filter(Boolean)));
    if (ids.length) {
      const { data: mems } = await supabase
        .from("members").select("id, full_name, email").in("id", ids as string[]);
      if (mems) {
        const map: Record<string, Member> = {};
        mems.forEach((m: any) => { map[m.id] = m; });
        setMembers(map);
      }
    }

    const { data: reps } = await supabase
      .from("chat_reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (reps) setReports(reps as Report[]);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const today = (msgs || []).filter((m: any) => now - new Date(m.created_at).getTime() < day).length;
    const week = (msgs || []).filter((m: any) => now - new Date(m.created_at).getTime() < 7 * day).length;
    const month = (msgs || []).filter((m: any) => now - new Date(m.created_at).getTime() < 30 * day).length;
    const activeAuthors = new Set(
      (msgs || []).filter((m: any) => now - new Date(m.created_at).getTime() < day).map((m: any) => m.member_id),
    ).size;
    setStats({ today, week, month, activeAuthors });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("admin-community-" + Math.random().toString(36).slice(2, 9))
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reports" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => { counts[m.message_type] = (counts[m.message_type] || 0) + 1; });
    return counts;
  }, [messages]);

  const topAuthors = useMemo(() => {
    const map: Record<string, number> = {};
    messages.forEach((m) => { if (m.member_id) map[m.member_id] = (map[m.member_id] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [messages]);

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Message deleted" }); load(); }
  };

  const muteMember = async (memberId: string, hours: number) => {
    const muted_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("chat_mutes").insert({ member_id: memberId, muted_until });
    if (error) toast({ title: "Mute failed", description: error.message, variant: "destructive" });
    else toast({ title: "Member muted", description: `Until ${new Date(muted_until).toLocaleString()}` });
  };

  const unmuteMember = async (memberId: string) => {
    const { error } = await supabase.from("chat_mutes").delete().eq("member_id", memberId);
    if (error) toast({ title: "Unmute failed", description: error.message, variant: "destructive" });
    else toast({ title: "Member unmuted" });
  };

  const resolveReport = async (id: string, status: "dismissed" | "actioned") => {
    await supabase.from("chat_reports").update({ status }).eq("id", id);
    load();
  };

  const postSystem = async (text: string) => {
    const { error } = await supabase.from("chat_messages").insert({
      message: text, message_type: "system", member_id: null,
    });
    if (error) toast({ title: "Post failed", description: error.message, variant: "destructive" });
    else toast({ title: "System message posted" });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl">Community Moderation</h1>
        <p className="text-sm text-muted-foreground">Monitor, moderate and engage the chat.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feed">Live feed</TabsTrigger>
          <TabsTrigger value="reports">
            Reports {reports.length > 0 && <span className="ml-1 text-xs">({reports.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Today", v: stats.today },
              { label: "This week", v: stats.week },
              { label: "This month", v: stats.month },
              { label: "Active authors (24h)", v: stats.activeAuthors },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-display mt-1">{s.v}</div>
              </Card>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-medium mb-2">Message types</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(typeBreakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="capitalize">{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-medium mb-2">Most engaged members</h3>
              <div className="space-y-1 text-sm">
                {topAuthors.map(([id, count]) => (
                  <div key={id} className="flex justify-between">
                    <span>{members[id]?.full_name || "Member"}</span>
                    <span>{count} msgs</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feed" className="mt-4">
          <Card className="divide-y divide-border">
            {messages.map((m) => (
              <div key={m.id} className="p-3 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {m.member_id ? (members[m.member_id]?.full_name || "Member") : "System"}
                    </span>
                    {" · "}{new Date(m.created_at).toLocaleString()}
                    {" · "}<span className="capitalize">{m.message_type}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
                <div className="flex items-center gap-1">
                  {m.member_id && (
                    <Select onValueChange={(v) => v === "unmute" ? unmuteMember(m.member_id!) : muteMember(m.member_id!, MUTE_OPTIONS[v])}>
                      <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="Mute" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h"><VolumeX className="h-3 w-3 inline mr-1" />1 hour</SelectItem>
                        <SelectItem value="24h"><VolumeX className="h-3 w-3 inline mr-1" />24 hours</SelectItem>
                        <SelectItem value="7d"><VolumeX className="h-3 w-3 inline mr-1" />7 days</SelectItem>
                        <SelectItem value="unmute"><Volume2 className="h-3 w-3 inline mr-1" />Unmute</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteMessage(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {messages.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No messages yet.</div>}
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card className="divide-y divide-border">
            {reports.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">No pending reports 🎉</div>
            )}
            {reports.map((r) => {
              const msg = messages.find((m) => m.id === r.message_id);
              return (
                <div key={r.id} className="p-3 space-y-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Flag className="h-3 w-3" /> Reported {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.reason && <p className="text-xs italic">Reason: {r.reason}</p>}
                  <div className="text-sm bg-muted/40 rounded p-2">
                    {msg ? (<><span className="font-medium">{msg.member_id && members[msg.member_id]?.full_name}: </span>{msg.message}</>)
                         : <span className="text-muted-foreground">Message removed</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "dismissed")}>Dismiss</Button>
                    {msg && <Button size="sm" variant="destructive" onClick={async () => { await deleteMessage(msg.id); resolveReport(r.id, "actioned"); }}>
                      Delete message
                    </Button>}
                    {msg?.member_id && <Button size="sm" variant="outline" onClick={async () => { await muteMember(msg.member_id!, 24); resolveReport(r.id, "actioned"); }}>
                      Mute author 24h
                    </Button>}
                  </div>
                </div>
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="mt-4 space-y-3">
          <Card className="p-4 space-y-2">
            <h3 className="font-medium">Post a system message</h3>
            <p className="text-xs text-muted-foreground">Appears centered in the chat.</p>
            <SystemPoster onPost={postSystem} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SystemPoster({ onPost }: { onPost: (t: string) => Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Circles are OPEN! Place your bid at /circle"
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
      />
      <Button onClick={async () => { if (text.trim()) { await onPost(text.trim()); setText(""); } }} disabled={!text.trim()}>
        Post
      </Button>
    </div>
  );
}
