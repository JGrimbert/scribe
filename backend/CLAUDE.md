# Scribe — backend

API NestJS avec persistance PostgreSQL (Prisma). Rôle : registre de documents
(import `.odt`, consultation) qui remplace progressivement le middleware Vite
servant `structure.json`/`data.json`/`trame.json` en statique depuis le dossier
parent `Marvarid` (voir `../CLAUDE.md`) — les deux chemins coexistent pour
l'instant, ne pas retirer le middleware Vite sans en parler.

## Modules

- `src/prisma/` — `PrismaModule`/`PrismaService`, client Prisma exposé en
  global provider.
- `src/import/odt-parser.ts` — port de `Marvarid/parser/parse.js` +
  `harmonize.js`, avec deux différences assumées : lecture depuis un
  `Buffer` en mémoire (upload multipart) plutôt qu'un fichier disque ; et
  une hiérarchie de titres à **profondeur arbitraire** (`ParsedNode`
  récursif, `children: ParsedNode[]`) plutôt que les 3 niveaux figés
  axe/bloc/article de la version d'origine — un ODT n'a nativement que des
  `text:outline-level` 1..10, la notion axe/bloc/article est propre à
  Marvarid, pas au format. Deux passes séparées :
  - `buildFlatNodes` (privée) : lit le XML une fois, produit une liste
    plate `FlatNode[]` (titre détecté / paragraphe / tableau, dans l'ordre
    du document) sans construire de hiérarchie. Extrait aussi les styles
    `fo:break-before` (saut de page forcé — indice utile en calibration,
    cf. plus bas) et le texte de la table des matières (`extractTocTexts`,
    si présente) pour suggérer où la vraie structure commence.
  - `buildParsedResult(flatNodes, meta, sectionsRencontrees, corrections?)` :
    construit la hiérarchie via une pile (`stack`), en tenant compte des
    corrections utilisateur (`ImportCorrections` — voir calibration
    ci-dessous). `level` (1-indexé) ne pilote que "combien d'ancêtres
    fermer" ; la profondeur réelle d'un nœud est sa position dans la pile,
    pas une correspondance stricte au numéro — un saut de niveau (Titre 1
    suivi direct d'un Titre 3) imbrique simplement sans nœud fantôme.
  - `parseOdtXml`/`parseOdtBuffer` enchaînent les deux passes pour l'usage
    normal (sans correction = comportement par défaut).
  - **Aucun test automatisé** (`*.spec.ts`) sur ce fichier à ce jour —
    vérifié manuellement contre un manuscrit réel lors du développement,
    pas de garde-fou contre une régression future.

  **Ce que le parseur retient des styles ODT — et ce qu'il jette.** Point
  aveugle à connaître avant de promettre quoi que ce soit sur la mise en
  forme d'origine :
  - `FlatNode.styleName` est lu (`flatten.ts`) mais **meurt à la passe 2** :
    `hierarchy.ts` ne s'en sert que pour deux regex en dur
    (`/citation|quote/i` → `citations`, `/highlight|surlign/i` → `pistes`)
    et il n'est **persisté nulle part** — `Paragraph` n'a que `type` +
    `content`. Le style d'un paragraphe (« Définition », « Citation »…)
    n'est donc pas récupérable après import.
  - Les **surlignés inline** (`<text:span>` sur un style de caractère à
    `fo:background-color`) ne sont **pas extraits du tout** :
    `nodeTextWithLinks` (`xml.ts`) aplatit les spans. Un mot surligné est
    indiscernable du reste du paragraphe. Seuls les liens internes
    (`<text:a href="#signet">`) survivent, via le marqueur
    `<a data-bookmark>` résolu dans `harmonize()`.
  - Sont retenus : niveau de titre (nom de style ou `text:outline-level`),
    `fo:break-before` (`hasPageBreak`), caractère numéroté d'une liste,
    styles méta auteur/titre (`META_STYLES`, noms en dur), tableaux, signets.
  - **Le `.odt` source n'est pas conservé** (buffer gardé en mémoire le temps
    de la calibration seulement). Conséquence : tout enrichissement du parse
    est **rétroactivement inapplicable** — il impose de réimporter les
    documents existants.
