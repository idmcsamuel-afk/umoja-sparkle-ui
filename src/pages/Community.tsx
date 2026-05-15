import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Heart, MessageSquare, MoreVertical, Send, Sparkles, HelpCircle, Flame, Trophy, Trash2, Flag, Reply, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MsgType = "general" | "win" | "question" | "motivation" | "system";

interface Member {
  id: string;
  full_name: string;
  rank?: string | null;
  buyers_club_tier?: string | null;
  last_seen_at?: string | null;
}

interface ChatMsg {
  id: string;
  member_id: string | null;
  message: string;
  message_type: MsgType;
  parent_message_id: string | null;
  likes_count: number;
  is_deleted: boolean;
  created_at: string;
}

const TYPE_META: Record<Exclude<MsgType, "system">, { label: string; icon: any; border: string; bg: string }> = {
  general: { label: "General", icon: MessageSquare, border: "", bg: "" },
  win: { label: "Win", icon: Trophy, border: "border-l-4 border-l-emerald-500", bg: "bg-emerald-500/5" },
  question: { label: "Question", icon: HelpCircle, border: "border-l-4 border-l-sky-500", bg: "bg-sky-500/5" },
  motivation: { label: "Motivation", icon: Flame, border: "border-l-4 border-l-amber-500", bg: "bg-amber-500/5" },
};

const FILTERS: { id: "all" | Exclude<MsgType, "system">; label: string; emoji: string }[] = [
  { id: "all", label: "All messages", emoji: "🔥" },
  { id: "win", label: "Wins", emoji: "🎉" },
  { id: "question", label: "Questions", emoji: "❓" },
  { id: "motivation", label: "Motivation", emoji: "💪" },
];

const ONBOARDING_KEY = "umoja_community_onboarded";

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function badgeFor(member?: Member) {
  const tier = member?.buyers_club_tier;
  if (tier === "gold") return "🥇";
  if (tier === "silver") return "🥈";
  if (tier === "bronze") return "🥉";
  return null;
}

