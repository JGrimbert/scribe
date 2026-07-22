# Import `.odt` — `components/import/`

Import d'un `.odt` en deux temps : `POST /documents/preview` (parse + calibration)
puis `POST /documents/preview/:previewId/commit`. `ImportView.vue` (route
`/import`, plein écran, hors `DocumentLayout` : il n'y a pas encore de document)
monte la calibration ; `ImportButton.vue` (le déclencheur, monté à l'accueil et
dans l'aside de config, état dans `../../composables/useRegistry.js`) ouvre le flux.

## Calibration — `ImportCalibration` / `CalibrationNode`

`ImportCalibration.vue` est **montée à deux endroits** : par `ImportView.vue` sur
`/import` (après `POST /api/documents/preview`), et par `../config/ConfigView.vue`
en `mode="recalibration"` dans une modale. Le `previewId` porte la différence de
destination ; le `mode` arbitre deux choses de présentation :

- **Le chapeau** : mode d'emploi complet à l'import, une phrase en recalibrage.
- **La hauteur** (exception assumée). Sur `/import`, la calibration **n'a pas de
  hauteur propre** : elle défile avec la page dans la `CustomScrollbar`
  environnante (s'en donner une y remettrait la scrollbar imbriquée proscrite par
  le DS). En recalibrage, `.calibration--boxed` lui donne `height: 100%`, fait
  défiler **sa seule liste** (`.outline`) et fixe son pied : elle vit dans une
  modale à hauteur plafonnée où « Annuler / Recalibrer et remplacer » doit rester
  sous la main. Il n'y a toujours qu'UNE barre de défilement à l'écran — ce qui
  change, c'est qui la porte.

La modale (`ConfigView`) : `recalOpen` est **distinct de `preview`** — elle
s'ouvre au clic et porte l'attente (spinner) pendant que le backend relit le
`.odt`. Son `z-index` (200) passe **au-dessus de la doc-bar** (99) : l'overlay
doit recouvrir « Relancer l'analyse » (proposer une analyse pendant qu'on
reconstruit l'arbre serait contradictoire). Le panneau reste calé sous les deux
barres (`padding-top: calc(var(--bar-size) * 2 + var(--sp-4))`).

`CalibrationNode.vue` (récursif, replié par défaut, liseret de couleur par
niveau) liste les titres dans l'ordre du document. Deux corrections avant commit
(`POST /api/documents/preview/:previewId/commit`) :
- **Les deux bornes du livre** : chaque démarcation porte deux poignées (survol)
  — « Début du contenu » (fin du liminaire) et « Partie finale » (début de la
  ToC/index). La première est pré-positionnée (`suggestedStructureStartIndex`,
  ToC) ; la seconde (`suggestedStructureEndIndex`) **souvent absente** (le backend
  ne suggère une fin que sur le nom du titre — cf. `../../../../backend/CLAUDE.md`).
  Re-cliquer la poignée active la retire : la partie finale est facultative. Le
  backend refuse `endIndex <= startIndex`.
- **Niveau par titre** : boutons `−`/`+` (pas de liste — la sémantique
  axe/bloc/article est propre à Marvarid, pas à l'ODT). L'arbre se recalcule en
  direct. Un repère "⤓" signale un saut de page forcé (`hasPageBreak`).
