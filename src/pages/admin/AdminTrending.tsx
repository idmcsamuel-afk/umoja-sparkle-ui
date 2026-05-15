import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Copy, Plus, Upload, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type P = {
  id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  source: string | null;
  source_url: string | null;
  views_count: number | null;
  sa_available: boolean | null;
  estimated_fob_price: number | null;
  estimated_sa_market_price: number | null;
  margin_percentage: number | null;
  category: string | null;
  tags: string[] | null;
  featured: boolean | null;
  admin_notes: string | null;
};

const empty: Partial<P> = {
  product_name: "",
  description: "",
  image_url: "",
  source: "manual",
  source_url: "",
  views_count: 0,
  sa_available: false,
  estimated_fob_price: 0,
  estimated_sa_market_price: 0,
  category: "",
  tags: [],
  featured: false,
  admin_notes: "",
};

export default function AdminTrending() {
  const [rows, setRows] = useState<P[]>([]);
  const [editing, setEditing] = useState<Partial<P> | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [filterSource, setFilterSource] = useState("all");
  const [filterSA, setFilterSA] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await supabase.from("trending_products").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as P[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filterSource !== "all" && r.source !== filterSource) return false;
        if (filterSA === "yes" && !r.sa_available) return false;
        if (filterSA === "no" && r.sa_available) return false;
        if (search && !r.product_name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [rows, filterSource, filterSA, search]
  );

  const stats = {
    total: rows.length,
    featured: rows.filter((r) => r.featured).length,
    avgMargin: rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.margin_percentage ?? 0), 0) / rows.length) : 0,
    notSA: rows.filter((r) => !r.sa_available).length,
  };

  const save = async () => {
    if (!editing?.product_name) return toast({ title: "Name required", variant: "destructive" });
    const fob = Number(editing.estimated_fob_price ?? 0);
    const sa = Number(editing.estimated_sa_market_price ?? 0);
    const margin = sa > 0 ? ((sa - fob) / sa) * 100 : 0;
    const payload: any = { ...editing, margin_percentage: margin };
    delete payload.id;
    if (editing.id) {
      await supabase.from("trending_products").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("trending_products").insert(payload);
    }
    toast({ title: "Saved" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("trending_products").delete().eq("id", id);
    load();
  };

  const duplicate = async (r: P) => {
    const { id, ...rest } = r;
    await supabase.from("trending_products").insert({ ...rest, product_name: `${r.product_name} (copy)` });
    load();
  };

  const toggleFeatured = async (r: P) => {
    await supabase.from("trending_products").update({ featured: !r.featured }).eq("id", r.id);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Trending Products Manager</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" /> Add Product</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total" v={stats.total} />
        <Kpi label="Featured" v={stats.featured} />
        <Kpi label="Avg Margin" v={`${stats.avgMargin}%`} />
        <Kpi label="Not in SA" v={stats.notSA} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-3 rounded-md border border-border bg-background text-sm">
          <option value="all">All sources</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
          <option value="manual">Manual</option>
        </select>
        <select value={filterSA} onChange={(e) => setFilterSA(e.target.value)} className="px-3 rounded-md border border-border bg-background text-sm">
          <option value="all">SA: All</option>
          <option value="yes">In SA</option>
          <option value="no">Not in SA</option>
        </select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>SA</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.image_url ? <img src={r.image_url} alt="" className="h-12 w-12 object-cover rounded" /> : <div className="h-12 w-12 bg-muted rounded" />}
                </TableCell>
                <TableCell className="max-w-[240px] font-medium">{r.product_name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.source ?? "manual"}</Badge></TableCell>
                <TableCell>{Math.round(Number(r.margin_percentage ?? 0))}%</TableCell>
                <TableCell>{r.sa_available ? "✓" : "✗"}</TableCell>
                <TableCell>
                  <button onClick={() => toggleFeatured(r)}><Star className={`h-4 w-4 ${r.featured ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} /></button>
                </TableCell>
                <TableCell>{(r.views_count ?? 0).toLocaleString()}</TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicate(r)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No products</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} Product</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Product Name *">
                <Input value={editing.product_name ?? ""} onChange={(e) => setEditing({ ...editing, product_name: e.target.value })} />
              </Field>
              <Field label="Source *">
                <select className="w-full h-10 px-3 rounded-md border border-border bg-background" value={editing.source ?? "manual"} onChange={(e) => setEditing({ ...editing, source: e.target.value })}>
                  <option value="manual">Manual</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </Field>
              <Field label="Image URL" className="md:col-span-2">
                <Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
                {editing.image_url && <img src={editing.image_url} alt="" className="mt-2 h-24 object-cover rounded" />}
              </Field>
              <Field label="Source URL">
                <Input value={editing.source_url ?? ""} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} />
              </Field>
              <Field label="Views">
                <Input type="number" value={editing.views_count ?? 0} onChange={(e) => setEditing({ ...editing, views_count: Number(e.target.value) })} />
              </Field>
              <Field label="FOB Price (R) *">
                <Input type="number" step="0.01" value={editing.estimated_fob_price ?? 0} onChange={(e) => setEditing({ ...editing, estimated_fob_price: Number(e.target.value) })} />
              </Field>
              <Field label="SA Market Price (R) *">
                <Input type="number" step="0.01" value={editing.estimated_sa_market_price ?? 0} onChange={(e) => setEditing({ ...editing, estimated_sa_market_price: Number(e.target.value) })} />
              </Field>
              <Field label="Category">
                <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              </Field>
              <Field label="Tags (comma-separated)">
                <Input value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
              </Field>
              <Field label="" className="md:col-span-2">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!editing.sa_available} onCheckedChange={(v) => setEditing({ ...editing, sa_available: !!v })} /> Available in SA
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!editing.featured} onCheckedChange={(v) => setEditing({ ...editing, featured: !!v })} /> Featured
                  </label>
                </div>
              </Field>
              <Field label="Admin Notes" className="md:col-span-2">
                <Textarea rows={2} value={editing.admin_notes ?? ""} onChange={(e) => setEditing({ ...editing, admin_notes: e.target.value })} />
              </Field>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} onDone={load} />
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: any }) {
  return <Card className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{v}</div></Card>;
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}>{label && <Label className="text-xs">{label}</Label>}{children}</div>;
}

const TEMPLATE = "product_name,description,image_url,source,views_count,fob_price,sa_market_price,category,tags,featured\n";

function CsvImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [parsed, setParsed] = useState<any[]>([]);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "trending_products_template.csv";
    a.click();
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const cells = line.split(",");
      const o: any = {};
      headers.forEach((h, i) => (o[h] = cells[i]?.trim()));
      return o;
    });
    setParsed(data);
  };

  const importRows = async () => {
    const rows = parsed.map((r) => {
      const fob = Number(r.fob_price || 0);
      const sa = Number(r.sa_market_price || 0);
      return {
        product_name: r.product_name,
        description: r.description || null,
        image_url: r.image_url || null,
        source: r.source || "manual",
        views_count: Number(r.views_count || 0),
        estimated_fob_price: fob,
        estimated_sa_market_price: sa,
        margin_percentage: sa > 0 ? ((sa - fob) / sa) * 100 : 0,
        category: r.category || null,
        tags: r.tags ? r.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : [],
        featured: String(r.featured).toLowerCase() === "true",
      };
    }).filter((r) => r.product_name);
    if (rows.length === 0) return;
    await supabase.from("trending_products").insert(rows);
    toast({ title: `Imported ${rows.length} products` });
    setParsed([]);
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Import CSV</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
          <Input type="file" accept=".csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
          {parsed.length > 0 && (
            <>
              <div className="max-h-64 overflow-auto text-xs border border-border rounded">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>{Object.keys(parsed[0]).map((k) => <th key={k} className="p-2 text-left">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.values(r).map((v: any, j) => <td key={j} className="p-2">{String(v).slice(0, 40)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={importRows}>Import {parsed.length} Products</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
