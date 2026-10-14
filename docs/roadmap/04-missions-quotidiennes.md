# Missions quotidiennes
labels: enhancement, phase-2

Trois petites missions renouvelées chaque jour, en complément du défi du jour, pour donner une raison de jouer **sur la carte** quotidiennement.

## Fonctionnement
- [ ] 3 missions tirées de façon déterministe à partir de la date (même seed que le défi du jour)
- [ ] Exemples : « Finis 3 niveaux », « Obtiens 3 ⭐ sur 2 niveaux », « Finis un niveau sans indice », « Finis un niveau 7×7 », « Joue 10 min », « Réussis le défi du jour »
- [ ] Récompense par mission (XP) et bonus quand les 3 sont faites
- [ ] Encart sur l'accueil avec la progression (`1/3`) et le temps restant avant renouvellement

## Contraintes
- Les missions portant sur l'aide (indice, undo) ne visent **que** la carte et les niveaux personnalisés, jamais le défi du jour (cf. `docs/GAME_DESIGN.md`).
- Pas de mission impossible selon la progression du joueur (ex. « finis un 8×8 » si aucun 8×8 n'est débloqué).

Dépend de : `02-statistiques.md`.
