import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PollsContent } from '@/components/features/PollsContent';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Encuestas rápidas del grupo. El contenido vive en <PollsContent> (compartido
 * con el acceso rápido de la pestaña central).
 */
export default function PollsScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `📊 ${t('groupTab.polls')}` }} />
      <Screen scroll style={styles.container}>
        <PollsContent />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
});
