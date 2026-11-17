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

/** Browser geolocation wrapped in a promise with a friendly French error. */
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("La localisation n'est pas disponible sur cet appareil"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => reject(new Error('Autorisez la localisation ou choisissez un quartier')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
