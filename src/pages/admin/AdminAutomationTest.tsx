import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = { state: "idle" | "loading" | "success" | "error"; message?: string };

const bigBtn =
  "w-full py-6 text-lg font-semibold rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 transition";

export default function AdminAutomationTest() {
  const [queueStatus, setQueueStatus] = useState<Status>({ state: "idle" });
  const [publishStatus, setPublishStatus] = useState<Status>({ state: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [confirmedRows, setConfirmedRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ discovered: number; queued: number; confirmed: number }>({
    discovered: 0,
    queued: 0,
    confirmed: 0,
  });

  const runQueue = async () => {
    setQueueStatus({ state: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("queue-products-for-supplier");
      if (error) throw error;
      const count = data?.queued_count ?? data?.count ?? data?.products?.length ?? 0;
      setQueueStatus({ state: "success", message: `✅ ${count} products queued` });
    } catch (e: any) {
      setQueueStatus({ state: "error", message: e?.message ?? "Failed to queue products" });
    }
  };

  const runPublish = async () => {
    setPublishStatus({ state: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("publish-confirmed-products");
      if (error) throw error;
      const count = data?.published_count ?? data?.count ?? 0;
      setPublishStatus({
        state: "success",
        message: count
          ? `✅ ${count} products published to Browse`
          : "✅ Products published to Browse",
      });
    } catch (e: any) {
      setPublishStatus({ state: "error", message: e?.message ?? "Failed to publish" });
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data: rows } = await supabase
        .from("product_discovery")
        .select("*")
        .eq("status", "confirmed")
        .limit(5);
      setConfirmedRows(rows ?? []);

      const fetchCount = async (status: string) => {
        const { count } = await supabase
          .from("product_discovery")
          .select("*", { count: "exact", head: true })
          .eq("status", status);
        return count ?? 0;
      };
      const [discovered, queued, confirmed] = await Promise.all([
        fetchCount("discovered"),
        fetchCount("queued_for_supplier"),
        fetchCount("confirmed"),
      ]);
      setCounts({ discovered, queued, confirmed });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const renderStatus = (s: Status) => {
    if (s.state === "loading") return <p className="mt-2 text-sm text-muted-foreground">Running…</p>;
    if (s.state === "success") return <p className="mt-2 text-sm text-green-700">{s.message}</p>;
    if (s.state === "error") return <p className="mt-2 text-sm text-red-600">❌ {s.message}</p>;
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Automation Test Panel</h1>
        <p className="text-sm text-muted-foreground">
          Manually trigger the supplier pipeline and inspect product_discovery state.
        </p>
      </header>

      <section>
        <button onClick={runQueue} disabled={queueStatus.state === "loading"} className={bigBtn}>
          {queueStatus.state === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
          Queue Products Now
        </button>
        {renderStatus(queueStatus)}
      </section>

      <section>
        <button onClick={runPublish} disabled={publishStatus.state === "loading"} className={bigBtn}>
          {publishStatus.state === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
          Publish Confirmed Now
        </button>
        {renderStatus(publishStatus)}
      </section>

      <section>
        <button onClick={refresh} disabled={refreshing} className={bigBtn}>
          {refreshing && <Loader2 className="h-5 w-5 animate-spin" />}
          Refresh &amp; Check Status
        </button>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold">{counts.discovered}</div>
            <div className="text-xs text-muted-foreground">discovered</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold">{counts.queued}</div>
            <div className="text-xs text-muted-foreground">queued</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-bold">{counts.confirmed}</div>
            <div className="text-xs text-muted-foreground">confirmed</div>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold mb-2">Confirmed products (first 5)</h2>
          {confirmedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed products.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2 border-b">Product</th>
                    <th className="text-left p-2 border-b">Category</th>
                    <th className="text-right p-2 border-b">MOQ</th>
                    <th className="text-right p-2 border-b">Price (ZAR)</th>
                    <th className="text-right p-2 border-b">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-2">{r.product_name}</td>
                      <td className="p-2">{r.category ?? "—"}</td>
                      <td className="p-2 text-right">{r.final_moq ?? "—"}</td>
                      <td className="p-2 text-right">{r.final_supplier_price_zar ?? "—"}</td>
                      <td className="p-2 text-right">{r.estimated_margin_pct ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
