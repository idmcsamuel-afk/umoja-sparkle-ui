import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Plus, Pencil, Trash2, ChevronDown, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

type Chapter = { time: string; title: string };
type RelLink = { text: string; url: string };

type Episode = {
  id: string;
  title: string;
  description: string;
  audio_url: string | null;
  cover_image_url: string | null;
  duration_seconds: number;
  episode_number: number | null;
  status: "draft" | "published";
  published_at: string | null;
  timestamps_json: Chapter[];
  takeaways: string[];
  related_links_json: RelLink[];
  play_count: number;
  created_at: string;
};

const emptyForm = {
  id: "" as string | null,
  title: "",
  description: "",
  audio_url: "" as string | null,
  cover_image_url: "" as string | null,
  duration_seconds: 0,
  episode_number: null as number | null,
  status: "draft" as "draft" | "published",
  published_at: "" as string,
  timestamps_json: [] as Chapter[],
  takeaways: [] as string[],
  related_links_json: [] as RelLink[],
};

function fmtDur(s: number) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

async function detectDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = url;
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      resolve(isFinite(d) ? Math.round(d) : 0);
    };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

export default function AdminPodcasts() {
  const [list, setList] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Episode | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("podcast_episodes" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message });
    setList((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...emptyForm, published_at: new Date().toISOString().slice(0, 16) });
    setAudioFile(null); setCoverFile(null); setAdvancedOpen(false); setProgress(0);
    setOpen(true);
  };

  const openEdit = (ep: Episode) => {
    setForm({
      id: ep.id,
      title: ep.title,
      description: ep.description ?? "",
      audio_url: ep.audio_url,
      cover_image_url: ep.cover_image_url,
      duration_seconds: ep.duration_seconds ?? 0,
      episode_number: ep.episode_number,
      status: ep.status,
      published_at: ep.published_at ? new Date(ep.published_at).toISOString().slice(0, 16) : "",
      timestamps_json: Array.isArray(ep.timestamps_json) ? ep.timestamps_json : [],
      takeaways: Array.isArray(ep.takeaways) ? ep.takeaways : [],
      related_links_json: Array.isArray(ep.related_links_json) ? ep.related_links_json : [],
    });
    setAudioFile(null); setCoverFile(null); setAdvancedOpen(false); setProgress(0);
    setOpen(true);
  };

  const uploadFile = async (bucket: string, file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const save = async (publish: boolean) => {
    if (!form.title.trim()) { toast({ title: "Title required" }); return; }
    setUploading(true);
    try {
      let audio_url = form.audio_url;
      let cover_image_url = form.cover_image_url;
      let duration_seconds = form.duration_seconds;

      if (audioFile) {
        setProgress(20);
        duration_seconds = await detectDuration(audioFile);
        setProgress(40);
        audio_url = await uploadFile("podcast-episodes", audioFile);
        setProgress(70);
      }
      if (coverFile) {
        cover_image_url = await uploadFile("podcast-covers", coverFile);
        setProgress(85);
      }

      if (!audio_url && !form.id) { toast({ title: "Audio file required" }); setUploading(false); return; }

      const status = publish ? "published" : form.status;
      const published_at = status === "published"
        ? (form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString())
        : null;

      const payload: any = {
        title: form.title,
        description: form.description,
        audio_url,
        cover_image_url,
        duration_seconds,
        episode_number: form.episode_number,
        status,
        published_at,
        timestamps_json: form.timestamps_json,
        takeaways: form.takeaways.filter(Boolean),
        related_links_json: form.related_links_json.filter(l => l.url),
      };

      if (form.id) {
        const { error } = await supabase.from("podcast_episodes" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id;
        const { error } = await supabase.from("podcast_episodes" as any).insert(payload);
        if (error) throw error;
      }
      setProgress(100);
      toast({ title: form.id ? "Episode updated" : "Episode created" });
      setOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      // Best-effort: delete audio file
      if (confirmDel.audio_url) {
        const p = confirmDel.audio_url.split("/podcast-episodes/")[1];
        if (p) await supabase.storage.from("podcast-episodes").remove([p]);
      }
      if (confirmDel.cover_image_url) {
        const p = confirmDel.cover_image_url.split("/podcast-covers/")[1];
        if (p) await supabase.storage.from("podcast-covers").remove([p]);
      }
      const { error } = await supabase.from("podcast_episodes" as any).delete().eq("id", confirmDel.id);
      if (error) throw error;
      toast({ title: "Episode deleted" });
      setConfirmDel(null);
      await load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message });
    }
  };

  // chapter / takeaway / link helpers
  const addChapter = () => setForm(f => ({ ...f, timestamps_json: [...f.timestamps_json, { time: "0:00", title: "" }] }));
  const updChapter = (i: number, patch: Partial<Chapter>) =>
    setForm(f => ({ ...f, timestamps_json: f.timestamps_json.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const rmChapter = (i: number) =>
    setForm(f => ({ ...f, timestamps_json: f.timestamps_json.filter((_, idx) => idx !== i) }));

  const addLink = () => setForm(f => ({ ...f, related_links_json: [...f.related_links_json, { text: "", url: "" }] }));
  const updLink = (i: number, patch: Partial<RelLink>) =>
    setForm(f => ({ ...f, related_links_json: f.related_links_json.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const rmLink = (i: number) =>
    setForm(f => ({ ...f, related_links_json: f.related_links_json.filter((_, idx) => idx !== i) }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Podcast Episodes</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage UMOJA podcast content.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add New Episode</Button>
      </div>

      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <div className="p-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No episodes yet. Click "Add New Episode" to start.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Published</th>
                  <th className="p-3">Plays</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(ep => (
                  <tr key={ep.id} className="border-b border-border/60">
                    <td className="p-3">
                      <div className="font-medium">{ep.title}</div>
                      {ep.episode_number != null && <div className="text-xs text-muted-foreground">Ep #{ep.episode_number}</div>}
                    </td>
                    <td className="p-3 tabular-nums">{fmtDur(ep.duration_seconds)}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ep.status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {ep.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{ep.published_at ? new Date(ep.published_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3 tabular-nums">{ep.play_count}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ep)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDel(ep)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => !uploading && setOpen(v)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Episode" : "Add New Podcast Episode"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="UMOJA Explained" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div>
              <Label>Audio File {form.id ? "(leave empty to keep current)" : "*"}</Label>
              <input ref={audioInput} type="file" accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              {form.audio_url && !audioFile && (
                <p className="text-xs text-muted-foreground mt-1 truncate">Current: {form.audio_url}</p>
              )}
            </div>

            <div>
              <Label>Cover Image (optional)</Label>
              <input ref={coverInput} type="file" accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              {form.cover_image_url && !coverFile && (
                <img src={form.cover_image_url} alt="" className="mt-2 h-20 w-20 rounded object-cover" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Episode #</Label>
                <Input type="number" value={form.episode_number ?? ""} onChange={(e) =>
                  setForm({ ...form, episode_number: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
            </div>

            <div>
              <Label>Publish Date</Label>
              <Input type="datetime-local" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-between">
                  Advanced Options
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div>
                  <Label>Chapters / Timestamps</Label>
                  <div className="space-y-2 mt-1">
                    {form.timestamps_json.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="0:00" className="w-24" value={c.time} onChange={(e) => updChapter(i, { time: e.target.value })} />
                        <Input placeholder="Chapter title" value={c.title} onChange={(e) => updChapter(i, { title: e.target.value })} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => rmChapter(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addChapter}><Plus className="h-4 w-4 mr-1" /> Add Chapter</Button>
                  </div>
                </div>

                <div>
                  <Label>Key Takeaways (one per line)</Label>
                  <Textarea rows={4} value={form.takeaways.join("\n")}
                    onChange={(e) => setForm({ ...form, takeaways: e.target.value.split("\n") })}
                    placeholder="Circles are rotating savings groups…" />
                </div>

                <div>
                  <Label>Related Links</Label>
                  <div className="space-y-2 mt-1">
                    {form.related_links_json.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="Link text" value={l.text} onChange={(e) => updLink(i, { text: e.target.value })} />
                        <Input placeholder="https://…" value={l.url} onChange={(e) => updLink(i, { url: e.target.value })} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => rmLink(i)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addLink}><Plus className="h-4 w-4 mr-1" /> Add Link</Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {uploading && <Progress value={progress} />}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={uploading} onClick={() => save(false)}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as Draft"}
            </Button>
            <Button disabled={uploading} onClick={() => save(true)}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete episode?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? This will delete <b>{confirmDel?.title}</b> and remove the audio file.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