function initials(name?: string) {
  return (name || "M").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function colorFor(id: string) {
  const colors = ["bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-fuchsia-500"];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}

export default function Community() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | Exclude<MsgType, "system">>("all");
  const [composer, setComposer] = useState("");
  const [composerType, setComposerType] = useState<Exclude<MsgType, "system">>("general");
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [sending, setSending] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
  }, []);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled || !msgs) return;
      setMessages(msgs as ChatMsg[]);

      const ids = Array.from(new Set(msgs.map((m: any) => m.member_id).filter(Boolean)));
      if (ids.length) {
        const { data: mems } = await supabase
          .from("members")
          .select("id, full_name, rank, buyers_club_tier, last_seen_at")
          .in("id", ids as string[]);
        if (mems) {
          const map: Record<string, Member> = {};
          mems.forEach((m: any) => { map[m.id] = m; });
          setMembers(map);
        }
      }

      if (user) {
        const { data: likes } = await supabase
          .from("chat_likes")
          .select("message_id")
          .eq("member_id", user.id);
        if (likes) setMyLikes(new Set(likes.map((l: any) => l.message_id)));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Active members count
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("active_members_count");
      if (typeof data === "number") setActiveCount(data);
    };
    load();
    const t = setInterval(load, 30000);
    const touch = setInterval(() => { supabase.rpc("touch_last_seen"); }, 60000);
    supabase.rpc("touch_last_seen");
    return () => { clearInterval(t); clearInterval(touch); };
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("community-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const m = payload.new as ChatMsg;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.member_id && !members[m.member_id]) {
          const { data } = await supabase.from("members")
            .select("id, full_name, rank, buyers_club_tier, last_seen_at")
            .eq("id", m.member_id).maybeSingle();
          if (data) setMembers((p) => ({ ...p, [data.id]: data as Member }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as ChatMsg;
        setMessages((prev) => prev.map((x) => x.id === m.id ? m : x).filter((x) => !x.is_deleted));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        const old = payload.old as { id: string };
        setMessages((prev) => prev.filter((x) => x.id !== old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_likes" }, (payload) => {
        const row: any = payload.new || payload.old;
        if (!row) return;
        // refresh that message's count from server
        supabase.from("chat_messages").select("id, likes_count").eq("id", row.message_id).maybeSingle()
          .then(({ data }) => {
            if (data) setMessages((prev) => prev.map((x) => x.id === data.id ? { ...x, likes_count: data.likes_count } : x));
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [members]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const filtered = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => m.message_type === filter || m.message_type === "system");
  }, [messages, filter]);

  const onlineMembers = useMemo(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return Object.values(members)
      .filter((m) => m.last_seen_at && new Date(m.last_seen_at).getTime() > cutoff)
      .slice(0, 10);
  }, [members]);

  const send = async () => {
    if (!user || !composer.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      member_id: user.id,
      message: composer.trim().slice(0, 500),
      message_type: composerType,
      parent_message_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    setComposer("");
    setReplyTo(null);
  };

  const toggleLike = async (msg: ChatMsg) => {
    if (!user) return;
    if (myLikes.has(msg.id)) {
      setMyLikes((p) => { const n = new Set(p); n.delete(msg.id); return n; });
      await supabase.from("chat_likes").delete().eq("message_id", msg.id).eq("member_id", user.id);
    } else {
      setMyLikes((p) => new Set(p).add(msg.id));
      await supabase.from("chat_likes").insert({ message_id: msg.id, member_id: user.id });
    }
  };

  const deleteMsg = async (msg: ChatMsg) => {
    await supabase.from("chat_messages").delete().eq("id", msg.id);
  };

  const reportMsg = async (msg: ChatMsg) => {
    if (!user) return;
    const reason = prompt("Why are you reporting this message?") || "";
    const { error } = await supabase.from("chat_reports").insert({
      message_id: msg.id, reporter_id: user.id, reason,
    });
    if (error) toast({ title: "Could not report", description: error.message, variant: "destructive" });
    else toast({ title: "Reported", description: "An admin will review this message." });
  };

  const acceptOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }, []);

  const messagesById = useMemo(() => {
    const map: Record<string, ChatMsg> = {};
    messages.forEach((m) => { map[m.id] = m; });
    return map;
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border bg-card/30">
        <div className="p-4 border-b border-border space-y-3">
          <div>
            <h2 className="font-display text-lg">Community Chat</h2>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1.5 align-middle" />
              {activeCount} online now
            </p>
          </div>
          <EnablePushButton />
        </div>
        <div className="p-3 space-y-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                filter === f.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border flex-1 min-h-0">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Online now</p>
          <ScrollArea className="h-full">
            <div className="space-y-1">
              {onlineMembers.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">Quiet right now…</p>
              )}
              {onlineMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                  <div className={cn("relative h-7 w-7 rounded-full grid place-items-center text-[10px] font-semibold text-white", colorFor(m.id))}>
                    {initials(m.full_name)}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <span className="truncate">{m.full_name}</span>
                  {badgeFor(m) && <span className="text-xs">{badgeFor(m)}</span>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Main chat */}
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-border">
          <h1 className="font-display text-base">Community 💬</h1>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.emoji} {f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground mt-12">
              No messages yet. Be the first to say hi 👋
            </div>
          )}
          {filtered.map((m) => {
            if (m.message_type === "system") {
              return (
                <div key={m.id} className="text-center my-3">
                  <span className="inline-block text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1">
                    {m.message}
                  </span>
                </div>
              );
            }
            const author = m.member_id ? members[m.member_id] : undefined;
            const isMine = user && m.member_id === user.id;
            const liked = myLikes.has(m.id);
            const meta = TYPE_META[m.message_type as Exclude<MsgType, "system">];
            const Icon = meta.icon;
            const parent = m.parent_message_id ? messagesById[m.parent_message_id] : null;
            const parentAuthor = parent?.member_id ? members[parent.member_id] : null;
            return (
              <div key={m.id} className={cn("group rounded-lg p-3 flex gap-3", meta.border, meta.bg, "bg-card/60")}>
                <div className={cn("h-9 w-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold text-white", colorFor(m.member_id || m.id))}>
                  {initials(author?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{author?.full_name || "Member"}</span>
                    {badgeFor(author) && <span>{badgeFor(author)}</span>}
                    {m.message_type !== "general" && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{timeAgo(m.created_at)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(m.message)}>Copy</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => reportMsg(m)}>
                          <Flag className="h-4 w-4 mr-2" /> Report
                        </DropdownMenuItem>
                        {isMine && (
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMsg(m)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {parent && (
                    <div className="mt-1 mb-1 text-xs border-l-2 border-border pl-2 text-muted-foreground line-clamp-2">
                      <span className="font-medium">{parentAuthor?.full_name || "Member"}: </span>
                      {parent.message}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{m.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <button
                      onClick={() => toggleLike(m)}
                      className={cn("inline-flex items-center gap-1 hover:text-foreground transition-colors",
                        liked ? "text-rose-500" : "text-muted-foreground")}
                    >
                      <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
                      {m.likes_count > 0 && <span>{m.likes_count}</span>}
                    </button>
                    <button
                      onClick={() => setReplyTo(m)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5" /> Reply
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 bg-background">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
              <Reply className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Replying to</span>
              <span className="font-medium truncate flex-1">
                {(replyTo.member_id && members[replyTo.member_id]?.full_name) || "Member"}: {replyTo.message}
              </span>
              <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Select value={composerType} onValueChange={(v) => setComposerType(v as any)}>
              <SelectTrigger className="w-[140px] h-10 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">💬 General</SelectItem>
                <SelectItem value="win">🎉 Win</SelectItem>
                <SelectItem value="question">❓ Question</SelectItem>
                <SelectItem value="motivation">💪 Motivation</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Share with the community..."
              rows={1}
              className="min-h-[40px] max-h-32 resize-none flex-1"
            />
            <Button onClick={send} disabled={sending || !composer.trim()} size="icon" className="h-10 w-10 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground px-1">
            <span>Enter to send · Shift+Enter for new line</span>
            <span>{composer.length}/500</span>
          </div>
        </div>
      </section>

      <Dialog open={showOnboarding} onOpenChange={(o) => { if (!o) acceptOnboarding(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Welcome to the UMOJA Community!
            </DialogTitle>
            <DialogDescription>
              This is where members celebrate wins, ask for help, and stay motivated together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">Community guidelines</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Be respectful and supportive</li>
                <li>✓ Share wins, not just problems</li>
                <li>✓ Help others when you can</li>
                <li>✗ No spam or self-promotion</li>
                <li>✗ No offensive language</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={acceptOnboarding}>Got it, let's chat!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
