import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shared read-only Spark balance.
 * Uses the SAME source the home page / SparkBalanceWidget reads:
 * the spark_balance_breakdown RPC over spark_wallets, plus realtime
 * updates on spark_wallets so spends and refunds appear immediately.
 */
export function useSparkBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawable, setWithdrawable] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setWithdrawable(null);
      return;
    }
    const { data } = await supabase.rpc("spark_balance_breakdown", { _member: user.id });
    const b = data as unknown as
      | { total?: number; total_playable?: number; total_withdrawable?: number; withdrawable?: number }
      | null;
    if (!b) return;
    setBalance(Number(b.total_playable ?? b.total ?? 0));
    setWithdrawable(Number(b.total_withdrawable ?? b.withdrawable ?? 0));
  }, [user?.id]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel("spark-balance-" + user.id + "-" + Math.random().toString(36).slice(2, 9))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spark_wallets", filter: `member_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, refresh]);

  return { balance, withdrawable, refresh };
}
