import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MAX_GROUPS } from '@/services/groups';

/**
 * Menú de grupos: hasta 3 grupos. Tocar uno lo convierte en el activo
 * (la pantalla principal siempre muestra el grupo activo).
 */
export default function GroupsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { group, groups, switchGroup, canAddGroup } = useAuth();

  const select = async (groupId: string) => {
    await switchGroup(groupId);
    router.replace('/(tabs)/calendar');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('groups.title') }} />
      <Screen style={styles.container}>
        <ThemedText variant="title">{t('groups.title')}</ThemedText>
        <ThemedText variant="muted">
          {t('groups.count', { count: groups.length, max: MAX_GROUPS })}
        </ThemedText>

        {groups.map((g) => {
          const isActive = g.id === group?.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => select(g.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: isActive ? theme.primary : theme.border,
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Avatar uri={g.photoUrl} name={g.name} size={48} />
              <View style={styles.flex}>
                <ThemedText variant="subtitle">{g.name}</ThemedText>
                <ThemedText variant="muted">{g.id}</ThemedText>
              </View>
              {isActive && (
                <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>
                  {t('groups.active')}
                </ThemedText>
              )}
            </Pressable>
          );
        })}

        {canAddGroup ? (
          <>
            <Button
              title={t('onboarding.createGroup')}
              variant="outline"
              onPress={() => router.push('/(onboarding)/create-group')}
            />
            <Button
              title={t('onboarding.joinGroup')}
              variant="outline"
              onPress={() => router.push('/(onboarding)/join-group')}
            />
          </>
        ) : (
          <ThemedText variant="muted">{t('groups.maxReached')}</ThemedText>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  flex: { flex: 1 },
});