- `src/documents/` — `DocumentsModule` : le registre + le flux d'import en
  deux temps (calibration avant écriture en base, cf. juste en dessous).
  - `GET /documents` — liste des documents avec stats agrégées, pour le
    tableau du registre côté frontend.
  - `GET /documents/:id` — reconstruit `{ trame, data }` depuis la DB
    (parcours récursif générique via `parentId`, pas 3 boucles figées).
  - `POST /documents/preview` — upload multipart d'un `.odt`, parse **sans
    écrire en base**, renvoie `{ previewId, outline, suggestedStructureStartIndex }`.
    Le buffer + nom de fichier sont gardés en mémoire (`Map` sur l'instance
    du service, pas de file d'attente multi-utilisateurs) le temps que
    l'utilisateur calibre — perdu si le serveur redémarre entre-temps.
  - `POST /documents/preview/:previewId/commit` — reprend le buffer en
    attente, réapplique le parse avec les corrections (`ImportCorrections`
    : `structureStartIndex` + `levelOverrides` par titre), persiste en
    transaction (`Document` + `Node`s + `Paragraph`s).

- `src/analyse/` — `AnalyseModule` : analyses par document, persistées dans
  `DocumentAnalysis` (une ligne par document, volets indépendants et
  nullables, chacun remplacé à son recalcul) :
  - **lexical** (`POST /documents/:id/analyse/lexical`) — stats
    linguistiques + entités nommées + réseau lexical (co-occurrences de
    noms à l'échelle de la phrase, arêtes pondérées NPMI — le comptage brut
    mettrait les lemmes les plus fréquents en tête de toutes les arêtes) +
    **nuage de lemmes** (`lemmas` : lemmes porteurs de sens filtrés par POS,
    casse préservée pour les noms propres, mots vides écartés au niveau du
    lemme — cf. `nlp-service/`) via le service Python `nlp-service/` (voir
    `../CLAUDE.md`), joint par `NlpClientService` (`NLP_SERVICE_URL`, 503
    explicite si éteint). Les ids d'unités renvoyés par Python sont enrichis
    des titres de nœuds avant persistance. Le nuage de mots du frontend
    (`VocabulaireCloud`) est une facette de ce volet — l'ancienne fréquence
    lexicale en TS pur (`word-frequency.ts`, insensible aux accents, sans
    lemmatisation) a été retirée.
  - **semantic** (`POST /documents/:id/analyse/semantic`) — proximité
    sémantique entre nœuds : embeddings sentence-camembert **par
    paragraphe** (le modèle tronque à ~128 tokens, un article entier serait
    amputé), vecteur d'un nœud = moyenne renormalisée de ses paragraphes,
    persisté en top-K voisins par nœud (jamais la matrice complète). Cache
    `EmbeddingCache` adressé par (modèle, sha256 du texte) — pas de FK vers
    `Paragraph`, volontairement : survit aux réimports, dédoublonne, et une
    réanalyse ne vectorise que les textes jamais vus. Premier calcul long
    (minutes), les suivants quasi instantanés.
  - **topics** (`POST /documents/:id/analyse/topics` → `{ jobId }`, puis
    polling `GET /documents/:id/analyse/topics/jobs/:jobId`) — thèmes
    BERTopic. Nest découpe le corpus en segments de ~200-400 mots
    (`segmentation.ts`, jamais à cheval sur deux nœuds, nodeId encodé dans
    l'id du segment), le service Python fait embeddings + UMAP + HDBSCAN en
    job asynchrone, et Nest persiste à la fin du polling le résumé par thème
    + la répartition par axe + une projection UMAP 2D des segments (carte
    sémantique, coordonnées normalisées 0..1 ; UMAP séparé du clustering :
    2D/min_dist 0.1 pour l'œil vs 5D/min_dist 0 pour HDBSCAN). Piège
    c-TF-IDF : ne PAS mettre `min_df` sur le CountVectorizer — BERTopic
    l'ajuste sur les documents concaténés par thème, `min_df=2` élague les
    termes propres à un seul thème (ceux qu'on veut). Les volets `graph`
    (lexical) et `projection` (topics) sont optionnels dans les Json
    persistés : absents des analyses calculées avant la phase 4.
  - **completeness** — seul volet calculé **à la volée** au `GET` et jamais
    persisté (`completeness.ts`) : il ne dépend que des comptes de mots
    (`computeStats`), pas du NLP, donc le recalculer coûte moins cher que le
    stocker. D'où sa présence garantie dans la réponse (pas de `null`), et le
    fait que le bloc anomalies du dashboard s'affiche sans service NLP.
    Expose la table des anomalies (feuilles stub) ET la `distribution` des
    feuilles sur toute l'échelle vide/ébauche/partiel/rédigé, ventilée par axe
    de tête + un groupe « Total » — une barre du graphe de complétude.
  - `GET /documents/:id/analyse` renvoie toujours 200 avec les volets à
    `null` tant qu'ils ne sont pas calculés (pas de 404).
  - Outils transverses sous `/analyse` (`analyse-tools.controller.ts`, non
    rattachés à un document) : `POST /analyse/compare` (similarité entre
    deux passages arbitraires, rien de persisté), `GET
    /analyse/embedding-cache` (taille) et `DELETE
    /analyse/embedding-cache/orphans` (purge des vecteurs ne correspondant
    plus à aucun paragraphe — hashes recalculés par le même chemin que le
    calcul, garantie de ne rien jeter d'utile).
  - Piège lemmatisation c-TF-IDF : le job topics lemmatise les segments
    pour la représentation (pas pour le clustering), mais UNIQUEMENT les
    lemmes NOUN/PROPN/ADJ — sans filtrage POS, les verbes génériques
    (pouvoir, faire, aller), dilués entre leurs formes conjuguées avant
    lemmatisation, se concentrent et dominent tous les thèmes.
  - Piège : les colonnes `Json` sont du `jsonb` Postgres, qui **ne préserve
    pas l'ordre des clés d'objet** (les tableaux, si) — tout ordre
    significatif d'un objet (ex: `posCounts`) doit être retrié côté client.

### Calibration d'import

Le parseur détecte le niveau d'un titre via son style ODT (nom de style ou
`text:outline-level`) — fiable seulement si l'auteur a appliqué les styles
de façon cohérente. Sur un manuscrit réel, on a trouvé un cas où 7 titres
qui auraient dû être des axes distincts portaient un style personnalisé
hérité de "Heading 2" (donc niveau bloc) — bug de mise en forme dans le
`.odt`, pas un bug du parseur, indétectable de façon fiable sans revue
humaine. D'où l'écran de calibration côté frontend (`ImportCalibration.vue`,
voir `../frontend/CLAUDE.md`) : preview avant tout écriture, ajustement
manuel du point de départ (liminaire vs structure) et du niveau par titre.
Pistes explorées et **abandonnées** faute de signal fiable :
- Recoupement avec la table des matières pour corriger les niveaux : elle
  est générée à partir des mêmes niveaux que le corps, donc reflète
  fidèlement une éventuelle erreur au lieu de la révéler.
- Pondération par motif de récurrence structurel : un axe mal classé en
  bloc peut être structurellement identique à un vrai bloc (même nombre de
  sous-titres) — seul le contenu sémantique les distingue.
La table des matières reste utile pour une chose différente : suggérer où
la vraie structure commence (`suggestStructureStartIndex` — le premier
titre du corps qui apparaît aussi dans la table des matières signale la fin
du liminaire, qui lui n'y figure jamais).

## Modèle de données (`prisma/schema.prisma`)

- `Document` — un livre importé ; stats agrégées mises en cache à l'import
  (`totalMots`, `totalCaracteres`, etc.) plutôt que recalculées à la volée.
  `totalAxes`/`totalBlocs`/`totalArticles` restent 3 champs figés (compat
  registre) mais leur sens est généralisé : profondeur 0 / profondeur 1 /
  profondeur ≥ 2, peu importe la profondeur réelle de l'arbre.
- `Node` — un titre à profondeur arbitraire (`level: Int`, pas un enum figé
  à 3 valeurs). `parentId` + `position` explicites (colonnes, pas un index
  de tableau JSON) : réordonner un chapitre est un `UPDATE`, pas une
  réécriture de blob. `id` réutilise l'UUID généré par `harmonize()` au
  moment du parse.
- `Paragraph` — un paragraphe de texte, rattaché à un `Node`, `position`
  explicite (même logique que ci-dessus).

Pas encore de versioning bloc par bloc — prévu plus tard. L'architecture
(ids stables, `position` en colonne) est pensée pour l'accueillir sans
migration lourde, mais rien n'est branché aujourd'hui.

Prisma est épinglé en v6 (`prisma`/`@prisma/client` en `^6.19.3`) : la v7
change la configuration datasource (adapters obligatoires, `url` dans le
schema n'est plus supporté pour Migrate) — pas encore adopté ici, à
reconsidérer consciemment plus tard, pas par un `npm update` distrait.

## Infra locale

- PostgreSQL via Docker : `docker-compose.yml` à la racine du repo. Démarrer
  avec `docker compose up -d` (nécessite Docker Desktop lancé).
- `backend/.env` (gitignored) — copier `backend/.env.example` (`DATABASE_URL`).
- Migrations : `npm run prisma:migrate --workspace backend` (ou depuis
  `backend/` : `npx prisma migrate dev`). `npm run prisma:generate` après
  toute modif de `schema.prisma` sans nouvelle migration.

## Commandes

Depuis `backend/` :
```
npm run start:dev        # Nest en mode watch
npm run build             # compile en dist/
npm run start:prod         # lance le build compilé
npm run prisma:generate    # régénère le client Prisma
npm run prisma:migrate     # crée + applique une migration
```
Depuis la racine : `npm run dev` (lance frontend + backend ensemble via
`concurrently`) ou `npm run start:dev --workspace backend` pour le backend
seul. Penser à `docker compose up -d` avant si Postgres n'est pas déjà up.

## Conventions de code

- Suivre les conventions Nest standard (modules/controllers/services,
  injection de dépendances). Un module par domaine métier au fur et à mesure
  qu'ils apparaissent — ne pas préparer de structure pour des domaines qui
  n'existent pas encore.
