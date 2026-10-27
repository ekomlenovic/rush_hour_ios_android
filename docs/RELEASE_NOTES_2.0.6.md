# Rush Hours 2.0.6 (versionCode 21)

Mise à jour de la **2.0.5 (versionCode 20)** : la version web (PWA) sur GitHub Pages pour jouer directement dans le navigateur, le multijoueur sur le web, et plusieurs améliorations.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Joue aussi directement dans ton navigateur sur la version web (PWA)
• Partage des liens de niveau et d'invitation multijoueur compatibles web et app
• Corrections et améliorations
</fr-FR>
<en-US>
New:
• Play directly in your browser on the web version (PWA)
• Share level and multiplayer invite links that work in both web and app
• Fixes and improvements
</en-US>
```

## Détail

### Nouveautés

- **Version web (PWA)** : le même jeu accessible directement dans n'importe quel navigateur sur GitHub Pages (<https://ekomlenovic.github.io/rush_hour_ios_android/>), sur téléphone, tablette ou ordinateur. Il peut s'ajouter à l'écran d'accueil (PWA) et fonctionne hors-ligne grâce à un service worker.
- **Multijoueur sur le web** : rejoins et joue sur les mêmes serveurs multijoueur directement depuis le navigateur. Les liens d'invitation et de récupération au format web (`https://…/multi/join?…`) s'ouvrent aussi bien dans l'app que dans le navigateur.
- **Solveur dans un Web Worker** : sur le web, la résolution des niveaux (défi du jour, indices, solution) tourne dans un worker dédié en arrière-plan pour ne jamais figer la page.
- **Ergonomie web** :
  - Sur grand écran (ordinateur, tablette), le jeu reste au format téléphone dans une colonne centrée (480 px max) avec fond assorti au thème.
  - La touche **Échap** sert de bouton retour (ferme les fenêtres/panneaux ouverts, puis revient à l'écran précédent).
  - Boîte à outils du créateur adaptée au pointeur de souris et aux écrans tactiles sur le web.
  - La musique attend le premier toucher pour démarrer (règle des navigateurs) et se mélange aux autres sons (session audio `ambient` sur Safari).
  - Alertes dessinées par l'app, partage via la feuille native du navigateur ou copie du texte, et import/export de sauvegarde par fichier.

### Correctifs

- **Sources de mise à jour** : nom de développeur harmonisé sur « Imelein » dans les sources Android et SideStore, et liens vers le code source GitHub corrigés dans SideStore.
- **iPhone (PWA)** : barre d'état `default` pour éviter le décalage sous l'heure sur iOS.
- **README** : ajout des captures d'écran du jeu.

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé, serveur sans nouvelle étape : aucune donnée des joueurs touchée.
