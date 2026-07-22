# Modèle de données — `prisma/schema.prisma`

- **`Document`** — un livre importé ; stats agrégées mises en cache à l'import
  (`totalMots`, `totalCaracteres`…) plutôt que recalculées. `styleInventory`
  (relevé à l'import, irrécupérable autrement) et `styleTypology` (décidé par
  l'utilisateur, `null` tant que rien n'est arbitré — voir
  `../src/documents/CLAUDE.md`). `totalAxes`/`totalBlocs`/`totalArticles` restent
  3 champs figés (compat registre) mais leur sens est généralisé : profondeur
  0 / 1 / ≥ 2, peu importe la profondeur réelle de l'arbre.
- **`Node`** — un titre à profondeur arbitraire (`level: Int`, pas un enum figé).
  `parentId` + `position` **explicites** (colonnes, pas un index de tableau JSON) :
  réordonner un chapitre est un `UPDATE`, pas une réécriture de blob. `id`
  réutilise l'UUID généré par `harmonize()` au parse.
- **`Paragraph`** — un paragraphe rattaché à un `Node`, `position` explicite.
  `styleName` (style effectif résolu) et `highlight` (surlignage du paragraphe
  entier) nullables : les documents importés avant ces colonnes n'en ont pas, et
  le `.odt` n'étant pas conservé, seule une réimportation les remplit.
- **`DocumentSource`** — le `.odt` d'origine, tel quel. **Table à part et non une
  colonne `Bytes` sur `Document`** : Prisma ramène toutes les colonnes scalaires
  quand le `select` n'est pas explicite, un blob sur `Document` ferait charger des
  centaines de Ko à chaque `findUnique` (y compris ceux qui ne veulent qu'un
  titre). Ici il faut le demander (`select: { source }`, `getSource`). Témoin :
  376 Ko. `sizeBytes` est une colonne à part **exprès** : répondre « le fichier
  est là, il pèse tant » (`hasSource`, `SOURCE_PRESENCE`) sans charger le blob.
  Débloque : la calibration d'import redevient **rejouable** (recalibrate) et le
  parseur peut être enrichi sans réimport. Nullable (documents antérieurs).
- **`NodeValidation`** — la relecture manuelle d'un chapitre. Table à part (pas
  une colonne de `Node` ni un volet de `DocumentAnalysis`) : un fait
  **utilisateur** qu'un réimport ne doit pas charrier ni un recalcul d'analyse
  écraser. `contentHash` (sha256 du texte brut à la validation, `nodeContentHash`)
  fait basculer le chapitre en « périmé » si le texte change, plutôt que de le
  dévalider en silence. Le hash **normalise les espaces** délibérément
  (`stripHtmlTags` remplace chaque balise par une espace) : sans ce collapse, un
  simple passage en gras périmerait la relecture. Effet de bord assumé : recouper
  un paragraphe sans toucher aux mots ne périme rien.

Pas encore de versioning bloc par bloc — prévu plus tard. L'architecture (ids
stables, `position` en colonne) est pensée pour l'accueillir sans migration
lourde, mais rien n'est branché aujourd'hui.

**Prisma épinglé en v6** (`prisma`/`@prisma/client` en `^6.19.3`) : la v7 change
la configuration datasource (adapters obligatoires, `url` dans le schema plus
supporté pour Migrate) — pas adopté ici, à reconsidérer consciemment, pas par un
`npm update` distrait.

Migrations et régénération du client : voir `../CLAUDE.md` (« Infra locale »).
