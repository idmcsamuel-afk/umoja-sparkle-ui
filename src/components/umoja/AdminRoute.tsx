import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const FALLBACK_ADMIN_EMAIL = "idmcsamuel@gmail.com";

export function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    (async () => {
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
          }
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error("[AdminRoute] unexpected error:", err);
        if (user.email?.toLowerCase() === FALLBACK_ADMIN_EMAIL) {
          setIsAdmin(true);
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [user]);

  if (loading || checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
