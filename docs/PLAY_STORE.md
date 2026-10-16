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
