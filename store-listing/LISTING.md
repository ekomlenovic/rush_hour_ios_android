# Fiche Google Play : Rush Hours

Tout ce qu'il faut pour remplir **Play Console → Présence sur le Store → Fiche principale**, en anglais (langue par défaut) et en français (traduction ajoutée à la main, pas la traduction automatique).

Tous les chiffres viennent du code (version 1.1.8) : 309 niveaux (`data/sampleLevels.ts`), 6 à 63 coups minimum, grilles 6×6 à 8×8, 77 succès (`data/achievements.ts`), 24 cosmétiques (`data/cosmetics.ts`). **À mettre à jour si la campagne ou les succès changent.**

## Fichiers

| Élément Play Console | Fichier | Format demandé |
|---|---|---|
| Icône de l'app | `icon-512.png` | 512 × 512, PNG 32 bits, ≤ 1 Mo |
| Image de présentation (feature graphic) | `en/feature-graphic.png`, `fr/feature-graphic.png` | 1024 × 500, PNG/JPEG |
| Captures d'écran téléphone (2 à 8) | `en/phone/01…08.png`, `fr/phone/01…08.png` | 1080 × 1920 (9:16) |

Ordre conseillé : celui des numéros. Les 3 premières sont les plus vues (dans les résultats de recherche) : gameplay, nombre de niveaux, défi du jour.

| # | Écran | Message EN | Message FR |
|---|---|---|---|
| 1 | Partie en cours (niveau 73) | Slide the cars. Free the red one. | Glisse les voitures. Libère la rouge. |
| 2 | Carte du monde | 309 levels on a world map | 309 niveaux sur une carte du monde |
| 3 | Défi du jour (mode sombre) | A new Daily Challenge every day | Un nouveau défi chaque jour |
| 4 | Écran de victoire 3 étoiles | Find the optimal solution | Trouve la solution optimale |
| 5 | Profil, streak, calendrier | Keep your streak alive | Ne casse pas ton streak |
| 6 | Garage | Unlock styles by playing | Débloque des styles en jouant |
| 7 | Créateur + partage QR | Create & share your own levels | Crée et partage tes niveaux |
| 8 | Multijoueur (mode sombre) | Play with friends, on your own server | Joue entre amis, sur votre serveur |

Les captures sont de **vrais écrans de l'app** (version web, même code), avec une progression de démo réaliste : ~2 mois de jeu, niveau joueur 7, 72 niveaux réussis, streak de 23 jours. La victoire du niveau 73 a vraiment été jouée (solution optimale en 20 coups).

---

## English (default language)

### App name (30 max)

```
Rush Hours: Traffic Puzzle
```
(26 characters)

### Short description (80 max)

```
Slide the cars, free the red one. 309 levels, daily challenges, no ads.
```
(71 characters)

### Full description (4000 max)

```
Slide the cars. Free the red one.

Rush Hours is a sliding-block traffic puzzle. Cars and trucks only move forward and backward in their lane: find the right order to clear a path and drive the red car out of the gridlock. Simple to learn, hard to master.

309 LEVELS ON A WORLD MAP
• From 6-move warm-ups to 63-move brain-burners
• 6×6, 7×7 and 8×8 grids
• Travel through themed zones: downtown, harbor, forest road, desert highway, snowy peaks, city by night…
• Done with the campaign? Generate new levels on your phone, from Easy to Master

A NEW CHALLENGE EVERY DAY
• Daily Challenge: the same puzzle for everyone, one try, no hints, no undo
• Harder puzzle on Mondays
• Weekly Challenge: a big puzzle that lasts all week
• Missed a day? Replay the last 90 days of daily puzzles as practice

AIM FOR THE PERFECT SOLUTION
• 3 stars for the minimum number of moves
• After a win, watch the optimal solution play step by step
• On campaign levels, hints are unlimited and free, and undo is always there

PLAY EVERY DAY
• Daily streak with a calendar of your results
• Streak freezes protect your streak when you miss a day
• 3 daily missions
• XP and player levels, from Apprentice to Legend
• 77 achievements

UNLOCK STYLES BY PLAYING
Board themes, target car skins, vehicle colors and win effects. All 24 are unlocked with stars, levels, challenges and achievements. None of them are for sale.

CREATE AND SHARE
Build your own puzzles in the level creator. The game checks that your level has a solution and counts its minimum moves. Share it with a QR code or a link: your friends open it straight in the app.

PLAY WITH FRIENDS (OPTIONAL)
Host a small multiplayer server (Docker) and invite your friends: a private daily challenge with rankings for the day, week and month, and live 1v1 duels. There is no central server: the app only connects to servers you join yourself.

FAIR AND RESPECTFUL
• No ads, no in-app purchases, no currency
• Works offline, no account needed
• No data collected by the developer
• Export your save to move to a new phone
• Light and dark mode
• Playable with TalkBack: every car is announced and can be moved without dragging
• English and French
```

### Release notes (500 max) — exemple pour la prochaine mise à jour

```
• Levels 5 to 6: smoother difficulty ramp
• Cleaner icons everywhere in the app
• Achievement tiers now show 1, 2 or 3 flames
```

---

## Français

### Nom de l'application (30 max)

