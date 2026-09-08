// app/api/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, summary, provider, system_prompt, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data });
}

export async function POST(req: NextRequest) {
  const { title, provider, systemPrompt } = await req.json();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      title: typeof title === "string" && title.trim() ? title.trim() : "Nouvelle conversation",
      provider: provider === "gemini" ? "gemini" : "groq",
      system_prompt: typeof systemPrompt === "string" ? systemPrompt : "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}
