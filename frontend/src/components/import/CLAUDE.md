# Import `.odt` — `components/import/`

Import d'un `.odt` en deux temps : `POST /documents/preview` (parse + calibration)
puis `POST /documents/preview/:previewId/commit`. **Plus d'écran ni de route
dédiés** : la calibration vit TOUJOURS en modale (`../ui/molecules/UiModal.vue`).

- **`ImportButton.vue`** (déclencheur, monté à l'accueil et dans l'aside de config,
  état dans `../../composables/useRegistry.js`) ne fait que poser `pendingPreview`
  — il ne navigue plus.
- **`ImportCalibrationModal.vue`** est montée **une seule fois** dans `App.vue` et
  s'ouvre dès que `pendingPreview` est posé (état de module → sert les deux points
  d'entrée sans écran par instance). Commit → config du document créé ; annuler →
  jette le preview, on reste où on était.

## Calibration — `ImportCalibration` / `CalibrationNode`

`ImportCalibration.vue` est **montée dans deux modales** : `ImportCalibrationModal`
(mode `import`, hôte `UiModal`) et `../config/RecalibrationModal.vue` (mode
`recalibration`, `UiModal` aussi). Elle vit donc **toujours en modale et toujours
`.calibration--boxed`** : sa seule liste (`.outline`) défile dans une
`CustomScrollbar` maison, son pied (« Annuler / Valider ») reste sous la main —
une seule barre de défilement, portée par la liste. Le `previewId` porte la
destination ; le `mode` n'arbitre plus que **les mots** (`commitLabel`,
avertissement) : « Valider le calibrage » à l'import, « Recalibrer » en
recalibrage. Le **titre et le mode d'emploi (pastille `?`)** ne sont plus dans la
calibration — ils sont portés par la modale hôte (`UiModal` : props `title` /
`hint`).

`UiModal` (générique) : voile clair + panneau flouté + bandeau titré ;
`z-index` 200 **au-dessus des barres** (topbar/doc-bar) — l'overlay doit recouvrir
leurs actions (« Relancer l'analyse » pendant qu'on reconstruit l'arbre serait
contradictoire). Le panneau reste calé sous elles via `topBars` (2 en config,
1 à l'accueil). Backdrop-clic et Échap ferment (émettent `close`). En
recalibrage, `RecalibrationModal` garde `open` **distinct de `preview`** : elle
s'ouvre au clic et porte l'attente (spinner) pendant que le backend relit le `.odt`.

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
