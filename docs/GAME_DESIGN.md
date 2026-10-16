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
| La **solution optimale** n'est visible **qu'une fois le défi réussi** (écran de victoire, puis bandeau « déjà réussi ») : jamais avant, pour ne pas gâcher l'essai unique | `SolutionPlayer` (`components/game/SolutionPlayer.tsx`) |
| Même puzzle pour tout le monde à une date donnée | `generateDailyLevel(dateStr)` est déterministe |
| Le **lundi**, le puzzle est plus difficile | `isMondayDaily` |
| La réussite fait avancer le **streak** | `completeDailyChallenge` → `updateStreak` |
| N'affecte pas la progression de la carte | ID réservé `999999`, exclu de `maxUnlockedLevel` |

> ⚠️ Toute évolution touchant au défi du jour (missions, succès, partage…) doit respecter ces contraintes. Exemple : un succès « finir le défi du jour sans indice » n'a pas de sens, il n'y a jamais d'indice.

## Archives des défis du jour — mode d'entraînement

Les défis du jour **passés** se rejouent depuis les archives (Profil → « Archives des défis », ou toucher un jour passé du calendrier). Une archive est un **mode d'entraînement**, pas un défi : la règle « un seul essai » ne concerne que le jour même.

| Règle | Implémentation |
|---|---|
| **Uniquement les jours passés** : jamais aujourd'hui (le vrai défi) ni le futur, les **90 derniers jours** au plus | `isArchiveDateAvailable` (`utils/archives.ts`), vérifié à l'ouverture (`resolveArchiveLevel`) et à la victoire (`completeArchiveChallenge`) |
| Pas avant le **14/10/2026** : dernière modification du générateur du défi du jour, un jour plus ancien pourrait donner un autre puzzle que celui vraiment joué. **Modifier le générateur du défi du jour oblige à avancer cette date** (le générateur est figé par un test) | `ARCHIVE_FIRST_DATE`, `__tests__/archives.test.ts` |
| Le puzzle d'un jour est généré une fois puis **mis en cache** ; si c'est le défi d'hier encore en cache, c'est ce puzzle-là | `archiveLevels` (`utils/levelResolver.ts`) |
| Indices, annuler, recommencer et « Réessayer pour 3 ⭐ » **autorisés** | comme un niveau de la carte (`app/game.tsx`) |
| **Aucun effet sur le streak** ni sur les gels : on ne rattrape pas un jour manqué en le jouant après coup | `completeArchiveChallenge` n'appelle pas `updateStreak` |
| Ne compte **pas** pour les succès et missions du défi du jour (`daily_*`, `monday_survivor`, « Réussis le défi du jour »…), ni pour les missions « niveau » | résultats dans `archiveProgress`, jamais dans `dailyChallengeProgress` |
| Score du jour même **jamais modifié** : le résultat partagé façon Wordle reste celui de la vraie tentative. Pas de partage de résultat pour une archive | idem |
| XP **réduite** : celle d'un niveau rejoué (25 %), à la première réussite de chaque jour seulement | `archiveWinXp` (`data/progression.ts`) |
| Progression sauvegardée par jour | `savedStates["archive-YYYY-MM-DD"]`, distincte de `daily-YYYY-MM-DD` |
| N'affecte pas la progression de la carte | ID réservé `999997` |
| Le **lundi** reste plus difficile | `generateDailyLevel` |
| État de chaque jour : réussi le jour même (couleur des étoiles), réussi en archive (vert), jamais réussi | `getArchiveDayStatus`, `app/archives.tsx` |
| Succès propres : **10 archives réussies**, un **mois complet** (tous les jours d'un mois passé réussis, le jour même ou en archive, dont au moins une archive) | `archives_10`, `archives_month` (`data/achievements.ts`) |

## Niveaux de la carte et niveaux personnalisés — mode d'entraînement

| Règle | Détail |
|---|---|
| **Indices illimités**, sans jetons ni monnaie, et ce n'est pas amené à changer | `handleHint` ; seul `totalHintsUsed` est compté (stats) |
| **Annuler compte comme un coup** | `undo` incrémente `moveCount` : annuler n'est pas gratuit pour le score |
| **Recommencer** remet le compteur à zéro | `resetLevel` |
| Progression sauvegardée par niveau | `savedStates[levelId]` |
| Étoiles : 3 ⭐ = solution optimale, 2 ⭐ ≤ optimal + 3, sinon 1 ⭐ | `getStars` (`utils/scoring.ts`) |
| On garde le meilleur score et les meilleures étoiles | `completeLevel` |
| Après une victoire, on peut **revoir la solution optimale** : elle se joue toute seule depuis la position de départ, et on avance ou recule coup par coup | `SolutionPlayer`, `vehiclesAtStep` (`utils/solutionReplay.ts`) |
| Si la victoire n'est pas optimale, l'écran de victoire affiche l'écart et propose **« Réessayer pour 3 ⭐ »** : une nouvelle tentative depuis le départ (compteurs remis à zéro, ce n'est pas un recommencer) | `handleRetry` (`app/game.tsx`) |

