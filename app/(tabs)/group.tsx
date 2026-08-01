import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

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
import { ensurePhotoUploaded } from '@/services/photos';
import { getItem, StorageKeys } from '@/services/storage';
import { alertMessage } from '@/utils/confirm';
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
  const { data, me, isLoading, setMyStatus, clearMyStatus } = useGroupData();

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

  const features: { key: string; emoji: string; route: string; visible: boolean }[] = [
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
});
