import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface MemberProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  rank: string | null;
  has_buyers_club_access: boolean | null;
  referral_code: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  member: MemberProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMember = async (uid: string) => {
    const { data } = await supabase
      .from("members")
      .select("id, full_name, email, phone, rank, has_buyers_club_access, referral_code")
      .eq("id", uid)
      .maybeSingle();
    setMember(data as MemberProfile | null);
  };

  const applyPendingReferral = async () => {
    try {
      const code = (localStorage.getItem("umoja_referral_code") ?? "").toUpperCase();
      if (!code) return;
      console.log("[useAuth] pending referral code found, applying:", code);
      // Always try claim_signup_bonus first (no-op if wallet exists)
      await supabase.rpc("claim_signup_bonus");
      const { data: res, error } = await supabase.rpc("apply_referral_signup", { _code: code });
      console.log("[useAuth] apply_referral_signup deferred result:", { res, error });
      const r = res as { ok?: boolean; reason?: string } | null;
      if (!error && r?.ok) {
        localStorage.removeItem("umoja_referral_code");
      } else if (r?.reason === "already_referred" || r?.reason === "invalid_code") {
        // Don't keep retrying for terminal failures
        localStorage.removeItem("umoja_referral_code");
      }
    } catch (e) {
      console.warn("[useAuth] applyPendingReferral failed", e);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadMember(s.user.id);
          applyPendingReferral();
        }, 0);
      } else {
        setMember(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadMember(s.user.id).finally(() => setLoading(false));
        applyPendingReferral();
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshMember = async () => {
    if (user) await loadMember(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, member, loading, signOut, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