## Streak et gels

Le streak compte les jours consécutifs avec le défi du jour réussi.

| Règle | Implémentation |
|---|---|
| Un **gel** ❄️ couvre un jour manqué : le streak continue (le jour gelé ne compte pas dans le total) | `settleStreak` (`store/streak.ts`) |
| Les gels sont **consommés automatiquement**, à l'ouverture de l'app ou à la réussite du défi suivant | `recordAppOpen`, `updateStreak` |
| S'il manque plus de jours que de gels en stock, le streak est **perdu** (affiché à 0) et les gels sont **conservés** | |
| Stock limité à **2 gels** au départ, **+1 emplacement** aux niveaux joueur 5, 10, 20 et 30 (6 au maximum) | `getFreezeCapacity` (`data/progression.ts`) |
| On gagne un gel **tous les 7 jours de streak**, en finissant les **3 missions du jour** et à **chaque niveau joueur atteint** (rien si le stock est plein) | `advanceStreak` (`store/streak.ts`), missions, `addXp` (`store/gameStore.ts`) |
| Pas de monnaie : un gel ne s'achète pas | |
| Les jours gelés apparaissent en bleu dans le calendrier du profil | `frozenDates` |

## Missions quotidiennes

| Règle | Implémentation |
|---|---|
| **3 missions par jour**, les mêmes pour tout le monde à une date donnée, renouvelées à minuit (heure locale) | `pickMissions` (`data/missions.ts`) |
| Jamais deux missions sur le même compteur (pas de « 3 niveaux » et « 5 niveaux » le même jour) | |
| Les missions « niveau » ne comptent que **la carte et les niveaux personnalisés**, jamais les défis. Seule la mission « Réussis le défi du jour » porte sur un défi | `bumpMissions` (`store/gameStore.ts`) |
| Toutes les missions sont **réalisables dès le début** du jeu (le niveau 1 est déjà en 7×7) | |
| Récompense : finir les 3 missions donne **100 XP et 1 gel de streak**, une fois par jour. Si le stock de gels est plein, le gel est remplacé par **50 XP de plus** (150 XP au total), pour que les missions rapportent toujours quelque chose | `missionsXp` (`data/progression.ts`), `addStreakFreeze` |
| L'écran des missions annonce la récompense (XP et gel, ou XP seule si le stock est plein) | `MissionsSheet` |
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
| Puzzle tiré d'un **niveau difficile de la campagne** (≥ 25 coups minimum) | `generateWeeklyLevel` (`utils/weekly.ts`) |
| Le niveau est **déguisé** : une des 7 symétries non triviales (rotation / miroir) et couleurs remélangées. Le nombre minimum de coups est inchangé | `transformLevel` |
| **Diversité** : tout le pool est parcouru avant qu'un niveau revienne, deux semaines de suite ne se ressemblent pas | pas de 23 dans le pool, symétrie qui change chaque semaine |
| Ajouter des niveaux à la campagne agrandit le pool et **change le tirage des semaines suivantes**. La semaine en cours ne bouge pas : son niveau est en cache pour sa clé de semaine | `currentWeeklyLevel` / `weeklyLevelKey` |
| **Recommencer** est le seul bouton d'action ; il remet les coups à zéro | `resetLevel`, `components/game/GameActions.tsx` |
| N'affecte **ni le streak ni la carte** | ID réservé `999998`, `weeklyChallengeProgress` |

## Niveau joueur et XP

