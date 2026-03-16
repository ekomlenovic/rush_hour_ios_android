import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

const LANGUAGE_KEY = 'user_language';

const initI18n = async () => {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const systemLanguage = Localization.getLocales()[0].languageCode ?? 'en';
  
  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage || systemLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
};

initI18n();

export const changeLanguage = async (lng: string) => {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(LANGUAGE_KEY, lng);
};

export default i18n;
