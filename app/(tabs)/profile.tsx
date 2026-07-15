import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { openApkDownload } from '@/constants/download';
import { useAuth } from '@/contexts/AuthContext';
import { useGroupData } from '@/contexts/GroupDataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeMode, useTheme } from '@/contexts/ThemeContext';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';

/** Perfil propio, estadísticas en el grupo y ajustes de la app. */
export default function ProfileScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { theme, mode, setMode } = useTheme();
  const { user, group, signOut } = useAuth();
  const { me, updateMyProfile } = useGroupData();

  const themeModes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
    { value: 'system', label: t('settings.system') },
  ];

  return (
    <Screen scroll>
      <ThemedText variant="title">{t('tabs.profile')}</ThemedText>

      {/* Tarjeta de usuario */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.userRow}>
          <Avatar uri={user?.photoUrl} name={user?.username ?? '?'} size={56} />
          <View style={styles.flex}>
            <ThemedText variant="subtitle">{user?.nickname ?? user?.username}</ThemedText>
            <ThemedText variant="muted">{user?.email}</ThemedText>
            {group && (
              <ThemedText variant="muted">
                {group.name} · {group.id}
              </ThemedText>
            )}
          </View>
        </View>
        {user?.description && <ThemedText variant="muted">{user.description}</ThemedText>}
        {me && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <ThemedText variant="title">{Math.round(me.commitmentScore)}%</ThemedText>
              <ThemedText variant="muted">{t('profile.myCommitment')}</ThemedText>
            </View>
            <View style={styles.stat}>
              <ThemedText variant="title">{me.counterContributions}</ThemedText>
              <ThemedText variant="muted">{t('profile.myContributions')}</ThemedText>
            </View>
          </View>
        )}
      </View>

      <Button
        title={t('profile.editProfile')}
        variant="outline"
        onPress={() => router.push('/edit-profile')}
      />
      <Button
        title={t('profile.groupSettings')}
        variant="outline"
        onPress={() => router.push('/group-settings')}
      />
      <Button
        title={t('groups.change')}
        variant="outline"
        onPress={() => router.push('/groups')}
      />
      {me?.isDriver && (
        <Button
          title={`🚗 ${t('drivers.title')}`}
          variant="outline"
          onPress={() => router.push('/drivers-zone')}
        />
      )}
      <Button
        title={t('extras.title')}
        variant="outline"
        onPress={() => router.push('/extras')}
      />
      <Button
        title={t('suggestions.title')}
        variant="outline"
        onPress={() => router.push('/suggestions')}
      />
      <Button
        title={t('help.title')}
        variant="outline"
        onPress={() => router.push('/help')}
      />
      {/* Descargar el APK de Android: solo tiene sentido desde la web. */}
      {Platform.OS === 'web' && (
        <Button
          title={t('profile.downloadApp')}
          variant="outline"
          onPress={openApkDownload}
        />
      )}

      {/* Función "Tocar": activada por defecto, desactivable */}
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <ThemedText>{t('poke.setting')}</ThemedText>
          <ThemedText variant="muted">{t('poke.settingHint')}</ThemedText>
        </View>
        <Switch
          value={user?.allowPokes ?? true}
          onValueChange={(value) => updateMyProfile({ allowPokes: value })}
        />
      </View>

      <ThemedText variant="label">{t('settings.appearance')}</ThemedText>
      <View style={styles.row}>
        {themeModes.map((item) => (
          <Pill
            key={item.value}
            label={item.label}
            selected={mode === item.value}
            onPress={() => setMode(item.value)}
          />
        ))}
      </View>

      <ThemedText variant="label">{t('settings.language')}</ThemedText>
      <View style={styles.row}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Pill
            key={lang}
            label={LANGUAGE_LABELS[lang]}
            selected={language === lang}
            onPress={() => setLanguage(lang)}
          />
        ))}
      </View>

      <Button title={t('common.logout')} onPress={signOut} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
});
