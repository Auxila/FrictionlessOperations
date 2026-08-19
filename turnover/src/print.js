/* ============================================================================
 * PRINT / SAVE AS PDF
 *
 * PDF is what you send someone who does not want to think about files. Rather
 * than bundling a PDF writer (~400 KB, and worse typography than the platform
 * gives away), the report is rendered into an off-screen same-origin iframe
 * and handed to the browser's own print engine. Every target platform can save
 * that to PDF: Windows has "Microsoft Print to PDF", macOS and iOS have PDF in
 * the print sheet, Android Chrome has "Save as PDF".
 *
 * srcdoc rather than document.write: it inherits the page's CSP cleanly and
 * needs no manual escaping of the payload.
 * ========================================================================= */

export function printDocument(html, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.title = 'Print preview';
    /* Off-screen rather than display:none — a hidden iframe is not laid out,
     * and an unlaid-out document prints blank. */
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:820px;height:1160px;border:0;opacity:0;pointer-events:none;';

    let settled = false;
    const cleanup = () => {
      /* Left in the DOM briefly: removing it while the print dialog is still
       * reading the document cancels the job in some browsers. */
      window.setTimeout(() => frame.remove(), 1500);
    };
    const finish = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };

    const guard = window.setTimeout(() => finish(new Error('Print timed out')), timeoutMs);

    frame.onload = () => {
      window.clearTimeout(guard);
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        finish();
      } catch (err) {
        finish(err);
      }
    };
    frame.onerror = () => {
      window.clearTimeout(guard);
      finish(new Error('Print preview failed to load'));
    };

    document.body.appendChild(frame);
    frame.srcdoc = html;
  });
}
