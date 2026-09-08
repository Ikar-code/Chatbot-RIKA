# IA perso — chatbot web (Next.js + Supabase + Vercel)

Version web de l'assistant perso : conversations multiples, mémoire par
conversation (résumé auto), mémoire croisée entre conversations, provider
IA (Groq/Gemini) changeable par conversation.

## Mise en place

### 1. Supabase
1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans SQL Editor, exécute le contenu de `supabase/schema.sql`.
3. Récupère `Project URL` et la clé `service_role` (Settings > API) —
   c'est `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
   ⚠️ La clé `service_role` contourne les policies RLS — ne l'utilise que
   côté serveur (API routes), jamais côté client.

### 2. Variables d'environnement
Copie `.env.example` en `.env.local` et renseigne :
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY` (console.groq.com)
- `GEMINI_API_KEY` (aistudio.google.com)

### 3. En local
```bash
npm install
npm run dev
```

### 4. Déploiement sur Vercel
1. Pousse le repo sur GitHub.
2. Sur [vercel.com](https://vercel.com), "New Project" > importe le repo.
3. Dans Settings > Environment Variables, ajoute les 4 variables ci-dessus
   (jamais `.env.local`, qui n'est pas commité).
4. Deploy.

## Structure
- `app/page.tsx` — UI (liste des conversations + chat)
- `app/api/chat/route.ts` — reçoit un message, appelle l'IA, sauvegarde
- `app/api/conversations/route.ts` — liste / création de conversations
- `app/api/conversations/[id]/route.ts` — changement de provider
- `app/api/conversations/[id]/messages/route.ts` — historique d'une conv
- `lib/ai-router.ts` — appel unifié Groq/Gemini
- `lib/memory.ts` — construction du contexte IA + résumé automatique
- `lib/supabase.ts` — client Supabase côté serveur

## Notes
- Le résumé automatique se déclenche tous les 15 messages (`SUMMARIZE_EVERY`
  dans `lib/memory.ts`).
- Les 20 derniers messages bruts sont envoyés à l'IA à chaque appel
  (`MAX_RAW_MESSAGES`) — au-delà, seul le résumé fait foi.
- Toutes les clés API restent côté serveur (API routes), jamais exposées au
  navigateur — contrairement à un GitHub Pages statique.
