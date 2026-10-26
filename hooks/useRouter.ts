import { useMemo } from 'react';
import { useNavigation, useRoute, useRouter as useExpoRouter } from 'expo-router';
import { NavigationLock } from '@/utils/navigationLock';

/** One lock per screen, shared by all its components (header, sheets, cards) */
const locks = new Map<string, NavigationLock>();

/**
 * The router of Expo Router, with push and back ignored when they repeat one from the same screen:
 * spamming a button (garage, profile…) no longer stacks the same screen twice. Replace and
 * dismissTo don't grow the stack and stay as they are (a redirect right after opening a screen).
 */
export function useRouter(): ReturnType<typeof useExpoRouter> {
  const router = useExpoRouter();
  const navigation = useNavigation();
  const { key } = useRoute();

  return useMemo(() => {
    let lock = locks.get(key);
    if (!lock) {
      lock = new NavigationLock();
      locks.set(key, lock);
    }
    const claim = () => lock.claim(navigation.isFocused());
    return {
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        if (claim()) router.push(...args);
      },
      back: () => {
        if (claim()) router.back();
      },
    };
  }, [router, navigation, key]);
}
