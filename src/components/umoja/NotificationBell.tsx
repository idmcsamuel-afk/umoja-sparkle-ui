import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string | null;
}

export const NotificationBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("member_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAll = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("member_id", user.id)
      .is("read_at", null);
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative grid h-10 w-10 place-items-center rounded-2xl glass">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 px-1 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl border-border bg-gradient-card p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs inline-flex items-center gap-1 text-accent">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y divide-border">
          {items.length === 0 ? (
            <li className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</li>
          ) : items.map((n) => (
            <li key={n.id} className={`p-3 ${n.read_at ? "opacity-70" : ""}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
              {n.created_at && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
