import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import type { Level } from '@/store/types';
import { haptics, Haptics } from '@/utils/haptics';
import { LEVEL_NAME_MAX_LENGTH, parseSharedLevel } from '@/utils/sharing';
import { customLevelTitle, type CustomLevelKind } from '@/utils/customLevels';
import BoardPreview from '@/components/garage/BoardPreview';
import BottomSheet from '@/components/home/BottomSheet';
import ShareIcon from '@/components/share/ShareIcon';
import ShareLevelSheet from '@/components/share/ShareLevelSheet';
import LevelNameSheet from '@/components/share/LevelNameSheet';
import KeyboardScreen from '@/components/KeyboardScreen';
import { useTheme, type UiColors } from '@/theme';

type Tab = CustomLevelKind | 'favorites';

/** A level of the list with where it is stored and its title */
interface Entry {
    level: Level;
    kind: CustomLevelKind;
    title: string;
}

const THUMB = 64;
/** iOS drops an alert or a sheet shown while another sheet is sliding away */
const AFTER_SHEET_MS = 350;

export default function CustomLevelsScreen() {
    const { t } = useTranslation();
    const { colors, isDark, scheme } = useTheme();
    const router = useRouter();
    const createdLevels = useGameStore(s => s.createdLevels);
    const importedLevels = useGameStore(s => s.importedLevels);
    const progress = useGameStore(s => s.progress);
    const cosmetics = useGameStore(s => s.cosmetics);
    const { addImportedLevel, deleteCustomLevel, toggleFavorite, renameCustomLevel } = useGameStore.getState();
    const [activeTab, setActiveTab] = useState<Tab>('created');
    const [importText, setImportText] = useState('');
    const [importName, setImportName] = useState('');
    const [sharing, setSharing] = useState<Entry | null>(null);
    const [menu, setMenu] = useState<Entry | null>(null);
    const [renaming, setRenaming] = useState<Entry | null>(null);

    const entries = useMemo(() => {
        const toEntries = (levels: Level[], kind: CustomLevelKind): Entry[] =>
            levels.map(level => ({ level, kind, title: customLevelTitle(t, level, kind, levels) }));
        const byDate = (a: Entry, b: Entry) => (b.level.updatedAt || 0) - (a.level.updatedAt || 0);
        const created = toEntries(createdLevels, 'created').sort(byDate);
        const imported = toEntries(importedLevels, 'imported').sort(byDate);
        return { created, imported, favorites: [...created, ...imported].filter(e => e.level.isFavorite).sort(byDate) };
    }, [createdLevels, importedLevels, t]);

    const data = entries[activeTab];

    // Checked as it is typed or pasted: the board and the name of the link show before importing
    const pending = useMemo(() => (importText.trim() ? parseSharedLevel(importText.trim()) : null), [importText]);
    const pendingInvalid = importText.trim().length > 0 && !pending;
    // The name of the link is suggested, the player can change or clear it
    useEffect(() => setImportName(pending?.name ?? ''), [pending]);

    const handlePaste = async () => {
        const text = await Clipboard.getStringAsync();
        if (!text) return;
        setImportText(text);
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleImport = () => {
        if (!pending) return;
        const level = { ...pending, id: Date.now(), name: importName };
        const id = addImportedLevel(level);
        setImportText('');
        setImportName('');
        if (id !== level.id) {
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(t('custom_levels.import_existing_title'), t('custom_levels.import_existing'));
            return;
        }
        haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handleDelete = (entry: Entry) => {
        setMenu(null);
        setTimeout(() => Alert.alert(
            t('custom_levels.delete_title'),
            t('custom_levels.delete_confirm', { name: entry.title }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        deleteCustomLevel(entry.level.id, entry.kind);
                        haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                },
            ],
        ), AFTER_SHEET_MS);
    };

    const renderItem = ({ item, index }: { item: Entry; index: number }) => (
        <LevelCard
            entry={item}
            index={index}
            colors={colors}
            stars={progress.find(p => p.levelId === item.level.id && p.completed)?.stars ?? 0}
            thumbnail={<BoardPreview selection={cosmetics} scheme={scheme} size={THUMB} level={item.level} />}
            onPlay={() => router.push(`/game?levelId=${item.level.id}`)}
            onShare={() => setSharing(item)}
            onEdit={() => router.push(`/creator?levelId=${item.level.id}`)}
            onFavorite={() => toggleFavorite(item.level.id, item.kind)}
            onMore={() => setMenu(item)}
        />
    );

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'created', label: t('custom_levels.tabs.created'), count: entries.created.length },
        { key: 'imported', label: t('custom_levels.tabs.imported'), count: entries.imported.length },
        { key: 'favorites', label: t('custom_levels.tabs.favorites'), count: entries.favorites.length },
    ];

    return (
        <KeyboardScreen style={{ backgroundColor: colors.background }}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerSide} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
                    <Text style={[styles.backText, { color: colors.textMuted }]}>← {t('common.home')}</Text>
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>{t('home.my_levels')}</Text>
                <View style={[styles.headerSide, styles.headerRight]}>
                    <Pressable
                        onPress={() => router.push('/creator')}
                        style={[styles.newBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('custom_levels.create_new')}
                        hitSlop={6}
                    >
                        <Ionicons name="add" size={22} color={colors.primaryText} />
                    </Pressable>
                </View>
            </View>

            <View style={[styles.tabs, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
                {tabs.map(tab => {
                    const selected = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            style={[styles.tab, selected && { backgroundColor: colors.surface }]}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${tab.label}, ${tab.count}`}
                        >
                            {tab.key === 'favorites' ? (
                                <Ionicons name={selected ? 'star' : 'star-outline'} size={14} color={selected ? colors.star : colors.textMuted} />
                            ) : null}
                            <Text style={[styles.tabText, { color: selected ? colors.text : colors.textMuted }]} numberOfLines={1}>{tab.label}</Text>
                            {tab.count > 0 ? (
                                <Text style={[styles.tabCount, { color: selected ? colors.primaryText : colors.textMuted }]}>{tab.count}</Text>
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={item => `${item.kind}-${item.level.id}`}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={activeTab === 'imported' ? (
                    <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.primaryBorder }]}>
                        <Text style={[styles.importTitle, { color: colors.text }]}>{t('custom_levels.import_title')}</Text>
                        <Text style={[styles.importHint, { color: colors.textMuted }]}>{t('custom_levels.import_hint')}</Text>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={[styles.input, { color: colors.text, backgroundColor: colors.neutralSoft, borderColor: pendingInvalid ? colors.danger : colors.border }]}
                                placeholder={t('custom_levels.import_placeholder')}
                                placeholderTextColor={colors.textMuted}
                                accessibilityLabel={t('custom_levels.import_placeholder')}
                                value={importText}
                                onChangeText={setImportText}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Pressable
                                onPress={handlePaste}
                                style={[styles.pasteBtn, { backgroundColor: colors.primarySoft }]}
                                accessibilityRole="button"
                            >
                                <Ionicons name="clipboard-outline" size={16} color={colors.primaryText} />
                                <Text style={[styles.pasteBtnText, { color: colors.primaryText }]}>{t('common.paste')}</Text>
                            </Pressable>
                        </View>

                        {pendingInvalid ? (
                            <Text style={[styles.importError, { color: colors.danger }]} accessibilityLiveRegion="polite">{t('custom_levels.import_error')}</Text>
                        ) : null}

                        {pending ? (
                            <View style={styles.pending}>
                                <View style={styles.pendingRow}>
                                    <BoardPreview selection={cosmetics} scheme={scheme} size={48} level={pending} />
                                    <Text style={[styles.pendingStats, { color: colors.textMuted }]}>
                                        {t('custom_levels.stats_line', { size: pending.gridSize, count: pending.vehicles.length, moves: pending.minMoves })}
                                    </Text>
                                </View>
                                <Text style={[styles.nameLabel, { color: colors.textMuted }]}>{t('custom_levels.name_label')}</Text>
                                <TextInput
                                    style={[styles.field, { color: colors.text, backgroundColor: colors.neutralSoft, borderColor: colors.border }]}
                                    placeholder={t('custom_levels.name_placeholder')}
                                    placeholderTextColor={colors.textMuted}
                                    accessibilityLabel={t('custom_levels.name_label')}
                                    value={importName}
                                    onChangeText={setImportName}
                                    maxLength={LEVEL_NAME_MAX_LENGTH}
                                />
                            </View>
                        ) : null}

                        <Pressable
                            onPress={handleImport}
                            disabled={!pending}
                            style={[styles.importBtn, { backgroundColor: pending ? colors.primary : colors.inactive }]}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !pending }}
                        >
                            <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
                            <Text style={[styles.importBtnText, { color: colors.onPrimary }]}>{t('common.import')}</Text>
                        </Pressable>
                    </View>
                ) : null}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                            <Ionicons
                                name={activeTab === 'created' ? 'construct-outline' : activeTab === 'imported' ? 'download-outline' : 'star-outline'}
                                size={30}
                                color={colors.primaryText}
                            />
                        </View>
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                            {activeTab === 'created' ? t('custom_levels.empty_created') : activeTab === 'imported' ? t('custom_levels.empty_imported') : t('custom_levels.empty_favorites')}
                        </Text>
                        {activeTab === 'created' && (
                            <Pressable
                                onPress={() => router.push('/creator')}
                                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>{t('custom_levels.create_new')}</Text>
                            </Pressable>
                        )}
                    </View>
                }
            />

            <ShareLevelSheet
                level={sharing?.level ?? null}
                title={sharing?.title ?? ''}
                colors={colors}
                isDark={isDark}
                onClose={() => setSharing(null)}
            />

            <BottomSheet visible={!!menu} title={menu?.title ?? ''} colors={colors} isDark={isDark} onClose={() => setMenu(null)} onRequestClose={() => setMenu(null)}>
                <MenuRow
                    icon="pencil-outline"
                    label={t('custom_levels.rename')}
                    color={colors.text}
                    colors={colors}
                    onPress={() => { const entry = menu; setMenu(null); setTimeout(() => setRenaming(entry), AFTER_SHEET_MS); }}
                />
                <MenuRow
                    icon="trash-outline"
                    label={t('custom_levels.delete_title')}
                    color={colors.danger}
                    colors={colors}
                    onPress={() => menu && handleDelete(menu)}
                />
            </BottomSheet>

            <LevelNameSheet
                visible={!!renaming}
                title={t('custom_levels.rename')}
                initialName={renaming?.level.name}
                confirmLabel={t('custom_levels.save_name')}
                colors={colors}
                isDark={isDark}
                onConfirm={name => {
                    if (renaming) renameCustomLevel(renaming.level.id, renaming.kind, name);
                    setRenaming(null);
                }}
                onClose={() => setRenaming(null)}
            />
        </KeyboardScreen>
    );
}

interface LevelCardProps {
    entry: Entry;
    index: number;
    colors: UiColors;
    /** Best stars, 0 when not won yet */
    stars: number;
    thumbnail: React.ReactNode;
    onPlay: () => void;
    onShare: () => void;
    onEdit: () => void;
    onFavorite: () => void;
    onMore: () => void;
}

/** A custom level: its board, its name and how it went, play first, then share */
function LevelCard({ entry, index, colors, stars, thumbnail, onPlay, onShare, onEdit, onFavorite, onMore }: LevelCardProps) {
    const { t } = useTranslation();
    const { level, kind, title } = entry;
    const stats = t('custom_levels.stats_line', { size: level.gridSize, count: level.vehicles.length, moves: level.minMoves });
    const result = stars > 0 ? t('custom_levels.stars', { count: stars }) : t('custom_levels.not_won');

    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index, 8) * 60).springify()}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.cardTop}>
                <Pressable
                    onPress={onPlay}
                    style={styles.cardMain}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}, ${stats}, ${result}`}
                    accessibilityHint={t('common.play')}
                >
                    {thumbnail}
                    <View style={styles.cardTexts}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.cardStats, { color: colors.textMuted }]} numberOfLines={1}>{stats}</Text>
                        {stars > 0 ? (
                            <View style={styles.starsRow}>
                                {[1, 2, 3].map(i => (
                                    <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={14} color={i <= stars ? colors.star : colors.textMuted} />
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.cardStats, { color: colors.textMuted }]}>{result}</Text>
                        )}
                    </View>
                </Pressable>
                <Pressable
                    onPress={onFavorite}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={level.isFavorite ? t('a11y.favorite_remove') : t('a11y.favorite_add')}
                    accessibilityState={{ selected: !!level.isFavorite }}
                >
                    <Ionicons name={level.isFavorite ? 'star' : 'star-outline'} size={22} color={level.isFavorite ? colors.star : colors.textMuted} />
                </Pressable>
            </View>

            <View style={styles.cardActions}>
                <Pressable onPress={onPlay} style={[styles.playBtn, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`${t('common.play')}, ${title}`}>
                    <Ionicons name="play" size={16} color={colors.onPrimary} />
                    <Text style={[styles.playText, { color: colors.onPrimary }]}>{t('common.play')}</Text>
                </Pressable>
                <Pressable
                    onPress={onShare}
                    style={[styles.shareBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('game.share')}, ${title}`}
                >
                    <ShareIcon size={18} color={colors.primaryText} />
                    <Text style={[styles.shareText, { color: colors.primaryText }]}>{t('game.share')}</Text>
                </Pressable>
                <Pressable
                    onPress={onEdit}
                    style={[styles.iconBtn, { backgroundColor: colors.neutralSoft }]}
                    accessibilityRole="button"
                    accessibilityLabel={kind === 'imported' ? t('custom_levels.edit_imported', { name: title }) : `${t('common.edit')}, ${title}`}
                >
                    <Ionicons name="create-outline" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                    onPress={onMore}
                    style={[styles.iconBtn, { backgroundColor: colors.neutralSoft }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('custom_levels.more', { name: title })}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                </Pressable>
            </View>
        </Animated.View>
    );
}

interface MenuRowProps {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    color: string;
    colors: UiColors;
    onPress: () => void;
}

function MenuRow({ icon, label, color, colors, onPress }: MenuRowProps) {
    return (
        <Pressable onPress={onPress} style={[styles.menuRow, { borderColor: colors.border }]} accessibilityRole="button">
            <Ionicons name={icon} size={22} color={color} />
            <Text style={[styles.menuText, { color }]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    // Same width on both sides: the title stays centered
    headerSide: { width: 90, height: 44, justifyContent: 'center' },
    headerRight: { alignItems: 'flex-end' },
    backText: { fontSize: 16, fontWeight: '700' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '800' },
    newBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, padding: 4, borderRadius: 14 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
    tabText: { fontSize: 15, fontWeight: '700' },
    tabCount: { fontSize: 13, fontWeight: '800' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardTexts: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 17, fontWeight: '800' },
    cardStats: { fontSize: 13, fontWeight: '500' },
    starsRow: { flexDirection: 'row', gap: 2 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    playBtn: { flex: 1, height: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    playText: { fontSize: 15, fontWeight: '800' },
    shareBtn: { height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareText: { fontSize: 15, fontWeight: '700' },
    iconBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
    emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyText: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
    createBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
    createBtnText: { fontSize: 16, fontWeight: '700' },
    importCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginBottom: 4 },
    importTitle: { fontSize: 17, fontWeight: '800' },
    importHint: { fontSize: 14, marginTop: -4 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    field: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
    // minWidth 0: a long pasted link must not push the Paste button out of the card
    input: { flex: 1, minWidth: 0, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
    nameLabel: { fontSize: 13, fontWeight: '600', marginBottom: -4 },
    pasteBtn: { height: 48, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
    pasteBtnText: { fontWeight: '700', fontSize: 14 },
    importError: { fontSize: 13, fontWeight: '600' },
    pending: { gap: 10 },
    pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pendingStats: { flex: 1, fontSize: 14, fontWeight: '600' },
    importBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    importBtnText: { fontWeight: '800', fontSize: 16 },
    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
    menuText: { fontSize: 17, fontWeight: '600' },
});
