import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isSubscribed, pushSupported, subscribePush, unsubscribePush } from "@/lib/push";

export default function EnablePushButton({ size = "sm" as const }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(pushSupported());
    isSubscribed().then(setOn).catch(() => setOn(false));
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await unsubscribePush();
        setOn(false);
        toast({ title: "Notifications off" });
      } else {
        await subscribePush();
        setOn(true);
        toast({ title: "Notifications enabled 🔔" });
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={on ? "secondary" : "default"} onClick={toggle} disabled={busy}>
      {on ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
      {on ? "Notifications on" : "Enable notifications"}
    </Button>
  );
}
