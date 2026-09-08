// lib/memory.ts
import { getSupabaseServerClient } from "./supabase";
import { askAI, type ChatMessage, type Provider } from "./ai-router";
import { PROJECTS_KNOWLEDGE } from "./projects-knowledge";

const MAX_RAW_MESSAGES = 20; // messages bruts gardés dans le contexte envoyé à l'IA
const SUMMARIZE_EVERY = 15; // nb de messages avant de redemander un résumé

// Utilisé quand une conversation n'a pas de prompt système personnalisé
// (colonne system_prompt vide). Modifiable ici, ou remplacé par conversation
// via l'UI (voir le panneau "prompt système" dans l'interface).
export const DEFAULT_SYSTEM_PROMPT =
  "Tu es RIKA, l'assistant personnel de Lucas. Identité : direct, efficace, sans blabla. " +
  "Si on te demande ton nom, réponds que tu es RIKA. Réponds de façon naturelle, claire et concise. " +
  "Appelle l'utilisateur Lucas ou Ikar par défaut, sauf indication contraire de sa part.";

type Conversation = {
  id: string;
  title: string;
  summary: string;
  provider: Provider;
  system_prompt: string;
  msg_since_summary: number;
};

// Construit (systemPrompt, history) pour une conversation donnée, en injectant
// son propre résumé + les résumés des AUTRES conversations (mémoire croisée).
export async function buildAIContext(
  conversationId: string
): Promise<{ systemPrompt: string; history: ChatMessage[]; conversation: Conversation }> {
  const supabase = getSupabaseServerClient();

  const { data: conversation, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (convErr || !conversation) throw new Error("Conversation introuvable");

  const { data: others } = await supabase
    .from("conversations")
    .select("title, summary")
    .neq("id", conversationId)
    .not("summary", "eq", "");

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const basePrompt = conversation.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  let systemPrompt = `${basePrompt}\n\n${PROJECTS_KNOWLEDGE}\n`;

  if (conversation.summary) {
    systemPrompt += `\nRésumé de la conversation en cours : ${conversation.summary}\n`;
  }

  if (others && others.length > 0) {
    const lines = others.map((o) => `- ${o.title} : ${o.summary}`).join("\n");
    systemPrompt += `\nAutres conversations passées (à mentionner seulement si pertinent) :\n${lines}\n`;
  }

  const recent = (messages ?? []).slice(-MAX_RAW_MESSAGES);
  const history: ChatMessage[] = recent.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }));

  return { systemPrompt, history, conversation: conversation as Conversation };
}

// Redemande un résumé à l'IA (provider actif de la conversation) si le seuil
// de messages est atteint, et le stocke.
export async function maybeSummarize(conversationId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { systemPrompt, history, conversation } = await buildAIContext(conversationId);

  if (conversation.msg_since_summary < SUMMARIZE_EVERY) return;

  const summaryHistory: ChatMessage[] = [
    ...history,
    {
      role: "user",
      content: "Résume cette conversation en 3-4 phrases maximum, en gardant les infos importantes.",
    },
  ];

  try {
    const summary = await askAI(conversation.provider, systemPrompt, summaryHistory);
    await supabase
      .from("conversations")
      .update({ summary, msg_since_summary: 0 })
      .eq("id", conversationId);
  } catch (err) {
    console.error("[memory] Échec du résumé:", err);
  }
}
