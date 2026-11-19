import { IsOptionalCaPhone } from '../../common/phone';
import { Equals, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;

  @IsString() @MinLength(1) firstName: string;
  @IsString() @MinLength(1) lastName: string;
  @IsOptionalCaPhone() phone?: string | null;

  /** Self-service sign-up can only create customers or providers — never admins. */
  @IsIn(['CUSTOMER', 'PROVIDER'])
  role: 'CUSTOMER' | 'PROVIDER';

  /** Must be true: the user ticked "I accept the terms and the privacy policy". */
  @Equals(true, { message: 'Vous devez accepter les conditions d’utilisation et la politique de confidentialité' })
  acceptTerms: boolean;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email invalide' }) email: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

/** "Mon compte": editable personal details (email changes go through support for now). */
export class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) lastName?: string;
  @IsOptionalCaPhone() phone?: string | null;
}

export class ChangePasswordDto {
  @IsString() currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString() password: string;
}

export class VerifyEmailDto {
  @IsString() @MinLength(20) @MaxLength(200) token: string;
}
