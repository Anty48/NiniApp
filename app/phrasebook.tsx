import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { phrasesByAuthor } from '@/services/groupData';
import { confirmAsync } from '@/utils/confirm';

/** Autor elegido en el formulario: un miembro o alguien de fuera del grupo. */
type AuthorChoice = { memberId?: string; external: boolean };

/**
 * Frasario de verdad: frases memorables guardadas en el grupo, agrupadas por
 * autor en orden alfabético, estilo documento de texto. Cualquier miembro
 * puede añadir frases (de miembros o de gente externa) y editar las de
 * cualquiera.
 */
export default function PhrasebookScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { data, addPhrase, updatePhrase, deletePhrase } = useGroupData();

  const [adding, setAdding] = useState(false);
  const [author, setAuthor] = useState<AuthorChoice>({ external: false });
  const [externalName, setExternalName] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  if (!data) return null;

  const sections = phrasesByAuthor(data.phrases ?? [], data.members);

  const openAdd = (memberId?: string) => {
    setAuthor({ memberId, external: false });
    setExternalName('');
    setText('');
    setAdding(true);
    setEditingId(null);
  };

  const save = async () => {
    const phrase = text.trim();
    const external = externalName.trim();
    if (!phrase || !user) return;
    if (!author.memberId && !external) return;
    setSaving(true);
    await addPhrase({
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: phrase,
      memberId: author.memberId,
      externalName: author.memberId ? undefined : external,
      addedBy: user.id,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    setAdding(false);
  };

  const startEdit = (phraseId: string, current: string) => {
    setEditingId(phraseId);
    setEditText(current);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await updatePhrase(editingId, editText.trim());
    setEditingId(null);
  };

  const removePhrase = async (phraseId: string) => {
    const ok = await confirmAsync({
      title: t('phrasebook.deleteTitle'),
      message: t('phrasebook.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deletePhrase(phraseId);
    setEditingId(null);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📖 ${t('groupTab.phrasebook')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('phrasebook.subtitle')}</ThemedText>

        {!adding && (
          <Button title={t('phrasebook.add')} variant="outline" onPress={() => openAdd()} />
        )}

        {/* Formulario de nueva frase */}
        {adding && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText variant="label">{t('phrasebook.author')}</ThemedText>
            <View style={styles.pillRow}>
              {data.members.map((m) => (
                <Pill
                  key={m.userId}
                  label={m.nickname ?? m.name}
                  selected={author.memberId === m.userId}
                  onPress={() => setAuthor({ memberId: m.userId, external: false })}
                />
              ))}
              <Pill
                label={t('phrasebook.external')}
                selected={author.external}
                onPress={() => setAuthor({ external: true })}
              />
            </View>
            {author.external && (
              <TextField
                label={t('phrasebook.externalName')}
                value={externalName}
                onChangeText={setExternalName}
                placeholder={t('phrasebook.externalPlaceholder')}
              />
            )}
            <TextField
              label={t('phrasebook.phrase')}
              value={text}
              onChangeText={setText}
              placeholder={t('phrasebook.phrasePlaceholder')}
              multiline
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  title={t('common.save')}
                  onPress={save}
                  loading={saving}
                  disabled={!text.trim() || (!author.memberId && !externalName.trim())}
                />
              </View>
              <View style={styles.flex}>
                <Button title={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
              </View>
            </View>
          </View>
        )}

        {/* El frasario, estilo documento: autores en orden alfabético */}
        {sections.length === 0 && !adding && (
          <ThemedText variant="muted">{t('phrasebook.empty')}</ThemedText>
        )}
        {sections.map((section) => (
          <View key={section.memberId ?? `ext-${section.author}`} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="subtitle" style={styles.flex}>
                {section.author}
              </ThemedText>
              <Pressable
                onPress={() => openAdd(section.memberId)}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}>
                <ThemedText style={{ color: theme.primary, fontSize: 20, fontWeight: '700' }}>
                  +
                </ThemedText>
              </Pressable>
            </View>
            {section.phrases.map((phrase) =>
              editingId === phrase.id ? (
                <View
                  key={phrase.id}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextField
                    label={t('phrasebook.phrase')}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                  />
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Button title={t('common.save')} onPress={saveEdit} disabled={!editText.trim()} />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={t('common.delete')}
                        variant="outline"
                        style={{ borderColor: theme.danger }}
                        onPress={() => removePhrase(phrase.id)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={t('common.cancel')}
                        variant="ghost"
                        onPress={() => setEditingId(null)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View key={phrase.id} style={styles.phraseRow}>
                  <ThemedText style={styles.flex}>{`"${phrase.text}"`}</ThemedText>
                  <Pressable
                    onPress={() => startEdit(phrase.id, phrase.text)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && { opacity: 0.6 }}>
                    <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
                  </Pressable>
                </View>
              ),
            )}
          </View>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  section: { gap: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  phraseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 8 },
});
