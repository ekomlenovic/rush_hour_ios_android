# Rush Hours 2.0.2 (versionCode 14)

Version corrective de la **2.0.1 (versionCode 13)**.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Corrections :
• Le défi du jour se met à jour à minuit, même si l'app est restée ouverte
• Multijoueur : le nouveau défi s'affiche dès sa sortie, sans recharger
</fr-FR>
<en-US>
Fixes:
• The daily challenge now updates at midnight, even if the app stayed open
• Multiplayer: the new challenge shows up as soon as it's out, no refresh needed
</en-US>
```

## Détail

- L'accueil restait sur la veille si l'app était ouverte (ou en arrière-plan) au passage de minuit : défi du jour affiché comme gagné, missions et compte à rebours de la veille, défi hebdo de la semaine passée le lundi. L'accueil suit maintenant l'horloge (chaque minute et au retour au premier plan), et la série et les gels sont réglés au changement de jour comme à une ouverture de l'app.
- Multijoueur : le défi du jour n'était rechargé qu'à l'ouverture de l'écran ou en tirant pour rafraîchir ; à la sortie du suivant, le compte à rebours restait sur « < 1 min ». Il est maintenant rechargé à l'heure de sortie (heure du serveur) et au retour au premier plan.

## Données des joueurs

Aucune donnée persistée touchée : pas de migration (`STORE_VERSION` inchangé).
