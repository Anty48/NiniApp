import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { driversWithCar } from '@/services/groupData';
import { EventCar, GroupEvent } from '@/types/models';
import { dayKey, parseDateTime, toDateInput, toTimeInput } from '@/utils/date';
import { randomEventColor } from '@/utils/eventColor';

interface TempCarDraft {
  id: string;
  name: string;
  seats: string;
}

/**
 * Crear / editar evento. Cualquier miembro crea eventos comunes; solo los
 * admins pueden marcarlos como "especiales". El creador puede editarlo todo
 * a posteriori (se entra aquí con ?id=...).
 */
export default function EventFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, isAdmin, createEvent, updateEvent } = useGroupData();

  const editing = data?.events.find((e) => e.id === id);
  const driverMembers = data ? driversWithCar(data) : [];

  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [address, setAddress] = useState(editing?.mapsAddress ?? '');
  const [allDay, setAllDay] = useState(editing ? (editing.allDay ?? false) : true);
  const [startDate, setStartDate] = useState(
    editing ? toDateInput(editing.startsAt) : dayKey(),
  );
  const [startTime, setStartTime] = useState(editing ? toTimeInput(editing.startsAt) : '18:00');
  const [endDate, setEndDate] = useState(editing ? toDateInput(editing.endsAt) : dayKey());
  const [endTime, setEndTime] = useState(editing ? toTimeInput(editing.endsAt) : '21:00');
  const [lockHours, setLockHours] = useState(String(editing?.voteLockHoursBefore ?? 12));
  const [isSpecial, setIsSpecial] = useState(editing?.isSpecial ?? false);
  const [carsEnabled, setCarsEnabled] = useState((editing?.cars?.length ?? 0) > 0);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(
    editing?.cars?.filter((c) => c.driverId).map((c) => c.driverId!) ?? [],
  );
  const [tempCars, setTempCars] = useState<TempCarDraft[]>(
    editing?.cars
      ?.filter((c) => !c.driverId)
      .map((c) => ({ id: c.id, name: c.name ?? '', seats: String(c.seats) })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDriverCar = (userId: string) =>
    setSelectedDriverIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );

  const addTempCar = () =>
    setTempCars((prev) => [
      ...prev,
      { id: `car-${Date.now()}-${prev.length}`, name: '', seats: '4' },
    ]);

  const save = async () => {
    if (!user || !data) return;
    if (!title.trim()) {
      setError(t('common.requiredFields'));
      return;
    }
    const starts = parseDateTime(startDate, allDay ? '00:00' : startTime);
    const ends = parseDateTime(endDate, allDay ? '23:59' : endTime);
    if (!starts || !ends || ends <= starts) {
      setError(t('events.invalidDates'));
      return;
    }
    setError(null);
    setSaving(true);

    const driverCars: EventCar[] = data.members
      .filter((m) => selectedDriverIds.includes(m.userId) && m.carDetails)
      .map((m) => ({
        id: `driver-${m.userId}`,
        driverId: m.userId,
        seats: m.carDetails?.seats ?? 4,
        occupants: editing?.cars?.find((c) => c.id === `driver-${m.userId}`)?.occupants ?? [],
      }));
    const temporaryCars: EventCar[] = tempCars
      .filter((c) => c.name.trim())
      .map((c) => ({
        id: c.id,
        name: c.name.trim(),
        seats: Math.max(1, parseInt(c.seats, 10) || 4),
        occupants: editing?.cars?.find((x) => x.id === c.id)?.occupants ?? [],
      }));
    const finalCars = carsEnabled ? [...driverCars, ...temporaryCars] : [];

    const event: GroupEvent = {
      id: editing?.id ?? `e-${Date.now()}`,
      groupId: data.group.id,
      createdBy: editing?.createdBy ?? user.id,
      isSpecial: isAdmin ? isSpecial : (editing?.isSpecial ?? false),
      title: title.trim(),
      description: description.trim() || undefined,
      mapsAddress: address.trim() || undefined,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      allDay,
      color: editing?.color ?? randomEventColor(),
      voteLockHoursBefore: Math.max(0, parseInt(lockHours, 10) || 12),
      cars: finalCars.length > 0 ? finalCars : undefined,
    };

    if (editing) await updateEvent(event);
    else await createEvent(event);
    router.back();
  };

  const inputStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    color: theme.text,
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: editing ? t('events.editTitle') : t('events.create') }}
      />
      <Screen scroll style={styles.container}>
        <TextField label={t('events.formTitle')} value={title} onChangeText={setTitle} />
        <TextField
          label={t('events.formDescription')}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TextField label={t('events.formAddress')} value={address} onChangeText={setAddress} />

        <View style={styles.switchRow}>
          <ThemedText>{t('events.allDay')}</ThemedText>
          <Switch value={allDay} onValueChange={setAllDay} />
        </View>

        {!allDay && <ThemedText variant="muted">{t('events.dateHint')}</ThemedText>}
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label={t('events.startDate')} value={startDate} onChangeText={setStartDate} />
          </View>
          {!allDay && (
            <View style={styles.flex}>
              <TextField
                label={t('events.startTime')}
                value={startTime}
                onChangeText={setStartTime}
              />
            </View>
          )}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label={t('events.endDate')} value={endDate} onChangeText={setEndDate} />
          </View>
          {!allDay && (
            <View style={styles.flex}>
              <TextField label={t('events.endTime')} value={endTime} onChangeText={setEndTime} />
            </View>
          )}
        </View>

        <TextField
          label={t('events.voteLockHours')}
          value={lockHours}
          onChangeText={setLockHours}
          keyboardType="numeric"
        />

        {isAdmin && (
          <View style={styles.switchRow}>
            <ThemedText>{t('events.special')}</ThemedText>
            <Switch value={isSpecial} onValueChange={setIsSpecial} />
          </View>
        )}

        <View style={styles.switchRow}>
          <ThemedText>{t('events.carsToggle')}</ThemedText>
          <Switch value={carsEnabled} onValueChange={setCarsEnabled} />
        </View>

        {carsEnabled && (
          <>
            <ThemedText variant="muted">{t('events.driverCarsHint')}</ThemedText>
            {driverMembers.length === 0 && (
              <ThemedText variant="muted">{t('events.noDriverCars')}</ThemedText>
            )}
            {driverMembers.map((m) => {
              const selected = selectedDriverIds.includes(m.userId);
              return (
                <Pressable
                  key={m.userId}
                  onPress={() => toggleDriverCar(m.userId)}
                  style={({ pressed }) => [
                    styles.driverCarRow,
                    {
                      backgroundColor: selected ? theme.primary + '22' : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <ThemedText style={{ fontWeight: '600' }}>
                    {selected ? '☑' : '☐'} {m.nickname ?? m.name}
                  </ThemedText>
                  <ThemedText variant="muted">
                    {[
                      m.carDetails?.model,
                      m.carDetails?.color,
                      `${m.carDetails?.seats ?? 4} ${t('group.carSeats').toLowerCase()}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </Pressable>
              );
            })}

            {tempCars.length > 0 && (
              <ThemedText variant="muted">{t('events.tempCarHint')}</ThemedText>
            )}
            {tempCars.map((car, index) => (
              <View key={car.id} style={styles.carRow}>
                <TextInput
                  placeholder={t('events.tempCarNamePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  value={car.name}
                  onChangeText={(text) =>
                    setTempCars((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, name: text } : c)),
                    )
                  }
                  style={[styles.carInput, styles.flex, inputStyle]}
                />
                <TextInput
                  placeholder="4"
                  placeholderTextColor={theme.textMuted}
                  value={car.seats}
                  keyboardType="numeric"
                  onChangeText={(text) =>
                    setTempCars((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, seats: text } : c)),
                    )
                  }
                  style={[styles.carInput, styles.seatsInput, inputStyle]}
                />
                <Pressable
                  onPress={() => setTempCars((prev) => prev.filter((_, i) => i !== index))}
                  style={styles.removeButton}>
                  <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
                </Pressable>
              </View>
            ))}
            <Button title={t('events.addTempCar')} onPress={addTempCar} variant="outline" />
          </>
        )}

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        <Button title={t('common.save')} onPress={save} loading={saving} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  driverCarRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  carRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  carInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  seatsInput: { width: 64, textAlign: 'center' },
  removeButton: { padding: 8 },
});
