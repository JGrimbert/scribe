# Scribe — backend

API NestJS. **Tout début de chantier** : scaffold minimal (`AppModule` /
`AppController` / `AppService` "Hello World"), pas encore de persistance, pas
de connexion BDD, pas de routes métier. Ne rien supposer d'existant au-delà de
ce scaffold sans vérifier le code.

Rôle prévu (voir `../CLAUDE.md`) : remplacer à terme le middleware Vite qui
sert `structure.json`/`data.json`/`trame.json` en statique depuis le dossier
parent `Marvarid`, par une vraie persistance/BDD.

## Commandes

Depuis `backend/` :
```
npm run start:dev   # Nest en mode watch
npm run build         # compile en dist/
npm run start:prod     # lance le build compilé
```
Depuis la racine : `npm run dev` (lance frontend + backend ensemble via
`concurrently`) ou `npm run start:dev --workspace backend` pour le backend
seul.

## Conventions de code

- Suivre les conventions Nest standard (modules/controllers/services,
  injection de dépendances). Un module par domaine métier au fur et à mesure
  qu'ils apparaissent — ne pas préparer de structure pour des domaines qui
  n'existent pas encore.
