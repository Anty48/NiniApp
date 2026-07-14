import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { sortByCommitment } from '@/services/groupData';
import { uploadPhoto } from '@/services/photos';
import { alertMessage, confirmAsync } from '@/utils/confirm';
import { pickImage } from '@/utils/pickImage';

/**
 * Ajustes del grupo: ID copiable, contraseña editable, foto y nombre,
 * miembros y roles, coches predefinidos, y salida del grupo con traspaso
 * de administración.
 */
export default function GroupSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const {
    data,
    isAdmin,
    updateGroupSettings,
    setMemberRole,
    leaveGroup,
  } = useGroupData();

  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(data?.group.name ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [carName, setCarName] = useState('');
  const [carSeats, setCarSeats] = useState('4');
  const [successorId, setSuccessorId] = useState<string | null>(null);
  const [choosingSuccessor, setChoosingSuccessor] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!data) return null;

  const others = data.members.filter((m) => m.userId !== user?.id);
  const needsSuccessor = isAdmin && others.length > 0;
  // Sucesor por defecto: el nº 1 del ranking de compromiso.
  const defaultSuccessor = sortByCommitment(others)[0]?.userId ?? null;
  const chosenSuccessor = successorId ?? defaultSuccessor;

  const copyId = async () => {
    await Clipboard.setStringAsync(data.group.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveName = async () => {
    if (name.trim() && name.trim() !== data.group.name) {
      await updateGroupSettings({ name: name.trim() });
    }
  };

  const savePassword = async () => {
    if (!newPassword.trim()) return;
    await updateGroupSettings({ accessPassword: newPassword.trim() });
    setNewPassword('');
  };

  const changePhoto = async () => {
    const photo = await pickImage(true);
    if (!photo) return;
    try {
      const url = await uploadPhoto(photo, `groups/${data.group.id}/photo-${Date.now()}.jpg`);
      await updateGroupSettings({ photoUrl: url });
    } catch {
      alertMessage(t('common.error'), t('common.photoUploadError'));
    }
  };

  const addPresetCar = async () => {
    if (!carName.trim()) return;
    await updateGroupSettings({
      presetCars: [
        ...data.group.presetCars,
        {
          id: `preset-${Date.now()}`,
          name: carName.trim(),
          seats: Math.max(1, parseInt(carSeats, 10) || 4),
        },
      ],
    });
    setCarName('');
    setCarSeats('4');
  };

  const removePresetCar = async (id: string) => {
    await updateGroupSettings({
      presetCars: data.group.presetCars.filter((c) => c.id !== id),
    });
  };

  const onLeave = async () => {
    if (needsSuccessor && !choosingSuccessor) {
      setChoosingSuccessor(true);
      return;
    }
    const ok = await confirmAsync({
      title: t('group.leaveTitle'),
      message: t('group.leaveMessage'),
      confirmLabel: t('group.confirmLeave'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setLeaving(true);
    await leaveGroup(needsSuccessor ? (chosenSuccessor ?? undefined) : undefined);
    // Si quedan otros grupos se activa el siguiente; si no, el guard
    // redirige automáticamente al onboarding de grupo.
    router.replace('/(tabs)/calendar');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('group.settings') }} />
      <Screen scroll style={styles.container}>
        {/* Foto + nombre */}
        <View style={styles.photoRow}>
          <Avatar uri={data.group.photoUrl} name={data.group.name} size={72} />
          {isAdmin && (
            <Button title={t('group.photo')} variant="outline" onPress={changePhoto} />
          )}
        </View>

        {isAdmin ? (
          <View style={styles.inlineRow}>
            <View style={styles.flex}>
              <TextField label={t('group.name')} value={name} onChangeText={setName} />
            </View>
            <Button title={t('common.save')} variant="outline" onPress={saveName} />
          </View>
        ) : (
          <ThemedText variant="title">{data.group.name}</ThemedText>
        )}

        {/* ID copiable */}
        <ThemedText variant="label">{t('group.groupId')}</ThemedText>
        <View style={[styles.idCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText variant="title">{data.group.id}</ThemedText>
          <Pressable
            onPress={copyId}
            style={({ pressed }) => [
              styles.copyButton,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.7 },
            ]}>
            <ThemedText style={{ color: theme.onPrimary, fontWeight: '600' }}>
              {copied ? t('group.copied') : t('group.copyId')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Contraseña de acceso (editable por el admin) */}
        <ThemedText variant="label">{t('group.password')}</ThemedText>
        <View style={[styles.idCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText variant="subtitle">{data.group.accessPassword}</ThemedText>
        </View>
        {isAdmin && (
          <View style={styles.inlineRow}>
            <View style={styles.flex}>
              <TextField
                label={t('group.newPassword')}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
            </View>
            <Button title={t('group.changePassword')} variant="outline" onPress={savePassword} />
          </View>
        )}

        {/* Miembros */}
        <ThemedText variant="label">{t('group.members')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {data.members.map((member) => (
            <Pressable
              key={member.userId}
              onPress={() =>
                router.push({ pathname: '/member/[id]', params: { id: member.userId } })
              }
              style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.6 }]}>
              <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={36} />
              <ThemedText style={styles.flex} numberOfLines={1}>
                {member.nickname ?? member.name}
                {member.userId === user?.id ? ` (${t('common.you')})` : ''}
              </ThemedText>
              <ThemedText
                variant="muted"
                style={member.role === 'admin' ? { color: theme.primary, fontWeight: '600' } : undefined}>
                {member.role === 'admin' ? t('group.roleAdmin') : t('group.roleMember')}
              </ThemedText>
              {isAdmin && member.role !== 'admin' && member.userId !== user?.id && (
                <Pill
                  label={t('group.makeAdmin')}
                  selected={false}
                  onPress={() => setMemberRole(member.userId, 'admin')}
                />
              )}
            </Pressable>
          ))}
        </View>

        {/* Coches predefinidos del grupo */}
        {isAdmin && (
          <>
            <ThemedText variant="label">{t('group.presetCars')}</ThemedText>
            <ThemedText variant="muted">{t('group.presetCarsHint')}</ThemedText>
            {data.group.presetCars.map((car) => (
              <View
                key={car.id}
                style={[styles.presetRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={styles.flex}>
                  {car.name} · {car.seats} {t('group.carSeats').toLowerCase()}
                </ThemedText>
                <Pressable onPress={() => removePresetCar(car.id)} style={styles.removeButton}>
                  <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
                </Pressable>
              </View>
            ))}
            <View style={styles.inlineRow}>
              <View style={styles.flex}>
                <TextField label={t('group.carName')} value={carName} onChangeText={setCarName} />
              </View>
              <View style={styles.seatsField}>
                <TextField
                  label={t('group.carSeats')}
                  value={carSeats}
                  onChangeText={setCarSeats}
                  keyboardType="numeric"
                />
              </View>
              <Button title={t('common.add')} variant="outline" onPress={addPresetCar} />
            </View>
          </>
        )}

        {/* Salir del grupo */}
        <View style={styles.leaveSection}>
          {choosingSuccessor && needsSuccessor && (
            <>
              <ThemedText variant="label">{t('group.chooseSuccessor')}</ThemedText>
              <View style={styles.successorRow}>
                {others.map((member) => (
                  <Pill
                    key={member.userId}
                    label={`${member.nickname ?? member.name} (${Math.round(member.commitmentScore)}%)`}
                    selected={chosenSuccessor === member.userId}
                    onPress={() => setSuccessorId(member.userId)}
                  />
                ))}
              </View>
            </>
          )}
          <Button
            title={choosingSuccessor ? t('group.confirmLeave') : t('group.leave')}
            variant="outline"
            loading={leaving}
            onPress={onLeave}
            style={{ borderColor: theme.danger }}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  flex: { flex: 1 },
  idCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyButton: { paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  removeButton: { padding: 4 },
  seatsField: { width: 90 },
  leaveSection: { marginTop: 16, gap: 10 },
  successorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
