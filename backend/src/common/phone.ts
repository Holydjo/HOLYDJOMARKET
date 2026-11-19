import { Transform } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';
import { IsOptional, Matches, ValidateIf } from 'class-validator';

/**
 * Canadian / North-American phone numbers (+1).
 * Accepts "5145551234", "(514) 555-1234", "+1 514 555 1234", "1-514-555-1234"…
 * and stores them as "514-555-1234". Empty string = remove the number (null).
 */
export function normalizeCaPhone(value: unknown): unknown {
  if (value == null || typeof value !== 'string') return value;
  if (!value.trim()) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  // NANP: area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return value; // left as-is → fails @Matches below
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const FORMATTED = /^\d{3}-\d{3}-\d{4}$/;

/** Optional Canadian phone field: normalizes, then validates with a clear French message. */
export function IsOptionalCaPhone() {
  return applyDecorators(
    IsOptional(),
    Transform(({ value }) => normalizeCaPhone(value)),
    ValidateIf((_o, v) => v !== null && v !== undefined),
    Matches(FORMATTED, { message: 'Numéro de téléphone invalide. Exemple : 514-555-1234 (10 chiffres, indicatif canadien).' }),
  );
}
