import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { RFValue } from '@/utils/responsive';
import { useTheme } from '@/theme';
import MultiHeader from '@/components/multi/MultiHeader';
import KeyboardScreen from '@/components/KeyboardScreen';

type Loader = () => Promise<unknown>;

/** Adds what a pull loads again; gives back how to take it off */
const RefreshContext = createContext<(load: Loader) => () => void>(() => () => {});

/** What a pull on the page loads again: the content of the page gives it (several parts can) */
export function useAdminRefresh(load: Loader) {
  const register = useContext(RefreshContext);
  useEffect(() => register(load), [register, load]);
}

interface Props { title: string; children: React.ReactNode }

/** A page of the admin panel: header, then its content, pulled down to load it again */
export default function AdminPage({ title, children }: Props) {
  const { colors } = useTheme();
  const loaders = useRef(new Set<Loader>());
  const [canRefresh, setCanRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const register = useCallback((load: Loader) => {
    loaders.current.add(load);
    setCanRefresh(true);
    return () => {
      loaders.current.delete(load);
      setCanRefresh(loaders.current.size > 0);
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([...loaders.current].map(load => load()));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <KeyboardScreen style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={title} colors={colors} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={canRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} /> : undefined}
      >
        <RefreshContext.Provider value={register}>{children}</RefreshContext.Provider>
      </ScrollView>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: RFValue(16),
    paddingBottom: RFValue(48),
  },
});
