# Liminaire — `components/liminaire/`

Typage et composition des pages liminaires (avant/après le récit), monté dans la
section Liminaire de la config (cf. `../config/CLAUDE.md`). Le liminaire N'EST PAS
de la structure : il vit en colonnes `Json` sur `Document`, pas en `Node`
(backend : `../../../../backend/CLAUDE.md`). Feature en cours.

## Vocabulaire — `../../script/liminaire.js`

`LIMINAIRE_PAGES` : les pages conventionnelles dans l'ordre de lecture,
vocabulaire **FERMÉ** (comme `STYLE_ROLES`) — les règles de composition les
visent, une étiquette libre casserait une vérification en silence. Chaque page
porte `obligatoire`, `position` (avant/après le récit) et **`side`** : le côté
ATTENDU par la convention (recto = impaire, verso = paire), ou `null`. À ne pas
confondre avec le côté **réel** lu du `.odt` (`pageStart`, encodé par le
master-page du parse, cf. backend) ni le côté **choisi** par l'utilisateur
(`config`). Dédicace/épigraphe sont des **ancres de parité** (recto imposé,
verso blanc avant) : sans côté imposé elles dérivent et décalent tout le
liminaire. `../../script/liminaire-bornes.js` (absorption des bornes),
`liminaire-suggest.js` (suggestions de type), tous testés.

## Composants

- **`../LiminaireComposer.vue`** (orchestrateur, à la racine `components/`) — un
  `AnalyseBlock aside="right" bare` : main = accordéon des vis-à-vis, aside =
  découpage du vis-à-vis focusé + verdict. Détient l'état partagé (config mutée
  **en place**, convention `RuleSetForm` ; focus) et le distribue, ne rend rien
  lui-même. **`borderShift`** : décaler une borne n'est qu'une PRÉVISUALISATION —
  les entrées absorbées ne sont dans aucune base tant qu'un recalibrage n'a pas
  reconstruit l'arbre ; l'`UiCallout` le dit fort (sinon on croit avoir
  enregistré). « Redéfinir le liminaire » émet `redefine` → recalibration.
- **`LiminaireAccordeon.vue`** — les vis-à-vis se chevauchent en profondeur, seul
  le focusé est à pleine taille (les autres à 0.75). Navigation SOUS la scène
  (flèches + pastilles + réglette). Le DERNIER cran n'est pas un vis-à-vis mais
  l'action d'étendre le liminaire — d'où `slideCount = spreads + 1` dans toute la
  mécanique.
- **`../LiminaireFolio.vue`** — UN folio physique, sans état ni contrôle : la page
  ne porte que son verdict (type/suggestion/aperçu), les contrôles vivent sous la
  scène (une page réduite et chevauchée ne se clique pas). Gère couverture / page
  blanche / blanche implicite (parité).
- **`LiminaireDecoupage.vue`** — le découpage des SEULES pages du vis-à-vis
  focusé : la seule vue qui montre les entrées, donc la seule où scinder. Le
  **type** se pose dans l'accordéon (une page a un type, pas une entrée) ; ici on
  scinde / rattache une frontière (mêmes gestes, même gouttière). Config mutée en
  place.
- **`LiminaireEligibilite.vue`** — le verdict (`deriveEligibility`) : porte sur
  TOUT le liminaire (un manquant se juge sur l'ensemble), pas sur le vis-à-vis
  focusé. Pages obligatoires présentes/absentes + conflits de composition
  recto-verso (côté choisi vs attendu) + doublons.
