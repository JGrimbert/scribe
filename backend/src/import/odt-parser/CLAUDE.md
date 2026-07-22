# Parseur ODT — `src/import/odt-parser/`

Un **dossier**, pas un fichier — découpé par thème, la carte est en tête de
`index.ts` (types / text-utils / xml / visual / flatten / calibration /
hierarchy / harmonize / inventory / zones).

Port de `Marvarid/parser/parse.js` + `harmonize.js` (cf. `../../../../CLAUDE.md`),
avec deux différences assumées : lecture depuis un `Buffer` en mémoire (upload
multipart) plutôt qu'un fichier disque ; et une hiérarchie de titres à
**profondeur arbitraire** (`ParsedNode` récursif) plutôt que les 3 niveaux figés
axe/bloc/article — un ODT n'a nativement que des `text:outline-level` 1..10, la
notion axe/bloc/article est propre à Marvarid, pas au format. Deux passes :

- **`buildFlatNodes(xmlContent, stylesXml?)`** : lit le XML une fois, produit une
  liste plate `FlatNode[]` (titre / paragraphe / tableau, dans l'ordre) sans
  hiérarchie. Extrait aussi les styles `fo:break-before` (saut de page forcé —
  indice de calibration) et le texte de la ToC (`extractTocTexts`) pour suggérer
  où la structure commence.
- **`buildParsedResult(flatNodes, meta, sectionsRencontrees, corrections?)`** :
  construit la hiérarchie via une pile, en tenant compte des corrections
  utilisateur (`ImportCorrections`). `level` (1-indexé) ne pilote que « combien
  d'ancêtres fermer » ; la profondeur réelle est la position dans la pile — un
  saut de niveau (Titre 1 → Titre 3) imbrique sans nœud fantôme.
- `parseOdtXml`/`parseOdtBuffer` enchaînent les deux passes (sans correction =
  défaut).

**Tests** (`*.spec.ts` colocalisés, modules à logique pure) travaillent sur des
fragments XML écrits à la main — **aucun ne charge un vrai `.odt`**, et c'est la
limite : la lecture de `styles.xml` était verte sur fixtures alors qu'elle
rendait zéro style sur le manuscrit témoin. Un parse du vrai fichier reste le seul
juge.

## Styles ODT — héritage, surlignages, inventaire

À lire avant de toucher à la mise en forme d'origine :
- **Résolution de l'héritage** (`buildStyleTable`/`effectiveStyleName`, `xml.ts`)
  — LibreOffice génère un style automatique (`P26`, `T130`) dès qu'un paragraphe
  porte la moindre mise en forme directe, héritant du vrai style via
  `style:parent-style-name`. Témoin : **338 noms bruts pour 33 styles réels**.
  Sans ça, toute typologie est illisible. `FlatNode` porte les deux : `styleName`
  (brut — reste la source de `headingLevel`, ne pas y substituer l'autre sous
  peine de changer la structure détectée) et `effectiveStyle` (résolu + décodé).
- **Deux formes de surlignage** — témoin : 164 paragraphes entiers
  (`fo:background-color` sur le style de paragraphe → `FlatNode.highlight`) ET
  160 spans inline (style de caractère → `<mark data-hl="#ffff00">` posé par
  `nodeTextWithLinks`). Le blanc (`#ffffff`) n'est jamais un surlignage
  (LibreOffice le pose partout par défaut).
- **L'inventaire (`inventory.ts`) se construit sur le XML, pas sur les FlatNode**
  — ceux-ci sont la vue *structurelle* (tableaux aplatis, paragraphes vides
  écartés). Le style « Voir » (183 usages, en tableaux) disparaissait tant qu'il
  était construit sur eux. Sont écartés les **appareils générés** — ToC ET index
  (`GENERATED_ANCESTOR`) : leurs styles sont posés par LibreOffice, pas l'auteur.
- **Ventilation par zone (`zones.ts`, `StyleUsage.byZone`)** — où chaque style
  vit : `liminaire`, `depth-0/1/2+`, `final`. Trois choses :
  - **Les zones sortent de `buildParsedResult`**, qui tient déjà la pile des
    titres — `zones.ts` ne fait que ventiler. Refaire une pile ailleurs, c'était
    deux logiques de profondeur vouées à diverger. Une passe, une pile.
  - **`sum(byZone) <= count`, jamais `==`** : `count` vient du XML (exhaustif,
    fait autorité pour `isTypologySettled`), `byZone` des FlatNode. Échappent à la
    ventilation les paragraphes vides et les métadonnées absorbées. Ne jamais
    dériver l'un de l'autre.
  - **`FlatNode.innerStyles`** relève les styles des paragraphes qu'un nœud
    APLATIT (cellules, items de liste). Sans lui, « Voir » (183) et « Puces ? »
    (15) sont comptés mais situés nulle part.
  - **L'inventaire dépend des corrections de calibration** (les bornes déplacent
    les zones) → **il ne se fige qu'au commit**, pas au preview.
  - Témoin : 31 styles, dont 22 mono-zone (71 %) — le regroupement porte
    l'information.
- **Les deux regex en dur ont perdu leur autorité** — `hierarchy.ts` classait
  citations/pistes sur le NOM du style (`/citation|quote/i`). Ne tenaient que sur
  des noms bruts, pas corrigeables. La vérité est désormais dans `styleName` +
  `highlight`, arbitrés par la typologie du document (`typology.ts`).
- **Les marqueurs ne sont pas du texte** — `texte[].text` porte des balises
  (`<a data-bookmark>`, `<mark data-hl>`). Tout calcul dessus passe par
  `stripHtmlTags` (`text-utils.ts`, source unique, réexportée par
  `analyse/plain-text.ts`) : sans ça `computeStats` compte « <mark » comme des
  mots (+~175 mots sur le témoin). Verrouillé par `hierarchy.spec.ts`.
