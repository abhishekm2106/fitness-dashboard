import { MAX_CODE_ATTEMPTS } from '@/lib/auth/adapter';

export const WRONG_CODE = `That code didn't work. Check it and try again; after ${MAX_CODE_ATTEMPTS} wrong tries or 10 minutes, send a new one.`;
