import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { haversineKm, IFAE_COORDS } from '@/utils/geo';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const PANTOGRAPH_WIKI_URL = 'https://es.wikipedia.org/wiki/Pant%C3%B3grafo_(ferrocarril)';
const MYSTERY_YOUTUBE_URL = 'https://www.youtube.com/watch?v=lzmWzXLPa6I';

/**
 * "Funciones extra inútiles": cuatro utilidades locales sin ninguna utilidad
 * práctica y por eso imprescindibles. Nada de esta pantalla toca Firebase.
 */
export default function ExtrasScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  // ---------- A. Distancia al IFAE (solo en local, nunca se persiste) ----------
  const [ifaeState, setIfaeState] = useState<
    { kind: 'idle' } | { kind: 'locating' } | { kind: 'km'; km: number } | { kind: 'error'; msg: string }
  >({ kind: 'idle' });

  const locateIfae = async () => {
    setIfaeState({ kind: 'locating' });
    let Location: typeof import('expo-location');
    try {
      // Carga perezosa: los development builds anteriores a esta función no
      // incluyen el módulo nativo y el require lanzaría al abrir la pantalla.
      Location = require('expo-location');
    } catch {
      setIfaeState({ kind: 'error', msg: t('extras.ifaeUnavailable') });
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIfaeState({ kind: 'error', msg: t('extras.ifaeDenied') });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const km = haversineKm(
        pos.coords.latitude,
        pos.coords.longitude,
        IFAE_COORDS.latitude,
        IFAE_COORDS.longitude,
      );
      setIfaeState({ kind: 'km', km });
    } catch {
      setIfaeState({ kind: 'error', msg: t('extras.ifaeError') });
    }
  };

  // ---------- B. Dado virtual ----------
  const [face, setFace] = useState(5); // ⚅ de bienvenida
  const [rolling, setRolling] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const shuffleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (shuffleTimer.current) clearInterval(shuffleTimer.current);
  }, []);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    // Mientras gira, la cara va cambiando al azar para dar sensación de tirada.
    shuffleTimer.current = setInterval(
      () => setFace(Math.floor(Math.random() * 6)),
      100,
    );
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (shuffleTimer.current) clearInterval(shuffleTimer.current);
      setFace(Math.floor(Math.random() * 6)); // resultado final
      setRolling(false);
    });
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });
  const scale = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1] });

  // ---------- C. El pantógrafo ----------
  const openPantograph = () => WebBrowser.openBrowserAsync(PANTOGRAPH_WIKI_URL);

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('extras.title') }} />
      <Screen scroll style={styles.container}>
        <ThemedText variant="muted">{t('extras.subtitle')}</ThemedText>

        {/* A. Distancia al IFAE */}
        <View style={card}>
          <ThemedText variant="subtitle">{t('extras.ifaeTitle')}</ThemedText>
          <ThemedText variant="muted">{t('extras.ifaeDesc')}</ThemedText>
          {ifaeState.kind === 'km' && (
            <View style={[styles.resultBox, { borderColor: theme.primary }]}>
              <ThemedText variant="title" style={{ color: theme.primary }}>
                {ifaeState.km.toFixed(1)} km
              </ThemedText>
              <ThemedText variant="muted">{t('extras.ifaeResultHint')}</ThemedText>
            </View>
          )}
          {ifaeState.kind === 'error' && (
            <ThemedText style={{ color: theme.danger }}>{ifaeState.msg}</ThemedText>
          )}
          <Button
            title={t('extras.ifaeButton')}
            onPress={locateIfae}
            loading={ifaeState.kind === 'locating'}
          />
          <ThemedText variant="muted" style={styles.small}>
            🔒 {t('extras.ifaePrivacy')}
          </ThemedText>
        </View>

        {/* B. Dado virtual */}
        <View style={card}>
          <ThemedText variant="subtitle">🎲 {t('extras.diceTitle')}</ThemedText>
          <View style={styles.diceArea}>
            <Animated.Text
              style={[
                styles.dice,
                { color: theme.text, transform: [{ rotate }, { scale }] },
              ]}>
              {DICE_FACES[face]}
            </Animated.Text>
            <ThemedText variant="title">{rolling ? '…' : face + 1}</ThemedText>
          </View>
          <Button
            title={rolling ? t('extras.diceRolling') : t('extras.diceButton')}
            onPress={rollDice}
            disabled={rolling}
          />
        </View>

        {/* C. YouTube...??? (solo el botón, sin explicaciones) */}
        <Button
          title={t('extras.youtubeButton')}
          onPress={() => WebBrowser.openBrowserAsync(MYSTERY_YOUTUBE_URL)}
        />

        {/* D. El pantógrafo (featured card) */}
        <View style={styles.pantoCard}>
          {/* Ilustración: catenaria + brazo articulado dibujados con Views */}
          <View style={styles.pantoScene}>
            <View style={styles.catenary} />
            <ThemedText style={styles.spark}>⚡</ThemedText>
            <View style={styles.contactStrip} />
            <View style={[styles.arm, styles.armUpper]} />
            <View style={[styles.arm, styles.armLower]} />
            <View style={styles.pantoBase} />
            <View style={styles.roof} />
          </View>
          <ThemedText style={styles.pantoKicker}>{t('extras.pantoKicker')}</ThemedText>
          <ThemedText style={styles.pantoTitle}>{t('extras.pantoTitle')}</ThemedText>
          <ThemedText style={styles.pantoDesc}>{t('extras.pantoDesc')}</ThemedText>
          <Pressable
            onPress={openPantograph}
            style={({ pressed }) => [styles.pantoButton, pressed && { opacity: 0.8 }]}>
            <ThemedText style={styles.pantoButtonText}>
              {t('extras.pantoButton')} →
            </ThemedText>
          </Pressable>
        </View>
      </Screen>
    </>
  );
}

