# Registre & import — `src/documents/`

`DocumentsModule` : le registre + le flux d'import en deux temps (calibration
avant écriture en base). Le parseur qu'il pilote vit dans `../import/odt-parser/`
(voir son `CLAUDE.md`) ; le modèle persisté dans `../../prisma/CLAUDE.md`.

## Endpoints

- **`GET /documents`** — liste avec stats agrégées, pour le registre frontend
  (aside config + accueil). Porte `hasSource`/`sourceSizeBytes` : le `.odt` est-il
  conservé, et gros comment. Lus via `SOURCE_PRESENCE` (`select: { sizeBytes }`) —
  **savoir si le blob est là sans le charger**, raison d'être de la table à part.
  À ne pas confondre avec `sourceFilename` (colonne de `Document`, toujours
  remplie : le nom du fichier, jamais sa présence). Sans `hasSource`, le frontend
  ne pouvait que tenter la recalibration et afficher le 404.
- **`GET /documents/:id`** — reconstruit `{ trame, data }` depuis la DB (parcours
  récursif générique via `parentId`, pas 3 boucles figées). Renvoie aussi les
  `validations` résolues par nœud et le titre du livre.
- **`POST /documents/preview`** — upload multipart d'un `.odt`, parse **sans
  écrire**, renvoie `{ previewId, outline, suggestedStructureStartIndex }`. Le
  buffer + nom sont gardés en mémoire (`Map` sur l'instance du service, pas de
  file multi-utilisateurs) le temps de la calibration — perdu au redémarrage.
- **`POST /documents/preview/:previewId/commit`** — reprend le buffer, réapplique
  le parse avec les corrections (`ImportCorrections` : `structureStartIndex` +
  `levelOverrides` par titre), persiste en transaction (`Document` + `Node`s +
  `Paragraph`s + `DocumentSource`). La `Map` ne couvre donc que la fenêtre
  preview → commit ; une fois en base, la source ne dépend plus d'elle.
- **`GET`/`PUT /documents/:id/typology`** — quel rôle joue chaque style ODT dans
  CE document (`typology.ts`). Le GET sert d'un coup l'inventaire, ce qui a été
  décidé (`null` si rien), les suggestions et `settled`. Vocabulaire **fermé**
  (`STYLE_ROLES` : corps/titre/chapeau/citation/définition/renvoi/tableau/liste/
  ornement/liminaire/ignorer) parce que les règles d'éligibilité vont le viser —
  une étiquette libre casse une règle en silence. Deux invariants :
  - les **suggestions ne sont jamais persistées** à la place de l'utilisateur
    (`styleTypology` reste `null` tant qu'il n'a pas enregistré) — sinon la
    machine se serait auto-validée ;
  - `settled` compare la typologie à l'inventaire plutôt que d'être un booléen
    « déjà configuré » : un style apparu depuis (réimport) repasse le document en
    « non arbitré ».
- **`GET /documents/:id/structure-shapes`** — la FORME de chaque nœud (séquence
  des styles en RLE). Dérivé, calculé au GET, jamais persisté. Servi ici (son
  consommateur est l'écran de typologie) ; détails et pourquoi-RLE dans
  `../analyse/CLAUDE.md`.
- **`POST /documents/:id/recalibrate`** — rejouer la calibration depuis le `.odt`
  conservé. Rend un `PreviewResponse` ordinaire ; le commit repasse par la route
  de commit, qui reconnaît un remplacement au `documentId` porté par
  `pendingImports`. Un seul flux, deux destinations — le frontend n'a pas à
  connaître la différence.
  - **Survit** : le `.odt`, la typologie et les règles (décisions utilisateur ;
    `settled` se recalcule contre le nouvel inventaire), et les validations
    (réapposées par ré-appariement).
  - **Jeté** : les analyses (`DocumentAnalysis` supprimée) — elles indexent des
    `nodeId`, que `harmonize()` regénère à chaque parse ; le cache d'embeddings
    étant adressé par contenu, le sémantique se recalcule sans revectoriser.
  - **Ré-appariement des validations** (`recalibration.ts`, `remapValidations`) :
    un nœud est identifié par **(slug, hash du texte courant)**. Ni l'id (change),
    ni le chemin de titres (recalibrer CONSISTE à le changer), ni le slug seul
    (unicité par parent seulement — deux « l-aube » sur le témoin), ni le texte
    seul (257 nœuds vides partagent le hash du vide). Couple ambigu des deux côtés
    → validation **perdue**, jamais devinée (une relecture perdue se refait d'un
    clic ; une relecture au mauvais chapitre ment). Le commit rend le compte
    (`RecalibrationReport`).
  - ⚠️ **Une recalibration écrase le contenu en base par celui du `.odt`** — c'est
    un reparse. Sans effet aujourd'hui (aucun endpoint n'écrit
    `Paragraph.content`), mais **le jour où l'édition sera persistée, recalibrer
    détruira le texte écrit dans Scribe**. À traiter avant d'ouvrir l'écriture :
    rejouer les éditions par-dessus, ou refuser de recalibrer un document édité.
- **`POST`/`DELETE /documents/:id/nodes/:nodeId/validation`** — validation
  manuelle d'un chapitre. Rejouer le `POST` rafraîchit l'empreinte (revalidation
  d'un chapitre périmé) ; le `DELETE` est idempotent. `GET /documents/:id` renvoie
  l'état **résolu** (`validations: { nodeId: 'validé' | 'périmé' }`, seuls les
  validés y figurent) : départager suppose de rehacher le texte courant par le
  même chemin (`nodeContentHash`) ; dupliquer ce calcul côté client = deux
  implémentations divergentes.
