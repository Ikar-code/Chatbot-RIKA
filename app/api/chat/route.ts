// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { askAI } from "@/lib/ai-router";
import { buildAIContext, maybeSummarize } from "@/lib/memory";

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();

  if (typeof conversationId !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // 1. Enregistre le message de l'utilisateur, et incrémente le compteur
  //    utilisé pour déclencher le résumé automatique.
  const { error: insertUserErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });
  if (insertUserErr) {
    console.error("[api/chat] Échec enregistrement message utilisateur:", insertUserErr);
    return NextResponse.json(
      { error: `Échec de l'enregistrement du message : ${insertUserErr.message}` },
      { status: 500 }
    );
  }
  const { data: currentConv } = await supabase
    .from("conversations")
    .select("msg_since_summary")
    .eq("id", conversationId)
    .single();
  await supabase
    .from("conversations")
    .update({ msg_since_summary: (currentConv?.msg_since_summary ?? 0) + 1 })
    .eq("id", conversationId);

  try {
    // 2. Construit le contexte (résumé + historique + mémoire croisée) et appelle l'IA
    const { systemPrompt, history, conversation } = await buildAIContext(conversationId);
    const response = await askAI(conversation.provider, systemPrompt, history);

    // 3. Enregistre la réponse de l'IA
    const { error: insertAssistantErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: response,
    });
    if (insertAssistantErr) {
      console.error("[api/chat] Échec enregistrement réponse IA:", insertAssistantErr);
      return NextResponse.json(
        { error: `Réponse générée mais non enregistrée : ${insertAssistantErr.message}` },
        { status: 500 }
      );
    }

    // 4. Résume périodiquement en arrière-plan (ne bloque pas la réponse trop longtemps)
    await maybeSummarize(conversationId);

    return NextResponse.json({ response });
  } catch (err) {
    console.error("[api/chat] Erreur:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
