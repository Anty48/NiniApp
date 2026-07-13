import { Platform } from 'react-native';

/**
 * Configuración de Firebase del proyecto NiniApp (niniapp-c401b).
 * Las claves de una app web de Firebase son públicas por diseño; la seguridad
 * la imponen las reglas de Firestore y Authentication.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyB-tu90Mx0UKXxLDLWo_MpNwoTo64pnurg',
  authDomain: 'niniapp-c401b.firebaseapp.com',
  projectId: 'niniapp-c401b',
  storageBucket: 'niniapp-c401b.firebasestorage.app',
  messagingSenderId: '159426937103',
  appId: '1:159426937103:web:3c1461032b57b4c60a3e7a',
};

interface FirebaseHandles {
  app: unknown;
  auth: any;
  db: any;
}

let handles: FirebaseHandles | null = null;

export function getFirebase(): FirebaseHandles {
  if (!handles) {
    // firebase v12 ya no incluye los builds de React Native en 'firebase/auth'
    // ni 'firebase/firestore'; hay que usar los paquetes scoped '@firebase/*'
    // (Metro resuelve su condición "react-native" en nativo y "browser" en web).
    // IMPORTANTE: usar '@firebase/*' en TODO el proyecto, sin mezclar con los
    // wrappers 'firebase/*': cada familia resuelve a un build distinto y el
    // bundle acaba con dos copias de @firebase/app ("Component auth has not
    // been registered yet").
    const { initializeApp } = require('@firebase/app');
    const app = initializeApp(firebaseConfig);
    const authMod = require('@firebase/auth');
    let auth;
    if (Platform.OS === 'web') {
      // En web la sesión se persiste sola (IndexedDB/localStorage).
      auth = authMod.getAuth(app);
    } else {
      // En nativo la sesión de Firebase Auth se persiste en AsyncStorage.
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      auth = authMod.initializeAuth(app, {
        persistence: authMod.getReactNativePersistence(AsyncStorage),
      });
    }

    // ignoreUndefinedProperties: nuestros modelos usan campos opcionales
    // (undefined) que Firestore rechazaría de otro modo.
    const { initializeFirestore } = require('@firebase/firestore');
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

    handles = { app, auth, db };
  }
  return handles;
}
