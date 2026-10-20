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
| Défi réussi : le bandeau « déjà réussi » montre **les coups joués** et l'optimum, et on peut revoir **sa propre solution** comme la solution optimale (le journal de coups du meilleur résultat est gardé) | `ChallengeDoneBanner`, `ChallengeResult.moveLog`, `movesFromLog` (`utils/solutionReplay.ts`) |
| « Continuer » après la victoire d'un défi **reste sur l'écran du défi**, avec ce bandeau ; on revient à la carte par « ← Carte » | `handleWinContinue` (`app/game.tsx`) |
| Même puzzle pour tout le monde à une date donnée | `generateDailyLevel(dateStr)` est déterministe |
| Le **lundi**, le puzzle est plus difficile | `isMondayDaily` |
| La réussite fait avancer le **streak** | `completeDailyChallenge` → `updateStreak` |
| N'affecte pas la progression de la carte | ID réservé `999999`, exclu de `maxUnlockedLevel` |
| Ne s'ouvre **que le jour même** : un lien vers un jour passé ouvre son archive, un jour à venir rien du tout (sinon le streak sautait à ce jour et la sauvegarde ne s'importait plus) ; même règle pour l'hebdo et sa semaine. Une partie restée ouverte après minuit gagne encore le défi de la veille | `isDailyOpen`, `isDailyWinnable` (`utils/challengeDates.ts`), `app/game.tsx`, migration v7 |

> ⚠️ Toute évolution touchant au défi du jour (missions, succès, partage…) doit respecter ces contraintes. Exemple : un succès « finir le défi du jour sans indice » n'a pas de sens, il n'y a jamais d'indice.

## Archives des défis du jour — mode d'entraînement

