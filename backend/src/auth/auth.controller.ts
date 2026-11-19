import { Body, Controller, Get, Ip, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth.decorators';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateMeDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Brute-force protection: few attempts per IP on credential endpoints.
  @Post('register')
  // Generous per-IP ceiling (shared Wi-Fi): email verification is the real anti-abuse (audit H2/H4).
  @Throttle({ default: { ttl: 60 * 60_000, limit: 30 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  // Only a high ceiling per IP here; failed attempts are limited per account in AuthService (audit H2).
  @Throttle({ default: { ttl: 15 * 60_000, limit: 100 } })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } }) // 5 emails / hour
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  /** A logged-in customer turns their account into a provider account. */
  /** Link from the "confirm your email" message. */
  @Post('verify-email')
  @Throttle({ default: { ttl: 15 * 60_000, limit: 20 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } })
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.sub);
  }

  @Post('become-provider')
  @UseGuards(JwtAuthGuard)
  becomeProvider(@CurrentUser() user: AuthUser) {
    return this.auth.becomeProvider(user.sub);
  }

  /** "Mon compte": update first name, last name, phone. */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  /** Permanently deletes the logged-in account (password required). */
  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.auth.deleteAccount(user.sub, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }
}
