"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  postAssistantChat,
  quickRepliesForAudience,
  welcomeForAudience,
  type AssistantAudience,
  type AssistantCard,
  type AssistantChatResult,
} from "@/lib/api/assistant.api";
import { useAuthStore } from "@/lib/stores/auth.store";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: AssistantCard[];
  quickReplies?: string[];
  meta?: Pick<AssistantChatResult, "intent" | "usedAi" | "audience">;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function audienceFromAuthRole(role?: string | null): AssistantAudience {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "organizer") return "organizer";
  if (r === "student") return "student";
  if (r === "stakeholder") return "mentor"; // refined by BE response
  return "guest";
}

export function SealAssistant() {
  const pathname = usePathname() || "";
  const params = useParams();
  const user = useAuthStore((s) => s.user);
  const initialAudience = audienceFromAuthRole(user?.role);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [focusEventId, setFocusEventId] = useState<number | undefined>();
  const [audience, setAudience] = useState<AssistantAudience>(initialAudience);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: welcomeForAudience(initialAudience),
      quickReplies: quickRepliesForAudience(initialAudience),
    },
  ]);
  const [isTeamChatOpen, setIsTeamChatOpen] = useState(false);

  useEffect(() => {
    const handleChatOpened = () => {
      setOpen(false);
      setIsTeamChatOpen(true);
    };
    const handleChatClosed = () => {
      setIsTeamChatOpen(false);
    };

    window.addEventListener("seal-chat-opened", handleChatOpened);
    window.addEventListener("seal-chat-closed", handleChatClosed);
    return () => {
      window.removeEventListener("seal-chat-opened", handleChatOpened);
      window.removeEventListener("seal-chat-closed", handleChatClosed);
    };
  }, []);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        window.dispatchEvent(new CustomEvent("seal-assistant-opened"));
      } else {
        window.dispatchEvent(new CustomEvent("seal-assistant-closed"));
      }
      return next;
    });
  };

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const focusEventIdRef = useRef<number | undefined>(undefined);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  focusEventIdRef.current = focusEventId;

  const contextEventId = useMemo(() => {
    const raw =
      (params?.id as string) ||
      (params?.eventId as string) ||
      undefined;
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && pathname.includes("/events/")) return n;
    return undefined;
  }, [params, pathname]);

  useEffect(() => {
    const next = audienceFromAuthRole(user?.role);
    setAudience(next);
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === "welcome") {
        return [
          {
            id: "welcome",
            role: "assistant",
            text: welcomeForAudience(next),
            quickReplies: quickRepliesForAudience(next),
          },
        ];
      }
      return prev;
    });
  }, [user?.role]);

  const mutation = useMutation({
    mutationFn: (message: string) => {
      const history = messagesRef.current
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text.slice(0, 500),
        }));

      return postAssistantChat({
        message,
        locale: "en",
        context: {
          eventId: contextEventId,
          focusEventId: focusEventIdRef.current || contextEventId,
          path: pathname,
        },
        history,
      });
    },
    onSuccess: (data) => {
      if (data.audience) setAudience(data.audience);
      if (typeof data.focusEventId === "number") {
        setFocusEventId(data.focusEventId);
      } else if (typeof data.factsUsed?.eventId === "number") {
        setFocusEventId(data.factsUsed.eventId as number);
      }
      const fallbackQuick = quickRepliesForAudience(
        data.audience || audience,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: data.reply,
          cards: data.cards,
          quickReplies:
            data.quickReplies?.length > 0 ? data.quickReplies : fallbackQuick,
          meta: {
            intent: data.intent,
            usedAi: data.usedAi,
            audience: data.audience,
          },
        },
      ]);
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        "Could not send your question. Please try again in a few seconds.";
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: String(msg),
          quickReplies: quickRepliesForAudience(audience),
        },
      ]);
    },
  });

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, mutation.isPending]);

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/reset") ||
    isTeamChatOpen
  ) {
    return null;
  }

  const send = (text: string) => {
    const message = text.trim();
    if (!message || mutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: message },
    ]);
    setInput("");
    mutation.mutate(message);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 select-none"
    >
      {open && (
        <div className="flex h-[min(560px,70vh)] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[24px] border border-border bg-background shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border bg-muted px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-orange-500" />
                <p className="font-semibold">SEAL Assistant</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Role-scoped · grounded in your data · no unsafe actions on your behalf
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto bg-orange-500 text-white"
                    : "bg-muted text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.meta && (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {msg.meta.audience ? `${msg.meta.audience} · ` : ""}
                    {msg.meta.intent}
                    {msg.meta.usedAi?.wording ? " · AI wording" : " · template"}
                  </p>
                )}
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.cards.map((card, idx) => (
                      <Link
                        key={`${card.href}-${idx}`}
                        href={card.href}
                        className={cn(
                          "block rounded-xl border px-3 py-2 transition-colors",
                          card.primary
                            ? "border-orange-400 bg-orange-100 text-foreground hover:bg-orange-200 dark:border-orange-600 dark:bg-orange-950 dark:hover:bg-orange-900"
                            : "border-border bg-background hover:border-orange-400",
                        )}
                      >
                        <p className="font-medium text-foreground">
                          {card.title}
                        </p>
                        {card.subtitle && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {card.subtitle}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" &&
                  msg.quickReplies &&
                  msg.quickReplies.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {msg.quickReplies.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={mutation.isPending}
                          onClick={() => send(q)}
                          className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-orange-400"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                Checking data for your role…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border bg-background p-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask within your role permissions…"
                className="h-10 rounded-xl bg-muted"
                disabled={mutation.isPending}
              />
              <Button
                type="submit"
                variant="orange"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                disabled={mutation.isPending || !input.trim()}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}

      <motion.div
        animate={open ? { y: 0 } : { y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
        className="relative"
      >
        {/* Pulsing Aura Ring */}
        {!open && (
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 opacity-50 blur-xs animate-pulse pointer-events-none" />
        )}

        <Button
          type="button"
          variant="orange"
          size="icon"
          className="relative h-14 w-14 rounded-full shadow-[0_0_30px_rgba(243,112,33,0.5)] border-2 border-orange-300/50 cursor-grab active:cursor-grabbing shrink-0 bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500"
          onClick={toggleOpen}
          title={open ? "Close Assistant" : "Open SEAL AI Assistant (Drag to move)"}
        >
          {open ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ rotate: [-4, 4, -4] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Bot className="h-7 w-7 text-white drop-shadow-md" />
              </motion.div>
              <motion.div
                animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-1.5 -right-2"
              >
                <Sparkles className="h-4 w-4 text-yellow-200 fill-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
              </motion.div>
            </div>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
