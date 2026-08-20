/* ============================================================================
 * REPORT PREVIEW
 *
 * The report is rendered ON SCREEN, in the console's own document, and printed
 * from the top window.
 *
 * The previous approach — build the report into a hidden iframe and call
 * print() on it — could fail silently: where a browser treats that call as a
 * no-op (notably iOS Safari), the app cheerfully reported "print dialog
 * opened" and nothing happened. Printing a scrollable iframe is also only ever
 * guaranteed to emit its visible slice.
 *
 * Showing the report first means the operative always has something real in
 * front of them. If the print button does nothing on their platform, the page
 * is still right there for the browser's own Share → Print.
 * ========================================================================= */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

export function ReportPreview({ html, title, onClose }) {
  const [printable] = useState(() => typeof window.print === 'function');
  const restoreTitle = useRef(document.title);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    /* Lock the console's own scroll while the report is up. */
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.title = restoreTitle.current;
    };
  }, [onClose]);

  const print = () => {
    /* The print dialog seeds the PDF filename from document.title, so borrow
     * it for the duration and hand it back afterwards. */
    restoreTitle.current = document.title;
    document.title = title;
    try {
      window.print();
    } finally {
      document.title = restoreTitle.current;
    }
  };

  return createPortal(
    <div className="fo-report-host fixed inset-0 z-[70] flex flex-col bg-slate-950">
      <div className="fo-report-chrome flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2.5"
           style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
          Report preview
        </p>
        <button
          type="button"
          onClick={print}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.1em] text-slate-950 hover:bg-white"
        >
          <Printer size={16} strokeWidth={2.5} aria-hidden="true" />
          Save as PDF
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Trusted content: every value inside is escaped by buildReportBody. */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <p className="fo-report-chrome shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-2.5 text-center text-[11px] leading-relaxed text-slate-500"
         style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}>
        {printable
          ? 'Choose “Save as PDF” as the destination, then attach it to an email.'
          : 'This browser has no print button — use its own Share or menu, then Print.'}
      </p>
    </div>,
    document.body
  );
}
