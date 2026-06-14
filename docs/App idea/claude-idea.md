# Explorer — Réflexion & spécifications

> Une app mobile pour découvrir les endroits intéressants, atypiques et méconnus autour de soi, avec des itinéraires générés selon le temps disponible.

---

## Le problème à résoudre

On a tous ce sentiment : on habite quelque part depuis un moment, on croit avoir fait le tour, et pourtant on passe à côté de dizaines d'endroits intéressants. Le problème n'est pas le manque de lieux — c'est la découvrabilité. Google Maps ne t'aide pas si tu ne sais pas quoi chercher. Les blogs de voyage parlent des mêmes spots connus. Et quand tu as 3h devant toi un samedi matin, tu ne sais pas quoi faire de concret.

L'idée centrale : **transformer du temps libre en aventure locale concrète**, avec un itinéraire clé-en-main adapté à ta situation.

---

## Ce que l'app fait (vision produit)

### Le pitch en une phrase
"Dis-moi combien de temps tu as et d'où tu pars — je t'invente une journée."

### Le flux principal
1. Tu ouvres l'app depuis n'importe où
2. Tu dis combien de temps tu as (1h, 2h, demi-journée, journée)
3. Tu précises l'ambiance que tu veux (ou pas — l'app choisit)
4. L'app génère un itinéraire complet avec les déplacements, les lieux, et ce qu'il faut y faire
5. Tu pars, tu explores, tu découvres

Pas de scroll interminable de résultats. Pas de liste de 40 restaurants à comparer. **Une proposition concrète, actionnable immédiatement.**

---

## Les idées à explorer

### 1. Le moteur de génération d'itinéraire

C'est le cœur du produit. Deux approches possibles :

**Approche LLM (IA générative)**
Un LLM comme Claude génère l'itinéraire en langage naturel à partir des contraintes. L'avantage : la flexibilité. On peut lui dire "j'ai 4h, je pars de Yashio, j'aime les trucs atypiques et j'aimerais manger quelque chose de local" et il structure un vrai parcours cohérent. Le problème : les lieux générés peuvent ne pas exister ou avoir fermé.

**Approche data (APIs + algorithme)**
On utilise Google Places, OpenStreetMap, ou Foursquare pour récupérer des lieux réels et vérifiés, puis un algorithme construit un itinéraire optimisé géographiquement. Le problème : les résultats sont souvent trop mainstream, trop lisses.

**La meilleure approche : les deux combinés**
L'IA génère la logique et la narration de l'itinéraire, les APIs fournissent les données vérifiées (horaires, adresses, photos, notes). Le LLM choisit *quels types* de lieux inclure, l'API valide que ces lieux existent vraiment.

---

### 2. La question de la découverte atypique

C'est le plus dur à résoudre. Les APIs classiques renvoient les mêmes résultats pour tout le monde. Pour trouver des endroits vraiment intéressants et méconnus, plusieurs pistes :

**Piste communautaire**
Les meilleurs spots atypiques sont partagés par des gens qui les connaissent. On pourrait intégrer des sources comme :
- Atlas Obscura (API disponible) — spécialisé dans les lieux insolites et méconnus du monde entier
- OpenStreetMap avec des tags spéciaux (artworks, curiosités, lieux historiques méconnus)
- Reddit local (r/japantravel, r/tokyo, etc.) pour les recommandations de vrais habitants
- Des blogs de voyage crawlés et indexés par l'IA

**Piste comportementale**
Tracker quels lieux les utilisateurs ont apprécié (notes, revisites, temps passé) pour améliorer les recommandations dans le temps. C'est ce que fait Spotify pour la musique — pourquoi pas pour les lieux ?

**Piste saisonnière et temporelle**
Un lieu peut être intéressant à un moment précis et banal le reste du temps. Un marché le dimanche matin, une façade illuminée la nuit, un parc en fleurs en avril. L'app devrait intégrer cette dimension temporelle dans ses suggestions.

---

### 3. La construction de l'itinéraire

L'itinéraire doit être pensé comme un **voyage, pas une liste**. Quelques principes :

**Le principe de la vague**
Le meilleur itinéraire a un rythme : intense → calme → intense. Par exemple : marcher vers un lieu actif, s'asseoir dans un café calme pour souffler, repartir vers quelque chose de visuel ou culturel. L'IA peut apprendre à construire ce rythme.

**La contrainte de retour**
Le temps de retour doit être intégré dans le calcul dès le départ. Si tu as 4h et que tu es à 45min de transport de chez toi, l'app ne te propose que 3h15 de contenu effectif, et prévoit le trajet retour.

**Les variantes météo**
Un itinéraire devrait avoir une version "beau temps" et une version "pluie" générées en même temps. Quand tu quittes la maison un samedi, tu veux savoir que si ça commence à pleuvoir, tu as un plan B sans avoir à tout refaire.

**Le multi-stop intelligent**
Si le lieu principal est petit ou se visite vite (20 min max), l'app groupe automatiquement plusieurs lieux proches géographiquement pour remplir le temps. Le trajet *devient* le contenu, pas juste le moyen d'y aller.

---

### 4. L'expérience utilisateur

