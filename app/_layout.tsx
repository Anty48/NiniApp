import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { GroupDataProvider } from '@/contexts/GroupDataContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) return null;

  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <GroupDataProvider>
            <RootNavigator />
          </GroupDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

/**
 * Guard central de navegación. Orden de prioridad:
 *   1. Sin idioma elegido  -> /language (primer arranque)
 *   2. Sin sesión          -> /(auth)/login
 *   3. Sin grupo           -> /(onboarding)  (la app no tiene sentido sin grupo)
 *   4. Todo listo          -> /(tabs)
 */
function useAuthGate(booted: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const { language } = useLanguage();
  const { user, group } = useAuth();

  useEffect(() => {
    if (!booted) return;
    const section = segments[0] as string | undefined;

    if (!language) {
      if (section !== 'language') router.replace('/language');
      return;
    }
    if (!user) {
      if (section !== '(auth)') router.replace('/(auth)/login');
      return;
    }
    if (!group) {
      if (section !== '(onboarding)') router.replace('/(onboarding)/welcome');
      return;
    }
    // Con todo en orden, solo se expulsa al usuario de las secciones de
    // "entrada"; el resto de rutas son libres — incluido (onboarding), que
    // también sirve para crear/unirse a un 2º o 3º grupo desde el menú.
    const entrySections = [undefined, 'index', 'language', '(auth)'];
    if (entrySections.includes(section)) router.replace('/(tabs)/calendar');
  }, [booted, language, user, group, segments, router]);
}

function RootNavigator() {
  const { scheme, theme } = useTheme();
  const { isReady: languageReady } = useLanguage();
  const { isLoading: authLoading } = useAuth();

  // Preferencias e intento de restaurar sesión leídos: la app puede decidir ruta.
  const booted = languageReady && !authLoading;

  useAuthGate(booted);

  useEffect(() => {
    if (booted) SplashScreen.hideAsync();
  }, [booted]);

  const baseNavTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="language" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
