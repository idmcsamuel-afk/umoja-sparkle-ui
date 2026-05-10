import { useEffect, useRef, useState } from "react";
import { Flame, X, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Msg { role: "user" | "assistant"; content: string }

const STARTERS = [
  "How do I maximise my Circle returns?",
  "Which products should I trade?",
  "How do I qualify for Drive?",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi, I'm Flame 🔥 — UMOJA's wealth guide. Ask me about Circles, Spark Trade, Drive, or building community wealth.",
};

export const FlameChat = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("flame-ai", {
        body: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      const reply = (data as { reply?: string; error?: string })?.reply
        ?? "Sorry, I'm having trouble reaching the gateway right now.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Network hiccup — please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Flame AI"
        className={`fixed z-50 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-all hover-scale ${open ? "scale-90 opacity-0 pointer-events-none" : ""}`}
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
        <Flame className="relative h-6 w-6" strokeWidth={2.2} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md h-[85vh] sm:h-[640px] sm:rounded-3xl rounded-t-3xl border border-border bg-gradient-card shadow-soft flex flex-col overflow-hidden animate-slide-up">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <Flame className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="font-display text-lg leading-tight">Flame</p>
                  <p className="text-[11px] text-muted-foreground">UMOJA wealth advisor · GPT-4o</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  {m.role === "assistant" ? (
                    <div className="max-w-[85%] text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl bg-gradient-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-glow whitespace-pre-wrap">
                      {m.content}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Flame is thinking…
                </div>
              )}

              {messages.length <= 1 && !busy && (
                <div className="pt-2 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Try asking</p>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm hover:border-primary/50 hover:bg-secondary/70 transition-smooth flex items-center gap-2 group"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="flex-1">{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="border-t border-border px-3 py-3 flex items-center gap-2 bg-background/40 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Flame anything…"
                disabled={busy}
                className="h-12 rounded-2xl bg-secondary/60 border-border"
              />
              <Button
                type="submit"
                disabled={busy || !input.trim()}
                className="h-12 w-12 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow shrink-0 p-0"
                aria-label="Send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
