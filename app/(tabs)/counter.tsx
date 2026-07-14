import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CLICKS_BEFORE_PROOF_REQUIRED,
  contributionsToday,
  sortByContributions,
} from '@/services/groupData';
import { uploadPhoto } from '@/services/photos';
import { alertMessage } from '@/utils/confirm';
import { formatDateTime } from '@/utils/date';
import { pickImage } from '@/utils/pickImage';

/** Núcleo B: contador de rachas grupales estilo Duolingo. */
export default function CounterScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, isAdmin, contribute } = useGroupData();

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  const counter = data.counter;

  // Sin contador configurado todavía.
  if (!counter) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">{t('counter.emptyTitle')}</ThemedText>
        <ThemedText variant="muted" style={styles.centerText}>
          {isAdmin ? t('counter.emptyAdminHint') : t('counter.emptyMemberHint')}
        </ThemedText>
        {isAdmin && (
          <Button title={t('counter.create')} onPress={() => router.push('/counter-settings')} />
        )}
      </Screen>
    );
  }

  const myClicksToday = user ? contributionsToday(data, user.id) : 0;
  const canIncrement = counter.anyoneCanIncrement || isAdmin;
  const dailyLimitReached = !counter.multiplePerDay && myClicksToday >= 1;
  const photoRequired = counter.multiplePerDay && myClicksToday >= CLICKS_BEFORE_PROOF_REQUIRED;

  const memberName = (userId: string) => {
    const m = data.members.find((x) => x.userId === userId);
    return m ? (m.nickname ?? m.name) : '—';
  };

  const add = async (withPhoto: boolean) => {
    if (!user || !canIncrement || dailyLimitReached) return;
    let photo: string | undefined;
    if (withPhoto || photoRequired) {
      if (photoRequired && !withPhoto) {
        // Anti-trampas: al 4º clic del día la foto es obligatoria.
        alertMessage(t('counter.photoRequiredTitle'), t('counter.photoRequiredMessage'));
      }
      const picked = await pickImage();
      if (!picked) return; // sin foto no se valida el clic obligatorio
      try {
        photo = await uploadPhoto(
          picked,
          `groups/${data.group.id}/proofs/${user.id}-${Date.now()}.jpg`,
        );
      } catch {
        alertMessage(t('common.error'), t('common.photoUploadError'));
        return;
      }
    }
    await contribute(photo);
  };

  const top = sortByContributions(data.members).slice(0, 5);
  const recent = data.contributions.slice(0, 10);
  const proofs = data.contributions.filter((c) => c.proofPhotoUrl);

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <ThemedText variant="title">{counter.name}</ThemedText>
        {isAdmin && (
          <Button
            title={t('counter.configure')}
            variant="outline"
            onPress={() => router.push('/counter-settings')}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {/* Racha y total */}
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={styles.streakEmoji}>🔥</ThemedText>
          <ThemedText variant="title">
            {t('counter.streakLabel', { count: counter.streakDays })}
          </ThemedText>
          <ThemedText variant="muted">
            {t('counter.totalLabel')}: {counter.totalValue}
          </ThemedText>
        </View>

        {!canIncrement && <ThemedText variant="muted">{t('counter.adminOnly')}</ThemedText>}
        {canIncrement && dailyLimitReached && (
          <ThemedText variant="muted">{t('counter.alreadyToday')}</ThemedText>
        )}
        {canIncrement && !dailyLimitReached && (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title={t('counter.addOne')} onPress={() => add(false)} />
            </View>
            <View style={styles.flex}>
              <Button title={t('counter.addWithPhoto')} variant="outline" onPress={() => add(true)} />
            </View>
          </View>
        )}

        {/* Top contribuidores */}
        <ThemedText variant="label">{t('counter.top')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {top.map((member, index) => (
            <View key={member.userId} style={styles.itemRow}>
              <ThemedText>
                {index + 1}. {member.nickname ?? member.name}
                {member.userId === user?.id ? ` (${t('common.you')})` : ''}
              </ThemedText>
              <ThemedText variant="muted">
                {t('counter.contributionsShort', { count: member.counterContributions })}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Últimas contribuciones */}
        {recent.length > 0 && (
          <>
            <ThemedText variant="label">{t('counter.recent')}</ThemedText>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {recent.map((c) => (
                <View key={c.id} style={styles.itemRow}>
                  <ThemedText>{memberName(c.userId)}</ThemedText>
                  <ThemedText variant="muted">{formatDateTime(c.at, language)}</ThemedText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Fotos de prueba de las últimas 24 h */}
        {proofs.length > 0 && (
          <>
            <ThemedText variant="label">{t('counter.proofs')}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.proofRow}>
                {proofs.map((c) => (
                  <View key={c.id} style={styles.proofItem}>
                    <Image source={{ uri: c.proofPhotoUrl }} style={styles.proofImage} />
                    <ThemedText variant="muted" numberOfLines={1}>
                      {memberName(c.userId)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: 12, paddingBottom: 24 },
  hero: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 4 },
  streakEmoji: { fontSize: 40 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  proofRow: { flexDirection: 'row', gap: 10 },
  proofItem: { width: 110, gap: 4 },
  proofImage: { width: 110, height: 110, borderRadius: 12 },
});