**Le moins de friction possible au démarrage**
L'app devrait fonctionner en moins de 3 tapotements :
- Détecter la position automatiquement
- Proposer 3 créneaux de temps (basés sur l'heure actuelle)
- Générer directement sans demander plein de paramètres

Les préférences avancées (ambiance, type de lieu, restrictions) sont optionnelles et mémorisées après la première utilisation.

**La carte vs la liste**
L'itinéraire s'affiche d'abord comme une carte avec le trajet tracé — pas comme une liste de texte. Le trajet visuellement dessiné donne l'envie de le faire. La liste de détails est là pour ceux qui veulent approfondir.

**La fiche de lieu**
Chaque lieu dans l'itinéraire a une fiche courte avec : pourquoi c'est intéressant (pas juste "musée d'art"), ce qu'il faut vraiment y voir ou faire, une info pratique inattendue (l'entrée est gratuite le premier dimanche, il y a un café caché au sous-sol, etc.), et le temps moyen sur place.

**L'aspect "live"**
Une fois l'itinéraire lancé, l'app passe en mode guidage léger : elle sait où tu en es, elle te notifie 10 min avant qu'il faut repartir pour ne pas être en retard sur le reste, et elle peut suggérer une alternative si tu décides de rester plus longtemps quelque part.

---

### 5. La personnalisation dans le temps

L'app devient plus intéressante à mesure qu'elle te connaît. Quelques idées :

**L'historique comme données**
Ce que tu as fait, combien de temps tu y es resté, si tu as noté positivement ou pas — tout ça permet d'affiner les propositions futures. L'app sait que tu passes toujours plus de temps dans les marchés que dans les musées, donc elle en propose plus.

**Les zones visitées**
Visualiser une carte de ton quartier ou de ta ville avec les zones explorées vs inexplorées. Un peu comme un "fog of war" de jeu vidéo qui se lève au fur et à mesure. Très motivant pour pousser à explorer des zones qu'on évite d'habitude.

**Les collections**
Sauvegarder des itinéraires pour les refaire (les saisons changent, un lieu peut être différent), partager avec des amis, ou créer des listes thématiques (tous les coffee shops atypiques testés, tous les parcs découverts).

---

### 6. La dimension sociale (optionnelle)

Ce n'est pas la priorité, mais ça peut devenir intéressant :

- Partager un itinéraire généré avec quelqu'un d'autre pour le faire ensemble
- Voir ce que des gens "comme toi" ont apprécié dans ta ville (basé sur des profils similaires)
- Des recommandations de locals : un système simple où les habitants peuvent ajouter un lieu méconnu avec une description, validé ensuite par la communauté

---

## Stack technique suggérée

### Mobile
React Native ou Flutter — les deux fonctionnent bien. React Native si tu as déjà des compétences web, Flutter si tu pars de zéro et veux une performance native maximale.

### Backend
Node.js ou Python (FastAPI) — Python est probablement plus adapté vu les intégrations IA.

### APIs à intégrer

| API | Usage | Prix |
|---|---|---|
| Google Places API | Lieux, horaires, photos, notes | Payant (mais crédit offert) |
| Google Directions API | Calcul des trajets et temps de transport | Payant |
| Atlas Obscura | Lieux atypiques et insolites | Scraping ou partenariat |
| OpenStreetMap / Overpass | Lieux alternatifs, gratuit | Gratuit |
| Anthropic Claude API | Génération des itinéraires et descriptions | Payant à l'usage |
| OpenWeatherMap | Météo pour adapter les suggestions | Gratuit (usage modéré) |

### Base de données
PostgreSQL avec PostGIS pour les requêtes géospatiales (trouver tous les lieux dans un rayon de X km). Redis pour le cache des itinéraires populaires.

---

## Ce qu'il faut construire en premier (MVP)

Avant de tout coder, valider l'idée avec le minimum :

1. **Un formulaire simple** — position + temps dispo + 2-3 préférences
2. **Un appel à Claude API** — qui génère l'itinéraire en texte structuré
3. **Une validation sur Google Places** — pour vérifier que les lieux existent
4. **Un affichage propre** — l'itinéraire présenté clairement avec les horaires
5. **Un lien Google Maps** — pour chaque étape, ouvrir Maps directement

Ça, c'est faisable en un week-end. Et ça suffit pour tester si des gens trouvent ça utile.

---

## Les risques et limites à anticiper

**Les données périmées**
Les restaurants ferment, les musées changent leurs horaires. L'app doit vérifier en temps réel et avoir un fallback si un lieu est fermé le jour J.

**La sur-dépendance à l'IA**
Si le LLM invente des lieux qui n'existent pas, l'expérience est catastrophique. Toujours croiser la génération IA avec une validation via API externe.

**La répétitivité**
Après 10 itinéraires, l'utilisateur risque de voir les mêmes spots revenir. Il faut un système d'exclusion des lieux déjà visités et une exploration progressive vers des zones plus éloignées.

**La confiance dans les suggestions**
Les gens font confiance aux notes (4.5 étoiles sur Google) plus qu'aux suggestions d'une IA inconnue. Il faut afficher des signaux de confiance : avis, photos réelles, nombre de visites dans l'app.

---

## L'esprit du produit

Ce qui rend cette app différente des autres, c'est qu'elle ne te demande pas ce que tu veux trouver. Elle te *propose* quelque chose. C'est la différence entre une recherche et une découverte.

L'objectif final : que l'utilisateur rentre chez lui le soir en se disant "je ne savais pas que ça existait à 20 minutes de chez moi". Ce sentiment de surprise, de chance, de curiosité satisfaite — c'est ce qu'il faut optimiser, pas le nombre de lieux dans la base de données.