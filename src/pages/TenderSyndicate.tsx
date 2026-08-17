import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Handshake, Send, Upload, FileText, Users, Check, X, UserPlus,
  ShieldAlert, Download, Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, formatTenderValue } from "@/lib/tenders";

const BUCKET = "tender-syndicate-docs";

type SyndicateMember = {
  member_id: string;
  full_name: string | null;
  province: string | null;
  role: "originator" | "member";
  status: "invited" | "applied" | "accepted" | "declined" | "removed";
  brings_tags: string[] | null;
  brings_note: string | null;
  joined_at: string | null;
};

type Room = {
  id: string;
  name: string | null;
  status: string;
  summary: string | null;
  created_at: string;
  is_originator: boolean;
  tender: {
    id: string;
    title: string | null;
    description: string | null;
    buyer_name: string | null;
    province: string | null;
    closing_at: string | null;
    value_amount: number | null;
    value_currency: string | null;
  };
  members: SyndicateMember[];
};

type Message = { id: string; member_id: string; full_name: string | null; body: string; created_at: string };
type Doc = { id: string; member_id: string; full_name: string | null; file_ref: string; file_name: string; created_at: string };
type Partner = { member_id: string; full_name: string | null; province: string | null; brings: string | null; brings_tags: string[] | null };

export default function TenderSyndicate() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.rpc("get_tender_syndicate", { p_syndicate_id: id });
    const r = (data as unknown as Room | null) ?? null;
    setRoom(r);
    if (r) {
      const [msgRes, docRes] = await Promise.all([
        supabase.rpc("tender_syndicate_thread", { p_syndicate_id: id }),
        supabase.rpc("tender_syndicate_docs", { p_syndicate_id: id }),
      ]);
      setMessages((msgRes.data as Message[] | null) ?? []);
      setDocs((docRes.data as Doc[] | null) ?? []);
      if (r.is_originator) {
        const { data: p } = await supabase.rpc("tender_open_partners", { p_tender_id: r.tender.id });
        setPartners((p as Partner[] | null) ?? []);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const post = async () => {
    if (!id || !body.trim()) return;
    setPosting(true);
    const { error } = await supabase.rpc("post_tender_syndicate_message", { p_syndicate_id: id, p_body: body });
    setPosting(false);
    if (error) { toast.error(error.message || "Could not post"); return; }
    setBody("");
    await load();
  };

  const upload = async (file: File) => {
    if (!id) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) { setUploading(false); toast.error(upErr.message || "Upload failed"); return; }
    const { error } = await supabase.rpc("add_tender_syndicate_document", {
      p_syndicate_id: id, p_file_ref: path, p_file_name: file.name,
    });
    setUploading(false);
    if (error) { toast.error(error.message || "Could not record document"); return; }
    toast.success("Document shared with the room");
    await load();
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_ref, 60);
    if (error || !data) { toast.error("Could not open document"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const respond = async (memberId: string, action: "accept" | "decline" | "remove") => {
    if (!id) return;
    setBusy(memberId + action);
    const { error } = await supabase.rpc("respond_tender_syndicate_member", {
      p_syndicate_id: id, p_member_id: memberId, p_action: action,
    });
    setBusy(null);
    if (error) { toast.error(error.message || "Action failed"); return; }
    await load();
  };

  const invite = async (memberId: string) => {
    if (!id) return;
    setBusy(memberId + "invite");
    const { error } = await supabase.rpc("invite_to_tender_syndicate", { p_syndicate_id: id, p_member_id: memberId });
    setBusy(null);
    if (error) { toast.error(error.message || "Could not invite"); return; }
    toast.success("Invitation sent");
    await load();
  };

  const setStatus = async (status: "forming" | "closed" | "withdrawn") => {
    if (!id) return;
    setBusy("status");
    const { error } = await supabase.rpc("set_tender_syndicate_status", { p_syndicate_id: id, p_status: status });
    setBusy(null);
    if (error) { toast.error(error.message || "Could not update"); return; }
    await load();
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <Card className="p-8 text-center space-y-4">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          {user
            ? "This Syndicate room is private to its accepted members."
            : "Sign in to see your Syndicate rooms."}
        </p>
        <Button asChild variant="outline"><Link to="/tenders">Back to tenders</Link></Button>
      </Card>
    );
  }

  const accepted = room.members.filter((m) => m.status === "accepted");
  const pending = room.members.filter((m) => m.status === "applied" || m.status === "invited");
  const inRoomIds = new Set(room.members.map((m) => m.member_id));
  const value = formatTenderValue(room.tender.value_amount, room.tender.value_currency);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to={`/tenders/${room.tender.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tender
      </Link>

      <Card className="p-5 space-y-3 border-partner/40 bg-partner/5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-partner/20 text-partner ring-1 ring-partner/40">
              <Handshake className="h-4 w-4" />
            </span>
            <div>
              <h1 className="font-display text-lg leading-snug">{room.name ?? "Syndicate"}</h1>
              <p className="text-xs text-muted-foreground capitalize">{room.status} · {accepted.length} members</p>
            </div>
          </div>
          {room.is_originator && (
            <div className="flex gap-2">
              {room.status === "forming" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("closed")} disabled={busy === "status"}>
                  Close to new members
                </Button>
              ) : room.status === "closed" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus("forming")} disabled={busy === "status"}>
                  Reopen
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-medium">{room.tender.description || room.tender.title}</p>
          <p className="text-xs text-muted-foreground">
            {room.tender.buyer_name ?? "—"}{room.tender.province ? ` · ${room.tender.province}` : ""}
            {room.tender.closing_at ? ` · closes ${formatDateTime(room.tender.closing_at)}` : ""}
            {value ? ` · ${value}` : ""}
          </p>
        </div>

        {room.summary && (
          <div className="rounded-xl bg-background/60 p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">What this opportunity needs</p>
            {room.summary}
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-start gap-3 border-dashed">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          UMOJA provides the space and tools to organise. Your consortium agreement and any payments
          are between members — UMOJA is not a party to them.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-medium inline-flex items-center gap-2"><Users className="h-4 w-4" /> Members</h2>
        <ul className="space-y-2">
          {accepted.map((m) => (
            <li key={m.member_id} className="rounded-xl border p-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {m.full_name ?? "Member"}
                  {m.province ? <span className="text-muted-foreground font-normal"> · {m.province}</span> : null}
                </p>
                <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
              </div>
              {m.brings_note && <p className="text-xs text-muted-foreground">{m.brings_note}</p>}
              {m.brings_tags && m.brings_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.brings_tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                  ))}
                </div>
              )}
              {room.is_originator && m.role !== "originator" && (
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => respond(m.member_id, "remove")} disabled={busy === m.member_id + "remove"}>
                  <X className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </li>
          ))}
        </ul>

        {room.is_originator && pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Pending</p>
            {pending.map((m) => (
              <div key={m.member_id} className="rounded-xl border border-dashed p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{m.full_name ?? "Member"}</p>
                  <Badge variant="secondary" className="text-[10px] capitalize">{m.status}</Badge>
                </div>
                {m.brings_note && <p className="text-xs text-muted-foreground">{m.brings_note}</p>}
                {m.status === "applied" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => respond(m.member_id, "accept")} disabled={busy === m.member_id + "accept"}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respond(m.member_id, "decline")} disabled={busy === m.member_id + "decline"}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {room.is_originator && room.status === "forming" && (
        <Card className="p-5 space-y-3">
          <div>
            <h2 className="font-medium">Suggested partners</h2>
            <p className="text-xs text-muted-foreground">
              Members who flagged “open to partner” on this tender. Contact details stay private.
            </p>
          </div>
          {partners.filter((p) => !inRoomIds.has(p.member_id)).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one else is open to partnering on this tender yet.</p>
          ) : (
            <ul className="space-y-2">
              {partners.filter((p) => !inRoomIds.has(p.member_id)).map((p) => (
                <li key={p.member_id} className="rounded-xl border p-3 space-y-1">
                  <p className="text-sm font-medium">
                    {p.full_name ?? "Member"}
                    {p.province ? <span className="text-muted-foreground font-normal"> · {p.province}</span> : null}
                  </p>
                  {p.brings && <p className="text-xs text-muted-foreground">{p.brings}</p>}
                  {p.brings_tags && p.brings_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.brings_tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => invite(p.member_id)} disabled={busy === p.member_id + "invite"}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Invite
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <h2 className="font-medium">Coordination thread</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet — start the conversation.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  {m.full_name ?? "Member"} · {formatDateTime(m.created_at)}
                </p>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write to the room…" />
          <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
            {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
            Post
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-medium">Documents</h2>
        <p className="text-xs text-muted-foreground">Shared with accepted members only.</p>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents shared yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{d.file_name}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => download(d)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
          Upload document
        </Button>
      </Card>
    </div>
  );
}
