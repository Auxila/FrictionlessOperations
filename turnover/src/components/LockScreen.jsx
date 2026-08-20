/* ============================================================================
 * LOCK SCREEN
 * A door, not a safe — see the warning at the top of src/passcode.js.
 * ========================================================================= */

import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';

import { rememberUnlock, verify } from '../passcode.js';
import { btn, input } from '../ui.jsx';

export function LockScreen({ onUnlock }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | wrong
  const [attempts, setAttempts] = useState(0);

  const submit = async (e) => {
    e?.preventDefault();
    if (state === 'checking' || !code) return;
    setState('checking');
    /* Yield a frame so the button can paint its checking state before the
     * derivation blocks the thread for ~250ms. */
    await new Promise((r) => setTimeout(r, 16));

    if (verify(code)) {
      rememberUnlock();
      onUnlock();
      return;
    }
    /* Escalating pause. Trivial to bypass with devtools, but it does take the
     * shine off someone standing there trying words. */
    const next = attempts + 1;
    setAttempts(next);
    setCode('');
    if (next >= 3) await new Promise((r) => setTimeout(r, Math.min(next * 400, 3000)));
    setState('wrong');
  };

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-xl flex-col items-center justify-center border-slate-800 bg-slate-950 px-6 text-slate-200 sm:border-x">
      <div className="w-full max-w-xs">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
            <Lock size={24} strokeWidth={2} aria-hidden="true" />
          </span>
          <h1 className="text-[15px] font-bold uppercase tracking-[0.22em] text-slate-100">
            Turnover Matrix
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Frictionless Operations
          </p>
        </div>

        <form onSubmit={submit}>
          <label htmlFor="passcode" className="block">
            <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <KeyRound size={11} aria-hidden="true" />
              Passcode
            </span>
            <input
              id="passcode"
              autoFocus
              type="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (state === 'wrong') setState('idle');
              }}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={state === 'wrong'}
              aria-describedby={state === 'wrong' ? 'passcode-error' : undefined}
              className={`${input} text-center font-mono tracking-[0.3em] ${
                state === 'wrong' ? 'border-red-500/60' : ''
              }`}
            />
          </label>

          <p
            id="passcode-error"
            role={state === 'wrong' ? 'alert' : undefined}
            className={`mt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] ${
              state === 'wrong' ? 'text-red-400' : 'text-transparent'
            }`}
          >
            {state === 'wrong' ? 'Incorrect passcode' : ' '}
          </p>

          <button
            type="submit"
            disabled={!code || state === 'checking'}
            className={`${btn.primary} mt-2 w-full`}
          >
            {state === 'checking' ? 'Checking…' : 'Unlock'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">
          Audits stay on this device. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
