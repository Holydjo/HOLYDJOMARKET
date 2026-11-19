/** Shapes returned by the API (kept minimal — only what the UI reads). */
export type Role = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
export type ProviderKind = 'INDEPENDENT' | 'BUSINESS';
export type ProfileStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AppointmentStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type Mode = 'atHome' | 'inSalon' | 'inShop' | 'travels';

export interface User { id: string; email: string; firstName: string; lastName: string; phone?: string | null; role: Role }
export interface Category { id: string; slug: string; name: string; icon: string; status?: 'APPROVED' | 'PENDING' }
export interface GeoResult {
  label: string; name: string; neighbourhood: string | null; city: string | null;
  lat: number; lng: number; kind: 'address' | 'street' | 'district' | 'city' | 'other';
}
export interface Place { name: string; city: string; lat: number; lng: number }

export interface Service {
  id: string; name: string; description?: string | null; priceCents: number; priceFrom: boolean;
  durationMin?: number | null; isActive: boolean; categoryId: string; category: Category;
}
export interface Photo { id: string; url: string; isCover: boolean; order: number }
export interface Hours { weekday: number; closed: boolean; opensAt: string | null; closesAt: string | null }
export interface Review { id: string; rating: number; comment?: string | null; createdAt: string; author: { firstName: string; lastName: string } }

export interface ProviderProfile {
  id: string; slug: string; kind: ProviderKind; displayName: string; tagline?: string | null; description?: string | null;
  phone?: string | null; whatsapp?: string | null; address?: string | null; neighbourhood?: string | null; city: string;
  latitude: number; longitude: number;
  atHome: boolean; inSalon: boolean; inShop: boolean; travels: boolean; travelRadiusKm: number;
  status: ProfileStatus; rejectionReason?: string | null; submittedAt?: string | null;
  ratingAvg: number; ratingCount: number;
  services: Service[]; photos: Photo[]; openingHours: Hours[]; reviews: Review[];
  isPreview?: boolean;
  /** Listing limits for this kind of provider (only on GET /me/profile). */
  limits?: { categories: number; services: number };
}

export interface SearchResult {
  id: string; slug: string; displayName: string; tagline?: string | null; kind: ProviderKind;
  city: string; neighbourhood?: string | null; latitude: number; longitude: number;
  modes: Record<Mode, boolean>; travelRadiusKm: number; ratingAvg: number; ratingCount: number;
  coverUrl: string | null; categories: Category[]; priceFromCents: number | null;
  topServices: { name: string; priceCents: number }[]; distanceKm: number | null; comesToYou: boolean;
}
export interface SearchResponse {
  center: { lat: number; lng: number; label: string } | null; radiusKm: number; total: number; results: SearchResult[];
}

export interface Appointment {
  id: string; requestedAt: string; status: AppointmentStatus; message?: string | null; location?: string | null;
  providerNote?: string | null; createdAt: string; profileId: string;
  service?: { name: string; priceCents: number; durationMin?: number | null } | null;
  profile: { displayName: string; slug: string; phone?: string | null; whatsapp?: string | null };
  customer: { firstName: string; lastName: string; email: string; phone?: string | null };
}
