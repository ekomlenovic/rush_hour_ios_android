# Play Store : ce qu'il faut déclarer

Notes pour la fiche Google Play, liées au **mode multijoueur** (#46). Sans multijoueur, l'app ne transmet rien.

## Sécurité des données (Data safety)

Le multijoueur envoie des données **à un serveur choisi par le joueur** (hébergé par un ami), jamais au développeur. Par prudence, on les déclare comme **collectées**, **facultatives**, pour le **fonctionnement de l'app** uniquement.

| Question | Réponse |
|---|---|
| L'app collecte-t-elle ou partage-t-elle des données ? | **Oui** (multijoueur seulement) |
| Données chiffrées en transit ? | **Oui** (HTTPS obligatoire) |
| Les utilisateurs peuvent-ils demander la suppression ? | **Oui** : dans l'app, et sur le web (voir plus bas) |

| Type de données | Collectée | Partagée | Facultative | Finalité |
|---|---|---|---|---|
| Informations personnelles → **ID utilisateur** (pseudo, identifiant du compte sur le serveur) | Oui | Non | Oui | Fonctionnement de l'app |
| Activité dans l'app → **Autres actions** (coups joués et leurs temps, scores) | Oui | Non | Oui | Fonctionnement de l'app, prévention de la fraude (anti-triche) |
| Activité dans l'app → **Autres contenus générés par l'utilisateur** (signalements de pseudos) | Oui | Non | Oui | Fonctionnement de l'app |

- « Partagée : Non » : la donnée part vers le serveur que **le joueur choisit lui-même** en le rejoignant, ce qui est un transfert à l'initiative de l'utilisateur.
- Rien n'est utilisé pour la publicité, l'analyse ou le suivi.
- L'adresse IP n'est pas une catégorie à déclarer à part : elle sert seulement à la connexion, le serveur ne la garde pas dans ses logs.

## Suppression du compte

Google demande un moyen **dans l'app** et un **lien web**.

- Dans l'app : Multijoueur → Mon compte → **Supprimer mes données**.
- Lien web à donner dans la Play Console : la page [`docs/ACCOUNT_DELETION.md`](ACCOUNT_DELETION.md) sur GitHub (`https://github.com/ekomlenovic/rush_hour_ios_android/blob/main/docs/ACCOUNT_DELETION.md`). Elle explique qu'il n'y a pas de compte central et renvoie vers la page `https://<serveur>/delete-account` de chaque serveur (`server/src/deletePage.ts`).

## Contenu généré par les utilisateurs (UGC)

Le seul contenu des joueurs est leur **pseudo**, et le signalement. Ce que Google demande :

| Exigence | Où |
|---|---|
| Règles interdisant les contenus choquants | pseudos filtrés (lettres, chiffres, espaces, `._-`, 2 à 20 caractères) ; l'admin du serveur modère |
| **Signaler** un utilisateur ou un contenu | toucher un joueur dans un classement → Signaler (arrive dans le panneau admin) |
| **Bloquer** un utilisateur | toucher un joueur → Bloquer (masqué sur le téléphone) |
| Modération | panneau admin : renommer, exclure, traiter les signalements |

## Politique de confidentialité

[`Privacy_Policy.md`](../Privacy_Policy.md), section 4 « Multiplayer Mode ».

## Public cible : enfants compris (programme Familles)

L'app vise **tous les âges, enfants compris** : dans « Public cible et contenu », cocher aussi des tranches de moins de 13 ans. Elle doit alors respecter le [règlement Familles](https://support.google.com/googleplay/android-developer/answer/9893335) de Google Play :

| Exigence | Où |
|---|---|
| Politique de confidentialité qui parle des enfants | [`Privacy_Policy.md`](../Privacy_Policy.md), sections 7 « Children's Privacy » et 10 « Contact » |
| Pas de publicité, ou seulement des SDK certifiés Familles | aucune publicité, aucun SDK de pub ni d'analytics (`package.json`) |
| Pas d'identifiant de l'appareil ni de localisation envoyés | rien n'est envoyé hors multijoueur ; en multijoueur, pseudo et parties vers un serveur choisi par le joueur (adresse IP vue comme par tout site web) |
| Données des enfants : le moins possible, et supprimables | pseudo seulement (pas de vrai nom conseillé) ; suppression dans l'app ou sur `https://<serveur>/delete-account` |
| Interactions entre joueurs encadrées | multijoueur désactivé par défaut, sur invitation, sans chat ; signaler, bloquer, modération par l'admin du serveur |

Le multijoueur passe par des serveurs que le développeur ne contrôle pas : la politique demande qu'un parent décide si un enfant rejoint un serveur. Google peut demander plus (par exemple un contrôle parental avant d'ouvrir le multijoueur) : à ajouter dans l'app si la revue le demande.

## Message « Mise à jour disponible » (Android)

L'app compare sa version à `android-source.json` **sur `main`** (`utils/updateChecker.ts`) et renvoie vers la fiche Google Play. Ce fichier doit donc annoncer **uniquement la version en ligne sur le Play Store**, sinon les joueurs voient une mise à jour qu'ils ne peuvent pas installer.

- Le développement se fait sur une branche de version (ex. `2.0.0`) ; on ne la merge dans `main` qu'une fois la version **acceptée par Google Play**.
- À ce moment-là, mettre à jour à la main `android-source.json` : `version` (= `version` de `app.json`) et `buildVersion` (= code de build Play Console).
- Le workflow `build.yml` ne touche plus à `android-source.json` (il ne met à jour que `sidestore-source.json` pour iOS).
