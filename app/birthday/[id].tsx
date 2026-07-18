import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatEventRange } from '@/utils/date';

/**
 * Detalle de un cumpleaños del calendario (evento sintético, no guardado).
 * Se entra con /birthday/{userId}?date=YYYY-MM-DD; tocar a la persona abre
 * su perfil.
 */
export default function BirthdayDetailScreen() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { data } = useGroupData();

  const member = data?.members.find((m) => m.userId === id);

  if (!data || !member) {
    return (
      <Screen style={styles.center}>
        <ThemedText variant="title">404</ThemedText>
      </Screen>
    );
  }

  const name = member.nickname ?? member.name;
  const title = t('events.birthdayOf', { name });
  const day = date
    ? formatEventRange(
        { startsAt: `${date}T00:00:00`, endsAt: `${date}T23:59:00`, allDay: true },
        language,
      )
    : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <Screen scroll style={styles.container}>
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={styles.bigEmoji}>🎂</ThemedText>
          <ThemedText variant="title" style={styles.centerText}>
            {title}
          </ThemedText>
          {day && <ThemedText variant="muted">{day}</ThemedText>}
          <ThemedText style={{ color: theme.primary }}>{t('events.specialDayBadge')}</ThemedText>
        </View>

        {/* La persona: tócala para abrir su perfil */}
        <Pressable
          onPress={() => router.push({ pathname: '/member/[id]', params: { id: member.userId } })}
          style={({ pressed }) => [
            styles.memberRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && { opacity: 0.7 },
          ]}>
          <Avatar uri={member.photoUrl} name={name} size={48} />
          <View style={styles.flex}>
            <ThemedText variant="subtitle">{name}</ThemedText>
            <ThemedText variant="muted">{t('member.viewProfile')}</ThemedText>
          </View>
          <ThemedText style={{ color: theme.primary, fontSize: 18 }}>›</ThemedText>
        </Pressable>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  hero: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 6 },
  bigEmoji: { fontSize: 48 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  flex: { flex: 1 },
});
