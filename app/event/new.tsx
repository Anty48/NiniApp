import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FONT_REGULAR } from '@/constants/typography';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeHexColor, useTheme } from '@/contexts/ThemeContext';
import { driversWithCar } from '@/services/groupData';
import { EventCar, EventKind, GroupEvent } from '@/types/models';
import { dayKey, parseDateTime, toDateInput, toTimeInput } from '@/utils/date';
import { hexToEventColor, randomEventColor, solidEventColor } from '@/utils/eventColor';

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
  // `date` (YYYY-MM-DD) llega cuando se crea desde un día pulsado en el
  // calendario: preselecciona ese día como inicio y fin del nuevo evento.
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
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
    editing ? toDateInput(editing.startsAt) : (date ?? dayKey()),
  );
  const [startTime, setStartTime] = useState(editing ? toTimeInput(editing.startsAt) : '18:00');
  const [endDate, setEndDate] = useState(editing ? toDateInput(editing.endsAt) : (date ?? dayKey()));
  const [endTime, setEndTime] = useState(editing ? toTimeInput(editing.endsAt) : '21:00');
  const [lockHours, setLockHours] = useState(String(editing?.voteLockHoursBefore ?? 12));
  const [isSpecial, setIsSpecial] = useState(editing?.isSpecial ?? false);
  const [kind, setKind] = useState<EventKind>(editing?.kind ?? 'standard');
  // Color del evento: null = aleatorio (o el que ya tenía, si se edita).
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [colorHexDraft, setColorHexDraft] = useState('');
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
    const finalCars =
      carsEnabled && kind !== 'specialDay' ? [...driverCars, ...temporaryCars] : [];

    const event: GroupEvent = {
      id: editing?.id ?? `e-${Date.now()}`,
      groupId: data.group.id,
      createdBy: editing?.createdBy ?? user.id,
      isSpecial: isAdmin ? isSpecial : (editing?.isSpecial ?? false),
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      mapsAddress: address.trim() || undefined,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      allDay,
      color: pickedColor ?? editing?.color ?? randomEventColor(),
      voteLockHoursBefore:
        kind === 'standard' ? Math.max(0, parseInt(lockHours, 10) || 12) : 0,
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
    fontFamily: FONT_REGULAR,
  };

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: editing ? t('events.editTitle') : t('events.create') }}
      />
      <Screen scroll style={styles.container}>
        {/* Categoría: normal (con votación), quedada informal o día especial */}
        <ThemedText variant="label">{t('events.kind')}</ThemedText>
        <View style={styles.row}>
          {(['standard', 'informal', 'specialDay'] as EventKind[]).map((k) => (
            <Pill
              key={k}
              label={t(`events.kind${k === 'standard' ? 'Standard' : k === 'informal' ? 'Informal' : 'SpecialDay'}`)}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
        <ThemedText variant="muted">
          {kind === 'standard'
            ? t('events.kindStandardHint')
            : kind === 'informal'
              ? t('events.kindInformalHint')
              : t('events.kindSpecialDayHint')}
        </ThemedText>

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

        {kind === 'standard' && (
          <TextField
            label={t('events.voteLockHours')}
            value={lockHours}
            onChangeText={setLockHours}
            keyboardType="numeric"
          />
        )}

        {/* Color del evento: aleatorio, guardado del grupo o hexadecimal */}
        <ThemedText variant="label">{t('events.color')}</ThemedText>
        <View style={styles.row}>
          <Pill
            label={t('events.colorRandom')}
            selected={pickedColor === null}
            onPress={() => setPickedColor(null)}
          />
        </View>
        {(data?.savedColors?.length ?? 0) > 0 && (
          <View style={styles.colorRow}>
            {data!.savedColors!.map((saved) => {
              const eventColor = hexToEventColor(saved.color);
              const selected = pickedColor === eventColor;
              return (
                <Pressable
                  key={saved.id}
                  onPress={() => setPickedColor(eventColor)}
                  style={styles.colorItem}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: saved.color, borderColor: theme.border },
                      selected && [styles.swatchSelected, { borderColor: theme.text }],
                    ]}
                  />
                  <ThemedText variant="muted" numberOfLines={1} style={styles.swatchName}>
                    {saved.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={[styles.row, styles.alignEnd]}>
          <View style={styles.flex}>
            <TextField
              label={t('events.colorCustom')}
              value={colorHexDraft}
              onChangeText={setColorHexDraft}
              placeholder="#1A9E75"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <View
            style={[
              styles.swatch,
              styles.colorPreview,
              {
                borderColor: theme.border,
                backgroundColor:
                  solidEventColor(pickedColor ?? editing?.color ?? undefined) ?? theme.surface,
              },
            ]}
          />
          <Button
            title={t('settings.accentApply')}
            variant="outline"
            disabled={!normalizeHexColor(colorHexDraft)}
            onPress={() => {
              const normalized = normalizeHexColor(colorHexDraft);
              if (normalized) {
                setPickedColor(hexToEventColor(normalized));
                setColorHexDraft('');
              }
            }}
          />
        </View>

        {isAdmin && (
          <View style={styles.switchRow}>
            <ThemedText>{t('events.special')}</ThemedText>
            <Switch value={isSpecial} onValueChange={setIsSpecial} />
          </View>
        )}

        {kind !== 'specialDay' && (
          <View style={styles.switchRow}>
            <ThemedText>{t('events.carsToggle')}</ThemedText>
            <Switch value={carsEnabled} onValueChange={setCarsEnabled} />
          </View>
        )}

        {carsEnabled && kind !== 'specialDay' && (
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
                      m.carDetails?.name,
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
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  alignEnd: { alignItems: 'flex-end', flexWrap: 'nowrap' },
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
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorItem: { alignItems: 'center', width: 64, gap: 2 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  swatchSelected: { borderWidth: 3 },
  swatchName: { fontSize: 11, maxWidth: 64 },
  colorPreview: { marginBottom: 6 },
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
