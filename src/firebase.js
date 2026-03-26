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
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    // Try popup first
    const result = await signInWithPopup(auth, provider)
    return result.user
  } catch (err) {
    // These error codes mean popup was blocked or not allowed — use redirect instead
    const useRedirect = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/unauthorized-domain',        // domain not in Firebase authorized list
    ].includes(err.code)

    if (useRedirect) {
      // This sends the user to Google's login page, then brings them back
      await signInWithRedirect(auth, provider)
      return null  // page will reload — result is handled in checkRedirectResult()
    }

    // Any other error — rethrow so the UI can show it
    throw err
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
