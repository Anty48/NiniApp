import { Platform } from 'react-native';

/**
 * Notificación LOCAL inmediata en el propio dispositivo (solo Android nativo;
 * en web no hace nada). Sirve para avisos a uno mismo, p. ej. hitos de racha
 * personales. Para notificar a OTROS miembros está el push real de
 * services/push.ts (Web Push + FCM vía api/push.js).
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
