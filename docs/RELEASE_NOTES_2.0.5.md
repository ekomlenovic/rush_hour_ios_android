# Rush Hours 2.0.5 (versionCode 20)

Mise à jour de la **2.0.4 (versionCode 19)** : un bouton pour soutenir le jeu par un don (hors Google Play) et des dépendances mises à jour.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »). Le bouton de don n'existe pas dans le build Play : ne pas le mentionner.

```
<fr-FR>
• Corrections et améliorations
</fr-FR>
<en-US>
• Fixes and improvements
</en-US>
```

## Détail

### Nouveautés

- **Soutenir le jeu** : une ligne « Soutenir le jeu » en 2e position des options, sous « Comment jouer ? », avec un bouton « Faire un don » qui ouvre la page Ko-fi (don sans créer de compte : carte, PayPal, Apple Pay ou Google Pay). **Seulement hors Google Play** : build iOS (SideStore) et APK des releases GitHub (`EXPO_PUBLIC_DONATION_LINK=1` dans `build.yml`). Le README et le bouton « Sponsor » du dépôt renvoient aussi vers Ko-fi et GitHub Sponsors.

### Correctifs

- **Dépendances** : alertes Dependabot corrigées (`@xmldom/xmldom`, `uuid`, `fast-uri` côté serveur, `rand` du générateur de niveaux difficiles).

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé, serveur sans nouvelle étape : aucune donnée des joueurs touchée.
