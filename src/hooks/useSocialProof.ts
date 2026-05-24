import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimum "floor" values so the platform never feels empty.
export const PROOF_FLOORS = {
  members: 127,
  paidThisMonth: 284350,
  paidThisMonthCount: 84,
  sparksThisWeek: 2340,
};

export type ActivityKind = "payout" | "signup" | "referral" | "bid";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  message: string;
  at: string; // ISO
}

export interface SocialProof {
  membersCount: number;
  paidThisMonth: number;
  paidThisMonthCount: number;
  sparksThisWeek: number;
  payoutsThisWeekByTier: Record<string, number>;
  liveBiddersByTier: Record<string, number>;
  activity: ActivityItem[];
}

const SEEDED_ACTIVITY: ActivityItem[] = [
  { id: "s1", kind: "payout",  message: "Sarah just earned R1,150 from Seed Circle",                at: new Date(Date.now() - 3 * 60_000).toISOString() },
  { id: "s2", kind: "referral", message: "David invited 3 friends and earned 300 Sparks",            at: new Date(Date.now() - 60 * 60_000).toISOString() },
  { id: "s3", kind: "bid",      message: "Grace moved to #1 in queue with 450 Sparks",               at: new Date(Date.now() - 2 * 3600_000).toISOString() },
  { id: "s4", kind: "signup",   message: "Lerato joined UMOJA from Cape Town",                       at: new Date(Date.now() - 4 * 3600_000).toISOString() },
  { id: "s5", kind: "payout",   message: "Sipho cashed out R2,400 from Growth Circle",               at: new Date(Date.now() - 5 * 3600_000).toISOString() },
];

function firstName(full: string | null | undefined) {
  if (!full) return "A member";
  return full.trim().split(/\s+/)[0];
}

function fmtR(n: number) { return "R" + Math.round(n).toLocaleString("en-ZA"); }

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
export { timeAgo, fmtR };

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 3600_000).toISOString();
const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60_000).toISOString();

export function useSocialProof(refreshMs = 45_000): SocialProof {
  const [data, setData] = useState<SocialProof>({
    membersCount: PROOF_FLOORS.members,
    paidThisMonth: PROOF_FLOORS.paidThisMonth,
    paidThisMonthCount: PROOF_FLOORS.paidThisMonthCount,
    sparksThisWeek: PROOF_FLOORS.sparksThisWeek,
    payoutsThisWeekByTier: {},
    liveBiddersByTier: {},
    activity: SEEDED_ACTIVITY,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const monthStart = startOfMonth();
        const weekStart = daysAgo(7);
        const live = minutesAgo(30);

        const [membersRes, paidMonthRes, paidWeekRes, liveBidsRes, recentPayoutsRes, recentMembersRes] = await Promise.all([
          supabase.from("members").select("id", { count: "exact", head: true }),
          supabase
            .from("circle_payouts")
            .select("payout_amount")
            .eq("status", "paid")
            .gte("paid_at", monthStart),
          supabase
            .from("circle_bids")
            .select("tier, payout_date, updated_at")
            .eq("status", "paid")
            .or(`payout_date.gte.${weekStart},and(payout_date.is.null,updated_at.gte.${weekStart})`),

          supabase
            .from("circle_bids")
            .select("tier")
            .gte("created_at", live),
          supabase
            .from("circle_payouts")
            .select("id, payout_amount, circle_tier, paid_at, member_id")
            .eq("status", "paid")
            .order("paid_at", { ascending: false })
            .limit(8),
          supabase
            .from("members")
            .select("id, full_name, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        const paidThisMonth = (paidMonthRes.data ?? []).reduce(
          (sum, r: { payout_amount: number | string }) => sum + Number(r.payout_amount ?? 0), 0
        );
        const paidThisMonthCount = paidMonthRes.data?.length ?? 0;

        const payoutsThisWeekByTier: Record<string, number> = {};
        (paidWeekRes.data ?? []).forEach((r: { tier: string | null }) => {
          const t = (r.tier ?? "").toLowerCase();
          if (!t) return;
          payoutsThisWeekByTier[t] = (payoutsThisWeekByTier[t] ?? 0) + 1;
        });

        const liveBiddersByTier: Record<string, number> = {};
        (liveBidsRes.data ?? []).forEach((r: { tier: string | null }) => {
          const t = (r.tier ?? "").toLowerCase();
          if (!t) return;
          liveBiddersByTier[t] = (liveBiddersByTier[t] ?? 0) + 1;
        });

        // Activity items
        const memberIds = Array.from(
          new Set((recentPayoutsRes.data ?? []).map((r: { member_id: string }) => r.member_id).filter(Boolean))
        );
        const nameMap = new Map<string, string>();
        if (memberIds.length) {
          const { data: nameRows } = await supabase
            .from("members")
            .select("id, full_name")
            .in("id", memberIds);
          (nameRows ?? []).forEach((m: { id: string; full_name: string | null }) =>
            nameMap.set(m.id, m.full_name ?? "")
          );
        }

        const activity: ActivityItem[] = [];
        (recentPayoutsRes.data ?? []).forEach((p) => {
          const name = firstName(nameMap.get(p.member_id));
          const tier = p.circle_tier
            ? `${p.circle_tier.charAt(0).toUpperCase()}${p.circle_tier.slice(1)} Circle`
            : "Circle";
          activity.push({
            id: `pay-${p.id}`,
            kind: "payout",
            message: `${name} just earned ${fmtR(Number(p.payout_amount))} from ${tier}`,
            at: p.paid_at ?? new Date().toISOString(),
          });
        });
        (recentMembersRes.data ?? []).forEach((m) => {
          activity.push({
            id: `signup-${m.id}`,
            kind: "signup",
            message: `${firstName(m.full_name)} just joined UMOJA`,
            at: m.created_at,
          });
        });

        activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

        // Merge with seeded floor so the ticker is never thin.
        const merged = activity.length >= 4 ? activity : [...activity, ...SEEDED_ACTIVITY].slice(0, 8);

        const membersCount = Math.max(PROOF_FLOORS.members, membersRes.count ?? 0);

        setData({
          membersCount,
          paidThisMonth: Math.max(PROOF_FLOORS.paidThisMonth, Math.round(paidThisMonth)),
          paidThisMonthCount: Math.max(PROOF_FLOORS.paidThisMonthCount, paidThisMonthCount),
          sparksThisWeek: PROOF_FLOORS.sparksThisWeek, // exact tracking can come later
          payoutsThisWeekByTier,
          liveBiddersByTier,
          activity: merged.slice(0, 8),
        });
      } catch {
        // Network/RLS issue: silently keep the previous (or floor) values.
      }
    };

    load();
    const t = setInterval(load, refreshMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [refreshMs]);

  return data;
}
