import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Content = {
  id: string;
  script_title: string | null;
  status: string;
  scheduled_publish_at: string | null;
  actual_published_at: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  platforms: string[] | null;
};

type Published = {
  id: string;
  content_id: string;
  platform: string;
  platform_url: string | null;
  published_at: string;
};

const ALL_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;

export default function CreatorSchedule() {
  const [items, setItems] = useState<Content[]>([]);
  const [published, setPublished] = useState<Published[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // filters
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rangeStart, setRangeStart] = useState<Date | undefined>();
  const [rangeEnd, setRangeEnd] = useState<Date | undefined>();

  // publishing options panel
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [optPlatforms, setOptPlatforms] = useState<string[]>(["youtube"]);
  const [optDate, setOptDate] = useState<Date | undefined>();
  const [optImmediate, setOptImmediate] = useState(true);
  const [ytPrivacy, setYtPrivacy] = useState("unlisted");
  const [ttComments, setTtComments] = useState(true);
  const [ttDuets, setTtDuets] = useState(true);
  const [igCaption, setIgCaption] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase
        .from("zcreator_content_queue")
        .select("id,script_title,status,scheduled_publish_at,actual_published_at,thumbnail_url,duration_seconds,platforms")
        .order("scheduled_publish_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("zcreator_published_content")
        .select("id,content_id,platform,platform_url,published_at")
        .order("published_at", { ascending: false })
        .limit(50),
    ]);
    setItems((c ?? []) as Content[]);
    setPublished((p ?? []) as Published[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("schedule-content")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zcreator_content_queue" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      if (platformFilter !== "all" && !(it.platforms ?? []).includes(platformFilter))
        return false;
      const when = it.scheduled_publish_at ? new Date(it.scheduled_publish_at) : null;
      if (rangeStart && when && when < rangeStart) return false;
      if (rangeEnd && when && when > rangeEnd) return false;
      return true;
    });
  }, [items, statusFilter, platformFilter, rangeStart, rangeEnd]);

  const byDay = useMemo(() => {
    const map = new Map<string, Content[]>();
    for (const it of filtered) {
      const key = it.scheduled_publish_at
        ? format(new Date(it.scheduled_publish_at), "yyyy-MM-dd")
        : "unscheduled";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function publishNow(contentId: string, platforms: string[]) {
    setBusyId(contentId);
    try {
      const { data, error } = await supabase.functions.invoke("zcreator-publish-content", {
        body: { contentId, platforms, publishNow: true },
      });
      if (error) throw error;
      toast.success("Publish triggered");
      console.log("publish result", data);
      load();
    } catch (e: any) {
      toast.error(`Publish failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSchedule(id: string) {
    const { error } = await supabase
      .from("zcreator_content_queue")
      .update({ scheduled_at: null, status: "ready" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Schedule cancelled");
  }

  async function rescheduleTo(id: string, when: Date) {
    const { error } = await supabase
      .from("zcreator_content_queue")
      .update({ scheduled_at: when.toISOString(), status: "scheduled" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Rescheduled");
  }

  async function submitSchedule() {
    if (!selectedContentId) return toast.error("Choose a content item");
    if (optImmediate) {
      await publishNow(selectedContentId, optPlatforms);
      return;
    }
    if (!optDate) return toast.error("Pick a date/time");
    const meta: Record<string, any> = {};
    if (optPlatforms.includes("youtube")) meta.youtube = { privacy: ytPrivacy };
    if (optPlatforms.includes("tiktok"))
      meta.tiktok = { allow_comments: ttComments, allow_duets: ttDuets };
    if (optPlatforms.includes("instagram")) meta.instagram = { caption: igCaption };

    const { error } = await supabase
      .from("zcreator_content_queue")
      .update({
        scheduled_at: optDate.toISOString(),
        status: "scheduled",
        platforms: optPlatforms,
        platform_metadata: meta,
      })
      .eq("id", selectedContentId);
    if (error) toast.error(error.message);
    else toast.success("Scheduled");
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Schedule & Publish</h1>
        <p className="text-muted-foreground">
          Manage scheduled videos across YouTube, TikTok & Instagram.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label className="text-xs">Platform</Label>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {ALL_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DatePick label="From" value={rangeStart} onChange={setRangeStart} />
          <DatePick label="To" value={rangeEnd} onChange={setRangeEnd} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar list */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Content Calendar</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && byDay.length === 0 && (
                <p className="text-sm text-muted-foreground">No content matches your filters.</p>
              )}
              {byDay.map(([day, list]) => (
                <div key={day}>
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">
                    {day === "unscheduled" ? "Unscheduled" : format(new Date(day), "EEE, MMM d")}
                  </div>
                  <div className="space-y-2">
                    {list.map((it) => (
                      <div
                        key={it.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                      >
                        {it.thumbnail_url ? (
                          <img
                            src={it.thumbnail_url}
                            alt={it.script_title}
                            className="h-14 w-24 rounded object-cover"
                          />
                        ) : (
                          <div className="h-14 w-24 rounded bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{it.script_title}</div>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            {it.duration_seconds ? <span>{it.duration_seconds}s</span> : null}
                            {it.scheduled_publish_at && (
                              <span>· {format(new Date(it.scheduled_publish_at), "PPp")}</span>
                            )}
                            <Badge variant="outline" className="ml-1">{it.status}</Badge>
                            {(it.platforms ?? []).map((p) => (
                              <Badge key={p} variant="secondary">{p}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === it.id || (it.platforms ?? []).length === 0}
                            onClick={() => publishNow(it.id, it.platforms ?? [])}
                          >
                            {busyId === it.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Publish Now"
                            )}
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline">Edit Schedule</Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={it.scheduled_publish_at ? new Date(it.scheduled_publish_at) : undefined}
                                onSelect={(d) => d && rescheduleTo(it.id, d)}
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelSchedule(it.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recently published */}
          <Card>
            <CardHeader><CardTitle>Recently Published</CardTitle></CardHeader>
            <CardContent>
              {published.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing published yet.</p>
              )}
              <ul className="space-y-2">
                {published.map((p) => {
                  const c = items.find((i) => i.id === p.content_id);
                  return (
                    <li key={p.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge>{p.platform}</Badge>
                        <span className="truncate">{c?.script_title ?? p.content_id}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(p.published_at), "PPp")}
                        </span>
                      </div>
                      {p.platform_url ? (
                        <a
                          href={p.platform_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">no link</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Publishing options */}
        <Card className="h-fit">
          <CardHeader><CardTitle>Publishing Options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Content</Label>
              <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                <SelectTrigger><SelectValue placeholder="Pick a video…" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.script_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Platforms</Label>
              <div className="mt-2 flex flex-col gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={optPlatforms.includes(p)}
                      onCheckedChange={(v) =>
                        setOptPlatforms((cur) =>
                          v ? [...cur, p] : cur.filter((x) => x !== p),
                        )
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="imm">Publish Immediately</Label>
              <Switch id="imm" checked={optImmediate} onCheckedChange={setOptImmediate} />
            </div>

            {!optImmediate && <DatePick label="Schedule" value={optDate} onChange={setOptDate} />}

            {optPlatforms.includes("youtube") && (
              <div>
                <Label>YouTube privacy</Label>
                <Select value={ytPrivacy} onValueChange={setYtPrivacy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {optPlatforms.includes("tiktok") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Allow comments</Label>
                  <Switch checked={ttComments} onCheckedChange={setTtComments} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Allow duets</Label>
                  <Switch checked={ttDuets} onCheckedChange={setTtDuets} />
                </div>
              </div>
            )}

            {optPlatforms.includes("instagram") && (
              <div>
                <Label>Instagram caption</Label>
                <Textarea
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  placeholder="Caption with #hashtags"
                />
              </div>
            )}

            <Button className="w-full" onClick={submitSchedule}>
              {optImmediate ? "Publish Now" : "Schedule Post"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DatePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-44 justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
