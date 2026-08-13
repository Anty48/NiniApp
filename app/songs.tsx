import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { SongsContent } from '@/components/features/SongsContent';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Canciones del grupo. El contenido vive en <SongsContent> (compartido con el
 * acceso rápido de la pestaña central).
 */
export default function SongsScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `🎵 ${t('groupTab.songs')}` }} />
      <Screen scroll style={styles.container}>
        <SongsContent />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
});
