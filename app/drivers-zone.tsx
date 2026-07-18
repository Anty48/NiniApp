import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { COPIPOINTS_START } from '@/services/groupData';
import { confirmAsync } from '@/utils/confirm';

/** Botones rápidos de ajuste de copipuntos. */
const QUICK_DELTAS = [-5, -1, +1, +5];

/**
 * Zona de Conductores: exclusiva para miembros con isDriver. Permite editar
 * los copipuntos de cualquier miembro (edición directa, guardado inmediato)
 * y los datos del coche propio sin pasar por el admin.
 */
export default function DriversZoneScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, me, adjustCopipoints, updateMyCar } = useGroupData();

  const [carName, setCarName] = useState(me?.carDetails?.name ?? '');
  const [model, setModel] = useState(me?.carDetails?.model ?? '');
  const [color, setColor] = useState(me?.carDetails?.color ?? '');
  const [seats, setSeats] = useState(String(me?.carDetails?.seats ?? 4));
  const [savingCar, setSavingCar] = useState(false);
  const [carSaved, setCarSaved] = useState(false);
  const [removingCar, setRemovingCar] = useState(false);
  /** Ajustes en vuelo, para deshabilitar los botones de esa fila. */
  const [busyMember, setBusyMember] = useState<string | null>(null);

  if (!data || !me?.isDriver) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('drivers.title') }} />
        <Screen style={styles.center}>
          <ThemedText style={styles.bigEmoji}>🚗</ThemedText>
          <ThemedText variant="muted">{t('drivers.notDriver')}</ThemedText>
        </Screen>
      </>
    );
  }

  const saveCar = async () => {
    setSavingCar(true);
    await updateMyCar({
      name: carName.trim() || undefined,
      model: model.trim() || undefined,
      color: color.trim() || undefined,
      seats: Math.max(1, parseInt(seats, 10) || 4),
    });
    setSavingCar(false);
    setCarSaved(true);
    setTimeout(() => setCarSaved(false), 2000);
  };

  const removeCar = async () => {
    const ok = await confirmAsync({
      title: t('drivers.removeCarConfirmTitle'),
      message: t('drivers.removeCarConfirmMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setRemovingCar(true);
    await updateMyCar(undefined);
    setCarName('');
    setModel('');
    setColor('');
    setSeats('4');
    setRemovingCar(false);
  };

  const adjust = async (userId: string, delta: number) => {
    setBusyMember(userId);
    try {
      await adjustCopipoints(userId, delta);
    } finally {
      setBusyMember(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('drivers.title') }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('drivers.subtitle')}</ThemedText>

        {/* Mi coche */}
        <ThemedText variant="label">{t('drivers.myCar')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextField
            label={t('group.carName')}
            value={carName}
            onChangeText={setCarName}
            placeholder={t('drivers.carNamePlaceholder')}
          />
          <View style={styles.inlineRow}>
            <View style={styles.flex}>
              <TextField label={t('drivers.carModel')} value={model} onChangeText={setModel} />
            </View>
            <View style={styles.flex}>
              <TextField label={t('drivers.carColor')} value={color} onChangeText={setColor} />
            </View>
            <View style={styles.seatsField}>
              <TextField
                label={t('group.carSeats')}
                value={seats}
                onChangeText={setSeats}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Button
            title={carSaved ? t('drivers.carSaved') : t('common.save')}
            onPress={saveCar}
            loading={savingCar}
          />
          <Button
            title={t('drivers.removeCar')}
            onPress={removeCar}
            loading={removingCar}
            variant="outline"
            style={{ borderColor: theme.danger }}
          />
        </View>

        {/* Copipuntos de los miembros */}
        <ThemedText variant="label">{t('drivers.points')}</ThemedText>
        <ThemedText variant="muted">{t('drivers.pointsHint')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {data.members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={36} />
              <View style={styles.flex}>
                <ThemedText numberOfLines={1}>
                  {member.nickname ?? member.name}
                  {member.userId === user?.id ? ` (${t('common.you')})` : ''}
                </ThemedText>
                <ThemedText variant="subtitle" style={{ color: theme.primary }}>
                  {member.copipoints ?? COPIPOINTS_START}
                </ThemedText>
              </View>
              <View style={styles.deltaRow}>
                {QUICK_DELTAS.map((delta) => (
                  <Pressable
                    key={delta}
                    disabled={busyMember === member.userId}
                    onPress={() => adjust(member.userId, delta)}
                    style={({ pressed }) => [
                      styles.deltaButton,
                      {
                        backgroundColor: delta > 0 ? theme.primary : theme.background,
                        borderColor: delta > 0 ? theme.primary : theme.danger,
                      },
                      (pressed || busyMember === member.userId) && { opacity: 0.5 },
                    ]}>
                    <ThemedText
                      style={{
                        color: delta > 0 ? theme.onPrimary : theme.danger,
                        fontWeight: '700',
                        fontSize: 13,
                      }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigEmoji: { fontSize: 48 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  inlineRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  seatsField: { width: 80 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deltaRow: { flexDirection: 'row', gap: 6 },
  deltaButton: {
    minWidth: 38,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
