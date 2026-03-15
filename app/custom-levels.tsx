import React, { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, FlatList, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';
import * as Haptics from 'expo-haptics';
import { deserializeLevel, getShareUrl } from '@/utils/sharing';
import { TextInput } from 'react-native';

export default function CustomLevelsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const router = useRouter();
    const { createdLevels, importedLevels, deleteCustomLevel, toggleFavorite } = useGameStore();
    const [activeTab, setActiveTab] = useState<'created' | 'imported' | 'favorites'>('created');
    const [importUrl, setImportUrl] = useState('');

    const colors = isDark
        ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)', danger: '#EF4444', star: '#FFD700' }
        : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)', danger: '#EF4444', star: '#FFB800' };

    const sortedCreated = [...createdLevels].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const sortedImported = [...importedLevels].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const favoriteLevels = [...createdLevels, ...importedLevels]
        .filter(l => l.isFavorite)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const data = activeTab === 'created' ? sortedCreated : activeTab === 'imported' ? sortedImported : favoriteLevels;

    const handleDelete = (id: number) => {
        Alert.alert(
            "Delete Level",
            "Are you sure you want to delete this level?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: () => {
                        deleteCustomLevel(id, activeTab === 'favorites' ? (createdLevels.some(l => l.id === id) ? 'created' : 'imported') : activeTab);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            ]
        );
    };

    const handleManualImport = () => {
        if (!importUrl) return;
        const trimmedUrl = importUrl.trim();
        const level = deserializeLevel(trimmedUrl, Date.now());
        if (level) {
            const { addImportedLevel } = useGameStore.getState();
            addImportedLevel(level);
            setImportUrl('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Level imported successfully!");
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Invalid level URL or code.");
        }
    };

    const handleShare = async (item: any) => {
        try {
            const url = getShareUrl(item);
            await Share.share({
                message: `Check out this Rush Hour level I made/found!`,
                url: url,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const type = createdLevels.find(l => l.id === item.id) ? 'created' : 'imported';
        return (
            <Animated.View 
                entering={FadeInDown.delay(index * 100).springify()}
                style={[styles.levelCard, { backgroundColor: colors.card }]}
            >
                <View style={styles.levelInfo}>
                    <Text style={[styles.levelTitle, { color: colors.text }]}>Level #{item.id}</Text>
                    <Text style={[styles.levelSub, { color: colors.sub }]}>{item.vehicles.length} vehicles • {item.minMoves} min moves</Text>
                </View>
                <View style={styles.actions}>
                    <Pressable 
                        onPress={() => toggleFavorite(item.id, type)}
                        style={[styles.iconBtn]}
                    >
                        <Text style={{ fontSize: 20, color: item.isFavorite ? colors.star : colors.sub }}>{item.isFavorite ? '★' : '☆'}</Text>
                    </Pressable>
                    <Pressable 
                        onPress={() => handleShare(item)}
                        style={[styles.iconBtn]}
                    >
                        <Text style={{ fontSize: 18, color: colors.accent }}>🔗</Text>
                    </Pressable>
                    <Pressable 
                        onPress={() => router.push(`/game?levelId=${item.id}`)}
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                    >
                        <Text style={styles.actionText}>Play</Text>
                    </Pressable>
                    <Pressable 
                        onPress={() => router.push(`/creator?levelId=${item.id}`)}
                        style={[styles.actionBtn, { backgroundColor: colors.sub }]}
                    >
                        <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                    <Pressable 
                        onPress={() => handleDelete(item.id)}
                        style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                    >
                        <Text style={styles.actionText}>✕</Text>
                    </Pressable>
                </View>
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: colors.sub }]}>← Home</Text>
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Custom Levels</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.tabs}>
                <Pressable 
                    onPress={() => setActiveTab('created')}
                    style={[styles.tab, activeTab === 'created' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'created' ? colors.text : colors.sub }]}>Created</Text>
                </Pressable>
                <Pressable 
                    onPress={() => setActiveTab('imported')}
                    style={[styles.tab, activeTab === 'imported' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'imported' ? colors.text : colors.sub }]}>Imported</Text>
                </Pressable>
                <Pressable 
                    onPress={() => setActiveTab('favorites')}
                    style={[styles.tab, activeTab === 'favorites' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'favorites' ? colors.text : colors.sub }]}>Favorites</Text>
                </Pressable>
            </View>

            {activeTab === 'imported' && (
                <View style={[styles.importSection, { backgroundColor: colors.card }]}>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.sub + '44' }]}
                        placeholder="Paste level link here..."
                        placeholderTextColor={colors.sub}
                        value={importUrl}
                        onChangeText={setImportUrl}
                    />
                    <Pressable 
                        onPress={handleManualImport}
                        style={[styles.importBtn, { backgroundColor: colors.accent }]}
                    >
                        <Text style={styles.importBtnText}>Import</Text>
                    </Pressable>
                </View>
            )}

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.sub }]}>
                            {activeTab === 'created' ? "You haven't created any levels yet." : activeTab === 'imported' ? "No imported levels found." : "No favorite levels yet."}
                        </Text>
                        {activeTab === 'created' && (
                            <Pressable 
                                onPress={() => router.push('/creator')}
                                style={[styles.createBtn, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.createBtnText}>Create New Level</Text>
                            </Pressable>
                        )}
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingTop: 60, 
        paddingHorizontal: 20,
        marginBottom: 20
    },
    backButton: { width: 80, height: 44, justifyContent: 'center' },
    backText: { fontSize: 16, fontWeight: '700' },
    headerTitle: { fontSize: 24, fontWeight: '800' },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 16, fontWeight: '700' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    levelCard: { 
        flexDirection: 'row', 
        padding: 16, 
        borderRadius: 16, 
        marginBottom: 12, 
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    levelInfo: { flex: 1 },
    levelTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    levelSub: { fontSize: 14 },
    actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    iconBtn: { padding: 4 },
    actionText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, marginBottom: 20 },
    createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    createBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    importSection: { 
        flexDirection: 'row', 
        marginHorizontal: 20, 
        marginBottom: 20, 
        padding: 12, 
        borderRadius: 16, 
        gap: 10,
        alignItems: 'center'
    },
    input: { 
        flex: 1, 
        height: 44, 
        borderWidth: 1, 
        borderRadius: 10, 
        paddingHorizontal: 12,
        fontSize: 14
    },
    importBtn: { paddingHorizontal: 16, height: 44, borderRadius: 10, justifyContent: 'center' },
    importBtnText: { color: '#FFF', fontWeight: '700' }
});
