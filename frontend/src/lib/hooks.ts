'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Category, Place } from './types';

/** Reference data is tiny and rarely changes: fetch once per page load and share. */
let catCache: Promise<Category[]> | null = null;
let placeCache: Promise<Place[]> | null = null;

export function useCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    catCache ??= api.get<Category[]>('/categories').catch((e) => { catCache = null; throw e; });
    catCache.then(setCats).catch(() => {});
  }, []);
  return cats;
}

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    placeCache ??= api.get<Place[]>('/places').catch((e) => { placeCache = null; throw e; });
    placeCache.then(setPlaces).catch(() => {});
  }, []);
  return places;
}

/**
 * Browser geolocation wrapped in a promise, with an explanation for each
 * failure (permission refused, no signal, timeout, not HTTPS).
 * Must be called from a tap/click: iPhone browsers only ask permission then.
 */
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      return reject(new Error('La localisation nécessite une connexion sécurisée (https). Tapez votre quartier à la place.'));
    }
    if (!navigator.geolocation) return reject(new Error("La localisation n'est pas disponible sur ce navigateur. Tapez votre quartier."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      (err) => reject(new Error(GEO_ERRORS[err.code] ?? GEO_ERRORS[2])),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  });
}

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

const GEO_ERRORS: Record<number, string> = {
  get 1() {
    return isIOS()
      ? 'Localisation refusée. Sur iPhone : Réglages › Confidentialité et sécurité › Service de localisation › votre navigateur (Safari, Brave…) › « Lorsque l’app est active ». Vérifiez aussi que ce site est autorisé dans les réglages du navigateur, puis réessayez — ou tapez votre quartier.'
      : 'Localisation refusée. Autorisez-la pour ce site dans les réglages du navigateur (icône à gauche de l’adresse), puis réessayez — ou tapez votre quartier.';
  },
  2: 'Position introuvable. Vérifiez que la localisation de l’appareil est activée, ou tapez votre quartier.',
  3: 'La localisation a pris trop de temps. Réessayez, ou tapez votre quartier.',
};
