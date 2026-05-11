import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  trigger: React.ReactNode;
}

export const ContactModal = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          template: "contact_form",
          to: "support@umojarise.com",
          bypass_prefs: true,
          data: {
            from_name: form.name,
            from_email: form.email,
            subject: `Message from ${form.name}`,
            message: form.message,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Message sent", description: "We'll reply within 24 hours." });
      setForm({ name: "", email: "", message: "" });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Couldn't send",
        description: err instanceof Error ? err.message : "Try again shortly.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact UMOJA</DialogTitle>
          <DialogDescription>We'll reply within 24 hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-name">Name</Label>
            <Input id="cf-name" maxLength={100} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-email">Email</Label>
            <Input id="cf-email" type="email" maxLength={255} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf-msg">Message</Label>
            <Textarea id="cf-msg" maxLength={2000} required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Send message"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
