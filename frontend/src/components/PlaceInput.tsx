'use client';

/**
 * Address / neighbourhood field with suggestions (GET /places/search).
 * Waits 300 ms after the last keystroke before asking the API, supports
 * keyboard navigation (↑ ↓ Enter Esc) and touch. Typing without picking a
 * suggestion is allowed: the API then geocodes the text itself.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { GeoResult } from '@/lib/types';

const KIND_ICON: Record<GeoResult['kind'], string> = { address: '🏠', street: '🛣️', district: '📍', city: '🏙️', other: '📌' };

interface Props {
  value: string;
  onChange: (text: string) => void; // free typing
  onPick: (r: GeoResult) => void; // a suggestion was chosen
  placeholder?: string;
  id?: string;
  className?: string;
  required?: boolean;
}

export function PlaceInput({ value, onChange, onPick, placeholder, id, className = '', required }: Props) {
  const [items, setItems] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [touched, setTouched] = useState(false); // only search after the user typed
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!touched || value.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get<GeoResult[]>(`/places/search?q=${encodeURIComponent(value.trim())}`)
        .then((r) => {
          if (cancelled) return;
          setItems(r);
          setActive(-1);
          setOpen(true);
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, touched]);

  // Close when tapping outside.
  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function pick(r: GeoResult) {
    onPick(r);
    setOpen(false);
    setTouched(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const showList = open && value.trim().length >= 2 && items.length > 0;

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        value={value}
        required={required}
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className={className}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 min-w-[260px] overflow-y-auto rounded-2xl border border-line bg-card p-1 shadow-xl">
          {items.map((r, i) => (
            <li key={`${r.label}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => pick(r)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === active ? 'bg-paper' : 'hover:bg-paper'}`}
              >
                <span aria-hidden>{KIND_ICON[r.kind]}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{[r.neighbourhood !== r.name ? r.neighbourhood : null, r.city !== r.name ? r.city : null].filter(Boolean).join(', ') || 'Québec'}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 pb-1 pt-2 text-[10px] text-muted">Adresses © OpenStreetMap</li>
        </ul>
      )}
    </div>
  );
}
