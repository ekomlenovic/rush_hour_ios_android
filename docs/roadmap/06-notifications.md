# Notifications locales de rappel (opt-in)
labels: enhancement, phase-2

Aucune notification aujourd'hui. Un rappel bien dosé est le levier de retour le plus efficace.

## À faire
- [ ] Ajouter `expo-notifications`, notifications **locales uniquement** (pas de serveur, cohérent avec la politique de confidentialité)
- [ ] Demander la permission **après** le premier défi du jour réussi, pas au premier lancement
- [ ] Rappels :
  - « Le défi du jour t'attend 🧩 » à une heure choisie par le joueur (défaut 19 h), seulement s'il n'est pas déjà fait
  - « Ton streak de N jours est en danger 🔥 » vers 21 h si le défi n'est pas fait
  - « Nouveau défi hebdomadaire disponible » le lundi
- [ ] Reprogrammer à chaque ouverture de l'app et annuler le rappel du jour dès que le défi est réussi
- [ ] Options : activer/désactiver, heure du rappel (`app/index.tsx`, section Options)
- [ ] Mettre à jour `Privacy_Policy.md` si nécessaire et vérifier `POST_NOTIFICATIONS` (Android 13+)
