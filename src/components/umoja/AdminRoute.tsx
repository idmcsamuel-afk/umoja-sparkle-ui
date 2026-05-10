import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[AdminRoute] check", { userId: user.id, email: user.email, data, error });
      let allowed = !!data;
      if (!allowed && user.email?.toLowerCase() === "idmcsamuel@gmail.com") {
        console.warn("[AdminRoute] fallback admin access for idmcsamuel@gmail.com");
        allowed = true;
      }
      setIsAdmin(allowed);
      setChecking(false);
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
