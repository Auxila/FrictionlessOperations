/* ============================================================================
 * PASSCODE GATE
 *
 * ⚠ READ THIS BEFORE TRUSTING IT ⚠
 *
 * This is a DOOR, NOT A SAFE. The console is a static page on a public host;
 * every byte of it, this check included, is downloaded by whoever asks. A
 * determined person can read the source, skip the gate in devtools, or fetch
 * the raw file. Nothing running in a browser can prevent that.
 *
 * What it genuinely does:
 *   - stops someone who finds the URL from wandering into a working tool
 *   - lets an operative lock the screen before handing their phone to anyone
 *
 * What it does NOT do:
 *   - protect audit data already on the device. That lives in localStorage in
 *     the clear; anyone with the unlocked phone and devtools can read it.
 *   - keep out anyone motivated. Treat it as a "staff only" sign.
 *
 * For real protection, the gate has to live in front of the server: Cloudflare
 * Access, a host with built-in password protection, or simply not publishing
 * the app at a public URL.
 *
 * The passcode is stored stretched and salted rather than in plain sight, so
 * it is at least not sitting in view-source, and a stock rainbow table does not
 * resolve it. Change it with:  npm run set-passcode -- <newcode>
 * ========================================================================= */

import { sha256Hex } from './sha256.js';
import { PASSCODE } from './passcode-config.js';

export const UNLOCK_KEY = 'fo.turnover.unlocked.v1';

/* Salted and iterated. Iteration count is deliberately high enough to cost a
 * guesser real time per attempt while staying imperceptible for one unlock. */
export function derive(code, salt = PASSCODE.salt, iterations = PASSCODE.iterations) {
  let h = `${salt}:${String(code)}`;
  for (let i = 0; i < iterations; i += 1) h = sha256Hex(h);
  return h;
}

/* Length-independent comparison. Barely matters for a client-side check, but
 * there is no reason to leak a prefix match through timing. */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const isEnabled = () => Boolean(PASSCODE.hash);

export function verify(code) {
  if (!isEnabled()) return true;
  return constantTimeEqual(derive(code), PASSCODE.hash);
}

/* The unlock is remembered per device. An operative mid-walkthrough with cold
 * hands should not be re-prompted; the explicit Lock button covers the case
 * that actually matters — handing the phone to somebody. */
export function isUnlocked() {
  if (!isEnabled()) return true;
  try {
    return window.localStorage.getItem(UNLOCK_KEY) === PASSCODE.hash.slice(0, 16);
  } catch {
    return false;
  }
}

export function rememberUnlock() {
  try {
    window.localStorage.setItem(UNLOCK_KEY, PASSCODE.hash.slice(0, 16));
  } catch {
    /* Storage blocked: the session still unlocks, it just will not persist. */
  }
}

export function lock() {
  try {
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* nothing to clear */
  }
}