Les défis du jour **passés** se rejouent depuis les archives : toucher un jour passé du **calendrier du profil**, qui remonte mois par mois (flèches ‹ ›) jusqu'au plus ancien jour rejouable. Il n'y a pas d'écran d'archives à part. Une archive est un **mode d'entraînement**, pas un défi : la règle « un seul essai » ne concerne que le jour même.

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
| État de chaque jour, **même code couleur partout**, avec sa légende sous le calendrier : réussi le jour même (case pleine, vert pâle à foncé selon les étoiles), réussi en archive (**contour vert, sans fond** : réussi, mais sans effet sur le streak), gel (bleu), pas réussi (gris), jour indisponible ou futur (numéro seul) | `getArchiveDayStatus`, `components/profile/StreakCalendar.tsx` |
| Succès propres : **10 archives réussies**, un **mois complet** (tous les jours d'un mois passé réussis, le jour même ou en archive, dont au moins une archive) | `archives_10`, `archives_month` (`data/achievements.ts`) |

## Niveaux de la carte et niveaux personnalisés — mode d'entraînement

| Règle | Détail |
|---|---|
| **Indices illimités**, sans jetons ni monnaie, et ce n'est pas amené à changer | `handleHint` ; seul `totalHintsUsed` est compté (stats) |
| **Annuler compte comme un coup** | `undo` incrémente `moveCount` : annuler n'est pas gratuit pour le score |
| **Recommencer** remet le compteur à zéro | `resetLevel` |
| Progression sauvegardée par niveau | `savedStates[levelId]` |
| Les niveaux **générés** sont numérotés à la suite de la campagne, **sans trou** : un niveau que le générateur n'a pas réussi à produire ne prend pas de numéro (sinon le suivant ne se débloquait jamais). Une seule génération à la fois | `startLevelGeneration` (`hooks/useLevelGenerator.ts`), migration v8 |
| Étoiles **proportionnelles au niveau** : 3 ⭐ = solution optimale, 2 ⭐ ≤ optimal + 50 % (arrondi au-dessus : +6 à 12 coups, +10 à 20, +20 à 40), sinon 1 ⭐. Les victoires déjà enregistrées ont été recomptées avec cette règle (l'XP déjà gagnée ne change pas) | `getStars`, `twoStarTolerance` (`utils/scoring.ts`), migration v4 (`store/migrations.ts`) |
| On garde le meilleur score et les meilleures étoiles | `completeLevel` |
| Après une victoire, on peut **revoir la solution optimale** : elle se joue toute seule depuis la position de départ, et on avance ou recule coup par coup | `SolutionPlayer`, `vehiclesAtStep` (`utils/solutionReplay.ts`) |
| Si la victoire n'est pas optimale, l'écran de victoire affiche l'écart et propose **« Réessayer pour 3 ⭐ »** : une nouvelle tentative depuis le départ (compteurs remis à zéro, ce n'est pas un recommencer) | `handleRetry` (`app/game.tsx`) |
| **3 niveaux jouables d'avance** : le prochain niveau et les **2 suivants**. Un joueur bloqué sur un niveau dur continue et y revient plus tard ; gagner un niveau plus loin fait avancer la fenêtre. Calculé à partir de `maxUnlockedLevel` (sa signification ne change pas), rien de sauvegardé en plus | `MAP_LOOKAHEAD`, `isMapLevelUnlocked` (`utils/mapFocus.ts`) |
| **Boss** : un niveau de la campagne qui demande **au moins 8 coups de plus** que la médiane des 5 niveaux avant lui. Repéré dans la courbe, jamais choisi à la main ; la campagne ne grandissant qu'à la fin, un boss le reste | `findBossLevels`, `isBossLevel` (`data/bosses.ts`) |
| Un boss est **annoncé** : badge sur son nœud de la carte (même verrouillé), « Niveau N · Boss » en titre de partie, « boss » dans l'annonce du lecteur d'écran. Sa **première victoire** rapporte **50 XP de plus** | `LevelNode`, `app/game.tsx`, `BOSS_WIN_XP` |

## Campagne — on n'ajoute qu'à la fin

Objectif : **1000 niveaux** (#40), livrés par lots (305-500, 501-750, 751-1000), chacun dans sa PR.

| Règle | Implémentation |
|---|---|
| Un niveau livré n'est **jamais modifié, réordonné ni retiré** : `progress`, `savedStates` et `maxUnlockedLevel` sont indexés par id. On **ajoute** uniquement à la fin | hash des niveaux livrés dans `SHIPPED` (`__tests__/campaignPack.test.ts`), une ligne de plus par lot |
| Format compact : une ligne par niveau, l'id est la position dans la liste (ids 1..N sans trou). ~100 octets par niveau au lieu de ~2,6 Ko en JSON | `data/campaignPack.ts`, `data/levelCodec.ts` |
| Courbe de difficulté **par zone de 20 niveaux** : 2 niveaux de **respiration** (~12 coups sous la zone), une **rampe** autour de la base de la zone, un **boss** (+12 coups) en dernier. La base monte de 38 coups (zone 16) à 58 (zone 50) | `planLevel` (`scripts/campaign/plan.ts`) |
| Thèmes des zones de la carte : les **16 premières** gardent leur ordre (les 8 thèmes d'origine deux fois), ensuite les 8 thèmes ajoutés pour la campagne de 1000 niveaux ouvrent la marche, puis tous les thèmes tour à tour. Ajouter un thème : à la fin de `NEW_ZONE_THEMES`, avec son décor, son icône, son nom et sa couleur (clair et sombre) | `zoneTheme`, `NEW_ZONE_THEMES` (`components/map/zones.ts`), `mapZoneAccents` / `mapZoneTints` (`theme/ui.ts`) |
| Succès **« zone parfaite »** (3 étoiles sur tous les niveaux d'une zone) : seules les zones **complètes** (20 niveaux) comptent, celle qui grandit encore à la fin de la campagne attend le lot suivant | `countPerfectZones` (`data/achievements.ts`) |
| Plus de **7×7 et 8×8** quand ça devient dur (6×6 seulement jusqu'à ~42 coups, jamais pour un boss), sorties sur les **4 bords** | idem |
| Qualité : **pas de doublon**, même à une rotation ou un miroir près ; un nombre minimum de véhicules différents bougent dans la solution optimale (4 + coups / 10, au plus 9) ; `minMoves` vérifié par le solveur du jeu | `canonicalKey`, `generate.ts` ; `verify.ts` (hors CI) |
| Génération **reproductible** et **reprenable** : chaque niveau trouvé est écrit tout de suite dans `generated.jsonl` avec ses paramètres, sa graine et son restart (rejouable avec `--seed --restart`). On peut couper à tout moment, relancer reprend au premier niveau manquant | `scripts/campaign/generate.ts`, `checkpoint.ts`, `hardlvl/` |

Ajouter un lot :

1. `npx tsx scripts/campaign/generate.ts --to 500` (relancer autant de fois que nécessaire après une coupure ; `--threads N` pour laisser des cœurs libres, `--budget S` secondes par essai) ;
2. `npx tsx scripts/campaign/build.ts --to 500` copie les niveaux dans le pack et affiche la ligne à ajouter à `SHIPPED` ;
3. `npx tsx scripts/campaign/verify.ts --from <premier id du lot>`, puis `npm test`.

## Niveaux personnalisés — créer, importer, partager

Accueil → **Mes niveaux** : onglets Créés, Importés, Favoris.

| Règle | Implémentation |
|---|---|
| **Modifier, c'est créer** : un niveau importé modifié est enregistré comme **nouveau niveau dans « Créés »** (il compte pour les succès du créateur), l'importé reste intact | `saveLevel` (`app/creator.tsx`) |
| **Nom facultatif**, demandé à l'enregistrement dans le créateur et à l'import (prérempli avec celui du lien), modifiable ensuite (« ⋯ » → Renommer). Sans nom : « Niveau 3 » / « Niveau importé 3 » (rang dans la liste), **jamais l'id** (un horodatage) | `LevelNameSheet`, `customLevelTitle` (`utils/customLevels.ts`) |
| Le nom voyage dans le lien (section en plus, ignorée par les anciennes versions de l'app) | `serializeLevel` (`utils/sharing.ts`) |
| Un lien reçu est **vérifié et résolu à nouveau** : grille, véhicules dans la grille sans chevauchement, une seule voiture cible, une sortie, une solution. Le minimum de coups du lien **n'est jamais repris** (il donne les étoiles et l'XP). La résolution tourne **en arrière-plan** (jamais sur le thread de l'écran) et s'arrête au-delà d'**un million de positions** : un lien forgé ne peut ni figer ni faire planter l'app. Dans « Importer », le plateau est décodé à la frappe, résolu quand la saisie fait une pause ; le créateur a la même limite (« trop de positions ») | `parseSharedLevelAsync`, `MAX_VALIDATE_STATES` (`utils/solver.ts`) |
| Un même plateau n'est importé **qu'une fois** (nom et favori mis à part) : le lien déjà importé ouvre le niveau existant. La comparaison ne porte que sur les **importés** : un niveau modifié depuis un import (dans Créés) et l'original réimporté font bien deux niveaux | `addImportedLevel`, `isSameBoard` |
| **Un seul partage** de niveau, depuis le jeu ou Mes niveaux : QR code **dessiné sur le téléphone** (jamais de service en ligne), feuille de partage du système (lien dans le message, lu aussi sur Android), copier le lien. Chaque partage compte pour le succès « Partageur » | `ShareLevelSheet`, `shareLevel` (`utils/shareLevel.ts`) |
| **Une seule icône de partage** dans toute l'app (niveau, résultat, invitation) : celle du système | `ShareIcon` |
| Supprimer un niveau supprime sa partie en cours ; ses victoires restent dans les statistiques | `deleteCustomLevel` |

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
| Les jours gelés apparaissent en bleu dans le calendrier du profil | `frozenDates`, `StreakCalendar` |
| Le profil montre les gels comme des **emplacements** (remplis ou libres) et le niveau joueur du prochain emplacement | `StreakCard` |

## Missions quotidiennes

| Règle | Implémentation |
|---|---|
| **3 missions par jour**, les mêmes pour tout le monde à une date donnée, renouvelées à minuit (heure locale) | `pickMissions` (`data/missions.ts`) |
| Jamais deux missions sur le même compteur (pas de « 3 niveaux » et « 5 niveaux » le même jour) | |
| Les missions « niveau » ne comptent que **la carte et les niveaux personnalisés**, jamais les défis. Seule la mission « Réussis le défi du jour » porte sur un défi | `bumpMissions` (`store/gameStore.ts`) |
| Toutes les missions sont **réalisables dès le début** du jeu (le niveau 1 est déjà en 7×7) | |
| Une mission « rapide » compte les victoires en **moins d'une minute** ; une mission « nouveau niveau » compte les niveaux réussis pour la première fois | `FAST_WIN_MS`, `bumpMissions` |
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
| « Ton récap est prêt » le **1er du mois à 11 h** (si on a joué le mois écoulé) et le **26 décembre à 11 h** (si on a joué dans l'année) | `planReminders`, voir « Récap mensuel et annuel » |
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
| Première victoire d'un **boss** de la carte : **50 XP** en plus ; les boss déjà gagnés ont été crédités (migration v9) | `BOSS_WIN_XP`, `isBossLevel` (`data/bosses.ts`) |
| Défi du jour : `60 + 20 × étoiles` ; défi hebdo : `150 + 50 × étoiles`, **une seule fois** par défi | `dailyWinXp`, `weeklyWinXp` |
| 3 missions du jour terminées : **100 XP** (**150 XP** si le stock de gels est plein) ; chaque succès débloqué : **50 XP** | `MISSIONS_XP`, `ACHIEVEMENT_XP` |
| Le tutoriel ne rapporte rien | `completeLevel` (niveau non chargé) |
| Titre par palier : Apprenti, Chauffeur (5), Pilote (10), Navigateur (15), As de la route (20), Maître du trafic (30), Légende (40) | `PLAYER_TITLES` |
| Récompenses d'un niveau atteint : **1 gel**, un **emplacement de gel** aux niveaux 5, 10, 20 et 30, un **cosmétique** tous les 5 niveaux jusqu'au 35 | `getLevelRewardLines` (`components/progression/rewards.ts`) |
| Affichage : badge sur l'accueil, carte dans le profil (avec les récompenses du prochain niveau), barre animée et montée de niveau sur l'écran de victoire, toast ailleurs | `PlayerLevelBadge`, `PlayerLevelCard`, `WinModal`, `AchievementToast` |
| Le gel du prochain niveau reste **conditionnel** (« si ton stock n'est pas plein ») même quand le stock est plein aujourd'hui : un gel peut être utilisé d'ici là. La carte rappelle alors le stock actuel | `getLevelRewardLines` (`components/progression/rewards.ts`) |
| Profil → « Voir toute la progression » : chaque niveau avec ses récompenses (aperçu des cosmétiques), puis les cosmétiques débloqués autrement, avec leur condition et l'avancement | `app/progression.tsx` |
| Les joueurs existants reçoivent l'XP de leur progression passée (chaque victoire une fois, sans les récompenses de niveau) | migration v3 (`store/migrations.ts`) |
| Pas de monnaie : l'XP ne se dépense pas | |

## Cosmétiques

Les étoiles, les défis et le niveau joueur débloquent des styles, choisis dans le **Garage** (accueil → Garage), avec un aperçu (même pour un style verrouillé).

| Règle | Implémentation |
|---|---|
| 4 types : **thème de plateau**, **skin de la voiture cible**, **palette des autres véhicules**, **effet de victoire** | `COSMETICS` (`data/cosmetics.ts`), `theme/board.ts` |
| Déblocage **en jouant uniquement**, jamais par achat : niveaux de la carte réussis (**Feu vert** dès 3, pour découvrir le Garage dès la première partie), paliers d'étoiles, niveau joueur, défis hebdo réussis, succès, défi du jour réussi en hiver (déc. à fév.) pour la Neige | `isCosmeticUnlocked` |
| Le déblocage est calculé à partir de la progression : rien n'est perdu, rien ne se « dépense » | `buildCosmeticContext` |
| Un style choisi mais plus débloqué (réinitialisation) revient au style par défaut | `sanitizeSelection` |
| La palette recolore les véhicules dans l'ordre du niveau ; la voiture cible garde sa skin. Le lecteur d'écran annonce la couleur affichée | `applyPalette`, `components/Board.tsx` |
| Les effets de victoire ne se jouent pas avec « Réduire les animations » | `WinEffect` (`components/effects/WinEffect.tsx`) |
| Toutes les voitures cibles du Garage **sauf la voiture rouge** (le look classique du jeu, un bloc) sont **dessinées** en vue de dessus et en pseudo-3D : taxi (damier, enseigne), bus (fenêtres, aérations), police (toit blanc, gyrophares), fusée (ailerons, flamme), voiture de sport (roues apparentes, ailerons), voiture dorée (chromes, couronne), tracteur (grandes roues, pot d'échappement), soucoupe volante (dôme, lumières, pilote). Elles gardent leur couleur ; l'emoji ne sert plus que d'icône dans le Garage. Les véhicules dessinés le sont partout où le jeu montre le style équipé : plateau, aperçus du Garage et de Mes niveaux, image du récap (plateau et route), créateur (plateau, boîte à outils, véhicule glissé) | `CAR_SKINS` (`theme/board.ts`), `theme/art/targetSkins.ts`, `DrawnVehicle`, `ArtGroup` (`components/art/ArtSvg.tsx`), `RecapShareImage` |
| Skin et palette **Mafia** : les véhicules sont **dessinés** en vue de dessus et en pseudo-3D (carrosserie ombrée, ailes, chromes, ombre portée) au lieu de blocs de couleur : berlines des années 30 pour 2 cases, camion plateau (tonneaux de whisky, caisses) pour 3. La voiture cible reste bordeaux (« la voiture rouge » à sortir), un véhicule vertical regarde vers le haut. Le reste ne change pas : lettres, indice, lecteur d'écran | `PALETTE_ART`, `CarSkin.art` (`theme/board.ts`), `theme/art/vintageVehicles.ts`, `DrawnVehicle` |
| Skin **Goélette amirale** et palette **Flotte de 1800** (style Anno 1800) : les véhicules sont des **navires** vus de dessus, à flot (mer, sillage, écume) : goélette à voiles pour 2 cases, vapeur à roues à aubes (cheminées fumantes, canots) pour 3. La couleur est celle de la coque ; la goélette cible est cramoisie. Débloqués par **30 défis hebdo réussis** (après la voiture de police à 20) | `PALETTE_ART`, `CarSkin.art` (`theme/board.ts`), `theme/art/annoShips.ts`, `drawVehicle` (`theme/art/vehicles.ts`), `DrawnVehicle` |
| Effet **Bordée** (style Anno 1800, débloqué avec la Flotte de 1800 : 30 défis hebdo) : la mer monte en bas de l'écran, une frégate toutes voiles dehors la traverse en tanguant et, au milieu, tire ses canons un par un de la poupe à la proue (éclair, nuage de fumée laissé dans le vent, boulet qui éclate sur le plateau), puis la mer redescend | `BroadsideEffect`, `broadsidePlan.ts` (`components/effects/`), `theme/art/frigate.ts` |
| Effet **Sulfateuse** : une Thompson à chargeur camembert entre par la gauche, tire une rafale en balayant (flammes, traçantes, douilles éjectées), laisse des impacts sur le plateau puis repart | `TommyGunEffect`, `tommyGunPlan.ts` (`components/effects/`), `theme/art/tommyGun.ts` |
| Les identifiants des cosmétiques sont sauvegardés : ne jamais en renommer, seulement en ajouter | |
| Un cosmétique lié à un **succès secret** ne dévoile pas son nom tant qu'il est verrouillé (« Succès secret ») | `describeUnlock` (`components/garage/describeUnlock.ts`) |
| **Codes secrets** : taper un mot dans le champ d'import de niveaux (Mes niveaux → Importés) débloque un succès secret. « mafia » → succès *Omertà*, qui donne la voiture cible, la palette et l'effet de victoire **Mafia**. Le code est compté dans `stats.secretCodes`, le champ est vidé et le toast du succès s'affiche | `SECRET_CODES`, `matchSecretCode` (`store/stats.ts`), `recordSecretCode` |
| L'écran de victoire liste les styles que la victoire vient de débloquer (« Nouveau dans le Garage », vignette, nom, onglet) avec un bouton secondaire **« Équiper »** : le style est sélectionné sur place (un effet de victoire se joue aussitôt) et n'est plus « Nouveau ». Un lien « Voir au Garage » y mène ; depuis un niveau de la carte, le retour du Garage ramène à la carte, depuis un défi à son écran | `newlyUnlockedCosmetics` (`data/cosmetics.ts`), `WinModal`, `handleOpenGarage` (`app/game.tsx`) |
| Chaque nouveauté garde sa mention verte **« Nouveau »** dans le Garage jusqu'à ce qu'on la **touche** (ce qui la sélectionne) ; chaque onglet compte les siennes, le lien Garage de l'accueil compte le total. Quitter le Garage n'acquitte rien | `seenCosmetics`, `markCosmeticsSeen` (`app/garage.tsx`) |

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
| **Rien n'est écrit avant que la sauvegarde soit relue** : une mise à jour faite avant (ouverture de l'app, lien) ou après une lecture ratée écraserait la progression par un état vide. Si la lecture échoue, le jeu le dit et n'écrit plus rien jusqu'au prochain lancement ; l'ouverture de l'app (streak, missions) attend le chargement | `guardedStorage`, `saveLoadFailed`, `whenSaveLoaded` (`store/gameStore.ts`), `useAppOpenAlert` |
| La sauvegarde reste **petite** : Android ne relit pas une entrée de plus de 2 Mo. Une partie en cours ne gardait que les **50 derniers coups** d'annulation jusqu'à v11 (tout l'historique reste disponible tant que le niveau est ouvert), aucun sur les défis (pas d'annuler). Le défi d'un jour passé en cours continue dans l'**archive** de ce jour ; les semaines passées et les archives hors de portée sont oubliées (v6). Les niveaux laissés en cours s'additionnent sans fin : seuls les **10 joués en dernier** gardent leur pile d'annulation, jusqu'aux **150 derniers coups** (il y a des niveaux durs), les plus anciens n'en gardent **aucune** ; la partie elle-même (plateau, coups, journal de coups, tentative) est toujours gardée telle quelle. La pile est enregistrée en **forme compacte** (`undoSteps` : ligne et colonne de chaque véhicule, ~50 octets par coup au lieu de 1,4 Ko pour un plateau entier) ; `history` reste vide pour les anciennes versions, qui reprennent la partie sans annuler (v11, « joué en dernier » : le dernier coup, `savedAt`, ou à défaut le début de la tentative) | `MAX_SAVED_UNDOS`, `compactSavedStates`, `MAX_UNDO_STEPS`, `RECENT_SAVES_WITH_UNDOS`, `savedUndoSteps`, `undoStackOf`, `dropOldUndoStacks`, `compactUndoStacks` (`store/savedStates.ts`), à chaque ouverture (`recordAppOpen`) |
| Les **coups sont écrits regroupés** : un coup modifie le store une seule fois, et les mises à jour fréquentes et sans enjeu (coups, annuler, recommencer, indice, temps de jeu, avancement de la génération) ne sont sérialisées et écrites qu'une fois par seconde au plus. Tout le reste (victoire, récompense, succès, import, réglage…) est écrit **aussitôt**, avec ce qui attendait. Quand l'app quitte le premier plan (où elle peut être tuée sans prévenir), ce qui attend est écrit aussitôt, puis chaque écriture est immédiate jusqu'à son retour | `deferNextWrite`, `createGuardedStorage({ delayMs })` (`store/guardedStorage.ts`), `SAVE_WRITE_DELAY_MS`, `bumpMissions(…, withSnapshot(…))` (`store/gameStore.ts`) |
| La **carte infinie** (`generatedLevels`), les **niveaux d'archive** (`archiveLevels`) et les **résultats des défis** (`dailyChallengeProgress`, `weeklyChallengeProgress`, `archiveProgress` : un de plus chaque jour, avec son journal de coups, jamais oublié), gros et rarement modifiés, ont chacun **leur propre entrée** sur l'appareil (`rush-hour-storage:<champ>`, par ex. `rush-hour-storage:generatedLevels`) : chaque entrée a sa propre limite de 2 Mo, et un coup ne réécrit que l'entrée principale. Une entrée séparée n'est écrite que quand elle change, dans le même appel que l'entrée principale et avant elle. L'état relu, l'export et les migrations ne voient aucune différence. Une sauvegarde en une seule entrée (2.0.2 et avant) est relue telle quelle et découpée à l'écriture suivante. Si une version plus ancienne réinstallée a réécrit l'entrée principale (elle n'a pas vu les entrées séparées), on ne perd rien : la carte la plus longue est gardée, et les niveaux d'archive et les résultats des défis des deux sont réunis | `SEPARATE_SAVE_FIELDS` (`store/gameStore.ts`), `separateFields` (`store/guardedStorage.ts`) |

**Triche** : sans serveur, on ne peut pas l'empêcher (tout ce que l'app vérifie, quelqu'un qui lit son code peut le refaire). L'enjeu est faible : pas de classement, pas de monnaie, un tricheur ne lèse que lui-même. On bloque la triche facile et les fichiers abîmés, sans jamais refuser la sauvegarde d'un vrai joueur :
- format non lisible (`RHSAVE1.<somme de contrôle>.<base64>`) et **somme de contrôle** : un code modifié à la main ou tronqué est refusé ;
- **cohérence** : étoiles et score possibles pour l'optimum du niveau, selon la règle des étoiles actuelle ou l'ancienne (2 étoiles à 3 coups près, gardée par les défis d'avant la 1.1) (campagne et niveaux générés seulement : un niveau créé peut être modifié après coup), rien dans le futur (au plus **un jour d'avance** : une sauvegarde faite sur un téléphone plus à l'est, `TIME_ZONE_TOLERANCE_DAYS`), aucune archive du jour même, streak ≤ meilleur streak ≤ défis du jour réussis ;
- **recalcul plutôt que confiance** : XP plafonnée à ce que les victoires ont pu rapporter (`maxPlausibleXp`), gels plafonnés au stock du niveau joueur, succès inconnus retirés, cosmétiques non débloqués remis par défaut.

> ⚠️ Un nouveau champ sauvegardé est exporté automatiquement. S'il est propre au téléphone, l'ajouter à `DEVICE_FIELDS`.

## Progression des joueurs — règle absolue

> 🚨 **Une mise à jour ne doit jamais faire perdre ni fausser la progression d'un joueur.** Cette règle passe avant toutes les autres : une évolution qui ne la respecte pas n'est pas prête, même si elle marche sur une installation neuve.

Sont des **données sensibles** tout ce qui est persisté chez le joueur ou sur le serveur : l'état sauvegardé de `store/gameStore.ts` (`partialize` : progression, étoiles, scores, XP, streak, gels, défis réussis, succès, cosmétiques, niveaux générés / créés / importés, parties en cours), celui de `store/multiStore.ts` (comptes, parties), les **identifiants** (de niveau, de succès, de cosmétique, de mission, clés de dates) et la base du serveur.

| Règle | Implémentation |
|---|---|
| Toute modification de la **forme** de l'état sauvegardé (champ renommé, déplacé, supprimé, type ou sens changé) ou de ce qui sert à le relire (identifiants, ordre ou numérotation des niveaux, calcul des étoiles / du score / de l'XP) est livrée **avec son patch** : `STORE_VERSION` augmentée et une étape ajoutée dans `migrateState`, commentée (`// vN: pourquoi`) | `STORE_VERSION`, `migrateState` (`store/migrations.ts`) |
| Un patch **convertit** les données, il ne les jette pas : déplacer, renuméroter, recompter. Supprimer un champ n'est permis que s'il ne sert plus à rien (ex. v1, jetons d'indice). En cas de doute, garder la valeur la plus favorable au joueur (l'XP déjà gagnée ne baisse pas, une étoile gagnée n'est pas reprise sans règle écrite ici) | migrations v1 à v5 |
| Les étapes existantes ne sont **jamais modifiées ni retirées** : un joueur peut sauter plusieurs versions, et une vieille sauvegarde (export / import) passe par toutes les étapes. L'ordre des étapes est réfléchi (ex. v5 passe en premier pour que les suivantes lisent les nouveaux identifiants) | `migrateState`, `parseSave` |
| Les identifiants persistés ne sont **jamais renommés ni réutilisés** : on en ajoute. Insérer ou réordonner des niveaux de la campagne oblige à décaler la progression, les parties en cours et les niveaux générés (comme v5) | `store/levelIds.ts`, `data/achievements.ts`, `data/cosmetics.ts`, `shiftLevelsAfterRamp` |
| Un nouveau champ a une **valeur par défaut** pour les sauvegardes qui ne l'ont pas (fusion avec l'état initial au chargement ; un objet imbriqué doit y être fusionné lui aussi, comme `stats`) ; une sauvegarde ancienne ne doit jamais planter l'app | `merge` (`store/gameStore.ts`) |
| Le store multijoueur suit la même règle : changer la forme de `partialize` oblige à monter sa `version` et à ajouter un `migrate` | `store/multiStore.ts` |
| Serveur : un changement de schéma est une **nouvelle étape ajoutée à la fin** de la liste, jamais une modification d'une étape existante ; pas de `DROP` de données de joueurs sans décision écrite ici | `server/src/db.ts` (`PRAGMA user_version`) |
| Chaque patch a son **test** : un état sauvegardé par l'ancienne version (écrit en dur dans le test) migré donne le résultat attendu, et une sauvegarde de la version précédente s'importe toujours | `__tests__/migrations.test.ts`, `__tests__/saveTransfer.test.ts` |
| La pull request **dit explicitement** si elle touche aux données persistées et quel patch l'accompagne ; sinon, qu'elle n'y touche pas | description de la PR |

## Multijoueur — entre amis, sur un serveur auto-hébergé

Mode **totalement optionnel** (#46). Chacun peut héberger un serveur Docker (`server/`) et y inviter ses amis. L'app reste hors ligne tant qu'on n'a rejoint aucun serveur, et le multijoueur n'a **aucun effet** sur le reste du jeu.

### Principes

| Règle | Implémentation |
|---|---|
| Aucun effet sur le streak, la carte, l'XP, les succès, les missions, les cosmétiques ; pas de notification | partie jouée hors du store du jeu (`app/multi/play.tsx`, `utils/multi/game.ts`) |
| Pas de serveur central : l'app ne contacte que les serveurs ajoutés par le joueur, en **HTTPS** uniquement | `normalizeServerUrl` (`utils/multi/serverUrl.ts`) |
| **Plusieurs serveurs**, une identité par serveur | `store/multiStore.ts` |
| Identités (jeton, code de récupération) **jamais** dans le `.rushsave` : elles vivent dans un store à part | `useMultiStore` (clé `rush-hours-multi`) |
| Jeton et code de récupération rangés dans le **stockage sécurisé** du téléphone (Keychain iOS / Keystore Android, exclu des sauvegardes Android), jamais en clair dans AsyncStorage ; le reste du compte reste dans le store. Si le stockage sécurisé échoue, ils restent dans le store plutôt que d'être perdus | `createSecureAccountStorage` (`store/secureAccounts.ts`), v2 du store multijoueur |
| Version de l'API vérifiée : « mets à jour l'app » ou « le serveur est trop ancien » | `checkCompatibility` (`utils/multi/api.ts`), `API_VERSION` / `MIN_APP_VERSION` (`server/src/app.ts`) |
| Liens `rush-hours://multi/join?server=…&code=…` (invitation) et `…&mode=recover` (récupération), ouverts par Expo Router sur l'écran prérempli | `buildInviteLink`, `buildRecoveryLink` |
| QR codes **dessinés sur le téléphone** : un code d'invitation ou de récupération ne part jamais vers un service en ligne | `components/multi/QrCode.tsx` |

### Défi multijoueur

| Règle | Implémentation |
|---|---|
| **Pas** le défi du jour du téléphone : puzzle généré par le serveur avec une **graine secrète** (`SERVER_SECRET`), impossible à calculer à l'avance | `puzzleSeed` (`server/src/secrets.ts`) |
| Généré **à l'avance** dans un worker (`PREGENERATE_AHEAD`), **sortie à heure fixe** (`RELEASE_TIME`, fuseau `TZ`) ; une journée va de sortie à sortie | `Challenges` (`server/src/challenges.ts`), `server/src/time.ts` |
| Difficulté par jour de la semaine ; un changement ne touche que les puzzles **pas encore sortis** | `Challenges.ensure` |
| **Expert et Maître** : généré de zéro d'abord (5 graines). Si ça échoue, si ça dure plus d'**1 h**, ou si la sortie arrive avant la fin (puzzle déjà sorti mais pas encore généré, par exemple au premier démarrage), c'est une **variante d'un niveau dur de la campagne**, comme pour les duels : niveau et départ tirés de la même graine secrète, prête en quelques secondes. Jamais une variante du catalogue des duels (`duel_variants`), qu'on a peut-être déjà jouée en duel | `SCRATCH_TIMEOUT_MS`, `Challenges.variant` (`server/src/challenges.ts`), `levelVariants` (`utils/variants.ts`) |
| **Un seul essai** : « Commencer » crée un ticket unique ; on reprend là où on s'était arrêté, le **chrono du serveur** continue | `POST /challenge/start` |
| Pas d'indice, pas d'annuler, pas de recommencer ; **abandonner** possible | `app/multi/play.tsx` |
| Le puzzle est envoyé **sans son optimum**, révélé une fois la partie finie | `puzzleFor` |
| Victoire envoyée comme **journal de coups horodatés**, **rejoué** par le serveur avec les règles de l'app | `applyMoves` (`utils/moveLog.ts`), `POST /challenge/submit` |
| Temps officiel = temps du **serveur** ; le temps du téléphone et le temps hors de l'app sont envoyés comme signaux | `submission` (`utils/multi/game.ts`) |
| **Délai de grâce** (`GRACE_PERIOD`) : une partie commencée avant la sortie suivante peut être finie après, sinon elle est « non terminée » | `Challenges.deadline` |

### Duel 1v1 en temps réel

| Règle | Implémentation |
|---|---|
| L'écran Multijoueur a trois onglets en bas : **Défi** (défi du jour, classement du jour), **Hebdo** (classements des défis ou des duels, dans une seule carte ; le type de période, **Semaine**, **Mois**, **Dates** et, pour les duels, **Tout**, se change par le bouton à droite du titre, qui ouvre une feuille où chaque choix est expliqué ; les semaines (un an) et les mois (3 ans) sont une **frise de puces** qui défile, la période en cours en premier ; sous la frise, les jours couverts, l'état **En cours · encore N jours** ou **Classement final** avec les jours en bref (« 1–31 oct. »), et « ↩ Cette semaine » / « ↩ Ce mois-ci » dès qu'on regarde le passé ; deux dates se choisissent sur un calendrier), **Duels** | `app/multi/index.tsx`, `HomeTabBar` (`activeKey`), `RankingPeriodPicker`, `rankingQuery` (`utils/multi/rankingPeriod.ts`) |
| Deux joueurs du **même serveur**. L'onglet **Duels** liste en direct les duels ouverts (rejoints d'un toucher, **sans code**) et ceux en cours ; elle grandit avec les duels | `GET /duels`, `DuelsCard` (`components/multi/DuelsCard.tsx`) |
| Créer un duel : difficulté au choix, **vainqueur** au choix (**le plus rapide** ou **le moins de coups**), **privé** en option (absent de la liste, rejoint avec son **code à 5 caractères**) | `NewDuelSheet`, `DuelCodeSheet` (`components/multi/DuelSheets.tsx`), `Duels` (`server/src/duel.ts`) |
| Un **WebSocket** par joueur (`/api/v1/duel`), authentifié par le premier message ; le reverse proxy doit laisser passer les WebSockets | `useDuel` (`hooks/useDuel.ts`), `buildNginx` |
| Puzzle **aléatoire**, **le même pour les deux**, sans son optimum ; compte à rebours de 3 s | `Duels.prepare` |
| **Réserve de puzzles** prêts à l'avance, gardée en base : un duel en prend un et démarre aussitôt. Générés de zéro en tâche de fond (10 par niveau, 3 en Maître par défaut ; l'admin règle ce nombre par niveau, de 0 — génération coupée — à 30), dans **son propre worker** (jamais au détriment du défi du jour) : les rapides d'abord, puis le catalogue, puis Expert et Maître (jusqu'à 1 h par puzzle, puis laissé de côté une heure). La feuille « Nouveau duel » montre les niveaux prêts | `PuzzlePool` (`server/src/puzzlePool.ts`), `GET /duels` (`ready`) |
| Duels **Expert et Maître** : en plus des puzzles générés de zéro (un Maître peut prendre des dizaines de minutes), un **catalogue de variantes des niveaux durs de la campagne**, préparé une fois (~3 min au premier démarrage) : toutes les positions atteignables de chaque niveau sont explorées avec leur distance exacte à la victoire, les dures (au plus 2 coups sous le niveau d'origine) sont autant de départs différents, chacun avec sa solution (9 204 en Maître, 379 402 en Expert). Le catalogue en garde 40 par niveau Maître (757 en tout) et 20 par niveau Expert (1 488). Une variante jouée est **marquée** ; le niveau d'origine le moins joué passe d'abord ; tournée (8 symétries) et recolorée à chaque sortie ; quand toutes ont été jouées, la plus ancienne revient. Des niveaux **ajoutés à la fin de la campagne** ne refont pas le catalogue : seules leurs variantes sont préparées, les marques restent (tout est refait seulement si la façon de faire les variantes change). Le défi du jour n'y puise pas : il ne prend une variante qu'en secours, calculée de sa graine secrète (voir « Défi multijoueur ») | `hardStarts`, `levelVariants`, `dressVariant` (`utils/variants.ts`), table `duel_variants`, `dropStaleVariants` (`server/src/puzzlePool.ts`) |
| Chaque joueur **voit le plateau de l'autre** en direct (en haut, petit), le sien en bas ; voir le puzzle de l'autre est assumé | `Arena` |
| Chaque coup est **vérifié** par le serveur (mêmes règles que l'app) et relayé ; temps = chrono du serveur. **Le plus rapide** : la première victoire vue par le serveur gagne. **Le moins de coups** : le premier sorti attend l'autre (son plateau est figé, l'adversaire voit « sorti en N coups ») ; le moins de coups gagne, le plus rapide à égalité ; fini dès que l'autre ne peut plus faire mieux (déjà N − 1 coups, ou N = optimum) | `applyMoves`, `duelReducer` (`utils/multi/duel.ts`), `Duels.decideOnMoves` |
| Quitter = perdre ; connexion perdue : **60 s** pour revenir (le duel reprend là où il était), sinon défaite (sauf pour qui est déjà sorti, duel aux coups) ; personne n'a fini en 30 min : égalité (duel aux coups : le seul sorti gagne) | `RECONNECT_GRACE_MS`, `MAX_DUEL_MS` |
| **Revanche** quand les deux la demandent : nouveau puzzle | `rematch` |
| **Spectateurs** : un duel en cours de la liste se regarde d'un toucher (« Regarder »), un duel privé avec son code (un code d'un duel déjà commencé ouvre le duel en spectateur) ; les deux plateaux en direct, de la même taille, rien à jouer, revanches comprises. Les joueurs voient combien regardent (👁) ; 50 spectateurs au plus par duel ; pas de replay pour un spectateur | `watch` (`Duels`), `SpectatorResult` (`app/multi/duel.tsx`), `DuelsCard` |
| Un duel **terminé est gardé** : score entre les deux joueurs (affiché à la fin), historique « Mes duels », **replay** des deux plateaux au rythme réel (coups effacés après `REPLAY_RETENTION_DAYS`, résultats gardés) | `DuelStore` (`server/src/duelStore.ts`), `DuelHistoryCard`, `app/multi/duel-replay.tsx` |
| **Classement des duels** (semaine, mois, deux dates, tout) : victoires, puis moins de défaites | `rankDuels`, `GET /duels/leaderboard`, `DuelLeaderboard` |
| Aucun effet sur le reste du jeu (streak, XP…) | |
| Un serveur trop ancien (sans `features: ['duel']` dans `/info`) ou un WebSocket bloqué : message clair | `useDuel` |

### Classements

| Règle | Implémentation |
|---|---|
| Jour : **coups, puis temps** ; égalité parfaite = même rang ; puis en cours, non terminé, abandon | `rankDay` (`server/src/leaderboard.ts`) |
| Semaine (ISO), mois et entre deux dates : **points** par jour, 10, 8, 6, 5, 4, 3, 2 puis 1 par victoire, 0 sinon | `RANK_POINTS`, `rankPeriod` |
| Semaine : chaque joueur a ses **7 cases du lundi au dimanche** (points du jour, « – » pas joué, « … » en cours, « · » à venir) qui se remplissent au fil des défis | `days` de `rankPeriod`, `weekCells` (`utils/multi/week.ts`), `Leaderboard` |
| Période **terminée** (semaine ou mois passé, dates passées) : classement final, **médailles** 🥇🥈🥉 et **ta place** (défis et duels) | `isPeriodOver`, `final` (`Leaderboard`, `DuelLeaderboard`) |
| Du lundi au mercredi (jours du défi en cours pour les défis, jours de fin des duels pour les duels), pour les défis **comme pour les duels**, un **bandeau** « Semaine dernière terminée » (vainqueur, ta place) ouvre son classement final, d'où « ↩ Cette semaine » ramène : pas de doublon du classement | `showsWeekRecap`, `WeekRecap` |
| **Deux dates** (dans n'importe quel ordre, bornes comprises) : seulement sur un serveur qui l'annonce (`features: ['ranking_range']` dans `/info`) ; sinon « Dates » explique que le serveur doit être mis à jour ; semaines et mois passés marchent partout | `rankingSpan` (`server/src/app.ts`), `FEATURES` |
| Scores gardés pour toujours ; **coups** effacés après `REPLAY_RETENTION_DAYS` | `Challenges.purgeReplays` |

### Anti-triche

| Règle | Implémentation |
|---|---|
| Impossible par construction : faux score (rejeu), temps trafiqué (chrono serveur), puzzle préparé (graine secrète), deuxième essai (ticket), inconnu sans code d'invitation | |
| **⚠️ Suspect**, automatique, **visible de tous avec sa raison** : trop rapide, « recopié » (longue pause puis solution parfaite au rythme régulier), horloge incohérente. Le joueur garde ses points | `analyzeGame` (`server/src/cheat.ts`) |
| Seuils réglables par l'admin | `server/src/settings.ts` |
| **Temps hors de l'app** : montré à l'admin seulement, **jamais un soupçon à lui seul** | `GET /admin/games` |
| **🤡 Tricheur**, confirmé par l'admin après le replay : **garde son rang**, score barré, **0 point** ; les autres **ne remontent pas** | `rankDay` |
| L'admin peut lever un soupçon ou annuler sa décision | `POST /admin/games/:id/verdict` |
| Pas de détection multi-compte (faux positifs sur un réseau d'entreprise) ; un ami qui donne la solution reste possible | |

### Replay

| Règle | Implémentation |
|---|---|
| Voir la partie de quelqu'un **seulement une fois sa propre partie du jour finie** (gagnée ou abandonnée) ou le défi fermé ; l'admin toujours | `GET /replay/:id` |
| Au **rythme réel** avec le chrono, ×1 / ×2 / ×4, coup par coup ; pauses de plus de 5 s **raccourcies et affichées** | `utils/multi/replay.ts`, `app/multi/replay.tsx` |

### Comptes et modération

| Règle | Implémentation |
|---|---|
| Rejoindre : adresse + **code d'invitation** + pseudo (2 à 20 caractères, unique sans tenir compte de la casse ni des accents) | `POST /join`, `pseudoKey` |
| **Code de récupération** pour changer de téléphone (l'ancien est déconnecté) ; l'admin peut en donner un nouveau | `POST /recover`, `POST /admin/players/:id/transfer` |
| **Signaler** un pseudo (à l'admin) et **bloquer** un joueur (masqué sur ce téléphone seulement) | `POST /reports`, `blocked` (`store/multiStore.ts`) |
| **Supprimer ses données** depuis l'app ou depuis le web avec le code de récupération (Google Play) ; l'admin peut aussi supprimer le compte d'un joueur (pas d'un admin) | `DELETE /me`, `/delete-account` (`server/src/deletePage.ts`), `DELETE /admin/players/:id` |
| Panneau admin : un **accueil en liste**, groupé par usage (À traiter, Communauté, Serveur, Zone de danger) ; chaque ligne résume sa rubrique (badge des parties suspectes à trancher et des signalements) et ouvre sa page. Toutes les pages se rafraîchissent en tirant vers le bas ; les joueurs se cherchent par pseudo (sans casse ni accents), leurs actions dans une feuille | `GET /admin/summary`, `app/multi/admin/index.tsx`, `AdminRow`, `AdminPage` (`components/multi/admin/`) |
| Admin : **puzzles de duel** prêts d'avance, par difficulté (réserve, catalogue de variantes, ce qui est en cours de génération ou laissé de côté) ; les plateaux, dans l'ordre où les duels les prendront, ne s'affichent qu'à la demande (ce sont les prochains duels de l'admin). La page distingue la **génération d'avance** (ce que le serveur fabrique en tâche de fond) de la **réserve** (ce qui est prêt : les puzzles générés d'avance, puis le catalogue de variantes en Expert et Maître, toujours gardé et affiché). Par niveau, l'admin **active ou coupe** la génération et choisit **combien** en garder prêts : une génération devenue inutile s'arrête aussitôt (un Maître peut occuper un petit serveur pendant une heure) ; génération coupée, un duel Expert ou Maître pioche dans le catalogue, les autres génèrent leur puzzle au moment de commencer | `GET /admin/puzzles`, `PuzzlePool.overview`, `PuzzlePool.resized`, réglage `duelPool`, `AdminPuzzles` (`components/multi/admin/AdminPuzzles.tsx`) |
| Admin, page Défi du jour : **défis préparés**, le défi en cours et les suivants générés d'avance, puis le premier généré plus tard. Pour chacun : difficulté, sortie, état (prêt, en génération depuis X min, raté avec nouvel essai chaque minute, ou généré à partir de quand), optimum, **origine** (généré de zéro ou variante de secours du niveau N) et durée de génération ; un défi préparé dans une difficulté changée depuis est signalé. Plateaux à la demande seulement (ce sont les prochains défis de l'admin). L'origine et la durée sont gardées en base (inconnues, donc vides, pour les défis d'avant) | `Challenges.overview`, `GET /admin/challenges`, `AdminChallenges` (`components/multi/admin/AdminChallenges.tsx`), colonnes `variant_of` et `generation_ms` de `challenges` |
| Admin : **remise à zéro** des parties de défi et/ou des duels, pour une période (aujourd'hui, semaine, mois, dates, tout) et tous les joueurs ou certains ; le nombre effacé est montré avant de confirmer | `POST /admin/reset`, `AdminReset` (`components/multi/admin/AdminReset.tsx`) |
| Admin : devenir admin avec `ADMIN_TOKEN` ; exclure, renommer, régénérer le code d'invitation, fermer les inscriptions, réserver les invitations, régler difficulté, conservation et seuils. Les réglages de l'app l'emportent sur l'environnement | `server/src/settings.ts`, `app/multi/admin/[section].tsx` |
| Pas de validation manuelle des inscriptions | |

> ⚠️ Toute évolution qui change l'API doit monter `API_VERSION` (serveur et app), et `MIN_APP_VERSION` si une ancienne app ne peut plus jouer.

## Succès

- Définis à un seul endroit : `data/achievements.ts`. Les **identifiants sont persistés** : ne jamais renommer un succès, seulement en ajouter.
- Un succès ne doit jamais contredire les règles ci-dessus : aucun succès « sans indice » ou « sans annuler » sur les défis, puisqu'ils n'en ont jamais.
- Un succès débloqué est **nouveau** jusqu'à ce qu'on le **touche** dans le profil : pastille bleue sur sa médaille, nombre de nouveautés sur sa catégorie (ouverte d'office) et sur le bouton profil de l'accueil (`seenAchievements`, `useNewAchievements`). Ceux débloqués avant cette règle comptent comme vus (migration v10).
- Toucher une médaille ouvre son **détail dans un panneau en bas de l'écran** (`AchievementSheet`) : nom, état, description et progression. La liste reste utilisable : toucher une autre médaille affiche directement la sienne. Si le panneau couvrirait la médaille touchée, la liste défile pour la garder visible au-dessus. La croix, le bouton retour ou un toucher ailleurs sur l'écran le referment.

## Dates

- Les dates des défis sont des clés `YYYY-MM-DD` en **heure locale**. Ne jamais les relire avec `new Date('YYYY-MM-DD')`, que JavaScript interprète en UTC (décalage d'un jour à l'ouest de l'heure UTC) : utiliser `parseLocalDateString`.
- Les succès « sans aide » ne comptent que les niveaux distincts (impossible de les farmer en rejouant le même niveau).
- Le déblocage est **visible** : toujours par un **toast en haut de l'écran**, l'un après l'autre, y compris par-dessus l'écran de victoire (`WinAchievementToasts`, `components/AchievementToast.tsx`). Après une mise à jour, les succès déjà mérités sont débloqués silencieusement.

## Statistiques

- Le **temps de jeu** ne compte que le temps actif : écran de jeu ouvert, app au premier plan, niveau non résolu.
- Indices, annulations, recommencements et temps sont suivis **par tentative** et survivent à la fermeture de l'écran (`savedStates[…].attempt`).

## Récap mensuel et annuel

Un récap de fin de mois et de fin d'année, façon Spotify Wrapped (#125) : une raison de revenir, et une fois partagé, il fait connaître le jeu.

| Règle | Implémentation |
|---|---|
| Des **cartes plein écran façon story** (un dégradé chacune, barres de progression en haut, croix pour fermer) : on glisse, ou on touche à droite pour avancer et sur le tiers gauche pour revenir. Dans l'ordre : profil de joueur, victoires (nouveaux niveaux, étoiles gagnées, « Parfait ! »), temps de jeu et coups, défis (du jour, hebdo, à 3 étoiles, meilleure série de la période, gels utilisés), exploit (niveau le plus dur battu, boss vaincus), succès et styles débloqués, puis le partage avec la comparaison avec la période d'avant | `app/recap.tsx`, `buildRecap`, `recapSlides` (`utils/recap.ts`), `recapSlideColors` (`theme/ui.ts`) |
| **Une idée par carte, un gros chiffre** et quelques chiffres sous lui. **Jamais de zéro** : un chiffre nul n'est pas montré, le suivant prend la grande place, et une carte sans rien à dire est sautée | `recapSlides` |
| **Profil de joueur** : le premier qui va, dans l'ordre : Fidèle au poste (défi du jour réussi ≥ 80 % des jours, 7 au moins), Perfectionniste (≥ 60 % de victoires à 3 étoiles, 5 victoires au moins), Lève-tôt (3 défis du jour réussis entre 5 h et 7 h), Oiseau de nuit (3 victoires entre minuit et 5 h), Chasseur de boss (2 boss), Explorateur (20 nouveaux niveaux), Pilote des défis (3 défis du jour ou hebdo), sinon Conducteur | `pickProfile` |
| « Boss vaincus » compte les **boss de la carte** (ceux qu'elle annonce) | `isBossLevel` (`data/bosses.ts`) |
| **Mensuel** annoncé sur l'accueil du **1er au 7** du mois, **annuel** du **26 décembre au 1er janvier**, jusqu'à ce qu'on l'ouvre ; rien pour une période où l'on n'a pas joué. L'annuel passe avant le mensuel | `pendingRecap`, `recapsSeen`, `RecapCard` |
| Profil : une carte montre le **dernier récap** (celui annoncé sur l'accueil, marqué « Nouveau », sinon le dernier mois joué) avec son profil et quelques chiffres, puis **Voir tous mes récaps** : les 12 derniers mois et le mois en cours, puis toutes les années | `RecapPreviewCard`, `availableRecaps`, `app/recaps.tsx` |
| **Partage** (dernière carte, l'image aussi grande que l'écran le permet) en **image verticale 9:16** (1080 × 1920) dessinée sur le téléphone (SVG exporté en PNG, aucun service en ligne, comme le QR code), sans emoji : le feu vert du jeu, le **plateau équipé au Garage** (thème, voiture, palette) avec la voiture cible qui sort, le profil et sa phrase, jusqu'à **6 chiffres** en tuiles aux couleurs des véhicules (les plus parlants des cartes, jamais de zéro), un autocollant « +12 victoires vs septembre » seulement si on a progressé, et une route, et en **texte** façon Wordle, avec emojis. Chaque partage compte pour le succès « Crieur public » | `RecapShareImage`, `recapHighlights`, `recapProgress`, `buildRecapShareText`, `recordResultShared` |
| **Stockage minimal** : des compteurs et des maxima par période, **jamais de liste de parties** (~300 octets par période). 13 mois glissants (`monthlyStats`), une entrée par année gardée pour toujours (`yearlyStats`, comptée en même temps que ses mois), le mois de déblocage de chaque succès (`achievementMonths`). Moins de 10 Ko même après 10 ans | `addToPeriods`, `RECAP_MONTHS_KEPT` (`store/periodStats.ts`) |
| Rien de ce qui est **déjà daté** n'est recopié : défis du jour et hebdo (une semaine compte dans le mois de son lundi), série, gels utilisés se lisent dans leurs données | `buildRecap` |
| Les joueurs d'avant la mise à jour : seuls les défis sont datés, ils sont **recomptés** dans leur mois et leur année ; le reste se compte à partir de la mise à jour (`recapSince`), et les succès déjà débloqués sont datés du mois de la mise à jour. Le récap de cette période **le dit** (« Compté depuis le 20 oct. », et ne liste pas les succès) plutôt que d'afficher des zéros trompeurs ; on ne compare les victoires qu'avec une période comptée en entier | migration v12 (`store/migrations.ts`), `partialSince` |
| Import : compteurs **plafonnés par les totaux à vie** (une période ne contient jamais plus que tout le jeu), périodes dans le futur ou hors des 13 mois retirées ; un champ du récap abîmé prend sa valeur par défaut, la sauvegarde n'est pas refusée pour ça | `wellFormedRecap` (`utils/saveTransfer.ts`) |
| Accessible au lecteur d'écran : chaque carte est lue d'un bloc, avec sa position (« Carte 2 sur 6 ») ; elle est « ajustable », balayer vers le haut ou le bas change de carte. Pas d'avance automatique. Les animations suivent « Réduire les animations » | `app/recap.tsx` |

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
| Les animations suivent le réglage système « Réduire les animations » | comportement par défaut de Reanimated (`ReduceMotion.System`) ; ne pas ajouter de `ReducedMotionConfig` |
| Créateur : « Ajouter au plateau » place le véhicule sur la **première case libre** (on ne peut pas glisser au lecteur d'écran) ; toucher deux fois fait pivoter, l'action « Supprimer » retire | `findFreeCell` (`utils/creatorGeometry.ts`) |
| Tout nouveau bouton a un `accessibilityRole`, et un `accessibilityLabel` traduit s'il ne contient qu'une icône | clés `a11y.*` des fichiers de traduction |

## Icônes

Les icônes de l'interface sont des **Ionicons** (`@expo/vector-icons/Ionicons`), pas des emojis : elles prennent la couleur du thème (clair / sombre), sont nettes à toutes les tailles et s'affichent pareil sur iOS et Android.

| Règle | Implémentation |
|---|---|
| Boutons, pastilles, cadenas, icônes des missions et des succès : Ionicons | `IoniconName` (`utils/icons.ts`) pour typer une icône dans les données |
| Une icône devant un texte passe par `IconText` ; dans une ligne de texte, l'icône peut être imbriquée dans le `<Text>` | `components/IconText.tsx` |
| Un bouton qui n'a qu'une icône (fermer, réglages…) suit la règle d'accessibilité : `accessibilityLabel` traduit | clés `a11y.*` |
| Les paliers d'une même série de succès répètent leur icône (1, 2 puis 3 flammes) plutôt que de la dupliquer | `iconCount`, `AchievementIcon` |
| Les textes traduits affichés dans l'app ne contiennent pas d'emoji : l'icône est posée par le composant, à côté du texte (« 3 étoiles », pas « 3 ⭐ ») | `locales/*.json`, `IconText` |
| Les symboles typographiques dans un texte (`←`, `✓`, `★`, `↕`) restent permis | |

Les emojis ne restent que là où une icône ne peut pas s'afficher ou n'a pas d'équivalent :

- les **textes qui sortent de l'app** : résultat partagé (`utils/shareResult.ts`), titres des notifications, alertes système ;
- les **illustrations** : décor et panneaux des zones de la carte (`components/map/zones.ts`), icône des skins sur la voiture cible et vignettes des effets (`theme/board.ts`, `data/cosmetics.ts`).

## Retour du joueur

- Après **3 jours ou plus** d'absence : message de bienvenue (`recordAppOpen`, `hooks/useAppOpenAlert.ts`).

## Roadmap

Les évolutions prévues sont suivies dans l'epic #19 sur GitHub (multijoueur : #46). Chacune doit respecter les règles ci-dessus.

## Tests

Les règles ci-dessus sont vérifiées par les tests de `__tests__/` (Jest). Toute évolution d'une règle doit mettre à jour son test.

| Commande | Usage |
|---|---|
| `npm test` | tous les tests |
| `npm run test:tz` | les tests dans trois fuseaux horaires (New York, Paris, Auckland) : un bug de date peut ne se voir qu'à l'ouest de l'heure UTC (#20) |
| `npm run typecheck` | vérification TypeScript |
| `cd server && npm test` | tests du serveur multijoueur (Vitest) |

La CI (`.github/workflows/tests.yml`) lance le typecheck et les tests dans les trois fuseaux sur chaque pull request. `.github/workflows/server.yml` teste le serveur et publie son image Docker sur GHCR (`:multi` depuis la branche `multi`, `:preprod` depuis les branches de version `X.Y.Z`, `:latest` depuis `main`).

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

**Textes** : le jeu **tutoie** le joueur (« Touche un jour passé », « ton streak »), jamais de vouvoiement.
