# Analyses — `src/analyse/`

`AnalyseModule` : analyses par document, persistées dans `DocumentAnalysis` (une
ligne par document, volets indépendants et nullables, chacun remplacé à son
recalcul). Le pipeline NLP français est le service Python `nlp-service/` (voir
`../../../CLAUDE.md`), joint par `NlpClientService` (`NLP_SERVICE_URL`, 503
explicite si éteint). `GET /documents/:id/analyse` renvoie toujours 200, volets à
`null` tant qu'ils ne sont pas calculés.

## Volets

- **lexical** (`POST /documents/:id/analyse/lexical`) — stats linguistiques +
  entités nommées + réseau lexical (co-occurrences de noms à l'échelle de la
  phrase, arêtes pondérées **NPMI** — le comptage brut mettrait les lemmes
  fréquents en tête de toutes les arêtes) + **nuage de lemmes** (`lemmas` filtrés
  par POS, casse préservée pour les noms propres, mots vides écartés au niveau du
  lemme). Les ids d'unités renvoyés par Python sont enrichis des titres de nœuds
  avant persistance. L'ancienne fréquence lexicale TS pur (`word-frequency.ts`,
  sans accents ni lemmatisation) a été retirée.
- **semantic** (`POST /documents/:id/analyse/semantic`) — proximité entre nœuds :
  embeddings sentence-camembert **par paragraphe** (le modèle tronque à ~128
  tokens, un article entier serait amputé), vecteur d'un nœud = moyenne
  renormalisée, persisté en **top-K voisins** par nœud (jamais la matrice
  complète). Cache `EmbeddingCache` adressé par (modèle, sha256 du texte) — pas de
  FK vers `Paragraph`, volontairement : survit aux réimports, dédoublonne, une
  réanalyse ne vectorise que les textes jamais vus. Premier calcul long (minutes),
  suivants quasi instantanés.
