# Roadmap : rétention et engagement (v1.2+)

Le jeu est stable (v1.1.5). Objectif : donner aux joueurs **des raisons de revenir**, chaque jour et sur le long terme, **sans casser les règles de design** décrites dans [`../GAME_DESIGN.md`](../GAME_DESIGN.md) (notamment le défi du jour en un seul essai, sans aide).

Chaque fichier de ce dossier est une demande d'évolution prête à devenir une issue GitHub : `scripts/create-roadmap-issues.sh` les crée toutes.

## Boucles d'engagement visées

| Boucle | Leviers |
|---|---|
| Quotidienne | défi du jour, missions, streak, notifications |
| Hebdomadaire | défi hebdo |
| Long terme | succès à paliers, cosmétiques, XP, statistiques |
| Sociale | partage façon Wordle, classements |

## Phases

### Phase 1 : fondations (corriger l'existant)
- [01 · Brancher le défi hebdomadaire dans l'UI](01-defi-hebdomadaire.md) : existe dans le store mais n'a pas d'écran, `weekly_warrior` est impossible à débloquer
- [02 · Statistiques détaillées](02-statistiques.md) : prérequis
- [07 · Supprimer le code mort des jetons d'indice](07-supprimer-jetons-indice.md) : les indices restent illimités
- [03 · Succès v2](03-succes-v2.md) : déclaratifs, barres de progression, popup de déblocage, environ 25 nouveaux succès

### Phase 2 : boucle quotidienne
- [04 · Missions quotidiennes](04-missions-quotidiennes.md)
- [05 · Gel de streak](05-gel-de-streak.md)
- [06 · Notifications locales](06-notifications.md)
- [10 · Partage façon Wordle](10-partage-wordle.md)

### Phase 3 : méta-progression
- [08 · Cosmétiques](08-cosmetiques.md)
- [09 · Niveau joueur / XP](09-niveau-joueur-xp.md)

### Phase 4 : modes et social
- [11 · Contre-la-montre et zen](11-modes-de-jeu.md)
- [12 · Revoir la solution optimale](12-solution-optimale.md)
- [13 · Game Center / Play Games](13-game-center-play-games.md)

## Meilleur rapport effort / impact
1. **10 · Partage Wordle** : quelques heures, viralité gratuite
2. **03 · Popup de déblocage des succès** : le joueur ne voit aujourd'hui aucun déblocage
3. **01 · Défi hebdo** : le code est déjà à moitié écrit
4. **06 · Notifications** : le levier de retour le plus puissant
