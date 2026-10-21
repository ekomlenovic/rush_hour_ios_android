# Rush Hours 2.0.2 (versionCode 14)

Mise à jour de la **2.0.1 (versionCode 13)** : une campagne de 734 niveaux, les récaps du mois et de l'année, un onglet Hebdo revu, de nouveaux styles, les événements Halloween et Noël, et beaucoup de corrections.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• 734 niveaux, 8 nouvelles zones et de nouveaux succès
• Halloween et Noël : gagne un plateau et un effet avec le défi du jour
• Récap du mois et de l'année, à partager
• Hebdo revu : classements des semaines et mois passés
• Carte : 3 niveaux jouables d'avance, niveaux boss
• Nouveaux styles, bouton « Niveau suivant »
Corrections :
• Le défi du jour change à minuit, même app ouverte
• Sauvegarde plus légère et plus sûre
• Nombreuses corrections d'affichage
</fr-FR>
<en-US>
New:
• 734 levels, 8 new zones and new achievements
• Halloween and Christmas: win a board and an effect with the daily challenge
• Monthly and yearly recap, to share
• Weekly tab revamped: rankings of past weeks and months
• Map: 3 levels playable ahead, boss levels
• New styles, "Next level" button
Fixes:
• The daily challenge updates at midnight, even with the app open
• Lighter, safer save
• Many display fixes
</en-US>
```

## Détail

### Contenu

- **Campagne de 734 niveaux** (309 avant) : niveaux 310 à 734 en deux lots, avec une courbe de difficulté par zone de 20 niveaux (respiration, rampe, boss en dernier). **8 nouveaux thèmes de zones** (bord de mer, ferme, jungle, volcan, lac, aéroport, fête foraine, base spatiale) ; les 16 premières zones gardent leurs thèmes.
- **Nouveaux succès** : 700 niveaux, 250 et 500 victoires parfaites, 50 et 100 optimums en difficile, série « zone parfaite » (1, 10, 25 zones à 3 étoiles partout).
- **3 niveaux jouables d'avance** sur la carte : le prochain et les 2 suivants. Un joueur bloqué continue et revient plus tard.
- **Niveaux boss** : un niveau à 8 coups ou plus au-dessus de la médiane des 5 précédents. Badge sur la carte, « Niveau N · Boss » en titre, 50 XP de plus à la première victoire.
- **Récap « Wrapped » mensuel et annuel** : cartes à faire défiler (niveaux, temps, défis, exploits, succès et styles, comparaison avec la période d'avant), annoncé sur l'accueil en début de mois et à la fin de l'année, récaps passés dans Profil → Mes récaps. Partage en image 9:16 dessinée sur le téléphone ou en texte.
- **Événements Halloween et Noël** : un défi du jour réussi du **25 au 31 octobre** débloque le plateau **Citrouilles** et l'effet de victoire **Chauves-souris** ; du **19 au 25 décembre**, le plateau **Noël** et l'effet **Pluie de cadeaux**. C'est gagné pour de bon, et l'événement revient chaque année. Une archive d'un jour de l'événement, jouée plus tard, ne compte pas.
- **Nouveaux styles** : effet « Feu vert » (dès 3 niveaux réussis) ; skin « Goélette amirale », palette « Flotte de 1800 » et effet « Bordée » (30 défis hebdo) ; un style secret à trouver. Toutes les voitures cibles du Garage sont dessinées en pseudo-3D.
- **Multijoueur, onglet Hebdo** : une carte par classement, semaine / mois / dates choisies (et depuis toujours pour les duels), périodes passées navigables jusqu'à 3 ans, médailles et « Ta place » sur une période terminée, semaine des défis jour par jour, bandeau « Semaine dernière terminée ».

### Confort

- Écran de victoire : bouton **« Niveau suivant »**, « Parfait ! » au minimum de coups, styles débloqués annoncés et équipables sur place, XP plus claire.
- Garage et succès : chaque nouveauté garde sa pastille jusqu'à ce qu'on la touche ; le détail d'un succès s'ouvre dans un panneau en bas de l'écran.
- En-tête commun pour Profil, Récaps, Progression, Garage et Mes niveaux.
- Carte : confirmation avant une génération Expert ou Maître et avant de supprimer des niveaux générés, durée de génération en minutes et heures, « Fin de la carte » après le dernier niveau.

### Corrections

- L'accueil restait sur la veille si l'app était ouverte au passage de minuit (défi, missions, défi hebdo). Il suit maintenant l'horloge.
- Multijoueur : le défi suivant est chargé dès sa sortie ; une victoire non reçue par le serveur est renvoyée au lieu d'être perdue ; le jeton et le code de récupération sont rangés dans le stockage sécurisé du téléphone.
- Sauvegarde : écritures regroupées, carte infinie et archives dans leur propre entrée, piles d'annulation compactes (150 coups pour les 10 dernières parties), pour rester sous la limite d'Android. Import plus tolérant (parties ou statistiques mal formées, un jour d'avance pour un autre fuseau).
- Un lien ne peut plus ouvrir le défi du jour d'une autre date ; les niveaux générés sont numérotés sans trou.
- Solveur 5 à 8× plus rapide, hors du thread d'affichage, borné pour les niveaux reçus par lien (un lien forgé figeait l'app).
- Deux véhicules glissés en même temps ne se chevauchent plus ; boutons qui débordaient, indice périmé, retour.
- Tutoriel : « Passer » ne fait plus tourner en rond un nouveau joueur ; « Jouer » mène au prochain niveau une fois le dernier réussi.
- Créateur : skins et palettes équipés, pivot de la voiture cible, taille de grille, « Annuler » en quittant.

## Données des joueurs

Toutes les étapes convertissent, aucune ne retire de progression ; les anciennes sauvegardes s'importent toujours (`__tests__/saveTransfer.test.ts`).

- `STORE_VERSION` **6 → 12** (`store/migrations.ts`) :
  - **v7** : les victoires de défis d'un jour ou d'une semaine à venir (ouverts par un lien) sortent des défis, leur XP reste, la série est recalculée sur les vrais jours.
  - **v8** : les niveaux générés sont renumérotés sans trou juste après le pack.
  - **v9** : 50 XP crédités par boss déjà gagné.
  - **v10** : `seenAchievements` rempli avec les succès déjà débloqués (pas de pastille sur les anciens).
  - **v11** : seules les 10 dernières parties en cours gardent leur pile d'annulation, en forme compacte ; les autres gardent leur partie.
  - **v12** : compteurs des récaps (`monthlyStats`, `yearlyStats`) reconstruits à partir des défis datés.
- Store multijoueur `version` **1 → 2** : jeton et code de récupération déplacés dans SecureStore à la première écriture.
- Serveur : nouvelle étape de `server/src/db.ts` (`challenges.variant_of`, `challenges.generation_ms`, nullables).
- Nouveaux identifiants de cosmétiques et de succès seulement ajoutés ; leurs règles de déblocage sont calculées à partir de la progression existante (pas de migration). Nouveau champ `stats.secretCodes`, avec sa valeur par défaut fusionnée au chargement et à l'import.
