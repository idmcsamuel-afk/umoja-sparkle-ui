import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/umoja/Logo";
import { Loader2 } from "lucide-react";

type AuthDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

// Typed wrapper — supabase.auth.oauth namespace is beta.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-hero" />
      <header className="px-5 pt-6">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo />
        </div>
      </header>
      <section className="px-5 pt-14">
        <div className="mx-auto max-w-md">
          {error ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-destructive">Authorization error</p>
              <h1 className="mt-3 font-display text-[32px] leading-[1.1]">Could not load this request</h1>
              <p className="mt-4 text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading authorization…</span>
            </div>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-accent">Authorize access</p>
              <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-tight">
                Connect{" "}
                <span className="text-gradient-gold italic font-[450]">
                  {details.client?.name ?? "this app"}
                </span>{" "}
                to your UMOJA account
              </h1>
              <p className="mt-4 text-muted-foreground">
                {details.client?.name ?? "This app"} will be able to use UMOJA tools as you. You can revoke access anytime.
              </p>
              <div className="mt-8 flex gap-3">
                <Button
                  disabled={busy}
                  onClick={() => decide(true)}
                  className="flex-1 h-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => decide(false)}
                  variant="outline"
                  className="flex-1 h-12 rounded-2xl"
                >
                  Deny
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
