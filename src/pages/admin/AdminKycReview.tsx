import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Phone, FileText, Camera } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  kyc_level: number;
  phone_verified: boolean | null;
  kyc_photo_url: string | null;
  kyc_document_url: string | null;
  kyc_submitted_at: string | null;
  kyc_rejection_reason: string | null;
}

const useSignedUrl = () => {
  const [cache, setCache] = useState<Record<string, string>>({});
  const get = async (bucket: string, path: string | null) => {
    if (!path) return null;
    const key = `${bucket}/${path}`;
    if (cache[key]) return cache[key];
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setCache((c) => ({ ...c, [key]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };
  return get;
};

export default function AdminKycReview() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("id, full_name, email, phone, kyc_level, phone_verified, kyc_photo_url, kyc_document_url, kyc_submitted_at, kyc_rejection_reason")
      .lt("kyc_level", 3)
      .not("kyc_submitted_at", "is", null)
      .order("kyc_submitted_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (r: Row) => {
    setBusyId(r.id);
    const { error } = await supabase
      .from("members")
      .update({ kyc_level: 3, kyc_verified_at: new Date().toISOString(), kyc_rejection_reason: null })
      .eq("id", r.id);
    if (!error) {
      await supabase.from("notifications").insert({
        member_id: r.id,
        title: "You're verified ✅",
        body: "KYC approved. Payouts are now unlocked.",
        kind: "kyc",
        link: "/profile",
      });
      await supabase.rpc("award_kyc_referral_bonus", { _member: r.id });
      if (r.email) {
        supabase.functions.invoke("send-email", {
          body: {
            template: "kyc_approved",
            to: r.email,
            member_id: r.id,
            bypass_prefs: true,
            data: { name: r.full_name },
          },
        }).catch(() => {});
      }
    }
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Approved & member notified");
    load();
  };

  const submitReject = async () => {
    if (!reject) return;
    if (reason.trim().length < 5) return toast.error("Add a brief reason");
    setBusyId(reject.id);
    const { error } = await supabase
      .from("members")
      .update({ kyc_rejection_reason: reason.trim(), kyc_submitted_at: null })
      .eq("id", reject.id);
    if (!error) {
      await supabase.from("notifications").insert({
        member_id: reject.id,
        title: "KYC needs another look",
        body: reason.trim(),
        kind: "kyc",
        link: "/kyc",
      });
    }
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Member notified to resubmit");
    setReject(null);
    setReason("");
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl">KYC review</h1>
      <p className="text-sm text-muted-foreground mt-1">Pending verification submissions.</p>

      {loading ? (
        <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-10 text-center text-sm text-muted-foreground">
          Nothing waiting for review.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <ReviewCard
              key={r.id}
              row={r}
              busy={busyId === r.id}
              onApprove={() => approve(r)}
              onReject={() => { setReject(r); setReason(""); }}
            />
          ))}
        </div>
      )}

      {reject && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur p-4" onClick={() => setReject(null)}>
          <div className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Reject KYC</p>
            <h3 className="font-display text-xl mt-1">{reject.full_name}</h3>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (will be shown to the member)"
              rows={4}
              className="mt-3 rounded-2xl"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setReject(null)} className="rounded-2xl">Cancel</Button>
              <Button onClick={submitReject} className="flex-1 rounded-2xl bg-destructive text-destructive-foreground">
                Send rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ row, busy, onApprove, onReject }: { row: Row; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const sign = useSignedUrl();
  const [photo, setPhoto] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);

  useEffect(() => {
    sign("kyc-photos", row.kyc_photo_url).then(setPhoto);
    sign("kyc-documents", row.kyc_document_url).then(setDoc);
    // eslint-disable-next-line
  }, [row.id]);

  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg">{row.full_name}</p>
          <p className="text-xs text-muted-foreground">{row.email ?? row.phone}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-1">
          Level {row.kyc_level} / 3
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-2xl bg-secondary/40 p-3">
          <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> Phone</div>
          <p className="mt-1 font-medium">{row.phone_verified ? "Verified" : "Not verified"}</p>
        </div>
        <div className="rounded-2xl bg-secondary/40 p-3">
          <div className="flex items-center gap-1 text-muted-foreground"><Camera className="h-3 w-3" /> Selfie</div>
          <p className="mt-1 font-medium">{row.kyc_photo_url ? "Uploaded" : "Missing"}</p>
        </div>
      </div>

      {photo && (
        <a href={photo} target="_blank" rel="noreferrer" className="mt-3 block">
          <img src={photo} alt="Selfie" className="rounded-2xl w-full max-h-64 object-cover" />
        </a>
      )}
      {doc && (
        <a href={doc} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs hover:bg-secondary">
          <FileText className="h-4 w-4 text-accent" /> Open address document
        </a>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="outline" disabled={busy} onClick={onReject} className="rounded-2xl">
          <XCircle className="h-4 w-4 mr-1" /> Reject
        </Button>
        <Button
          disabled={busy || !row.kyc_photo_url || !row.kyc_document_url || !row.phone_verified}
          onClick={onApprove}
          className="flex-1 rounded-2xl bg-gradient-gold text-amber-950"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>)}
        </Button>
      </div>
    </div>
  );
}
