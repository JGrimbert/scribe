# Configuration du document — `components/config/`

`/documents/:id/config` (`ConfigView.vue`), **un seul écran** (plus de volets)
organisé par **typologie de contenu**, dans l'ordre de lecture : Liminaire →
Chapitrage niveau 1/2/3+ → Partie finale, puis un socle « Règles par défaut » et
une section Surlignages. Chaque section de chapitrage porte SES styles, SES
modèles et SES règles côte à côte — l'axe n'est pas « type de réglage »
(structure vs styles) mais « type de contenu ». Le vocabulaire par défaut n'est
plus « Axes/Blocs/Articles » (métier Marvarid) mais le **niveau de chapitrage**
(`../../script/zones.js`, `typology.js` + `DEPTH_LABELS` backend, alignés).

`/documents/:id/styles` **redirige** ici (l'ancien écran de typologie a fondu
dans la config ; les liens posés visent encore l'ancienne URL).

## Découpage

- **`ConfigView.vue`** orchestre : en-tête (stats + suppression), boucle de
  `TypologySection`, socle « Règles par défaut », section Surlignages, footer
  d'enregistrement. Héberge le flux de recalibration (un `preview` posé fait
  prendre tout l'écran à la calibration).
- **`../../composables/useTypologyConfig.js`** porte les données : inventaire,
  `styles`, `highlights`, `rules` (`{ default, byDepth }`), `settled`, les
  modèles (`useStructureShapes`), et le calcul des `sections` (une par zone,
  `groupByZone` + `shapeGroups` + profondeur des règles). `load(id)`/`save(id)`.
- **`TypologySection.vue`** rend une typologie : styles (2/3) ‖ modèles (1/3) via
  `AnalyseBlock aside="right"` pour les zones de chapitrage, puis les règles
  dessous ; styles seuls pour liminaire/final. Slot `#lead` pour la reprise des
  bornes dans le liminaire.
- **`StyleRolesTable.vue`** — table style · extrait · rôle, scopée à une zone,
  réutilisée dans les deux cas. `styleRoles` est muté **en place** (comme
  `RuleSetForm` mute son `ruleSet`).

## Recalibration — réduite aux bornes, dans le liminaire

`POST /documents/:id/recalibrate` rend un `PreviewResponse` ordinaire ;
`ConfigView` monte alors le MÊME `ImportCalibration` (cf. `../import/CLAUDE.md`) en
`mode="recalibration"`. Le `previewId` sait qu'il s'agit d'un remplacement, le
commit repasse par la route de commit normale. Le déclencheur (« Reprendre les
bornes du livre ») vit dans la section **Liminaire** : c'est elle qui définit où
le liminaire s'arrête.

- **Niveaux de titre démotés** : la calibration ne différencie plus par défaut
  que liminaire / contenu / partie finale. Le réglage manuel −/+ reste dispo mais
  **replié** sous « réglages avancés » (`showLevels`).
- **`hasSource` (+ `sourceSizeBytes`)** dit si le `.odt` est conservé : le bouton
  est **barré d'avance** sur un document importé avant `DocumentSource`. Ne pas
  confondre avec `sourceFilename` (le NOM du fichier, toujours rempli). Le 404 du
  backend reste le filet ; `recalibratable` vaut `true` tant que le registre
  n'est pas chargé (pas de clignotement).
- **Le rapport (`RecalibrationReport`) reste affiché** en en-tête, pas en toast :
  une relecture perdue doit pouvoir se lire et se refaire. `error` s'il y a des
  perdues, `info` sinon. Le backend le rend à CHAQUE `replace`.
- Après commit : `reloadDocument` (injecté) rafraîchit `trame`/`data` (ids de
  nœuds regénérés) ET `load(id)` recharge la typologie (la ventilation change).
  Le store d'analyse n'est pas touché.
- **Les stats se lisent dans `useRegistry`**, pas dans un appel dédié :
  `GET /documents/:id` ne les porte pas, et la liste est déjà chargée pour l'aside.

## Styles, modèles, règles par section

`GET /documents/:id/typology` sert inventaire + suggestions + décisions prises ;
`GET /rules` les règles. **Les suggestions pré-remplissent mais ne sont
persistées qu'à l'enregistrement** : ce qu'on voit est une proposition.

- **`AnalyseBlock` en mode `bare`** : la prop `bare` pose `.split--bare`
  (`analyse.css`) — le `main` perd fond/cadre et n'est plus centré, c'est la
  colonne étroite qui porte SA bordure (card autonome). Le mode normal veut
  l'inverse (asides sans bordure propre) : le travers qu'on évitait ici était un
  double trait cadre + séparateur. Voir `../analyse/CLAUDE.md` pour `AnalyseBlock`.
- **Répartition main/aside** : le `main` porte la **table des styles** (style ·
  extrait · rôle) PUIS les **modèles inlinés**, discrets (une ligne de
  signatures, pas une card). L'aside porte les **règles d'éligibilité**. Changer
  un rôle recompose les modèles dans le même tick — d'où leur présence côté styles.
- **Ordre des styles = ordre d'apparition** (`firstIndex`, cf. backend
  `inventory.ts`), pas par fréquence. Repli sur le poids/count pour les documents
  importés avant `firstIndex` (styleInventory figé ; un recalibrage le repeuple).
