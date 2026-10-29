# Rush Hours — consignes pour Claude

Les règles du jeu et du code sont dans [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) : les lire avant toute modification et les respecter.

## Règle absolue : ne jamais casser la progression des joueurs

Avant d'écrire du code, se demander : **ce changement touche-t-il à une donnée sauvegardée chez le joueur ou sur le serveur ?** (état persisté des stores, identifiants de niveaux / succès / cosmétiques / missions, numérotation des niveaux, calcul des étoiles, du score ou de l'XP, schéma de la base du serveur.)

Si oui, le changement n'est complet **qu'avec son patch** :

1. `STORE_VERSION` augmentée et une étape ajoutée à la fin de `migrateState` (`store/migrations.ts`) — ou `version` + `migrate` pour `store/multiStore.ts`, ou une nouvelle étape à la fin de `server/src/db.ts`.
2. Le patch **convertit** les données existantes (déplacer, renuméroter, recompter), il ne les jette pas ; en cas de doute, la valeur la plus favorable au joueur.
3. Ne jamais modifier ni retirer une étape de migration existante, ni renommer ou réutiliser un identifiant persisté.
4. Un test dans `__tests__/migrations.test.ts` part d'un état de l'ancienne version écrit en dur et vérifie le résultat ; les anciennes sauvegardes (`__tests__/saveTransfer.test.ts`) s'importent toujours.
5. Le dire explicitement dans le message de commit et la description de la PR.

Le détail est dans la section « Progression des joueurs — règle absolue » de `docs/GAME_DESIGN.md`.

## Vérifier avant de pousser

`npm run typecheck` et `npm test` (ou `npm run test:tz`) ; `cd server && npm test` si le serveur est touché. Commits en Semantic Commit Messages, textes du jeu au tutoiement (voir `docs/GAME_DESIGN.md`).

Pas de ligne `Co-Authored-By:` ni de lien de session dans les messages de commit, ni de mention « Generated with » dans les descriptions de PR.

## Branches : toujours passer par une PR

Ne jamais pousser directement sur une branche de prod : `main` ou une branche de version (`2.0.2`, …), même si elle est indiquée comme branche de travail. Créer une branche dédiée (par ex. `feat/<sujet>`) depuis la branche visée et ouvrir une PR vers elle.
