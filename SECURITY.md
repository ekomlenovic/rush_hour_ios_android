# Security Policy

*[Version française plus bas](#politique-de-sécurité)*

## Supported versions

Only the latest release gets security fixes.

| Component | Supported |
|---|---|
| App (Android, iOS): latest version on [Google Play](https://play.google.com/store/apps/details?id=com.rushhours.app) and in the [latest GitHub release](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest) | ✅ |
| Multiplayer server ([`server/`](server)): latest Docker image | ✅ |
| Older versions | ❌ — please update first |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately on GitHub: **[Report a vulnerability](https://github.com/ekomlenovic/rush_hour_ios_android/security/advisories/new)** (Security tab → *Report a vulnerability*). Only the maintainer can read it.

Please include:

- the affected component (app, multiplayer server, save import…) and its version;
- the steps to reproduce, or a proof of concept;
- the impact you expect (what an attacker could do).

### What happens next

- You get an answer within **7 days**.
- Once the problem is confirmed, a fix is prepared in a private advisory and shipped in a new release. Self-hosted server admins are told to update in the release notes.
- You are credited in the advisory, unless you prefer not to be.

Please give us a reasonable time to ship the fix before disclosing anything publicly.

## Scope

In scope, for example:

- the multiplayer server: authentication, invite codes, admin token, account deletion, move verification, data leaking between players;
- the app: importing a save file or code, talking to a multiplayer server, local storage of the server token and recovery code.

Out of scope:

- a self-hosted server that is misconfigured by its owner (plain HTTP, leaked `SERVER_SECRET` or `ADMIN_TOKEN`, no rate limit in the reverse proxy…);
- volumetric denial of service, spam, social engineering;
- cheating that only changes your own local progress;
- vulnerabilities in third-party apps (SideStore, LiveContainer…) or in the OS.

---

# Politique de sécurité

## Versions prises en charge

Seule la dernière version reçoit les correctifs de sécurité.

| Composant | Pris en charge |
|---|---|
| App (Android, iOS) : dernière version sur [Google Play](https://play.google.com/store/apps/details?id=com.rushhours.app) et dans la [dernière release GitHub](https://github.com/ekomlenovic/rush_hour_ios_android/releases/latest) | ✅ |
| Serveur multijoueur ([`server/`](server)) : dernière image Docker | ✅ |
| Versions plus anciennes | ❌ — mets à jour d'abord |

## Signaler une faille

**N'ouvre pas d'issue publique pour un problème de sécurité.**

Signale-le en privé sur GitHub : **[Signaler une faille](https://github.com/ekomlenovic/rush_hour_ios_android/security/advisories/new)** (onglet Security → *Report a vulnerability*). Seul le mainteneur peut le lire.

Indique si possible :

- le composant concerné (app, serveur multijoueur, import de sauvegarde…) et sa version ;
- les étapes pour reproduire, ou une preuve de concept ;
- l'impact attendu (ce qu'un attaquant pourrait faire).

### Et ensuite

- Tu reçois une réponse sous **7 jours**.
- Une fois le problème confirmé, le correctif est préparé dans un avis de sécurité privé puis publié dans une nouvelle version. Les admins de serveurs auto-hébergés sont prévenus de mettre à jour dans les notes de version.
- Tu es crédité dans l'avis, sauf si tu préfères ne pas l'être.

Laisse-nous un délai raisonnable pour publier le correctif avant de divulguer quoi que ce soit.

## Périmètre

Dans le périmètre, par exemple :

- le serveur multijoueur : authentification, codes d'invitation, jeton admin, suppression de compte, vérification des coups, fuite de données entre joueurs ;
- l'app : import d'un fichier ou code de sauvegarde, échanges avec un serveur multijoueur, stockage local du jeton et du code de récupération.

Hors périmètre :

- un serveur auto-hébergé mal configuré par son propriétaire (HTTP en clair, `SERVER_SECRET` ou `ADMIN_TOKEN` divulgué, pas de limite de débit dans le reverse proxy…) ;
- déni de service volumétrique, spam, ingénierie sociale ;
- la triche qui ne modifie que ta propre progression locale ;
- les failles d'apps tierces (SideStore, LiveContainer…) ou du système.
