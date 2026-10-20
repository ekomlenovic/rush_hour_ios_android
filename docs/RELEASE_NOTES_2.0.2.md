# Rush Hours 2.0.2 (versionCode 14)

Mise à jour de la **2.0.1 (versionCode 13)** : des niveaux difficiles moins bloquants, les événements Halloween et Noël, et des corrections.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Halloween et Noël : réussis le défi du jour de l'événement pour gagner un plateau et un effet
• Carte : les 2 niveaux après le prochain sont jouables
• Niveaux boss annoncés sur la carte, avec 50 XP de plus
• Nouvel effet « Feu vert », dès 3 niveaux réussis
• Garage et succès : chaque nouveauté garde sa pastille jusqu'à ce que tu la touches
Corrections :
• Le défi du jour change à minuit, même si l'app est restée ouverte
• Multijoueur : le nouveau défi s'affiche dès sa sortie
</fr-FR>
<en-US>
New:
• Halloween and Christmas: win the daily challenge during the event to get a board and a win effect
• Map: the 2 levels after the next one are playable
• Boss levels are shown on the map and give 50 extra XP
• New "Green light" win effect, after 3 levels won
• Garage and achievements: each new item keeps its badge until you tap it
Fixes:
• The daily challenge now updates at midnight, even if the app stayed open
• Multiplayer: the new challenge shows up as soon as it's out
</en-US>
```

## Détail

- **3 niveaux jouables d'avance** sur la carte : le prochain et les 2 suivants. La campagne a des sauts de difficulté (niveaux 46-48, 101, 286-308) ; un joueur bloqué continue et revient plus tard.
- **Niveaux boss** : un niveau à 8 coups ou plus au-dessus de la médiane des 5 précédents (43 aujourd'hui). Badge sur la carte, « Niveau N · Boss » en titre, 50 XP de plus à la première victoire.
- **Nouveautés à acquitter** : dans le Garage, chaque cosmétique débloqué garde sa mention « Nouveau » jusqu'à ce qu'on le touche (avant, une simple visite effaçait tout) ; chaque onglet et le lien de l'accueil comptent les nouveautés. Dans le profil, chaque succès débloqué a une pastille bleue jusqu'à ce qu'on le touche, sa catégorie s'ouvre et compte ses nouveautés, le bouton profil de l'accueil les compte aussi.
- **Événements Halloween et Noël** : un défi du jour réussi du **25 au 31 octobre** débloque le plateau **Citrouilles** et l'effet de victoire **Chauves-souris** (une citrouille s'allume en bas de l'écran, une nuée de chauves-souris en sort et s'envole) ; du **19 au 25 décembre**, le plateau **Noël** et l'effet **Pluie de cadeaux** (des paquets tombent en tournoyant et rebondissent en bas, avec des étincelles). C'est gagné pour de bon, et l'événement revient chaque année pour ceux qui l'ont manqué. Pendant l'événement, la carte du défi du jour sur l'accueil annonce ce qu'il reste à débloquer. Une archive d'un jour de l'événement, jouée plus tard, ne compte pas.
- **Effet de victoire « Feu vert »** : trois feux tricolores passent de l'orange au vert dès la victoire, avec des étincelles. Débloqué après 3 niveaux de la carte réussis, pour découvrir le Garage dès la première partie.

- L'accueil restait sur la veille si l'app était ouverte (ou en arrière-plan) au passage de minuit : défi du jour affiché comme gagné, missions et compte à rebours de la veille, défi hebdo de la semaine passée le lundi. L'accueil suit maintenant l'horloge (chaque minute et au retour au premier plan), et la série et les gels sont réglés au changement de jour comme à une ouverture de l'app.
- Multijoueur : le défi du jour n'était rechargé qu'à l'ouverture de l'écran ou en tirant pour rafraîchir ; à la sortie du suivant, le compte à rebours restait sur « < 1 min ». Il est maintenant rechargé à l'heure de sortie (heure du serveur) et au retour au premier plan.

## Données des joueurs

Le calcul de l'XP change (bonus des boss) : `STORE_VERSION` passe à **9**, l'étape v9 de `migrateState` crédite 50 XP par boss déjà gagné. Rien n'est retiré, `maxUnlockedLevel` garde son sens, les anciennes sauvegardes s'importent toujours (le plafond d'XP de l'import compte le bonus). `STORE_VERSION` passe ensuite à **10** : nouveau champ `seenAchievements`, rempli par l'étape v10 avec les succès déjà débloqués (pas de pastille sur des dizaines de succès anciens). Le nouvel effet est un identifiant de cosmétique ajouté, débloqué à partir de la progression : pas de migration pour lui. Même chose pour les cosmétiques d'Halloween et de Noël (`board:pumpkin`, `effect:bats`, `board:christmas`, `effect:gifts`) : ils sont calculés à partir des dates des défis du jour déjà réussis (`dailyChallengeProgress`), rien de nouveau n'est sauvegardé.
