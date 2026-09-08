-- supabase/schema.sql
-- À exécuter dans Supabase (SQL Editor)

create extension if not exists "pgcrypto";

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nouvelle conversation',
  summary text not null default '',
  provider text not null default 'groq' check (provider in ('groq', 'gemini')),
  msg_since_summary int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on messages (conversation_id, created_at);
