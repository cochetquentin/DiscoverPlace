# DiscoverPlace

PWA privée qui transforme une durée disponible en micro-aventure immédiatement réalisable autour de Tokyo.

## Démarrage local

Le mode démo fonctionne sans clé API et utilise Tokyo Station comme position de secours.

Depuis Git Bash :

```bash
./dev
```

Le script installe automatiquement les dépendances si nécessaire, puis ouvre le serveur
sur `http://localhost:3000`. Garde le terminal ouvert pendant l'utilisation et appuie sur
`Ctrl+C` pour arrêter.

RTK n'est volontairement pas utilisé pour lancer le serveur : il masque les logs des
processus qui restent actifs.

### Test sur mobile

Si tu ouvres l'app depuis ton téléphone avec une URL du type
`http://192.168.x.x:3000`, la géolocalisation sera bloquée par le navigateur. Ce n'est
pas toi qui as refusé : les APIs de position exigent un contexte sécurisé.

Solutions simples :

- tester depuis l'ordinateur avec `http://localhost:3000` ;
- déployer sur Vercel et ouvrir l'URL HTTPS sur mobile ;
- utiliser un tunnel HTTPS comme ngrok ou Cloudflare Tunnel.

## Configuration réelle

1. Copier `.env.example` vers `.env.local`.
2. Créer deux clés Google Maps Platform :
   - une clé serveur limitée à Places API New et Routes API. Sa restriction
     d'application doit être `None`, jamais `Websites`, car les appels backend n'envoient
     pas de référent HTTP ;
   - une clé navigateur limitée aux domaines autorisés et à Maps JavaScript API.
3. Définir `DEMO_PROVIDERS=false` et les clés Google.
4. Ajouter `OPENAI_API_KEY` pour le reranking éditorial optionnel.
5. Ajouter `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` pour le logging des trips.

Pour tester le soir sans que les horaires et transports soient trop stricts, garde :

```env
RELAXED_TRIP_PLANNING=true
```

Pour un comportement plus réaliste en production, mets `false`.

## Architecture

- `lib/engine.ts` orchestre découverte, faisabilité, beam search, reranking et validation finale.
- `lib/providers` contient les interfaces et implémentations Google, OpenAI et démo.
- `lib/domain` contient les règles déterministes testables (scoring, beam-search, trip-rules, geo).
- `app/api/trips/generate` expose la génération de trips.
- `app/api/trips/feedback` enregistre le feedback utilisateur (like/dislike/skip).
- Le navigateur conserve localement les résumés, statuts et identifiants des lieux visités ou refusés.

### Logging Supabase

Chaque requête est loggée dans Supabase (tables `trip_logs`, `trip_stops`, `trip_feedback`).
Les scripts d'analyse sont dans `scripts/` :

```bash
npx tsx --env-file=.env.local scripts/analyze-logs.ts   # derniers trips avec stops
npx tsx --env-file=.env.local scripts/stats-engine.ts   # stats moteur (anchors, nearby, routes)
```

### Paramètres walking

| Niveau | Rayon nearby | Budget marche | Durée visite max |
|--------|-------------|---------------|-----------------|
| low    | 1 000 m     | 12 % du temps | illimitée       |
| medium | 2 000 m     | 22 % du temps | 60 min          |
| high   | 5 000 m     | 45 % du temps | 45 min          |

## Vérification

```bash
./check
```

Cette commande exécute le typecheck, le lint, les tests et le build production.

## Accès partout avec Vercel

Vercel héberge l'application Next.js et fournit une URL HTTPS accessible depuis ton
téléphone partout dans le monde.

1. Créer un dépôt GitHub et y pousser ce projet.
2. Sur [vercel.com](https://vercel.com), choisir **Add New Project** puis importer le dépôt.
3. Ajouter dans Vercel les variables présentes dans `.env.example`.
4. Définir `DEMO_PROVIDERS=false`.
5. Autoriser le domaine Vercel dans les restrictions de la clé Google Maps navigateur.

Chaque push sur la branche principale déclenchera ensuite automatiquement un nouveau
déploiement. Un domaine personnalisé pourra être ajouté plus tard depuis Vercel.

## Coûts et sécurité

- Les trips sont loggés dans Supabase (sans coordonnées de départ exactes).
- L'historique local n'est pas synchronisé entre appareils.
- Les recherches Google utilisent des field masks précis.
- OpenAI a un fallback déterministe.
- Configurer les quotas et alertes budgétaires dans Google Cloud, OpenAI et Supabase avant le déploiement.
