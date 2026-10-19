# Rush Hours 2.0.0 (versionCode 12)

Notes de version depuis la **1.1.4 (versionCode 6)**, dernière version déployée à 100 % sur le Play Store. Elles couvrent aussi les 1.1.5 à 1.1.8, jamais sorties en production.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
La plus grosse mise à jour de Rush Hours !
• Multijoueur : duels 1v1 en direct, mode spectateur, défis classés sur des serveurs entre amis
• 49 nouveaux niveaux et une carte du monde redessinée
• Défi hebdo, archives du défi du jour, missions quotidiennes
• Niveau joueur, XP, skins et 24 nouveaux succès
• Gels de streak, rappels, partage des résultats
• Revoir la solution optimale
• Mes niveaux : partage par QR code
• Sauvegarde exportable
• Accueil et profil repensés, jouable avec TalkBack
</fr-FR>
<en-US>
The biggest Rush Hours update yet!
• Multiplayer: live 1v1 duels, spectator mode, ranked challenges on servers with your friends
• 49 new levels and a redesigned world map
• Weekly challenge, daily challenge archive, daily missions
• Player level, XP, skins and 24 new achievements
• Streak freezes, reminders, shareable results
• Replay the optimal solution
• My levels: share with a QR code
• Exportable save
• New home and profile screens, playable with TalkBack
</en-US>
```

## Détail des nouveautés

### Multijoueur (nouveau)
- Serveurs communautaires : on rejoint le serveur d'un ami (ou on héberge le sien avec Docker, guide « Créer mon serveur » dans l'app). Rien ne passe par le développeur.
- Défi du jour et défi hebdo classés par serveur, onglets Défi / Hebdo / Duels.
- Duels 1v1 en temps réel sur le même puzzle : victoire au temps ou au nombre de coups, au choix à la création ; duels privés par code.
- Mode spectateur : suivre un duel en direct, les deux plateaux.
- Catalogue de puzzles de duel (variantes des niveaux difficiles de la campagne), historique et replays des parties.
- Anti-triche (vérification des coups côté serveur), signaler et bloquer un joueur, panneau admin (modération, heure de sortie du défi, nom du serveur…).
- Suppression du compte dans l'app et sur le web.

### Contenu et progression
- 49 nouveaux niveaux (256 à 304) et une montée de difficulté plus douce au début de la campagne.
- Carte du monde redessinée : route sinueuse, jetons de niveau en 3D, zones à thème.
- Défi hebdomadaire (rejouable), archives des défis du jour.
- Missions quotidiennes avec récompenses d'XP.
- Niveau joueur, XP et cosmétiques à débloquer dans le Garage (skins de voitures).
- 24 nouveaux succès dont 11 secrets, paliers de coups minimum et de streak.
- Gels de streak pour protéger sa série.
- Étoiles plus justes, proportionnelles à la solution optimale du niveau.

### Jeu
- Revoir la solution optimale après une victoire, vitesse ×1 / ×2 / ×4.
- Revoir sa propre solution d'un défi réussi.
- Partage du résultat du défi façon Wordle.
- Rappels locaux facultatifs (défi du jour, streak en danger, défi hebdo).
- Accessibilité : jouable avec TalkBack et VoiceOver.

### Mes niveaux et sauvegarde
- Écran « Mes niveaux » refondu : nom facultatif, partage unifié, QR code généré sur le téléphone, bouton Coller.
- Export et import de toute la progression dans un fichier `.rushsave` (archives comprises), sans serveur.

### Interface
- Nouvel écran d'accueil (hiérarchie claire, compteurs en en-tête, barre du bas), profil repensé (anneau d'XP, meilleur streak, calendrier unique streak + archives).
- Icônes unifiées (Ionicons) à la place des emojis, statistiques détaillées.
- Un seul panneau d'options pour l'accueil et la carte.

### Corrections
- La musique de fond ne démarrait jamais.
- Retours haptiques Android plus nets (haptique système).
- Véhicules coupés sur les bords droit et bas du plateau.
- Clavier qui masquait les champs sur Android.
- Clés de traduction brutes affichées au démarrage.
- Le défi du jour ne reprend plus la sauvegarde d'un autre puzzle.
- Compatibilité Android 15 / 16.
