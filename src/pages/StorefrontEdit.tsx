import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function StorefrontEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [member, setMember] = useState<{ full_name: string; referral_code: string | null; buyers_club_tier: string | null; has_buyers_club_access: boolean } | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    banner_url: "" as string | null,
    accent_color: "#C9A84C",
    is_active: true,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase.from("members")
        .select("full_name, referral_code, buyers_club_tier, has_buyers_club_access")
        .eq("id", user.id).maybeSingle();
      setMember(m as any);
      const { data: sf } = await supabase.from("storefronts")
        .select("*").eq("member_id", user.id).maybeSingle();
      if (sf) {
        setForm({
          display_name: sf.display_name ?? m?.full_name ?? "",
          bio: sf.bio ?? "",
          banner_url: sf.banner_url,
          accent_color: sf.accent_color ?? "#C9A84C",
          is_active: sf.is_active,
        });
      } else if (m) {
        setForm((f) => ({ ...f, display_name: m.full_name }));
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const isGold = member?.has_buyers_club_access && (member?.buyers_club_tier?.toLowerCase() === "gold");
  if (!isGold) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="mt-6 rounded-3xl border border-border bg-gradient-card p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Gold tier required</p>
          <h1 className="font-display text-2xl mt-2">Storefronts are a Gold member benefit</h1>
          <p className="text-sm text-muted-foreground mt-3">Upgrade to Gold to launch your own public shop page, share with customers, and collect reviews.</p>
          <Link to="/spark"><Button className="mt-5 rounded-2xl bg-gradient-gold text-amber-950">Upgrade to Gold</Button></Link>
        </div>
      </div>
    );
  }

  const uploadBanner = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Banner must be under 2MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("storefront-banners").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("storefront-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, banner_url: data.publicUrl }));
    setUploading(false);
    toast.success("Banner uploaded");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("storefronts").upsert({
      member_id: user.id,
      display_name: form.display_name.trim() || member?.full_name,
      bio: form.bio.trim() || null,
      banner_url: form.banner_url,
      accent_color: form.accent_color,
      is_active: form.is_active,
    }, { onConflict: "member_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Storefront saved");
  };

  const previewUrl = member?.referral_code ? `/shop/${member.referral_code}` : null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        {previewUrl && (
          <Link to={previewUrl} target="_blank" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
            Preview <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <h1 className="font-display text-3xl mt-3">Edit your storefront</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Live at <span className="font-mono text-accent">/shop/{member?.referral_code}</span>
      </p>

      {/* Banner */}
      <section className="mt-6 rounded-3xl border border-border bg-gradient-card p-5">
        <Label className="text-sm">Banner image</Label>
        <p className="text-xs text-muted-foreground">1200×300 recommended · max 2MB</p>
        <div className="mt-3 aspect-[4/1] w-full overflow-hidden rounded-2xl bg-secondary/40 grid place-items-center">
          {form.banner_url ? (
            <img src={form.banner_url} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <p className="text-xs text-muted-foreground">No banner yet</p>
          )}
        </div>
        <label className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm cursor-pointer hover:bg-secondary">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading..." : "Upload banner"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
        </label>
      </section>

      {/* Profile */}
      <section className="mt-4 rounded-3xl border border-border bg-gradient-card p-5 space-y-3">
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="mt-1 rounded-2xl" />
        </div>
        <div>
          <Label htmlFor="bio">Bio / tagline ({form.bio.length}/200)</Label>
          <Textarea id="bio" maxLength={200} rows={3}
            placeholder={`Hi! I'm ${member?.full_name?.split(" ")[0] ?? "[name]"} and I import quality products through UMOJA. Browse my collection below!`}
            value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="mt-1 rounded-2xl" />
        </div>
      </section>

      {/* Branding */}
      <section className="mt-4 rounded-3xl border border-border bg-gradient-card p-5">
        <Label>Accent color</Label>
        <div className="mt-2 flex items-center gap-3">
          <input type="color" value={form.accent_color}
            onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
            className="h-10 w-14 rounded-xl border border-border bg-transparent cursor-pointer" />
          <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
            className="rounded-2xl font-mono w-32" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Storefront is publicly visible
        </label>
      </section>

      {/* Live Preview */}
      <section className="mt-4 rounded-3xl border border-border bg-gradient-card p-5">
        <div className="flex items-center justify-between">
          <Label>Live preview</Label>
          <span className={`text-[11px] uppercase tracking-[0.18em] ${form.is_active ? "text-accent" : "text-muted-foreground"}`}>
            {form.is_active ? "Public" : "Hidden"}
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="aspect-[4/1] w-full bg-secondary/40 grid place-items-center" style={{ backgroundColor: form.banner_url ? undefined : `${form.accent_color}22` }}>
            {form.banner_url ? (
              <img src={form.banner_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Banner preview</span>
            )}
          </div>
          <div className="p-4 border-t-4" style={{ borderTopColor: form.accent_color }}>
            <h3 className="font-display text-xl" style={{ color: form.accent_color }}>
              {form.display_name || "Your shop"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
              {form.bio || "Your bio will appear here."}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
        {previewUrl && (
          <Link to={previewUrl} target="_blank" className="flex-1">
            <Button variant="outline" className="w-full rounded-2xl">Preview Storefront</Button>
          </Link>
        )}
        <Button onClick={save} disabled={saving}
          className="flex-1 rounded-2xl bg-gradient-gold text-amber-950">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
