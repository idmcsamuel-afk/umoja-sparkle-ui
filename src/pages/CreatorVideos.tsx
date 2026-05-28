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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Play, Download, Calendar, Sparkles, Film, RotateCw, HelpCircle, Eye, X, Save, Wand2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Row = {
  id: string;
  agent_id: string | null;
  script_title: string | null;
  script_content: any;
  platform_metadata: any;
  status: string;
  video_style: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  error_message: string | null;
  generation_progress: any;
};

const STYLE_OPTIONS = [
  { value: "talking_head", label: "AI Avatar (HeyGen) · R2" },
  { value: "cinematic", label: "Cinematic (Kling) · R5" },
  { value: "stock", label: "Stock Footage · R0" },
  { value: "animation", label: "Animated · R0" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  script_ready: { label: "Script Ready", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  queued:       { label: "Queued",       cls: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  generating:   { label: "Generating",  cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  ready:        { label: "Ready",       cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  published:    { label: "Published",   cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  failed:       { label: "Failed",      cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  cancelled:    { label: "Cancelled",   cls: "bg-muted text-muted-foreground border-border" },
};

const PROGRESS_LABEL: Record<string, string> = {
  starting: "Preparing scenes…",
  stock_and_voice: "Searching stock footage & generating voiceover…",
  captions: "Adding captions…",
  worker_wake: "Waking FFmpeg worker…",
  assembling: "Assembling video…",
  uploading: "Uploading…",
  done: "Done",
  cancelled: "Cancelled",
};

export default function CreatorVideos() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);

  // Script preview/edit modal state
  const [scriptModal, setScriptModal] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editScript, setEditScript] = useState("");
  const [savingScript, setSavingScript] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Cancel confirm state
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);

  // Queue positions: content_id -> { position, total }
  const [queuePositions, setQueuePositions] = useState<Record<string, { position: number; total: number }>>({});

  const loadQueuePositions = async () => {
    const { data } = await supabase
      .from("zcreator_job_queue")
      .select("content_id, status")
      .in("status", ["queued", "processing"])
      .order("priority", { ascending: false })
      .order("queued_at", { ascending: true });
    const arr = (data ?? []) as Array<{ content_id: string; status: string }>;
    const total = arr.length;
    const map: Record<string, { position: number; total: number }> = {};
    arr.forEach((r, i) => { map[r.content_id] = { position: i + 1, total }; });
    setQueuePositions(map);
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("zcreator_content_queue")
      .select("id, agent_id, script_title, script_content, platform_metadata, status, video_style, video_url, thumbnail_url, duration_seconds, created_at, error_message, generation_progress")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadQueuePositions();
    if (!user) return;
    const ch = supabase
      .channel("zcreator-queue-videos-" + Math.random().toString(36).slice(2, 9))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zcreator_content_queue", filter: `user_id=eq.${user.id}` },
        () => { load(); loadQueuePositions(); },
      )
      .subscribe();
    const interval = setInterval(loadQueuePositions, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (highlightId && !loading && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, loading, rows.length]);

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

  const retry = async (row: Row) => {
    // Reset to script_ready, clear error, then re-run generation with current (possibly changed) style.
    await supabase
      .from("zcreator_content_queue")
      .update({ status: "script_ready", error_message: null })
      .eq("id", row.id);
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: "script_ready", error_message: null } : r)));
    toast.info("Retrying — system failures don't count against your monthly limit");
    await generate({ ...row, status: "script_ready", error_message: null });
  };

  const parseError = (msg: string | null) => {
    if (!msg) return { kind: "system", text: "Unknown error" };
    const m = msg.match(/^\[(system|user)\]\s*(.*)$/);
    return m ? { kind: m[1], text: m[2] } : { kind: "system", text: msg };
  };

  // ----- Script preview / edit helpers -----
  const scriptToText = (sc: any): string => {
    if (sc == null) return "";
    if (typeof sc === "string") return sc;
    if (Array.isArray(sc?.scenes)) {
      return sc.scenes
        .map((s: any, i: number) => `Scene ${i + 1}${s.visual ? ` — ${s.visual}` : ""}\n${s.narration ?? s.text ?? ""}`)
        .join("\n\n");
    }
    return sc.narration ?? sc.body ?? JSON.stringify(sc, null, 2);
  };
  const openScriptModal = (row: Row) => {
    setScriptModal(row);
    setEditing(false);
    setEditTitle(row.script_title ?? "");
    setEditScript(scriptToText(row.script_content));
  };
  const saveScript = async () => {
    if (!scriptModal) return;
    setSavingScript(true);
    const original = scriptToText(scriptModal.script_content);
    const current = scriptModal.script_content ?? {};
    const next =
      editScript === original
        ? scriptModal.script_content
        : (typeof current === "object" && current !== null && !Array.isArray(current))
          ? { ...current, narration: editScript, scenes: undefined }
          : { narration: editScript };
    const { error } = await supabase
      .from("zcreator_content_queue")
      .update({ script_title: editTitle, script_content: next })
      .eq("id", scriptModal.id);
    setSavingScript(false);
    if (error) return toast.error("Save failed: " + error.message);
    toast.success("Script saved");
    setRows((p) => p.map((r) => (r.id === scriptModal.id ? { ...r, script_title: editTitle, script_content: next } : r)));
    setScriptModal((m) => (m ? { ...m, script_title: editTitle, script_content: next } : m));
    setEditing(false);
  };
  const regenerateScript = async () => {
    if (!scriptModal?.agent_id) return toast.error("No agent linked to this script");
    setRegenerating(true);
    const { data, error } = await supabase.functions.invoke("zcreator-story-agent", {
      body: { agentId: scriptModal.agent_id, manualTrigger: true },
    });
    setRegenerating(false);
    if (error || (data as any)?.error) {
      return toast.error("Regenerate failed: " + (error?.message ?? (data as any)?.error));
    }
    toast.success("New script generated — compare side-by-side in your queue");
    await load();
  };

  const cancelGeneration = async (row: Row) => {
    const { error } = await supabase
      .from("zcreator_content_queue")
      .update({
        cancel_requested: true,
        status: "failed",
        error_message: "[user] Generation cancelled by user",
      })
      .eq("id", row.id);
    setCancelTarget(null);
    if (error) return toast.error("Cancel failed: " + error.message);
    toast.success("Generation cancelled");
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, status: "failed", error_message: "[user] Generation cancelled by user" } : r)));
  };

  const sceneSummary = (r: Row): string | null => {
    const sc = r.script_content;
    const scenes = Array.isArray(sc?.scenes) ? sc.scenes : null;
    if (!scenes?.length) return null;
    const expected = scenes.reduce(
      (sum: number, s: any) => sum + (Number(s?.duration) || Math.max(8, Math.round((String(s?.narration ?? "").split(/\s+/).length) / 2.5))),
      0,
    );
    return `${scenes.length} scenes • ${expected}s expected`;
  };

  const progressText = (r: Row): string | null => {
    const gp = r.generation_progress;
    if (!gp || typeof gp !== "object") return null;
    const base = PROGRESS_LABEL[gp.step] ?? gp.message ?? null;
    if (gp.sceneIndex && gp.sceneTotal) return `Scene ${gp.sceneIndex} of ${gp.sceneTotal}${base ? ` — ${base}` : ""}`;
    return base;
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
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="generating">Generating</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    const isGen = r.status === "generating" || r.status === "queued" || busy === r.id;
                    return (
                      <TableRow
                        key={r.id}
                        ref={highlightId === r.id ? highlightRef : undefined}
                        className={highlightId === r.id ? "bg-accent/10 ring-2 ring-accent/40" : undefined}
                      >
                        <TableCell className="max-w-[260px]">
                          <p className="text-sm font-medium line-clamp-1">{r.script_title ?? "Untitled"}</p>
                          {(() => {
                            const summary = sceneSummary(r);
                            if (!summary) return null;
                            // Warn if actual duration mismatches expected (>20% off)
                            const sc = r.script_content;
                            const expected = Array.isArray(sc?.scenes)
                              ? sc.scenes.reduce((s: number, x: any) => s + (Number(x?.duration) || Math.max(8, Math.round((String(x?.narration ?? "").split(/\s+/).length) / 2.5))), 0)
                              : 0;
                            const actual = r.duration_seconds ?? 0;
                            const mismatch = r.status === "ready" && actual > 0 && expected > 0 && actual < expected * 0.8;
                            return (
                              <p className={`text-[11px] mt-0.5 ${mismatch ? "text-amber-600" : "text-muted-foreground"}`}>
                                {r.status === "ready" && r.duration_seconds
                                  ? `${Array.isArray(sc?.scenes) ? sc.scenes.length : 0} scenes • ${r.duration_seconds}s${mismatch ? ` ⚠ expected ${expected}s` : ""}`
                                  : summary}
                              </p>
                            );
                          })()}
                          {r.error_message && r.status === "failed" && (() => {
                            const err = parseError(r.error_message);
                            return (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline">
                                      <HelpCircle className="h-3 w-3" />
                                      <span className="line-clamp-1 max-w-[220px] text-left">{err.text}</span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                                    <p className="font-medium mb-1">Why did this fail?</p>
                                    <p>{err.text}</p>
                                    <p className="mt-1 text-muted-foreground">
                                      {err.kind === "system"
                                        ? "System error — this retry is free and won't count against your monthly limit."
                                        : "Input issue — please adjust and retry."}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
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
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`gap-1 w-fit ${badge.cls}`}>
                              {isGen && <Loader2 className="h-3 w-3 animate-spin" />}
                              {badge.label}
                            </Badge>
                            {r.status === "generating" && progressText(r) && (
                              <span className="text-[11px] text-muted-foreground line-clamp-2 max-w-[200px]">
                                {progressText(r)}
                              </span>
                            )}
                            {r.status === "queued" && (
                              <span className="text-[11px] text-muted-foreground">
                                {queuePositions[r.id]
                                  ? `Position #${queuePositions[r.id].position} of ${queuePositions[r.id].total}`
                                  : "Waiting for worker…"}
                              </span>
                            )}
                          </div>
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
                              <>
                                <Button size="sm" variant="default" className="h-8" onClick={() => openScriptModal(r)}>
                                  <Eye className="h-3 w-3 mr-1" /> Preview Script
                                </Button>
                              </>
                            )}
                            {r.status === "generating" && (
                              <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-500/30 hover:bg-red-500/10" onClick={() => setCancelTarget(r)}>
                                <X className="h-3 w-3 mr-1" /> Cancel
                              </Button>
                            )}
                            {r.status === "failed" && (
                              <Button size="sm" variant="default" className="h-8" onClick={() => retry(r)} disabled={isGen}>
                                <RotateCw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                            {r.status === "cancelled" && (
                              <Button size="sm" variant="default" className="h-8" onClick={() => retry(r)} disabled={isGen}>
                                <RotateCw className="h-3 w-3 mr-1" /> Retry
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
                                <Button size="sm" variant="outline" className="h-8" onClick={() => retry(r)} disabled={isGen} title="Regenerate with current style">
                                  <RotateCw className="h-3 w-3 mr-1" /> Regenerate
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

      {/* Video preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{preview?.script_title ?? "Video"}</DialogTitle></DialogHeader>
          {preview?.video_url && (
            <video src={preview.video_url} controls autoPlay className="w-full rounded-lg aspect-[9/16] bg-black" />
          )}
        </DialogContent>
      </Dialog>

      {/* Script preview + edit + regenerate */}
      <Dialog open={!!scriptModal} onOpenChange={(o) => { if (!o) { setScriptModal(null); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Script preview</DialogTitle>
            <DialogDescription>
              Review and edit your script before generating the video. Generation uses the saved version.
            </DialogDescription>
          </DialogHeader>

          {scriptModal && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Title</Label>
                {editing ? (
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
                ) : (
                  <p className="text-sm font-medium mt-1">{scriptModal.script_title ?? "Untitled"}</p>
                )}
              </div>

              <div>
                <Label className="text-xs">Script</Label>
                {editing ? (
                  <Textarea
                    value={editScript}
                    onChange={(e) => setEditScript(e.target.value)}
                    rows={14}
                    className="mt-1 font-mono text-xs"
                  />
                ) : (
                  <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-[300px] overflow-y-auto">
                    {scriptToText(scriptModal.script_content) || "(empty)"}
                  </pre>
                )}
              </div>

              {Array.isArray(scriptModal.script_content?.scenes) && (
                <div>
                  <Label className="text-xs">Scene breakdown</Label>
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {scriptModal.script_content.scenes.map((s: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-medium text-foreground">#{i + 1}</span>
                        <span className="line-clamp-1">{s.visual ?? s.keywords ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scriptModal.platform_metadata && (
                <div>
                  <Label className="text-xs">Platform metadata</Label>
                  <pre className="mt-1 text-[11px] whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-[160px] overflow-y-auto">
                    {JSON.stringify(scriptModal.platform_metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={savingScript}>Discard</Button>
                <Button onClick={saveScript} disabled={savingScript}>
                  {savingScript ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={regenerateScript}
                  disabled={regenerating || !scriptModal?.agent_id}
                  title={scriptModal?.agent_id ? "" : "No agent linked"}
                >
                  {regenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  Regenerate Script
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit Script
                </Button>
                <Button
                  onClick={async () => {
                    if (!scriptModal) return;
                    const row = scriptModal;
                    setScriptModal(null);
                    await generate(row);
                  }}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Generate Video
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop video generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The video will be marked as cancelled and won't count against
              your monthly usage limit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep generating</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTarget && cancelGeneration(cancelTarget)}>
              Stop generation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
