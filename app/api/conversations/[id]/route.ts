// app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { provider, systemPrompt } = await req.json();

  const update: Record<string, string> = {};

  if (provider !== undefined) {
    if (provider !== "groq" && provider !== "gemini") {
      return NextResponse.json({ error: "Provider invalide" }, { status: 400 });
    }
    update.provider = provider;
  }

  if (systemPrompt !== undefined) {
    if (typeof systemPrompt !== "string") {
      return NextResponse.json({ error: "Prompt système invalide" }, { status: 400 });
    }
    update.system_prompt = systemPrompt;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
