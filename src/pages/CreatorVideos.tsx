import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Play, Download, Calendar, Sparkles, Film } from "lucide-react";

type Row = {
  id: string;
  script_title: string | null;
  status: string;
  video_style: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  error_message: string | null;
};

const STYLE_OPTIONS = [
  { value: "talking_head", label: "AI Avatar (HeyGen) · R2" },
  { value: "cinematic", label: "Cinematic (Kling) · R5" },
  { value: "stock", label: "Stock Footage · R0" },
  { value: "animation", label: "Animated · R0" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  script_ready: { label: "Script Ready", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  generating:   { label: "Generating",  cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  ready:        { label: "Ready",       cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  published:    { label: "Published",   cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  failed:       { label: "Failed",      cls: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export default function CreatorVideos() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("zcreator_content_queue")
      .select("id, script_title, status, video_style, video_url, thumbnail_url, duration_seconds, created_at, error_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("zcreator-queue-videos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zcreator_content_queue", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (styleFilter !== "all" && (r.video_style ?? "") !== styleFilter) return false;
      if (fromDate && new Date(r.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(r.created_at) > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [rows, statusFilter, styleFilter, fromDate, toDate]);

  const updateStyle = async (id: string, style: string) => {
    await supabase.from("zcreator_content_queue").update({ video_style: style }).eq("id", id);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, video_style: style } : r)));
  };

  const generate = async (row: Row) => {
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("zcreator-generate-video", {
      body: { contentId: row.id, videoStyle: row.video_style ?? "talking_head" },
    });
    setBusy(null);
    if (error) return toast.error("Generation failed: " + error.message);
    if (data?.success === false) return toast.error(data?.error ?? "Generation failed");
    if (data?.note) toast.info(data.note);
    else toast.success("Video generated");
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-24">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Creator Studio</p>
          <h1 className="font-display text-2xl mt-1 flex items-center gap-2">
            <Film className="h-6 w-6" /> Production Queue
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/creator-studio">← Back to Studio</Link>
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="script_ready">Script Ready</SelectItem>
              <SelectItem value="generating">Generating</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger><SelectValue placeholder="Style" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All styles</SelectItem>
              {STYLE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading queue…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Film className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No content yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create an agent to start generating.</p>
              <Button asChild size="sm" className="mt-4"><Link to="/creator-studio">Open Studio</Link></Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: "" };
                    const isGen = r.status === "generating" || busy === r.id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="max-w-[260px]">
                          <p className="text-sm font-medium line-clamp-1">{r.script_title ?? "Untitled"}</p>
                          {r.error_message && r.status === "failed" && (
                            <p className="text-[11px] text-red-600 line-clamp-1 mt-0.5">{r.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Select
                            value={r.video_style ?? "talking_head"}
                            onValueChange={(v) => updateStyle(r.id, v)}
                            disabled={isGen}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STYLE_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${badge.cls}`}>
                            {isGen && <Loader2 className="h-3 w-3 animate-spin" />}
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.duration_seconds ? `${r.duration_seconds}s` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {r.status === "script_ready" && (
                              <Button size="sm" variant="default" className="h-8" onClick={() => generate(r)} disabled={isGen}>
                                <Sparkles className="h-3 w-3 mr-1" /> Generate
                              </Button>
                            )}
                            {r.status === "ready" && (
                              <>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => setPreview(r)} disabled={!r.video_url}>
                                  <Play className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8" asChild disabled={!r.video_url}>
                                  <a href={r.video_url ?? "#"} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3 w-3" />
                                  </a>
                                </Button>
                                <Button size="sm" variant="outline" className="h-8" onClick={() => toast.info("Scheduling coming soon")}>
                                  <Calendar className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{preview?.script_title ?? "Video"}</DialogTitle></DialogHeader>
          {preview?.video_url && (
            <video src={preview.video_url} controls autoPlay className="w-full rounded-lg aspect-[9/16] bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