- **Le `.odt` source est conservé** (`DocumentSource`, cf. `../../../prisma/CLAUDE.md`)
  → un enrichissement du parse est applicable rétroactivement en rejouant depuis
  le blob. Réserves : les documents importés **avant** cette table n'ont pas de
  source (seul un réimport les rattache) ; `styleInventory`/`liminaire`/`final`
  restent capturés sur `Document` à l'import (les recalculer à chaque lecture
  reparserait un ZIP de 1,6 Mo pour un tableau).

### Apparence des styles & format de page (`visual.ts`)

`xml.ts` ne lit que `content.xml`, où un style nommé n'a qu'un NOM ; ses
propriétés vivent dans `styles.xml` (61 Ko sur le témoin), que `visual.ts` lit.
Unique raison d'être : un aperçu FIDÈLE du livre (carrousel de pages-échantillons
côté frontend) ; sans lui, tout rendu est une invention.
- **Chaîne d'héritage résolue en ENTIER** (contrairement au saut unique
  d'`effectiveStyleName`, qui reste la source du NOM) : « Heading 1 » → « Heading »
  → « Standard », chaque cran n'apporte qu'une partie. Fusion racine → feuille,
  l'enfant l'emporte propriété par propriété ; `toVisual` n'émet que les clés
  réellement portées (une clé `undefined` écraserait l'héritage) ; un `seen` casse
  les cycles.
- **`style:font-name` ne nomme pas une police** : référence interne
  (« Georgia2 ») vers une `style:font-face` qui porte la vraie pile CSS. Sans
  `buildFontFaces`, le navigateur ignore `font-family: Georgia2` et l'aperçu ment.
- **Valeurs telles quelles** (« 12pt », « 2.401cm », « 115% ») : déjà du CSS
  valide ; les passer en px supposerait un DPI que seul l'affichage connaît.
- **Seuls les styles de PARAGRAPHE réellement inventoriés** : `buildVisualStyles`
  résout tout (368 entrées), `inventory.ts` ne retient que les `StyleUsage.name`
  → 31/31, 4,8 Ko. Le reste (« P26 ») n'est jamais une clé — le persister = du
  ballast relu à chaque ouverture.
- **Corollaire** : on résout les styles NOMMÉS, donc un `P26` qui ajoute un
  italique local perd sa surcharge. Cohérent avec la base (`Paragraph.styleName`
  porte déjà le style effectif) — l'aperçu montre le style, pas les retouches.
- **Format de page depuis le master-page « Standard »**, et lui seul (le témoin
  en porte 15 : Première page, Enveloppe, Paysage…). Résultat : A5, 14,801 ×
  21,001 cm, marges 1/1,199/2/2 — alors que Folio rend de l'A4 par défaut.
  `readPageFormat` rend `undefined` plutôt qu'inventer.
- ⚠️ **Piège xpath** : le `select` de `xml.ts` ne déclare que `text`/`table`/`fo`.
  Un prédicat `@style:name="Standard"` **lève** (préfixe inconnu) — d'où
  `@*[local-name()="name"]`, comme partout dans le parseur.
- ⚠️ **`ventilateInventory` doit spreader son entrée** (`...inventory`) : elle
  reconstruisait `{ styles, highlights }`, le jour de l'ajout de `visuals`/`page`
  les deux disparaissaient en silence, tests au vert. Verrouillé par `zones.spec.ts`.

## Calibration — logique de suggestion des bornes

Le niveau d'un titre vient de son style ODT — fiable seulement si l'auteur a été
cohérent. Sur un manuscrit réel, 7 titres qui auraient dû être des axes portaient
un style hérité de « Heading 2 » : bug de mise en forme, indétectable sans revue
humaine. D'où l'écran de calibration frontend (preview avant écriture, ajustement
du niveau par titre et des **deux bornes** ; cf. la calibration d'import côté
frontend) et `ImportCorrections.structureStartIndex`/`structureEndIndex` (la
seconde optionnelle).

Pistes explorées et **abandonnées** faute de signal fiable :
- Recoupement avec la ToC pour corriger les niveaux : elle est générée depuis les
  mêmes niveaux que le corps, donc reflète l'erreur au lieu de la révéler.
- Pondération par motif de récurrence : un axe mal classé peut être
  structurellement identique à un vrai bloc — seul le sens les distingue.
- **Symétriser `suggestStructureStartIndex` pour la FIN** : essayé, retiré. Il
  coupait à « Octogramme » (article niveau 3) parce que les deux derniers titres
  avaient été ajoutés après la dernière MAJ de la ToC — 816 au lieu de 818, sans
  un mot. Une ToC périmée est la norme. Le prix de l'erreur n'est pas symétrique :
  au début, une borne trop basse laisse du liminaire dans le corps (visible) ; à
  la fin, elle ampute de vrais chapitres en silence. `suggestStructureEndIndex` ne
  se fie donc qu'au NOM du titre (`FINAL_TITLE_RE`), dans le dernier tiers.

La ToC reste utile pour une seule chose : `suggestStructureStartIndex` — le
premier titre du corps qui apparaît aussi dans la ToC signale la fin du liminaire
(qui n'y figure jamais). Signal robuste à une ToC périmée (incomplète par la fin,
pas par le début).

**Le liminaire et le final ne sont pas de la structure** : `ParsedResult` les
porte en `TexteEntry[]` (avec `styleName`/`highlight` — le trou de l'ancien
`preambule: string[]` qui rendait ces zones muettes pour la typologie), persistés
en colonnes `Json` sur `Document`, pas en `Node`/`Paragraph` : des nœuds les
feraient entrer dans `completeness`/`conformity`/`StructureView`.
