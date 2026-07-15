import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { GroupEvent } from '@/types/models';
import { buildMonthGrid, dayKey, eventsOnDay, monthLabel, weekdayLabels } from '@/utils/date';

const MAX_BARS_PER_DAY = 3;

interface MonthCalendarProps {
  month: Date;
  onChangeMonth: (month: Date) => void;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  events: GroupEvent[];
  language: string | null;
}

/** Calendario mensual "de verdad": cuadrícula de días con barras de color por evento. */
export function MonthCalendar({
  month,
  onChangeMonth,
  selectedDay,
  onSelectDay,
  events,
  language,
}: MonthCalendarProps) {
  const { theme } = useTheme();
  const days = buildMonthGrid(month);
  const weekdays = weekdayLabels(language);
  const today = dayKey();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          style={styles.navButton}>
          <ThemedText style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>‹</ThemedText>
        </Pressable>
        <ThemedText variant="subtitle">{monthLabel(month, language)}</ThemedText>
        <Pressable
          onPress={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          style={styles.navButton}>
          <ThemedText style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((w, i) => (
          <ThemedText key={i} variant="muted" style={styles.weekdayCell}>
            {w}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = key === today;
          const isSelected = key === selectedDay;
          const dayEvents = eventsOnDay(events, key);
          return (
            <Pressable
              key={key}
              onPress={() => onSelectDay(key)}
              style={[
                styles.dayCell,
                { borderColor: isSelected ? theme.primary : 'transparent' },
              ]}>
              <View
                style={[
                  styles.dayNumberWrap,
                  isToday && { backgroundColor: theme.primary },
                ]}>
                <ThemedText
                  style={{
                    color: isToday ? theme.onPrimary : inMonth ? theme.text : theme.textMuted,
                    fontWeight: isToday ? '700' : '400',
                    fontSize: 13,
                  }}>
                  {d.getDate()}
                </ThemedText>
              </View>
              <View style={styles.bars}>
                {dayEvents.slice(0, MAX_BARS_PER_DAY).map((e) => (
                  <View
                    key={e.id}
                    style={[styles.bar, { backgroundColor: e.color ?? theme.primary }]}
                  />
                ))}
                {dayEvents.length > MAX_BARS_PER_DAY && (
                  <ThemedText variant="muted" style={styles.moreLabel}>
                    +{dayEvents.length - MAX_BARS_PER_DAY}
                  </ThemedText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navButton: { paddingHorizontal: 14, paddingVertical: 4 },
  weekRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, textAlign: 'center', fontSize: 12, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  dayNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { alignItems: 'center', gap: 2, width: '100%' },
  bar: { height: 4, width: '70%', borderRadius: 2 },
  moreLabel: { fontSize: 9 },
});
