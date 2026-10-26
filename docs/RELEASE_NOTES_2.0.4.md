# Rush Hours 2.0.4 (versionCode 18)

Mise à jour de la **2.0.3 (versionCode 16)** : un widget d'écran d'accueil, les réactions des spectateurs en duel, le scan de QR codes, une musique qui se mélange à la tienne, le serbe, plus de fluidité sur Android, et beaucoup de correctifs.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Widget d'écran d'accueil : ton streak, tes gels et le défi du jour
• En duel, les spectateurs réagissent et encouragent les joueurs
• Scanne un QR code pour rejoindre un serveur ou importer un niveau
• La musique du jeu ne coupe plus ta musique ni tes podcasts
• Carte, garage et effets de victoire plus fluides sur Android
• Nouvelle langue : serbe
• Un défi du jour resté ouvert après minuit ne fait plus perdre ton streak
• Corrections et améliorations
</fr-FR>
<en-US>
New:
• Home screen widget: your streak, freezes and the daily challenge
• In duels, spectators can react and cheer the players on
• Scan a QR code to join a server or import a level
• The game music no longer stops your music or podcasts
• Smoother map, garage and win effects on Android
• New language: Serbian
• A daily challenge left open past midnight no longer breaks your streak
• Fixes and improvements
</en-US>
```

## Détail

### Nouveautés

- **Widget d'écran d'accueil** (Android et iOS) : le streak, les gels et l'état du défi du jour sans ouvrir l'app. Le moyen (4×2) ajoute le compte à rebours jusqu'au prochain défi ou « Streak en danger » le soir. Il repasse à « À faire » à minuit tout seul.
- **Réactions des spectateurs en duel** : un spectateur choisit un joueur et lui envoie un emoji (pour le taquiner ou l'applaudir) ou un encouragement ; tout le monde le voit 3 s sur le plateau visé, avec le pseudo de qui l'envoie. Liste fermée, sans texte libre. 3 réactions d'affilée, puis une courte pause ; un toucher ailleurs ferme la rangée sans perdre le coup joué.
- **Scanner un QR code** dans l'app : « Rejoindre un serveur » remplit le formulaire depuis un QR code d'invitation ou de récupération, et Mes niveaux → Importés importe un niveau partagé (même vérification qu'un lien collé). Nouvelle permission caméra, sans micro.
- **Rappels** : toucher une notification ouvre le défi du jour, le défi de la semaine ou le récap annoncé.
- **Défi du jour au nombre de coups exact** : l'admin d'un serveur peut choisir, pour chaque jour de la semaine, le nombre minimum de coups exact du défi (« Auto » garde l'optimum habituel).
- **Serbe** (alphabet latin).

### Correctifs

- **Fluidité sur Android** : les animations d'opacité et de déplacement (particules et halos de la victoire) sont appliquées directement aux vues au lieu de recalculer tout l'écran à chaque image. La carte se dessine une fois le glissement depuis l'accueil terminé, en un seul fondu ; l'indicateur de chargement n'apparaît que si elle est lente à dessiner. Le garage défile sans à-coups : les onglets restent en haut sans redessiner la liste, et choisir un style ne redessine plus toutes les vignettes.
- **Navigation** : un bouton touché deux fois (garage, profil, menus) n'ouvre plus son écran en double ; un retour répété est ignoré de même.
- **Indicateur de chargement** commun à toute l'app : il n'apparaît qu'après 150 ms (rien pour un chargement rapide) et le lecteur d'écran annonce « Chargement ».
- **Audio** : la musique du jeu se mélange à l'audio du téléphone au lieu de le couper, et se tait en mode silencieux. Plus de boucle de 50 ms en arrière-plan.
- **Streak** : un défi du jour resté ouvert après minuit ne fait plus perdre le streak (ni consommer un gel) ; deux jours consécutifs bien comptés en Nouvelle-Zélande au changement d'heure.
- **Sauvegarde** : une alerte prévient quand la sauvegarde ne peut plus être écrite (stockage plein), et la réécrit au retour dans l'app.
- **Duel** : plateau figé pendant la reconnexion (plus de coups perdus) ; un duel ou un salon disparu hors connexion est annoncé au lieu d'un chargement infini.
- **Carte** : estimation du temps de génération selon la grille, apprise sur le téléphone, avec confirmation avant une génération longue ; choix 1, 3 ou 10 niveaux ; un lien vers un niveau inexistant ne génère plus rien.
- **Créateur** : quitter sans sauver ne relance plus l'alerte en boucle (même correctif en duel) ; un niveau déjà résolu est refusé ; « Tester » et « Sauver » sont indisponibles pendant la vérification.
- **Accueil** : le sous-titre du défi saisonnier tient sur la carte en français.
- **Récap** : chaque style débloqué compté une seule fois ; consulter la période en cours ne masque plus son annonce.
- **Indice** : surlignage fixe avec « Réduire les animations » ; contrastes des textes d'avertissement relevés.
- **Android** : la barre d'état suit le thème de l'app ; permissions inutilisées retirées (micro, superposition, stockage, service média).
- **Serveur** : pseudos invisibles ou imitant un autre joueur refusés.
- Passage à Expo SDK 58 (React Native 0.88).

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé (le nouveau drapeau `writeFailed` n'est pas sauvegardé) : aucune donnée de l'app touchée.
- Serveur : nouvelle étape à la fin de `server/src/db.ts` (`challenges.wanted_moves`, nullable). Les défis existants restent à `NULL` (optimum habituel) : rien n'est régénéré ni perdu.
- Le serveur doit être mis à jour pour les réactions des spectateurs et le nombre de coups exact ; l'app ne propose que les réactions annoncées par le serveur.
