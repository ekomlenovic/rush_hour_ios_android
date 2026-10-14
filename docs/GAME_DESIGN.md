# Règles de game design

Ce document fige les **choix volontaires** du jeu. Avant de signaler un « bug » ou de proposer une évolution, vérifier qu'elle ne contredit pas une règle ci-dessous. Toute modification d'une règle doit être discutée explicitement (issue dédiée) et ce document mis à jour.

## Défi du jour — un essai unique

Le défi du jour est un **one-shot**. C'est voulu : le score du jour doit refléter une vraie tentative, comparable d'un joueur à l'autre.

| Règle | Implémentation |
|---|---|
| Pas d'**indice** | boutons d'action masqués si `levelId === 'daily'` (`app/game.tsx`) |
| Pas d'**annuler** (undo) | idem |
| Pas de **recommencer** (reset) | idem |
| La **progression est conservée** si on quitte l'écran : on reprend là où on s'était arrêté, avec le même compteur de coups | `savedStates["daily-YYYY-MM-DD"]` (`store/gameStore.ts`) |
| Une fois réussi, le plateau est **verrouillé** jusqu'au lendemain | `isDailyCompleted` désactive le plateau |
| Même puzzle pour tout le monde à une date donnée | `generateDailyLevel(dateStr)` est déterministe |
| Le **lundi**, le puzzle est plus difficile | `isMondayDaily` |
| La réussite fait avancer le **streak** | `completeDailyChallenge` → `updateStreak` |
| N'affecte pas la progression de la carte | ID réservé `999999`, exclu de `maxUnlockedLevel` |

> ⚠️ Toute évolution touchant au défi du jour (missions, succès, partage…) doit respecter ces contraintes. Exemple : un succès « finir le défi du jour sans indice » n'a pas de sens, il n'y a jamais d'indice.

## Niveaux de la carte et niveaux personnalisés — mode d'entraînement

| Règle | Détail |
|---|---|
| **Indices illimités**, sans jetons ni monnaie, et ce n'est pas amené à changer | `handleHint` ; seul `totalHintsUsed` est compté (stats) |
| **Annuler compte comme un coup** | `undo` incrémente `moveCount` : annuler n'est pas gratuit pour le score |
| **Recommencer** remet le compteur à zéro | `resetLevel` |
| Progression sauvegardée par niveau | `savedStates[levelId]` |
| Étoiles : 3 ⭐ = solution optimale, 2 ⭐ ≤ optimal + 3, sinon 1 ⭐ | `app/game.tsx` |
| On garde le meilleur score et les meilleures étoiles | `completeLevel` |

## Défi hebdomadaire — un essai unique, plus difficile

Le défi hebdo suit **les mêmes règles que le défi du jour** : pas d'indice, pas d'annuler, pas de recommencer, progression conservée, plateau verrouillé une fois réussi (jusqu'au lundi suivant).

| Règle | Implémentation |
|---|---|
| Même puzzle pour tout le monde pendant une semaine ISO (lundi → dimanche) | clé `YYYY-Www` (`getWeekKey`, `utils/date.ts`) |
| Puzzle tiré d'un **niveau difficile de la campagne** (≥ 25 coups minimum) | `generateWeeklyLevel` (`utils/generator.ts`) |
| Le niveau est **déguisé** : une des 7 symétries non triviales (rotation / miroir) et couleurs remélangées. Le nombre minimum de coups est inchangé | `transformLevel` |
| **Diversité** : tout le pool est parcouru avant qu'un niveau revienne, deux semaines de suite ne se ressemblent pas | pas de 23 dans le pool, symétrie qui change chaque semaine |
| N'affecte **ni le streak ni la carte** | ID réservé `999998`, `weeklyChallengeProgress` |

## Succès

- Définis à un seul endroit : `data/achievements.ts`. Les **identifiants sont persistés** : ne jamais renommer un succès, seulement en ajouter.
- Un succès ne doit jamais contredire les règles ci-dessus : aucun succès « sans indice » ou « sans annuler » sur les défis, puisqu'ils n'en ont jamais.
- Les succès « sans aide » ne comptent que les niveaux distincts (impossible de les farmer en rejouant le même niveau).
- Le déblocage est **visible** : dans l'écran de victoire, ou par un toast ailleurs dans l'app. Après une mise à jour, les succès déjà mérités sont débloqués silencieusement.

## Statistiques

- Le **temps de jeu** ne compte que le temps actif : écran de jeu ouvert, app au premier plan, niveau non résolu.
- Indices, annulations, recommencements et temps sont suivis **par tentative** et survivent à la fermeture de l'écran (`savedStates[…].attempt`).

## Retour du joueur

- Après **3 jours ou plus** d'absence : message de bienvenue (`recordAppOpen`, `app/index.tsx`).

## Roadmap

Les évolutions prévues sont suivies dans l'epic #19 sur GitHub. Chacune doit respecter les règles ci-dessus.

## Conventions

Les **commits** et les **titres d'issues** suivent les [Semantic Commit Messages](https://www.conventionalcommits.org/) : `type(scope optionnel): description`.

| Type | Usage |
|---|---|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `docs` | documentation uniquement |
| `style` | mise en forme, sans changement de logique |
| `refactor` | restructuration du code, sans changement de comportement |
| `perf` | amélioration de performance |
| `test` | ajout ou correction de tests |
| `chore` | maintenance : dépendances, version, nettoyage, CI |

Exemples : `feat(achievements): popup de déblocage`, `fix(daily): progression non réinitialisée`, `chore: supprimer le code mort des jetons d'indice`.
