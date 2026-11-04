# Privacy Policy for Rush Hours

Last updated: 04/11/2026

This privacy policy applies to the **Rush Hours** mobile application, developed and published by **Imelein**.

## 1. Information Collection

The developer of Rush Hours does not collect, store, or share any personal data or user information.

The app works offline and does not require an internet connection. It only goes online when you ask it to:

- the optional **multiplayer mode** (section 4), if you choose to use it;
- on Android, **installed from Google Play only**, the automatic **sync of your progress with Google Play Games** (section 3), if you are signed in to Play Games;
- **Check for updates** (Options), which downloads a small version file from GitHub (`raw.githubusercontent.com`). Nothing about you or your game is sent; like any website, GitHub sees your IP address and the type of device.

The app also has links that open in your browser, only when you tap them: the page to report a problem or request levels (GitHub issues), the page of an update (Google Play, or its download page outside Google Play), and, **outside Google Play only** (iOS build, APK of the GitHub releases, web version), the donation page (Ko-fi). The Google Play version has no donation link. After a crash, the app offers to open a GitHub issue prefilled with the error details (the error message, the app version and the system of the phone, never your progress): you read it and decide whether to send it, from your browser, with your own GitHub account. What happens on those websites is covered by their own privacy policies.

The **web version** of the game is hosted on GitHub Pages: GitHub serves its files and sees your IP address, like any website. The game itself runs in your browser and keeps your progress there.

## 2. Notifications

If you turn reminders on, the app schedules **local notifications** on your device (daily challenge, streak, weekly challenge). They are created and stored by your device only: no push service is used, no token is generated, and nothing is sent to a server. You can turn them off at any time in the app options or in your phone settings.

## 3. Save Export, Import and Sync

You can export your progress as a file or a text code (Options → Save) to move it to another device. It is created on your device and only goes where you choose to share or save it: nothing is sent to the developer or to a server. Importing reads only the file you pick, or your clipboard when you tap the paste button.

**Google Play Games sync (Android, Google Play version only).** When you are signed in to Google Play Games on your phone, the app keeps a copy of your progress in the **Saved Games** of your Google account, so that it comes back by itself on a new Android phone. The copy is the same content as an exported save: your game progress (levels, stars, scores, challenges, streak, achievements, styles, your created levels, the games in progress) and the game settings (music, vibrations, theme), never your multiplayer identities nor your reminders. It is written when the app goes to the background and after a win, and read when the app starts. It is stored by Google under your Google account, as described in Google's privacy policy; the developer never receives it. Signing in to Play Games is never required: without it, nothing is sent. You can turn the sync off in Options → Save, and delete the copy from your Google account (Play Games app → Settings → Delete Play Games account and data, or the "Manage your data" page of your Google account). The iOS build, the web version and the APK of the GitHub releases never use Play Games.

## 4. Multiplayer Mode (optional)

The multiplayer mode lets you play a daily challenge with friends on a **server that one of you hosts** (a "self-hosted server"). It is off until you join a server yourself, with its address and an invite code.

- **No central server**: the app only talks to the servers you add, over HTTPS. The developer runs no server and receives nothing.
- **What a server receives** when you join it and play: the **nickname** you choose, your **games** (the moves you play, with their times, the time measured by your phone and the time spent out of the app during a game), and the **reports** you send about other players. Like any website, the server sees your **IP address** when the app connects to it; the server software does not write it in its logs.
- **What a server stores**: your nickname, a secret token and a recovery code (both stored as one-way hashes), your scores, and the moves of your games for a limited time (7 days by default, set by its administrator) so that they can be replayed.
- **Who sees it**: the other players of that server see your nickname, your results and, once they have played the same challenge, the replay of your games. The **administrator** of the server, the person who hosts it, can see all the data it stores. That person, not the developer, is responsible for the server.
- **On your phone**: the servers you joined, your token and recovery code are stored on your device only. They are **never** included in an exported save.
- **Deleting your data**: in the app, Multiplayer → My account → Delete my data; or on the web, at `https://<the server>/delete-account`, with your recovery code. Your account and all your games are erased from that server. Leaving a server without deleting your data keeps your account there, so that you can come back.
- No data from the multiplayer mode is used for advertising, analytics or tracking.

## 5. Third-Party Services

Rush Hours does not use any advertising, analytics, automatic crash reporting or in-app purchases. The only outside services are those of section 1: GitHub (update check, issues, hosting of the web version), outside Google Play, Ko-fi (donation page, in your browser), and, in the Google Play version only, **Google Play Games Services** (sign-in to Play Games, Saved Games: section 3), whose own privacy policy applies (https://policies.google.com/privacy). Every QR code (shared levels, multiplayer invitations) is drawn on your device: nothing is sent to an online service to make it.

## 6. Data Usage

The developer collects no data, so no data is used, processed, or shared by the developer. The copy of your progress in Play Games is used only to bring your progress back on your phones. Data sent to a multiplayer server is used by that server only to run the game (challenges, rankings, replays, moderation).

## 7. Children’s Privacy

Rush Hours is made for everyone, **children included**. It is a puzzle game with no ads, no purchases, no chat and no account.

- **Solo play** (the map, the daily and weekly challenges, the levels you create or receive) works entirely on the device: no personal information is collected from anyone, child or adult. On the Google Play version, a phone signed in to Google Play Games also keeps a copy of the progress in that Google account (section 3): Google, not the developer, stores it, and it can be turned off in Options → Save.
- **The multiplayer mode is off by default** and cannot be reached by chance: joining a server needs its address and an invite code, given by the person who hosts it. We ask that a **parent or guardian** decide whether a child joins a server, and choose it with them (for example, a server hosted by the family or by people they know).
- In multiplayer, the only thing a player writes is a **nickname**, shown to the other players of that server. Children should use a nickname that is **not their real name**. Nicknames are limited to letters, numbers and a few signs, and the administrator of the server can rename or exclude a player. Players can report or block another player.
- What a multiplayer server receives and stores is listed in section 4. The developer receives none of it.
- **A parent or guardian can delete a child's data at any time**: in the app, Multiplayer → My account → Delete my data, or on the web at `https://<the server>/delete-account` with the recovery code. They can also ask the administrator of the server. Uninstalling the app removes what it stored on the device (the phone's own backup, if turned on, may keep a copy).

## 8. Security

The developer collects and stores no data. Multiplayer servers only accept HTTPS connections, require an invite code to join, store tokens and recovery codes as one-way hashes, and limit repeated attempts.

## 9. Changes to This Privacy Policy

This Privacy Policy may be updated from time to time. Any changes will be reflected on this page.

## 10. Contact

Questions about this policy, including from parents: open an issue at https://github.com/ekomlenovic/rush_hour_ios_android/issues.
