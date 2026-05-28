import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Check, X, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/umoja/Logo";
import { BottomNav } from "@/components/umoja/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChangePasswordModal } from "@/components/umoja/ChangePasswordModal";

const COUNTRIES = [
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "NG", label: "Nigeria",      flag: "🇳🇬" },
  { code: "KE", label: "Kenya",        flag: "🇰🇪" },
  { code: "ZW", label: "Zimbabwe",     flag: "🇿🇼" },
  { code: "ZM", label: "Zambia",       flag: "🇿🇲" },
  { code: "MZ", label: "Mozambique",   flag: "🇲🇿" },
];

type ProfileRow = {
  full_name: string;
  email: string | null;
  phone: string;
  country_code: string | null;
  status: string | null;
  created_at: string | null;
};

export default function Profile() {
  const { user, signOut } = useAuth();
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    country_code: "ZA",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("full_name, email, phone, country_code, status, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setRow(data as ProfileRow);
        setForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          country_code: data.country_code ?? "ZA",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const country = COUNTRIES.find((c) => c.code === (row?.country_code ?? "ZA"));
  const editCountry = COUNTRIES.find((c) => c.code === form.country_code) ?? COUNTRIES[0];

  const save = async () => {
    if (!user) return;
    if (form.full_name.trim().length < 2) return toast.error("Enter your full name");
    if (form.phone.trim().length < 5) return toast.error("Enter your phone number");
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        country_code: form.country_code,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setRow((r) => r ? { ...r, ...form } : r);
    setEditing(false);
    toast.success("Profile updated successfully");
  };

  return (
    <main className="relative min-h-screen pb-32">
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link to="/dashboard" className="grid h-10 w-10 place-items-center rounded-2xl glass">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="w-10" />
        </div>
      </header>

      <section className="px-5 pt-6">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Profile</p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight">
            {row?.full_name ?? "Member"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Shared across all UMOJA products (Circles, Spark Trade, Drive, Real Estate)
          </p>

          {loading ? (
            <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !editing ? (
            <>
              <div className="mt-6 rounded-3xl glass p-5 space-y-3 text-sm">
                <Row label="Full name" value={row?.full_name ?? "—"} />
                <Row label="Email" value={row?.email ?? "—"} />
                <Row label="Country" value={country ? `${country.flag} ${country.label}` : "—"} />
                <Row label="Phone" value={row?.phone ?? "—"} />
                <Row label="Member since" value={row?.created_at ? new Date(row.created_at).toLocaleDateString() : (user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—")} />
                <Row
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {row?.status ?? "Active"}
                    </span>
                  }
                />
              </div>

              <Button
                onClick={() => setEditing(true)}
                className="mt-4 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
              <Button onClick={() => setPwOpen(true)} variant="outline" className="mt-3 w-full rounded-2xl">
                <Lock className="mr-2 h-4 w-4" /> Change password
              </Button>
              <Link to="/profile/banking" className="mt-3 block">
                <Button variant="outline" className="w-full rounded-2xl">Banking & payouts</Button>
              </Link>
              <Button variant="outline" className="mt-3 w-full rounded-2xl" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <div className="mt-6 rounded-3xl glass p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="h-11 rounded-2xl bg-secondary/60 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                <div className="flex gap-2">
                  <Input value={row?.email ?? ""} readOnly className="h-11 rounded-2xl bg-secondary/30 border-border opacity-70" />
                  <Button
                    type="button" variant="outline" className="rounded-2xl whitespace-nowrap"
                    onClick={() => toast.message("Email changes require password confirmation — coming soon")}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Change
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Country</Label>
                <Select value={form.country_code} onValueChange={(v) => setForm((f) => ({ ...f, country_code: v }))}>
                  <SelectTrigger className="h-11 rounded-2xl bg-secondary/60 border-border">
                    <SelectValue><span className="mr-2">{editCountry.flag}</span>{editCountry.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="mr-2">{c.flag}</span>{c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Affects which products and pricing are available in each section.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone number</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-11 rounded-2xl bg-secondary/60 border-border"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={save} disabled={saving} className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="mr-1 h-4 w-4" /> Save Changes</>)}
                </Button>
                <Button onClick={() => setEditing(false)} variant="outline" className="h-12 rounded-2xl">
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {user && pwOpen && (
        <ChangePasswordModal
          open
          userId={user.id}
          onPasswordChanged={() => { setPwOpen(false); toast.success("Password updated"); }}
        />
      )}
      <BottomNav />
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
