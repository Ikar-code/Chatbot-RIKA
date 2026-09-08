// lib/ai-router.ts
// Point d'entrée unique pour appeler Groq ou Gemini avec un format de messages neutre.
// Ce fichier ne doit être importé que côté serveur (API routes) — jamais dans
// un composant client — sinon les clés API se retrouvent exposées au navigateur.

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
export type Provider = "groq" | "gemini";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function geminiUrl(): string {
  const key = process.env.GEMINI_API_KEY;
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

async function callGroq(systemPrompt: string, history: ChatMessage[]): Promise<string> {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...history,
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse Groq inattendue");
  return content;
}

async function callGemini(systemPrompt: string, history: ChatMessage[]): Promise<string> {
  const contents = history.map((m) => ({
    // Gemini utilise "model" au lieu de "assistant"
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(geminiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Réponse Gemini inattendue");
  return text;
}

// Point d'entrée unique utilisé par les API routes.
export async function askAI(
  provider: Provider,
  systemPrompt: string,
  history: ChatMessage[]
): Promise<string> {
  if (provider === "gemini") return callGemini(systemPrompt, history);
  return callGroq(systemPrompt, history);
}
