"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "groq" | "gemini";

type Conversation = {
  id: string;
  title: string;
  summary: string;
  provider: Provider;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function refreshConversations() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
    if (!activeId && data.conversations?.length) setActiveId(data.conversations[0].id);
  }

  async function loadMessages(conversationId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }

  async function createConversation() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nouvelle conversation", provider: "groq" }),
    });
    const data = await res.json();
    await refreshConversations();
    setActiveId(data.conversation.id);
  }

  async function changeProvider(provider: Provider) {
    if (!active) return;
    await fetch(`/api/conversations/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, provider } : c))
    );
  }

  async function sendMessage() {
    if (!active || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), role: "user", content: text, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: active.id, message: text }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: "temp-" + Date.now() + 1,
            role: "assistant",
            content: data.response,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex h-screen">
      {/* Sidebar — liste des conversations, présentée comme un index de fiches */}
      <aside className="w-72 shrink-0 border-r border-rule flex flex-col">
        <div className="px-5 py-4 border-b border-rule">
          <h1 className="font-mono text-sm tracking-tight text-ink">ia perso</h1>
          <button
            onClick={createConversation}
            className="mt-3 w-full text-left text-sm border border-rule px-3 py-2 text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            + nouvelle conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-5 py-3 border-b border-rule/60 transition-colors ${
                c.id === activeId ? "bg-ink text-paper" : "hover:bg-rule/20"
              }`}
            >
              <div className="text-sm truncate">{c.title}</div>
              <div className="font-mono text-[11px] opacity-60 mt-0.5">{c.provider}</div>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-5 py-4 text-sm text-ink/60">Aucune conversation pour l&apos;instant.</p>
          )}
        </div>
      </aside>

      {/* Panneau principal */}
      <section className="flex-1 flex flex-col">
        {active ? (
          <>
            <header className="flex items-center justify-between px-6 py-4 border-b border-rule">
              <h2 className="text-sm text-ink/80 truncate">{active.title}</h2>
              <div className="flex gap-1 font-mono text-xs">
                {(["groq", "gemini"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => changeProvider(p)}
                    className={`px-3 py-1 border border-rule ${
                      active.provider === p ? "bg-signal text-paper border-signal" : "text-ink/70"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={`inline-block max-w-[70%] px-4 py-2 text-sm text-left whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-ink text-paper"
                        : "bg-paper border border-rule text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && <p className="font-mono text-xs text-ink/50">l&apos;IA réfléchit…</p>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="border-t border-rule px-6 py-4 flex gap-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écris un message…"
                className="flex-1 bg-transparent border border-rule px-3 py-2 text-sm outline-none focus:border-signal"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 text-sm bg-signal text-paper disabled:opacity-40"
              >
                Envoyer
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink/50 text-sm">
            Crée une conversation pour commencer.
          </div>
        )}
      </section>
    </main>
  );
}
