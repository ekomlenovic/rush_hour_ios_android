import React from 'react';
import { View, Text, StyleSheet, useColorScheme, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';

const ACHIEVEMENT_LIST = {
  'novice': { title: 'Novice', desc: 'Complete 5 levels', emoji: '🥉' },
  'expert': { title: 'Expert', desc: 'Complete 50 levels', emoji: '🥇' },
  'perfectionist': { title: 'Perfectionist', desc: '10 levels with 3 stars', emoji: '⭐' },
  'daily_winner': { title: 'Daily Winner', desc: 'Finish a daily challenge', emoji: '📅' },
};

export default function ResidentsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const { progress, dailyChallengeProgress, achievements } = useGameStore();

  const completedCount = progress.filter(p => p.completed).length;
  const totalStars = progress.reduce((acc, p) => acc + (p.stars || 0), 0);
  const dailyWins = Object.values(dailyChallengeProgress).filter(p => p.completed).length;

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', card: '#1A1A2E', accent: '#6C63FF' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', card: '#FFFFFF', accent: '#5A4FE0' };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.sub }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Player Stats</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main Stats */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={[styles.statsRow]}>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={styles.statEmoji}>🚗</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Solved</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{totalStars}</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Stars</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={styles.statEmoji}>📅</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{dailyWins}</Text>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Daily</Text>
          </View>
        </Animated.View>

        {/* Achievements Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
        <View style={styles.achievementGrid}>
          {Object.entries(ACHIEVEMENT_LIST).map(([id, data], index) => {
            const isUnlocked = achievements.includes(id);
            return (
              <Animated.View 
                entering={ZoomIn.delay(200 + index * 100).springify()} 
                key={id} 
                style={[
                  styles.achievementCard, 
                  { backgroundColor: colors.card, opacity: isUnlocked ? 1 : 0.4 }
                ]}
              >
                <Text style={[styles.achieveEmoji]}>
                  {isUnlocked ? data.emoji : '🔒'}
                </Text>
                <Text style={[styles.achieveTitle, { color: colors.text }]}>{data.title}</Text>
                <Text style={[styles.achieveDesc, { color: colors.sub }]}>{data.desc}</Text>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: (Dimensions.get('window').width - 48 - 12) / 2,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  achieveEmoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  achieveTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  achieveDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
