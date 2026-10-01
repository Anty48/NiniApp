import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { CHANGELOG_VERSIONS, ChangelogCard } from '@/components/features/ChangelogCard';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/contexts/LanguageContext';

/** Registro de cambios completo de la app, accesible desde el Perfil. */
export default function ChangelogScreen() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('changelog.title') }} />
      <Screen scroll style={styles.container}>
        {CHANGELOG_VERSIONS.map((version) => (
          <ChangelogCard key={version} version={version} />
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
});
