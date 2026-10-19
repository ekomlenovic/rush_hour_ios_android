# Rush Hours 2.0.2 (versionCode 14)

Mise à jour de la **2.0.1 (versionCode 13)** : des niveaux difficiles moins bloquants, et des corrections.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Carte : les 2 niveaux après le prochain sont jouables, pour contourner un niveau difficile
• Les niveaux boss sont annoncés sur la carte et rapportent 50 XP de plus
• Nouvel effet de victoire « Feu vert », dès 3 niveaux réussis
• Garage et succès : chaque nouveauté garde sa pastille jusqu'à ce que tu la touches
Corrections :
• Le défi du jour se met à jour à minuit, même si l'app est restée ouverte
• Multijoueur : le nouveau défi s'affiche dès sa sortie, sans recharger
</fr-FR>
<en-US>
New:
• Map: the 2 levels after the next one are playable, to get around a hard level and come back to it
• Boss levels are shown on the map and give 50 extra XP
• New "Green light" win effect, after 3 levels won
• Garage and achievements: each new item keeps its badge until you tap it
Fixes:
• The daily challenge now updates at midnight, even if the app stayed open
• Multiplayer: the new challenge shows up as soon as it's out, no refresh needed
</en-US>
```

## Détail

- **3 niveaux jouables d'avance** sur la carte : le prochain et les 2 suivants. La campagne a des sauts de difficulté (niveaux 46-48, 101, 286-308) ; un joueur bloqué continue et revient plus tard.
- **Niveaux boss** : un niveau à 8 coups ou plus au-dessus de la médiane des 5 précédents (43 aujourd'hui). Badge sur la carte, « Niveau N · Boss » en titre, 50 XP de plus à la première victoire.
- **Nouveautés à acquitter** : dans le Garage, chaque cosmétique débloqué garde sa mention « Nouveau » jusqu'à ce qu'on le touche (avant, une simple visite effaçait tout) ; chaque onglet et le lien de l'accueil comptent les nouveautés. Dans le profil, chaque succès débloqué a une pastille bleue jusqu'à ce qu'on le touche, sa catégorie s'ouvre et compte ses nouveautés, le bouton profil de l'accueil les compte aussi.
- **Effet de victoire « Feu vert »** : trois feux tricolores passent au rouge, à l'orange puis au vert. Débloqué après 3 niveaux de la carte réussis, pour découvrir le Garage dès la première partie.

- L'accueil restait sur la veille si l'app était ouverte (ou en arrière-plan) au passage de minuit : défi du jour affiché comme gagné, missions et compte à rebours de la veille, défi hebdo de la semaine passée le lundi. L'accueil suit maintenant l'horloge (chaque minute et au retour au premier plan), et la série et les gels sont réglés au changement de jour comme à une ouverture de l'app.
- Multijoueur : le défi du jour n'était rechargé qu'à l'ouverture de l'écran ou en tirant pour rafraîchir ; à la sortie du suivant, le compte à rebours restait sur « < 1 min ». Il est maintenant rechargé à l'heure de sortie (heure du serveur) et au retour au premier plan.

## Données des joueurs

Le calcul de l'XP change (bonus des boss) : `STORE_VERSION` passe à **9**, l'étape v9 de `migrateState` crédite 50 XP par boss déjà gagné. Rien n'est retiré, `maxUnlockedLevel` garde son sens, les anciennes sauvegardes s'importent toujours (le plafond d'XP de l'import compte le bonus). `STORE_VERSION` passe ensuite à **10** : nouveau champ `seenAchievements`, rempli par l'étape v10 avec les succès déjà débloqués (pas de pastille sur des dizaines de succès anciens). Le nouvel effet est un identifiant de cosmétique ajouté, débloqué à partir de la progression : pas de migration pour lui.
