import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Loading } from '@/components/ui/Loading';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Lista de miembros del grupo: rejilla de avatares; cada uno abre su perfil.
 * Se llega desde la pestaña Grupo como una pantalla propia.
 */
export default function MembersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data, isLoading } = useGroupData();

  if (isLoading || !data) {
    return (
      <Screen style={styles.center}>
        <Loading />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `👥 ${t('groupTab.members')}` }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">
          {t('groupTab.membersCount', { count: data.members.length })}
        </ThemedText>
        <View style={styles.grid}>
          {data.members.map((member) => (
            <Pressable
              key={member.userId}
              onPress={() => router.push({ pathname: '/member/[id]', params: { id: member.userId } })}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
              <Avatar uri={member.photoUrl} name={member.nickname ?? member.name} size={64} />
              <ThemedText numberOfLines={1} style={styles.name}>
                {member.nickname ?? member.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  item: { alignItems: 'center', width: 80, gap: 6 },
  name: { fontSize: 12, maxWidth: 80, textAlign: 'center' },
});
