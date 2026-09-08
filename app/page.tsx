"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "groq" | "gemini";

type Conversation = {
  id: string;
  title: string;
  summary: string;
  provider: Provider;
  system_prompt: string;
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
  const [error, setError] = useState<string | null>(null);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
    setShowPromptPanel(false);
    setError(null);
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
    const tempId = "temp-" + Date.now();
    setInput("");
    setSending(true);
    setError(null);

    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: active.id, message: text }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        // Erreur renvoyée par le serveur (Groq/Gemini en échec, clé manquante, etc.)
        // — avant, ce cas ne faisait rien du tout côté UI.
        setError(data.error || "Erreur lors de l'envoi du message.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text); // on remet le texte pour ne pas le perdre
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "temp-" + Date.now() + 1,
          role: "assistant",
          content: data.response,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError("Impossible de contacter le serveur. Vérifie ta connexion.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function openPromptPanel() {
    if (!active) return;
    setPromptDraft(active.system_prompt || "");
    setShowPromptPanel(true);
  }

  async function saveSystemPrompt() {
    if (!active) return;
    setSavingPrompt(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: promptDraft }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Échec de l'enregistrement du prompt système.");
        return;
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, system_prompt: promptDraft } : c))
      );
      setShowPromptPanel(false);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSavingPrompt(false);
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
              <div className="flex items-center gap-3">
                <button
                  onClick={openPromptPanel}
                  className="font-mono text-xs px-3 py-1 border border-rule text-ink/70 hover:bg-rule/20"
                  title="Définir les instructions de base de l'IA pour cette conversation"
                >
                  prompt système
                </button>
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
              </div>
            </header>

            {showPromptPanel && (
              <div className="border-b border-rule px-6 py-4 bg-rule/10 space-y-2">
                <label className="font-mono text-[11px] text-ink/60">
                  Instructions de base (identité, ton, règles) pour cette conversation —
                  laisser vide pour garder le comportement par défaut.
                </label>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={6}
                  className="w-full bg-paper border border-rule px-3 py-2 text-sm outline-none focus:border-signal font-mono"
                  placeholder="Ex : Tu es RIKA, assistant direct et efficace. Pas de blabla. Réponses courtes..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSystemPrompt}
                    disabled={savingPrompt}
                    className="px-3 py-1.5 text-sm bg-signal text-paper disabled:opacity-40"
                  >
                    {savingPrompt ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    onClick={() => setShowPromptPanel(false)}
                    className="px-3 py-1.5 text-sm border border-rule text-ink/70"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="font-mono text-xs opacity-60 hover:opacity-100">
                  fermer
                </button>
              </div>
            )}

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
