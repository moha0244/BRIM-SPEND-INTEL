# Brim Spend Intel

> Projet réalisé dans le cadre du **MPC Hack 2026** — Polytechnique Montréal.

Tableau de bord d'intelligence des dépenses corporatives pour une société de transport routier. Analyse les transactions de cartes Brim, détecte les violations de conformité et génère des rapports de dépenses avec assistance IA.

## Fonctionnalités

- **Dashboard** — KPIs, tendances mensuelles, alertes de conformité
- **Transactions** — Liste filtrée avec détail par transaction et statut de conformité
- **Conformité** — Détection automatique des violations (SQL + IA) selon la politique interne
- **Approbations** — Flux d'approbation avec recommandation IA
- **Rapports** — Génération de rapports de dépenses avec résumé CFO
- **Chat IA** — Analyste financier conversationnel branché sur les données réelles

## Démarrage

### 1. Variables d'environnement

Crée un fichier `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MISTRAL_API_KEY=...
```

### 2. Installation

```bash
npm install
```

### 3. Base de données

Lance le contenu de `supabase/schema.sql` dans le SQL Editor de Supabase, puis seed les données :

```bash
npm run seed
```

### 4. Lancer l'app

```bash
npm run dev
```

L'app tourne sur [http://localhost:3000](http://localhost:3000).

## Stack

- **Frontend** — Next.js 15, React, TypeScript
- **Base de données** — Supabase (PostgreSQL)
- **IA** — Mistral Large
- **Détection conformité** — SQL + IA (tâche planifiée `scripts/ai-detect.ts`)

## Note sur MCP

Le projet n'intègre pas MCP (Model Context Protocol) pour l'instant. L'architecture du chat IA repose sur le tool calling natif de Mistral, qui couvre les mêmes besoins pour ce projet.
