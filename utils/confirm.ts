import { Alert, Platform } from 'react-native';

/**
 * Diálogo de confirmación multiplataforma: Alert nativo en Android/iOS y
 * window.confirm en web (react-native-web no implementa Alert.alert).
 */
/** Aviso simple multiplataforma (Alert nativo / window.alert en web). */
export function alertMessage(title: string, message: string): void {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/**
 * Elección entre dos opciones (+ cancelar). En nativo usa Alert de 3 botones;
 * en web no hay diálogo de 3 vías decente, así que el llamador debe resolver
 * la elección de otro modo antes de llegar aquí (ver counter.tsx).
 */
export function chooseAsync<A extends string, B extends string>(options: {
  title: string;
  message: string;
  optionA: { label: string; value: A };
  optionB: { label: string; value: B };
  cancelLabel: string;
}): Promise<A | B | null> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(null) },
      { text: options.optionB.label, onPress: () => resolve(options.optionB.value) },
      { text: options.optionA.label, onPress: () => resolve(options.optionA.value) },
    ]);
  });
}

export function confirmAsync(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
