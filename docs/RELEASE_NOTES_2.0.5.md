# Rush Hours 2.0.5 (versionCode 20)

Mise à jour de la **2.0.4 (versionCode 19)** : un écran « oups » au lieu d'un écran blanc quand l'app plante, avec un signalement en un geste, un bouton pour soutenir le jeu par un don (hors Google Play) et des dépendances mises à jour.

## Play Store (500 caractères max par langue)

À coller tel quel dans la Play Console (« Notes de version »). Le bouton de don n'existe pas dans le build Play : ne pas le mentionner.

```
<fr-FR>
Nouveautés :
• Si l'app plante, un écran te rassure au lieu d'un écran blanc : ta progression est gardée, tu peux réessayer ou l'exporter
• Signale un plantage en un geste : le rapport est déjà rempli, tu le relis avant de l'envoyer
• Corrections et améliorations
</fr-FR>
<en-US>
New:
• If the app crashes, a screen reassures you instead of a blank one: your progress is kept, and you can retry or export it
• Report a crash in one tap: the report is filled in, you review it before sending
• Fixes and improvements
</en-US>
```

## Détail

### Nouveautés

- **Écran « oups »** : une erreur pendant l'affichage n'est plus un écran blanc. L'écran rassure (la progression est toujours sur le téléphone) et propose **Réessayer**, **Exporter ma progression** (fichier, ou code si le partage de fichier manque) et **Copier le détail** de l'erreur. Rien n'est envoyé automatiquement, conformément à la politique de confidentialité.
- **Signaler le bug sur GitHub** depuis l'écran « oups » : ouvre une issue déjà remplie (formulaire Retour en français, Feedback sinon : type Bug, version, erreur, système). Le joueur la relit et l'envoie lui-même. Sans navigateur, le détail est copié à la place.
- **Soutenir le jeu** : une ligne « Soutenir le jeu » en 2e position des options, sous « Comment jouer ? », avec un bouton « Faire un don » qui ouvre la page Ko-fi (don sans créer de compte : carte, PayPal, Apple Pay ou Google Pay). **Seulement hors Google Play** : build iOS (SideStore) et APK des releases GitHub (`EXPO_PUBLIC_DONATION_LINK=1` dans `build.yml`). Le README et le bouton « Sponsor » du dépôt renvoient aussi vers Ko-fi et GitHub Sponsors.

### Correctifs

- **Détail du plantage** : la ligne d'erreur n'est plus écrite deux fois dans le détail copié et dans l'issue.
- **Dépendances** : alertes Dependabot corrigées (`@xmldom/xmldom`, `uuid`, `fast-uri` côté serveur, `rand` du générateur de niveaux difficiles).

### Tests

- Les écrans clés sont rendus dans les tests avec Testing Library : écran « oups », carte de victoire, partie gagnée au lecteur d'écran, créateur.

## Données des joueurs

- `STORE_VERSION` inchangé, store multijoueur inchangé, serveur sans nouvelle étape : aucune donnée des joueurs touchée.
