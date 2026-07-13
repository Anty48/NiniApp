import { Platform } from 'react-native';

import { getFirebase } from '@/services/firebase';
import { User } from '@/types/models';

/**
 * Servicio de autenticación sobre Firebase Auth (email/contraseña + Google).
 */

/** Lee (o crea) el documento de perfil users/{uid} en Firestore. */
async function loadOrCreateUserDoc(
  firebaseUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null },
  fallbackUsername: string,
): Promise<User> {
  const { db } = getFirebase();
  const { doc, getDoc, setDoc } = require('@firebase/firestore');
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as User;

  const user: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    // Con Google, el nombre se hereda de la cuenta de Google.
    username: firebaseUser.displayName ?? fallbackUsername,
    photoUrl: firebaseUser.photoURL ?? undefined,
    allowPokes: true,
    groupIds: [],
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, user);
  return user;
}

// ---------- API pública ----------

/**
 * Espera a que Firebase Auth termine de rehidratar la sesión persistida
 * (AsyncStorage en nativo, IndexedDB en web) y devuelve el usuario de
 * Firebase, o null si no hay nadie autenticado en este dispositivo.
 */
export async function restoreFirebaseUser(): Promise<{
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
} | null> {
  const { auth } = getFirebase();
  await auth.authStateReady();
  return auth.currentUser;
}

/** Carga el perfil users/{uid} del usuario de Firebase (creándolo si falta). */
export async function loadUserDoc(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<User> {
  return loadOrCreateUserDoc(firebaseUser, firebaseUser.email?.split('@')[0] ?? 'user');
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { auth } = getFirebase();
  const { signInWithEmailAndPassword } = require('@firebase/auth');
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return loadOrCreateUserDoc(cred.user, email.split('@')[0]);
}

export async function signUpWithEmail(
  username: string,
  email: string,
  password: string,
): Promise<User> {
  const { auth } = getFirebase();
  const { createUserWithEmailAndPassword, updateProfile } = require('@firebase/auth');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: username });
  return loadOrCreateUserDoc({ ...cred.user, displayName: username }, username);
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<User> {
  const { auth } = getFirebase();
  const authMod = require('@firebase/auth');

  if (Platform.OS === 'web') {
    // Web (y PWA de iOS): popup oficial de Google.
    const provider = new authMod.GoogleAuthProvider();
    const cred = await authMod.signInWithPopup(auth, provider);
    return loadOrCreateUserDoc(cred.user, cred.user.email?.split('@')[0] ?? 'user');
  }

  // Android: Credential Manager nativo → idToken → Firebase. Solo funciona en
  // el development build (en Expo Go no existe el módulo nativo y el require
  // lanza; se muestra el aviso de usar email/contraseña).
  let gsi: any;
  try {
    gsi = require('react-native-nitro-google-signin');
  } catch {
    throw new Error('google-native-pending');
  }
  const { GoogleOneTapSignIn, isSuccessResponse, isNoSavedCredentialFoundResponse } = gsi;

  if (!googleConfigured) {
    // El web client ID se lee de google-services.json (default_web_client_id).
    GoogleOneTapSignIn.configure({ webClientId: 'autoDetect' });
    googleConfigured = true;
  }
  await GoogleOneTapSignIn.checkPlayServices();

  // Primero intenta con las cuentas ya autorizadas; si no hay ninguna,
  // muestra el selector con todas las cuentas Google del dispositivo.
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (!isSuccessResponse(response)) throw new Error('google-cancelled');

  const credential = authMod.GoogleAuthProvider.credential(response.data.idToken);
  const cred = await authMod.signInWithCredential(auth, credential);
  return loadOrCreateUserDoc(cred.user, cred.user.email?.split('@')[0] ?? 'user');
}

export async function signOut(): Promise<void> {
  const { auth } = getFirebase();
  const { signOut: fbSignOut } = require('@firebase/auth');
  await fbSignOut(auth);
}

/**
 * Traduce un error de autenticación a un mensaje mostrable, o null si no hay
 * nada que enseñar (el usuario cerró el popup de Google).
 */
export function authErrorMessage(e: unknown, t: (key: string) => string): string | null {
  const message = (e as Error)?.message;
  if (message === 'google-native-pending') return t('auth.googleNativeSoon');
  if (message === 'google-cancelled') return null;
  const code = (e as { code?: string })?.code;
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'SIGN_IN_CANCELLED':
      return null;
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return t('auth.googleNotEnabled');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return t('auth.badCredentials');
    case 'auth/email-already-in-use':
      return t('auth.emailInUse');
    case 'auth/weak-password':
      return t('auth.weakPassword');
    case 'auth/invalid-email':
      return t('auth.invalidEmail');
    default:
      // Código desconocido: se muestra para poder diagnosticarlo.
      return code ? `${t('common.error')} (${code})` : t('common.error');
  }
}

/** Persiste cambios del perfil propio en users/{uid}. */
export async function saveUserDoc(user: User): Promise<void> {
  const { db } = getFirebase();
  const { doc, setDoc } = require('@firebase/firestore');
  await setDoc(doc(db, 'users', user.id), user);
}
