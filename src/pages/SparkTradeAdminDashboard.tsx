import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Check, X, Pencil, Trash2, Upload, ImageIcon, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const PRODUCT_IMAGE_BUCKET = "spark_trade_product_images";

type Opp = any;

const EMPTY: Opp = {
  product_name: "",
  supplier_name: "",
  supplier_country: "CN",
  moq_required: 100,
  current_reserved: 0,
  unit_cost_zar: 0,
  suggested_selling_price_zar: 0,
  expected_margin_percentage: 0,
  expected_order_date: new Date().toISOString().slice(0, 10),
  expected_arrival_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  product_image_url: "",
  is_approved_for_ai_recommendation: false,
  group_buy_status: "open",
};

export default function SparkTradeAdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [opportunities, setOpportunities] = useState<Opp[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Opp | null>(null);
  const [editingListing, setEditingListing] = useState<Opp | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingListing, setSavingListing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [o, r] = await Promise.all([
      supabase.from("spark_trade_opportunities" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("spark_trade_inventory_reservations" as any).select("*, members(full_name, email), spark_trade_opportunities(product_name)").order("created_at", { ascending: false }),
    ]);
    setOpportunities(((o as any).data as any[]) ?? []);
    setReservations(((r as any).data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (authLoading || isAdmin === null) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const saveOpp = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = { ...editing };
    const cost = Number(payload.unit_cost_zar);
    const sell = Number(payload.suggested_selling_price_zar);
    if (cost > 0) payload.expected_margin_percentage = Math.round(((sell - cost) / cost) * 100);
    delete payload.created_at;
    delete payload.updated_at;
    const op = payload.id
      ? supabase.from("spark_trade_opportunities" as any).update(payload).eq("id", payload.id)
      : supabase.from("spark_trade_opportunities" as any).insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const toggleApprove = async (o: Opp, val: boolean) => {
    const { error } = await supabase.from("spark_trade_opportunities" as any)
      .update({ is_approved_for_ai_recommendation: val }).eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success(val ? "Approved" : "Unapproved"); load(); }
  };

  const removeOpp = async (o: Opp) => {
    if (!confirm(`Delete "${o.product_name}"? This may affect existing reservations.`)) return;
    const { error } = await supabase.from("spark_trade_opportunities" as any).delete().eq("id", o.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  const updateReservationStatus = async (id: number, status: string) => {
    const update: any = { reservation_status: status };
    if (status === "paid") update.paid_at = new Date().toISOString();
    if (status === "shipped") update.shipped_at = new Date().toISOString();
    if (status === "received") update.received_at = new Date().toISOString();
    const { error } = await supabase.from("spark_trade_inventory_reservations" as any).update(update).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const totalCapital = reservations.reduce((s, r) => s + Number(r.total_capital_allocated || 0), 0);
  const pendingApprovals = opportunities.filter(o => !o.is_approved_for_ai_recommendation);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="font-display text-3xl md:text-4xl">Spark Trade Admin</h1>
        <p className="mt-1 text-muted-foreground">Manage opportunities, approvals, and reservations.</p>

        {loading ? (
          <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="opportunities" className="mt-6">
            <TabsList>
              <TabsTrigger value="opportunities">Opportunities ({opportunities.length})</TabsTrigger>
              <TabsTrigger value="approvals">Approvals ({pendingApprovals.length})</TabsTrigger>
              <TabsTrigger value="reservations">Reservations ({reservations.length})</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" /> Add Opportunity</Button>
              </div>
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Image</TableHead><TableHead>Product</TableHead><TableHead>Supplier</TableHead><TableHead>MOQ</TableHead>
                    <TableHead>Cost</TableHead><TableHead>Margin</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {opportunities.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          {o.product_image_url ? (
                            <img src={o.product_image_url} alt="" className="h-10 w-10 rounded object-cover border" />
                          ) : (
                            <div className="h-10 w-10 rounded border bg-muted grid place-items-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {o.product_name}
                          {o.original_reference_name && (
                            <div className="text-[10px] text-muted-foreground">orig: {o.original_reference_name}</div>
                          )}
                        </TableCell>
                        <TableCell>{o.supplier_name}</TableCell>
                        <TableCell>{o.moq_required?.toLocaleString()}</TableCell>
                        <TableCell>R{Number(o.unit_cost_zar).toFixed(2)}</TableCell>
                        <TableCell>{o.expected_margin_percentage}%</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={o.is_approved_for_ai_recommendation ? "default" : "secondary"}>{o.is_approved_for_ai_recommendation ? "Approved" : "Pending"}</Badge>
                            {o.is_spotlight && <Badge variant="outline" className="text-[10px]">Spotlight</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setEditingListing({ ...o })} title="Edit member-facing name & image">
                              <ImagePlus className="h-4 w-4 mr-1" /> Edit listing
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditing({ ...o })} title="Edit all fields"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => removeOpp(o)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>


            <TabsContent value="approvals" className="mt-4">
              {pendingApprovals.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">All caught up.</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingApprovals.map((o) => (
                    <Card key={o.id} className="p-4">
                      {o.product_image_url && <img src={o.product_image_url} className="w-full h-32 object-cover rounded mb-3" alt={o.product_name} />}
                      <h3 className="font-semibold">{o.product_name}</h3>
                      <p className="text-xs text-muted-foreground">{o.supplier_name} • MOQ {o.moq_required} • {o.expected_margin_percentage}%</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="flex-1" onClick={() => toggleApprove(o, true)}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => removeOpp(o)}><X className="h-4 w-4 mr-1" /> Reject</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reservations" className="mt-4">
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Member</TableHead><TableHead>Product</TableHead><TableHead>Units</TableHead>
                    <TableHead>Capital</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.members?.full_name ?? r.members?.email ?? r.member_id?.slice(0, 8)}</TableCell>
                        <TableCell>{r.spark_trade_opportunities?.product_name ?? `#${r.opportunity_id}`}</TableCell>
                        <TableCell>{r.units_reserved}</TableCell>
                        <TableCell>R{Number(r.total_capital_allocated).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="secondary">{r.reservation_status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {r.reservation_status === "pending" && <Button size="sm" variant="outline" onClick={() => updateReservationStatus(r.id, "paid")}>Mark paid</Button>}
                            {r.reservation_status === "paid" && <Button size="sm" variant="outline" onClick={() => updateReservationStatus(r.id, "shipped")}>Mark shipped</Button>}
                            {r.reservation_status === "shipped" && <Button size="sm" variant="outline" onClick={() => updateReservationStatus(r.id, "received")}>Mark received</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4"><p className="text-xs text-muted-foreground">Opportunities</p><p className="text-2xl font-bold mt-1">{opportunities.length}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted-foreground">Reservations</p><p className="text-2xl font-bold mt-1">{reservations.length}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted-foreground">Capital allocated</p><p className="text-2xl font-bold mt-1">R{totalCapital.toLocaleString()}</p></Card>
                <Card className="p-4"><p className="text-xs text-muted-foreground">Members engaged</p><p className="text-2xl font-bold mt-1">{new Set(reservations.map(r => r.member_id)).size}</p></Card>
              </div>
              <Card className="p-4 mt-4">
                <h3 className="font-semibold mb-3">Reservations by status</h3>
                {(["pending", "paid", "shipped", "received"] as const).map((s) => {
                  const count = reservations.filter(r => r.reservation_status === s).length;
                  const pct = reservations.length ? (count / reservations.length) * 100 : 0;
                  return (
                    <div key={s} className="mb-2">
                      <div className="flex justify-between text-sm"><span className="capitalize">{s}</span><span>{count}</span></div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Opportunity</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Product name" value={editing.product_name} onChange={(v) => setEditing({ ...editing, product_name: v })} />
              <Field label="Supplier" value={editing.supplier_name} onChange={(v) => setEditing({ ...editing, supplier_name: v })} />
              <Field label="Supplier country" value={editing.supplier_country} onChange={(v) => setEditing({ ...editing, supplier_country: v })} />
              <Field label="Image URL" value={editing.product_image_url ?? ""} onChange={(v) => setEditing({ ...editing, product_image_url: v })} />
              <div className="md:col-span-2">
                <ImageUploader
                  value={editing.product_image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, product_image_url: url })}
                />
              </div>
              <Field label="MOQ" type="number" value={editing.moq_required} onChange={(v) => setEditing({ ...editing, moq_required: Number(v) })} />
              <Field label="Unit cost (ZAR)" type="number" value={editing.unit_cost_zar} onChange={(v) => setEditing({ ...editing, unit_cost_zar: Number(v) })} />
              <Field label="Selling price (ZAR)" type="number" value={editing.suggested_selling_price_zar} onChange={(v) => setEditing({ ...editing, suggested_selling_price_zar: Number(v) })} />
              <Field label="Order date" type="date" value={editing.expected_order_date?.slice(0,10) ?? ""} onChange={(v) => setEditing({ ...editing, expected_order_date: v })} />
              <Field label="Arrival date" type="date" value={editing.expected_arrival_date?.slice(0,10) ?? ""} onChange={(v) => setEditing({ ...editing, expected_arrival_date: v })} />
              <label className="flex items-center gap-2 mt-6 md:col-span-2">
                <input type="checkbox" checked={!!editing.is_approved_for_ai_recommendation} onChange={(e) => setEditing({ ...editing, is_approved_for_ai_recommendation: e.target.checked })} />
                <span className="text-sm">Approved for member recommendations</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveOpp} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputId = "spark-trade-image-upload";

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG or WebP allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max file size is 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
    toast.success("Image uploaded");
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground">Product image</label>
      <div className="mt-1 flex items-start gap-3">
        {value ? (
          <img src={value} alt="Preview" className="h-24 w-24 object-cover rounded border" />
        ) : (
          <div className="h-24 w-24 rounded border bg-muted grid place-items-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById(inputId)?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {value ? "Replace image" : "Add product image"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>
          )}
          <p className="text-xs text-muted-foreground">JPG/PNG/WebP, max 5MB</p>
        </div>
      </div>
    </div>
  );
}
