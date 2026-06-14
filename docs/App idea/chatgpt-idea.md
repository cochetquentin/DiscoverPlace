Oui, carrément faisable — et je pense que le bon angle, ce n’est pas “une app de recommandations de lieux”, mais **un générateur de micro-aventures locales**.

L’idée centrale : l’utilisateur donne **sa position + son temps disponible + son mood**, et l’app répond avec **un plan faisable**, pas juste une liste de lieux.

## Le concept produit

Tu pourrais construire une app qui répond à des prompts comme :

> “J’ai 4h devant moi, je veux marcher un peu, découvrir un endroit atypique, manger quelque chose de sympa, et rentrer sans galérer.”

Et l’app génère :

> “Pars maintenant. Prends tel transport pendant 35 min. Descends ici. Marche jusqu’à ce petit sanctuaire / musée / parc / café caché. Ensuite fais ce détour par deux points d’intérêt. Mange ici. Retour par telle station. Durée totale estimée : 3h45.”

La vraie valeur, ce serait de combiner **découverte + contrainte de temps + itinéraire réaliste**.

## Comment je le construirais

### 1. Commencer par un MVP très simple

Au début, pas besoin de faire une grosse app complète. Je ferais une version avec :

* position actuelle ;
* temps disponible : 1h, 2h, 4h, demi-journée ;
* rayon ou temps de transport max ;
* préférences : balade, resto, café, insolite, nature, culture, photo spot, pluie, pas cher ;
* résultat : 1 itinéraire clair avec 3 à 6 étapes.

Le plus important au début : **ne pas afficher 50 lieux**, mais proposer **1 bon plan d’action**.

## Architecture possible

### A. Récupérer les lieux intéressants

Tu as plusieurs sources possibles.

**Google Places API** peut trouver des lieux autour d’une position avec Nearby Search, Text Search, Place Details et photos. C’est probablement la source la plus pratique pour restaurants, cafés, parcs, musées, temples, attractions, notes, horaires et photos. Google indique aussi que Nearby Search permet de chercher des lieux par zone, type, langue et champs demandés. ([Google for Developers][1])

**Foursquare Places API** est intéressant pour découvrir des lieux populaires ou recommandés selon la proximité et les comportements utilisateurs. Ça peut être utile pour les cafés, restos, bars, lieux “cool”, moins touristiques. ([docs.foursquare.com][2])

**OpenTripMap** peut servir pour les points d’intérêt touristiques, culturels, naturels ou historiques. Leur API se présente comme une base mondiale de POI pour voyage et divertissement. ([dev.opentripmap.org][3])

Pour moi, le bon mix au début serait :

> Google Places pour la qualité et les horaires, OpenTripMap pour les lieux touristiques/atypiques, puis plus tard Foursquare pour améliorer les recommandations food/cafés.

### B. Calculer ce qui est faisable dans le temps donné

C’est le cœur de ton app.

Tu dois éviter de recommander un lieu “proche à vol d’oiseau” mais pénible à atteindre. Pour ça, il faut raisonner en **temps de trajet réel**.

Mapbox propose une Isochrone API qui calcule les zones atteignables depuis une position dans un temps donné. C’est parfait pour dire : “en 30 min / 45 min / 1h, voici la zone accessible.” ([Mapbox][4])

Mapbox a aussi des APIs de navigation/directions/matrix pour calculer itinéraires, distances et durées entre plusieurs points. La Matrix API retourne notamment les durées et distances entre paires origine-destination. ([Mapbox][5])

Au Japon, tu peux aussi regarder les données GTFS/GTFS-JP pour les transports publics, mais c’est plus complexe à intégrer soi-même. Le MLIT explique que GTFS-JP est une adaptation locale de GTFS pour publier horaires, arrêts, tarifs et données de transport. ([mlit.go.jp][6])

Donc pour un MVP : utilise d’abord une API de routing existante plutôt que de construire ton propre moteur transport.

### C. Générer un itinéraire intelligent

Tu peux voir le problème comme un petit algorithme :

1. L’utilisateur dit : “j’ai 4h”.
2. Tu retires une marge de sécurité, par exemple 30 minutes.
3. Tu calcules les zones atteignables.
4. Tu récupères les lieux dans cette zone.
5. Tu scores les lieux.
6. Tu construis un chemin logique.
7. Tu génères une réponse lisible.

Exemple de scoring :

```text
score = intérêt du lieu
      + rareté / atypique
      + note moyenne
      + nombre d’avis
      + compatibilité avec le mood
      + diversité par rapport aux lieux déjà visités
      - détour trop long
      - lieu fermé
      - trop touristique si l’utilisateur veut du calme
```

Le vrai truc important : garder un historique des lieux déjà proposés ou visités. Sinon l’app va finir par recommander toujours les mêmes spots connus.

## Les features que je mettrais

### Version 1 — MVP

* “J’ai X heures”
* “Autour de moi”
* “Surprends-moi”
* catégories : balade, food, café, culture, nature, insolite
* génération d’un itinéraire simple
* bouton “pas envie” pour régénérer
* sauvegarde des lieux visités

