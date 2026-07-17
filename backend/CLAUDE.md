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

  **Styles ODT : héritage, surlignages, inventaire.** À lire avant de
  toucher à quoi que ce soit qui concerne la mise en forme d'origine :
  - **Résolution de l'héritage (`buildStyleTable`/`effectiveStyleName`,
    `xml.ts`)** — LibreOffice génère un style automatique (`P26`, `T130`) dès
    qu'un paragraphe porte la moindre mise en forme directe, lequel hérite du
    vrai style via `style:parent-style-name`. Sur le manuscrit témoin :
    **338 noms bruts pour 33 styles réels**. Sans cette résolution, toute
    typologie est illisible. `FlatNode` porte donc les deux : `styleName`
    (brut — reste la source de `headingLevel`, ne pas y substituer l'autre
    sous peine de changer la structure détectée) et `effectiveStyle` (résolu
    + décodé, `_20_` → espace).
  - **Deux formes de surlignage, pas une** — sur le témoin : 164 paragraphes
    entiers (`fo:background-color` sur le style de paragraphe →
    `FlatNode.highlight`) ET 160 spans inline (style de caractère →
    `<mark data-hl="#ffff00">` posé par `nodeTextWithLinks`). Les deux
    portent des annotations de travail. Le blanc (`#ffffff`) n'est jamais un
    surlignage : LibreOffice le pose partout par défaut.
  - **L'inventaire (`inventory.ts`) se construit sur le XML, pas sur les
    FlatNode** — ceux-ci sont la vue *structurelle* (tableaux aplatis en
    données, paragraphes vides écartés). Le style « Voir » (183 usages, dans
    les tableaux) disparaissait de l'inventaire tant qu'il était construit
    sur eux. Sont écartés les **appareils générés** — table des matières ET
    index alphabétique (`GENERATED_ANCESTOR`) : leurs styles (Contents 1/2,
    Index 1, Index Heading) sont posés par LibreOffice, pas par l'auteur. Le
    témoin porte les deux, en fin de document.
  - **Ventilation par zone (`zones.ts`, `StyleUsage.byZone`)** — où chaque
    style vit dans le livre : `liminaire`, `depth-0/1/2+`, `final`. Trois
    choses à savoir avant d'y toucher :
    - **Les zones sortent de `buildParsedResult`**, qui tient déjà la pile des
      titres ouverts — `zones.ts` ne fait que ventiler. Refaire une pile
      ailleurs (mêmes `levelOverrides`, même règle « la profondeur est la
      position dans la pile »), c'était deux logiques de profondeur vouées à
      diverger. Une passe, une pile.
    - **`sum(byZone) <= count`, jamais `==`** : `count` vient du XML
      (exhaustif, et fait autorité pour `isTypologySettled`), `byZone` des
      FlatNode. Échappent à la ventilation les paragraphes vides (jamais
      promus en FlatNode — sur le témoin : « Horizontal Line », un filet) et
      les paragraphes de métadonnées absorbés par `buildFlatNodes`. Ne jamais
      dériver l'un de l'autre.
    - **`FlatNode.innerStyles`** relève les styles des paragraphes qu'un nœud
      APLATIT (cellules d'un tableau, items d'une liste). Sans lui, deux styles
      réels du témoin sont comptés mais situés nulle part : « Voir » (183, en
      cellule) et « Puces ? » (15, en item de liste).
    - Conséquence sur le flux : l'inventaire dépend des corrections de
      calibration (les bornes déplacent les zones), donc **il ne se fige qu'au
      commit**, pas au preview.
    - Chiffres du témoin : 31 styles, dont 22 mono-zone (71 %) — le
      regroupement par zone porte l'information, ce n'est pas un tri cosmétique.
  - **Les deux regex en dur ont perdu leur autorité** — `hierarchy.ts`
    classait citations/pistes sur le NOM du style (`/citation|quote/i`,
    `/highlight|surlign/i`). Elles ne tenaient que sur des noms bruts (« P26 »
    ne dit rien) et n'étaient pas corrigeables. Les `pistes` viennent
    désormais d'un vrai surlignage, et la vérité est dans `styleName` +
    `highlight`, arbitrés par la typologie du document (`typology.ts`).
  - **Les marqueurs ne sont pas du texte** — `texte[].text` porte des balises
    (`<a data-bookmark>`, `<mark data-hl>`). Tout calcul assis dessus doit
    passer par `stripHtmlTags` (`text-utils.ts`, source unique, réexportée par
    `analyse/plain-text.ts`) : sans ça, `computeStats` compte « <mark » et
    « data-hl="#ffff00"> » comme des mots — le total du manuscrit témoin s'en
    trouvait gonflé de ~175 mots. Verrouillé par un test dans
    `hierarchy.spec.ts`.
  - **Le `.odt` source est conservé** (`DocumentSource`, table à part — cf.
    « Modèle de données »). Un enrichissement du parse est donc applicable
    rétroactivement, en rejouant le parse depuis le blob. Deux réserves :
    - les documents importés **avant** cette table n'ont pas de source et
      restent dans l'ancien régime (seul un réimport les rattache) ;
    - `styleInventory`, `liminaire` et `final` restent capturés sur `Document`
      à l'import — reconstructibles, mais les recalculer à chaque lecture
      reviendrait à reparser un ZIP de 1,6 Mo pour afficher un tableau.
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
    transaction (`Document` + `Node`s + `Paragraph`s + `DocumentSource`, le
    `.odt` lui-même). La `Map` en mémoire ne couvre donc plus que la fenêtre
    entre le preview et le commit : une fois le document en base, son source
    ne dépend plus d'elle.
  - `GET`/`PUT /documents/:id/typology` — typologie des styles : quel rôle
    joue chaque style ODT dans CE document (`typology.ts`). Le GET sert d'un
    coup l'inventaire, ce qui a été décidé (`null` si rien), les suggestions,
    et `settled`. Vocabulaire **fermé** (`STYLE_ROLES` : corps/titre/chapeau/
    citation/définition/renvoi/tableau/liste/ornement/liminaire/ignorer) parce
    que les règles d'éligibilité vont le viser — une étiquette libre, c'est
    une faute de frappe qui casse une règle en silence. Deux invariants :
    - les **suggestions ne sont jamais persistées** à la place de
      l'utilisateur (`styleTypology` reste `null` tant qu'il n'a pas
      enregistré) — sinon la machine se serait auto-validée ;
    - `settled` compare la typologie à l'inventaire, plutôt que d'être un
      booléen « déjà configuré » : un style apparu depuis (réimport d'une
      version où l'auteur en a introduit un) repasse le document en « non
      arbitré ».
  - `POST /documents/:id/recalibrate` — **rejouer la calibration** d'un
    document déjà importé, depuis le `.odt` conservé (`DocumentSource`). Rend un
    `PreviewResponse` ordinaire ; le commit repasse par
    `POST /documents/preview/:previewId/commit`, qui reconnaît un remplacement
    au `documentId` porté par l'entrée `pendingImports`. Un seul flux de
    calibration, deux destinations — le frontend n'a pas à connaître la
    différence.
    - **Ce qui survit** : le `.odt`, la typologie des styles et les règles
      d'éligibilité (des décisions utilisateur, pas des propriétés du parse ;
      `settled` se recalcule seul contre le nouvel inventaire), et les
      validations manuelles, réapposées par ré-appariement.
    - **Ce qui est jeté** : les analyses (`DocumentAnalysis` supprimée). Elles
      indexent des `nodeId`, or `harmonize()` en regénère de neufs à chaque
      parse : les garder afficherait un dashboard parlant de nœuds disparus. Le
      cache d'embeddings étant adressé par contenu, le volet sémantique se
      recalcule sans revectoriser.
    - **Le ré-appariement des validations** (`recalibration.ts`, `remapValidations`)
      identifie un nœud par le couple **(slug, hash du texte courant)**. Ni l'id
      (c'est ce qui change), ni le chemin de titres (recalibrer CONSISTE à le
      changer), ni le slug seul (`makeUniqueSlug` n'assure l'unicité que par
      parent — sur le témoin, deux nœuds « l-aube »), ni le texte seul (257
      nœuds vides partagent le hash du vide). Couple ambigu des deux côtés →
      validation **perdue**, jamais devinée : une relecture perdue se refait
      d'un clic, une relecture posée au mauvais chapitre ment en silence. Le
      commit rend le compte des reposées et des perdues (`RecalibrationReport`).
    - ⚠️ **Une recalibration écrase le contenu en base par celui du `.odt`** —
      c'est un reparse, pas une migration. Sans effet aujourd'hui (aucun
      endpoint n'écrit `Paragraph.content` : le texte en base ne peut venir que
      du parse), mais **le jour où l'édition sera persistée, recalibrer
      détruira le texte écrit dans Scribe**. À traiter avant d'ouvrir
      l'écriture : soit rejouer les éditions par-dessus, soit refuser de
      recalibrer un document édité.
  - `POST`/`DELETE /documents/:id/nodes/:nodeId/validation` — validation
    manuelle d'un chapitre (« j'ai relu, c'est bon »). Rejouer le `POST`
    rafraîchit l'empreinte : c'est la revalidation d'un chapitre périmé. Le
    `DELETE` est idempotent. `GET /documents/:id` renvoie l'état **résolu**
    par nœud (`validations: { nodeId: 'validé' | 'périmé' }`, seuls les nœuds
    validés y figurent) : départager les deux suppose de rehacher le texte
    courant par le même chemin exactement (`nodeContentHash`), et dupliquer ce
    calcul côté client serait signer pour deux implémentations divergentes.

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
  - **structure-shapes** (`GET /documents/:id/structure-shapes`, servi par
    `DocumentsController` — son consommateur est l'écran de typologie, pas le
    dashboard) — la FORME de chaque nœud : la séquence des styles de ses
    paragraphes, en RLE (`[['Paragraphes', 4]]`). Dérivé, calculé au `GET`,
    jamais persisté, comme completeness/conformity. Passe par `getContent` :
    reconstruire l'arbre ailleurs, ce serait une seconde lecture vouée à
    diverger. Trois décisions à connaître :
    - **rend des STYLES, pas des rôles** : dans l'écran de typologie, chaque
      select change un rôle en direct. Agréger par rôle côté serveur imposerait
      un aller-retour par changement, et l'utilisateur ne verrait pas ses motifs
      se former à mesure qu'il typologise. La traduction et l'agrégation sont
      côté client (`script/shapes.js`), en réactif ;
    - **tous les nœuds, pas seulement les feuilles** (contrairement à
      completeness/conformity) : « à quoi ressemble un axe ? » est une question
      aussi légitime que « à quoi ressemble un article ? » ;
    - **RLE** : 900 nœuds × leur séquence brute, pour une information très
      répétitive (« corps corps corps »). Compressé à la source → 135 Ko sur le
      témoin.
    - Chiffres du témoin, qui ont tranché **contre le clustering** : 8
      signatures couvrent 87 à 100 % des nœuds de chaque niveau (articles : 60
      signatures pour 818 nœuds, dont `définition · corps×N` à ~59 %). Les
      motifs sont littéraux ; un regroupement flou ne ferait que brouiller ce
      qui est net. À rouvrir seulement si un manuscrit montre une longue traîne.
  - **completeness** — seul volet calculé **à la volée** au `GET` et jamais
    persisté (`completeness.ts`) : il ne dépend que des comptes de mots
    (`computeStats`), pas du NLP, donc le recalculer coûte moins cher que le
    stocker. D'où sa présence garantie dans la réponse (pas de `null`), et le
    fait que le bloc anomalies du dashboard s'affiche sans service NLP.
    Expose la table des anomalies (feuilles stub) ET la `distribution` des
    feuilles sur toute l'échelle, ventilée par axe de tête + un groupe
    « Total » — une barre du graphe de complétude.
    Deux échelles à ne pas confondre (`CompletenessStatus` vs
    `CompletenessDisplayStatus`) : les 4 paliers **calculés**
    (vide/ébauche/partiel/rédigé) et les 2 états **décidés** par
    l'utilisateur (validé/périmé), qui écrasent le palier calculé à
    l'affichage. `classify()` ne connaît que les premiers — c'est
    volontaire : `stubNodeIds` (exclusion du corpus thématique) ne doit
    dépendre que de la longueur du texte, pas d'une validation.
  - **conformity** — même nature que completeness (dérivé, sans NLP, calculé
    au `GET`, jamais persisté) : ce qui manque à chaque nœud pour être
    réputé prêt, selon les règles du document (`documents/rules.ts`,
    `GET`/`PUT /documents/:id/rules`).
    - **Règles par profondeur** : `DocumentRules = { default: RuleSet; byDepth:
      Partial<Record<0|1|2, RuleSet>> }` — ce qu'on attend d'un axe, d'un bloc
      et d'un article n'a rien de commun. La clé 2 vaut « 2 et au-delà », même
      regroupement que `zoneOfDepth` et que les modèles de structure : un
      « Article » doit désigner le même objet partout.
    - `byDepth` **remplace** `default`, ne le complète pas. Fusionner rendrait
      impossible de RETIRER un critère à une profondeur, et « quelles règles
      s'appliquent ici ? » ne se lirait plus nulle part en entier.
    - **Qui est jugé** : les feuilles, comme avant — un conteneur n'a pas à
      porter une définition. MAIS un jeu explicite pour une profondeur veut dire
      qu'on l'a décrété pour elle : ses nœuds sont alors jugés, feuilles ou non.
      D'où `judgedCount` (et non plus `leafCount`) dans `ConformityAnalysis`.
      Sans `byDepth`, ce sont exactement les feuilles.
    - **Les critères ne sont étiquetés par niveau que s'il y a un réglage par
      profondeur** (`hasPerDepthRules`) : sinon « au moins 500 caractères » à
      deux niveaux se confondrait en une seule barre du graphe, avec des échecs
      mélangés. Le backend compose le `label` final (« Articles — au moins
      500 caractères ») parce que `ConformityChart` l'affiche tel quel.
    - **`normalizeRules` accepte le format historique à plat** et le remonte en
      `default` : des documents en base le portent, le casser effacerait des
      réglages. `null` (jamais configuré) → les DÉFAUTS, pas des règles vides,
      qui déclareraient tout le monde conforme. `getRules` doit donc normaliser
      et non rendre la colonne brute. Verrouillé par `rules.spec.ts`.
    - **Indicatif, pas bloquant** : la conformité n'interdit pas la validation
      manuelle. Décision dictée par les chiffres du témoin — exiger définition
      + tableau des liens y rend 821 chapitres sur 824 non conformes (0,4 %).
      Une règle qui interdit tout dès le premier jour serait contournée, pas
      suivie. Les défauts (`DEFAULT_RULES`) ne retiennent donc que les deux
      critères applicables : >= 500 caractères (51 % passent) et zéro
      annotation (89 %).
    - `available: false` tant que la typologie n'est pas arbitrée : sans elle,
      « sans annotation » ne repose sur rien. Mieux vaut se taire qu'un
      verdict creux.
    - Piège : le critère « tableau » se lit dans `connexe.tableau`, **pas**
      via les rôles. Le parseur aplatit les tableaux en données, leurs
      paragraphes n'apparaissent jamais dans `texte[]` — un
      `requiresRoles: ['tableau']` mesurerait 0 tableau sur les 35 que porte
      le témoin.
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
voir `../frontend/CLAUDE.md`) : preview avant toute écriture, ajustement
manuel du niveau par titre et des **deux bornes** du livre — début de la
structure (liminaire avant) et début de la partie finale (table des matières,
index, glossaire après). Cf. `ImportCorrections.structureStartIndex` /
`structureEndIndex` ; la seconde est optionnelle.

