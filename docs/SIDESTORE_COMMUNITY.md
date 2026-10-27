# Soumettre Rush Hours à la Community Source de SideStore

La [Community Source](https://github.com/SideStore/Community-Source) (`https://community-apps.sidestore.io/sidecommunity.json`) reprend des apps depuis leur propre source : son `update.py` relit notre `sidestore-source.json` toutes les 30 minutes (parser `ALTSOURCE`). Il suffit donc d'une PR qui ajoute notre source à sa liste.

## Ce que demandent leurs règles, et où c'est fait ici

| Règle de la Community Source | Rush Hours |
|---|---|
| 1. L'app marche et sa version change dans l'app | La version d'`app.json` / `package.json` est vérifiée avant chaque build (`cli.ts check`) ; `CFBundleVersion` = numéro du run = `buildVersion` |
| 2. Entrée JSON bien formée, sur son propre hébergement | `sidestore-source.json` (AltStore 2.0), icône, captures et IPA dans ce dépôt et ses releases |
| 3, 5, 8, 11. Contenu correct, pas piraté, pas malveillant, pas une copie | Jeu de réflexion original, open source (licence dans `LICENSE`) |
| 4. Icône et captures de l'appareil | `store-listing/icon-512.png`, `store-listing/en/phone/` (iPhone) et `store-listing/en/tablet-10/` (iPad) |
| 6. Prévenir des risques | Rien de risqué : pas de JIT, pas d'accès aux fichiers hors de l'app |
| 7. Entitlements et permissions | `appPermissions` : App Group (widget), caméra (scan de QR codes), réseau local (serveur multijoueur sur le réseau local). Pas de JIT |
| 9. Publicité | Aucune publicité, aucun achat |
| 10. Catégorie | `games` |
| 12. Vie privée | Aucune donnée collectée (`Privacy_Policy.md`) |
| 14. Hash des téléchargements | `sha256` dans chaque version de la source, MD5 et SHA-256 dans chaque release |
| 15. Releases GitHub avec la version dans le titre | `Rush Hours v2.0.5 (Build N)`, tag `v2.0.5-bN` |

## Avant d'ouvrir la PR

1. Lancer `build.yml` sur `main` pour publier une release avec un vrai numéro de build dans l'IPA (les releases jusqu'à la 2.0.4 ont `CFBundleVersion` = 1).
2. Ajouter la source dans SideStore et installer l'app depuis elle, une fois : pas d'erreur de version ni de permissions.

## La PR vers SideStore/Community-Source

Dans `update.py`, ajouter à la fin de `sourcesData` :

```python
    {
        "parser": Parser.ALTSOURCE,
        "kwargs": {"filepath": "https://raw.githubusercontent.com/ekomlenovic/rush_hour_ios_android/refs/heads/main/sidestore-source.json"},
        "ids": ["com.rushhours.app"],
        "getAllNews": True
    }
```

Selon leur `sidecommunity.json`, l'app peut aussi devoir y être ajoutée une première fois (copier l'entrée de `apps` de notre source) : regarder comment les dernières PR acceptées l'ont fait.

Description de la PR (en anglais, règle 16) :

```markdown
## Add Rush Hours

**Rush Hours** is a free and open-source sliding-block traffic puzzle (the classic "Rush Hour" game): slide the cars and trucks along their lanes to free the red car. I am its developer: https://github.com/ekomlenovic/rush_hour_ios_android

### What it does
- 300+ campaign levels on a world map (6×6 to 8×8 grids), plus levels generated on the device
- A daily challenge and a weekly challenge, a streak with a calendar, missions and achievements
- A level creator with QR code / link sharing
- Optional multiplayer (private daily challenge and 1v1 duels) on a small server the players host themselves: there is no central server
- A home screen widget (streak and daily challenge)
- English, French and Serbian, light and dark mode, VoiceOver support

### Goals
A complete, fair puzzle game: no ads, no in-app purchases, no account, no tracking, playable offline. Rush Hours is not on the App Store, so SideStore is its iOS distribution channel.

### Source entry
- Source: https://raw.githubusercontent.com/ekomlenovic/rush_hour_ios_android/refs/heads/main/sidestore-source.json (AltStore 2.0 format, category `games`)
- IPAs are built by GitHub Actions and published in the repository releases ("Rush Hours vX.Y.Z (Build N)"), with their MD5 / SHA-256; each version in the source has its size and sha256
- Icon and iPhone / iPad screenshots are hosted in the repository
- Permissions: `com.apple.security.application-groups` (shares the streak with the widget), camera (QR code scanner, optional), local network (multiplayer server on the local network, optional). No JIT, no ads
- Privacy policy: https://github.com/ekomlenovic/rush_hour_ios_android/blob/main/Privacy_Policy.md
```
