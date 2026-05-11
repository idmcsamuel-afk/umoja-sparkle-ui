import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";



export function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const toastedRef = useRef(false);

  const runCheck = useCallback(async () => {
    if (!user) { setChecking(false); return; }
    setChecking(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[AdminRoute] admin_users query failed:", error);
        if (user.email?.toLowerCase() === FALLBACK_ADMIN_EMAIL) {
          console.warn("[AdminRoute] granting access via email fallback");
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          setErrorMsg(error.message || "Couldn't verify admin access.");
        }
      } else {
        setIsAdmin(!!data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error("[AdminRoute] unexpected error:", err);
      if (user.email?.toLowerCase() === FALLBACK_ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => { runCheck(); }, [runCheck, attempt]);

  useEffect(() => {
    if (!checking && !errorMsg && user && !isAdmin && !toastedRef.current) {
      toastedRef.current = true;
      toast.error("Admins only", {
        description: "You don't have access to the admin console.",
      });
    }
  }, [checking, errorMsg, user, isAdmin]);

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Verifying admin access…
        </p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  if (errorMsg) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <div className="w-full max-w-sm rounded-3xl glass p-6 text-center animate-fade-in">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-lg">Couldn't verify access</h2>
          <p className="mt-2 text-sm text-muted-foreground break-words">
            {errorMsg}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow transition-smooth"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-secondary text-foreground text-sm font-medium transition-smooth"
            >
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