### Version 2 — plus intelligente

* météo : éviter les parcs quand il pleut ;
* budget ;
* niveau d’énergie : chill / marche / aventure ;
* éviter les lieux déjà vus ;
* mode “date”, “solo”, “amis”, “photo walk” ;
* recommandations selon l’heure : café le matin, izakaya le soir, parc en journée ;
* itinéraires multi-stops quand chaque lieu est court.

### Version 3 — vraiment différenciante

* “Je veux voir quelque chose que je n’aurais jamais trouvé seul”
* score d’originalité ;
* lieux saisonniers : sakura, momiji, illuminations, festivals ;
* itinéraires thématiques : vieux Tokyo, temples cachés, cafés rétro, architecture bizarre, ruelles commerçantes, onsen/sento, parcs méconnus ;
* import Google Maps / favoris pour éviter les doublons ;
* feedback utilisateur pour apprendre ses goûts.

## Le format de réponse idéal de l’app

Je ferais des réponses comme ça :

```text
Plan 4h — balade insolite + café

Durée totale : 3h45
Transport : 55 min aller, 45 min retour
Marche : 4.2 km
Budget estimé : ¥1,500–¥2,500

1. Départ depuis ta position
   → train jusqu’à X station

2. Balade vers [lieu atypique]
   Pourquoi : petit spot calme, peu connu, bon pour marcher.

3. Détour par [temple / parc / rue commerçante]
   +15 min, vaut le coup si tu veux prolonger.

4. Pause à [café]
   Pourquoi : bien noté, ambiance locale, ouvert maintenant.

5. Retour
   → station Y, trajet retour 45 min.
```

C’est beaucoup plus utile qu’une carte pleine de pins.

## Tech stack possible

Pour aller vite :

* **Frontend mobile** : React Native ou Flutter.
* **Backend** : Node.js / Python FastAPI.
* **Base de données** : PostgreSQL + PostGIS pour les lieux, distances, historique.
* **APIs lieux** : Google Places, OpenTripMap, Foursquare.
* **Routing** : Google Maps Platform ou Mapbox.
* **IA** : un LLM pour transformer les lieux candidats en itinéraire naturel.
* **Cache** : garder les résultats de lieux pour ne pas exploser les coûts API.

PostGIS serait très utile parce que tu vas manipuler beaucoup de données géographiques : lieux autour de moi, distance, clusters, zones accessibles, etc.

## Le plus dur techniquement

Le plus dur ne sera pas l’interface. Ce sera :

1. **trouver des lieux vraiment intéressants**, pas juste les plus populaires ;
2. **ne pas proposer des plans irréalistes** ;
3. **gérer les horaires d’ouverture** ;
4. **éviter les doublons et les recommandations trop évidentes** ;
5. **personnaliser avec le temps**.

Le piège serait de faire une app qui dit juste “voici 20 restaurants autour de toi”. Ça existe déjà. Ton différenciateur doit être :

> “Voici une petite aventure faisable maintenant.”

## Je ferais le premier prototype comme ça

Tu peux commencer sans même coder une app complète :

1. Un petit script qui prend :

   * position ;
   * durée dispo ;
   * mood ;
   * distance max.

2. Il appelle Google Places / OpenTripMap.

3. Il garde 20 à 50 lieux candidats.

4. Il filtre :

   * ouvert maintenant ;
   * atteignable ;
   * pas trop loin ;
   * catégorie intéressante.

5. Il demande à un LLM :

   * de choisir 3 à 5 stops ;
   * de justifier ;
   * de produire un itinéraire.

6. Tu testes toi-même chaque week-end.

Après 10 ou 20 sorties générées, tu verras très vite ce qui marche ou pas.

## Mon avis

Je pense que c’est une très bonne idée, surtout au Japon, parce qu’il y a énormément de petits lieux intéressants qui ne ressortent pas forcément dans les guides classiques. Mais il faut vraiment positionner ça comme une app de **balades spontanées personnalisées**, pas comme un énième moteur de recherche de restaurants.

Le nom mental du produit pourrait être :

> “J’ai 4 heures. Surprends-moi.”

Et ton MVP devrait résoudre une seule question :

> “Qu’est-ce que je peux faire maintenant, sans trop réfléchir, qui soit faisable, sympa, et un peu inattendu ?”

[1]: https://developers.google.com/maps/documentation/places/web-service/nearby-search?utm_source=chatgpt.com "Nearby Search (New) | Places API"
[2]: https://docs.foursquare.com/developer/reference/venues?utm_source=chatgpt.com "Venues - Docs Home - Foursquare"
[3]: https://dev.opentripmap.org/?utm_source=chatgpt.com "OpenTripMap API"
[4]: https://docs.mapbox.com/api/navigation/isochrone/?utm_source=chatgpt.com "Isochrone API | API Docs"
[5]: https://docs.mapbox.com/api/navigation/?utm_source=chatgpt.com "Navigation | API Docs"
[6]: https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000067.html?utm_source=chatgpt.com "公共交通運行情報標準データ（GTFS-JP）に関する資料・検討会"