- **Modèles inlinés** : le rôle `corps` ne porte jamais son `×N`
  (`../../script/shapes.js`) — remplissage attendu, décompte = bruit.
- **Règles toujours affichées** : chaque niveau montre le toggle « des règles
  propres à ce niveau » + `RuleSetForm` (émet `toggle-rules`, `ConfigView` appelle
  `toggleDepth`). Un niveau qui suit le défaut montre les **valeurs du défaut en
  grisé** (`RuleSetForm disabled`) plutôt qu'un vide. Cocher un niveau part d'une
  **copie du défaut**.
- **Surlignages + Non situés en bas** : section globale des surlignages (par
  couleur, `HIGHLIGHT_ROLES`) ; les styles « Non situés » (paragraphes vides :
  filets, ornements — ni nœuds, ni modèles, ni règles) juste dessous, à typer eux
  aussi. Ils sortent de la boucle des sections (`useTypologyConfig.unzonedStyles`).

`DocumentLayout` charge `settled` à part (`provide('typologySettled')`) ;
`AnomaliesBlock` s'en sert pour renvoyer ici. Défaut `true` (« présumé arbitré »)
pour ne pas faire clignoter un renvoi avant de savoir.

### Le tableau des styles

Rangé **dans l'ordre du livre** (`../../script/zones.js`) et non par fréquence
brute : un style se lit d'abord par où il vit (« Dédicace » n'est pas rare, il
est liminaire). Chaque zone est SA section, mais l'ordre/regroupement vient de
`zones.js`. Trois points :
- chaque style n'apparaît **qu'une fois**, dans sa zone dominante — la ligne
  porte le `v-model` du rôle, un doublon donnerait deux contrôles pour une
  décision. Table réduite à style · extrait · rôle (usages et `StackedBar`
  retirés, bruit face au rôle) ;
- section **« Non situés »** pour les styles que la ventilation ne place nulle
  part (paragraphes vides, `sum(byZone) <= count` côté backend) ;
- **fallback plat** si `byZone` absent (document importé avant la ventilation) —
  une recalibration le ventile. Tout empiler dans « Non situés » serait un
  mensonge (ces styles ont une zone, on ne la connaît pas).

### Modèles de structure

`useStructureShapes.js` + `../../script/shapes.js`, alimentés par
`GET /documents/:id/structure-shapes` : formes récurrentes par niveau. Le backend
rend des **styles**, la traduction en rôles se fait ici contre la typologie **en
cours d'édition** — changer un rôle recompose les motifs dans le même tick, sans
aller-retour (cf. `../../../../backend/CLAUDE.md`). Trois pièges :
- un nœud **sans texte n'a pas de forme**, jamais proposé comme modèle (« vide »
  est la forme la plus fréquente à tous les niveaux — la promouvoir = proposer
  « un chapitre ne doit rien contenir ») ;
- les pourcentages portent sur les nœuds **rédigés**, pas le total ;
- le chargement des modèles est **détaché** (pas d'`await` dans `load()`) : son
  échec ne doit pas masquer la typologie, objet de l'écran.

### Règles d'éligibilité

`GET`/`PUT /documents/:id/rules`. Indicatives — « Valider » reste actif quoi
qu'il arrive, seul le compte de conformes du dashboard en dépend (backend pour le
pourquoi chiffré). Un **jeu par niveau** ; le formulaire est `RuleSetForm.vue`,
réutilisé tel quel :
- `RuleSetForm` **mute son `ruleSet` en place**, délibérément : le parent détient
  l'objet réactif, remonter chaque case par `update:modelValue` recréerait des
  objets pour rien (jusqu'à quatre jeux vivants). Porte son propre brouillon de
  seuil — un draft partagé afficherait le seuil d'un niveau dans le champ d'un
  autre ;
- cocher « des règles propres à ce niveau » part d'une **copie du défaut**, pas
  d'un jeu vide (on règle par écart au défaut) ;
- `save()` sérialise par `JSON.parse(JSON.stringify(rules))` : `rules` est un
  proxy réactif **imbriqué**, un spread de surface enverrait des proxies ;
- vocabulaires fermés (`STYLE_ROLES`, `REQUIRABLE_ROLES`) et libellés de niveau
  (`DEPTH_TABS`) dans `../../script/typology.js`, alignés sur le backend.
