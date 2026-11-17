'use client';

/** Upload (JPG/PNG/WEBP ≤ 5 MB, max 12), choose the cover, delete. */
import { useRef, useState } from 'react';
import { Alert, Cover } from '@/components/ui';
import { api } from '@/lib/api';
import type { ProviderProfile } from '@/lib/types';

export function PhotosEditor({ profile, onChange }: { profile: ProviderProfile; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setBusy(true);
    try {
      for (const file of Array.from(files)) await api.upload('/me/profile/photos', file);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
      onChange();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="h-display text-xl font-bold">Mes photos</h2>
        <p className="text-sm text-muted">Montrez vos réalisations et votre lieu. La photo de couverture apparaît dans les résultats.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {profile.photos.map((ph) => (
          <div key={ph.id} className="group relative overflow-hidden rounded-2xl border border-line">
            <Cover url={ph.url} alt="" className="aspect-square w-full" />
            {ph.isCover && <span className="badge absolute left-2 top-2 bg-ink text-white">Couverture</span>}
            <div className="absolute inset-x-2 bottom-2 flex gap-1">
              {!ph.isCover && (
                <button onClick={() => api.patch(`/me/profile/photos/${ph.id}/cover`).then(onChange)} className="btn btn-sm flex-1 bg-card/95 px-2">★ Couverture</button>
              )}
              <button onClick={() => confirm('Supprimer cette photo ?') && api.del(`/me/profile/photos/${ph.id}`).then(onChange)} className="btn btn-sm bg-card/95 px-3 text-danger" aria-label="Supprimer la photo">✕</button>
            </div>
          </div>
        ))}
        {profile.photos.length < 12 && (
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-muted transition hover:border-primary hover:text-primary"
          >
            <span className="text-center"><span className="block text-3xl">{busy ? '…' : '+'}</span>{busy ? 'Envoi…' : 'Ajouter des photos'}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
    </div>
  );
}
