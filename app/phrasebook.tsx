import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PhrasebookContent } from '@/components/features/PhrasebookContent';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Frasario de verdad: frases memorables guardadas en el grupo, agrupadas por
 * autor. El contenido vive en <PhrasebookContent> (compartido con el acceso
 * rápido de la pestaña central).
 */
export default function PhrasebookScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📖 ${t('groupTab.phrasebook')}` }} />
      <Screen scroll style={styles.container}>
        <PhrasebookContent />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
});
