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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
    setShowPromptPanel(false);
    setEditingTitle(false);
    setError(null);
  }, [activeId]);

  // Recharge les messages/la liste quand on revient sur l'onglet (ex: message
  // envoyé depuis un autre appareil/onglet pendant que celui-ci était en arrière-plan).
  useEffect(() => {
    function handleFocus() {
      refreshConversations();
      if (activeId) loadMessages(activeId);
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleFocus();
    });
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function refreshConversations() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error || "Impossible de charger les conversations.");
      return;
    }
    const list = data.conversations ?? [];
    setConversations(list);

    if (!activeId && list.length) {
      const savedId = localStorage.getItem("rika-active-conversation");
      const stillExists = savedId && list.some((c: Conversation) => c.id === savedId);
      setActiveId(stillExists ? savedId : list[0].id);
    }
  }

  function selectConversation(id: string) {
    setActiveId(id);
    localStorage.setItem("rika-active-conversation", id);
    loadMessages(id);
  }

  async function loadMessages(conversationId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error || "Impossible de charger les messages.");
      return;
    }
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
    localStorage.setItem("rika-active-conversation", data.conversation.id);
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

  function startEditTitle() {
    if (!active) return;
    setTitleDraft(active.title);
    setEditingTitle(true);
  }

  async function saveTitle() {
    if (!active || !titleDraft.trim()) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Échec du renommage.");
        return;
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, title: titleDraft.trim() } : c))
      );
      setEditingTitle(false);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSavingTitle(false);
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
    <main className="flex h-screen bg-bg font-sans">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-rule flex flex-col bg-panel">
        <div className="px-5 py-4 border-b border-rule">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent" />
            <h1 className="font-mono text-sm font-medium tracking-wide text-ink">RIKA</h1>
          </div>
          <button
            onClick={createConversation}
            className="mt-3 w-full text-left text-sm border border-rule px-3 py-2 text-dim hover:border-accent hover:text-ink transition-colors font-mono"
          >
            + nouvelle conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={`w-full text-left px-5 py-3 border-b border-rule/60 transition-colors ${
                c.id === activeId ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className={`text-sm truncate ${c.id === activeId ? "text-ink" : "text-dim"}`}>
                {c.title}
              </div>
              <div className="font-mono text-[11px] text-dim/70 mt-0.5">{c.provider}</div>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-5 py-4 text-sm text-dim">Aucune conversation pour l&apos;instant.</p>
          )}
        </div>
      </aside>

      {/* Panneau principal */}
      <section className="flex-1 flex flex-col bg-bg">
        {active ? (
          <>
            <header className="flex items-center justify-between px-6 py-4 border-b border-rule">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  disabled={savingTitle}
                  className="text-sm text-ink bg-panel border border-accent px-2 py-1 outline-none flex-1 max-w-xs"
                />
              ) : (
                <h2
                  onClick={startEditTitle}
                  className="text-sm text-ink truncate cursor-text hover:text-accent"
                  title="Cliquer pour renommer"
                >
                  {active.title}
                </h2>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={openPromptPanel}
                  className="font-mono text-xs px-3 py-1 border border-rule text-dim hover:border-accent hover:text-ink"
                  title="Définir les instructions de base de RIKA pour cette conversation"
                >
                  prompt système
                </button>
                <div className="flex gap-1 font-mono text-xs">
                  {(["groq", "gemini"] as Provider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => changeProvider(p)}
                      className={`px-3 py-1 border ${
                        active.provider === p
                          ? "bg-accent text-bg border-accent"
                          : "border-rule text-dim hover:text-ink"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {showPromptPanel && (
              <div className="border-b border-rule px-6 py-4 bg-panel space-y-2">
                <label className="font-mono text-[11px] text-dim">
                  Instructions de base (identité, ton, règles) pour cette conversation —
                  laisser vide pour garder le comportement par défaut de RIKA.
                </label>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={6}
                  className="w-full bg-bg border border-rule px-3 py-2 text-sm outline-none focus:border-accent font-mono text-ink"
                  placeholder="Ex : Tu es RIKA, assistant direct et efficace. Pas de blabla. Réponses courtes..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveSystemPrompt}
                    disabled={savingPrompt}
                    className="px-3 py-1.5 text-sm bg-accent text-bg disabled:opacity-40 font-mono"
                  >
                    {savingPrompt ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    onClick={() => setShowPromptPanel(false)}
                    className="px-3 py-1.5 text-sm border border-rule text-dim hover:text-ink"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="px-6 py-3 bg-red-950/40 border-b border-red-900 text-sm text-red-300 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="font-mono text-xs text-red-400/70 hover:text-red-300">
                  fermer
                </button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                  {m.role === "assistant" && (
                    <div className="font-mono text-[10px] text-accent/80 tracking-wide mb-1">RIKA</div>
                  )}
                  <div
                    className={`inline-block max-w-[70%] px-4 py-2 text-sm text-left whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-accent/15 border border-accent/40 text-ink"
                        : "bg-panel border border-rule text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && <p className="font-mono text-xs text-dim">RIKA réfléchit…</p>}
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
                className="flex-1 bg-panel border border-rule px-3 py-2 text-sm outline-none focus:border-accent text-ink placeholder:text-dim"
              />
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 text-sm bg-accent text-bg disabled:opacity-40 font-mono"
              >
                Envoyer
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-dim text-sm">
            Crée une conversation pour commencer.
          </div>
        )}
      </section>
    </main>
  );
}