Pistes explorées et **abandonnées** faute de signal fiable :
- Recoupement avec la table des matières pour corriger les niveaux : elle
  est générée à partir des mêmes niveaux que le corps, donc reflète
  fidèlement une éventuelle erreur au lieu de la révéler.
- Pondération par motif de récurrence structurel : un axe mal classé en
  bloc peut être structurellement identique à un vrai bloc (même nombre de
  sous-titres) — seul le contenu sémantique les distingue.
- **Symétriser `suggestStructureStartIndex` pour trouver la FIN** (« le dernier
  titre figurant dans la ToC clôt le corps ») : écrit, essayé sur le témoin,
  retiré. Il y coupait à « Octogramme », un article de niveau 3, parce que les
  deux derniers titres avaient été ajoutés après la dernière mise à jour de la
  ToC — 816 articles au lieu de 818, sans un mot. Une ToC périmée est la norme
  sur un manuscrit vivant. Et le prix de l'erreur n'est pas symétrique entre
  les deux bouts : au début, une borne trop basse laisse du liminaire dans le
  corps — visible, corrigeable ; à la fin, elle ampute de vrais chapitres en
  silence. `suggestStructureEndIndex` ne se fie donc qu'au NOM du titre
  (`FINAL_TITLE_RE`), et seulement dans le dernier tiers — un « Index » au
  milieu d'un manuscrit est un chapitre. Ne rien suggérer est son résultat
  normal : le témoin n'a pas de partie finale.

