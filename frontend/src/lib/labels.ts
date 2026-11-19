/**
 * Shared UI vocabulary in one place. Page-specific copy stays in each page,
 * but every label reused across screens lives here so an English version can
 * be added later by swapping this dictionary.
 */
import { zoneLabelIfDifferent } from './time';
import type { AppointmentStatus, Mode, ProfileStatus, ProviderKind } from './types';

export const MODE_LABEL: Record<Mode, { label: string; short: string; icon: string }> = {
  atHome: { label: 'Reçoit chez soi', short: 'Chez le pro', icon: '🏠' },
  inSalon: { label: 'En salon', short: 'Salon', icon: '💺' },
  inShop: { label: 'En boutique', short: 'Boutique', icon: '🏪' },
  travels: { label: 'Se déplace chez vous', short: 'Se déplace', icon: '🚗' },
};
export const MODES = Object.keys(MODE_LABEL) as Mode[];

export const KIND_LABEL: Record<ProviderKind, string> = { INDEPENDENT: 'Indépendant·e', BUSINESS: 'Entreprise' };

export const PROFILE_STATUS: Record<ProfileStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'Brouillon', tone: 'bg-line text-ink' },
  PENDING: { label: 'En attente de validation', tone: 'bg-saffron/20 text-[#7a5205]' },
  APPROVED: { label: 'Publié', tone: 'bg-green-soft text-green' },
  REJECTED: { label: 'À corriger', tone: 'bg-danger-soft text-danger' },
};

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: string }> = {
  PENDING: { label: 'En attente', tone: 'bg-saffron/20 text-[#7a5205]' },
  ACCEPTED: { label: 'Acceptée', tone: 'bg-green-soft text-green' },
  DECLINED: { label: 'Refusée', tone: 'bg-danger-soft text-danger' },
  CANCELLED: { label: 'Annulée', tone: 'bg-line text-muted' },
};

export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
/** Display order: Monday first, as usual in Québec/France. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const money = (cents: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const duration = (min?: number | null) =>
  !min ? '' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ''}`;

/** Appointment date/time, shown in the provider's time zone (+ zone label if it isn't the viewer's). */
export const dateTime = (iso: string, timeZone?: string | null) => {
  const text = new Intl.DateTimeFormat('fr-CA', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
  const zone = zoneLabelIfDifferent(timeZone);
  return zone ? `${text} (${zone})` : text;
};

/** Reasons to report a profile or a review (same codes as the API). */
export const REPORT_REASONS: Record<string, string> = {
  fake: 'Faux profil ou faux avis',
  offensive: 'Contenu offensant ou discriminatoire',
  scam: 'Arnaque ou demande de paiement suspecte',
  wrong_info: 'Informations fausses (prix, adresse, services…)',
  other: 'Autre raison',
};
