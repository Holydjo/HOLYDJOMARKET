'use client';

/**
 * "Le service se réveille…" toast (audit H3). Appears only while an API call
 * has been running for more than 3.5 s — typically the first visit after the
 * free Render server went to sleep — so the page never looks frozen.
 */
import { useEffect, useState } from 'react';

export function WakeNotice() {
  const [slow, setSlow] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setSlow((e as CustomEvent<number>).detail);
    window.addEventListener('holydjo:slow', on);
    return () => window.removeEventListener('holydjo:slow', on);
  }, []);
  if (!slow) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
        Le service se réveille… cela peut prendre jusqu’à une minute la première fois.
      </div>
    </div>
  );
}