```
Rush Hours : Puzzle Voitures
```
(28 caractères)

### Description courte (80 max)

```
Fais glisser les voitures, libère la rouge. 309 niveaux, défis du jour, sans pub
```
(80 caractères)

### Description complète (4000 max)

```
Fais glisser les voitures. Libère la rouge.

Rush Hours est un casse-tête de blocs coulissants. Voitures et camions n'avancent et ne reculent que dans leur voie : trouve le bon ordre pour dégager le passage et faire sortir la voiture rouge des embouteillages. Facile à comprendre, difficile à maîtriser.

309 NIVEAUX SUR UNE CARTE DU MONDE
• De l'échauffement en 6 coups au casse-tête de 63 coups
• Grilles 6×6, 7×7 et 8×8
• Traverse des zones à thème : centre-ville, port, route forestière, route du désert, sommets enneigés, ville de nuit…
• Campagne terminée ? Génère de nouveaux niveaux sur ton téléphone, de Facile à Maître

UN NOUVEAU DÉFI CHAQUE JOUR
• Défi du jour : le même puzzle pour tout le monde, un seul essai, sans indice ni retour en arrière
• Puzzle plus difficile le lundi
• Défi hebdo : un gros puzzle pour toute la semaine
• Un jour manqué ? Rejoue les défis des 90 derniers jours pour t'entraîner

VISE LA SOLUTION PARFAITE
• 3 étoiles pour le minimum de coups
• Après une victoire, regarde la solution optimale coup par coup
• Sur la carte, indices illimités et gratuits, et le bouton annuler est toujours là

JOUE CHAQUE JOUR
• Streak quotidien avec un calendrier de tes résultats
• Les gels protègent ton streak quand tu manques un jour
• 3 missions par jour
• XP et niveaux joueur, d'Apprenti à Légende
• 77 succès

DÉBLOQUE DES STYLES EN JOUANT
Thèmes de plateau, voitures, couleurs des véhicules et effets de victoire. Les 24 se débloquent avec les étoiles, les niveaux, les défis et les succès. Aucun n'est à vendre.

CRÉE ET PARTAGE
Construis tes propres puzzles dans le créateur de niveaux. Le jeu vérifie que ton niveau a une solution et calcule son minimum de coups. Partage-le par QR code ou par lien : tes amis l'ouvrent directement dans l'app.

JOUE ENTRE AMIS (OPTIONNEL)
Héberge un petit serveur multijoueur (Docker) et invite tes amis : un défi du jour privé avec classements du jour, de la semaine et du mois, et des duels 1v1 en direct. Il n'y a pas de serveur central : l'app ne se connecte qu'aux serveurs que tu rejoins toi-même.

UN JEU HONNÊTE
• Sans pub, sans achat intégré, sans monnaie
• Fonctionne hors ligne, sans compte
• Aucune donnée collectée par le développeur
• Exporte ta sauvegarde pour changer de téléphone
• Mode clair et sombre
• Jouable avec TalkBack : chaque voiture est annoncée et se déplace sans glisser
• Français et anglais
```

### Notes de version (500 max) — exemple

```
• Niveaux 5 à 6 : montée de difficulté plus douce
• Icônes plus nettes dans toute l'app
• Les paliers de succès affichent 1, 2 ou 3 flammes
```

---

## Autres réglages de la fiche

| Champ | Valeur conseillée |
|---|---|
| Type d'application | Jeu |
| Catégorie | **Réflexion** (Puzzle) |
| Tags (5 max) | Puzzle, Casse-tête / Brain games, Logique, Hors ligne, Solo |
| Prix | Gratuit |
| Contient des annonces | **Non** |
| Achats intégrés | **Non** |
| Classification du contenu | Questionnaire IARC : aucune violence, pas d'achat ; **« Les utilisateurs peuvent interagir » : Oui** (pseudos en multijoueur) |
| Public cible | 13 ans et plus (la politique de confidentialité dit « pas destiné aux moins de 13 ans ») |
| Sécurité des données | voir [`docs/PLAY_STORE.md`](../docs/PLAY_STORE.md) |
| Politique de confidentialité | lien vers [`Privacy_Policy.md`](../Privacy_Policy.md) sur GitHub |
| Site web | `https://github.com/ekomlenovic/rush_hour_ios_android` |

## Pourquoi ces textes

- **Mots-clés** : Google indexe le titre, la description courte et la description longue. « Traffic puzzle », « sliding block », « puzzle », « daily challenge », « levels », « offline » y sont, sans bourrage (Google pénalise la répétition).
- **Arguments vérifiables** : « no ads / no in-app purchases » (aucun SDK de pub ni de paiement dans `package.json`), « works offline » et « no data collected » (politique de confidentialité), cosmétiques jamais vendus (`docs/GAME_DESIGN.md`).
- **Multijoueur présenté tel qu'il est** : optionnel, il faut qu'un des joueurs héberge un serveur. Il n'est pas mis en avant comme un mode en ligne « ouvert », pour éviter les avis déçus.
- **Rien d'interdit par Google** : pas de « #1 », « best », « free » dans le titre, pas d'emoji dans le titre, pas de prix ni de promo sur les visuels.