- **topics** (`POST …/analyse/topics` → `{ jobId }`, polling
  `GET …/analyse/topics/jobs/:jobId`) — thèmes BERTopic. Nest découpe le corpus en
  segments de ~200-400 mots (`segmentation.ts`, jamais à cheval sur deux nœuds,
  nodeId encodé dans l'id), Python fait embeddings + UMAP + HDBSCAN en job async,
  Nest persiste à la fin le résumé par thème + la répartition par axe + une
  projection UMAP 2D (carte sémantique, coords 0..1 ; UMAP séparé du clustering :
  2D/min_dist 0.1 pour l'œil vs 5D/min_dist 0 pour HDBSCAN). Piège c-TF-IDF : ne
  PAS mettre `min_df` sur le CountVectorizer — BERTopic l'ajuste sur les documents
  concaténés par thème, `min_df=2` élague les termes propres à un seul thème (ceux
  qu'on veut). Volets `graph` (lexical) et `projection` (topics) optionnels dans
  les Json : absents des analyses calculées avant la phase 4.
- **structure-shapes** (`GET /documents/:id/structure-shapes`, servi par
  `DocumentsController` — consommateur = écran de typologie) — la séquence des
  styles de chaque nœud, en RLE (`[['Paragraphes', 4]]`). Dérivé, calculé au GET,
  jamais persisté. Passe par `getContent` (reconstruire l'arbre ailleurs = une
  seconde lecture vouée à diverger). Trois décisions :
  - **rend des STYLES, pas des rôles** : dans l'écran, chaque select change un
    rôle en direct ; agréger par rôle côté serveur imposerait un aller-retour par
    changement. Traduction/agrégation côté client (`script/shapes.js`), réactif.
  - **tous les nœuds, pas seulement les feuilles** : « à quoi ressemble un axe ? »
    est aussi légitime que « un article ? ».
  - **RLE** : 900 nœuds × séquence brute (très répétitive) → 135 Ko sur le témoin.
  - Chiffres du témoin, qui ont tranché **contre le clustering** : 8 signatures
    couvrent 87-100 % des nœuds par niveau. Les motifs sont littéraux ; un
    regroupement flou ne ferait que brouiller. À rouvrir si un manuscrit montre
    une longue traîne.
- **completeness** — seul volet calculé **à la volée** au GET, jamais persisté
  (`completeness.ts`) : ne dépend que des comptes de mots (`computeStats`), pas du
  NLP → le recalculer coûte moins que le stocker. D'où sa présence garantie (pas
  de `null`) et le fait que le bloc anomalies s'affiche sans service NLP. Expose la
  table des anomalies (feuilles stub) ET la `distribution` des feuilles sur toute
  l'échelle, ventilée par axe de tête + un groupe « Total ». Deux échelles à ne
  pas confondre (`CompletenessStatus` vs `CompletenessDisplayStatus`) : les 4
  paliers **calculés** (vide/ébauche/partiel/rédigé) et les 2 états **décidés**
  (validé/périmé), qui écrasent le palier à l'affichage. `classify()` ne connaît
  que les premiers — volontaire : `stubNodeIds` (exclusion du corpus thématique)
  ne doit dépendre que de la longueur, pas d'une validation.
- **conformity** — même nature (dérivé, sans NLP, calculé au GET) : ce qui manque
  à chaque nœud pour être prêt, selon les règles (`documents/rules.ts`,
  `GET`/`PUT /documents/:id/rules`).
  - **Règles par profondeur** : `{ default: RuleSet; byDepth: Partial<Record<0|1|2,
    RuleSet>> }` — la clé 2 vaut « 2 et au-delà », même regroupement que
    `zoneOfDepth`. `byDepth` **remplace** `default`, ne le complète pas (fusionner
    rendrait impossible de RETIRER un critère à une profondeur).
  - **Qui est jugé** : les feuilles, sauf si un jeu explicite existe pour une
    profondeur (alors ses nœuds sont jugés, feuilles ou non) → `judgedCount`.
  - **Critères étiquetés par niveau seulement s'il y a un réglage par profondeur**
    (`hasPerDepthRules`) : sinon « ≥ 500 caractères » à deux niveaux se confondrait
    en une barre. Le backend compose le `label` final (`ConformityChart` l'affiche
    tel quel).
  - **`normalizeRules` accepte le format historique à plat** et le remonte en
    `default` : des documents le portent, le casser effacerait des réglages.
    `null` (jamais configuré) → les DÉFAUTS, pas des règles vides. Verrouillé par
    `rules.spec.ts`.
  - **Indicatif, pas bloquant** : dicté par le témoin — exiger définition +
    tableau y rend 821/824 chapitres non conformes (0,4 %). `DEFAULT_RULES` ne
    retient que ≥ 500 caractères (51 % passent) et zéro annotation (89 %).
  - `available: false` tant que la typologie n'est pas arbitrée (« sans
    annotation » ne reposerait sur rien). Piège : le critère « tableau » se lit
    dans `connexe.tableau`, **pas** via les rôles (le parseur aplatit les tableaux
    en données, un `requiresRoles: ['tableau']` mesurerait 0).

## Outils transverses & pièges

- Sous `/analyse` (`analyse-tools.controller.ts`, non rattachés à un document) :
  `POST /analyse/compare` (similarité entre deux passages, rien de persisté),
  `GET /analyse/embedding-cache` (taille), `DELETE /analyse/embedding-cache/orphans`
  (purge des vecteurs sans paragraphe correspondant — hashes recalculés par le
  même chemin, garantie de ne rien jeter d'utile).
- Piège lemmatisation c-TF-IDF : le job topics lemmatise les segments pour la
  représentation (pas le clustering), mais UNIQUEMENT les lemmes NOUN/PROPN/ADJ —
  sans filtrage POS, les verbes génériques (pouvoir, faire), dilués entre leurs
  formes conjuguées, se concentrent et dominent tous les thèmes.
- Piège `jsonb` : les colonnes `Json` sont du `jsonb` Postgres, qui **ne préserve
  pas l'ordre des clés d'objet** (les tableaux, si) — tout ordre significatif d'un
  objet (ex `posCounts`) doit être retrié côté client.
