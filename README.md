# Rush Hours

Le jeu de casse-tête où tu fais glisser les voitures pour libérer la rouge : plus de 300 niveaux sur une carte du monde, un défi du jour, un défi hebdo, un garage de styles à débloquer, un créateur de niveaux et un mode multijoueur entre amis.

*English version below.*

## Installer le jeu

### Android

Sur le Google Play Store : **[Rush Hours sur Google Play](https://play.google.com/store/apps/details?id=com.rushhours.app)**.

### iPhone / iPad

Le jeu **n'est pas sur l'App Store**. Le fichier `.ipa` est publié dans les **[releases GitHub](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest)** (`rush-hours-unsigned.ipa`) : tu l'installes toi-même avec SideStore, seul ou avec LiveContainer.

#### Avec SideStore

1. Installe [SideStore](https://sidestore.io) sur ton iPhone (suis leur guide).
2. Dans SideStore, onglet **Sources** → **+**, puis colle l'adresse de la source Rush Hours :

   ```
   https://raw.githubusercontent.com/ekomlenovic/rush_hour_ios_android/refs/heads/main/sidestore-source.json
   ```

3. Installe **RushHours** depuis la source. Les mises à jour arrivent ensuite directement dans SideStore.

   Tu peux aussi télécharger `rush-hours-unsigned.ipa` depuis la [dernière release](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest) et l'ouvrir avec SideStore (onglet **My Apps** → **+**).

4. Pense à rafraîchir l'app dans SideStore au moins une fois tous les 7 jours (limite d'Apple pour les comptes gratuits).

#### Avec SideStore + LiveContainer

[LiveContainer](https://github.com/LiveContainer/LiveContainer) fait tourner des apps à l'intérieur d'une seule app installée par SideStore : pratique si tu as déjà atteint la limite de 3 apps de SideStore, et seule LiveContainer est à rafraîchir.

1. Installe SideStore, puis LiveContainer avec SideStore (voir le guide de LiveContainer).
2. Télécharge `rush-hours-unsigned.ipa` depuis la [dernière release](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest).
3. Dans LiveContainer, touche **+** et choisis le fichier `.ipa`.
4. Lance Rush Hours depuis LiveContainer.

> Ta progression reste sur ton téléphone. Pour changer d'appareil ou de méthode d'installation, utilise **Options → Sauvegarde → Exporter ma progression**, puis importe-la sur la nouvelle installation.

## Faire un retour

Un bug, une idée, un niveau qui te paraît cassé, un avis ? **[Ouvre un retour ici](https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?template=retour.yml)** (il faut un compte GitHub gratuit).

## Licence et publication

Rush Hours est © 2026 Imelein, sous licence [GNU AGPL v3](LICENSE). Le code est ouvert pour être lu, étudié et amélioré, **pas pour être republié à ma place**.

**Les seules versions officielles sont** :

- l'app [Google Play](https://play.google.com/store/apps/details?id=com.rushhours.app) publiée par Imelein ;
- les fichiers publiés dans les [releases de ce dépôt](https://github.com/ekomlenovic/rush_hour_ios_android/releases) et la source SideStore de ce dépôt.

**Publier ce jeu sur l'Apple App Store (ou TestFlight) est interdit.** Je n'en donne l'autorisation à personne : les conditions de l'App Store ne permettent pas de respecter l'AGPL (qui interdit d'ajouter des restrictions comme le DRM et les conditions d'utilisation d'Apple). Toute version de Rush Hours trouvée sur l'App Store n'est pas la mienne et y est publiée en violation de la licence.

### Conditions complémentaires (article 7 de l'AGPL v3)

En plus de l'AGPL v3, et comme son article 7 le permet :

1. **Nom et identité visuelle** (article 7 e) : la licence ne donne **aucun droit** sur le nom « Rush Hours », l'icône, le logo, les captures et visuels de `store-listing/`, ni sur le nom « Imelein ». Une version modifiée ou republiée doit porter un autre nom et une autre icône.
2. **Versions modifiées** (article 7 c) : une version modifiée doit être clairement présentée comme différente de l'original et ne doit pas laisser croire qu'elle vient d'Imelein ou qu'elle est approuvée par Imelein.
3. **Mentions** (article 7 b) : toute copie ou version modifiée doit garder cette notice d'auteur, la licence et un lien vers ce dépôt.

### Si le jeu est publié sans autorisation

Une publication qui ne respecte pas ces conditions met fin automatiquement aux droits donnés par la licence (article 8 de l'AGPL). C'est alors une **contrefaçon** de mon œuvre (droit d'auteur, art. L335-2 et suivants du Code de la propriété intellectuelle), et je me réserve le droit de demander son retrait au magasin d'applications (notification DMCA / formulaire de contestation de contenu d'Apple et de Google) et d'engager des poursuites. L'historique de ce dépôt et des releases fait foi pour l'antériorité.

Si tu vois une copie du jeu publiée par quelqu'un d'autre, [signale-la-moi](https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?template=retour.yml).

---

## English

**Rush Hours** is a sliding-car puzzle game: free the red car in 300+ levels, with daily and weekly challenges, unlockable styles, a level creator and multiplayer with friends.

- **Android**: [Google Play](https://play.google.com/store/apps/details?id=com.rushhours.app).
- **iPhone / iPad**: not on the App Store. Get `rush-hours-unsigned.ipa` from the [latest release](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest) and install it with [SideStore](https://sidestore.io) (add the source `https://raw.githubusercontent.com/ekomlenovic/rush_hour_ios_android/refs/heads/main/sidestore-source.json`), or with SideStore + [LiveContainer](https://github.com/LiveContainer/LiveContainer) (tap **+** in LiveContainer and pick the `.ipa`).
- **Feedback**: [open a feedback issue](https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?template=retour.yml).

**License**: © 2026 Imelein, [GNU AGPL v3](LICENSE) with the additional terms above (AGPL section 7): no rights are granted to the name "Rush Hours", its icon, logo or store visuals, or the name "Imelein"; modified versions must use a different name and icon and must not appear to come from Imelein. **Publishing this game on the Apple App Store or TestFlight is not permitted**: the App Store terms add restrictions the AGPL forbids. Any distribution that breaks these terms automatically terminates your license (AGPL section 8) and is copyright infringement; I will request its takedown and reserve the right to take legal action.
