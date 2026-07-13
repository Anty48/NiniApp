import { Platform } from 'react-native';

/**
 * Notificaciones. En local se usan notificaciones inmediatas del dispositivo
 * (Android nativo). En web no hay soporte todavía.
 *
 * TODO(backend): sustituir por push real — FCM en Android y Web Push (VAPID +
 * service worker) para la PWA de iOS — enviadas desde Cloud Functions al crear
 * eventos y al alcanzar hitos de racha.
 */

let configured = false;

export async function notifyLocal(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    if (!configured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      configured = true;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // Sin permisos o sin soporte (p. ej. Expo Go limitado): se ignora.
  }
}
