import { View, Text, StyleSheet, useColorScheme, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { maxUnlockedLevel } = useGameStore();

  const colors = isDark
    ? { text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)' }
    : { text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)' };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F0F1A' : '#F5F5FA' }]}>
      <Animated.Text
        entering={FadeInUp.delay(200).springify()}
        style={[styles.title, { color: colors.text }]}
      >
        Rush Hours
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.delay(400).springify()}
        style={[styles.subtitle, { color: colors.sub }]}
      >
        Slide. Think. Escape.
      </Animated.Text>

      <AnimatedPressable
        entering={FadeInDown.delay(600).springify()}
        style={[styles.playButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          router.push('/map');
        }}
      >
        <Text style={styles.playText}>Play</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 48,
  },
  playButton: {
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
