# Scribe — Synthèse de la Revue de Code

**Date** : juillet 2026  
**Projet** : Éditeur de texte WYSIWYG pour manuscrits longs (Vue 3 + NestJS + Python NLP)

---

## 1. Vue d'ensemble du projet

### Qu'est-ce que c'est
Monorepo npm réunissant :
- **Frontend** (Vue 3 + Vite) : éditeur WYSIWYG avec pagination imprimée (Quill 2 + Paged.js)
- **Backend** (NestJS + Prisma + PostgreSQL) : registre de documents, import `.odt`, analyses
- **NLP-service** (FastAPI + Python) : analyses textuelles (lexicales, sémantiques, BERTopic)

### Architecture globale
```
Utilisateur → Frontend (Vite, Quill, Paged.js)
                    ↓
            Backend API (NestJS)
                    ↓
            PostgreSQL + EmbeddingCache
            
        NLP-service (Python FastAPI)
            ↑
            ← Analyse lexicale/sémantique
```

### Concepts clés à retenir
- **Folio** ≠ **Quill** : Folio = rendu paginé (ce qu'on lit) ; Quill = éditeur flottant invisible
- **Fragment** = morceau de paragraphe après coupure de page (pagination)
- **Bloc** = représentation d'un paragraphe avant pagination (`${articleId}__texte__${index}`)
- **Profondeur arbitraire** : titres à n'importe quel niveau (pas fixé à axe/bloc/article)

---

## 2. Priorités de correction (par ordre)

### 🔴 CRITIQUE : Tests backend + stabilité

**État actuel**
- ❌ Zéro test automatisé backend (`.spec.ts` absent)
- ✅ Frontend : tests logique pure (`src/script/registry.js`, `fragment.js`)
- ⚠️ NLP : tests existent mais limités

**À faire**
1. **Créer `backend/src/import/odt-parser.spec.ts`**
   - Tester `buildFlatNodes()` : résolution de niveaux, détection de titres, tables des matières
   - Tester `buildParsedResult()` : construction hiérarchique, corrections utilisateur (`levelOverrides`)
   - Cas limites : sauts de niveaux (Titre 1 → Titre 3), titres vides, listes imbriquées
   - Mock : utiliser des ODT synthétiques (XML brut, pas vrais fichiers)

2. **Créer `backend/src/documents/documents.service.spec.ts`**
   - Flux complet : `previewUpload()` → calibration → `commitImport()`
   - Vérifier l'état des previews en mémoire (Map) et les corrections appliquées

3. **Intégration frontend E2E (Playwright)**
   - Flux d'édition : activer → fusionner → split multi-fragment
   - Pagination : coupure interne vs frontière réelle de paragraphe
   - Remarque : la sélection cross-fragment n'a été vérifiée que "au niveau logique", Playwright validera le DOM

**Commandes**
```bash
# Backend
cd backend && npm run test

# Frontend E2E
cd frontend && npm run test:e2e
```

---

### 🟠 HAUTE PRIORITÉ : Architecture NLP

**Problème**
- Jobs asynchrones (BERTopic) en mémoire → perte si redémarrage
- Previews d'import en Map (pas de TTL) → fuite mémoire
- Pas de file d'attente multi-utilisateurs

**Solution**
1. **Intégrer Redis + Bull**
   - Remplacer la Map d'imports par une queue Bull : `export const importQueue = new Bull('import-preview')`
   - Chaque preview = job Redis avec TTL 1h
   - Multi-instances possibles

2. **Cache d'embeddings**
   - Garder `EmbeddingCache` (Postgres) comme c'est
   - Optionnel : ajouter un cache Redis local au service NLP pour vectorisation rapide

3. **Health check**
   - Créer `GET /health` en NLP-service
   - Vérifier la santé en Nest avant chaque requête NLP (sinon 503)

**Dépendances à ajouter**
```json
{
  "@nestjs/bull": "^10.0.0",
  "bull": "^4.15.0",
  "redis": "^4.6.0"
}
```

**Refs de code existant**
- `backend/src/documents/documents.service.ts` : ligne 46-50 (Map en mémoire à refactoriser)
- `backend/CLAUDE.md` : ligne 47-49 (précise le problème)

---

### 🟠 HAUTE PRIORITÉ : CI/CD

**État actuel**
- ❌ Aucun workflow `.github/workflows/`
- ❌ Pas de linting, tests, builds automatiques

**À créer**
1. **`.github/workflows/test.yml`** (sur push + PR)
   ```yaml
   - npm ci
   - npm run lint (à ajouter)
   - npm test
   - npm run build
   ```

2. **`.github/workflows/deploy.yml`** (optionnel, si production)
   - Build Docker image
   - Push au registry
   - Redéployer

3. **Branch rules** : forcer les tests avant merge

---

### 🟡 MOYENNE PRIORITÉ : Logging et erreurs

**État actuel**
- ❌ Pas de strategy de logging centralisée (NestJS)
- ❌ Erreurs NLP réseau pas explicites
- ❌ Frontend : pas de composable `useApi()` unifié

**À faire**
1. **Backend : `src/common/filters/http-exception.filter.ts`**
   ```typescript
   @Catch(HttpException)
   export class HttpExceptionFilter implements ExceptionFilter {
     catch(exception: HttpException, host: ArgumentsHost) {
       const ctx = host.switchToHttp();
       const response = ctx.getResponse();
       const status = exception.getStatus();
       this.logger.error(`[${status}] ${exception.message}`);
       response.status(status).json({ error: exception.message });
     }
   }
   ```

2. **Backend : Health check NLP**
   - Avant `POST /documents/:id/analyse/lexical`, vérifier `GET http://NLP_SERVICE_URL/health`
   - Retourner 503 si éteint

3. **Frontend : composable `useApi()`**
   ```javascript
   // frontend/src/composables/useApi.js
   export function useApi() {
     const request = async (url, options) => {
       try {
         const res = await fetch(url, options);
         if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
         return await res.json();
       } catch (err) {
         notify.error(`Erreur API: ${err.message}`);
         throw err;
       }
     };
     return { request };
   }
   ```

---

### 🟡 MOYENNE PRIORITÉ : Unifier chemins de données

**État actuel**
- Deux chemins : backend API (nouveau) + fichiers statiques `Marvarid/*.json` (historique)
- Coexistence intentionnelle mais confuse

**À faire**
1. **Fixer une date limite** pour tuer le chemin statique (ex: fin Q4 2026)
2. **Ajouter toggle ENV** : `USE_LEGACY_JSON_PATH=false` (défaut)
   - Dans `frontend/src/App.vue`, ligne 10+, conditionner le mount initial
3. **Documenter migration** dans README
4. **Nettoyer** vite.config.js une fois confirmé

**Ref de code**
- `frontend/vite.config.js` : lignes 20-54 (middleware statique à supprimer)
- `frontend/src/App.vue` : vérifier si `App.vue` check encore ce chemin au montage

---

### 🟡 MOYENNE PRIORITÉ : Versioning des documents

**État actuel**
- ❌ Pas de versioning : chaque import écrase la version précédente
- ❌ Pas de récupération en cas de corruption

**À faire**
1. **Ajouter colonne `Document.version : Int`**
2. **Créer table `DocumentVersion`**
   ```prisma
   model DocumentVersion {
     id        String   @id @default(uuid())
     document  Document @relation(fields: [documentId], references: [id])
     version   Int
     data      Json     // snapshot complet
     createdAt DateTime @default(now())
   }
   ```
3. **Endpoints**
   - `GET /documents/:id/versions` : lister
   - `POST /documents/:id/versions/:versionId/restore` : restaurer

**Effort** : élevé, mais gain majeur en résilience

---

## 3. Axes mineurs (basse priorité)

### 🟢 Parser ODT : dépendance implicite

**Problème** : deux copies (Marvarid + backend) peuvent diverger

**Solution** : 
- Supprimer Marvarid/parser une fois backend confirmé
- Ou : npm package `@jgrimbert/odt-parser` si réutilisable

**Ref** : `backend/CLAUDE.md` ligne 41-44

---

### 🟢 Prisma v7 : breaking changes

**Problème** : Prisma v6 fixé, v7 adopte adapters obligatoires

**Solution** :
1. Lancer évaluation (pas urgent)
2. Noter dans `backend/CLAUDE.md` les étapes (tests, config, breaking changes)
3. Tâche séparée si stable

---

### 🟢 Performance à grande échelle

**Problème** : pas de tests avec 100k+ mots ou profondeur 5+

**À faire** :
1. Corpus synthétique de test (100k mots, profondeur 6)
2. Mesurer temps de `refresh()` frontend
3. Si > 1s, paginer `GET /documents/:id?nodeId=:nodeId`

---

### 🟢 Configuration secrets en dev

**Problème** : `docker-compose.yml` hardcode les credentials

**Solution** :
- Créer `docker-compose.override.yml` (gitignored)
- Documenter dans README : « Pour prod, utiliser Docker Secrets ou Vault »

---

## 4. Fichiers clés à connaître

### Backend

| Fichier | Rôle | Remarques |
|---------|------|----------|
| `src/import/odt-parser.ts` | Parser `.odt` → JSON | 815 lignes, deux passes (flat + hiérarchie), **pas de tests** |
| `src/documents/documents.service.ts` | Registre + import | Flux preview → commit, **Map en mémoire** |
| `src/analyse/*.ts` | Analyses lexical/sémantique/topics | NLP externe (service Python) + cache embeddings |
| `prisma/schema.prisma` | Modèle données | `Document`, `Node`, `Paragraph`, `DocumentAnalysis`, `EmbeddingCache` |

### Frontend

| Fichier | Rôle | Remarques |
|---------|------|----------|
| `src/components/FolioComposer.vue` | Orchestrateur édition | Pagination + cycle de refresh |
| `src/components/QuillBlock.vue` | Éditeur flottant | Un fragment à la fois |
| `src/composables/useFragmentEditor.js` | Logique édition | Activation/fermeture/merge/split |
| `src/script/registry.js` | Modèle données (paragraphes) | Logique pure, testée |
| `src/script/fragment.js` | Registre de fragments | Coupures de page, testée |
| `src/script/liveEdit.js` | Calcul rects/curseur | **Pas testé** (DOM/TreeWalker) |
| `src/script/paginate.js` | Appel Paged.js | Construction blocs → HTML paginé |

### NLP

| Fichier | Rôle |
|---------|------|
| `nlp-service/app/main.py` | FastAPI app (lexical, semantic, topics) |
| `nlp-service/requirements.txt` | Dépendances (~600 Mo) |

---

## 5. Checklist pour la prochaine itération

- [ ] **Créer tests backend** (`odt-parser.spec.ts`, `documents.service.spec.ts`)
- [ ] **Ajouter E2E frontend** (Playwright pour édition/fusion/split)
- [ ] **Configurer CI/CD** (`.github/workflows/test.yml`)
- [ ] **Redis + Bull** pour jobs NLP asynchrones
- [ ] **Health check NLP** dans le service
- [ ] **Logging centralisé** (HttpExceptionFilter backend + useApi frontend)
- [ ] **Fixer date limite** pour tuer chemin JSON statique
- [ ] **Docstring** : ajouter guide utilisateur + troubleshooting
- [ ] **Versioning docs** : plan migration Prisma v7

---

## 6. Conventions à respecter

### Backend
- NestJS : modules/controllers/services, injection de dépendances
- Un module par domaine métier (ne pas préparer de structure)
- Commentaires français, uniquement si "pourquoi" non évident

### Frontend
- Logique pure → `src/script/*.js`
- État Vue → `src/composables/use*.js`
- Composants → `src/components/*.vue`
- Pas de duplication : factoriser en fonction partagée

### General
- Commits : pas de `add`/`commit`/`push` sans validation
- Git : lecture seule (status, diff, log) sauf validation explicite

---

## 7. Commandes essentielles

```bash
# Installation & infra
npm install
docker compose up -d
npm run prisma:migrate --workspace backend

# Développement
npm run dev              # Frontend + Backend ensemble
npm run dev:nlp          # NLP-service (séparé, optionnel)

# Tests
npm test                 # Frontend (Vitest)
cd backend && npm run test   # À implémenter

# Build
npm run build

# Migration schéma Prisma
npm run prisma:migrate --workspace backend
```

---

## 8. Points de vigilance (pièges connus)

### Frontend
1. **Remount Vue** : `await nextTick()` après `closeEditor()` puis `activateFragment()` si même id (sinon Quill garde contenu périmé)
2. **Curseur de fusion** : longueur HTML brute, pas caractères visibles (peut bugger si formatage inline)
3. **Sélection cross-fragment** : gérée depuis peu, logique validée mais **pas testée en navigateur** → vérifier manuellement avant merge
4. **Paged.js** : recalcule la pagination à chaque changement DOM ; `scheduleReflow()` déduplique pour éviter thrashing

### Backend
1. **ODT parsing** : détection de niveau se fie au style ODT, silencieusement incorrect si auteur a fait du drag-drop de mise en forme
2. **Calibration** : `structureStartIndex` et `levelOverrides` incontournables pour corriger — table des matières aide mais peut aussi mentir
3. **Lemmatisation BERTopic** : filtrage POS (NOUN/PROPN/ADJ uniquement) indispensable, sinon verbes génériques dominent
4. **Prisma jsonb** : ne préserve pas l'ordre des clés d'objet (les tableaux, si) — retrié côté client si important

### Infrastructure
1. **NLP-service down** : Nest retourne 503 explicite, pas de retry automatique (à implémenter)
2. **PostgreSQL** : simple single-instance en dev, pas de clustering

---

## 9. Ressources internes

- `backend/CLAUDE.md` : architecture backend détaillée
- `frontend/CLAUDE.md` : architecture frontend, pièges Quill/Paged.js, glossaire
- `../CLAUDE.md` : présentation générale monorepo
- `package.json` : scripts racine et workspaces

---

**Fin de la synthèse**  
*Pour des questions spécifiques, consulter les CLAUDE.md de chaque dossier ou explorer le code via les références de ligne fournis.*
