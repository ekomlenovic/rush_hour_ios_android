# Rush Hours 2.1.0 (versionCode 23)

Mise à jour de la **2.0.7 (versionCode 22)** : les fêtes de l'année arrivent dans le Garage, tous les styles sont dessinés, la demande de note arrive sur le Play Store, et une longue série de corrections (accessibilité, sauvegarde, streak, multijoueur).

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »).

```
<fr-FR>
Nouveautés :
• Garage : 11 fêtes de l'année (Halloween, Noël, Nouvel An, Pâques…), chacune avec son plateau, sa voiture, ses couleurs et son effet, à gagner au défi du jour
• Fonds d'écran et véhicules dessinés pour les styles du Garage
• La voiture à sortir regarde toujours vers la sortie
• Plus simple avec TalkBack et en grande police
• Corrections : sauvegarde, streak, multijoueur
</fr-FR>
<en-US>
New:
• Garage: 11 holidays of the year (Halloween, Christmas, New Year, Easter…), each with its own board, car, colors and effect, won in the Daily Challenge
• Drawn backgrounds and vehicles for the Garage styles
• The car to get out always faces the exit
• Easier with TalkBack and large fonts
• Fixes: save, streak, multiplayer
</en-US>
```

## Détail

### Garage

- **Fêtes de l'année** (#289, #290, #291, #292, #294, #295) : 11 événements, chacun avec 4 styles (plateau, voiture cible, palette de véhicules dessinés, effet de victoire), débloqués en réussissant un défi du jour pendant l'événement. Un joueur qui a déjà réussi un défi pendant un événement reçoit ses styles tout de suite.

  | Événement | Dates | Voiture cible |
  |---|---|---|
  | Halloween | 25 → 31 oct. | Carrosse citrouille |
  | Noël | 19 → 25 déc. | Traîneau du Père Noël |
  | Nouvel An | 31 déc. → 3 janv. | Limousine champagne |
  | Saint-Valentin | 10 → 14 févr. | Voiture des mariés |
  | Saint-Patrick | 15 → 17 mars | Voiture du leprechaun |
  | Poisson d'avril | 29 mars → 2 avril | Voiture poisson rouge |
  | Pâques | jeudi saint → lundi de Pâques, catholique et orthodoxe | Lapin en chocolat |
  | Fête de la musique | 18 → 24 juin | Guitare électrique |
  | 14 juillet | 10 → 14 juillet | Camion de pompiers |
  | Grands départs | 1er → 15 août | Combi des vacances |
  | Rentrée | 1er → 7 septembre | Voiture crayon |

  Le plateau d'un événement habille tout l'écran de jeu (partie, tutoriel, solution, défi en ligne, replays ; en duel, chaque joueur a sa moitié d'écran), le haut reste calme pour que les textes restent lisibles. Quand deux événements tombent le même jour, un défi réussi compte pour les deux.
- **Fonds dessinés pour les plateaux de base** (#296, #297) : Papier, Bois, Néon, Pixel, Neige, Feu, Plage et Espace ont un fond d'écran dessiné, en clair et en sombre, en gardant leurs couleurs de grille.
- **Véhicules dessinés pour les 7 palettes de base** (#298) : Océan (hors-bord, ferry), Pastel (citadine et combi rétro), Terre (4x4, grumier), Néon (moto et voiture lumineuses), Bonbon (bonbon, tablette de chocolat), Lave (dumper, bulldozer), Jungle (jeep de safari, camion d'expédition). La palette classique reste en blocs de couleur.
- **La voiture cible face à la sortie** (#286) : les skins dessinés (taxi, voiture dorée, Mafia, goélette…) étaient toujours tournés vers la droite (horizontal) ou le haut (vertical). Avec une sortie à gauche ou en bas, la voiture à sortir partait en marche arrière. Elle a maintenant toujours l'avant vers sa sortie ; les autres véhicules ne changent pas. Sur le plateau de jeu (solo, duels, défis), dans les aperçus du Garage et de Mes niveaux, et dans le créateur.
- **Écran du Garage** (#287) : l'aperçu du plateau et les onglets restent en haut, seule la liste des styles défile. Sous l'aperçu, le nom du style choisi ou la condition pour débloquer un style verrouillé. L'aperçu rapetisse sur un écran court.

### Sauvegarde

- **Code de sauvegarde trop gros** (#315) : si le presse-papiers refuse le code, l'app le dit et renvoie vers l'export en fichier, au lieu d'échouer en silence. Même chose pour un presse-papiers illisible au collage.
- **Sauvegarde non chargée** (#300) : après une lecture ratée au lancement, l'écran Sauvegarde refuse d'exporter (un fichier vide) ou d'importer (rien n'était écrit) et conseille de relancer l'app.
- **Import et streak** (#309) : le message de fin d'import dit ce que les jours manqués depuis l'export ont fait au streak (gels utilisés, streak arrêté).
- **Sauvegarde d'une version plus récente** (#310) : un code fait sur une app avec une campagne plus grande est refusé avec « mets d'abord l'app à jour ». Un défi du jour ou hebdo transféré en cours garde son journal de coups : « Voir ma solution » rejoue la vraie partie.
- **Purge des niveaux générés** (#299) : elle garde les étoiles des niveaux de Mes niveaux, et un import après une purge rend toute l'XP.

### Jeu et streak

- **Streak** (#308) : gagner le défi d'un jour déjà derrière le streak (date qui recule après un vol ou un changement de fuseau) ne le remet plus à 1 ; si ce jour était gelé, le gel est rendu.
- **Coup après la victoire** (#302) : un second doigt relâché juste après le coup gagnant ne compte plus la victoire deux fois.
- **Petites corrections** (#312) : un lien de niveau forgé ne fait plus planter l'app, la feuille de partage d'un défi n'affiche plus « Niveau 999999 », le calendrier du profil passe au nouveau jour après minuit, l'indice ne vibre plus après la fermeture de l'écran.

### Accessibilité

- **3 étoiles au lecteur d'écran** (#306) : les pas d'une case d'un même véhicule comptent pour un seul coup, comme un glisser. Avant, aucun niveau ne pouvait être gagné à 3 étoiles avec TalkBack ou VoiceOver.
- **Sens du balayage** (#311) : balayer vers le haut sur un véhicule vertical le fait monter. L'indice annonce la couleur affichée par la palette équipée.
- **Contraste** (#304) : les lettres des véhicules, la « ★ » de la voiture cible et le numéro des niveaux de la carte passent en foncé sur les couleurs claires (Pastel, Néon, Bonbon, Taxi…).
- **Grandes polices et iPad** (#305) : le plateau rétrécit pour laisser la place aux boutons avec une grande police ou une fenêtre basse ; les textes de la partie sont plafonnés à ×1,5. Sur iPad, l'app reste en portrait plein écran.

### Demande de note

- **Note sur le Play Store** (#324, build Google Play seulement) : la fenêtre native de Google, au plus deux fois (la 2e au moins 120 jours après), en revenant sur la carte après un niveau gagné avec 3 étoiles, chez un joueur installé (≥ 7 jours, ≥ 5 jours de jeu, ≥ 30 niveaux gagnés). Jamais après un défi ni par-dessus un succès ou un nouveau style. Ligne « Noter le jeu » dans les options.

### Multijoueur

- **Limite de requêtes** (#307) : comptée par joueur et plus par adresse : plusieurs téléphones sur le même Wi-Fi ne reçoivent plus d'erreur en commençant un défi. L'écran Multijoueur interroge le serveur moins souvent hors de l'onglet Duels.
- **Changement de serveur, duels, vieilles parties** (#313) : changer de serveur pendant un chargement n'affiche plus les données de l'ancien ; un duel quitté pendant sa connexion ne gêne plus le suivant (Android) ; les parties expirées sont retirées du téléphone.

### Version web

- **Panneaux sur ordinateur** (#281) : de chaque côté de la colonne, « Joue sur ton téléphone » (QR code, Google Play, iPhone) et « Le code source » (GitHub, signaler un bug).
- **Firefox sur iPhone** (#282) : les véhicules ne se traversent plus quand le navigateur prenait le doigt en plein glisser.

### Divers

- **Politique de confidentialité** (#303) : elle mentionne la vérification des mises à jour, les liens externes et la version web.
- Tests ajoutés sur les règles du défi du jour à l'écran, la reconnexion des duels et les champs sauvegardés (#314) ; actions GitHub à jour (#283).

## Données des joueurs

- **`STORE_VERSION` 12 → 13** (#324) : une étape ajoutée à la fin de `migrateState` crée `reviewPrompt` (« jamais demandé », ancienneté et jours de jeu déduits de la sauvegarde). Aucune donnée existante n'est modifiée ; champ propre au téléphone, ni exporté ni remplacé par un import. Testé dans `__tests__/migrations.test.ts` à partir d'un état v12 écrit en dur.
- **Store multijoueur** : forme inchangée (version 2) ; les parties dont la date limite est passée (que le serveur refuse déjà) sont retirées au chargement (#313), les comptes ne sont pas touchés.
- **Cosmétiques** : seuls des identifiants ont été **ajoutés** (44 styles d'événement), aucun renommé ni réutilisé ; les déblocages sont calculés depuis `dailyChallengeProgress`.
- **Code de sauvegarde** : champ facultatif `campaignSize` (#310). Les anciennes sauvegardes s'importent toujours (`__tests__/saveTransfer.test.ts`).
- **Serveur** : pas de nouvelle étape dans `server/src/db.ts`.

## Avant de publier

- **Nouveau build natif obligatoire** : `expo-store-review` et la fonction `installerPackage` de `rush-device` sont nouveaux. Le dossier local `android/` (versionCode 19 / 2.0.4) doit être régénéré avec `expo prebuild` (sauvegarder d'abord le keystore et la config de signature).
- **Vérifications sur téléphone** (#180, #173) ; tester la demande de note sur une piste de test interne (installée depuis le Play Store).
- Vérifier dans la Play Console que le versionCode 23 n'a pas déjà été utilisé.
