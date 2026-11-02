import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { authConfig, configured } from '@/auth.config';
import { adapter } from '@/lib/auth/adapter';
import { CODE_TTL_SECONDS, generateCode, sendCode } from '@/lib/auth/email';

export { appleEnabled, configured, type ProviderId } from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  providers: [
    ...authConfig.providers,
    ...(configured.resend
      ? [
          Resend({
            apiKey: process.env.AUTH_RESEND_KEY,
            from: process.env.AUTH_EMAIL_FROM ?? 'Master Dashboard <onboarding@resend.dev>',
            maxAge: CODE_TTL_SECONDS,
            generateVerificationToken: generateCode,
            sendVerificationRequest: sendCode,
          }),
        ]
      : []),
  ],
});
