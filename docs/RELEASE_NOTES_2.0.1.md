# Rush Hours 2.0.1 (versionCode 13)

Version corrective de la **2.0.0 (versionCode 12)**.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Correctif important de la sauvegarde :
• Ta progression ne peut plus être effacée au lancement de l'app
• La sauvegarde reste légère, même après beaucoup de parties
• Si la sauvegarde ne peut pas être lue, le jeu te prévient au lieu de repartir de zéro
</fr-FR>
<en-US>
Important save fix:
• Your progress can no longer be wiped when the app starts
• Your save stays small, even after many games
• If your save can't be read, the game now warns you instead of starting over
</en-US>
```

## Détail

- Une écriture faite avant la fin du chargement de la sauvegarde (ouverture de l'accueil, lien) ou après une lecture ratée pouvait remplacer la progression par un état vide. Les écritures sont désormais retenues tant que la sauvegarde n'a pas été relue, pour le jeu comme pour les comptes multijoueur.
- La sauvegarde pouvait grossir jusqu'à dépasser ce qu'Android sait relire (2 Mo). Une partie en cours ne garde plus que les 50 derniers coups d'annulation, et les parties de défis passés sont compactées.

## Données des joueurs

Migration v6 (`STORE_VERSION` 5 → 6) : piles d'annulation ramenées aux 50 derniers coups, défi du jour passé en cours déplacé vers son archive, parties de défis devenus inaccessibles oubliées. Progression, étoiles, XP, streak et succès inchangés. Testé sur une vraie sauvegarde 2.0.0 (`__tests__/upgrade.test.ts`).
