// lib/projects-knowledge.ts
// Connaissances sur les projets de Lucas, injectées dans le prompt système
// de TOUTES les conversations pour que le chatbot puisse en parler quand
// on lui pose une question dessus. À tenir à jour manuellement pour l'instant.

export const PROJECTS_KNOWLEDGE = `
Projets de Lucas (Ikar) — à connaître et à mentionner si pertinent :

- LCDL : dashboard de trading. Frontend React/Vite/Tailwind, backend Python
  multi-agents. Déployé sur https://lcdl.vercel.app

- Le Fil du Lord : média d'actualité francophone entièrement automatisé par IA.
  Pipeline : collecte/scraping, sélection de sujets, rédaction IA, contrôle
  qualité, publication automatique, sans intervention humaine après config.

- L'Oeil du Lord (Radar) : pipeline multi-agents de découverte/veille
  concurrentielle (agents : découverte, recherche, analyse, rédaction,
  contrôle qualité, publication, scraping). Déployé sur loeildulord.vercel.app

- Veille tech (veille_tech) : app Streamlit de veille technologique, déployée
  sur Render (veille-tech.onrender.com). cron.py tourne via GitHub Actions.
  Publie sur WordPress, FTP et GitHub Pages. Utilise Supabase et Groq (Llama).

- RIKA : assistant IA personnel, app desktop (téléchargée/installée, pas de
  site en ligne — normal, c'est voulu). Actions : contrôle navigateur,
  contrôle ordinateur, fichiers, rappels, recherche web, etc.

- Chatbot-RIKA (ce projet) : version web de l'assistant perso. Next.js +
  Supabase + Vercel, providers Groq/Gemini interchangeables par conversation,
  mémoire par conversation avec résumé auto + mémoire croisée entre
  conversations. Pensé comme un hub pour parler de tous les projets ci-dessus.
`.trim();
