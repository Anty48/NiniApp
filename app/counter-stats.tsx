import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { longestGroupStreak } from '@/services/groupData';
import { dayKey, weekdayLabels } from '@/utils/date';

const PERIODS = [7, 30, 90] as const;
const CHART_HEIGHT = 150;
const WEEKDAY_CHART_HEIGHT = 96;

/** Menor valor "redondo" (1,2,3,4,5,6,8,10...) mayor o igual que n. */
function niceStep(n: number): number {
  const value = Math.max(1, n);
  const pow = Math.pow(10, Math.max(0, Math.floor(Math.log10(value))));
  for (const base of [1, 2, 3, 4, 5, 6, 8, 10]) {
    if (base * pow >= value) return base * pow;
  }
  return 10 * pow;
}

/**
 * Estadísticas del contador: resumen del periodo, gráfico diario con guías,
 * reparto por día de la semana y desglose por miembro. Todo se calcula en el
 * cliente a partir de `data.contributions` (historial completo) con Views
 * puras, sin librería de charts.
 */
export default function CounterStatsScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { data } = useGroupData();

  // null = todo el grupo; si no, filtra por ese miembro.
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);

  if (!data) return null;

  // Claves YYYY-MM-DD de los últimos `days` días (el último es hoy).
  const today = new Date();
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    return dayKey(d);
  });
  const windowStart = dayKeys[0];
  const todayKey = dayKeys[dayKeys.length - 1];

  const contributions = data.contributions ?? [];
  const filtered = selectedUser
    ? contributions.filter((c) => c.userId === selectedUser)
    : contributions;

  // Conteo por día y serie alineada al periodo.
  const countsByDay = new Map<string, number>();
  for (const c of filtered) {
    const k = dayKey(c.at);
    countsByDay.set(k, (countsByDay.get(k) ?? 0) + 1);
  }
  const perDay = dayKeys.map((dk) => countsByDay.get(dk) ?? 0);
  const maxDay = Math.max(1, ...perDay);
  const total = perDay.reduce((a, b) => a + b, 0);
  const activeDays = perDay.filter((n) => n > 0).length;
  const avgActive = activeDays ? (total / activeDays).toFixed(1) : '0';

  // Eje Y con guías: 4 intervalos "redondos" y enteros.
  const step = niceStep(Math.ceil(maxDay / 4));
  const axisMax = step * 4;
  const levels = [4, 3, 2, 1, 0].map((i) => i * step); // de arriba abajo

  // Rachas (siempre del grupo, no del miembro filtrado).
  const currentStreak = data.counter?.streakDays ?? 0;
  const bestStreak = Math.max(currentStreak, longestGroupStreak(data));

  // Reparto por día de la semana dentro del periodo (lunes = 0).
  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const c of filtered) {
    const k = dayKey(c.at);
    if (k < windowStart || k > todayKey) continue;
    const wd = (new Date(k + 'T12:00:00').getDay() + 6) % 7;
    perWeekday[wd]++;
  }
  const maxWeekday = Math.max(1, ...perWeekday);
  const wdLabels = weekdayLabels(language).map((s) => s.charAt(0).toUpperCase());

  // Desglose por miembro dentro del periodo (orden descendente).
  const perMember = data.members
    .map((m) => ({
      userId: m.userId,
      name: m.nickname ?? m.name,
      count: contributions.filter(
        (c) => c.userId === m.userId && dayKey(c.at) >= windowStart && dayKey(c.at) <= todayKey,
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  const memberTotal = perMember.reduce((a, b) => a + b.count, 0);
  const maxMember = Math.max(1, ...perMember.map((p) => p.count));

  const formatShortDay = (dk: string) =>
    new Date(dk + 'T12:00:00').toLocaleDateString(
      { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' }[language ?? 'es'] ?? 'es-ES',
      { day: 'numeric', month: 'short' },
    );

  const summary: { value: string | number; label: string }[] = [
    { value: total, label: t('counter.statsTotalPeriod', { days }) },
    { value: activeDays, label: t('counter.statsActiveDays') },
    { value: avgActive, label: t('counter.statsAvgActive') },
    { value: maxDay, label: t('counter.statsBestDay') },
    { value: currentStreak, label: t('counter.statsCurrentStreak') },
    { value: bestStreak, label: t('counter.statsBestStreak') },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📈 ${t('counter.statsTitle')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('counter.statsSubtitle')}</ThemedText>

        {/* Periodo */}
        <View style={styles.filterRow}>
          {PERIODS.map((p) => (
            <Pill
              key={p}
              label={t('counter.statsDays', { days: p })}
              selected={days === p}
              onPress={() => setDays(p)}
            />
          ))}
        </View>

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

        {/* Resumen numérico del periodo (2 filas de 3) */}
        <View style={styles.summaryGrid}>
          {summary.map((s) => (
            <View
              key={s.label}
              style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText variant="title">{s.value}</ThemedText>
              <ThemedText variant="muted" style={styles.summaryLabel}>
                {s.label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Gráfico de barras diario con guías */}
        <ThemedText variant="label">{t('counter.statsDaily')}</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {total === 0 ? (
            <ThemedText variant="muted">{t('counter.statsNoData')}</ThemedText>
          ) : (
            <>
              <View style={styles.chartArea}>
                {/* Etiquetas del eje Y */}
                <View style={styles.axisLabels}>
                  {levels.map((v) => (
                    <ThemedText
                      key={v}
                      variant="muted"
                      style={[styles.axisValue, { bottom: (v / axisMax) * CHART_HEIGHT - 7 }]}>
                      {v}
                    </ThemedText>
                  ))}
                </View>
                {/* Zona de trazado: guías + barras */}
                <View style={styles.plot}>
                  {levels.map((v) => (
                    <View
                      key={v}
                      style={[
                        styles.gridLine,
                        { backgroundColor: theme.border, bottom: (v / axisMax) * CHART_HEIGHT },
                      ]}
                    />
                  ))}
                  <View style={styles.bars}>
                    {perDay.map((n, i) => {
                      const isToday = dayKeys[i] === todayKey;
                      return (
                        <View key={dayKeys[i]} style={styles.barSlot}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max(n > 0 ? 2 : 0, (n / axisMax) * CHART_HEIGHT),
                                backgroundColor: theme.primary,
                                opacity: isToday ? 1 : 0.8,
                              },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
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

        {/* Reparto por día de la semana */}
        <ThemedText variant="label">{t('counter.statsByWeekday')}</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {total === 0 ? (
            <ThemedText variant="muted">{t('counter.statsNoData')}</ThemedText>
          ) : (
            <View style={styles.weekdayRow}>
              {perWeekday.map((n, i) => (
                <View key={i} style={styles.weekdayCol}>
                  <ThemedText variant="muted" style={styles.weekdayCount}>
                    {n}
                  </ThemedText>
                  <View style={styles.weekdayTrack}>
                    <View
                      style={[
                        styles.weekdayBar,
                        {
                          height: Math.max(n > 0 ? 3 : 0, (n / maxWeekday) * WEEKDAY_CHART_HEIGHT),
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText variant="muted" style={styles.weekdayLabel}>
                    {wdLabels[i]}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Desglose por miembro (contribuciones del periodo) */}
        <ThemedText variant="label">{t('counter.statsByMember')}</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {perMember.every((p) => p.count === 0) ? (
            <ThemedText variant="muted">{t('counter.statsNoData')}</ThemedText>
          ) : (
            perMember.map((p) => {
              const pct = memberTotal ? Math.round((p.count / memberTotal) * 100) : 0;
              return (
                <View key={p.userId} style={styles.memberRow}>
                  <ThemedText numberOfLines={1} style={styles.memberName}>
                    {p.name}
                  </ThemedText>
                  <View style={[styles.memberBarTrack, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.memberBar,
                        { backgroundColor: theme.primary, width: `${(p.count / maxMember) * 100}%` },
                      ]}
                    />
                  </View>
                  <ThemedText variant="muted" style={styles.memberCount}>
                    {p.count}
                    <ThemedText variant="muted" style={styles.memberPct}>
                      {'  '}
                      {pct}%
                    </ThemedText>
                  </ThemedText>
                </View>
              );
            })
          )}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, flexWrap: 'wrap' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 2,
  },
  summaryLabel: { textAlign: 'center', fontSize: 11 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  chartArea: { flexDirection: 'row', height: CHART_HEIGHT },
  axisLabels: { width: 24, height: CHART_HEIGHT, position: 'relative', marginRight: 6 },
  axisValue: { position: 'absolute', right: 0, fontSize: 10, lineHeight: 14 },
  plot: { flex: 1, height: CHART_HEIGHT, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  bars: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 11 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekdayCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekdayCount: { fontSize: 11 },
  weekdayTrack: { height: WEEKDAY_CHART_HEIGHT, justifyContent: 'flex-end' },
  weekdayBar: { width: 16, borderRadius: 3 },
  weekdayLabel: { fontSize: 11 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { width: 84 },
  memberBarTrack: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  memberBar: { height: '100%', borderRadius: 7, minWidth: 2 },
  memberCount: { width: 72, textAlign: 'right' },
  memberPct: { fontSize: 11 },
});
