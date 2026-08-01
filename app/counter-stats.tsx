import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dayKey } from '@/utils/date';

const DAYS = 30;
const CHART_HEIGHT = 150;

/**
 * Estadísticas del contador: gráfico de barras de las contribuciones de los
 * últimos 30 días (del grupo entero o de un miembro concreto) más el desglose
 * por miembro del periodo. Todo se calcula en el cliente a partir de
 * `data.contributions` (que conserva el historial completo).
 */
export default function CounterStatsScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { data } = useGroupData();

  // null = todo el grupo; si no, filtra por ese miembro.
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  if (!data) return null;

  const memberName = (userId: string) => {
    const m = data.members.find((x) => x.userId === userId);
    return m ? (m.nickname ?? m.name) : '—';
  };

  // Claves YYYY-MM-DD de los últimos 30 días (el último es hoy).
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAYS - 1 - i));
    return dayKey(d);
  });
  const windowStart = days[0];
  const todayKey = days[days.length - 1];

  const contributions = data.contributions ?? [];
  const filtered = selectedUser
    ? contributions.filter((c) => c.userId === selectedUser)
    : contributions;

  // Conteo por día (una pasada) y serie alineada a los 30 días.
  const countsByDay = new Map<string, number>();
  for (const c of filtered) {
    const k = dayKey(c.at);
    countsByDay.set(k, (countsByDay.get(k) ?? 0) + 1);
  }
  const perDay = days.map((dk) => countsByDay.get(dk) ?? 0);
  const maxDay = Math.max(1, ...perDay);
  const total = perDay.reduce((a, b) => a + b, 0);
  const activeDays = perDay.filter((n) => n > 0).length;

  // Desglose por miembro dentro del periodo (orden descendente).
  const perMember = data.members
    .map((m) => ({
      userId: m.userId,
      name: m.nickname ?? m.name,
      count: contributions.filter((c) => c.userId === m.userId && dayKey(c.at) >= windowStart).length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxMember = Math.max(1, ...perMember.map((p) => p.count));

  const formatShortDay = (dk: string) =>
    new Date(dk + 'T12:00:00').toLocaleDateString(
      { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' }[language ?? 'es'] ?? 'es-ES',
      { day: 'numeric', month: 'short' },
    );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📈 ${t('counter.statsTitle')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('counter.statsSubtitle')}</ThemedText>

        {/* Filtro: todo el grupo o un miembro */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <Pill
              label={t('counter.statsEveryone')}
              selected={selectedUser === null}
              onPress={() => setSelectedUser(null)}
            />
            {data.members.map((m) => (
              <Pill
                key={m.userId}
                label={m.nickname ?? m.name}
                selected={selectedUser === m.userId}
                onPress={() => setSelectedUser(m.userId)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Resumen numérico del periodo */}
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.summaryItem}>
            <ThemedText variant="title">{total}</ThemedText>
            <ThemedText variant="muted" style={styles.summaryLabel}>
              {t('counter.statsTotal30')}
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText variant="title">{activeDays}</ThemedText>
            <ThemedText variant="muted" style={styles.summaryLabel}>
              {t('counter.statsActiveDays')}
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText variant="title">{maxDay}</ThemedText>
            <ThemedText variant="muted" style={styles.summaryLabel}>
              {t('counter.statsBestDay')}
            </ThemedText>
          </View>
        </View>

        {/* Gráfico de barras diario */}
        <ThemedText variant="label">{t('counter.statsDaily')}</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {total === 0 ? (
            <ThemedText variant="muted">{t('counter.statsNoData')}</ThemedText>
          ) : (
            <>
              <View style={styles.chart}>
                {perDay.map((n, i) => {
                  const isToday = days[i] === todayKey;
                  return (
                    <View key={days[i]} style={styles.barSlot}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(2, (n / maxDay) * CHART_HEIGHT),
                            backgroundColor: n === 0 ? theme.border : theme.primary,
                            opacity: isToday ? 1 : 0.85,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <View style={styles.axisRow}>
                <ThemedText variant="muted" style={styles.axisLabel}>
                  {formatShortDay(windowStart)}
                </ThemedText>
                <ThemedText variant="muted" style={styles.axisLabel}>
                  {t('counter.statsToday')}
                </ThemedText>
              </View>
            </>
          )}
        </View>

        {/* Desglose por miembro (contribuciones del periodo) */}
        <ThemedText variant="label">{t('counter.statsByMember')}</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {perMember.every((p) => p.count === 0) ? (
            <ThemedText variant="muted">{t('counter.statsNoData')}</ThemedText>
          ) : (
            perMember.map((p) => (
              <View key={p.userId} style={styles.memberRow}>
                <ThemedText numberOfLines={1} style={styles.memberName}>
                  {p.name}
                </ThemedText>
                <View style={styles.memberBarTrack}>
                  <View
                    style={[
                      styles.memberBar,
                      {
                        backgroundColor: theme.primary,
                        width: `${(p.count / maxMember) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="muted" style={styles.memberCount}>
                  {p.count}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { textAlign: 'center', fontSize: 11 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 2,
  },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 11 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { width: 90 },
  memberBarTrack: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  memberBar: { height: '100%', borderRadius: 7, minWidth: 2 },
  memberCount: { width: 28, textAlign: 'right' },
});
