import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { LeaderboardContent } from '@/components/features/LeaderboardContent';
import { PhrasebookContent } from '@/components/features/PhrasebookContent';
import { PollsContent } from '@/components/features/PollsContent';
import { SongsContent } from '@/components/features/SongsContent';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  QUICK_ACCESS_ICONS,
  QUICK_ACCESS_LABEL_KEYS,
  QUICK_ACCESS_OPTIONS,
  useQuickAccess,
} from '@/contexts/QuickAccessContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Pestaña central personalizable ("acceso rápido"): cada quien pone lo que más
 * usa (frasario, canciones, encuestas o el ranking). Cuando está vacía, un gran
 * "+" para elegir; una vez puesta, un botón discreto abajo para cambiarla.
 */
export default function QuickAccessScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { isLoading } = useGroupData();
  const { target, isReady, setTarget } = useQuickAccess();
  const [choosing, setChoosing] = useState(false);

  if (isLoading || !isReady) {
    return (
      <Screen style={styles.center}>
        <Loading />
      </Screen>
    );
  }

  const renderContent = () => {
    switch (target) {
      case 'ranking':
        return <LeaderboardContent />;
      case 'phrasebook':
        return <PhrasebookContent />;
      case 'songs':
        return <SongsContent />;
      case 'polls':
        return <PollsContent />;
      default:
        return null;
    }
  };

  const chooser = (
    <Modal
      visible={choosing}
      transparent
      animationType="fade"
      onRequestClose={() => setChoosing(false)}>
      <Pressable style={styles.backdrop} onPress={() => setChoosing(false)}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}>
          <ThemedText variant="subtitle" style={styles.sheetTitle}>
            {t('quickAccess.chooseTitle')}
          </ThemedText>
          {QUICK_ACCESS_OPTIONS.map((option) => {
            const selected = option === target;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setTarget(option);
                  setChoosing(false);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    backgroundColor: selected ? theme.primary + '22' : theme.surface,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}>
                <FontAwesome
                  name={QUICK_ACCESS_ICONS[option] as any}
                  size={20}
                  color={selected ? theme.primary : theme.text}
                />
                <ThemedText style={styles.optionLabel}>{t(QUICK_ACCESS_LABEL_KEYS[option])}</ThemedText>
                {selected && <ThemedText style={{ color: theme.primary }}>✓</ThemedText>}
              </Pressable>
            );
          })}
          {target && (
            <Button
              title={t('quickAccess.remove')}
              variant="ghost"
              onPress={() => {
                setTarget(null);
                setChoosing(false);
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Estado vacío: un gran "+" para escoger el acceso rápido.
  if (!target) {
    return (
      <Screen style={styles.center}>
        <Pressable
          onPress={() => setChoosing(true)}
          style={({ pressed }) => [
            styles.emptyCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && { opacity: 0.7 },
          ]}>
          <FontAwesome name="plus" size={44} color={theme.primary} />
        </Pressable>
        <ThemedText variant="title" style={styles.centerText}>
          {t('quickAccess.emptyTitle')}
        </ThemedText>
        <ThemedText variant="muted" style={styles.centerText}>
          {t('quickAccess.emptyHint')}
        </ThemedText>
        <Button title={t('quickAccess.add')} onPress={() => setChoosing(true)} />
        {chooser}
      </Screen>
    );
  }

  return (
    <Screen scroll style={styles.container}>
      <View style={styles.header}>
        <FontAwesome name={QUICK_ACCESS_ICONS[target] as any} size={22} color={theme.primary} />
        <ThemedText variant="title" style={styles.flex}>
          {t(QUICK_ACCESS_LABEL_KEYS[target])}
        </ThemedText>
      </View>

      {renderContent()}

      {/* Botón discreto para cambiar el acceso rápido, al final del todo. */}
      <Pressable
        onPress={() => setChoosing(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.changeRow, pressed && { opacity: 0.6 }]}>
        <FontAwesome name="exchange" size={13} color={theme.textMuted} />
        <ThemedText variant="muted" style={styles.changeText}>
          {t('quickAccess.change')}
        </ThemedText>
      </Pressable>

      {chooser}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  centerText: { textAlign: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyCard: {
    width: 120,
    height: 120,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  changeText: { fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  sheetTitle: { marginBottom: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  optionLabel: { flex: 1, fontSize: 16 },
});
