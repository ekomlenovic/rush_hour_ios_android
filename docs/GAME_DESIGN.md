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

## Streak et gels

Le streak compte les jours consécutifs avec le défi du jour réussi.

| Règle | Implémentation |
|---|---|
| Un **gel** ❄️ couvre un jour manqué : le streak continue (le jour gelé ne compte pas dans le total) | `settleStreak` (`store/gameStore.ts`) |
| Les gels sont **consommés automatiquement**, à l'ouverture de l'app ou à la réussite du défi suivant | `recordAppOpen`, `updateStreak` |
| S'il manque plus de jours que de gels en stock, le streak est **perdu** (affiché à 0) et les gels sont **conservés** | |
| Stock limité à **2 gels** | `MAX_STREAK_FREEZES` |
| On gagne un gel **tous les 7 jours de streak** et en finissant les **3 missions du jour** | `updateStreak`, missions |
| Pas de monnaie : un gel ne s'achète pas | |
| Les jours gelés apparaissent en bleu dans le calendrier du profil | `frozenDates` |

## Missions quotidiennes

| Règle | Implémentation |
|---|---|
| **3 missions par jour**, les mêmes pour tout le monde à une date donnée, renouvelées à minuit (heure locale) | `pickMissions` (`data/missions.ts`) |
| Jamais deux missions sur le même compteur (pas de « 3 niveaux » et « 5 niveaux » le même jour) | |
| Les missions « niveau » ne comptent que **la carte et les niveaux personnalisés**, jamais les défis. Seule la mission « Réussis le défi du jour » porte sur un défi | `bumpMissions` (`store/gameStore.ts`) |
| Toutes les missions sont **réalisables dès le début** du jeu (le niveau 1 est déjà en 7×7) | |
| Récompense : finir les 3 missions donne **1 gel de streak** (rien si le stock est plein), une fois par jour | `addStreakFreeze` |
| Les identifiants de mission sont sauvegardés pour la journée : ne jamais en renommer, seulement en ajouter | |

## Rappels (notifications)

| Règle | Implémentation |
|---|---|
| **Opt-in** : désactivés par défaut. Proposés une seule fois, après le **premier défi du jour réussi**, jamais au premier lancement | `handleWinContinue` (`app/game.tsx`) |
| **Notifications locales uniquement** : pas de push, pas de serveur, pas de jeton. L'entitlement push iOS est retiré (builds SideStore) | `utils/notifications.ts`, `plugins/withoutPushEntitlement.js` |
| Rappel du défi du jour à l'heure choisie (**19 h** par défaut, réglable dans les options), seulement s'il n'est pas déjà fait | `planReminders` (`utils/reminders.ts`) |
| « Streak en danger » **2 h plus tard** (23 h au plus tard), le premier jour où le défi reste à faire | |
| « Nouveau défi hebdo » le **lundi à 10 h** | |
| Rien n'est envoyé quand l'app est ouverte ; tout est replanifié à chaque retour dans l'app et à chaque progrès | `useReminderSync` |

## Défi hebdomadaire — un essai unique, plus difficile

Le défi hebdo reprend les règles du défi du jour (pas d'indice, pas d'annuler, progression conservée, plateau verrouillé une fois réussi jusqu'au lundi suivant), **à une exception près : il peut être recommencé**. C'est le gros puzzle de la semaine, on a le droit de repartir de zéro tant qu'il n'est pas réussi.

| Règle | Implémentation |
|---|---|
| Même puzzle pour tout le monde pendant une semaine ISO (lundi → dimanche) | clé `YYYY-Www` (`getWeekKey`, `utils/date.ts`) |
| Puzzle tiré d'un **niveau difficile de la campagne** (≥ 25 coups minimum) | `generateWeeklyLevel` (`utils/generator.ts`) |
| Le niveau est **déguisé** : une des 7 symétries non triviales (rotation / miroir) et couleurs remélangées. Le nombre minimum de coups est inchangé | `transformLevel` |
| **Diversité** : tout le pool est parcouru avant qu'un niveau revienne, deux semaines de suite ne se ressemblent pas | pas de 23 dans le pool, symétrie qui change chaque semaine |
| Ajouter des niveaux à la campagne agrandit le pool et **change le tirage des semaines suivantes**. La semaine en cours ne bouge pas : son niveau est en cache pour sa clé de semaine | `currentWeeklyLevel` / `weeklyLevelKey` |
| **Recommencer** est le seul bouton d'action ; il remet les coups à zéro | `resetLevel`, boutons dans `app/game.tsx` |
| N'affecte **ni le streak ni la carte** | ID réservé `999998`, `weeklyChallengeProgress` |

## Succès

- Définis à un seul endroit : `data/achievements.ts`. Les **identifiants sont persistés** : ne jamais renommer un succès, seulement en ajouter.
- Un succès ne doit jamais contredire les règles ci-dessus : aucun succès « sans indice » ou « sans annuler » sur les défis, puisqu'ils n'en ont jamais.

## Dates

- Les dates des défis sont des clés `YYYY-MM-DD` en **heure locale**. Ne jamais les relire avec `new Date('YYYY-MM-DD')`, que JavaScript interprète en UTC (décalage d'un jour à l'ouest de l'heure UTC) : utiliser `parseLocalDateString`.
- Les succès « sans aide » ne comptent que les niveaux distincts (impossible de les farmer en rejouant le même niveau).
- Le déblocage est **visible** : dans l'écran de victoire, ou par un toast ailleurs dans l'app. Après une mise à jour, les succès déjà mérités sont débloqués silencieusement.

## Statistiques

- Le **temps de jeu** ne compte que le temps actif : écran de jeu ouvert, app au premier plan, niveau non résolu.
- Indices, annulations, recommencements et temps sont suivis **par tentative** et survivent à la fermeture de l'écran (`savedStates[…].attempt`).

## Retour du joueur

- Après **3 jours ou plus** d'absence : message de bienvenue (`recordAppOpen`, `app/index.tsx`).

## Roadmap

Les évolutions prévues sont suivies dans l'epic #19 sur GitHub. Chacune doit respecter les règles ci-dessus.

## Tests

Les règles ci-dessus sont vérifiées par les tests de `__tests__/` (Jest). Toute évolution d'une règle doit mettre à jour son test.

| Commande | Usage |
|---|---|
| `npm test` | tous les tests |
| `npm run test:tz` | les tests dans trois fuseaux horaires (New York, Paris, Auckland) : un bug de date peut ne se voir qu'à l'ouest de l'heure UTC (#20) |
| `npm run typecheck` | vérification TypeScript |

La CI (`.github/workflows/tests.yml`) lance le typecheck et les tests dans les trois fuseaux sur chaque pull request.

Le build de l'app (`.github/workflows/build.yml`) ne se lance **qu'à la main** (Actions → Run workflow). Lancé sur `main`, il publie une release et met à jour les sources SideStore / Android ; lancé sur une autre branche, il ne fait que builder.

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
