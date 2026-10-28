# Rush Hours 2.0.7 (versionCode 22)

Mise à jour de la **2.0.6 (versionCode 21)** : deux corrections d'affichage, dans le duel multijoueur et dans le créateur de niveaux.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Corrections :
• Duel : ton plateau ne descend plus jusqu'au bas de l'écran
• Créateur de niveaux : les véhicules de la boîte à outils s'affichent de nouveau en entier, avec leur nom
</fr-FR>
<en-US>
Fixes:
• Duel: your board no longer reaches the bottom of the screen
• Level creator: the toolbox vehicles show in full again, with their names
</en-US>
```

## Détail

### Correctifs

- **Duel** : sur le web, la zone de sécurité du bas peut valoir 0 et mon plateau allait jusqu'au bas de l'écran, sous la barre d'accueil de l'iPhone. Il garde maintenant un espace minimum sous lui, et l'estimation de la hauteur des barres des joueurs et du chrono est corrigée. Les plateaux gardent leur taille toute la partie.
- **Créateur de niveaux** : les cartes de la boîte « Véhicules » étaient écrasées depuis la 2.0.6. Les véhicules verticaux débordaient et les noms n'apparaissaient plus. Les cartes retrouvent leur hauteur.

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé, serveur sans nouvelle étape : aucune donnée des joueurs touchée.
