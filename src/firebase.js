// ============================================================
// Firebase Auth Setup
// ------------------------------------------------------------
// HOW TO GET YOUR VALUES:
//   1. Go to console.firebase.google.com
//   2. Click your project → Project Settings (gear icon)
//   3. Scroll down to "Your apps" → click the </> web icon
//   4. Copy the firebaseConfig object values into your .env:
//
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_APP_ID=...
//
// Then enable Google Sign-In:
//   Firebase Console → Authentication → Sign-in method → Google → Enable
// ============================================================

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Call this when user clicks "Sign in with Google"
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user  // contains user.uid, user.displayName, user.email
}

// Call this when user clicks "Sign out"
export async function logout() {
  await signOut(auth)
}