La table des matières reste utile pour une chose, et une seule : suggérer où
la vraie structure commence (`suggestStructureStartIndex` — le premier
titre du corps qui apparaît aussi dans la table des matières signale la fin
du liminaire, qui lui n'y figure jamais). Le sens de lecture compte : ce
signal-là dit « le liminaire s'arrête ici », ce qu'une ToC périmée ne remet
pas en cause (elle est incomplète par la fin, pas par le début).

**Le liminaire et le final ne sont pas de la structure** : `ParsedResult`
les porte en `TexteEntry[]` (donc avec `styleName`/`highlight` — c'était tout
le trou de l'ancien `preambule: string[]`, qui rendait ces zones muettes pour
la typologie), et ils sont persistés en colonnes `Json` sur `Document`, pas en
`Node`/`Paragraph` : leur donner des nœuds les ferait entrer dans
`completeness`, `conformity` et l'arbre de `StructureView`, où ils n'ont rien
à faire. Un titre y est aplati en simple entrée de texte.

## Modèle de données (`prisma/schema.prisma`)

- `Document` — un livre importé ; stats agrégées mises en cache à l'import
  (`totalMots`, `totalCaracteres`, etc.) plutôt que recalculées à la volée.
  `styleInventory` (relevé à l'import, irrécupérable autrement) et
  `styleTypology` (décidé par l'utilisateur, `null` tant que rien n'est
  arbitré) — voir `typology.ts`.
  `totalAxes`/`totalBlocs`/`totalArticles` restent 3 champs figés (compat
  registre) mais leur sens est généralisé : profondeur 0 / profondeur 1 /
  profondeur ≥ 2, peu importe la profondeur réelle de l'arbre.
- `Node` — un titre à profondeur arbitraire (`level: Int`, pas un enum figé
  à 3 valeurs). `parentId` + `position` explicites (colonnes, pas un index
  de tableau JSON) : réordonner un chapitre est un `UPDATE`, pas une
  réécriture de blob. `id` réutilise l'UUID généré par `harmonize()` au
  moment du parse.
- `Paragraph` — un paragraphe de texte, rattaché à un `Node`, `position`
  explicite (même logique que ci-dessus). `styleName` (style effectif résolu)
  et `highlight` (surlignage du paragraphe entier) sont nullables : les
  documents importés avant ces colonnes n'en ont pas, et le `.odt` n'étant pas
  conservé, seule une réimportation les remplit.
- `DocumentSource` — le `.odt` d'origine, tel quel. **Table à part et non une
  colonne `Bytes` sur `Document`** : Prisma ramène toutes les colonnes
  scalaires quand le `select` n'est pas explicite, et un blob sur `Document`
  ferait charger des centaines de Ko à chaque `findUnique` — y compris ceux qui
  ne veulent qu'un titre. Ici il faut le demander (`select: { source: … }`,
  cf. `getSource`) pour l'avoir. Sur le témoin : 376 Ko.
  Ce que ça débloque : la calibration d'import redevient **rejouable** (elle
  était à sens unique, le buffer ne vivant que le temps de `pendingImports`),
  et le parseur peut être enrichi sans exiger un réimport manuel.
  Nullable : les documents importés avant cette table n'en ont pas.
- `NodeValidation` — la relecture manuelle d'un chapitre. Table à part, et
  pas une colonne de `Node` ni un volet de `DocumentAnalysis` : c'est un fait
  **utilisateur**, qu'un réimport ne doit pas charrier et qu'un recalcul
  d'analyse ne doit pas écraser. `contentHash` (sha256 du texte brut au
  moment de la validation, `nodeContentHash`) fait basculer le chapitre en
  « périmé » si le texte change ensuite, plutôt que de le dévalider en
  silence. Le hash **normalise les espaces** délibérément : `stripHtmlTags`
  remplaçant chaque balise par une espace, sans ce collapse un simple passage
  en gras périmerait la relecture. Effet de bord assumé : recouper un
  paragraphe sans toucher aux mots ne périme rien.

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
