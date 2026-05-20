import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Loader2, RefreshCcw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AnalyticsRow = {
  id: string;
  content_id: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time_minutes: number;
  estimated_revenue_rands: number;
  synced_at: string;
};

type ContentRow = {
  id: string;
  script_title: string | null;
  actual_published_at: string | null;
  thumbnail_url: string | null;
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "hsl(var(--destructive))",
  tiktok: "hsl(var(--foreground))",
  instagram: "hsl(var(--primary))",
};

type Range = "7" | "30" | "90" | "all";

export default function CreatorAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [range, setRange] = useState<Range>("30");
  const [sortBy, setSortBy] = useState<keyof AnalyticsRow | "title" | "published">("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: c } = await supabase
      .from("zcreator_content_queue")
      .select("id,script_title,actual_published_at,thumbnail_url")
      .eq("user_id", user.id);
    const ids = (c ?? []).map((x) => x.id);
    let a: AnalyticsRow[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("zcreator_analytics")
        .select("*")
        .in("content_id", ids);
      a = (data ?? []) as AnalyticsRow[];
    }
    setContent((c ?? []) as ContentRow[]);
    setAnalytics(a);
    setLastSync(a.length ? a.map((r) => r.synced_at).sort().reverse()[0] : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const sinceDate = useMemo(() => {
    if (range === "all") return null;
    return subDays(new Date(), Number(range));
  }, [range]);

  const filtered = useMemo(() => {
    if (!sinceDate) return analytics;
    return analytics.filter((r) => new Date(r.synced_at) >= sinceDate);
  }, [analytics, sinceDate]);

  const totals = useMemo(() => {
    const t = { views: 0, likes: 0, comments: 0, watchMin: 0, revenue: 0 };
    for (const r of filtered) {
      t.views += r.views;
      t.likes += r.likes;
      t.comments += r.comments;
      t.watchMin += r.watch_time_minutes;
      t.revenue += Number(r.estimated_revenue_rands);
    }
    return t;
  }, [filtered]);

  const prevTotals = useMemo(() => {
    if (!sinceDate) return null;
    const prevStart = subDays(sinceDate, Number(range));
    const prev = analytics.filter(
      (r) => new Date(r.synced_at) >= prevStart && new Date(r.synced_at) < sinceDate,
    );
    return prev.reduce((acc, r) => acc + r.views, 0);
  }, [analytics, sinceDate, range]);

  const trendPct = useMemo(() => {
    if (prevTotals == null || prevTotals === 0) return null;
    return ((totals.views - prevTotals) / prevTotals) * 100;
  }, [prevTotals, totals.views]);

  const engagementRate = totals.views
    ? ((totals.likes + totals.comments) / totals.views) * 100
    : 0;

  // Series by day (synced_at as proxy)
  const seriesByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const k = format(new Date(r.synced_at), "yyyy-MM-dd");
      m.set(k, (m.get(k) ?? 0) + r.views);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date, views }));
  }, [filtered]);

  const platformBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.platform, (m.get(r.platform) ?? 0) + r.views);
    return Array.from(m.entries()).map(([platform, views]) => ({ platform, views }));
  }, [filtered]);

  const monthlyRevenue = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of analytics) {
      const k = format(new Date(r.synced_at), "yyyy-MM");
      m.set(k, (m.get(k) ?? 0) + Number(r.estimated_revenue_rands));
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [analytics]);

  const projectedRevenue = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    const thisMonth = analytics.filter((r) => new Date(r.synced_at) >= monthStart);
    const totalSoFar = thisMonth.reduce((a, r) => a + Number(r.estimated_revenue_rands), 0);
    const daysIn = Math.max(1, Math.ceil((Date.now() - monthStart.getTime()) / 86_400_000));
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    return (totalSoFar / daysIn) * daysInMonth;
  }, [analytics]);

  const avgRevPerVideo = analytics.length
    ? analytics.reduce((a, r) => a + Number(r.estimated_revenue_rands), 0) / analytics.length
    : 0;

  const rowsForTable = useMemo(() => {
    const byContent = new Map<string, AnalyticsRow[]>();
    for (const r of filtered) {
      const arr = byContent.get(r.content_id) ?? [];
      arr.push(r);
      byContent.set(r.content_id, arr);
    }
    const out = Array.from(byContent.entries()).flatMap(([cid, rows]) =>
      rows.map((r) => {
        const c = content.find((x) => x.id === cid);
        return {
          ...r,
          title: c?.script_title ?? "(untitled)",
          published: c?.actual_published_at ?? r.synced_at,
        };
      }),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a: any, b: any) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (typeof va === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    return out;
  }, [filtered, content, sortBy, sortDir]);

  const top10Threshold = useMemo(() => {
    if (rowsForTable.length === 0) return Infinity;
    const sorted = [...rowsForTable].map((r) => r.views).sort((a, b) => b - a);
    const idx = Math.max(0, Math.floor(sorted.length * 0.1) - 1);
    return sorted[idx] ?? Infinity;
  }, [rowsForTable]);

  const topEarning = useMemo(() => {
    return [...rowsForTable]
      .sort((a, b) => Number(b.estimated_revenue_rands) - Number(a.estimated_revenue_rands))
      .slice(0, 5);
  }, [rowsForTable]);

  async function sync() {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("zcreator-sync-analytics", {
        body: { userId: user.id },
      });
      if (error) throw error;
      toast.success(`Synced ${(data as any)?.synced ?? 0} items`);
      await load();
    } catch (e: any) {
      toast.error(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  const hasPublished = analytics.length > 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            {lastSync ? `Last synced ${format(new Date(lastSync), "PPp")}` : "Not synced yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={sync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Sync Analytics Now
          </Button>
        </div>
      </div>

      {!loading && !hasPublished ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-muted-foreground">Publish videos to see analytics here</p>
            <Button asChild>
              <Link to="/creator-studio/schedule">Go to Schedule</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top stats row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Views"
              value={totals.views.toLocaleString()}
              trend={trendPct}
            />
            <StatCard
              label="Watch Time"
              value={`${(totals.watchMin / 60).toFixed(1)} hrs`}
            />
            <StatCard
              label="Estimated Revenue"
              value={`R ${totals.revenue.toFixed(2)}`}
            />
            <StatCard
              label="Engagement Rate"
              value={`${engagementRate.toFixed(2)}%`}
            />
          </div>

          {/* Performance chart */}
          <Card>
            <CardHeader><CardTitle>Views Over Time</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Platform breakdown */}
            <Card>
              <CardHeader><CardTitle>Platform Breakdown</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformBreakdown}
                      dataKey="views"
                      nameKey="platform"
                      innerRadius={50}
                      outerRadius={90}
                      label
                    >
                      {platformBreakdown.map((p) => (
                        <Cell
                          key={p.platform}
                          fill={PLATFORM_COLORS[p.platform] ?? "hsl(var(--muted-foreground))"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card>
              <CardHeader><CardTitle>Monthly Revenue</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Projected (this month)"
              value={`R ${projectedRevenue.toFixed(2)}`}
            />
            <StatCard
              label="Avg revenue / video"
              value={`R ${avgRevPerVideo.toFixed(2)}`}
            />
            <Card>
              <CardHeader><CardTitle className="text-sm">Top 5 Earners</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {topEarning.length === 0 && (
                    <li className="text-muted-foreground">No data yet</li>
                  )}
                  {topEarning.map((r: any) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.title}</span>
                      <span className="font-medium">
                        R {Number(r.estimated_revenue_rands).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Content performance table */}
          <Card>
            <CardHeader><CardTitle>Content Performance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => toggleSort("title")} className="cursor-pointer">Title</TableHead>
                    <TableHead onClick={() => toggleSort("platform")} className="cursor-pointer">Platform</TableHead>
                    <TableHead onClick={() => toggleSort("views")} className="cursor-pointer text-right">Views</TableHead>
                    <TableHead onClick={() => toggleSort("likes")} className="cursor-pointer text-right">Likes</TableHead>
                    <TableHead onClick={() => toggleSort("comments")} className="cursor-pointer text-right">Comments</TableHead>
                    <TableHead onClick={() => toggleSort("estimated_revenue_rands")} className="cursor-pointer text-right">Revenue</TableHead>
                    <TableHead onClick={() => toggleSort("published")} className="cursor-pointer">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsForTable.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => (window.location.href = `/creator-studio/videos/${r.content_id}`)}
                    >
                      <TableCell className="flex items-center gap-2">
                        {r.title}
                        {r.views >= top10Threshold && r.views > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <TrendingUp className="h-3 w-3" /> Top 10%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.views.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.likes.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.comments.toLocaleString()}</TableCell>
                      <TableCell className="text-right">R {Number(r.estimated_revenue_rands).toFixed(2)}</TableCell>
                      <TableCell>{r.published ? format(new Date(r.published), "PP") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {trend != null && (
          <div
            className={`mt-1 text-xs ${trend >= 0 ? "text-green-600" : "text-destructive"}`}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs prev
          </div>
        )}
      </CardContent>
    </Card>
  );
}