Chaque victoire fait avancer une barre d'XP : la progression se voit même sur une partie courte. La courbe est **volontairement exigeante** : les premiers niveaux viennent en quelques jours, le niveau 10 demande environ un mois et demi de jeu quotidien, le niveau 20 environ un an.

| Règle | Implémentation |
|---|---|
| XP pour passer du niveau `n` au niveau `n + 1` : `150 × n^1,6` | `xpToNextLevel` (`data/progression.ts`) |
| Niveau de la carte ou personnalisé : `10 + 2 × coups minimum` (plafonné à 60 coups), × 0,5 / 0,75 / 1 selon les étoiles | `levelWinXp` |
| Un niveau **déjà réussi** ne rapporte que **25 %** : rejouer fait progresser, sans permettre de farmer | `REPLAY_XP_FACTOR` |
| Défi du jour : `60 + 20 × étoiles` ; défi hebdo : `150 + 50 × étoiles`, **une seule fois** par défi | `dailyWinXp`, `weeklyWinXp` |
| 3 missions du jour terminées : **100 XP** (**150 XP** si le stock de gels est plein) ; chaque succès débloqué : **50 XP** | `MISSIONS_XP`, `ACHIEVEMENT_XP` |
| Le tutoriel ne rapporte rien | `completeLevel` (niveau non chargé) |
| Titre par palier : Apprenti, Chauffeur (5), Pilote (10), Navigateur (15), As de la route (20), Maître du trafic (30), Légende (40) | `PLAYER_TITLES` |
| Récompenses d'un niveau atteint : **1 gel**, un **emplacement de gel** aux niveaux 5, 10, 20 et 30, un **cosmétique** tous les 5 niveaux jusqu'au 35 | `getLevelRewardLines` (`components/progression/rewards.ts`) |
| Affichage : badge sur l'accueil, carte dans le profil (avec les récompenses du prochain niveau), barre animée et montée de niveau sur l'écran de victoire, toast ailleurs | `PlayerLevelBadge`, `PlayerLevelCard`, `WinModal`, `AchievementToast` |
| Profil → « Voir toute la progression » : chaque niveau avec ses récompenses (aperçu des cosmétiques), puis les cosmétiques débloqués autrement, avec leur condition et l'avancement | `app/progression.tsx` |
| Les joueurs existants reçoivent l'XP de leur progression passée (chaque victoire une fois, sans les récompenses de niveau) | migration v3 (`store/migrations.ts`) |
| Pas de monnaie : l'XP ne se dépense pas | |

## Cosmétiques

Les étoiles, les défis et le niveau joueur débloquent des styles, choisis dans le **Garage** (accueil → Garage), avec un aperçu (même pour un style verrouillé).

| Règle | Implémentation |
|---|---|
| 4 types : **thème de plateau**, **skin de la voiture cible**, **palette des autres véhicules**, **effet de victoire** | `COSMETICS` (`data/cosmetics.ts`), `theme/board.ts` |
| Déblocage **en jouant uniquement**, jamais par achat : paliers d'étoiles, niveau joueur, défis hebdo réussis, succès, défi du jour réussi en hiver (déc. à fév.) pour la Neige | `isCosmeticUnlocked` |
| Le déblocage est calculé à partir de la progression : rien n'est perdu, rien ne se « dépense » | `buildCosmeticContext` |
| Un style choisi mais plus débloqué (réinitialisation) revient au style par défaut | `sanitizeSelection` |
| La palette recolore les véhicules dans l'ordre du niveau ; la voiture cible garde sa skin. Le lecteur d'écran annonce la couleur affichée | `applyPalette`, `components/Board.tsx` |
| Les effets de victoire ne se jouent pas avec « Réduire les animations » | `WinEffect` (`components/effects/WinEffect.tsx`) |
| Les identifiants des cosmétiques sont sauvegardés : ne jamais en renommer, seulement en ajouter | |
| Les nouveautés sont signalées sur le lien Garage jusqu'à la prochaine visite | `seenCosmetics` |

## Sauvegarde (export / import)

Pour changer de téléphone sans perdre sa progression, **sans serveur ni compte** (marche aussi pour les builds SideStore et APK).

