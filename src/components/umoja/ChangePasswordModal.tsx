import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  userId: string;
  title?: string;
  subtitle?: string;
  canDismiss?: boolean;
  onPasswordChanged: () => void;
}

export function ChangePasswordModal({
  open,
  userId,
  title = "Set a new password",
  subtitle = "Your password was reset by an administrator. Choose a new password to continue.",
  canDismiss = false,
  onPasswordChanged,
}: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return setError("Passwords do not match");

    setBusy(true);
    const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
    if (authErr) {
      setBusy(false);
      return setError(authErr.message);
    }
    await supabase
      .from("members")
      .update({
        force_password_change: false,
        last_password_changed: new Date().toISOString(),
      } as never)
      .eq("id", userId);

    setBusy(false);
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
    onPasswordChanged();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && canDismiss) onPasswordChanged(); }}>
      <DialogContent
        className="z-[9999] max-w-md"
        onPointerDownOutside={(e) => { if (!canDismiss) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!canDismiss) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-center">{subtitle}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">New password</Label>
            <PasswordInput
              id="new-pwd"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12 rounded-2xl bg-secondary/60 border-border"
              placeholder="At least 8 characters"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confirm password</Label>
            <PasswordInput
              id="confirm-pwd"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-2xl bg-secondary/60 border-border"
              placeholder="Re-enter password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
