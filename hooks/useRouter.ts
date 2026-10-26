import { useEffect, useMemo } from 'react';
import { useNavigation, useRoute, useRouter as useExpoRouter } from 'expo-router';
import { NavigationLock } from '@/utils/navigationLock';

/** One lock per screen, shared by all its components (header, sheets, cards) */
const locks = new Map<string, NavigationLock>();

/**
 * The router of Expo Router, with push and back ignored while one from the same screen is under
 * way: spamming a button (garage, profile…) no longer stacks the same screen twice. Replace and
 * dismissTo don't grow the stack and stay as they are (a redirect right after opening a screen).
 */
export function useRouter(): ReturnType<typeof useExpoRouter> {
  const router = useExpoRouter();
  const navigation = useNavigation();
  const { key } = useRoute();

  const lock = useMemo(() => {
    let existing = locks.get(key);
    if (!existing) {
      existing = new NavigationLock();
      locks.set(key, existing);
    }
    return existing;
  }, [key]);

  useEffect(() => {
    const offFocus = navigation.addListener('focus', () => lock.focused());
    const offBlur = navigation.addListener('blur', () => lock.blurred());
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation, lock]);

  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => {
      if (lock.claim()) router.push(...args);
    },
    back: () => {
      if (lock.claim()) router.back();
    },
  }), [router, lock]);
}
