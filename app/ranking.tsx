import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { LeaderboardContent } from '@/components/features/LeaderboardContent';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Ranking del grupo (por compromiso, contribuciones o copipuntos). El contenido
 * vive en <LeaderboardContent>, compartido con el acceso rápido de la pestaña
 * central; aquí es una pantalla propia a la que se llega desde la pestaña Grupo.
 */
export default function RankingScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `🏆 ${t('groupTab.ranking')}` }} />
      <Screen scroll style={styles.container}>
        <LeaderboardContent />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 40 },
});
