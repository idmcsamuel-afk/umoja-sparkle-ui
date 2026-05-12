import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function ActiveUsersBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      if (user) await supabase.rpc("touch_last_seen");
      const { data } = await supabase.rpc("active_members_count");
      if (!cancelled) setCount(typeof data === "number" ? data : Number(data ?? 0));
    };
    ping();
    const i = window.setInterval(ping, 30000);
    return () => { cancelled = true; window.clearInterval(i); };
  }, [user]);

  if (count === null) return null;
  const dot = count >= 10 ? "🟢" : count >= 5 ? "🟡" : "⚪";
  return (
    <div
      title={`${count} member${count === 1 ? "" : "s"} active in last 5 minutes`}
      className="hidden sm:inline-flex items-center gap-1.5 rounded-full glass px-2.5 h-10 text-xs font-medium"
    >
      <span>{dot}</span>
      <span>{count} online</span>
    </div>
  );
}