| Règle | Implémentation |
|---|---|
| Options → Sauvegarde : **exporter** donne un fichier `rush-hours-AAAA-MM-JJ.rushsave` (feuille de partage du système), **importer** en choisit un. En second choix, la même sauvegarde en **code texte** (copier / coller) | `components/settings/SaveSection.tsx` |
| Le fichier ne contient que le code : les deux passent par les mêmes vérifications. S'il n'y a pas de partage de fichier sur l'appareil, le code est copié à la place | `saveFileName`, `parseSave` |
| Le code contient tout ce que l'app sauvegarde (`partialize`), **sauf les réglages du téléphone** (rappels, heure de rappel, génération en cours) et l'**historique d'annulation** et le **journal de coups** des niveaux en cours (le niveau en cours est gardé) | `exportProgress`, `DEVICE_FIELDS` (`utils/saveTransfer.ts`) |
| Importer **remplace** la progression, après une confirmation qui résume la sauvegarde (date, niveau joueur, niveaux réussis, étoiles, streak) | `parseSave`, `importProgress` |
| Une sauvegarde d'une ancienne version passe par les **migrations** ; une sauvegarde d'une version **plus récente** que l'app est refusée | `migrateState`, `relocateGeneratedLevels` |
| Les jours manqués depuis l'export sont appliqués à l'import (gels, streak perdu) | `recordAppOpen` |

**Triche** : sans serveur, on ne peut pas l'empêcher (tout ce que l'app vérifie, quelqu'un qui lit son code peut le refaire). L'enjeu est faible : pas de classement, pas de monnaie, un tricheur ne lèse que lui-même. On bloque la triche facile et les fichiers abîmés, sans jamais refuser la sauvegarde d'un vrai joueur :
- format non lisible (`RHSAVE1.<somme de contrôle>.<base64>`) et **somme de contrôle** : un code modifié à la main ou tronqué est refusé ;
- **cohérence** : étoiles et score possibles pour l'optimum du niveau (campagne et niveaux générés seulement : un niveau créé peut être modifié après coup), rien dans le futur, aucune archive du jour même, streak ≤ meilleur streak ≤ défis du jour réussis ;
- **recalcul plutôt que confiance** : XP plafonnée à ce que les victoires ont pu rapporter (`maxPlausibleXp`), gels plafonnés au stock du niveau joueur, succès inconnus retirés, cosmétiques non débloqués remis par défaut.

> ⚠️ Un nouveau champ sauvegardé est exporté automatiquement. S'il est propre au téléphone, l'ajouter à `DEVICE_FIELDS`.

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

## Accessibilité

Le jeu se joue entièrement avec VoiceOver (iOS) et TalkBack (Android).

| Règle | Implémentation |
|---|---|
| Chaque véhicule est annoncé : type, **lettre**, couleur, puis sa position (« Voiture B (bleu), à l'horizontale, ligne 3, colonnes 2 à 3 ») | `describeVehicle`, `describePosition` (`utils/accessibility.ts`) |
| On déplace un véhicule **d'une case** sans glisser : balayage haut / bas (élément « ajustable ») ou actions « Déplacer à gauche / droite / haut / bas ». Ce déplacement est un **coup normal** (même chemin que le glisser) | `stepVehicle`, `components/Block.tsx` |
| La lettre d'un véhicule suit l'ordre du niveau et ne change pas pendant la partie ; la voiture cible n'en a pas | `getVehicleLetters` |
| L'indice est **annoncé** (véhicule et direction), pas seulement surligné | `handleHint` (`app/game.tsx`) |
| La victoire, les succès et les missions terminées sont annoncés | `WinModal`, `AchievementToast` |
| Option **« Lettres sur les véhicules »** (désactivée par défaut) pour distinguer les véhicules sans les couleurs | `showVehicleLetters` |
| Les animations suivent le réglage système « Réduire les animations » | `ReducedMotionConfig` (`app/_layout.tsx`) |
| Créateur : « Ajouter au plateau » place le véhicule sur la **première case libre** (on ne peut pas glisser au lecteur d'écran) ; toucher deux fois fait pivoter, l'action « Supprimer » retire | `findFreeCell` (`utils/creatorGeometry.ts`) |
| Tout nouveau bouton a un `accessibilityRole`, et un `accessibilityLabel` traduit s'il ne contient qu'une icône | clés `a11y.*` des fichiers de traduction |

## Retour du joueur

- Après **3 jours ou plus** d'absence : message de bienvenue (`recordAppOpen`, `hooks/useAppOpenAlert.ts`).

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
