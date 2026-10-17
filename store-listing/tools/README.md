# Visuels de la fiche Play Store

Scripts qui refont toutes les images de `store-listing/` à partir de **vrais écrans de l'app** (version web, même code que l'app mobile), avec une sauvegarde de démo.

| Script | Rôle |
|---|---|
| `web-setup.sh` | installe ce qu'il faut pour la version web (sans toucher à `package.json`) |
| `seed.mjs` | sauvegarde de démo : ~2 mois de jeu, niveau joueur 7, 72 niveaux réussis, streak de 23 jours (dates relatives à aujourd'hui) |
| `solve.ts` | solution optimale d'un niveau de la campagne (le solveur de l'app), pour jouer la partie de la capture « victoire » |
| `capture.mjs` | captures brutes, pour chaque appareil (téléphone, tablette 7" et 10"), langue (EN, FR) et thème (clair, sombre) → `.raw/` (ignoré par git) |
| `render.mjs` + `frame.html` + `specs.json` | visuels finaux : titre + capture dans un cadre d'appareil → `../<langue>/{phone,tablet-7,tablet-10}/` |
| `feature.mjs` + `feature.html` | image de présentation 1024 × 500 et icône 512 × 512 |
| `browser.mjs` | lance Playwright / Chromium |

## Refaire les images

Il faut Node 22 et Playwright avec Chromium (`npm i -g playwright && npx playwright install chromium`, ou `PLAYWRIGHT_PATH` / `CHROMIUM_PATH` vers une installation existante).

```bash
store-listing/tools/web-setup.sh
CI=1 npx expo start --web --port 8081      # dans un autre terminal, laisser tourner

node store-listing/tools/capture.mjs        # ~10 min ; --only phone|tablet7|tablet10 pour un seul appareil
node store-listing/tools/render.mjs         # visuels finaux ; « render.mjs 03 » pour un seul
node store-listing/tools/feature.mjs        # feature graphic + icône
```

Regarder ensuite chaque image : un écran qui a changé de mise en page peut demander d'ajuster un script (voir plus bas).

## Modifier

- **Textes des visuels** : `specs.json`, une ligne par visuel : nom du fichier, titre (`<em>` = mot en jaune, `<br>` = retour à la ligne), sous-titre, capture(s) utilisée(s) (`langue-thème/écran`, deux séparées par `|` pour deux appareils côte à côte). Le titre rétrécit tout seul pour tenir sur 2 lignes.
- **Écrans capturés** : `SCREENS` dans `capture.mjs`. Les clics passent par les textes des fichiers de traduction (`locales/*.json`) et les libellés d'accessibilité, pas par des coordonnées : ils marchent sur toutes les tailles d'écran.
- **Progression montrée** : `seed.mjs`. Garder une progression qu'un vrai joueur peut atteindre.
- **Chiffres** (309 niveaux, 63 coups, 77 succès…) : ils sont écrits dans `specs.json` et dans `../LISTING.md`, à mettre à jour si la campagne ou les succès changent.
