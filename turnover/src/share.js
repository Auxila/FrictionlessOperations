/* ============================================================================
 * SHARE
 *
 * Getting a summary onto a manager's screen with the fewest possible steps.
 * The native share sheet is the frictionless path — one tap from the app into
 * Messages, WhatsApp or Mail — but it needs a secure context and a real user
 * gesture, so there are two fallbacks beneath it. All three end with the text
 * somewhere the operative can send it, and the caller is told which happened
 * so it can say something true.
 * ========================================================================= */

/* Secure context: the share sheet and the async clipboard both require it, so
 * a console served over plain http on a LAN quietly lands on the last path. */
function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length); // iOS ignores select() alone
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export async function shareText({ title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      /* The user backing out of the sheet is not a failure — don't fall
       * through to the clipboard and claim we did something they cancelled. */
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      /* fall through */
    }
  }

  return legacyCopy(text) ? 'copied' : 'failed';
}