const PANTO_BG = '#101A33';
const PANTO_STEEL = '#8FA8CC';
const PANTO_GOLD = '#F4C55C';

const styles = StyleSheet.create({
  container: { paddingBottom: 40, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  small: { fontSize: 12 },
  resultBox: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  diceArea: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  dice: { fontSize: 96, lineHeight: 104 },

  pantoCard: {
    backgroundColor: PANTO_BG,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    overflow: 'hidden',
  },
  pantoScene: { height: 130, marginBottom: 6 },
  catenary: {
    position: 'absolute',
    top: 14,
    left: -10,
    right: -10,
    height: 3,
    backgroundColor: PANTO_STEEL,
    opacity: 0.9,
  },
  spark: { position: 'absolute', top: 0, alignSelf: 'center', fontSize: 22 },
  contactStrip: {
    position: 'absolute',
    top: 22,
    alignSelf: 'center',
    width: 90,
    height: 6,
    borderRadius: 3,
    backgroundColor: PANTO_GOLD,
  },
  // Geometría del brazo articulado: del centro de la banda de contacto
  // (y≈25) baja al codo a media altura (x=centro+38, y≈66) y de ahí vuelve
  // al centro de la base (y≈113). Cada barra se coloca por su punto medio
  // y se rota para unir ambos extremos.
  arm: {
    position: 'absolute',
    height: 5,
    borderRadius: 3,
    backgroundColor: PANTO_STEEL,
    alignSelf: 'center',
  },
  armUpper: { width: 56, top: 43, transform: [{ translateX: 19 }, { rotate: '47deg' }] },
  armLower: { width: 60, top: 87, transform: [{ translateX: 19 }, { rotate: '-51deg' }] },
  pantoBase: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    width: 70,
    height: 10,
    borderRadius: 3,
    backgroundColor: PANTO_STEEL,
  },
  roof: {
    position: 'absolute',
    bottom: 0,
    left: -20,
    right: -20,
    height: 8,
    backgroundColor: '#2A3F5C',
  },
  pantoKicker: {
    color: PANTO_GOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pantoTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  pantoDesc: { color: '#C7D3E8', fontSize: 14, lineHeight: 21 },
  pantoButton: {
    marginTop: 8,
    backgroundColor: PANTO_GOLD,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pantoButtonText: { color: PANTO_BG, fontWeight: '800', fontSize: 15 },
});
