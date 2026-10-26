import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import sr from '../locales/sr.json';

import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  sr: { translation: sr },
};

const LANGUAGE_KEY = 'user_language';

const systemLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';

// Initialise synchronously at import time so the very first render already has
// translations. Waiting on AsyncStorage before calling init() let screens render
// raw keys (e.g. "home.world_map") whenever the storage read was slow.
i18n.use(initReactI18next).init({
  resources,
  lng: systemLanguage,
  fallbackLng: 'en',
  supportedLngs: ['en', 'fr', 'sr'],
  nonExplicitSupportedLngs: true,
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
});

// Then apply the language the user picked in the settings, if any.
AsyncStorage.getItem(LANGUAGE_KEY)
  .then((savedLanguage) => {
    if (savedLanguage && savedLanguage !== i18n.language) {
      return i18n.changeLanguage(savedLanguage);
    }
  })
  .catch(() => {});

export const changeLanguage = async (lng: string) => {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANGUAGE_KEY, lng);
};

export default i18n;
