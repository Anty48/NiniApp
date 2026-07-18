import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
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
import { alertMessage, chooseAsync, confirmAsync } from '@/utils/confirm';
import { formatDateTime } from '@/utils/date';
import { pickImage, takePhoto } from '@/utils/pickImage';

/** Núcleo B: contador de rachas grupales estilo Duolingo. */
export default function CounterScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, isAdmin, contribute, removeContribution } = useGroupData();
  // Foto de prueba abierta a pantalla completa (null = visor cerrado).
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // Modo edición de las últimas contribuciones (para borrar equivocaciones).
  const [editingContribs, setEditingContribs] = useState(false);

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <Loading />
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

  /**
   * Foto de prueba: en nativo se elige entre cámara y galería; en web va
   * directo al file input (que en móvil ya ofrece la cámara del sistema).
   */
  const pickProofPhoto = async (): Promise<string | null> => {
    if (Platform.OS === 'web') return pickImage();
    const source = await chooseAsync({
      title: t('counter.photoSourceTitle'),
      message: t('counter.photoSourceMessage'),
      optionA: { label: t('counter.photoCamera'), value: 'camera' as const },
      optionB: { label: t('counter.photoGallery'), value: 'gallery' as const },
      cancelLabel: t('common.cancel'),
    });
    if (!source) return null;
    if (source === 'camera') {
      const shot = await takePhoto();
      if (shot.denied) alertMessage(t('common.error'), t('counter.cameraDenied'));
      return shot.uri;
    }
    return pickImage();
  };

  const add = async (withPhoto: boolean) => {
    if (!user || !canIncrement || dailyLimitReached) return;
    let photo: string | undefined;
    if (withPhoto || photoRequired) {
      if (photoRequired && !withPhoto) {
        // Anti-trampas: al 4º clic del día la foto es obligatoria.
        alertMessage(t('counter.photoRequiredTitle'), t('counter.photoRequiredMessage'));
      }
      const picked = await pickProofPhoto();
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

  const deleteContribution = async (contributionId: string, name: string) => {
    const ok = await confirmAsync({
      title: t('counter.deleteContribTitle'),
      message: t('counter.deleteContribMessage', { name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (ok) await removeContribution(contributionId);
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

        {/* Últimas contribuciones (con modo edición para borrar equivocaciones) */}
        {recent.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <ThemedText variant="label">{t('counter.recent')}</ThemedText>
              <Pressable
                onPress={() => setEditingContribs((v) => !v)}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}>
                <ThemedText style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                  {editingContribs ? t('common.cancel') : `✏️ ${t('counter.editContribs')}`}
                </ThemedText>
              </Pressable>
            </View>
            {editingContribs && (
              <ThemedText variant="muted">{t('counter.editContribsHint')}</ThemedText>
            )}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {recent.map((c) => {
                // Cada uno puede borrar las suyas; el admin, cualquiera.
                const canDelete = editingContribs && (isAdmin || c.userId === user?.id);
                return (
                  <View key={c.id} style={styles.itemRow}>
                    <ThemedText style={styles.flex}>{memberName(c.userId)}</ThemedText>
                    <ThemedText variant="muted">{formatDateTime(c.at, language)}</ThemedText>
                    {canDelete && (
                      <Pressable
                        onPress={() => deleteContribution(c.id, memberName(c.userId))}
                        hitSlop={8}
                        style={({ pressed }) => pressed && { opacity: 0.6 }}>
                        <ThemedText style={{ color: theme.danger, fontSize: 16 }}>✕</ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}
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
                    <Pressable onPress={() => setViewerUrl(c.proofPhotoUrl!)}>
                      <Image source={{ uri: c.proofPhotoUrl }} style={styles.proofImage} />
                    </Pressable>
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

      {/* Visor a pantalla completa: se cierra tocando en cualquier parte. */}
      <Modal
        visible={viewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  proofRow: { flexDirection: 'row', gap: 10 },
  proofItem: { width: 110, gap: 4 },
  proofImage: { width: 110, height: 110, borderRadius: 12 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImage: { width: '100%', height: '100%' },
});
