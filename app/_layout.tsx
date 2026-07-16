import { Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
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
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';

import { FONT_BOLD } from '@/constants/typography';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { GroupDataProvider } from '@/contexts/GroupDataContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { refreshPushIfEnabled } from '@/services/push';
import { hasEnteredWeb } from '@/utils/webGateway';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Tipografía de toda la app: Lora (serif de Google Fonts), empaquetada
    // en el binario/bundle para que se renderice idéntica en Android y web.
    'Lora-Regular': Lora_400Regular,
    'Lora-Bold': Lora_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // En nativo el splash sigue tapando la app mientras cargan las fuentes;
  // este indicador se ve solo en web (evita el flash de texto sin fuente).
  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

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
 *   1. Sin idioma elegido       -> /language (primer arranque)
 *   2. Web sin sesión y sin      -> /gateway  (puerta de entrada solo web:
 *      cruzar la puerta todavía              entrar a la web o descargar APK)
 *   3. Sin sesión               -> /(auth)/login
 *   4. Sin grupo                -> /(onboarding)  (la app no tiene sentido sin grupo)
 *   5. Todo listo               -> /(tabs)
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
    // Solo web: antes de dejar entrar al login se muestra la puerta de entrada
    // (entrar a la web o descargar el APK), hasta que el usuario la cruce. En
    // nativo nunca aparece.
    if (Platform.OS === 'web' && !user && !hasEnteredWeb()) {
      if (section !== 'gateway') router.replace('/gateway');
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
    const entrySections = [undefined, 'index', 'language', 'gateway', '(auth)'];
    if (entrySections.includes(section)) router.replace('/(tabs)/calendar');
  }, [booted, language, user, group, segments, router]);
}

function RootNavigator() {
  const { scheme, theme, isReady: themeReady } = useTheme();
  const { isReady: languageReady, language } = useLanguage();
  const { isLoading: authLoading, user } = useAuth();

  // Preferencias e intento de restaurar sesión leídos: la app puede decidir ruta.
  const booted = languageReady && themeReady && !authLoading;

  useAuthGate(booted);

  // Con sesión iniciada y permiso ya concedido, refresca el token/suscripción
  // de push de este dispositivo (rotan con el tiempo). No pide permisos.
  useEffect(() => {
    if (user) refreshPushIfEnabled();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza el idioma al doc del usuario: el servidor lo usa para enviar
  // los recordatorios de votación en el idioma de cada destinatario.
  useEffect(() => {
    if (!user || !language || user.language === language) return;
    const { getFirebase } = require('@/services/firebase');
    const { doc, updateDoc } = require('@firebase/firestore');
    updateDoc(doc(getFirebase().db, 'users', user.id), { language }).catch(() => {});
  }, [user?.id, user?.language, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (booted) SplashScreen.hideAsync();
  }, [booted]);

  // No pintar la app hasta conocer el tema guardado: si no, en web el primer
  // frame sale con el tema del sistema y "cambia" al llegar la preferencia
  // (en nativo este hueco lo tapa el splash).
  if (!themeReady) return null;

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
      <Stack
        screenOptions={{
          headerShown: false,
          headerTitleStyle: { fontFamily: FONT_BOLD },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="gateway" />
        <Stack.Screen name="language" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
