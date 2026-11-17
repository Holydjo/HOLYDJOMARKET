import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;

  @IsString() @MinLength(1) firstName: string;
  @IsString() @MinLength(1) lastName: string;
  @IsOptional() @IsString() phone?: string;

  /** Self-service sign-up can only create customers or providers — never admins. */
  @IsIn(['CUSTOMER', 'PROVIDER'])
  role: 'CUSTOMER' | 'PROVIDER';
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
