import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Everything a provider can edit on their own profile (all optional = partial update). */
export class UpsertProfileDto {
  @IsOptional() @IsIn(['INDEPENDENT', 'BUSINESS']) kind?: 'INDEPENDENT' | 'BUSINESS';
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) tagline?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;

  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(80) neighbourhood?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;

  @IsOptional() @IsBoolean() atHome?: boolean;
  @IsOptional() @IsBoolean() inSalon?: boolean;
  @IsOptional() @IsBoolean() inShop?: boolean;
  @IsOptional() @IsBoolean() travels?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) travelRadiusKm?: number;
}

export class ServiceDto {
  @IsString() categoryId: string;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_00) priceCents: number;
  @IsOptional() @IsBoolean() priceFrom?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(24 * 60) durationMin?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DayHoursDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @IsBoolean() closed: boolean;
  @IsOptional() @Matches(TIME, { message: 'Format HH:MM' }) opensAt?: string;
  @IsOptional() @Matches(TIME, { message: 'Format HH:MM' }) closesAt?: string;
}

export class OpeningHoursDto {
  @ValidateNested({ each: true })
  @Type(() => DayHoursDto)
  @ArrayMaxSize(7)
  days: DayHoursDto[];
}

/** Query string of GET /providers/search. Everything optional. */
export class SearchQueryDto {
  @IsOptional() @IsString() category?: string; // category slug
  @IsOptional() @IsString() q?: string; // free text: name, service…
  @IsOptional() @IsString() place?: string; // neighbourhood/city name when no GPS
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) radiusKm?: number;
  @IsOptional() @IsIn(['INDEPENDENT', 'BUSINESS']) kind?: 'INDEPENDENT' | 'BUSINESS';
  @IsOptional() @IsIn(['atHome', 'inSalon', 'inShop', 'travels']) mode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number; // dollars
  @IsOptional() @IsIn(['distance', 'rating', 'price']) sort?: 'distance' | 'rating' | 'price';
}
