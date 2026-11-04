# Fiche Google Play : Rush Hours

Tout ce qu'il faut pour remplir **Play Console → Présence sur le Store → Fiche principale**, en anglais (langue par défaut) et en français (traduction ajoutée à la main, pas la traduction automatique).

Tous les chiffres viennent du code (version 2.1.0) : 734 niveaux (`data/sampleLevels.ts`), 6 à 63 coups minimum, grilles 6×6 à 8×8, 16 thèmes de zones (`components/map/zones.ts`), 86 succès (`data/achievements.ts`), 82 styles dont 44 pour 11 fêtes de l'année (`data/cosmetics.ts`). **À mettre à jour si la campagne, les succès ou les styles changent.**

## Fichiers

| Élément Play Console | Fichier | Format demandé |
|---|---|---|
| Icône de l'app | `icon-512.png` | 512 × 512, PNG 32 bits, ≤ 1 Mo |
| Image de présentation (feature graphic) | `en/feature-graphic.png`, `fr/feature-graphic.png` | 1024 × 500, PNG/JPEG |
| Captures d'écran téléphone (2 à 8) | `en/phone/01…08.png`, `fr/phone/01…08.png` | 1080 × 1920 (9:16) |
| Captures tablette 7 pouces (jusqu'à 8) | `en/tablet-7/01…08.png`, `fr/tablet-7/01…08.png` | 1080 × 1920 (9:16) |
| Captures tablette 10 pouces (jusqu'à 8) | `en/tablet-10/01…08.png`, `fr/tablet-10/01…08.png` | 1440 × 2560 (9:16) |

Les captures tablette sont prises sur un écran de tablette (600 × 960 et 800 × 1280 points) : c'est le vrai rendu de l'app sur tablette.

Ordre conseillé : celui des numéros. Les 3 premières sont les plus vues (dans les résultats de recherche) : gameplay, nombre de niveaux, défi du jour.

| # | Écran | Message EN | Message FR |
|---|---|---|---|
| 1 | Partie en cours (niveau 73) | Slide the cars. Free the red one. | Glisse les voitures. Libère la rouge. |
| 2 | Carte du monde | 734 levels on a world map | 734 niveaux sur une carte du monde |
| 3 | Défi du jour (mode sombre) | A new Daily Challenge every day | Un nouveau défi chaque jour |
| 4 | Écran de victoire 3 étoiles | Find the optimal solution | Trouve la solution optimale |
| 5 | Profil, streak, calendrier | Keep your streak alive | Ne casse pas ton streak |
| 6 | Garage, tenue de Noël (plateau, traîneau, convoi) | Unlock styles by playing | Débloque des styles en jouant |
| 7 | Créateur + partage QR | Create & share your own levels | Crée et partage tes niveaux |
| 8 | Multijoueur (mode sombre) | Play with friends, on your own server | Joue entre amis, sur votre serveur |

Les captures sont de **vrais écrans de l'app** (version web, même code), avec une progression de démo réaliste : ~2 mois de jeu, niveau joueur 7, 72 niveaux réussis, streak de 23 jours. La victoire du niveau 73 a vraiment été jouée (solution optimale en 20 coups).

Pour les refaire après une mise à jour : [`tools/README.md`](tools/README.md).

---

## English (default language)

### App name (30 max)

```
Rush Hours
```

### Short description (80 max)

```
Traffic jam puzzle: slide the cars, free the red one. 734 levels, no ads.
```
(73 characters)

### Full description (4000 max)

```
Slide the cars. Free the red one.

Rush Hours is a traffic jam puzzle game: a sliding-block brain teaser where cars and trucks only move forward and backward in their lane. Find the right order to clear a path and drive the red car out of the rush hour gridlock. Simple to learn, hard to master.

734 LEVELS ON A WORLD MAP
• From 6-move warm-ups to 63-move brain-burners
• 6×6, 7×7 and 8×8 grids
• Travel through 16 themed zones: downtown, harbor, forest road, desert highway, snowy peaks, city by night…
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
• 86 achievements
• Home screen widget: your streak and today's challenge at a glance

UNLOCK STYLES BY PLAYING
82 styles: hand-drawn board backgrounds, target car skins (taxi, golden car, schooner…), vehicle sets (speedboats and ferries, safari jeeps, bulldozers…) and win effects. All are unlocked with stars, levels, challenges and achievements. None of them are for sale.

HOLIDAYS OF THE YEAR
Halloween, Christmas, New Year, Valentine's Day, St. Patrick's Day, April Fools', Easter, Music Day, Bastille Day, summer holidays and back to school: win the Daily Challenge during a holiday to unlock its board, car, vehicles and win effect. Its board dresses the whole screen.

CREATE AND SHARE
Build your own puzzles in the level creator. The game checks that your level has a solution and counts its minimum moves. Share it with a QR code or a link: your friends open it straight in the app.

PLAY WITH FRIENDS (OPTIONAL)
Host a small multiplayer server (Docker) and invite your friends: a private daily challenge with rankings for the day, week and month, and live 1v1 duels. There is no central server: the app only connects to servers you join yourself.

FAIR AND RESPECTFUL
• No ads, no in-app purchases, no currency
• Works offline, no account needed
• No data collected by the developer
• Your progress follows you to a new Android phone with Google Play Games, or export your save to move it anywhere
• Light and dark mode
• Playable with TalkBack: every car is announced, moved without dragging, and every level can be won with 3 stars
• English, French and Serbian
```

### Release notes

See [`docs/RELEASE_NOTES_2.0.0.md`](../docs/RELEASE_NOTES_2.0.0.md).

---

## Français

### Nom de l'application (30 max)

```
Rush Hours
```

### Description courte (80 max)

```
Casse-tête d'embouteillage : libère la voiture rouge. 734 niveaux, sans pub
```
(75 caractères)

### Description complète (4000 max)

```
Fais glisser les voitures. Libère la rouge.

Rush Hours est un jeu de casse-tête d'embouteillage : un puzzle de blocs coulissants où voitures et camions n'avancent et ne reculent que dans leur voie. Trouve le bon ordre pour dégager le passage et faire sortir la voiture rouge du bouchon de l'heure de pointe. Facile à comprendre, difficile à maîtriser.

734 NIVEAUX SUR UNE CARTE DU MONDE
• De l'échauffement en 6 coups au casse-tête de 63 coups
• Grilles 6×6, 7×7 et 8×8
• Traverse 16 zones à thème : centre-ville, port, route forestière, route du désert, sommets enneigés, ville de nuit…
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
• 86 succès
• Widget d'écran d'accueil : ton streak et le défi du jour d'un coup d'œil

DÉBLOQUE DES STYLES EN JOUANT
82 styles : fonds de plateau dessinés, voitures à sortir (taxi, voiture dorée, goélette…), séries de véhicules (hors-bord et ferrys, jeeps de safari, bulldozers…) et effets de victoire. Tous se débloquent avec les étoiles, les niveaux, les défis et les succès. Aucun n'est à vendre.

LES FÊTES DE L'ANNÉE
Halloween, Noël, Nouvel An, Saint-Valentin, Saint-Patrick, Poisson d'avril, Pâques, Fête de la musique, 14 juillet, grands départs et rentrée : réussis le défi du jour pendant une fête pour débloquer son plateau, sa voiture, ses véhicules et son effet de victoire. Son plateau habille tout l'écran.

CRÉE ET PARTAGE
Construis tes propres puzzles dans le créateur de niveaux. Le jeu vérifie que ton niveau a une solution et calcule son minimum de coups. Partage-le par QR code ou par lien : tes amis l'ouvrent directement dans l'app.

JOUE ENTRE AMIS (OPTIONNEL)
Héberge un petit serveur multijoueur (Docker) et invite tes amis : un défi du jour privé avec classements du jour, de la semaine et du mois, et des duels 1v1 en direct. Il n'y a pas de serveur central : l'app ne se connecte qu'aux serveurs que tu rejoins toi-même.

UN JEU HONNÊTE
• Sans pub, sans achat intégré, sans monnaie
• Fonctionne hors ligne, sans compte
• Aucune donnée collectée par le développeur
• Ta progression te suit sur un nouveau téléphone Android avec Google Play Jeux, ou exporte ta sauvegarde pour l'emmener partout
• Mode clair et sombre
• Jouable avec TalkBack : chaque voiture est annoncée, se déplace sans glisser, et chaque niveau se gagne à 3 étoiles
• Français, anglais et serbe
```

### Notes de version

Voir [`docs/RELEASE_NOTES_2.0.0.md`](../docs/RELEASE_NOTES_2.0.0.md).

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
| Public cible | **Tous âges, enfants compris** (tranches choisies dans la Play Console, voir ci-dessous) : l'app entre alors dans le **programme Familles** de Google Play. La politique de confidentialité a une section enfants (section 7) |
| Sécurité des données | voir [`docs/PLAY_STORE.md`](../docs/PLAY_STORE.md) |
| Politique de confidentialité | lien vers [`Privacy_Policy.md`](../Privacy_Policy.md) sur GitHub |
| Site web | `https://github.com/ekomlenovic/rush_hour_ios_android` |

## Pourquoi ces textes

- **Nom** : « Rush Hours » seul, comme dans l'app. Les mots-clés (« traffic puzzle », « casse-tête ») sont dans les descriptions.
- **Mots-clés** : Google indexe le titre, la description courte et la description longue.
  - EN : « traffic jam puzzle », « sliding-block », « brain teaser », « rush hour », « gridlock », « daily challenge », « levels », « offline ».
  - FR : « casse-tête », « embouteillage », « puzzle », « blocs coulissants », « bouchon », « heure de pointe », « défi du jour », « hors ligne ».
  - Chacun une ou deux fois, sans bourrage (Google pénalise la répétition). La description courte commence par le genre (« Traffic jam puzzle », « Casse-tête d'embouteillage »), ce que les joueurs cherchent.
- **« Rush Hour » est une marque (ThinkFun)** : on ne l'emploie qu'au sens courant (« rush hour gridlock », l'heure de pointe), jamais comme le nom d'un autre jeu ni avec « officiel », « version de » ou « inspiré de ». Le nom de l'app reste « Rush Hours » seul.
- **Arguments vérifiables** : « no ads / no in-app purchases » (aucun SDK de pub ni de paiement dans `package.json`), « works offline » et « no data collected » (politique de confidentialité), cosmétiques jamais vendus (`docs/GAME_DESIGN.md`).
- **Multijoueur présenté tel qu'il est** : optionnel, il faut qu'un des joueurs héberge un serveur. Il n'est pas mis en avant comme un mode en ligne « ouvert », pour éviter les avis déçus.
- **Rien d'interdit par Google** : pas de « #1 », « best », « free » dans le titre, pas d'emoji dans le titre, pas de prix ni de promo sur les visuels.
