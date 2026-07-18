import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { FONT_REGULAR } from '@/constants/typography';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { POLL_TTL_MS } from '@/services/groupData';

/**
 * Encuestas rápidas: cualquiera crea una (con push al resto), se borran
 * solas a las 24 h y no afectan a nada más. El creador decide anonimato y
 * si se pueden marcar varias opciones.
 */
export default function PollsScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, createPoll, votePoll } = useGroupData();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const [multi, setMulti] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!data) return null;

  const polls = [...(data.polls ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const memberName = (userId: string) => {
    const m = data.members.find((x) => x.userId === userId);
    return m ? (m.nickname ?? m.name) : '—';
  };

  const validOptions = options.map((o) => o.trim()).filter(Boolean);

  const create = async () => {
    if (!user || !title.trim() || validOptions.length < 2) return;
    setSaving(true);
    await createPoll({
      id: `poll-${Date.now()}`,
      title: title.trim(),
      options: validOptions,
      anonymous,
      multi,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      votes: {},
    });
    setSaving(false);
    setCreating(false);
    setTitle('');
    setOptions(['', '']);
    setAnonymous(false);
    setMulti(false);
  };

  const toggleVote = async (pollId: string, optionIndex: number) => {
    if (!user) return;
    const poll = data.polls?.find((p) => p.id === pollId);
    if (!poll) return;
    const mine = poll.votes[user.id] ?? [];
    let next: number[];
    if (poll.multi) {
      next = mine.includes(optionIndex)
        ? mine.filter((i) => i !== optionIndex)
        : [...mine, optionIndex];
    } else {
      next = mine.includes(optionIndex) ? [] : [optionIndex];
    }
    await votePoll(pollId, next);
  };

  const inputStyle = {
    backgroundColor: theme.background,
    borderColor: theme.border,
    color: theme.text,
    fontFamily: FONT_REGULAR,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📊 ${t('groupTab.polls')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('polls.subtitle')}</ThemedText>

        {!creating && (
          <Button title={t('polls.create')} variant="outline" onPress={() => setCreating(true)} />
        )}

        {/* Formulario de nueva encuesta */}
        {creating && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextField label={t('polls.formTitle')} value={title} onChangeText={setTitle} />
            <ThemedText variant="label">{t('polls.options')}</ThemedText>
            {options.map((option, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  value={option}
                  onChangeText={(text) =>
                    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)))
                  }
                  placeholder={t('polls.optionPlaceholder', { number: index + 1 })}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.optionInput, styles.flex, inputStyle]}
                />
                {options.length > 2 && (
                  <Pressable
                    onPress={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    style={styles.removeButton}>
                    <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
            <Button
              title={t('polls.addOption')}
              variant="outline"
              onPress={() => setOptions((prev) => [...prev, ''])}
            />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <ThemedText>{t('polls.anonymous')}</ThemedText>
                <ThemedText variant="muted">{t('polls.anonymousHint')}</ThemedText>
              </View>
              <Switch value={anonymous} onValueChange={setAnonymous} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <ThemedText>{t('polls.multi')}</ThemedText>
              </View>
              <Switch value={multi} onValueChange={setMulti} />
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  title={t('polls.publish')}
                  onPress={create}
                  loading={saving}
                  disabled={!title.trim() || validOptions.length < 2}
                />
              </View>
              <View style={styles.flex}>
                <Button title={t('common.cancel')} variant="ghost" onPress={() => setCreating(false)} />
              </View>
            </View>
          </View>
        )}

        {/* Encuestas activas */}
        {polls.length === 0 && !creating && (
          <ThemedText variant="muted">{t('polls.empty')}</ThemedText>
        )}
        {polls.map((poll) => {
          const mine = (user && poll.votes[user.id]) || [];
          const voters = Object.keys(poll.votes).filter((uid) => poll.votes[uid].length > 0);
          const hoursLeft = Math.max(
            1,
            Math.ceil((new Date(poll.createdAt).getTime() + POLL_TTL_MS - Date.now()) / 3_600_000),
          );
          return (
            <View
              key={poll.id}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText variant="subtitle">{poll.title}</ThemedText>
              <ThemedText variant="muted">
                {memberName(poll.createdBy)} · {t('polls.expiresIn', { hours: hoursLeft })}
                {poll.multi ? ` · ${t('polls.multiBadge')}` : ''}
                {poll.anonymous ? ` · ${t('polls.anonymousBadge')}` : ''}
              </ThemedText>
              {poll.options.map((option, index) => {
                const optionVoters = voters.filter((uid) => poll.votes[uid].includes(index));
                const selected = mine.includes(index);
                return (
                  <Pressable
                    key={index}
                    onPress={() => toggleVote(poll.id, index)}
                    style={({ pressed }) => [
                      styles.pollOption,
                      {
                        backgroundColor: selected ? theme.primary + '22' : theme.background,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <View style={styles.pollOptionHeader}>
                      <ThemedText style={[styles.flex, selected && { fontWeight: '600' }]}>
                        {selected ? '● ' : '○ '}
                        {option}
                      </ThemedText>
                      <ThemedText variant="muted">{optionVoters.length}</ThemedText>
                    </View>
                    {!poll.anonymous && optionVoters.length > 0 && (
                      <ThemedText variant="muted" style={styles.votersLine}>
                        {optionVoters.map(memberName).join(', ')}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
              <ThemedText variant="muted">
                {t('polls.votersCount', { count: voters.length })}
              </ThemedText>
            </View>
          );
        })}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  optionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  optionInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  removeButton: { padding: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pollOption: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  pollOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  votersLine: { fontSize: 12, paddingLeft: 18 },
});
