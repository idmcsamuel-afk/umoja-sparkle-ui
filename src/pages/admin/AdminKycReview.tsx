import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, CheckCircle2, XCircle, Phone, FileText, Camera, Mail, AlertTriangle, ShieldCheck, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface Row {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  kyc_level: number;
  kyc_status: string | null;
  phone_verified: boolean | null;
  kyc_photo_url: string | null;
  kyc_document_url: string | null;
  kyc_submitted_at: string | null;
  kyc_rejection_reason: string | null;
  kyc_override_reason: string | null;
  kyc_override_by: string | null;
  kyc_last_reminder_at: string | null;
  kyc_reminder_count: number | null;
  kyc_verified_at: string | null;
}

const SUGGESTED_REASONS = [
  "Verified via video call",
  "Known community member",
  "Documents verified offline",
  "Manual phone verification completed",
];

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

function missingItems(r: Row) {
  const items: string[] = [];
  if (!r.kyc_photo_url) items.push("Upload selfie photo");
  if (!r.phone_verified) items.push("Verify phone number");
  if (!r.kyc_document_url) items.push("Upload address document");
  return items;
}
function completedCount(r: Row) {
  return 3 - missingItems(r).length;
}

export default function AdminKycReview() {
  const [pending, setPending] = useState<Row[]>([]);
  const [approved, setApproved] = useState<Row[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [override, setOverride] = useState<{ row: Row; step: 1 | 2; reason: string } | null>(null);

  const cols =
    "id, full_name, email, phone, kyc_level, kyc_status, phone_verified, kyc_photo_url, kyc_document_url, kyc_submitted_at, kyc_rejection_reason, kyc_override_reason, kyc_override_by, kyc_last_reminder_at, kyc_reminder_count, kyc_verified_at";

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from("members").select(cols).lt("kyc_level", 3).not("kyc_submitted_at", "is", null)
        .order("kyc_submitted_at", { ascending: false }),
      supabase.from("members").select(cols).eq("kyc_level", 3)
        .order("kyc_verified_at", { ascending: false }).limit(50),
    ]);
    const pendingRows = (p ?? []) as Row[];
    const approvedRows = (a ?? []) as Row[];
    setPending(pendingRows);
    setApproved(approvedRows);

    // Resolve admin names for override rows
    const adminIds = Array.from(new Set(approvedRows.map((r) => r.kyc_override_by).filter(Boolean) as string[]));
    if (adminIds.length) {
      const { data: admins } = await supabase.from("members").select("id, full_name").in("id", adminIds);
      const map: Record<string, string> = {};
      (admins ?? []).forEach((m: any) => { map[m.id] = m.full_name; });
      setAdminNames(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (r: Row, overrideReason?: string) => {
    setBusyId(r.id);
    const { error } = await supabase.rpc("admin_approve_kyc", {
      _member: r.id,
      _override_reason: overrideReason ?? null,
    });
    if (!error && r.email) {
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
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(overrideReason ? "Approved with override" : "Approved & member notified");
    setOverride(null);
    load();
  };

  const sendReminder = async (r: Row) => {
    if (!r.email) return toast.error("Member has no email on file");
    setBusyId(r.id);
    const { error } = await supabase.rpc("admin_record_kyc_reminder", { _member: r.id });
    if (error) {
      setBusyId(null);
      return toast.error(error.message);
    }
    const { error: mailErr } = await supabase.functions.invoke("send-email", {
      body: {
        template: "kyc_reminder",
        to: r.email,
        member_id: r.id,
        bypass_prefs: true,
        data: { name: r.full_name, missing: missingItems(r) },
      },
    });
    setBusyId(null);
    if (mailErr) return toast.error("Reminder logged but email failed");
    toast.success(`Reminder sent to ${r.email}`);
    load();
  };

  const submitReject = async () => {
    if (!reject) return;
    if (reason.trim().length < 5) return toast.error("Add a brief reason");
    setBusyId(reject.id);
    const { error } = await supabase.from("members")
      .update({ kyc_rejection_reason: reason.trim(), kyc_submitted_at: null })
      .eq("id", reject.id);
    if (!error) {
      await supabase.from("notifications").insert({
        member_id: reject.id, title: "KYC needs another look",
        body: reason.trim(), kind: "kyc", link: "/kyc",
      });
      if (reject.email) {
        supabase.functions.invoke("send-email", {
          body: {
            template: "kyc_rejected", to: reject.email, member_id: reject.id, bypass_prefs: true,
            data: { name: reject.full_name, reason: reason.trim() },
          },
        }).catch(() => {});
      }
    }
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Member notified to resubmit");
    setReject(null);
    setReason("");
    load();
  };

  const revert = async (r: Row) => {
    if (!confirm(`Revert KYC approval for ${r.full_name}? They will need to resubmit.`)) return;
    setBusyId(r.id);
    const { error } = await supabase.rpc("admin_revert_kyc", { _member: r.id, _reason: "Reverted by admin for re-verification" });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("KYC reverted");
    load();
  };

  return (
    <TooltipProvider>
      <div>
        <h1 className="font-display text-3xl">KYC review</h1>
        <p className="text-sm text-muted-foreground mt-1">Pending verification submissions.</p>

        {loading ? (
          <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {pending.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-10 text-center text-sm text-muted-foreground">
                Nothing waiting for review.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {pending.map((r) => (
                  <ReviewCard
                    key={r.id}
                    row={r}
                    busy={busyId === r.id}
                    onApprove={() => approve(r)}
                    onApproveAnyway={() => setOverride({ row: r, step: 1, reason: "" })}
                    onReject={() => { setReject(r); setReason(""); }}
                    onReminder={() => sendReminder(r)}
                  />
                ))}
              </div>
            )}

            <h2 className="font-display text-2xl mt-10">Recently approved</h2>
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-2">No approvals yet.</p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {approved.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-gradient-card p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email ?? r.phone}</p>
                    </div>
                    {r.kyc_override_reason ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1">
                            <AlertTriangle className="h-3 w-3" /> Override
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium">Override reason</p>
                          <p className="text-xs mt-1">{r.kyc_override_reason}</p>
                          {r.kyc_override_by && (
                            <p className="text-xs mt-1 text-muted-foreground">
                              By: {adminNames[r.kyc_override_by] ?? r.kyc_override_by.slice(0, 8)}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-1">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => revert(r)}
                      title="Revert approval (resets KYC so member must resubmit)"
                      className="shrink-0 h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Reject modal */}
        {reject && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur p-4" onClick={() => setReject(null)}>
            <div className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Reject KYC</p>
              <h3 className="font-display text-xl mt-1">{reject.full_name}</h3>
              <Textarea
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (will be shown to the member)"
                rows={4} className="mt-3 rounded-2xl"
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

        {/* Override modal */}
        {override && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur p-4" onClick={() => setOverride(null)}>
            <div className="w-full max-w-md rounded-3xl border border-border bg-gradient-card p-5" onClick={(e) => e.stopPropagation()}>
              {override.step === 1 ? (
                <>
                  <div className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-[11px] uppercase tracking-[0.22em]">Incomplete verification</p>
                  </div>
                  <h3 className="font-display text-xl mt-2">{override.row.full_name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">This member has not completed all KYC steps:</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {missingItems(override.row).map((m) => (
                      <li key={m} className="flex items-center gap-2">☐ {m}</li>
                    ))}
                  </ul>
                  <p className="text-sm mt-4">Are you sure you want to approve anyway?</p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="ghost" onClick={() => setOverride(null)} className="rounded-2xl">Cancel</Button>
                    <Button
                      onClick={() => setOverride({ ...override, step: 2 })}
                      className="flex-1 rounded-2xl bg-gradient-gold text-amber-950"
                    >
                      Yes, Approve
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Override reason</p>
                  <h3 className="font-display text-xl mt-1">Why are you approving incomplete verification?</h3>
                  <Textarea
                    value={override.reason}
                    onChange={(e) => setOverride({ ...override, reason: e.target.value })}
                    placeholder="Required — explain the override"
                    rows={3}
                    className="mt-3 rounded-2xl"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED_REASONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setOverride({ ...override, reason: s })}
                        className="text-xs rounded-full border border-border px-3 py-1 hover:bg-secondary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="ghost" onClick={() => setOverride(null)} className="rounded-2xl">Cancel</Button>
                    <Button
                      disabled={override.reason.trim().length < 4 || busyId === override.row.id}
                      onClick={() => approve(override.row, override.reason.trim())}
                      className="flex-1 rounded-2xl bg-gradient-gold text-amber-950"
                    >
                      {busyId === override.row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Approval"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function ReviewCard({
  row, busy, onApprove, onApproveAnyway, onReject, onReminder,
}: {
  row: Row; busy: boolean;
  onApprove: () => void; onApproveAnyway: () => void; onReject: () => void; onReminder: () => void;
}) {
  const sign = useSignedUrl();
  const [photo, setPhoto] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const complete = completedCount(row);
  const isComplete = complete === 3;

  useEffect(() => {
    sign("kyc-photos", row.kyc_photo_url).then(setPhoto);
    sign("kyc-documents", row.kyc_document_url).then(setDoc);
    // eslint-disable-next-line
  }, [row.id]);

  const reminderAgo = useMemo(() => {
    if (!row.kyc_last_reminder_at) return null;
    const diffMs = Date.now() - new Date(row.kyc_last_reminder_at).getTime();
    const hrs = Math.floor(diffMs / 3_600_000);
    if (hrs < 1) return "< 1h ago";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [row.kyc_last_reminder_at]);

  const reminderBlocked = !!row.kyc_last_reminder_at &&
    Date.now() - new Date(row.kyc_last_reminder_at).getTime() < 24 * 3_600_000;

  const StatusRow = ({ ok, label, icon: Icon }: { ok: boolean; label: string; icon: any }) => (
    <div className={`rounded-2xl p-3 ${ok ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={`mt-1 text-sm font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
        {ok ? "✓ Complete" : "⚠️ Missing"}
      </p>
    </div>
  );

  return (
    <div className="rounded-3xl border border-border bg-gradient-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg truncate">{row.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email ?? row.phone}</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-1">
          {complete}/3 complete
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatusRow ok={!!row.kyc_photo_url} label="Photo" icon={Camera} />
        <StatusRow ok={!!row.phone_verified} label="Phone" icon={Phone} />
        <StatusRow ok={!!row.kyc_document_url} label="Address" icon={FileText} />
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

      {(row.kyc_reminder_count ?? 0) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reminder sent {row.kyc_reminder_count}× {reminderAgo ? `· last ${reminderAgo}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={onReject} className="rounded-2xl">
          <XCircle className="h-4 w-4 mr-1" /> Reject
        </Button>

        {isComplete ? (
          <Button
            disabled={busy}
            onClick={onApprove}
            className="flex-1 rounded-2xl bg-gradient-gold text-amber-950"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>)}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={busy || reminderBlocked || !row.email}
              onClick={onReminder}
              className="rounded-2xl border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              title={reminderBlocked ? "Already reminded in the last 24h" : ""}
            >
              <Mail className="h-4 w-4 mr-1" /> Send Reminder
            </Button>
            <Button
              disabled={busy}
              onClick={onApproveAnyway}
              className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Anyway
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
