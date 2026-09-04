import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BOMB_COOLDOWN_MS, canSendBomb } from '@/services/groupData';
import { ensurePhotoUploaded } from '@/services/photos';
import { getItem, StorageKeys } from '@/services/storage';
import { alertMessage, confirmAsync } from '@/utils/confirm';
import { DAY_MS } from '@/utils/date';
import { pickImage } from '@/utils/pickImage';

/**
 * Pestaña "Grupo": estados efímeros de los miembros y accesos a todas las
 * funciones del grupo (Frasario, canciones, encuestas, colores, conductores
 * y ajustes), que antes se amontonaban en el Perfil.
 */
export default function GroupTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, me, isLoading, setMyStatus, clearMyStatus, sendBomb, setBombOptOut } =
    useGroupData();

  // Notificación bomba: menú, texto editable y envío.
  const [bombOpen, setBombOpen] = useState(false);
  const [bombMessage, setBombMessage] = useState('');
  const [sendingBomb, setSendingBomb] = useState(false);

  // Estados ya vistos en este dispositivo: "groupId:userId" -> timestamp.
  const [seen, setSeen] = useState<Record<string, string>>({});
  useFocusEffect(
    useCallback(() => {
      getItem<Record<string, string>>(StorageKeys.seenStatuses).then((v) => setSeen(v ?? {}));
    }, []),
  );

  // Editor de mi estado.
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusPhoto, setStatusPhoto] = useState<string | undefined>(undefined);
  const [savingStatus, setSavingStatus] = useState(false);

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <Loading />
      </Screen>
    );
  }

  const statuses = data.statuses ?? [];
  const myStatus = statuses.find((s) => s.userId === user?.id);
  const otherStatuses = statuses
    .filter((s) => s.userId !== user?.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  const openStatusEditor = () => {
    setStatusText(myStatus?.text ?? '');
    setStatusPhoto(myStatus?.photoUrl);
    setEditingStatus(true);
  };

  const pickStatusPhoto = async () => {
    const photo = await pickImage(true);
    if (photo) setStatusPhoto(photo);
  };

  const saveStatus = async () => {
    const text = statusText.trim();
    if (!text && !statusPhoto) return;
    setSavingStatus(true);
    try {
      const remoteUrl = await ensurePhotoUploaded(
        statusPhoto,
        `groups/${data.group.id}/status-${user?.id}-${Date.now()}.jpg`,
      );
      await setMyStatus({ text: text || undefined, photoUrl: remoteUrl });
      setEditingStatus(false);
    } catch {
      alertMessage(t('common.error'), t('common.photoUploadError'));
    } finally {
      setSavingStatus(false);
    }
  };

  const removeStatus = async () => {
    setSavingStatus(true);
    await clearMyStatus();
    setSavingStatus(false);
    setEditingStatus(false);
  };

  const memberOf = (userId: string) => data.members.find((m) => m.userId === userId);

  // --- Notificación bomba ---
  const bombOptOut = me?.bombOptOut ?? false;
  const bombEligible = !!me && canSendBomb(me) && !bombOptOut;
  const bombLast = me?.bombLastSentAt ? new Date(me.bombLastSentAt).getTime() : 0;
  const bombCooldownLeftMs = Math.max(0, BOMB_COOLDOWN_MS - (Date.now() - bombLast));
  const bombOnCooldown = bombCooldownLeftMs > 0;
  const bombDaysLeft = Math.ceil(bombCooldownLeftMs / DAY_MS);

  const openBomb = () => {
    setBombMessage(t('bomb.defaultMessage'));
    setBombOpen(true);
  };

  const handleSendBomb = async () => {
    // Cinco avisos distintos y en serie: hay que confirmarlos todos.
    for (const key of ['bomb.warn1', 'bomb.warn2', 'bomb.warn3', 'bomb.warn4', 'bomb.warn5'] as const) {
      const ok = await confirmAsync({
        title: t('bomb.warnTitle'),
        message: t(key),
        confirmLabel: t('bomb.warnContinue'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setSendingBomb(true);
    const result = await sendBomb(bombMessage);
    setSendingBomb(false);
    if (result === 'ok') {
      setBombOpen(false);
      alertMessage(t('bomb.sentOkTitle'), t('bomb.sentOkMessage'));
    } else if (result === 'cooldown') {
      alertMessage(t('bomb.title'), t('bomb.cooldownWait', { days: bombDaysLeft }));
    } else if (result === 'opted-out') {
      alertMessage(t('bomb.title'), t('bomb.optedOutError'));
    } else {
      alertMessage(t('bomb.title'), t('bomb.notEligibleHint'));
    }
  };

  const features: { key: string; emoji: string; route: string; visible: boolean }[] = [
    { key: 'members', emoji: '👥', route: '/members', visible: true },
    { key: 'ranking', emoji: '🏆', route: '/ranking', visible: true },
    { key: 'phrasebook', emoji: '📖', route: '/phrasebook', visible: true },
    { key: 'songs', emoji: '🎵', route: '/songs', visible: true },
    { key: 'polls', emoji: '📊', route: '/polls', visible: true },
    { key: 'pokeTypes', emoji: '👉', route: '/poke-types', visible: true },
    { key: 'colors', emoji: '🎨', route: '/group-colors', visible: true },
    { key: 'drivers', emoji: '🚗', route: '/drivers-zone', visible: !!me?.isDriver },
    { key: 'settings', emoji: '⚙️', route: '/group-settings', visible: true },
  ];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar uri={data.group.photoUrl} name={data.group.name} size={44} />
        <ThemedText variant="title" style={styles.flex} numberOfLines={1}>
          {data.group.name}
        </ThemedText>
      </View>

      {/* Estados efímeros (24 h) */}
      <ThemedText variant="label">{t('statuses.section')}</ThemedText>
      <ThemedText variant="muted">{t('statuses.hint')}</ThemedText>

      {/* Mi estado */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {!editingStatus ? (
          <>
            {myStatus ? (
              <>
                {myStatus.text && <ThemedText>{myStatus.text}</ThemedText>}
                {myStatus.photoUrl && (
                  <Image source={{ uri: myStatus.photoUrl }} style={styles.statusPhoto} />
                )}
              </>
            ) : (
              <ThemedText variant="muted">{t('statuses.mineEmpty')}</ThemedText>
            )}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  title={myStatus ? t('statuses.edit') : t('statuses.add')}
                  variant="outline"
                  onPress={openStatusEditor}
                />
              </View>
              {myStatus && (
                <View style={styles.flex}>
                  <Button
                    title={t('statuses.remove')}
                    variant="outline"
                    style={{ borderColor: theme.danger }}
                    onPress={removeStatus}
                    loading={savingStatus}
                  />
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            <TextField
              label={t('statuses.textLabel')}
              value={statusText}
              onChangeText={setStatusText}
              placeholder={t('statuses.placeholder')}
              multiline
            />
            {statusPhoto && <Image source={{ uri: statusPhoto }} style={styles.statusPhoto} />}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  title={statusPhoto ? t('statuses.changePhoto') : t('statuses.addPhoto')}
                  variant="outline"
                  onPress={pickStatusPhoto}
                />
              </View>
              {statusPhoto && (
                <View style={styles.flex}>
                  <Button
                    title={t('statuses.removePhoto')}
                    variant="outline"
                    onPress={() => setStatusPhoto(undefined)}
                  />
                </View>
              )}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  title={t('common.save')}
                  onPress={saveStatus}
                  loading={savingStatus}
                  disabled={!statusText.trim() && !statusPhoto}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  title={t('common.cancel')}
                  variant="ghost"
                  onPress={() => setEditingStatus(false)}
                />
              </View>
            </View>
          </>
        )}
      </View>

      {/* Estados de los demás: anillo de acento si aún no lo has visto */}
      {otherStatuses.length > 0 && (
        <View style={styles.statusRow}>
          {otherStatuses.map((status) => {
            const member = memberOf(status.userId);
            if (!member) return null;
            const unseen = seen[`${data.group.id}:${status.userId}`] !== status.at;
            return (
              <Pressable
                key={status.userId}
                onPress={() =>
                  router.push({ pathname: '/member/[id]', params: { id: status.userId } })
                }
                style={({ pressed }) => [styles.statusItem, pressed && { opacity: 0.7 }]}>
                <View
                  style={[
                    styles.statusAvatarWrap,
                    { borderColor: unseen ? theme.primary : theme.border },
                    unseen && styles.statusAvatarUnseen,
                  ]}>
                  <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={52} />
                </View>
                <ThemedText variant="muted" numberOfLines={1} style={styles.statusName}>
                  {member.nickname ?? member.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Funciones del grupo */}
      <ThemedText variant="label">{t('groupTab.features')}</ThemedText>
      {features
        .filter((f) => f.visible)
        .map((f) => (
          <Button
            key={f.key}
            title={`${f.emoji} ${t(`groupTab.${f.key}`)}`}
            variant="outline"
            onPress={() => router.push(f.route as any)}
          />
        ))}

      {/* Notificación bomba */}
      <ThemedText variant="label">{t('bomb.section')}</ThemedText>
      <Pressable
        onPress={openBomb}
        style={({ pressed }) => [
          styles.bombCard,
          { backgroundColor: theme.danger + '15', borderColor: theme.danger },
          pressed && { opacity: 0.7 },
        ]}>
        <ThemedText style={styles.bombEmoji}>💣</ThemedText>
        <View style={styles.flex}>
          <ThemedText style={{ color: theme.danger, fontWeight: '700' }}>
            {t('bomb.title')}
          </ThemedText>
          <ThemedText variant="muted">{t('bomb.cardHint')}</ThemedText>
        </View>
      </Pressable>

      {/* Menú de la notificación bomba */}
      <Modal
        visible={bombOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBombOpen(false)}>
        <View style={styles.bombBackdrop}>
          <View style={[styles.bombModal, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText variant="title">💣 {t('bomb.title')}</ThemedText>
            <ThemedText variant="muted">{t('bomb.intro')}</ThemedText>

            <TextField
              label={t('bomb.messageLabel')}
              value={bombMessage}
              onChangeText={setBombMessage}
              placeholder={t('bomb.defaultMessage')}
              multiline
              maxLength={200}
            />

            {/* Recibir notificaciones bomba (si lo desactivas, ni envías ni recibes) */}
            <View style={styles.bombToggleRow}>
              <View style={styles.flex}>
                <ThemedText>{t('bomb.receiveToggle')}</ThemedText>
                <ThemedText variant="muted">{t('bomb.receiveHint')}</ThemedText>
              </View>
              <Switch value={!bombOptOut} onValueChange={(v) => setBombOptOut(!v)} />
            </View>

            {bombOptOut ? (
              <ThemedText variant="muted">{t('bomb.optedOutHint')}</ThemedText>
            ) : !me || !canSendBomb(me) ? (
              <ThemedText variant="muted">{t('bomb.notEligibleHint')}</ThemedText>
            ) : bombOnCooldown ? (
              <ThemedText variant="muted">{t('bomb.cooldownWait', { days: bombDaysLeft })}</ThemedText>
            ) : (
              <ThemedText variant="muted">{t('bomb.readyHint')}</ThemedText>
            )}

            <Button
              title={t('bomb.send')}
              onPress={handleSendBomb}
              loading={sendingBomb}
              disabled={!bombEligible || bombOnCooldown || !bombMessage.trim()}
            />
            <Button title={t('common.close')} variant="ghost" onPress={() => setBombOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  statusPhoto: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statusItem: { alignItems: 'center', width: 64, gap: 4 },
  statusAvatarWrap: { borderWidth: 2, borderRadius: 30, padding: 2 },
  statusAvatarUnseen: { borderWidth: 3 },
  statusName: { fontSize: 11, maxWidth: 64 },
  bombCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  bombEmoji: { fontSize: 30 },
  bombBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  bombModal: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  bombToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
