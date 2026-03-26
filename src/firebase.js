import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:       import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:   import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:        import.meta.env.VITE_FIREBASE_APP_ID
}

const app      = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// ─── Sign in with Google ───────────────────────────────────────
// Strategy: try popup first (faster UX).
// If popup is blocked or fails (common on GitHub Pages / mobile),
// automatically fall back to redirect (full page redirect to Google).
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    console.error("Auth Error Code:", err.code); // Look for this in your browser console (F12)
    
    const useRedirect = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/unauthorized-domain', // This confirms Step 1 is the issue
    ].includes(err.code);

    if (useRedirect) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

// ─── Call this ONCE on app startup ────────────────────────────
// Checks if the user just came back from a Google redirect login.
// If they did, Firebase has their credentials waiting — this picks them up.
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth)
    return result?.user || null
  } catch (err) {
    console.error('Redirect result error:', err.message)
    return null
  }
}

// ─── Sign out ──────────────────────────────────────────────────
export async function logout() {
  await signOut(auth)
}
